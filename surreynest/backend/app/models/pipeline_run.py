"""ORM model for the `pipeline_runs` audit log table.

Records every execution of a data pipeline job — start time, finish time,
row count, and error messages. Used for monitoring and debugging.
"""


from typing import Optional

from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PipelineRun(Base):
    """Audit record for a single pipeline execution.

    Attributes:
        id: Auto-incrementing primary key.
        pipeline_name: Identifier, e.g. "epc_pipeline", "crime_pipeline".
        started_at: When the job started.
        finished_at: When the job finished — None if still running or crashed.
        status: One of "running", "success", "failed".
        rows_processed: Number of rows upserted (None if failed before completion).
        error_message: Full error + stack trace if status is "failed".
    """

    __tablename__ = "pipeline_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    pipeline_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="running",
        server_default="running",
    )
    rows_processed: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return (
            f"<PipelineRun id={self.id} pipeline={self.pipeline_name} "
            f"status={self.status}>"
        )
