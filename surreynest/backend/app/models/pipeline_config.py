"""ORM model for the `pipeline_config` key-value table.

Stores live configuration values written by data pipelines and read by
services at inference time. Eliminates hardcoded constants that drift
when pipelines re-run with updated source data.

Example keys:
    - ``iphrp_growth_pct``: Latest South East IPHRP annual % from ONS.
    - ``land_registry_yield``: Gross yield used to derive implied rents.
"""

from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PipelineConfig(Base):
    """Single-row-per-key config store written by pipelines, read by services.

    Attributes:
        key: Unique config key, e.g. "iphrp_growth_pct".
        value: Numeric value.
        description: Human-readable explanation of what this key stores.
        updated_at: When the pipeline last wrote this value.
        source: Which pipeline or script wrote this (for audit).
    """

    __tablename__ = "pipeline_config"

    key: Mapped[str] = mapped_column(
        String(100), primary_key=True, nullable=False
    )
    value: Mapped[float] = mapped_column(Float, nullable=False)
    description: Mapped[str] = mapped_column(
        Text, nullable=True, default=""
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    source: Mapped[str] = mapped_column(
        String(100), nullable=False, default="manual"
    )

    def __repr__(self) -> str:
        return f"<PipelineConfig key={self.key!r} value={self.value} updated={self.updated_at}>"
