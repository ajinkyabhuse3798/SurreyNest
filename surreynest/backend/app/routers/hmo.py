"""HMO routes: GET /hmo/check.

Thin route layer — queries HMO register for a property by UPRN or postcode.
Returns status as "licensed", "expired", or "not_found".
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.hmo_record import HmoRecord
from app.models.property import Property
from app.rate_limit import limiter

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "/hmo/check",
    summary="Check HMO status for a property",
)
@limiter.limit("60/minute")
async def check_hmo_status(
    request: Request,
    uprn: Optional[str] = Query(None, description="Property UPRN to check"),
    postcode: Optional[str] = Query(None, description="Postcode to check"),
    db: Session = Depends(get_db),
) -> dict:
    """Check if a property or postcode is on the HMO register.

    Accepts either UPRN or postcode (at least one required).
    When UPRN is provided, verifies the property exists first.
    When postcode is provided, searches HMO records directly.

    Returns:
        Dict with status ("licensed", "expired", "not_found") and record details.
    """
    if not uprn and not postcode:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide either uprn or postcode query parameter",
        )

    hmo: Optional[HmoRecord] = None

    if uprn:
        # ── UPRN-based lookup ─────────────────────────────────────────────
        prop = db.query(Property).filter(Property.uprn == uprn).first()
        if not prop:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Property with UPRN {uprn} not found",
            )

        # Check HMO by UPRN first
        hmo = db.query(HmoRecord).filter(HmoRecord.uprn == uprn).first()

        # Fallback: check by property's postcode
        if not hmo and prop.postcode:
            hmo = (
                db.query(HmoRecord)
                .filter(HmoRecord.postcode == prop.postcode)
                .first()
            )
    else:
        # ── Postcode-based lookup ─────────────────────────────────────────
        normalised = postcode.strip().upper()
        hmo = (
            db.query(HmoRecord)
            .filter(HmoRecord.postcode == normalised)
            .first()
        )

    # ── Build response ────────────────────────────────────────────────────
    if not hmo:
        return {
            "status": "not_found",
            "record": None,
        }

    record = {
        "id": hmo.id,
        "uprn": hmo.uprn,
        "raw_address": hmo.raw_address,
        "postcode": hmo.postcode,
        "licence_number": hmo.licence_number,
        "max_occupants": hmo.max_occupants,
        "expiry_date": str(hmo.expiry_date) if hmo.expiry_date else None,
        "is_active": hmo.is_active,
    }

    return {
        "status": "licensed" if hmo.is_active else "expired",
        "record": record,
    }
