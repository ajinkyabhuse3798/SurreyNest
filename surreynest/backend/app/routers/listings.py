"""Listing checker: POST /listings/check.

Accepts a manually entered Guildford postcode plus optional pasted listing wording.
"""

import logging
import re
from collections import Counter
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from app.rate_limit import limiter  # shared singleton, one instance for the whole app
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.property import Property
from app.schemas.listings import (
    CheckListingRequest,
    CheckListingResponse,
    NearbyProperty,
)
from app.services.listing_compliance_service import analyse_listing_compliance
from app.services.score_service import get_safety_score, get_rent_prediction

logger = logging.getLogger(__name__)

router = APIRouter()


# GU postcodes only
GU_PREFIX_RE = re.compile(r"^GU\d", re.IGNORECASE)


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
    summary="Check a rental listing reference",
)
@limiter.limit("10/minute")
async def check_listing(
    body: CheckListingRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> CheckListingResponse:
    """Analyse a listing using manual Guildford inputs only.

    Requires a manual postcode and optionally scans pasted wording.
    """

    # ── Resolve postcode ─────────────────────────────────────────────────
    best_postcode: Optional[str] = None
    listing_text = body.listing_text.strip() if body.listing_text else None
    listing_text_source = "manual_text" if listing_text else None

    if not body.postcode or not body.postcode.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please enter the Guildford postcode manually to analyse this listing.",
        )

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
    logger.info("Using manual area/postcode for listing analysis: %s", best_postcode)

    # ── District vs full postcode ─────────────────────────────────────────
    is_district = _is_district_only(best_postcode)
    # Build the SQLAlchemy filter expression once, reused across all queries
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
        sector_rows = db.query(Property.postcode).filter(pc_filter).limit(200).all()
        sector_counts: Counter = Counter(
            _postcode_sector(r[0]) for r in sector_rows if r[0]
        )
        sector = sector_counts.most_common(1)[0][0] if sector_counts else best_postcode
    else:
        sector = _postcode_sector(best_postcode)

    # ── Query our data ───────────────────────────────────────────────────
    properties_count = (
        db.query(func.count(Property.uprn)).filter(pc_filter).scalar() or 0
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

    compliance_report = analyse_listing_compliance(
        listing_text,
        text_source=listing_text_source,
    )

    # Safety score
    safety = get_safety_score(sector, db)
    safety_score_val = safety.get("safety_score") if safety else None
    safety_label = safety.get("label") if safety else None

    # Average rent prediction
    avg_rent = None
    rent_rows = db.query(Property).filter(pc_filter).limit(20).all()
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

        hmo_total = db.query(func.count(HmoRecord.id)).filter(hmo_filter).scalar() or 0
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
        safety_score=safety_score_val,
        safety_label=safety_label,
        avg_predicted_rent_weekly=avg_rent,
        avg_predicted_rent_monthly=round(avg_rent * 52 / 12, 2) if avg_rent else None,
        properties_in_area=properties_count,
        nearby_properties=nearby,
        hmo_licensed_count=hmo_licensed,
        hmo_total_count=hmo_total,
        flood_risk_severity=flood_severity,
        compliance_report=compliance_report,
        message=f"Analysis for {display_area} based on {properties_count} properties in our database.",
    )
