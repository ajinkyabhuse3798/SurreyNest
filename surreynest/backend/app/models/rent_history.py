"""ORM model for the `rent_history` table.

Stores yearly median implied rents per postcode sector, computed from
Land Registry Price Paid Data. Used by the RentRadar chart on the
PropertyDetail page.
"""

from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class RentHistory(Base):
    """Yearly median implied rent per postcode sector.

    Populated by the Land Registry pipeline. Each row represents one
    postcode sector in one year.

    Attributes:
        postcode_sector: e.g. "GU2 7".
        year: Calendar year, e.g. 2023.
        median_sale_price: Median sale price for that sector+year.
        implied_weekly_rent: median_price * GROSS_YIELD / 52.
        transaction_count: Number of sales in that sector+year.
    """

    __tablename__ = "rent_history"

    postcode_sector: Mapped[str] = mapped_column(
        String(10), primary_key=True, nullable=False
    )
    year: Mapped[int] = mapped_column(
        Integer, primary_key=True, nullable=False
    )
    median_sale_price: Mapped[float] = mapped_column(Float, nullable=False)
    implied_weekly_rent: Mapped[float] = mapped_column(Float, nullable=False)
    transaction_count: Mapped[int] = mapped_column(Integer, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    def __repr__(self) -> str:
        return (
            f"<RentHistory sector={self.postcode_sector} "
            f"year={self.year} rent=£{self.implied_weekly_rent:.0f}/wk>"
        )
