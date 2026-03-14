"""ORM model for the `properties` table.

Core property records sourced from the EPC register.
Spatial queries use PostGIS via a GIST index on (lat, lng).
"""


from typing import Optional

from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, Float, Integer, String, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Property(Base):
    """EPC-sourced property record.

    Attributes:
        uprn: Unique Property Reference Number — primary key from EPC.
        address: Full street address as in EPC.
        postcode: Normalised uppercase with single space, e.g. "GU2 7XH".
        lat: Latitude — populated by geocoding pipeline.
        lng: Longitude — populated by geocoding pipeline.
        property_type: Normalised to Flat / Terraced / Semi-Detached / Detached / Other.
        built_form: Raw EPC built form description.
        floor_area_m2: Total floor area in m² (TOTAL-FLOOR-AREA from EPC).
        num_rooms: Habitable room count (NUMBER-HABITABLE-ROOMS from EPC).
        energy_rating: Current EPC rating A–G.
        potential_rating: Potential EPC rating A–G if improvements made.
        epc_date: Date the EPC was lodged.
        tenure: Tenure description from EPC.
        created_at: UTC timestamp of first insert.
        updated_at: UTC timestamp of last pipeline update.
    """

    __tablename__ = "properties"

    uprn: Mapped[str] = mapped_column(
        String(20),
        primary_key=True,
        nullable=False,
    )
    address: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )
    postcode: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        index=True,
    )
    lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    lng: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    property_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    built_form: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    floor_area_m2: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    num_rooms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    energy_rating: Mapped[Optional[str]] = mapped_column(String(1), nullable=True)
    potential_rating: Mapped[Optional[str]] = mapped_column(String(1), nullable=True)
    epc_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    tenure: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    # v3.3.0 ML features — populated by EPC pipeline from raw certificates.csv
    construction_age_band: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True
    )
    mains_gas_flag: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    floor_level: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    annual_energy_cost: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    # v4.0.0 Scraped features — populated by scraped_rent_pipeline.py
    actual_market_rent_weekly: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    price_drop_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # v4.1.0: Real bedrooms ground truth
    actual_bedrooms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # v4.2.0: University-managed accommodation flag
    is_university_managed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    is_university: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # PostGIS GIST spatial index — enables ST_DWithin radius queries.
    # Note: a plain composite index is defined here; the DBA step
    # `CREATE INDEX ... USING GIST (ST_Point(lng, lat))` is handled in
    # the Alembic migration for full spatial support.
    __table_args__ = (
        Index("ix_properties_lat_lng", "lat", "lng"),
    )

    def __repr__(self) -> str:
        return f"<Property uprn={self.uprn} postcode={self.postcode}>"
