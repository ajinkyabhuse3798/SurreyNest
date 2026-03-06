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
from typing import Dict, List, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.crime_data import CrimeData

logger = logging.getLogger(__name__)

# ── Category weights ─────────────────────────────────────────────────────────
CATEGORY_WEIGHTS = {
    "violent-crime": 3.0,
    "robbery": 2.5,
    "anti-social-behaviour": 2.0,
    "burglary": 2.0,
    "drugs": 1.5,
    "public-order": 1.5,
    "vehicle-crime": 1.0,
    "theft-from-the-person": 1.0,
}

# Student-specific weights (burglary/theft much more relevant)
STUDENT_WEIGHTS = {
    "burglary": 4.0,           # Empty student houses during holidays
    "theft-from-the-person": 3.0,  # Walking home from nights out
    "violent-crime": 3.0,      # Same as general
    "robbery": 2.5,            # Same
    "anti-social-behaviour": 1.0,  # Students ARE the noise source
    "public-order": 1.0,       # Less relevant
    "vehicle-crime": 0.5,      # Most students don't drive
    "drugs": 0.5,              # Less relevant to housing decision
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
}

# University of Surrey approximate term dates (typical academic year)
HOLIDAY_MONTHS = {6, 7, 8, 9, 12, 1}  # Jun-Sep (summer), Dec-Jan (Christmas)
TERM_MONTHS = {2, 3, 4, 5, 10, 11}    # Feb-May, Oct-Nov


def get_crime_breakdown(
    postcode_sector: str, db: Session
) -> List[Dict]:
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

    if not rows:
        return []

    total_crimes = sum(r.total for r in rows)
    breakdown = []
    for row in rows:
        pct = round(row.total / total_crimes * 100, 1) if total_crimes > 0 else 0
        breakdown.append({
            "category": row.category,
            "label": CATEGORY_LABELS.get(row.category, row.category.replace("-", " ").title()),
            "count": row.total,
            "percentage": pct,
            "weight": CATEGORY_WEIGHTS.get(row.category, 0.5),
        })

    return breakdown


