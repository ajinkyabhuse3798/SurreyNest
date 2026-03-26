"""Property service: assemble full property detail with scores and reviews.

Handles search with PostGIS spatial queries and detail assembly from
multiple tables (properties, hmo_records, reviews, scores, predictions).
"""

import logging
import math
from typing import Dict, List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import func, text
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session

from app.models.crime_data import CrimeData
from app.models.flood_risk import FloodRisk
from app.models.hmo_record import HmoRecord
from app.models.property import Property
from app.models.review import Review
from app.services.geocoding_service import get_lat_lng
from app.services.score_service import get_rent_prediction, get_safety_score
from app.utils.postcode import extract_postcode_sector
from app.utils.safety_weights import CATEGORY_WEIGHTS, DEFAULT_WEIGHT

logger = logging.getLogger(__name__)

_POSTGIS_DISTANCE_SQL = """
    ST_Distance(
        ST_SetSRID(ST_Point(lng, lat), 4326)::geography,
        ST_SetSRID(ST_Point(:search_lng, :search_lat), 4326)::geography
    )
"""


def _run_spatial_search(
    *,
    postcode: str,
    lat: float,
    lng: float,
    radius_m: int,
    offset: int,
    per_page: int,
    db: Session,
) -> Tuple[int, List]:
    """Execute the radius search using PostGIS spatial functions."""
    distance_sql = _POSTGIS_DISTANCE_SQL

    count_sql = text(f"""
        SELECT COUNT(*)
        FROM properties
        WHERE lat IS NOT NULL AND lng IS NOT NULL
          AND ({distance_sql}) <= :radius_m
    """)

    search_sql = text(f"""
        SELECT uprn, address, postcode, property_type, floor_area_m2,
               num_rooms, energy_rating, tenure, lat, lng,
               ({distance_sql}) AS distance_m
        FROM properties
        WHERE lat IS NOT NULL AND lng IS NOT NULL
          AND ({distance_sql}) <= :radius_m
        ORDER BY
            CASE WHEN REPLACE(postcode, ' ', '') = REPLACE(:search_postcode, ' ', '') THEN 0 ELSE 1 END,
            CASE WHEN property_type ILIKE '%Flat%' OR address ILIKE '%FLAT%' OR address ILIKE '%APARTMENT%' THEN 1 ELSE 0 END,
            NULLIF(SUBSTRING(address FROM '[0-9]+'), '')::int NULLS LAST,
            distance_m
        OFFSET :offset LIMIT :per_page
    """)

    params = {
        "search_lat": lat,
        "search_lng": lng,
        "search_postcode": postcode,
        "radius_m": radius_m,
        "offset": offset,
        "per_page": per_page,
    }

    total = db.execute(count_sql, params).scalar() or 0
    rows = db.execute(search_sql, params).fetchall()
    return int(total), rows


def _batch_safety_scores(
    sectors: set[str], db: Session
) -> Dict[str, Optional[float]]:
    """Compute safety scores for multiple sectors in a single DB round-trip.

    Instead of calling get_safety_score() per sector (N queries for the
    normaliser + N queries for sector crimes), this fetches all crime data
    for the requested sectors in one query and computes scores in Python.
    """
    from app.services.score_service import _get_safety_normaliser

    rows = (
        db.query(
            CrimeData.postcode_sector,
            CrimeData.category,
            func.sum(CrimeData.count).label("total_count"),
        )
        .filter(CrimeData.postcode_sector.in_(sectors))
        .group_by(CrimeData.postcode_sector, CrimeData.category)
        .all()
    )

    sector_weighted: Dict[str, float] = {}
    for row in rows:
        w = CATEGORY_WEIGHTS.get(row.category, DEFAULT_WEIGHT)
        sector_weighted[row.postcode_sector] = (
            sector_weighted.get(row.postcode_sector, 0.0) + row.total_count * w
        )

    normaliser = _get_safety_normaliser(db)

    result: Dict[str, Optional[float]] = {}
    for sector in sectors:
        weighted_sum = sector_weighted.get(sector)
        if weighted_sum is None:
            result[sector] = None
        else:
            score = max(0.0, min(100.0, 100.0 - (weighted_sum / normaliser * 100.0)))
            result[sector] = round(score, 1)

    return result


