"""Business logic for the Rent Increase Challenger.

Analyses a proposed rent increase against ML predictions and market evidence.
Produces a verdict and optional tribunal brief for Renters' Rights Act 2025
Section 13 challenges.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.area_value import AreaValue
from app.models.property import Property
from app.models.rent_history import RentHistory
from app.schemas.rent_challenge import (
    ComparableProperty,
    RentChallengeRequest,
    RentChallengeResponse,
)

logger = logging.getLogger(__name__)


def _extract_sector(postcode: str) -> str:
    """Extract postcode sector from a full postcode.

    Args:
        postcode: Full UK postcode (e.g. "GU2 7XH").

    Returns:
        Postcode sector (e.g. "GU2 7").
    """
    parts = postcode.strip().upper().split()
    if len(parts) == 2 and len(parts[1]) >= 1:
        return f"{parts[0]} {parts[1][0]}"
    return postcode.strip().upper()


def _normalise_postcode(postcode: str) -> str:
    """Normalise a full postcode to uppercase stripped."""
    return postcode.strip().upper()


def _compute_verdict(
    market_excess_pct: float,
) -> tuple[str, str, str]:
    """Map market excess percentage to verdict and challenge strength.

    Args:
        market_excess_pct: Percentage above ML-predicted market rent (>=0).

    Returns:
        Tuple of (verdict, verdict_detail, challenge_strength).
    """
    if market_excess_pct <= 2:
        return (
            "FAIR",
            "Proposed rent is at or below fair market rate.",
            "NOT_RECOMMENDED",
        )
    elif market_excess_pct <= 8:
        return (
            "BORDERLINE",
            "Close to market rate — a challenge may not succeed.",
            "WEAK",
        )
    elif market_excess_pct <= 20:
        return (
            "ABOVE_MARKET",
            "The proposed rent exceeds the estimated market rate.",
            "MODERATE",
        )
    else:
        return (
            "SIGNIFICANTLY_ABOVE_MARKET",
            "Substantially above market rate — strong grounds to challenge.",
            "STRONG",
        )


def _get_sector_comparables(
    postcode_sector: str,
    bedrooms: Optional[int],
    db: Session,
) -> list[ComparableProperty]:
    """Get comparable properties from area_values for the sector.

    Args:
        postcode_sector: Postcode sector (e.g. "GU2 7").
        bedrooms: Optional bedroom count filter.
        db: Database session.

    Returns:
        List of up to 10 ComparableProperty objects.
    """
    # Match ONLY this exact sector (e.g. "GU2 7%") — not the full outward code.
    # "GU2 %" would still show GU2 4, GU2 8, GU2 9 which are different markets.
    query = db.query(AreaValue).filter(
        AreaValue.postcode.like(f"{postcode_sector}%")
    ).filter(
        AreaValue.implied_weekly_rent > 50
    )

    rows = query.order_by(AreaValue.implied_weekly_rent.asc()).limit(30).all()

    comparables = []
    for row in rows:
        # Try to get bedrooms from properties table
        prop = db.query(Property).filter(Property.postcode == row.postcode).first()
        prop_beds = prop.num_rooms if prop else None

        # Filter by bedroom range if specified
        if bedrooms is not None and prop_beds is not None:
            if abs(prop_beds - bedrooms) > 1:
                continue

        comparables.append(
            ComparableProperty(
                postcode=row.postcode,
                implied_weekly_rent=round(float(row.implied_weekly_rent), 2),
                source="Estimated from local sales (3.5% yield)",
                bedrooms=prop_beds,
                distance_label="Same sector",
            )
        )

        if len(comparables) >= 10:
            break

    return comparables


def _generate_tribunal_brief(
    postcode: str,
    current_rent: float,
    proposed_rent: float,
    ml_predicted: float,
    comparables: list[ComparableProperty],
) -> str:
    """Generate a plain-text tribunal brief for a Section 13 challenge.

    Args:
        postcode: Property postcode.
        current_rent: Current weekly rent in £.
        proposed_rent: Proposed weekly rent in £.
        ml_predicted: ML-predicted market weekly rent in £.
        comparables: List of comparable properties.

    Returns:
        Formatted plain text brief.
    """
    increase_pct = round((proposed_rent - current_rent) / current_rent * 100, 1)
    excess_pct = round((proposed_rent - ml_predicted) / ml_predicted * 100, 1) if ml_predicted > 0 else 0

    top_3 = comparables[:3]
    comp_lines = "\n".join(
        f"  • {c.postcode}: £{c.implied_weekly_rent}/week (Source: {c.source})"
        for c in top_3
    )

    brief = f"""APPLICATION TO FIRST-TIER TRIBUNAL (PROPERTY CHAMBER)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SECTION 13 RENT INCREASE CHALLENGE
