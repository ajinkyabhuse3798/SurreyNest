"""Safety intelligence service: advanced crime analytics for student housing.

Provides comprehensive safety analysis beyond basic safety scores:
- Crime breakdown by category with percentages
- Crime trend analysis (improving/stable/worsening)
- Cross-area rankings (safest/hotspot)
- Guildford average comparison
- Holiday burglary risk (student-specific)
- Student vulnerability index
"""

import logging
from datetime import date
from typing import Dict, List, Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.crime_data import CrimeData
from app.services import score_service
from app.utils.safety_weights import CATEGORY_WEIGHTS

logger = logging.getLogger(__name__)

# Student-specific weights (burglary/theft much more relevant)
STUDENT_WEIGHTS = {
    "burglary": 4.0,  # Empty student houses during holidays
    "theft-from-the-person": 3.0,  # Walking home from nights out
    "violent-crime": 3.0,  # Same as general
    "robbery": 2.5,  # Same
    "bicycle-theft": 3.0,  # Students cycle to campus — highly relevant
    "anti-social-behaviour": 1.0,  # Students ARE the noise source
    "public-order": 1.0,  # Less relevant
    "vehicle-crime": 0.5,  # Most students don't drive
    "drugs": 0.5,  # Less relevant to housing decision
}

# Friendly display names
CATEGORY_LABELS = {
    "violent-crime": "Violent Crime",
    "robbery": "Robbery",
    "anti-social-behaviour": "Anti-Social Behaviour",
    "burglary": "Burglary",
    "drugs": "Drugs",
    "public-order": "Public Order",
    "vehicle-crime": "Vehicle Crime",
    "theft-from-the-person": "Theft from Person",
    "bicycle-theft": "Bicycle Theft",
}

# University of Surrey approximate term dates (typical academic year)
HOLIDAY_MONTHS = {6, 7, 8, 9, 12, 1}  # Jun-Sep (summer), Dec-Jan (Christmas)
TERM_MONTHS = {2, 3, 4, 5, 10, 11}  # Feb-May, Oct-Nov
GUILDFORD_DISTRICTS = ("GU1", "GU2", "GU3", "GU4", "GU5", "GU7")
TRACKED_CATEGORIES = tuple(CATEGORY_WEIGHTS.keys())
SECTOR_RADIUS_M = 500
POLICE_STREET_CRIME_METHOD = "crimes-street/all-crime"


def _month_start(value: date) -> date:
    """Normalise any date to the first day of its month."""
    return value.replace(day=1)


def _shift_month(value: date, offset: int) -> date:
    """Move a month forward/backward without third-party date helpers."""
    zero_based = (value.year * 12) + (value.month - 1) + offset
    year, month_index = divmod(zero_based, 12)
    return date(year, month_index + 1, 1)


def _build_monthly_window(monthly_rows: List, max_months: int = 12) -> List[Dict]:
    """Return a continuous month-by-month series, filling any missing months.

    The trend chart should reflect the latest continuous window rather than
    only the months that happened to have rows in the database.
    """
    if not monthly_rows:
        return []

    monthly_totals = {_month_start(row.month): int(row.total) for row in monthly_rows}
    first_month = min(monthly_totals)
    last_month = max(monthly_totals)
    window_start = max(first_month, _shift_month(last_month, -(max_months - 1)))

    series = []
    cursor = window_start
    while cursor <= last_month:
        series.append(
            {
                "month": cursor,
                "count": monthly_totals.get(cursor, 0),
            }
        )
        cursor = _shift_month(cursor, 1)

    return series


def _guildford_sector_filter():
    """Return a SQLAlchemy filter for SurreyNest's Guildford coverage."""
    return or_(
        *[
            CrimeData.postcode_sector.like(f"{district} %")
            for district in GUILDFORD_DISTRICTS
        ]
    )


def _format_month_label(value: Optional[date]) -> Optional[str]:
    """Return a friendly month label like 'January 2026'."""
    if not value:
        return None
    return value.strftime("%B %Y")


