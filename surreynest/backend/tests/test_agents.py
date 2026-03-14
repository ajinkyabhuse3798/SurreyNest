"""Tests for the letting agents API endpoints."""

import pytest
from fastapi.testclient import TestClient


def test_list_agents_empty(client):
    """GET /api/agents returns empty list when no reviews with agent_name exist."""
    response = client.get("/api/agents")
    assert response.status_code == 200
    assert response.json() == []


def test_suggest_agents_empty(client):
    """GET /api/agents/suggest returns empty list when no agents match."""
    response = client.get("/api/agents/suggest?q=xyz_nonexistent")
    assert response.status_code == 200
    assert response.json() == []


def test_suggest_requires_q(client):
    """GET /api/agents/suggest without q returns 422."""
    response = client.get("/api/agents/suggest")
    assert response.status_code == 422


def test_get_agent_not_found(client):
    """GET /api/agents/{name} returns 404 when no reviews exist."""
    response = client.get("/api/agents/nonexistent-agent-xyz")
    assert response.status_code == 404


def test_suggest_before_agent_name_path(client):
    """Ensure /api/agents/suggest is not treated as /{agent_name}='suggest'."""
    # This would 404 if routing is wrong (suggest treated as an agent name)
    response = client.get("/api/agents/suggest?q=test")
    assert response.status_code == 200  # Not 404
    assert isinstance(response.json(), list)
