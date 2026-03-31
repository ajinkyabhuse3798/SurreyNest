"""Business logic for the Rent Increase Challenger.

Analyses a proposed rent increase against ML predictions and market evidence.
Produces a verdict and optional tribunal brief for Renters' Rights Act 2025
Section 13 challenges.
"""

import calendar
import logging
from datetime import date, datetime, timezone
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

_RRA_PHASE_1_START = date(2026, 5, 1)


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


def _add_months(value: date, months: int) -> date:
    """Return a date shifted by a whole number of calendar months."""
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    day = min(value.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def _add_year(value: date) -> date:
    """Return the same calendar date one year later."""
    try:
        return value.replace(year=value.year + 1)
    except ValueError:
        return value.replace(year=value.year + 1, month=2, day=28)


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
            "Close to market rate, a challenge may not succeed.",
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
            "Substantially above market rate, strong grounds to challenge.",
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
    # Match ONLY this exact sector (e.g. "GU2 7%"), not the full outward code.
    # "GU2 %" would still show GU2 4, GU2 8, GU2 9 which are different markets.
    query = (
        db.query(AreaValue)
        .filter(AreaValue.postcode.like(f"{postcode_sector}%"))
        .filter(AreaValue.implied_weekly_rent > 50)
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
    legal_summary: str,
    apply_before_date: Optional[date],
    minimum_notice_detail: Optional[str],
    annual_limit_detail: Optional[str],
) -> str:
    """Generate a plain-text tribunal brief for a Section 13 challenge.

    Args:
        postcode: Property postcode.
        current_rent: Current weekly rent in £.
        proposed_rent: Proposed weekly rent in £.
        ml_predicted: ML-predicted market weekly rent in £.
        comparables: List of comparable properties.
        legal_summary: Human-readable timing summary for the current ruleset.
        apply_before_date: Date the tenant should apply before, if known.
        minimum_notice_detail: Result of the 2-month notice check.
        annual_limit_detail: Result of the once-per-year check.

    Returns:
        Formatted plain text brief.
    """
    increase_pct = round((proposed_rent - current_rent) / current_rent * 100, 1)
    excess_pct = (
        round((proposed_rent - ml_predicted) / ml_predicted * 100, 1)
        if ml_predicted > 0
        else 0
    )

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
properties in this postcode sector.

RULES CHECK
{legal_summary}
{minimum_notice_detail or "Notice timing check: add the dates from the notice if you want this checked."}
{annual_limit_detail or "Annual limit check: add the date of the last increase if you want this checked."}

NEXT STEPS
• Apply before the new rent start date shown on the notice{f" ({apply_before_date.isoformat()})" if apply_before_date else ""}.
• Attach your Section 13 notice as supporting evidence.
• Under the Phase 1 Renters' Rights Act rules, the Tribunal decides the open-market rent but cannot set a figure above the landlord's proposed rent.
• If paying the new rent from the notice date would cause hardship, ask the Tribunal to defer the start date by up to 2 months.
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
        raise RuntimeError("ML prediction unavailable, please try again later.")

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

    today = datetime.now(timezone.utc).date()
    minimum_notice_ok: Optional[bool] = None
    minimum_notice_detail: Optional[str] = None
    annual_limit_ok: Optional[bool] = None
    annual_limit_detail: Optional[str] = None
    apply_before_date = request.proposed_effective_date

    if request.notice_served_on and request.proposed_effective_date:
        minimum_notice_ok = request.proposed_effective_date >= _add_months(
            request.notice_served_on, 2
        )
        minimum_notice_detail = (
            "2-month notice check: passes the minimum notice window."
            if minimum_notice_ok
            else "2-month notice check: this looks short of the minimum 2 calendar months."
        )

    if request.last_increase_effective_date and request.proposed_effective_date:
        annual_limit_ok = request.proposed_effective_date >= _add_year(
            request.last_increase_effective_date
        )
        annual_limit_detail = (
            "Annual limit check: the proposed increase is at least a year after the last increase."
            if annual_limit_ok
            else "Annual limit check: this looks sooner than the once-per-year limit."
        )

    if (
        request.proposed_effective_date
        and request.proposed_effective_date < _RRA_PHASE_1_START
    ):
        legal_summary = (
            "This notice appears to take effect before 1 May 2026. SurreyNest can still compare "
            "the proposed rent with local market evidence, but the Phase 1 Renters' Rights Act "
            "section 13 rules were not yet in force on that date."
        )
    elif today < _RRA_PHASE_1_START:
        legal_summary = (
            "This checker is aligned to the Phase 1 Renters' Rights Act rules for England that "
            "start on 1 May 2026: section 13/Form 4A, at least 2 months' notice, and usually "
            "no more than one increase a year."
        )
    else:
        legal_summary = (
            "This checker is aligned to the Phase 1 Renters' Rights Act rules for England: rent "
            "increases should use section 13/Form 4A, give at least 2 months' notice, and usually "
            "happen no more than once a year."
        )

    # Step 6: Generate tribunal brief
    tribunal_brief = _generate_tribunal_brief(
        postcode=postcode,
        current_rent=request.current_weekly_rent,
        proposed_rent=request.proposed_weekly_rent,
        ml_predicted=ml_predicted,
        comparables=comparables,
        legal_summary=legal_summary,
        apply_before_date=apply_before_date,
        minimum_notice_detail=minimum_notice_detail,
        annual_limit_detail=annual_limit_detail,
    )

    increase_amount = round(
        request.proposed_weekly_rent - request.current_weekly_rent, 2
    )
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
        rules_effective_from=_RRA_PHASE_1_START,
        legal_summary=legal_summary,
        apply_before_date=apply_before_date,
        minimum_notice_ok=minimum_notice_ok,
        minimum_notice_detail=minimum_notice_detail,
        annual_limit_ok=annual_limit_ok,
        annual_limit_detail=annual_limit_detail,
        analysed_at=datetime.now(timezone.utc),
    )