def get_crime_trend(
    postcode_sector: str, db: Session
) -> Dict:
    """Analyse crime trend over time for a postcode sector.

    Compares the most recent 6 months vs the previous 6 months.

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

    if not monthly or len(monthly) < 2:
        return {
            "direction": "stable",
            "change_percent": 0,
            "label": "Not enough data",
            "monthly_data": [],
        }

    # Build monthly data for sparkline
    monthly_data = [
        {"month": str(m.month), "count": m.total}
        for m in monthly
    ]

    # Split into two halves for comparison
    mid = len(monthly) // 2
    recent_months = monthly[mid:]
    earlier_months = monthly[:mid]

    recent_avg = sum(m.total for m in recent_months) / max(len(recent_months), 1)
    earlier_avg = sum(m.total for m in earlier_months) / max(len(earlier_months), 1)

    if earlier_avg == 0:
        change_pct = 0
    else:
        change_pct = round((recent_avg - earlier_avg) / earlier_avg * 100, 1)

    if change_pct < -10:
        direction = "improving"
        label = f"Crime down {abs(change_pct):.0f}% — Getting safer"
    elif change_pct > 10:
        direction = "worsening"
        label = f"Crime up {change_pct:.0f}% — Getting worse"
    else:
        direction = "stable"
        label = "Crime levels stable"

    return {
        "direction": direction,
        "change_percent": change_pct,
        "label": label,
        "monthly_data": monthly_data,
    }


def get_area_rankings(db: Session) -> Dict:
    """Get safest and hotspot area rankings across all Guildford sectors.

    Returns:
        Dict with safest (top 5) and hotspot (top 5) areas.
    """
    # Get total crimes per sector
    sector_totals = (
        db.query(
            CrimeData.postcode_sector,
            func.sum(CrimeData.count).label("total"),
        )
        .group_by(CrimeData.postcode_sector)
        .all()
    )

    if not sector_totals:
        return {"safest": [], "hotspots": [], "guildford_average": 0}

    # Compute safety scores
    sectors = []
    all_totals = []
    for row in sector_totals:
        # Get weighted score
        weighted = (
            db.query(
                func.sum(CrimeData.count).label("total"),
                CrimeData.category,
            )
            .filter(CrimeData.postcode_sector == row.postcode_sector)
            .group_by(CrimeData.category)
            .all()
        )
        weighted_sum = sum(
            r.total * CATEGORY_WEIGHTS.get(r.category, 0.5)
            for r in weighted
        )
        sectors.append({
            "postcode_sector": row.postcode_sector,
            "total_crimes": row.total,
            "weighted_sum": weighted_sum,
        })
        all_totals.append(row.total)

    # Compute normalised safety score
    guildford_avg = sum(all_totals) / len(all_totals) if all_totals else 0
    max_weighted = max(s["weighted_sum"] for s in sectors) if sectors else 1

    for s in sectors:
        raw_score = max(0, 100 - (s["weighted_sum"] / max(max_weighted, 1) * 100))
        s["safety_score"] = round(raw_score, 1)

        # Comparison to average
        if guildford_avg > 0:
            diff_pct = round((s["total_crimes"] - guildford_avg) / guildford_avg * 100, 1)
        else:
            diff_pct = 0
        s["vs_average_percent"] = diff_pct
        s["vs_average_label"] = (
            f"{abs(diff_pct):.0f}% less crime than average"
            if diff_pct < 0
            else f"{diff_pct:.0f}% more crime than average"
            if diff_pct > 0
            else "Average"
        )

    # Sort
    by_safest = sorted(sectors, key=lambda x: x["total_crimes"])
    by_hotspot = sorted(sectors, key=lambda x: x["total_crimes"], reverse=True)

    return {
        "safest": by_safest[:5],
        "hotspots": by_hotspot[:5],
        "guildford_average": round(guildford_avg, 1),
        "total_sectors": len(sectors),
    }


def get_compared_to_average(
    postcode_sector: str, db: Session
) -> Dict:
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
    safer_count = sum(1 for t in all_totals if t >= sector_total)
    percentile = round(safer_count / len(all_totals) * 100, 0)

    diff_pct = round((sector_total - avg) / max(avg, 1) * 100, 1)

    if diff_pct < -50:
        label = f"Remarkably safe — {abs(diff_pct):.0f}% less crime than Guildford average"
    elif diff_pct < -20:
        label = f"Well below average — {abs(diff_pct):.0f}% less crime"
    elif diff_pct < -5:
        label = f"Below average — {abs(diff_pct):.0f}% less crime"
    elif diff_pct > 50:
        label = f"High crime area — {diff_pct:.0f}% more crime than average"
    elif diff_pct > 20:
        label = f"Above average — {diff_pct:.0f}% more crime"
    elif diff_pct > 5:
        label = f"Slightly above average — {diff_pct:.0f}% more crime"
    else:
        label = "About average for Guildford"

    return {
        "sector_total": sector_total,
        "guildford_average": round(avg, 1),
        "percentile": int(percentile),
        "comparison_label": label,
        "difference_percent": diff_pct,
    }


def get_holiday_burglary_risk(
    postcode_sector: str, db: Session
) -> Dict:
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
        month_num = row.month.month if isinstance(row.month, date) else int(str(row.month).split("-")[1])
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
        tip = ("Student houses are targeted when empty. Ask your landlord about "
               "security measures: smart locks, CCTV, property check-ins during holidays.")
    elif spike_pct > 20:
        risk = "moderate"
        label = f"Burglaries increase {spike_pct:.0f}% during holidays"
        tip = ("Consider asking a friend to check on the property. "
               "Use timer switches for lights when you're away.")
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


def get_student_vulnerability_index(
    postcode_sector: str, db: Session
) -> Dict:
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

    # Compute both scores
    general_weighted = sum(
        r.total * CATEGORY_WEIGHTS.get(r.category, 0.5) for r in rows
    )
    student_weighted = sum(
        r.total * STUDENT_WEIGHTS.get(r.category, 0.5) for r in rows
    )

    # Get all sectors for normalisation
    all_sectors_general = []
    all_sectors_student = []
    all_sector_data = (
        db.query(
            CrimeData.postcode_sector,
            CrimeData.category,
            func.sum(CrimeData.count).label("total"),
        )
        .group_by(CrimeData.postcode_sector, CrimeData.category)
        .all()
    )

    sector_general = {}
    sector_student = {}
    for r in all_sector_data:
        sector_general[r.postcode_sector] = sector_general.get(r.postcode_sector, 0) + \
            r.total * CATEGORY_WEIGHTS.get(r.category, 0.5)
        sector_student[r.postcode_sector] = sector_student.get(r.postcode_sector, 0) + \
            r.total * STUDENT_WEIGHTS.get(r.category, 0.5)

    max_general = max(sector_general.values()) if sector_general else 1
    max_student = max(sector_student.values()) if sector_student else 1

    general_score = round(max(0, 100 - (general_weighted / max(max_general, 1) * 100)), 1)
    student_score = round(max(0, 100 - (student_weighted / max(max_student, 1) * 100)), 1)

    # Category impacts for students
    impacts = []
    for r in sorted(rows, key=lambda x: x.total * STUDENT_WEIGHTS.get(x.category, 0.5), reverse=True):
        sw = STUDENT_WEIGHTS.get(r.category, 0.5)
        gw = CATEGORY_WEIGHTS.get(r.category, 0.5)
        impact = "high" if sw > gw else "low" if sw < gw else "same"
        impacts.append({
            "category": r.category,
            "label": CATEGORY_LABELS.get(r.category, r.category),
            "count": r.total,
            "student_relevance": impact,
            "student_weight": sw,
            "general_weight": gw,
        })

    # Label
    if student_score >= 80:
        label = "Very safe for students"
    elif student_score >= 60:
        label = "Safe for students"
    elif student_score >= 40:
        label = "Moderate — take usual precautions"
    else:
        label = "Higher risk area — be extra careful"

    return {
        "student_score": student_score,
        "general_score": general_score,
        "label": label,
        "score_difference": round(student_score - general_score, 1),
        "impacts": impacts,
    }


def get_safety_tips(
    postcode_sector: str, db: Session
) -> List[Dict]:
    """Generate contextual safety tips based on actual crime patterns.

    Returns:
        List of tips with type (positive/warning/info) and text.
    """
    breakdown = get_crime_breakdown(postcode_sector, db)
    total = sum(c["count"] for c in breakdown)

    tips = []

    # Find dominant crime types
    crime_map = {c["category"]: c["count"] for c in breakdown}

    burglary = crime_map.get("burglary", 0)
    theft = crime_map.get("theft-from-the-person", 0)
    asb = crime_map.get("anti-social-behaviour", 0)
    violent = crime_map.get("violent-crime", 0)
    vehicle = crime_map.get("vehicle-crime", 0)

    if total == 0:
        tips.append({
            "type": "positive",
            "icon": "✅",
            "text": "No recorded crimes in this area — extremely safe!",
        })
        return tips

    if total <= 5:
        tips.append({
            "type": "positive",
            "icon": "✅",
            "text": f"Only {total} incidents recorded — very safe area",
        })

    if burglary == 0:
        tips.append({
            "type": "positive",
            "icon": "🏠",
            "text": "Zero burglaries recorded — safe to leave bikes outside",
        })
    elif burglary >= 3:
        tips.append({
            "type": "warning",
            "icon": "🔒",
            "text": f"{burglary} burglaries recorded — ask landlord about window/door locks",
        })

    if theft == 0:
        tips.append({
            "type": "positive",
            "icon": "📱",
            "text": "No personal theft recorded — safe for walking with valuables",
        })
    elif theft >= 2:
        tips.append({
            "type": "warning",
            "icon": "📱",
            "text": f"{theft} personal theft incidents — keep phone/laptop close in public",
        })

    if asb >= 5:
        tips.append({
            "type": "info",
            "icon": "🔊",
            "text": f"{asb} ASB incidents — can be noisy, consider noise-cancelling headphones",
        })
    elif asb <= 2:
        tips.append({
            "type": "positive",
            "icon": "📚",
            "text": "Low anti-social behaviour — quiet area for studying",
        })

    if violent >= 5:
        tips.append({
            "type": "warning",
            "icon": "⚠️",
            "text": f"{violent} violent incidents — avoid walking alone late at night",
        })
    elif violent <= 2:
        tips.append({
            "type": "positive",
            "icon": "🚶",
            "text": "Very low violence — safe for evening walks",
        })

    if vehicle >= 3:
        tips.append({
            "type": "info",
            "icon": "🚗",
            "text": f"{vehicle} vehicle crimes — park in well-lit areas if you have a car",
        })

    return tips


def get_full_safety_intelligence(
    postcode_sector: str, db: Session
) -> Dict:
    """Get complete safety intelligence for a postcode sector.

    Aggregates all safety analysis into a single response.

    Args:
        postcode_sector: e.g. "GU2 7"
        db: SQLAlchemy session

    Returns:
        Comprehensive safety intelligence dict.
    """
    return {
        "postcode_sector": postcode_sector,
        "crime_breakdown": get_crime_breakdown(postcode_sector, db),
        "crime_trend": get_crime_trend(postcode_sector, db),
        "compared_to_average": get_compared_to_average(postcode_sector, db),
        "holiday_burglary_risk": get_holiday_burglary_risk(postcode_sector, db),
        "student_vulnerability": get_student_vulnerability_index(postcode_sector, db),
        "safety_tips": get_safety_tips(postcode_sector, db),
    }
