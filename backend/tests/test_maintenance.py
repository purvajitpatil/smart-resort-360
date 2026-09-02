"""Predictive maintenance: systemic fault patterns from repeated complaints."""

from __future__ import annotations

from tests._support import make_world, register

AC_TITLES = [
    "AC not cooling",
    "Aircon blowing warm",
    "Room not cooling at night",
    "AC compressor noisy",
]


def _create(client, guest, title: str) -> str:
    res = client.post(
        "/api/v1/requests",
        headers=guest["headers"],
        json={"category": "Maintenance", "title": title, "priority": "MEDIUM"},
    )
    assert res.status_code == 200, res.text
    return res.json()["data"]["code"]


def test_below_threshold_no_alert(client):
    guest = register(client, "m1@test.dev")
    staff = register(client, "m1staff@test.dev", role="STAFF")
    make_world(client, guest, staff)

    # 2 AC complaints in the window => still under threshold (3)
    for title in AC_TITLES[:2]:
        _create(client, guest, title)

    res = client.get("/api/v1/hotel/maintenance/alerts", headers=staff["headers"])
    assert res.status_code == 200
    alerts = res.json()["data"]["alerts"]
    assert [a for a in alerts if a["fault"] == "AC"] == []


def test_alert_triggered_at_threshold(client):
    guest = register(client, "m2@test.dev")
    staff = register(client, "m2staff@test.dev", role="STAFF")
    make_world(client, guest, staff)

    for title in AC_TITLES:
        _create(client, guest, title)

    res = client.get("/api/v1/hotel/maintenance/alerts", headers=staff["headers"])
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["total"] == 1

    ac = data["alerts"][0]
    assert ac["fault"] == "AC"
    assert ac["count"] == 4
    assert ac["severity"] == "MEDIUM"
    assert len(ac["request_codes"]) == 4
    assert "Inspect the central AC plant" in ac["action"]
    assert str(ac["count"]) in ac["alert"]


def test_high_volume_escalates_severity(client):
    guest = register(client, "m3@test.dev")
    staff = register(client, "m3staff@test.dev", role="STAFF")
    make_world(client, guest, staff)

    for title in AC_TITLES + ["Aircon not working", "Cooling weak in room 5"]:
        _create(client, guest, title)

    res = client.get("/api/v1/hotel/maintenance/alerts", headers=staff["headers"])
    assert res.status_code == 200
    ac = [a for a in res.json()["data"]["alerts"] if a["fault"] == "AC"]
    assert ac and ac[0]["severity"] == "HIGH"


def test_maintenance_endpoint_staff_only(client):
    guest = register(client, "m4@test.dev")
    staff = register(client, "m4staff@test.dev", role="STAFF")
    make_world(client, guest, staff)

    blocked = client.get("/api/v1/hotel/maintenance/alerts", headers=guest["headers"])
    assert blocked.status_code == 403
    ok = client.get("/api/v1/hotel/maintenance/alerts", headers=staff["headers"])
    assert ok.status_code == 200
