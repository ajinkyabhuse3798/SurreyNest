"""Tests for internal-only pipeline control endpoints."""

from datetime import datetime, timezone

from app.data_pipelines import scheduler
from app.models.pipeline_run import PipelineRun


def test_pipeline_status_requires_internal_admin_key(client):
    """Pipeline status is no longer reachable with public access."""
    response = client.get("/api/admin/pipelines/status")
    assert response.status_code == 401


def test_pipeline_status_allows_internal_admin_key(client, db, internal_admin_headers):
    """Internal admin key grants access to pipeline status."""
    db.add(
        PipelineRun(
            pipeline_name="epc_pipeline",
            status="success",
            started_at=datetime.now(timezone.utc),
            finished_at=datetime.now(timezone.utc),
            rows_processed=42,
        )
    )
    db.flush()

    response = client.get(
        "/api/admin/pipelines/status",
        headers=internal_admin_headers,
    )

    assert response.status_code == 200
    assert any(item["pipeline_name"] == "epc_pipeline" for item in response.json())


def test_trigger_pipeline_allows_internal_admin_key(
    client, monkeypatch, internal_admin_headers
):
    """Internal admin key can trigger a known pipeline."""
    monkeypatch.setattr(scheduler, "trigger_pipeline", lambda pipeline_name: True)

    response = client.post(
        "/api/admin/pipelines/epc_pipeline/trigger",
        headers=internal_admin_headers,
    )

    assert response.status_code == 202
    assert response.json()["pipeline_name"] == "epc_pipeline"
