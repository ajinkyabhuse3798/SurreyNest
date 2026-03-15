"""Admin pipeline management endpoints.

Provides:
    GET  /api/admin/pipelines/status          — last run per pipeline
    POST /api/admin/pipelines/{name}/trigger   — manually trigger a pipeline
"""

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.pipeline_run import PipelineRun
from app.services.auth_service import require_admin

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Response schemas ──────────────────────────────────────────────────────────


class PipelineStatusResponse(BaseModel):
    """Status of the last run for a single pipeline."""

    pipeline_name: str
    status: str
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    rows_processed: Optional[int] = None
    error_message: Optional[str] = None

    class Config:
        from_attributes = True


class TriggerResponse(BaseModel):
    """Response for a manual pipeline trigger."""

    message: str
    pipeline_name: str


# ── Known pipelines ──────────────────────────────────────────────────────────
KNOWN_PIPELINES = [
    "crime_pipeline",
    "hmo_pipeline",
    "epc_pipeline",
    "land_registry_pipeline",
    "flood_pipeline",
]


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.get(
    "/admin/pipelines/status",
    response_model=list[PipelineStatusResponse],
    summary="Pipeline status (admin)",
)
async def get_pipeline_status(
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
) -> list[PipelineStatusResponse]:
    """Return the most recent run for each known pipeline.

    Returns an entry for every pipeline even if it has never run
    (status will be 'never_run').
    """
    results: list[PipelineStatusResponse] = []

    # Subquery: max started_at per pipeline_name
    latest_subq = (
        db.query(
            PipelineRun.pipeline_name,
            func.max(PipelineRun.started_at).label("max_started"),
        )
        .filter(PipelineRun.pipeline_name.in_(KNOWN_PIPELINES))
        .group_by(PipelineRun.pipeline_name)
        .subquery()
    )

    # Join to get full row for each latest run
    latest_runs = (
        db.query(PipelineRun)
        .join(
            latest_subq,
            (PipelineRun.pipeline_name == latest_subq.c.pipeline_name)
            & (PipelineRun.started_at == latest_subq.c.max_started),
        )
        .all()
    )

    found = {r.pipeline_name: r for r in latest_runs}

    for name in KNOWN_PIPELINES:
        run = found.get(name)
        if run:
            results.append(
                PipelineStatusResponse(
                    pipeline_name=run.pipeline_name,
                    status=run.status,
                    started_at=run.started_at,
                    finished_at=run.finished_at,
                    rows_processed=run.rows_processed,
                    error_message=run.error_message,
                )
            )
        else:
            results.append(
                PipelineStatusResponse(
                    pipeline_name=name,
                    status="never_run",
                )
            )

    return results


@router.post(
    "/admin/pipelines/{pipeline_name}/trigger",
    response_model=TriggerResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Trigger pipeline (admin)",
)
async def trigger_pipeline(
    pipeline_name: str,
    _admin=Depends(require_admin),
) -> TriggerResponse:
    """Manually trigger a pipeline to run in the background.

    Args:
        pipeline_name: One of: crime, hmo, epc, land_registry.
    """
    from app.data_pipelines.scheduler import trigger_pipeline as do_trigger

    if not do_trigger(pipeline_name):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown pipeline: '{pipeline_name}'. "
            f"Valid names: {KNOWN_PIPELINES}",
        )

    return TriggerResponse(
        message=f"Pipeline '{pipeline_name}' triggered — check status endpoint for progress.",
        pipeline_name=pipeline_name,
    )
