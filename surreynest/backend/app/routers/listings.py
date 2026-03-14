"""Listing checker: POST /listings/check.

Accepts a SpareRoom / Rightmove / OpenRent URL, fetches the page HTML,
extracts UK postcodes via regex, and returns SurreyNest analysis for the
best-matching GU postcode.
"""

import logging
import re
from collections import Counter
from typing import Optional
from urllib.parse import urlparse

import requests as http_requests
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from app.rate_limit import limiter  # shared singleton — one instance for the whole app
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.property import Property
from app.services.score_service import get_safety_score, get_rent_prediction

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Allowed domains ──────────────────────────────────────────────────────────
ALLOWED_DOMAINS = {
    "spareroom.co.uk",
    "www.spareroom.co.uk",
    "rightmove.co.uk",
    "www.rightmove.co.uk",
    "openrent.com",
    "www.openrent.com",
    "zoopla.co.uk",
    "www.zoopla.co.uk",
}

# UK postcode regex (full postcode)
UK_POSTCODE_RE = re.compile(
    r"\b([A-Z]{1,2}\d[0-9A-Z]?\s*\d[A-Z]{2})\b", re.IGNORECASE
)

# GU postcodes only
GU_PREFIX_RE = re.compile(r"^GU\d", re.IGNORECASE)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-GB,en;q=0.9",
}


# ── Schemas ──────────────────────────────────────────────────────────────────
class CheckListingRequest(BaseModel):
    url: str = Field(..., min_length=10, max_length=500)
    postcode: Optional[str] = Field(None, max_length=10)  # user-supplied postcode (skips scraping)


class NearbyProperty(BaseModel):
    uprn: str
    address: str
    postcode: str
    property_type: Optional[str] = None
    num_rooms: Optional[int] = None
    tenure: Optional[str] = None


class CheckListingResponse(BaseModel):
    postcode: str
    postcode_sector: str
    source_domain: str
    original_url: str
    safety_score: Optional[float] = None
    safety_label: Optional[str] = None
    avg_predicted_rent_weekly: Optional[float] = None
    avg_predicted_rent_monthly: Optional[float] = None
    properties_in_area: int = 0
    nearby_properties: list[NearbyProperty] = []
    hmo_licensed_count: int = 0
    hmo_total_count: int = 0
    flood_risk_severity: Optional[str] = None
    message: str = ""


# ── Helpers ──────────────────────────────────────────────────────────────────
def _normalise_postcode(pc: str) -> str:
    """Normalise full postcode: uppercase, single space (e.g. GU1 3JT)."""
    pc = re.sub(r"\s+", "", pc.strip().upper())
    if len(pc) >= 4:
        return pc[:-3] + " " + pc[-3:]
    return pc


# District-only pattern: GU1, GU2, GU3 … (letters + digits, no inward code)
GU_DISTRICT_RE = re.compile(r"^GU\d{1,2}$", re.IGNORECASE)


def _is_district_only(s: str) -> bool:
    """Return True if s is a district code like GU1 rather than a full postcode."""
    return bool(GU_DISTRICT_RE.match(s.strip()))


def _extract_postcodes_from_html(html: str) -> list[str]:
    """Extract all UK postcodes from HTML content."""
    raw = UK_POSTCODE_RE.findall(html)
    return [_normalise_postcode(pc) for pc in raw]


def _pick_best_gu_postcode(postcodes: list[str]) -> Optional[str]:
    """Pick the most frequent GU postcode from the list."""
    gu_postcodes = [pc for pc in postcodes if GU_PREFIX_RE.match(pc)]
    if not gu_postcodes:
        return None
    counter = Counter(gu_postcodes)
    return counter.most_common(1)[0][0]


def _postcode_sector(postcode: str) -> str:
    """Extract postcode sector, e.g. 'GU2 7' from 'GU2 7XH'."""
    parts = postcode.strip().split()
    if len(parts) == 2 and len(parts[1]) >= 1:
        return parts[0] + " " + parts[1][0]
    return postcode


