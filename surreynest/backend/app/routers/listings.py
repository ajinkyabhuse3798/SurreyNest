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
    """Normalise postcode: uppercase, single space."""
    pc = re.sub(r"\s+", "", pc.strip().upper())
    if len(pc) >= 4:
        return pc[:-3] + " " + pc[-3:]
    return pc


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
            detail=f"Unsupported website. Supported: SpareRoom, Rightmove, OpenRent, Zoopla",
        )

    # ── Fetch page ───────────────────────────────────────────────────────
    try:
        resp = http_requests.get(url, headers=HEADERS, timeout=10, allow_redirects=True)
        resp.raise_for_status()
    except http_requests.RequestException as exc:
        logger.warning("Failed to fetch listing URL: %s — %s", url, exc)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not fetch the listing page. Check the URL and try again.",
        )

    # ── Extract postcodes ────────────────────────────────────────────────
    html = resp.text
    all_postcodes = _extract_postcodes_from_html(html)
    best_postcode = _pick_best_gu_postcode(all_postcodes)

    if not best_postcode:
        # Try to find ANY postcode as fallback info
        non_gu = [pc for pc in all_postcodes if not GU_PREFIX_RE.match(pc)]
        if non_gu:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Found postcode(s) {', '.join(set(non_gu[:3]))} but SurreyNest only covers GU (Guildford) areas.",
            )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not extract a postcode from this listing page.",
        )

    sector = _postcode_sector(best_postcode)

    # ── Query our data ───────────────────────────────────────────────────
    # Count properties at this postcode
    properties_count = (
        db.query(func.count(Property.uprn))
        .filter(Property.postcode == best_postcode)
        .scalar()
        or 0
    )

    # Get nearby properties (same postcode)
    nearby_rows = (
        db.query(Property)
        .filter(Property.postcode == best_postcode)
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

    # Average rent prediction for properties at this postcode
    avg_rent = None
    rent_rows = (
        db.query(Property)
        .filter(Property.postcode == best_postcode)
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

        hmo_total = (
            db.query(func.count(HmoRecord.id))
            .filter(HmoRecord.postcode == best_postcode)
            .scalar()
            or 0
        )
        hmo_licensed = (
            db.query(func.count(HmoRecord.id))
            .filter(
                HmoRecord.postcode == best_postcode,
                HmoRecord.licence_status.ilike("%active%"),
            )
            .scalar()
            or 0
        )
    except Exception:
        hmo_total = 0
        hmo_licensed = 0

    # Flood risk
    flood_severity = None
    try:
        from app.models.flood_risk import FloodRisk

        flood = (
            db.query(FloodRisk)
            .filter(FloodRisk.postcode == best_postcode)
            .first()
        )
        if flood:
            flood_severity = flood.current_severity
    except Exception:
        pass

    return CheckListingResponse(
        postcode=best_postcode,
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
        message=f"Analysis for {best_postcode} ({sector} sector) based on {properties_count} properties in our database.",
    )
