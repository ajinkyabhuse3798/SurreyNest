"""ORM model for the `properties` table.

Core property records sourced from the EPC register.
Spatial queries use PostGIS via a GIST index on (lat, lng).
"""

from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, Integer, String, Index
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
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    property_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    built_form: Mapped[str | None] = mapped_column(String(50), nullable=True)
    floor_area_m2: Mapped[float | None] = mapped_column(Float, nullable=True)
    num_rooms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    energy_rating: Mapped[str | None] = mapped_column(String(1), nullable=True)
    potential_rating: Mapped[str | None] = mapped_column(String(1), nullable=True)
    epc_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    tenure: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
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