# ── Main endpoint ────────────────────────────────────────────────────────────
@router.post(
    "/listings/check",
    response_model=CheckListingResponse,
    summary="Check a rental listing URL",
)
@limiter.limit("10/minute")
async def check_listing(
    body: CheckListingRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> CheckListingResponse:
    """Fetch a rental listing page and return SurreyNest area analysis.

    Supports SpareRoom, Rightmove, OpenRent, and Zoopla URLs.
    Extracts postcodes from page content and returns safety, rent, HMO data.
    """
    url = body.url.strip()

    # ── Validate domain ──────────────────────────────────────────────────
    parsed = urlparse(url)
    domain = parsed.netloc.lower()
    if domain not in ALLOWED_DOMAINS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported website. Supported: SpareRoom, Rightmove, OpenRent, Zoopla",
        )

    # ── Resolve postcode ─────────────────────────────────────────────────
    # If the user supplied a postcode directly, use it (most reliable).
    # Otherwise attempt to scrape the listing page — many sites block this.
    best_postcode: Optional[str] = None

    if body.postcode:
        raw = body.postcode.strip().upper()
        # Accept district-only (GU1) or full postcode (GU1 3JT)
        if _is_district_only(raw):
            candidate = raw  # keep as-is, e.g. "GU1"
        else:
            candidate = _normalise_postcode(raw)
        if not GU_PREFIX_RE.match(candidate):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{candidate} is outside the Guildford (GU) area. SurreyNest only covers GU postcodes.",
            )
        best_postcode = candidate
        logger.info("Using user-supplied area/postcode: %s", best_postcode)
    else:
        # Try scraping — best effort; many listing sites block crawlers
        try:
            resp = http_requests.get(url, headers=HEADERS, timeout=10, allow_redirects=True)
            resp.raise_for_status()
            all_postcodes = _extract_postcodes_from_html(resp.text)
            best_postcode = _pick_best_gu_postcode(all_postcodes)
            if not best_postcode:
                non_gu = [pc for pc in all_postcodes if not GU_PREFIX_RE.match(pc)]
                if non_gu:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=f"Found postcode(s) {', '.join(set(non_gu[:3]))} but SurreyNest only covers GU (Guildford) areas. Enter the postcode manually.",
                    )
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Could not extract a Guildford postcode from this listing page. Please enter the postcode manually.",
                )
        except HTTPException:
            raise
        except http_requests.RequestException as exc:
            logger.warning("Failed to fetch listing URL %s: %s", url, exc)
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Could not fetch the listing page — the site may be blocking automated requests. Please enter the postcode manually.",
            )

    # ── District vs full postcode ─────────────────────────────────────────
    is_district = _is_district_only(best_postcode)
    # Build the SQLAlchemy filter expression once — reused across all queries
    if is_district:
        pc_filter = Property.postcode.like(f"{best_postcode} %")
        display_area = f"{best_postcode} area"
    else:
        pc_filter = Property.postcode == best_postcode
        display_area = best_postcode

    # For safety score: use a representative sector.
    # Full postcode → derive sector normally.
    # District → pick the most common sector among matching properties.
    if is_district:
        sector_rows = (
            db.query(Property.postcode)
            .filter(pc_filter)
            .limit(200)
            .all()
        )
        sector_counts: Counter = Counter(
            _postcode_sector(r[0]) for r in sector_rows if r[0]
        )
        sector = sector_counts.most_common(1)[0][0] if sector_counts else best_postcode
    else:
        sector = _postcode_sector(best_postcode)

    # ── Query our data ───────────────────────────────────────────────────
    properties_count = (
        db.query(func.count(Property.uprn))
        .filter(pc_filter)
        .scalar()
        or 0
    )

    nearby_rows = (
        db.query(Property)
        .filter(pc_filter)
        .order_by(Property.address.asc())
        .limit(10)
        .all()
    )
    nearby = [
        NearbyProperty(
            uprn=p.uprn,
            address=p.address,
            postcode=p.postcode,
            property_type=p.property_type,
            num_rooms=p.num_rooms,
            tenure=p.tenure,
        )
        for p in nearby_rows
    ]

    # Safety score
    safety = get_safety_score(sector, db)
    safety_score_val = safety.get("score") if safety else None
    safety_label = safety.get("label") if safety else None

    # Average rent prediction
    avg_rent = None
    rent_rows = (
        db.query(Property)
        .filter(pc_filter)
        .limit(20)
        .all()
    )
    rents = []
    for p in rent_rows:
        pred = get_rent_prediction(p.uprn, db)
        if pred and pred.get("predicted_weekly_rent"):
            rents.append(pred["predicted_weekly_rent"])
    if rents:
        avg_rent = round(sum(rents) / len(rents), 2)

    # HMO counts
    try:
        from app.models.hmo_record import HmoRecord

        if is_district:
            hmo_filter = HmoRecord.postcode.like(f"{best_postcode} %")
        else:
            hmo_filter = HmoRecord.postcode == best_postcode

        hmo_total = (
            db.query(func.count(HmoRecord.id))
            .filter(hmo_filter)
            .scalar()
            or 0
        )
        hmo_licensed = (
            db.query(func.count(HmoRecord.id))
            .filter(hmo_filter, HmoRecord.is_active == True)  # noqa: E712
            .scalar()
            or 0
        )
    except Exception as exc:
        logger.warning("HMO query failed: %s", exc)
        hmo_total = 0
        hmo_licensed = 0

    flood_severity = None  # FloodRisk model not yet implemented

    return CheckListingResponse(
        postcode=display_area,
        postcode_sector=sector,
        source_domain=domain,
        original_url=url,
        safety_score=safety_score_val,
        safety_label=safety_label,
        avg_predicted_rent_weekly=avg_rent,
        avg_predicted_rent_monthly=round(avg_rent * 52 / 12, 2) if avg_rent else None,
        properties_in_area=properties_count,
        nearby_properties=nearby,
        hmo_licensed_count=hmo_licensed,
        hmo_total_count=hmo_total,
        flood_risk_severity=flood_severity,
        message=f"Analysis for {display_area} based on {properties_count} properties in our database.",
    )