def search_properties(
    postcode: str,
    radius_m: int,
    page: int,
    per_page: int,
    db: Session,
) -> Dict:
    """Search properties within a radius of a postcode using PostGIS.

    Args:
        postcode: Centre postcode for the search.
        radius_m: Search radius in metres.
        page: Page number (1-indexed).
        per_page: Number of results per page.
        db: SQLAlchemy session.

    Returns:
        Dict with results, total, page, per_page, pages.

    Raises:
        ValueError: If postcode cannot be geocoded.
    """
    coords = get_lat_lng(postcode, db)
    if coords is None:
        raise ValueError(f"Could not geocode postcode: {postcode}")

    lat, lng = coords
    offset = (page - 1) * per_page

    try:
        total, rows = _run_spatial_search(
            postcode=postcode,
            lat=lat,
            lng=lng,
            radius_m=radius_m,
            offset=offset,
            per_page=per_page,
            db=db,
        )
    except ProgrammingError as exc:
        db.rollback()
        logger.error(
            "Spatial search failed, PostGIS may be unavailable. "
            "Run: CREATE EXTENSION IF NOT EXISTS postgis; in PostgreSQL.",
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Spatial search is temporarily unavailable. Please try again later.",
        ) from exc

    # ── Batch HMO lookup (1 query for all rows) ───────────────────────────
    uprns = [row.uprn for row in rows]
    postcodes = [row.postcode for row in rows if row.postcode]
    hmo_records = db.query(HmoRecord).filter(
        (HmoRecord.uprn.in_(uprns)) | (HmoRecord.postcode.in_(postcodes))
    ).all()
    hmo_by_uprn = {r.uprn: r for r in hmo_records if r.uprn}
    hmo_by_postcode = {r.postcode: r for r in hmo_records if r.postcode}

    # ── Batch safety score lookups (single DB query for all sectors) ─────
    unique_sectors = {
        extract_postcode_sector(row.postcode)
        for row in rows if row.postcode
    }
    safety_by_sector: Dict[str, Optional[float]] = {}
    if unique_sectors:
        safety_by_sector = _batch_safety_scores(unique_sectors, db)

    results = []
    for row in rows:
        # Derive HMO status string
        rec = hmo_by_uprn.get(row.uprn) or hmo_by_postcode.get(row.postcode)
        hmo_status = "not_found" if not rec else ("licensed" if rec.is_active else "unlicensed")

        # Derive safety score from precomputed sector map
        sector = extract_postcode_sector(row.postcode) if row.postcode else ""
        safety_score = safety_by_sector.get(sector)

        results.append({
            "uprn": row.uprn,
            "address": row.address,
            "postcode": row.postcode,
            "property_type": row.property_type,
            "floor_area_m2": row.floor_area_m2,
            "num_rooms": row.num_rooms,
            "energy_rating": row.energy_rating,
            "lat": row.lat,
            "lng": row.lng,
            "distance_m": round(row.distance_m, 1) if row.distance_m else None,
            "safety_score": safety_score,
            "fairness_score": None,
            "hmo_status": hmo_status,
            "tenure": row.tenure,
        })

    pages = math.ceil(total / per_page) if total > 0 else 0

    return {
        "results": results,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": pages,
    }


