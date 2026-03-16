"""APScheduler job registration for automated pipeline runs.

Registers cron-triggered jobs for each data pipeline:
    - Crime pipeline: nightly at 3:00 AM
    - HMO pipeline: weekly Monday at 2:00 AM
    - EPC pipeline: monthly 1st at 2:00 AM
    - Land Registry pipeline: monthly 1st at 3:00 AM
    - Flood pipeline: weekly Tuesday at 4:00 AM

All jobs run synchronously in a thread pool executor so they don't block
the async event loop. Each job uses ``run_pipeline_with_tracking`` which
writes audit records to the ``pipeline_runs`` table.
"""

import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.data_pipelines.utils import run_pipeline_with_tracking

logger = logging.getLogger(__name__)

# Thread pool for running synchronous pipelines off the event loop
_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="pipeline")


# ── Pipeline wrappers ─────────────────────────────────────────────────────────
# Each wrapper imports its pipeline at call time to avoid circular imports
# and heavy module loads at startup.


def _run_crime() -> None:
    """Run the crime pipeline with tracking."""
    from app.data_pipelines.crime_pipeline import run_crime_pipeline

    run_pipeline_with_tracking("crime_pipeline", run_crime_pipeline)


def _run_hmo() -> None:
    """Run the HMO pipeline with tracking."""
    from app.data_pipelines.hmo_pipeline import run_hmo_pipeline

    run_pipeline_with_tracking("hmo_pipeline", run_hmo_pipeline)


def _run_epc() -> None:
    """Run the EPC pipeline with tracking."""
    from app.data_pipelines.epc_pipeline import run_epc_pipeline

    run_pipeline_with_tracking("epc_pipeline", run_epc_pipeline)


def _run_land_registry() -> None:
    """Run the Land Registry pipeline with tracking."""
    from app.data_pipelines.land_registry_pipeline import run_land_registry_pipeline

    run_pipeline_with_tracking("land_registry_pipeline", run_land_registry_pipeline)


def _run_flood() -> None:
    """Run the flood risk pipeline with tracking."""
    from app.data_pipelines.flood_pipeline import run_flood_pipeline

    run_pipeline_with_tracking("flood_pipeline", run_flood_pipeline)


# ── Map of pipeline name → runner ─────────────────────────────────────────────
PIPELINE_RUNNERS = {
    "crime_pipeline": _run_crime,
    "hmo_pipeline": _run_hmo,
    "epc_pipeline": _run_epc,
    "land_registry_pipeline": _run_land_registry,
    "flood_pipeline": _run_flood,
}


# ── Async wrapper (runs sync pipeline in thread pool) ─────────────────────────
async def _run_in_thread(fn) -> None:  # type: ignore[no-untyped-def]
    """Execute a sync pipeline function in a thread pool.

    Args:
        fn: Synchronous callable (pipeline wrapper).
    """
    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(_executor, fn)
    except Exception:
        # Error is already logged by run_pipeline_with_tracking
        logger.error("Scheduled pipeline job failed", exc_info=True)


# ── Job registration ──────────────────────────────────────────────────────────
def register_jobs(scheduler: AsyncIOScheduler) -> None:
    """Register all pipeline cron jobs on the scheduler.

    Args:
        scheduler: The APScheduler AsyncIOScheduler instance from main.py.
    """
    # Crime pipeline — nightly at 3:00 AM
    scheduler.add_job(
        _run_in_thread,
        CronTrigger(hour=3, minute=0),
        args=[_run_crime],
        id="crime_pipeline",
        name="Crime pipeline (nightly)",
        replace_existing=True,
        misfire_grace_time=3600,  # 1 hour grace period
    )

    # HMO pipeline — weekly Monday at 2:00 AM
    scheduler.add_job(
        _run_in_thread,
        CronTrigger(day_of_week="mon", hour=2, minute=0),
        args=[_run_hmo],
        id="hmo_pipeline",
        name="HMO pipeline (weekly Monday)",
        replace_existing=True,
        misfire_grace_time=3600,
    )

    # EPC pipeline — monthly 1st at 2:00 AM
    scheduler.add_job(
        _run_in_thread,
        CronTrigger(day=1, hour=2, minute=0),
        args=[_run_epc],
        id="epc_pipeline",
        name="EPC pipeline (monthly 1st)",
        replace_existing=True,
        misfire_grace_time=3600,
    )

    # Land Registry pipeline — monthly 1st at 3:00 AM
    scheduler.add_job(
        _run_in_thread,
        CronTrigger(day=1, hour=3, minute=0),
        args=[_run_land_registry],
        id="land_registry_pipeline",
        name="Land Registry pipeline (monthly 1st)",
        replace_existing=True,
        misfire_grace_time=3600,
    )

    # Flood pipeline — weekly Tuesday at 4:00 AM
    scheduler.add_job(
        _run_in_thread,
        CronTrigger(day_of_week="tue", hour=4, minute=0),
        args=[_run_flood],
        id="flood_pipeline",
        name="Flood pipeline (weekly Tuesday)",
        replace_existing=True,
        misfire_grace_time=3600,
    )

    job_ids = [j.id for j in scheduler.get_jobs()]
    logger.info("Registered %d scheduled pipeline jobs: %s", len(job_ids), job_ids)


def trigger_pipeline(name: str) -> bool:
    """Manually trigger a pipeline in a background thread.

    Args:
        name: Pipeline key — one of: crime, hmo, epc, land_registry, flood.

    Returns:
        True if the pipeline was started, False if name is invalid.
    """
    runner = PIPELINE_RUNNERS.get(name)
    if runner is None:
        return False

    _executor.submit(runner)
    logger.info("Manually triggered pipeline: %s", name)
    return True
