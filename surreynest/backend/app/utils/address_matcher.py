"""Address matcher: link HMO records to properties via address normalisation.

Normalises addresses from both HMO register and EPC/properties tables,
then matches on postcode + house number + street name. No external
dependencies, uses only regex and string operations.

HMO format:  '75 Denzil Road, GUILDFORD, Surrey, GU2 7NG'
EPC format:  '11, Denzil Road'  or  'Flat 1, 146, London Road'
"""

import logging
import re
from typing import Dict, List, Optional, Tuple

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.hmo_record import HmoRecord

logger = logging.getLogger(__name__)

# ── Street abbreviation expansions ───────────────────────────────────────────
STREET_ABBREVS = {
    r"\bRD\b": "ROAD",
    r"\bST\b": "STREET",
    r"\bAVE\b": "AVENUE",
    r"\bAV\b": "AVENUE",
    r"\bDR\b": "DRIVE",
    r"\bLN\b": "LANE",
    r"\bCT\b": "COURT",
    r"\bCL\b": "CLOSE",
    r"\bPL\b": "PLACE",
    r"\bCRES\b": "CRESCENT",
    r"\bTCE\b": "TERRACE",
    r"\bTERR\b": "TERRACE",
    r"\bGDN\b": "GARDENS",
    r"\bGDNS\b": "GARDENS",
    r"\bPK\b": "PARK",
    r"\bSQ\b": "SQUARE",
    r"\bGRV\b": "GROVE",
    r"\bMWS\b": "MEWS",
}

# ── Town/county names to strip from HMO addresses ───────────────────────────
STRIP_TOWNS = {"GUILDFORD", "GODALMING", "CRANLEIGH", "FARNHAM", "SURREY"}

# ── Postcode regex ───────────────────────────────────────────────────────────
POSTCODE_REGEX = re.compile(r"\bGU\d{1,2}\s?\d[A-Z]{2}\b", re.IGNORECASE)

# ── House number regex (leading number, possibly with letter suffix) ─────────
HOUSE_NUM_REGEX = re.compile(r"^(\d+[A-Z]?)\b")


def normalise_address(raw: str) -> str:
    """Normalise an address string for comparison.

    Steps:
        1. Uppercase
        2. Remove postcode
        3. Remove town/county names (GUILDFORD, SURREY)
        4. Expand street abbreviations (RD→ROAD, ST→STREET, etc.)
        5. Remove all punctuation except spaces
        6. Collapse whitespace

    Args:
        raw: Raw address string from either HMO or EPC data.

    Returns:
        Normalised address string.
    """
    s = str(raw).upper().strip()

    # Remove postcode
    s = POSTCODE_REGEX.sub("", s)

    # Remove town/county names
    for town in STRIP_TOWNS:
        s = re.sub(rf"\b{town}\b", "", s)

    # Remove flat/apartment prefixes but keep the number after them
    # "Flat 1, 146, London Road" → "1 146 LONDON ROAD"
    s = re.sub(r"\bFLAT\b", "", s, flags=re.IGNORECASE)
    s = re.sub(r"\bAPT\b", "", s, flags=re.IGNORECASE)
    s = re.sub(r"\bAPARTMENT\b", "", s, flags=re.IGNORECASE)
    s = re.sub(r"\bUNIT\b", "", s, flags=re.IGNORECASE)
    s = re.sub(r"\bROOM\b", "", s, flags=re.IGNORECASE)

    # Expand street abbreviations
    for abbrev, full in STREET_ABBREVS.items():
        s = re.sub(abbrev, full, s)

    # Remove all punctuation (commas, periods, hyphens, slashes)
    s = re.sub(r"[,.\-/\\()]", " ", s)

    # Collapse whitespace
    s = re.sub(r"\s+", " ", s).strip()

    return s


def extract_number_and_street(normalised: str) -> Tuple[Optional[str], str]:
    """Extract house number and street name from a normalised address.

    Args:
        normalised: Normalised address from normalise_address().

    Returns:
        Tuple of (house_number, street_name). house_number may be None
        if no leading number found. street_name is the remainder.

    Examples:
        '75 DENZIL ROAD' → ('75', 'DENZIL ROAD')
        '11 DENZIL ROAD' → ('11', 'DENZIL ROAD')
        '1 146 LONDON ROAD' → ('1', '146 LONDON ROAD')  # flat number
        'BROADACRES' → (None, 'BROADACRES')
    """
    match = HOUSE_NUM_REGEX.match(normalised)
    if match:
        number = match.group(1)
        street = normalised[match.end():].strip()
        return (number, street)
    return (None, normalised)


