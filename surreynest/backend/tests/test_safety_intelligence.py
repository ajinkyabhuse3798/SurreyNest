"""Regression tests for safety intelligence trend calculations."""

from datetime import date

from app.models.crime_data import CrimeData
from app.services.safety_intelligence import (
    get_crime_trend,
    get_guildford_overview,
    get_student_vulnerability_index,
)
from app.services.score_service import get_safety_score


def _seed_month(
    db,
    sector: str,
    month: date,
    count: int,
    category: str = "burglary",
) -> None:
    db.add(
        CrimeData(
            postcode_sector=sector,
            category=category,
            month=month,
            count=count,
        )
    )


def test_get_crime_trend_uses_latest_12_months_and_fills_gaps(db) -> None:
    """Trend windows should be continuous, gap-filled, and capped to 12 months."""
    sector = "GU2 7"
    counts = {
        date(2025, 1, 1): 120,  # older than the returned 12-month window
        date(2025, 2, 1): 90,
        date(2025, 3, 1): 90,
        date(2025, 4, 1): 90,
        date(2025, 5, 1): 90,
        date(2025, 6, 1): 90,
        date(2025, 7, 1): 90,
        date(2025, 9, 1): 30,   # August intentionally missing
        date(2025, 10, 1): 30,
        date(2025, 11, 1): 30,
        date(2025, 12, 1): 30,
        date(2026, 1, 1): 30,
    }

    for month, count in counts.items():
        _seed_month(db, sector, month, count)
    db.commit()

    result = get_crime_trend(sector, db)

    assert result["direction"] == "improving"
    assert result["change_percent"] == -72.2
    assert result["label"] == "Crime down 72%, Getting safer"
    assert len(result["monthly_data"]) == 12
    assert result["monthly_data"][0] == {"month": "2025-02-01", "count": 90}
    assert result["monthly_data"][6] == {"month": "2025-08-01", "count": 0}
    assert result["monthly_data"][-1] == {"month": "2026-01-01", "count": 30}


def test_get_crime_trend_returns_not_enough_data_for_single_month(db) -> None:
    """A single data point should not fabricate a trend."""
    sector = "GU1 1"
    _seed_month(db, sector, date(2026, 1, 1), 22)
    db.commit()

    result = get_crime_trend(sector, db)

    assert result == {
        "direction": "stable",
        "change_percent": 0,
        "label": "Not enough data",
        "monthly_data": [],
    }


def test_student_vulnerability_uses_same_general_score_as_primary_safety_score(db) -> None:
    """The student panel should not invent a second general safety baseline."""
    rows = [
        ("GU2 7", date(2026, 1, 1), "burglary", 10),
        ("GU2 7", date(2026, 1, 1), "violent-crime", 5),
        ("GU1 4", date(2026, 1, 1), "burglary", 20),
        ("GU1 4", date(2026, 1, 1), "violent-crime", 15),
    ]

    for sector, month, category, count in rows:
        _seed_month(db, sector, month, count, category=category)
    db.commit()

    student_view = get_student_vulnerability_index("GU2 7", db)
    primary_score = get_safety_score("GU2 7", db)

    assert student_view["general_score"] == primary_score["safety_score"]


def test_guildford_overview_aggregates_covered_sectors_and_explains_methodology(db) -> None:
    """Guildford overview should aggregate SurreyNest coverage and explain its limits."""
    rows = [
        ("GU2 7", date(2025, 12, 1), "burglary", 10),
        ("GU2 7", date(2026, 1, 1), "violent-crime", 8),
        ("GU1 4", date(2026, 1, 1), "anti-social-behaviour", 12),
        ("GU7 2", date(2026, 1, 1), "robbery", 3),
        ("KT1 1", date(2026, 1, 1), "burglary", 999),
    ]

    for sector, month, category, count in rows:
        _seed_month(db, sector, month, count, category=category)
    db.commit()

    overview = get_guildford_overview(db)

    assert overview["total_tracked_crimes_12m"] == 33
    assert overview["sector_count"] == 3
    assert overview["coverage_districts"] == ["GU1", "GU2", "GU7"]
    assert overview["coverage_sectors"] == ["GU1 4", "GU2 7", "GU7 2"]
    assert overview["latest_month"] == "2026-01-01"
    assert overview["methodology"]["sector_radius_m"] == 500
    assert overview["methodology"]["tracked_category_count"] == 8
    assert "usually lower than raw police.uk totals" in overview["methodology"]["why_counts_look_lower"]
    assert "not an official borough-wide police total" in overview["scope_note"]
