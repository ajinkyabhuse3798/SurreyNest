"""ORM model for the `crime_data` table.

Aggregated crime counts from police.uk API, grouped by postcode sector
(e.g. "GU2 7") and month. Safety scores are computed on-the-fly in
score_service.py, they are not stored here.
"""


from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CrimeData(Base):
    """Police.uk crime counts by postcode sector and month.

    Attributes:
        id: Auto-incrementing primary key.
        postcode_sector: First segment of the postcode, e.g. "GU2 7".
        category: Crime category as returned by police.uk API.
        month: First day of the month (e.g. 2024-01-01).
        count: Number of crimes in this category/sector/month.
        updated_at: Last pipeline update timestamp.
    """

    __tablename__ = "crime_data"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    postcode_sector: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        index=True,
    )
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    month: Mapped[date] = mapped_column(Date, nullable=False)
    count: Mapped[int] = mapped_column(Integer, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Composite unique constraint, enables ON CONFLICT DO UPDATE
    # and prevents duplicate rows for same sector+category+month
    __table_args__ = (
        UniqueConstraint(
            "postcode_sector", "category", "month",
            name="uq_crime_sector_category_month",
        ),
        # Composite index for the common query pattern: WHERE postcode_sector = X
        # grouped/filtered by category (used in score_service and safety_intelligence).
        # The unique constraint covers (sector, category, month) but a dedicated 2-column
        # index avoids scanning the full 3-column index when month is not in the predicate.
        Index("ix_crime_data_sector_category", "postcode_sector", "category"),
    )

    def __repr__(self) -> str:
        return (
            f"<CrimeData sector={self.postcode_sector} "
            f"category={self.category} month={self.month} count={self.count}>"
        )
