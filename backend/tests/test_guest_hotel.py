"""Guest profile/preferences, current stay, hotel overview/rooms."""

from __future__ import annotations

from tests._support import make_world, register


def test_guest_me_creates_profile(client):
    guest = register(client, "g1@test.dev")
    res = client.get("/api/v1/guest/me", headers=guest["headers"])
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["full_name"] == "Test GUEST"
    assert data["preferences"]["interests"] == []
    assert data["preferences"]["budget"] == "medium"


def test_guest_stay_requires_active_stay(client):
    guest = register(client, "g2@test.dev")
    res = client.get("/api/v1/guest/stay/current", headers=guest["headers"])
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "NO_ACTIVE_STAY"


def test_guest_preferences_update(client):
    guest = register(client, "g3@test.dev")
    res = client.put(
        "/api/v1/guest/preferences",
        headers=guest["headers"],
        json={"interests": ["heritage", "food"], "budget": "luxury", "pace": "relaxed"},
    )
    assert res.status_code == 200
    prefs = res.json()["data"]["preferences"]
    assert prefs["interests"] == ["heritage", "food"]
    assert prefs["budget"] == "luxury"
    assert prefs["pace"] == "relaxed"


def test_current_stay_returns_room_and_hotel(client):
    guest = register(client, "g4@test.dev")
    make_world(client, guest)
    res = client.get("/api/v1/guest/stay/current", headers=guest["headers"])
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["room"]["number"] == "101"
    assert data["hotel_name"] == "Test Palace"
    assert data["status"] == "ACTIVE"
    assert data["days_remaining"] == 3
    assert data["checkout_today"] is False


def test_hotel_overview_staff_only(client):
    guest = register(client, "g5@test.dev")
    staff = register(client, "s1@test.dev", role="STAFF")
    make_world(client, guest, staff)
    res = client.get("/api/v1/hotel/overview", headers=staff["headers"])
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["total_rooms"] == 1
    assert data["rooms_by_status"]["OCCUPIED"] == 1
    assert data["active_stays"] == 1
    assert data["occupancy_pct"] == 100.0

    res = client.get("/api/v1/hotel/overview", headers=guest["headers"])
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "FORBIDDEN"


def test_hotel_rooms_staff_only_with_filter(client):
    guest = register(client, "g6@test.dev")
    staff = register(client, "s2@test.dev", role="STAFF")
    make_world(client, guest, staff)
    res = client.get("/api/v1/hotel/rooms?status=OCCUPIED", headers=staff["headers"])
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["count"] == 1
    assert data["items"][0]["number"] == "101"

    res = client.get("/api/v1/hotel/rooms?status=DIRTY", headers=staff["headers"])
    assert res.status_code == 200
    assert res.json()["data"]["count"] == 0
