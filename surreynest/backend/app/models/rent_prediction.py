"""ORM model for the `rent_predictions` table.

Cached ML model predictions per property. Refreshed weekly by APScheduler.
When the ML model is updated, recompute all predictions via:
    python -m app.ml.predict --all
"""


from typing import Optional

from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class RentPrediction(Base):
    """Cached rent model prediction for a property.

    Attributes:
        uprn: Primary key and FK to properties.uprn.
        predicted_weekly_rent: Model output in £/week.
        confidence_low: Lower bound of the calibrated market band.
        confidence_high: Upper bound of the calibrated market band.
        model_version: Model version string (e.g. "v1.0.0") matching pkl filename.
        computed_at: When this prediction was generated.
    """

    __tablename__ = "rent_predictions"

    uprn: Mapped[str] = mapped_column(
        String(20),
        ForeignKey("properties.uprn", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )
    predicted_weekly_rent: Mapped[float] = mapped_column(Float, nullable=False)
    confidence_low: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    confidence_high: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    model_version: Mapped[str] = mapped_column(String(20), nullable=False)
    computed_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    def __repr__(self) -> str:
        return (
            f"<RentPrediction uprn={self.uprn} "
            f"predicted=£{self.predicted_weekly_rent:.2f}/wk "
            f"version={self.model_version}>"
        )
