"""ORM model for the `flood_risk` table.

Stores Environment Agency flood area data per postcode, including
current warning severity and area description. Updated weekly by
the flood pipeline from the EA Flood Monitoring API.
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class FloodRisk(Base):
    """Flood risk data for a postcode area.

    Attributes:
        id: Auto-incrementing primary key.
        postcode: Normalised postcode this record applies to.
        area_code: EA flood area ID (fwdCode), e.g. "061FWF30Byfleet".
        label: Short area name, e.g. "River Wey at Wisley and Byfleet".
        description: Full description of the flood area.
        county: County name, e.g. "Surrey".
        river_or_sea: Water body name, e.g. "River Wey".
        area_lat: Latitude of the flood area centre.
        area_lng: Longitude of the flood area centre.
        distance_km: Distance from postcode to flood area centre in km.
        current_severity: Active warning severity level (1-4), None if no warning.
        severity_label: Human readable severity label.
        message: Current warning message text.
        last_updated: When this record was last refreshed by the pipeline.
    """

    __tablename__ = "flood_risk"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    postcode: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    area_code: Mapped[str] = mapped_column(String(50), nullable=False)
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    county: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    river_or_sea: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    area_lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    area_lng: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    distance_km: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    current_severity: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    severity_label: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_updated: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    def __repr__(self) -> str:
        return (
            f"<FloodRisk id={self.id} postcode={self.postcode} "
            f"area={self.area_code} severity={self.current_severity}>"
        )