def _build_breakdown(rows: List) -> List[Dict]:
    """Convert grouped category rows into frontend-ready breakdown objects."""
    if not rows:
        return []

    total_crimes = sum(r.total for r in rows)
    breakdown = []
    for row in rows:
        pct = round(row.total / total_crimes * 100, 1) if total_crimes > 0 else 0
        breakdown.append(
            {
                "category": row.category,
                "label": CATEGORY_LABELS.get(
                    row.category, row.category.replace("-", " ").title()
                ),
                "count": int(row.total),
                "percentage": pct,
                "weight": CATEGORY_WEIGHTS.get(row.category, 0.5),
            }
        )

    return breakdown


def _build_trend_response(series: List[Dict]) -> Dict:
    """Build a stable trend payload from a continuous month-by-month series."""
    if not series or len(series) < 2:
        return {
            "direction": "stable",
            "change_percent": 0,
            "label": "Not enough data",
            "monthly_data": [],
        }

    comparison_months = min(6, len(series) // 2)
    if comparison_months < 1:
        return {
            "direction": "stable",
            "change_percent": 0,
            "label": "Not enough data",
            "monthly_data": [
                {"month": point["month"].isoformat(), "count": point["count"]}
                for point in series
            ],
        }

    monthly_data = [
        {"month": point["month"].isoformat(), "count": point["count"]}
        for point in series
    ]
    earlier_months = series[-(comparison_months * 2) : -comparison_months]
    recent_months = series[-comparison_months:]

    recent_avg = sum(m["count"] for m in recent_months) / comparison_months
    earlier_avg = sum(m["count"] for m in earlier_months) / comparison_months

    if earlier_avg == 0:
        change_pct = 0
    else:
        change_pct = round((recent_avg - earlier_avg) / earlier_avg * 100, 1)

    if change_pct < -10:
        direction = "improving"
        label = f"Crime down {abs(change_pct):.0f}%, Getting safer"
    elif change_pct > 10:
        direction = "worsening"
        label = f"Crime up {change_pct:.0f}%, Getting worse"
    else:
        direction = "stable"
        label = "Crime levels stable"

    return {
        "direction": direction,
        "change_percent": change_pct,
        "label": label,
        "monthly_data": monthly_data,
    }


def _latest_month_for_query(query) -> Optional[date]:
    """Return the latest crime month for an existing SQLAlchemy query."""
    return query.with_entities(func.max(CrimeData.month)).scalar()


def get_methodology_summary(latest_month: Optional[date]) -> Dict:
    """Describe how SurreyNest turns police.uk data into safety metrics."""
    tracked_category_count = len(TRACKED_CATEGORIES)

    return {
        "source": "data.police.uk",
        "police_api_method": POLICE_STREET_CRIME_METHOD,
        "latest_month": latest_month.isoformat() if latest_month else None,
        "latest_month_label": _format_month_label(latest_month),
        "tracked_categories": list(TRACKED_CATEGORIES),
        "tracked_category_count": tracked_category_count,
        "sector_radius_m": SECTOR_RADIUS_M,
        "uses_representative_point": True,
        "summary": (
            "SurreyNest queries police.uk street crime around one representative point "
            f"per postcode sector, keeps {tracked_category_count} safety-relevant crime "
            "categories, and "
            "counts incidents within roughly 500 metres of that point."
        ),
        "why_counts_look_lower": (
            "Police.uk point queries return a wider surrounding area and many more crime "
            f"categories than SurreyNest uses. After SurreyNest filters to {tracked_category_count} "
            "tracked categories and a roughly 500m local radius, the totals are usually lower than raw "
            "police.uk totals."
        ),
        "not_official_total": (
            "These figures are designed for comparing nearby Guildford areas inside "
            "SurreyNest. They are not official full-borough or exact postcode-boundary totals."
        ),
    }


def get_crime_breakdown(postcode_sector: str, db: Session) -> List[Dict]:
    """Get crime breakdown by category for a postcode sector.

    Returns:
        List of dicts with category, label, count, percentage, weight.
    """
    rows = (
        db.query(
            CrimeData.category,
            func.sum(CrimeData.count).label("total"),
        )
        .filter(CrimeData.postcode_sector == postcode_sector)
        .group_by(CrimeData.category)
        .order_by(func.sum(CrimeData.count).desc())
        .all()
    )

    return _build_breakdown(rows)


def get_crime_trend(postcode_sector: str, db: Session) -> Dict:
    """Analyse crime trend over time for a postcode sector.

    Compares the most recent up-to-6 months vs the previous matching window,
    using a continuous latest-12-month series so missing months show as zero.

    Returns:
        Dict with trend direction, percentage change, and monthly data.
    """
    # Get monthly totals
    monthly = (
        db.query(
            CrimeData.month,
            func.sum(CrimeData.count).label("total"),
        )
        .filter(CrimeData.postcode_sector == postcode_sector)
        .group_by(CrimeData.month)
        .order_by(CrimeData.month)
        .all()
    )

    series = _build_monthly_window(monthly, max_months=12)
    return _build_trend_response(series)


_RANKINGS_CACHE_TTL = 1800  # 30 minutes


def get_area_rankings(db: Session) -> Dict:
    """Get safest and hotspot area rankings across all Guildford sectors.

    Cached in Redis for 30 minutes (data only changes monthly).

    Returns:
        Dict with safest (top 5) and hotspot (top 5) areas.
    """
    from app.cache import get_json, set_json

    cache_key = "safety:rankings"
    cached = get_json(cache_key)
    if cached is not None:
        return cached

    # Get total crimes per sector
    sector_totals = (
        db.query(
            CrimeData.postcode_sector,
            func.sum(CrimeData.count).label("total"),
        )
        .filter(_guildford_sector_filter())
        .group_by(CrimeData.postcode_sector)
        .all()
    )

    if not sector_totals:
        return {"safest": [], "hotspots": [], "guildford_average": 0}

    all_sector_data = (
        db.query(
            CrimeData.postcode_sector,
            CrimeData.category,
            func.sum(CrimeData.count).label("total"),
        )
        .filter(_guildford_sector_filter())
        .group_by(CrimeData.postcode_sector, CrimeData.category)
        .all()
    )

    weighted_by_sector: Dict[str, float] = {}
    for row in all_sector_data:
        weighted_by_sector[row.postcode_sector] = weighted_by_sector.get(
            row.postcode_sector, 0.0
        ) + (row.total * CATEGORY_WEIGHTS.get(row.category, 0.5))

    sectors = []
    all_totals = []
    normaliser = score_service._get_safety_normaliser(db)
    for row in sector_totals:
        weighted_sum = weighted_by_sector.get(row.postcode_sector, 0.0)
        safety_score = round(
            max(0.0, min(100.0, 100.0 - (weighted_sum / max(normaliser, 1) * 100.0))),
            1,
        )
        sectors.append(
            {
                "postcode_sector": row.postcode_sector,
                "total_crimes": int(row.total),
                "weighted_sum": weighted_sum,
                "safety_score": safety_score,
            }
        )
        all_totals.append(int(row.total))

    # Compute normalised safety score
    guildford_avg = sum(all_totals) / len(all_totals) if all_totals else 0

    for s in sectors:
        # Comparison to average
        if guildford_avg > 0:
            diff_pct = round(
                (s["total_crimes"] - guildford_avg) / guildford_avg * 100, 1
            )
        else:
            diff_pct = 0
        s["vs_average_percent"] = diff_pct
        s["vs_average_label"] = (
            f"{abs(diff_pct):.0f}% less crime than average"
            if diff_pct < 0
            else (
                f"{diff_pct:.0f}% more crime than average"
                if diff_pct > 0
                else "Average"
            )
        )

    # Sort
    by_safest = sorted(
        sectors,
        key=lambda x: (-x["safety_score"], x["total_crimes"], x["postcode_sector"]),
    )
    by_hotspot = sorted(
        sectors,
        key=lambda x: (x["safety_score"], -x["total_crimes"], x["postcode_sector"]),
    )

    result = {
        "safest": by_safest[:5],
        "hotspots": by_hotspot[:5],
        "guildford_average": round(guildford_avg, 1),
        "total_sectors": len(sectors),
    }
    set_json(cache_key, result, _RANKINGS_CACHE_TTL)
    return result


def get_compared_to_average(postcode_sector: str, db: Session) -> Dict:
    """Compare a sector's crime to the Guildford average.

    Returns:
        Dict with percentile, comparison label, and relative count.
    """
    # This sector's total
    sector_total = (
        db.query(func.sum(CrimeData.count))
        .filter(CrimeData.postcode_sector == postcode_sector)
        .scalar()
    ) or 0

    # All sectors' totals
    all_sectors = (
        db.query(
            CrimeData.postcode_sector,
            func.sum(CrimeData.count).label("total"),
        )
        .filter(_guildford_sector_filter())
        .group_by(CrimeData.postcode_sector)
        .all()
    )

    if not all_sectors:
        return {
            "sector_total": sector_total,
            "guildford_average": 0,
            "percentile": 50,
            "comparison_label": "No data available",
            "difference_percent": 0,
        }

    all_totals = sorted([r.total for r in all_sectors])
    avg = sum(all_totals) / len(all_totals)

    # Percentile: what % of areas have MORE crime than this one
    safer_count = sum(1 for t in all_totals if t > sector_total)
    percentile = round(safer_count / len(all_totals) * 100, 0)

    diff_pct = round((sector_total - avg) / max(avg, 1) * 100, 1)

    if diff_pct < -50:
        label = (
            f"Remarkably safe, {abs(diff_pct):.0f}% less crime than Guildford average"
        )
    elif diff_pct < -20:
        label = f"Well below average, {abs(diff_pct):.0f}% less crime"
    elif diff_pct < -5:
        label = f"Below average, {abs(diff_pct):.0f}% less crime"
    elif diff_pct > 50:
        label = f"High crime area, {diff_pct:.0f}% more crime than average"
    elif diff_pct > 20:
        label = f"Above average, {diff_pct:.0f}% more crime"
    elif diff_pct > 5:
        label = f"Slightly above average, {diff_pct:.0f}% more crime"
    else:
        label = "About average for Guildford"

    return {
        "sector_total": sector_total,
        "guildford_average": round(avg, 1),
        "percentile": int(percentile),
        "comparison_label": label,
        "difference_percent": diff_pct,
    }


def get_holiday_burglary_risk(postcode_sector: str, db: Session) -> Dict:
    """Analyse burglary risk during university holidays vs term time.

    Students leave houses empty during holidays (Jun-Sep, Dec-Jan),
    making them targets for burglars.

    Returns:
        Dict with holiday/term burglary counts and risk assessment.
    """
    burglary_data = (
        db.query(CrimeData.month, CrimeData.count)
        .filter(
            CrimeData.postcode_sector == postcode_sector,
            CrimeData.category == "burglary",
        )
        .all()
    )

    if not burglary_data:
        return {
            "risk_level": "low",
            "label": "No burglary data available",
            "holiday_count": 0,
            "term_count": 0,
            "spike_percent": 0,
            "tip": "Always lock windows and doors when leaving.",
        }

    holiday_count = 0
    term_count = 0
    holiday_months_found = 0
    term_months_found = 0

    for row in burglary_data:
        month_num = (
            row.month.month
            if isinstance(row.month, date)
            else int(str(row.month).split("-")[1])
        )
        if month_num in HOLIDAY_MONTHS:
            holiday_count += row.count
            holiday_months_found += 1
        else:
            term_count += row.count
            term_months_found += 1

    # Average per month to compare fairly
    holiday_avg = holiday_count / max(holiday_months_found, 1)
    term_avg = term_count / max(term_months_found, 1)

    if term_avg == 0 and holiday_avg == 0:
        spike_pct = 0
    elif term_avg == 0:
        spike_pct = 100
    else:
        spike_pct = round((holiday_avg - term_avg) / term_avg * 100, 0)

    if spike_pct > 50:
        risk = "high"
        label = f"⚠️ Burglaries spike {spike_pct:.0f}% during holidays"
        tip = (
            "Student houses are targeted when empty. Ask your landlord about "
            "security measures: smart locks, CCTV, property check-ins during holidays."
        )
    elif spike_pct > 20:
        risk = "moderate"
        label = f"Burglaries increase {spike_pct:.0f}% during holidays"
        tip = (
            "Consider asking a friend to check on the property. "
            "Use timer switches for lights when you're away."
        )
    else:
        risk = "low"
        label = "No significant holiday burglary pattern"
        tip = "Always lock windows and doors when leaving."

    return {
        "risk_level": risk,
        "label": label,
        "holiday_count": holiday_count,
        "term_count": term_count,
        "spike_percent": int(spike_pct),
        "tip": tip,
    }


def get_student_vulnerability_index(postcode_sector: str, db: Session) -> Dict:
    """Compute student-specific safety score using student-weighted crime categories.

    Different from general safety: burglary and personal theft weighted much higher,
    vehicle crime and drugs weighted lower (less relevant to students).

    Returns:
        Dict with student_score, general_score, and category impacts.
    """
    rows = (
        db.query(
            CrimeData.category,
            func.sum(CrimeData.count).label("total"),
        )
        .filter(CrimeData.postcode_sector == postcode_sector)
        .group_by(CrimeData.category)
        .all()
    )

    if not rows:
        return {
            "student_score": None,
            "general_score": None,
            "label": "No data available",
            "impacts": [],
        }

    student_weighted = sum(r.total * STUDENT_WEIGHTS.get(r.category, 0.5) for r in rows)

    all_sector_data = (
        db.query(
            CrimeData.postcode_sector,
            CrimeData.category,
            func.sum(CrimeData.count).label("total"),
        )
        .filter(_guildford_sector_filter())
        .group_by(CrimeData.postcode_sector, CrimeData.category)
        .all()
    )

    sector_student = {}
    for r in all_sector_data:
        sector_student[r.postcode_sector] = sector_student.get(
            r.postcode_sector, 0
        ) + r.total * STUDENT_WEIGHTS.get(r.category, 0.5)

    max_student = max(sector_student.values()) if sector_student else 1

    general_result = score_service.get_safety_score(postcode_sector, db)
    general_score = general_result.get("safety_score") if general_result else None
    student_score = round(
        max(0, 100 - (student_weighted / max(max_student, 1) * 100)), 1
    )

    # Category impacts for students
    impacts = []
    for r in sorted(
        rows, key=lambda x: x.total * STUDENT_WEIGHTS.get(x.category, 0.5), reverse=True
    ):
        sw = STUDENT_WEIGHTS.get(r.category, 0.5)
        gw = CATEGORY_WEIGHTS.get(r.category, 0.5)
        impact = "high" if sw > gw else "low" if sw < gw else "same"
        impacts.append(
            {
                "category": r.category,
                "label": CATEGORY_LABELS.get(r.category, r.category),
                "count": r.total,
                "student_relevance": impact,
                "student_weight": sw,
                "general_weight": gw,
            }
        )

    # Label
    if student_score >= 80:
        label = "Very safe for students"
    elif student_score >= 60:
        label = "Safe for students"
    elif student_score >= 40:
        label = "Moderate, take usual precautions"
    else:
        label = "Higher risk area, be extra careful"

    return {
        "student_score": student_score,
        "general_score": general_score,
        "label": label,
        "score_difference": round(student_score - general_score, 1),
        "impacts": impacts,
    }


def get_safety_tips(postcode_sector: str, db: Session) -> List[Dict]:
    """Generate contextual safety tips based on actual crime patterns.

    Returns:
        List of tips with type (positive/warning/info) and text.
    """
    breakdown = get_crime_breakdown(postcode_sector, db)
    total = sum(c["count"] for c in breakdown)

    tips = []

    # Find dominant crime types (12-month totals)
    crime_map = {c["category"]: c["count"] for c in breakdown}

    burglary = crime_map.get("burglary", 0)
    theft = crime_map.get("theft-from-the-person", 0)
    asb = crime_map.get("anti-social-behaviour", 0)
    violent = crime_map.get("violent-crime", 0)
    vehicle = crime_map.get("vehicle-crime", 0)

    # Monthly averages (data covers 12 months)
    _m = 12
    total_mo = total / _m
    burglary_mo = burglary / _m
    theft_mo = theft / _m
    asb_mo = asb / _m
    violent_mo = violent / _m
    vehicle_mo = vehicle / _m

    if total == 0:
        tips.append(
            {
                "type": "positive",
                "icon": "✅",
                "text": "No recorded crimes in this area, extremely safe!",
            }
        )
        return tips

    if total_mo <= 5:
        tips.append(
            {
                "type": "positive",
                "icon": "✅",
                "text": f"Fewer than {round(total_mo + 1)} incidents per month on average, very quiet area",
            }
        )

    if burglary == 0:
        tips.append(
            {
                "type": "positive",
                "icon": "🏠",
                "text": "Zero burglaries recorded, safe to leave bikes outside",
            }
        )
    elif burglary_mo >= 4:
        tips.append(
            {
                "type": "warning",
                "icon": "🔒",
                "text": f"~{round(burglary_mo)} burglaries/month, ask your landlord about door and window locks",
            }
        )
    elif burglary_mo >= 1:
        tips.append(
            {
                "type": "warning",
                "icon": "🔒",
                "text": f"{burglary} burglaries recorded in the past year, keep windows locked when out",
            }
        )

    if theft == 0:
        tips.append(
            {
                "type": "positive",
                "icon": "📱",
                "text": "No personal theft recorded, safe for walking with valuables",
            }
        )
    elif theft_mo >= 8:
        tips.append(
            {
                "type": "warning",
                "icon": "📱",
                "text": f"~{round(theft_mo)} personal thefts/month, keep phone and laptop out of sight",
            }
        )
    elif theft_mo >= 2:
        tips.append(
            {
                "type": "warning",
                "icon": "📱",
                "text": f"{theft} personal theft incidents in the past year, stay alert in busy areas",
            }
        )

    if asb_mo >= 20:
        tips.append(
            {
                "type": "info",
                "icon": "🔊",
                "text": f"~{round(asb_mo)} ASB incidents/month, can be noisy at night, especially weekends",
            }
        )
    elif asb_mo <= 2:
        tips.append(
            {
                "type": "positive",
                "icon": "📚",
                "text": "Very low anti-social behaviour, quiet area for studying",
            }
        )

    if violent_mo >= 15:
        tips.append(
            {
                "type": "warning",
                "icon": "⚠️",
                "text": f"~{round(violent_mo)} violent incidents/month, be aware at night, stick to lit routes",
            }
        )
    elif violent_mo >= 5:
        tips.append(
            {
                "type": "warning",
                "icon": "⚠️",
                "text": f"{violent} violent incidents in the past year, avoid walking alone late at night",
            }
        )
    elif violent_mo <= 0.5:
        tips.append(
            {
                "type": "positive",
                "icon": "🚶",
                "text": "Very low violence, safe for evening walks",
            }
        )

    if vehicle_mo >= 3:
        tips.append(
            {
                "type": "info",
                "icon": "🚗",
                "text": f"~{round(vehicle_mo)} vehicle crimes/month, park in well-lit areas if you have a car",
            }
        )

    return tips


_INTELLIGENCE_CACHE_TTL = 1800  # 30 minutes, data changes monthly


def get_full_safety_intelligence(postcode_sector: str, db: Session) -> Dict:
    """Get complete safety intelligence for a postcode sector.

    Aggregates all safety analysis into a single response.
    Cached in Redis for 30 minutes (data only changes monthly).

    Args:
        postcode_sector: e.g. "GU2 7"
        db: SQLAlchemy session

    Returns:
        Comprehensive safety intelligence dict.
    """
    from app.cache import get_json, set_json

    cache_key = f"safety:intelligence:{postcode_sector}"
    cached = get_json(cache_key)
    if cached is not None:
        return cached

    latest_month = (
        db.query(func.max(CrimeData.month))
        .filter(CrimeData.postcode_sector == postcode_sector)
        .scalar()
    )

    result = {
        "postcode_sector": postcode_sector,
        "crime_breakdown": get_crime_breakdown(postcode_sector, db),
        "crime_trend": get_crime_trend(postcode_sector, db),
        "compared_to_average": get_compared_to_average(postcode_sector, db),
        "holiday_burglary_risk": get_holiday_burglary_risk(postcode_sector, db),
        "student_vulnerability": get_student_vulnerability_index(postcode_sector, db),
        "safety_tips": get_safety_tips(postcode_sector, db),
        "methodology": get_methodology_summary(latest_month),
    }

    set_json(cache_key, result, _INTELLIGENCE_CACHE_TTL)
    return result


def get_guildford_overview(db: Session) -> Dict:
    """Return a Guildford-wide safety overview before postcode drill-down."""
    base_query = db.query(CrimeData).filter(_guildford_sector_filter())
    latest_month = _latest_month_for_query(base_query)

    sector_totals = (
        db.query(
            CrimeData.postcode_sector,
            func.sum(CrimeData.count).label("total"),
        )
        .filter(_guildford_sector_filter())
        .group_by(CrimeData.postcode_sector)
        .order_by(CrimeData.postcode_sector)
        .all()
    )

    breakdown_rows = (
        db.query(
            CrimeData.category,
            func.sum(CrimeData.count).label("total"),
        )
        .filter(_guildford_sector_filter())
        .group_by(CrimeData.category)
        .order_by(func.sum(CrimeData.count).desc())
        .all()
    )

    monthly_rows = (
        db.query(
            CrimeData.month,
            func.sum(CrimeData.count).label("total"),
        )
        .filter(_guildford_sector_filter())
        .group_by(CrimeData.month)
        .order_by(CrimeData.month)
        .all()
    )
    monthly_series = _build_monthly_window(monthly_rows, max_months=12)
    crime_trend = _build_trend_response(monthly_series)
    total_tracked = sum(int(row.total) for row in sector_totals)
    coverage_sectors = [row.postcode_sector for row in sector_totals]
    coverage_districts = sorted({sector.split()[0] for sector in coverage_sectors})
    rankings = get_area_rankings(db)

    return {
        "area_name": "Guildford",
        "coverage_name": "SurreyNest Guildford coverage",
        "scope_note": (
            "This overview aggregates the Guildford postcode sectors SurreyNest currently "
            "covers. It helps users compare Guildford areas consistently, but it is not an "
            "official borough-wide police total."
        ),
        "latest_month": latest_month.isoformat() if latest_month else None,
        "latest_month_label": _format_month_label(latest_month),
        "months_covered": len(monthly_series),
        "total_tracked_crimes_12m": total_tracked,
        "average_monthly_tracked_crimes": round(
            total_tracked / max(len(monthly_series), 1), 1
        ),
        "average_sector_total_12m": round(
            total_tracked / max(len(sector_totals), 1), 1
        ),
        "sector_count": len(coverage_sectors),
        "coverage_districts": coverage_districts,
        "coverage_sectors": coverage_sectors,
        "crime_breakdown": _build_breakdown(breakdown_rows),
        "crime_trend": crime_trend,
        "rankings": rankings,
        "safest_area": rankings["safest"][0] if rankings["safest"] else None,
        "hotspot_area": rankings["hotspots"][0] if rankings["hotspots"] else None,
        "methodology": get_methodology_summary(latest_month),
    }