def get_property_detail(uprn: str, db: Session) -> Optional[Dict]:
    """Assemble full property detail from multiple tables.

    Combines: property data + HMO status + average reviews + safety score
    + rent prediction.

    Args:
        uprn: Property UPRN.
        db: SQLAlchemy session.

    Returns:
        Dict with full property detail, or None if property not found.
    """
    prop = db.query(Property).filter(Property.uprn == uprn).first()
    if not prop:
        return None

    # ── HMO status ────────────────────────────────────────────────────────
    hmo_record = (
        db.query(HmoRecord)
        .filter(HmoRecord.uprn == uprn)
        .first()
    )
    # Also check by postcode if no UPRN match
    if not hmo_record and prop.postcode:
        hmo_record = (
            db.query(HmoRecord)
            .filter(HmoRecord.postcode == prop.postcode)
            .first()
        )

    hmo_data = {
        "is_hmo": hmo_record is not None,
        "is_active": hmo_record.is_active if hmo_record else None,
        "licence_number": hmo_record.licence_number if hmo_record else None,
        "max_occupants": hmo_record.max_occupants if hmo_record else None,
        "expiry_date": hmo_record.expiry_date if hmo_record else None,
    }

    # ── Review summary ────────────────────────────────────────────────────
    review_stats = (
        db.query(
            func.avg(Review.overall_rating).label("avg_overall"),
            func.avg(Review.landlord_rating).label("avg_landlord"),
            func.avg(Review.condition_rating).label("avg_condition"),
            func.avg(Review.value_rating).label("avg_value"),
            func.count(Review.id).label("review_count"),
        )
        .filter(Review.uprn == uprn)
        .filter(Review.is_moderated == True)  # noqa: E712
        .filter(Review.is_flagged == False)  # noqa: E712
        .first()
    )

    review_data = {
        "avg_overall": round(float(review_stats.avg_overall), 1) if review_stats.avg_overall else None,
        "avg_landlord": round(float(review_stats.avg_landlord), 1) if review_stats.avg_landlord else None,
        "avg_condition": round(float(review_stats.avg_condition), 1) if review_stats.avg_condition else None,
        "avg_value": round(float(review_stats.avg_value), 1) if review_stats.avg_value else None,
        "review_count": review_stats.review_count or 0,
    }

    # ── Safety score ──────────────────────────────────────────────────────
    postcode_sector = extract_postcode_sector(prop.postcode)
    safety_data = get_safety_score(postcode_sector, db)
    safety_score_val = safety_data["safety_score"]

    # ── Rent prediction ───────────────────────────────────────────────────
    rent_pred = get_rent_prediction(uprn, db)
    rent_pred_data = None
    if rent_pred:
        rent_pred_data = {
            "predicted_weekly_rent": rent_pred["predicted_weekly_rent"],
            "rent_low": rent_pred.get("rent_low"),
            "rent_high": rent_pred.get("rent_high"),
            "confidence": rent_pred.get("confidence"),
            "model_version": rent_pred["model_version"],
            "computed_at": rent_pred["computed_at"],
        }

    # ── Flood risk ────────────────────────────────────────────────────────
    flood_data = None
    try:
        flood_record = (
            db.query(FloodRisk)
            .filter(FloodRisk.postcode == prop.postcode)
            .filter(FloodRisk.area_code != "NONE")
            .order_by(FloodRisk.distance_km.asc().nullslast())
            .first()
        )
        if flood_record:
            flood_data = {
                "area_code": flood_record.area_code,
                "label": flood_record.label,
                "description": flood_record.description,
                "river_or_sea": flood_record.river_or_sea,
                "distance_km": flood_record.distance_km,
                "current_severity": flood_record.current_severity,
                "severity_label": flood_record.severity_label,
                "message": flood_record.message,
            }
    except Exception:
        # Table may not exist yet (migration not run), gracefully skip
        logger.debug("Flood risk query failed, table may not exist yet", exc_info=True)

    return {
        "uprn": prop.uprn,
        "address": prop.address,
        "postcode": prop.postcode,
        "property_type": prop.property_type,
        "built_form": prop.built_form,
        "floor_area_m2": prop.floor_area_m2,
        "num_rooms": prop.num_rooms,
        "energy_rating": prop.energy_rating,
        "potential_rating": prop.potential_rating,
        "epc_date": prop.epc_date,
        "lat": prop.lat,
        "lng": prop.lng,
        "tenure": prop.tenure,
        "hmo": hmo_data,
        "reviews": review_data,
        "safety_score": safety_score_val,
        "rent_prediction": rent_pred_data,
        "flood_risk": flood_data,
    }
