"""ORM model for the `crime_data` table.

Aggregated crime counts from police.uk API, grouped by postcode sector
(e.g. "GU2 7") and month. Safety scores are computed on-the-fly in
score_service.py — they are not stored here.
"""

from datetime import date, datetime

from sqlalchemy import Date, DateTime, Index, Integer, String
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
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    # Composite index for the primary access pattern:
    # aggregate by sector + category over a date range
    __table_args__ = (
        Index("ix_crime_data_sector_category_month", "postcode_sector", "category", "month"),
    )

    def __repr__(self) -> str:
        return (
            f"<CrimeData sector={self.postcode_sector} "
            f"category={self.category} month={self.month} count={self.count}>"
        )
