"""Geocoding service: cache-first postcode → lat/lng lookup via Postcodes.io.

Always checks the postcode_cache table before calling the external API.
If is_valid=False in cache, do not retry, postcode is terminated or invalid.
Provides both single-lookup (get_lat_lng) and batch (geocode_batch) functions.
"""

import logging
import re
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

import requests
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.data_pipelines.utils import RateLimiter, api_call_with_retry
from app.models.postcode_cache import PostcodeCache

logger = logging.getLogger(__name__)

# Postcodes.io API base URL
POSTCODES_API = "https://api.postcodes.io"
POSTCODES_BATCH_URL = f"{POSTCODES_API}/postcodes"
POSTCODES_BATCH_SIZE = 100


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

    # Cache miss, call Postcodes.io
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

        # Postcode not found, cache as invalid
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


def geocode_batch(
    postcodes: List[str],
    db: Session,
) -> Dict[str, Tuple[Optional[float], Optional[float]]]:
    """Geocode postcodes via Postcodes.io batch API with DB cache.

    Cache-first: checks postcode_cache for each postcode before calling
    the external API. Calls Postcodes.io batch endpoint in groups of 100.
    Caches all results (valid and invalid) to avoid repeat lookups.

    Args:
        postcodes: List of postcodes to geocode (will be normalised).
        db: SQLAlchemy session for cache reads/writes.

    Returns:
        Dict mapping normalised postcode → (lat, lng).
        Invalid postcodes map to (None, None).
    """
    results: Dict[str, Tuple[Optional[float], Optional[float]]] = {}
    uncached: List[str] = []

    # Normalise all postcodes first
    normalised = [_normalise_postcode(pc) for pc in postcodes]
    # Deduplicate while preserving order
    seen = set()
    unique = []
    for pc in normalised:
        if pc not in seen:
            seen.add(pc)
            unique.append(pc)

    # ── Check cache first (per conventions.md: always check cache) ────────
    for pc in unique:
        cached = (
            db.query(PostcodeCache)
            .filter(PostcodeCache.postcode == pc)
            .first()
        )
        if cached:
            if cached.is_valid:
                results[pc] = (cached.lat, cached.lng)
            else:
                results[pc] = (None, None)
        else:
            uncached.append(pc)

    if not uncached:
        logger.info("All %d postcodes found in cache", len(unique))
        return results

    logger.info(
        "Geocoding %d uncached postcodes via Postcodes.io (of %d total)",
        len(uncached),
        len(unique),
    )
    rate_limiter = RateLimiter(requests_per_second=3.0)

    # ── Batch API calls ──────────────────────────────────────────────────
    for i in range(0, len(uncached), POSTCODES_BATCH_SIZE):
        batch = uncached[i : i + POSTCODES_BATCH_SIZE]
        rate_limiter.wait()

        try:
            response = api_call_with_retry(
                POSTCODES_BATCH_URL,
                method="POST",
                json_body={"postcodes": batch},
            )
        except Exception:
            logger.error(
                "Batch geocode failed for batch starting at index %d", i
            )
            for pc in batch:
                results[pc] = (None, None)
            continue

        for item in response.get("result", []):
            query_pc = item.get("query", "")
            normalised_pc = _normalise_postcode(query_pc)
            result_data = item.get("result")

            if result_data:
                lat = result_data.get("latitude")
                lng = result_data.get("longitude")
                ward = result_data.get("admin_ward", "")
                district = result_data.get("admin_district", "")
                results[normalised_pc] = (lat, lng)

                # Cache the valid result
                cache_stmt = insert(PostcodeCache).values(
                    postcode=normalised_pc,
                    lat=lat or 0.0,
                    lng=lng or 0.0,
                    ward=ward,
                    district=district,
                    is_valid=True,
                    cached_at=datetime.now(timezone.utc),
                )
                cache_stmt = cache_stmt.on_conflict_do_update(
                    index_elements=["postcode"],
                    set_={
                        "lat": cache_stmt.excluded.lat,
                        "lng": cache_stmt.excluded.lng,
                        "ward": cache_stmt.excluded.ward,
                        "district": cache_stmt.excluded.district,
                        "cached_at": datetime.now(timezone.utc),
                    },
                )
                db.execute(cache_stmt)
            else:
                results[normalised_pc] = (None, None)
                # Cache as invalid so we don't retry
                cache_stmt = insert(PostcodeCache).values(
                    postcode=normalised_pc,
                    lat=0.0,
                    lng=0.0,
                    is_valid=False,
                    cached_at=datetime.now(timezone.utc),
                )
                cache_stmt = cache_stmt.on_conflict_do_nothing()
                db.execute(cache_stmt)

        db.commit()

    geocoded_count = sum(
        1 for v in results.values() if v[0] is not None
    )
    logger.info(
        "Geocoding complete: %d/%d postcodes resolved",
        geocoded_count,
        len(unique),
    )
    return results

