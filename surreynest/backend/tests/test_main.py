"""Tests for FastAPI application setup: health check, CORS, exception handler, metadata."""

import pytest
from fastapi.testclient import TestClient

from app.main import app


# ── Health check ──────────────────────────────────────────────────────────────
def test_health_check_returns_ok(client: TestClient) -> None:
    """GET /health returns 200 with status ok and environment."""
    response = client.get("/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "environment" in data


# ── CORS headers ──────────────────────────────────────────────────────────────
def test_cors_headers_present(client: TestClient) -> None:
    """Preflight OPTIONS request returns CORS allow-origin header."""
    response = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert "access-control-allow-origin" in response.headers


# ── Global exception handler ─────────────────────────────────────────────────
def test_global_exception_handler_returns_500() -> None:
    """Unhandled exception in a route returns clean 500 JSON."""

    # Temporarily add a broken route
    @app.get("/test-broken-route")
    async def broken():
        raise RuntimeError("deliberate test error")

    # Use raise_server_exceptions=False so TestClient doesn't re-raise
    with TestClient(app, raise_server_exceptions=False) as c:
        response = c.get("/test-broken-route")

    assert response.status_code == 500
    assert response.json() == {"detail": "Internal server error"}

    # Clean up: remove the test route
    app.routes[:] = [r for r in app.routes if getattr(r, "path", "") != "/test-broken-route"]


# ── App metadata ──────────────────────────────────────────────────────────────
def test_app_metadata() -> None:
    """FastAPI app has correct title and version."""
    assert app.title == "SurreyNest API"
    assert app.version == "1.0.0"


# ── All routers mounted ──────────────────────────────────────────────────────
def test_all_routers_mounted() -> None:
    """All 5 API routers are mounted under /api prefix."""
    route_paths = [getattr(r, "path", "") for r in app.routes]

    # Check that at least one route exists for each router prefix
    expected_prefixes = [
        "/api/auth/",
        "/api/properties",
        "/api/hmo/",
        "/api/scores/",
        "/api/reviews/",
    ]
    for prefix in expected_prefixes:
        assert any(
            path.startswith(prefix) for path in route_paths
        ), f"No route found with prefix {prefix}"