def _build_property_lookup(
    db: Session,
) -> Dict[str, List[Tuple[str, str, str]]]:
    """Build a postcode → [(uprn, normalised_address, raw_address)] lookup.

    Args:
        db: SQLAlchemy session.

    Returns:
        Dict mapping normalised postcode to list of (uprn, norm_addr, raw_addr).
    """
    rows = db.execute(
        text("SELECT uprn, address, postcode FROM properties WHERE postcode IS NOT NULL")
    ).fetchall()

    lookup: Dict[str, List[Tuple[str, str, str]]] = {}
    for uprn, address, postcode in rows:
        norm = normalise_address(address)
        lookup.setdefault(postcode, []).append((uprn, norm, address))

    logger.info("Built property lookup: %d postcodes, %d properties", len(lookup), len(rows))
    return lookup


def match_hmo_to_properties(db: Session) -> Dict[str, str]:
    """Match HMO records to properties by postcode + address.

    Three-tier matching:
        Tier 1 (exact): postcode + normalised address exact match
        Tier 2 (fuzzy): postcode + same street name + same house number
                        (handles minor formatting differences)
        Tier 3 (postcode-only): logged but NOT assigned

    Args:
        db: SQLAlchemy session.

    Returns:
        Dict of statistics: {exact, fuzzy, unmatched_no_postcode,
        unmatched_no_address, total, matched}.
    """
    # ── Load all HMO records ─────────────────────────────────────────────
    hmo_records = db.query(HmoRecord).all()
    if not hmo_records:
        logger.info("No HMO records to match")
        return {"total": 0, "matched": 0, "exact": 0, "fuzzy": 0,
                "unmatched_no_postcode": 0, "unmatched_no_address": 0}

    logger.info("Matching %d HMO records to properties", len(hmo_records))

    # ── Build property lookup by postcode ────────────────────────────────
    prop_lookup = _build_property_lookup(db)

    # ── Match each HMO record ────────────────────────────────────────────
    exact_count = 0
    fuzzy_count = 0
    no_postcode = 0
    no_match = 0

    for hmo in hmo_records:
        if not hmo.postcode:
            no_postcode += 1
            continue

        candidates = prop_lookup.get(hmo.postcode, [])
        if not candidates:
            no_match += 1
            continue

        hmo_norm = normalise_address(hmo.raw_address)
        hmo_num, hmo_street = extract_number_and_street(hmo_norm)

        matched_uprn = None
        confidence = None

        # ── Tier 1: exact normalised match ───────────────────────────
        for uprn, prop_norm, _raw in candidates:
            if hmo_norm == prop_norm:
                matched_uprn = uprn
                confidence = "exact"
                break

        # ── Tier 2: number + street match ────────────────────────────
        if not matched_uprn and hmo_num and hmo_street:
            for uprn, prop_norm, _raw in candidates:
                prop_num, prop_street = extract_number_and_street(prop_norm)
                if prop_num == hmo_num and prop_street == hmo_street:
                    matched_uprn = uprn
                    confidence = "fuzzy"
                    break

        # ── Tier 2b: street-only with number in wider string ─────────
        if not matched_uprn and hmo_num and hmo_street:
            for uprn, prop_norm, _raw in candidates:
                # Check if the HMO number appears anywhere and street matches
                prop_num, prop_street = extract_number_and_street(prop_norm)
                if (prop_street == hmo_street and
                        hmo_num in prop_norm.split()):
                    matched_uprn = uprn
                    confidence = "fuzzy"
                    break

        # ── Update record ────────────────────────────────────────────
        if matched_uprn:
            hmo.uprn = matched_uprn
            hmo.match_confidence = confidence
            if confidence == "exact":
                exact_count += 1
            else:
                fuzzy_count += 1
        else:
            no_match += 1

    db.commit()

    stats = {
        "total": len(hmo_records),
        "matched": exact_count + fuzzy_count,
        "exact": exact_count,
        "fuzzy": fuzzy_count,
        "unmatched_no_postcode": no_postcode,
        "unmatched_no_address": no_match,
    }

    logger.info(
        "HMO matching complete:\n"
        "  Total:      %d\n"
        "  Matched:    %d (exact=%d, fuzzy=%d)\n"
        "  Unmatched:  %d (no postcode=%d, no address match=%d)",
        stats["total"],
        stats["matched"], stats["exact"], stats["fuzzy"],
        stats["unmatched_no_postcode"] + stats["unmatched_no_address"],
        stats["unmatched_no_postcode"],
        stats["unmatched_no_address"],
    )

    return stats