Reference: Renters' Rights Act 2025

PROPERTY INFORMATION
Property postcode: {postcode}

RENT FIGURES
Current weekly rent:  £{current_rent:.2f}
Proposed weekly rent: £{proposed_rent:.2f}
Proposed increase:    £{proposed_rent - current_rent:.2f}/week ({increase_pct}%)

MARKET EVIDENCE
ML-predicted fair market rent: £{ml_predicted:.2f}/week
Excess above market estimate:  {excess_pct:.1f}%

COMPARABLE PROPERTIES IN THE AREA
{comp_lines if comp_lines else "  No comparables available for this sector."}

GROUNDS FOR CHALLENGE
The proposed rent increase of {increase_pct}% results in a weekly rent that is
approximately {excess_pct:.1f}% above the estimated market rate for comparable
properties in this postcode sector. Under the Renters' Rights Act 2025, a
landlord may only increase rent to the market rate. Where the proposed rent
exceeds market value, a tenant has the right to challenge via this Tribunal.

NEXT STEPS
• Submit this application within 6 weeks of receiving the Section 13 notice.
• Attach your Section 13 notice as supporting evidence.
• The Tribunal will assess the market rent and may reduce the proposed increase.
• For free advice: Citizens Advice (0800 144 8848) or Shelter (0808 800 4444).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Generated by SurreyNest · This is not legal advice.
"""
    return brief


def analyse_rent_increase(
    request: RentChallengeRequest,
    db: Session,
) -> RentChallengeResponse:
    """Analyse a proposed rent increase and return a verdict with evidence.

    Args:
        request: RentChallengeRequest with rent figures and location.
        db: Database session.

    Returns:
        RentChallengeResponse with verdict, comparables, and tribunal brief.

    Raises:
        ValueError: If postcode cannot be resolved.
        RuntimeError: If ML prediction is unavailable.
    """
    # Step 1: Resolve postcode
    postcode = None
    if request.uprn:
        prop = db.query(Property).filter(Property.uprn == request.uprn).first()
        if prop and prop.postcode:
            postcode = _normalise_postcode(prop.postcode)
    if not postcode and request.postcode:
        postcode = _normalise_postcode(request.postcode)
    if not postcode:
        raise ValueError("Could not resolve postcode from UPRN or provided postcode.")

    postcode_sector = _extract_sector(postcode)

    # Step 2: Get ML prediction
    ml_predicted: Optional[float] = None

    if request.uprn:
        try:
            from app.services.score_service import get_rent_prediction
            result = get_rent_prediction(
                uprn=request.uprn,
                db=db,
                bedrooms_override=request.bedrooms,
            )
            ml_predicted = result.get("predicted_weekly_rent")
        except Exception as e:
            logger.warning("ML prediction via UPRN failed: %s", e)

    if ml_predicted is None:
        # Postcode-only path: use predict_rent with minimal features
        try:
            from app.ml.predict import predict_rent
            from app.services.score_service import get_safety_score

            features: dict = {
                "floor_area_m2": 70.0,
                "actual_bedrooms": float(request.bedrooms) if request.bedrooms else 3.0,
                "rooms_per_m2": 0.04,
                "energy_rating_ordinal": 3.0,
                "potential_rating_ordinal": 4.0,
                "distance_to_town_km": 2.0,
                "distance_to_uni_km": 1.5,
                "distance_to_station_km": 1.0,
                "town_proximity_score": 0.5,
                "uni_proximity_score": 0.5,
                "safety_score": 60.0,
                "area_value_index": 0.5,
                "sale_count": 5,
                "sector_median_rent": 200.0,
                "age_band_ordinal": 5,
                "has_mains_gas": 1,
                "floor_level_ordinal": 0,
                "annual_energy_cost": 1500.0,
                "energy_improvement_gap": 1,
                "price_drop_pct": 0.0,
                "ptype_Flat": 0,
                "ptype_Detached": 0,
                "ptype_Semi-Detached": 0,
                "ptype_Terraced": 1,
                "ptype_Unknown": 0,
            }

            # Improve with safety score if available
            try:
                safety = get_safety_score(postcode_sector, db)
                if safety:
                    features["safety_score"] = float(safety.get("safety_score", 60.0))
            except Exception:
                pass

            # Improve with area value
            area_val = (
                db.query(AreaValue)
                .filter(AreaValue.postcode.like(f"{postcode_sector.split()[0]}%"))
                .first()
            )
            if area_val:
                features["area_value_index"] = float(area_val.area_value_index)
                features["sector_median_rent"] = float(area_val.implied_weekly_rent)

            result = predict_rent(features)
            ml_predicted = result.get("predicted_weekly_rent")
        except Exception as e:
            logger.warning("ML prediction via postcode failed: %s", e)

    if ml_predicted is None:
        raise RuntimeError("ML prediction unavailable — please try again later.")

    # Step 3: Get sector median from rent_history
    sector_median: Optional[float] = None
    try:
        latest_year = (
            db.query(func.max(RentHistory.year))
            .filter(RentHistory.postcode_sector == postcode_sector)
            .scalar()
        )
        if latest_year:
            history = (
                db.query(RentHistory)
                .filter(RentHistory.postcode_sector == postcode_sector)
                .filter(RentHistory.year == latest_year)
                .first()
            )
            if history and history.implied_weekly_rent:
                sector_median = float(history.implied_weekly_rent)
    except Exception as e:
        logger.warning("Could not fetch sector median: %s", e)

    # Fallback: aggregate area_values
    if sector_median is None:
        try:
            agg = (
                db.query(func.avg(AreaValue.implied_weekly_rent))
                .filter(AreaValue.postcode.like(f"{postcode_sector}%"))
                .filter(AreaValue.implied_weekly_rent > 50)
                .scalar()
            )
            if agg:
                sector_median = round(float(agg), 2)
        except Exception as e:
            logger.warning("Could not aggregate sector median: %s", e)

    # Step 4: Get comparables
    comparables = _get_sector_comparables(postcode_sector, request.bedrooms, db)

    # Step 5: Compute verdict
    market_excess_pct = max(
        0.0,
        (request.proposed_weekly_rent - ml_predicted) / ml_predicted * 100,
    )
    verdict, verdict_detail, challenge_strength = _compute_verdict(market_excess_pct)

    # Step 6: Generate tribunal brief
    tribunal_brief = _generate_tribunal_brief(
        postcode=postcode,
        current_rent=request.current_weekly_rent,
        proposed_rent=request.proposed_weekly_rent,
        ml_predicted=ml_predicted,
        comparables=comparables,
    )

    increase_amount = round(request.proposed_weekly_rent - request.current_weekly_rent, 2)
    increase_pct = round(
        (request.proposed_weekly_rent - request.current_weekly_rent)
        / request.current_weekly_rent
        * 100,
        1,
    )

    return RentChallengeResponse(
        ml_predicted_rent=round(ml_predicted, 2),
        sector_median_rent=sector_median,
        current_weekly_rent=request.current_weekly_rent,
        proposed_weekly_rent=request.proposed_weekly_rent,
        increase_amount=increase_amount,
        increase_pct=increase_pct,
        comparables=comparables,
        is_above_market=market_excess_pct > 2,
        market_excess_pct=round(market_excess_pct, 1),
        verdict=verdict,
        verdict_detail=verdict_detail,
        challenge_strength=challenge_strength,
        tribunal_brief=tribunal_brief,
        postcode=postcode,
        postcode_sector=postcode_sector,
        analysed_at=datetime.now(timezone.utc),
    )
