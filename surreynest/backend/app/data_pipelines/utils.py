"""Pipeline utilities: retry logic, structured logging, rate limiter, pipeline run tracking.

Provides reusable helpers for all ETL pipelines:
- api_call_with_retry: exponential backoff HTTP requests
- RateLimiter: configurable requests-per-second throttle
- start_pipeline_run / finish_pipeline_run: audit logging to pipeline_runs table
"""

import logging
import time
import traceback
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import requests
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.pipeline_run import PipelineRun

logger = logging.getLogger(__name__)


def api_call_with_retry(
    url: str,
    params: Optional[Dict[str, Any]] = None,
    method: str = "GET",
    json_body: Optional[Dict[str, Any]] = None,
    max_retries: int = 3,
    timeout: int = 10,
) -> Dict[str, Any]:
    """Make an HTTP request with exponential backoff retry.

    Args:
        url: Target URL.
        params: Query parameters for GET requests.
        method: HTTP method, GET or POST.
        json_body: JSON body for POST requests.
        max_retries: Maximum number of attempts.
        timeout: Request timeout in seconds.

    Returns:
        Parsed JSON response as a dict.

    Raises:
        requests.RequestException: If all retries are exhausted.
    """
    for attempt in range(max_retries):
        try:
            if method.upper() == "POST":
                response = requests.post(
                    url, json=json_body, params=params, timeout=timeout
                )
            else:
                response = requests.get(url, params=params, timeout=timeout)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            if attempt == max_retries - 1:
                logger.error(
                    "API call failed after %d retries: %s %s",
                    max_retries,
                    method,
                    url,
                    exc_info=True,
                )
                raise
            wait_time = 2**attempt  # 1s, 2s, 4s backoff
            logger.warning(
                "API call attempt %d failed, retrying in %ds: %s",
                attempt + 1,
                wait_time,
                str(e),
            )
            time.sleep(wait_time)
    # This should never be reached, but satisfies type checker
    raise requests.RequestException("All retries exhausted")


class RateLimiter:
    """Simple rate limiter using time.sleep between calls.

    Attributes:
        min_interval: Minimum seconds between calls.
        _last_call: Timestamp of last call.

    Example:
        limiter = RateLimiter(requests_per_second=12)
        for url in urls:
            limiter.wait()
            response = requests.get(url)
    """

    def __init__(self, requests_per_second: float = 12.0) -> None:
        """Initialise rate limiter.

        Args:
            requests_per_second: Maximum allowed requests per second.
        """
        self.min_interval: float = 1.0 / requests_per_second
        self._last_call: float = 0.0

    def wait(self) -> None:
        """Block until it is safe to make the next request."""
        elapsed = time.time() - self._last_call
        if elapsed < self.min_interval:
            time.sleep(self.min_interval - elapsed)
        self._last_call = time.time()


def start_pipeline_run(pipeline_name: str, db: Optional[Session] = None) -> int:
    """Record the start of a pipeline execution.

    Args:
        pipeline_name: Identifier, e.g. "epc_pipeline".
        db: Optional existing session. Creates one if not provided.

    Returns:
        The pipeline_run ID for later update.
    """
    own_session = db is None
    if own_session:
        db = SessionLocal()
    try:
        run = PipelineRun(
            pipeline_name=pipeline_name,
            started_at=datetime.now(timezone.utc),
            status="running",
        )
        db.add(run)
        db.commit()
        db.refresh(run)
        logger.info("Pipeline run started: %s (id=%d)", pipeline_name, run.id)
        return run.id
    except Exception:
        db.rollback()
        raise
    finally:
        if own_session:
            db.close()


def finish_pipeline_run(
    run_id: int,
    status: str,
    rows_processed: Optional[int] = None,
    error_message: Optional[str] = None,
    db: Optional[Session] = None,
) -> None:
    """Update a pipeline run record with completion status.

    Args:
        run_id: ID from start_pipeline_run.
        status: "success" or "failed".
        rows_processed: Number of rows upserted.
        error_message: Error details if failed.
        db: Optional existing session. Creates one if not provided.
    """
    own_session = db is None
    if own_session:
        db = SessionLocal()
    try:
        run = db.query(PipelineRun).filter(PipelineRun.id == run_id).first()
        if run:
            run.finished_at = datetime.now(timezone.utc)
            run.status = status
            run.rows_processed = rows_processed
            run.error_message = error_message
            db.commit()
            logger.info(
                "Pipeline run finished: id=%d status=%s rows=%s",
                run_id,
                status,
                rows_processed,
            )
    except Exception:
        db.rollback()
        raise
    finally:
        if own_session:
            db.close()


def run_pipeline_with_tracking(
    pipeline_name: str,
    pipeline_fn: Any,
) -> None:
    """Execute a pipeline function with automatic run tracking.

    Uses separate sessions for tracking and pipeline execution to avoid
    cascading transaction failures.

    Args:
        pipeline_name: Name for the pipeline_runs record.
        pipeline_fn: Callable that accepts a Session and returns rows processed.
    """
    run_id = start_pipeline_run(pipeline_name)
    db = SessionLocal()
    try:
        rows = pipeline_fn(db)
        finish_pipeline_run(run_id, "success", rows_processed=rows)
    except Exception:
        db.rollback()
        error_msg = traceback.format_exc()
        finish_pipeline_run(run_id, "failed", error_message=error_msg)
        logger.error("Pipeline %s failed", pipeline_name, exc_info=True)
        raise
    finally:
        db.close()
