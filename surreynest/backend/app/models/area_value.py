"""ORM model for the `area_values` table.

Stores Land Registry area value index per postcode, computed from
median sale prices in the Price Paid Data. Used as a feature in the
rent prediction ML model.
"""

from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AreaValue(Base):
    """Land Registry area value index per postcode.

    Attributes:
        postcode: Primary key — normalised UK postcode, e.g. "GU2 7XH".
        median_sale_price: Median sale price from PPD (post-2020).
        area_value_index: Min-max normalised to 0.0–1.0 across all GU postcodes.
        updated_at: Last pipeline update timestamp.
    """

    __tablename__ = "area_values"

    postcode: Mapped[str] = mapped_column(
        String(10), primary_key=True, nullable=False
    )
    median_sale_price: Mapped[float] = mapped_column(Float, nullable=False)
    area_value_index: Mapped[float] = mapped_column(Float, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    def __repr__(self) -> str:
        return (
            f"<AreaValue postcode={self.postcode} "
            f"index={self.area_value_index:.4f}>"
        )
