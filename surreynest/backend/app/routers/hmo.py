"""HMO routes: GET /hmo/check.

Thin route layer — queries HMO register for a property by UPRN.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.hmo_record import HmoRecord
from app.models.property import Property

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "/hmo/check",
    summary="Check HMO status for a property",
)
async def check_hmo_status(
    uprn: str = Query(..., description="Property UPRN to check"),
    db: Session = Depends(get_db),
) -> dict:
    """Check if a property is on the HMO register.

    Looks up by UPRN first, then falls back to postcode match.

    Returns:
        Dict with is_hmo flag and licence details if applicable.
    """
    # Verify property exists
    prop = db.query(Property).filter(Property.uprn == uprn).first()
    if not prop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Property with UPRN {uprn} not found",
        )

    # Check HMO by UPRN
    hmo = db.query(HmoRecord).filter(HmoRecord.uprn == uprn).first()

    # Fallback: check by postcode
    if not hmo and prop.postcode:
        hmo = (
            db.query(HmoRecord)
            .filter(HmoRecord.postcode == prop.postcode)
            .first()
        )

    if not hmo:
        return {
            "uprn": uprn,
            "is_hmo": False,
            "message": "This property is not on the Guildford HMO register",
        }

    return {
        "uprn": uprn,
        "is_hmo": True,
        "is_active": hmo.is_active,
        "licence_number": hmo.licence_number,
        "max_occupants": hmo.max_occupants,
        "licence_holder": hmo.licence_holder,
        "expiry_date": str(hmo.expiry_date) if hmo.expiry_date else None,
        "message": (
            "Active HMO licence found" if hmo.is_active
            else "HMO licence found but has expired"
        ),
    }
