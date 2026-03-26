"""ORM model for the `voa_rent_bands` table.

Stores ONS Private Rental Market Summary Statistics median rents by local
authority and bedroom count.  Used in the rent prediction ML model as a
ground-truth anchor when MODE B training is active.
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, Float, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class VoaRentBand(Base):
    """ONS PRMS median rents by local authority and bedroom count.

    Attributes:
        id: Auto-incrementing primary key.
        local_authority_code: ONS LA code, e.g. ``"E07000209"``.
        local_authority_name: Human-readable name, e.g. ``"Guildford"``.
        bedroom_count: Number of bedrooms (1 to 5; 5 represents 5+ bedrooms).
        monthly_rent: Median monthly rent in £ as published by ONS.
        weekly_rent: ``monthly_rent / 4.333``, derived weekly equivalent.
        source_sheet: XLS sheet name for audit trail, e.g. ``"Table 2.7"``.
        updated_at: Last pipeline update timestamp (UTC).
    """

    __tablename__ = "voa_rent_bands"
    __table_args__ = (
        UniqueConstraint(
            "local_authority_code",
            "bedroom_count",
            name="uq_voa_la_bedroom",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    local_authority_code: Mapped[str] = mapped_column(String(20), nullable=False)
    local_authority_name: Mapped[str] = mapped_column(String(100), nullable=False)
    bedroom_count: Mapped[int] = mapped_column(Integer, nullable=False)
    monthly_rent: Mapped[float] = mapped_column(Float, nullable=False)
    weekly_rent: Mapped[float] = mapped_column(Float, nullable=False)
    source_sheet: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    def __repr__(self) -> str:
        return (
            f"<VoaRentBand {self.local_authority_code} "
            f"beds={self.bedroom_count} weekly=£{self.weekly_rent:.2f}>"
        )
