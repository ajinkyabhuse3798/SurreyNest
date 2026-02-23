"""Geocoding service: cache-first postcode → lat/lng lookup via Postcodes.io.

Always checks the postcode_cache table before calling the external API.
If is_valid=False in cache, do not retry — postcode is terminated or invalid.
"""

import logging
import re
from datetime import datetime, timezone
from typing import Optional, Tuple

import requests
from sqlalchemy.orm import Session

from app.models.postcode_cache import PostcodeCache

logger = logging.getLogger(__name__)

# Postcodes.io API base URL
POSTCODES_API = "https://api.postcodes.io"


def _normalise_postcode(postcode: str) -> str:
    """Normalise postcode to uppercase with single space.

    Args:
        postcode: Raw postcode string.

    Returns:
        Normalised postcode, e.g. "GU2 7XH".
    """
    pc = str(postcode).strip().upper()
    pc = re.sub(r"\s+", "", pc)
    if len(pc) >= 4:
        return pc[:-3] + " " + pc[-3:]
    return pc


def get_lat_lng(
    postcode: str, db: Session
) -> Optional[Tuple[float, float]]:
    """Look up latitude/longitude for a postcode, using cache first.

    Args:
        postcode: UK postcode string (will be normalised).
        db: SQLAlchemy session.

    Returns:
        Tuple of (lat, lng), or None if postcode is invalid or lookup fails.
    """
    normalised = _normalise_postcode(postcode)

    # Check cache first
    cached = db.query(PostcodeCache).filter(
        PostcodeCache.postcode == normalised
    ).first()

    if cached is not None:
        if cached.is_valid:
            return (cached.lat, cached.lng)
        else:
            logger.debug("Postcode %s is cached as invalid", normalised)
            return None

    # Cache miss — call Postcodes.io
    logger.info("Geocoding postcode %s via Postcodes.io", normalised)
    try:
        resp = requests.get(
            f"{POSTCODES_API}/postcodes/{normalised}",
            timeout=10,
        )

        if resp.status_code == 200:
            data = resp.json().get("result", {})
            lat = data.get("latitude")
            lng = data.get("longitude")

            if lat is not None and lng is not None:
                cache_entry = PostcodeCache(
                    postcode=normalised,
                    lat=lat,
                    lng=lng,
                    ward=data.get("admin_ward"),
                    district=data.get("admin_district"),
                    is_valid=True,
                    cached_at=datetime.now(timezone.utc),
                )
                db.merge(cache_entry)
                db.commit()
                return (lat, lng)

        # Postcode not found — cache as invalid
        cache_entry = PostcodeCache(
            postcode=normalised,
            lat=0.0,
            lng=0.0,
            is_valid=False,
            cached_at=datetime.now(timezone.utc),
        )
        db.merge(cache_entry)
        db.commit()
        logger.info("Postcode %s not found, cached as invalid", normalised)
        return None

    except requests.RequestException as exc:
        logger.error("Postcodes.io API error for %s: %s", normalised, exc)
        return None
