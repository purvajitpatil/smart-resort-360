"""Health endpoint tests — must never require seed data."""

from __future__ import annotations


def test_health_ok(client) -> None:
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["error"] is None
    assert body["data"]["status"] == "healthy"
    assert body["data"]["demo_mode"] is True
    assert body["data"]["counts"] is not None
    assert "pois" in body["data"]["counts"]


def test_root_info(client) -> None:
    resp = client.get("/")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["docs"] == "/docs"
    assert data["health"] == "/api/v1/health"


def test_unknown_route_is_envelope_404(client) -> None:
    resp = client.get("/api/v1/nope")
    assert resp.status_code == 404
    body = resp.json()
    assert body["success"] is False
    assert body["error"]["code"] == "ERROR"
