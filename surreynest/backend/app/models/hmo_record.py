"""ORM model for the `hmo_records` table.

Houses in Multiple Occupation from Guildford Borough Council public register.
A property can appear here with is_active=False (expired licence) or not at all
(potentially unlicensed — both cases are flagged in the UI).
"""


from typing import Optional

from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class HmoRecord(Base):
    """Guildford HMO register entry.

    Attributes:
        id: Auto-incrementing integer primary key.
        uprn: Optional FK to properties.uprn — populated if a match is found.
        raw_address: Original address string from the HMO register.
        postcode: Extracted from raw_address via regex (r'GU\\d{1,2}\\s?\\d[A-Z]{2}').
        lat: Geocoded latitude via Postcodes.io.
        lng: Geocoded longitude via Postcodes.io.
        licence_number: Official GBC licence number.
        max_occupants: Maximum permitted occupants.
        licence_holder: Name of licence holder.
        expiry_date: Licence expiry date.
        is_active: True when expiry_date > today. Recomputed on each pipeline run.
        last_updated: When this row was last written by the pipeline.
    """

    __tablename__ = "hmo_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    uprn: Mapped[Optional[str]] = mapped_column(
        String(20),
        ForeignKey("properties.uprn", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    raw_address: Mapped[str] = mapped_column(String(500), nullable=False)
    postcode: Mapped[Optional[str]] = mapped_column(String(10), nullable=True, index=True)
    lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    lng: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    licence_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    max_occupants: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    licence_holder: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    expiry_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )
    last_updated: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    def __repr__(self) -> str:
        return (
            f"<HmoRecord id={self.id} postcode={self.postcode} "
            f"is_active={self.is_active}>"
        )
