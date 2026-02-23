"""ORM model for the `postcode_cache` table.

Caches Postcodes.io API results to avoid repeat calls.
Always check this table before hitting the external API.
If is_valid=False, do not retry — postcode is terminated or invalid.
"""


from typing import Optional

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PostcodeCache(Base):
    """Cached geocoding result from Postcodes.io.

    Attributes:
        postcode: Primary key — normalised uppercase (e.g. "GU2 7XH").
        lat: Latitude.
        lng: Longitude.
        ward: Electoral ward name (optional).
        district: Admin district name (optional).
        is_valid: False if Postcodes.io returned no result for this postcode.
        cached_at: When this entry was stored.
    """

    __tablename__ = "postcode_cache"

    postcode: Mapped[str] = mapped_column(
        String(10),
        primary_key=True,
        nullable=False,
    )
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    ward: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    district: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_valid: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )
    cached_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    def __repr__(self) -> str:
        return f"<PostcodeCache postcode={self.postcode} is_valid={self.is_valid}>"
