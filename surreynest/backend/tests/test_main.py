"""Tests for FastAPI application setup: health check, CORS, exception handler, metadata."""

from fastapi.testclient import TestClient

from app.main import app


# ── Health check ──────────────────────────────────────────────────────────────
def test_health_check_returns_ok(client: TestClient) -> None:
    """GET /health returns the public minimal health payload."""
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_deep_health_requires_internal_admin_key(client: TestClient) -> None:
    """GET /health?deep=true is not public."""
    response = client.get("/health?deep=true")

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid or missing internal admin key"}


def test_deep_health_returns_diagnostics_with_internal_key(
    client: TestClient, internal_admin_headers: dict[str, str]
) -> None:
    """GET /health?deep=true returns diagnostics for internal callers."""
    response = client.get("/health?deep=true", headers=internal_admin_headers)

    assert response.status_code == 200
    data = response.json()
    assert data["status"] in {"ok", "degraded"}
    assert "environment" in data
    assert "database" in data
    assert "redis" in data
    assert "ml_model" in data


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


def test_security_headers_present_on_normal_response(client: TestClient) -> None:
    """Normal API responses include the configured hardening headers."""
    response = client.get("/health")

    assert response.status_code == 200
    assert (
        response.headers["strict-transport-security"]
        == "max-age=31536000; includeSubDomains"
    )
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "strict-origin-when-cross-origin"
    assert (
        response.headers["permissions-policy"]
        == "camera=(), microphone=(), geolocation=()"
    )
    assert (
        response.headers["content-security-policy"]
        == "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
    )
    assert response.headers["x-content-type-options"] == "nosniff"


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
    app.routes[:] = [
        r for r in app.routes if getattr(r, "path", "") != "/test-broken-route"
    ]


# ── App metadata ──────────────────────────────────────────────────────────────
def test_app_metadata() -> None:
    """FastAPI app has correct title and version."""
    assert app.title == "SurreyNest API"
    assert app.version == "1.0.0"


# ── All routers mounted ──────────────────────────────────────────────────────
def test_public_and_internal_routers_mounted() -> None:
    """Only the supported public and internal-ops routers should be mounted."""
    route_paths = [getattr(r, "path", "") for r in app.routes]

    expected_prefixes = [
        "/api/properties",
        "/api/hmo/",
        "/api/scores/",
        "/api/reviews/",
        "/api/admin/reviews/",
        "/api/admin/pipelines/",
    ]
    for prefix in expected_prefixes:
        assert any(
            path.startswith(prefix) for path in route_paths
        ), f"No route found with prefix {prefix}"

    removed_prefixes = [
        "/api/auth/",
        "/api/admin/stats/",
        "/api/admin/users",
    ]
    for prefix in removed_prefixes:
        assert not any(
            path.startswith(prefix) for path in route_paths
        ), f"Legacy route still mounted for prefix {prefix}"
