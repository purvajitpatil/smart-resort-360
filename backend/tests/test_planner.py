"""Constraint-optimized itinerary planner + disruption replanning."""

from __future__ import annotations

import re
from datetime import date

from app.models.travel import POI, DisruptionEvent, WeatherEvent
from tests._support import make_world, register


def _db(client):
    return client.app.state.session_local()


def _payload(days: int = 2):
    return {
        "start_date": date.today().isoformat(),
        "days": days,
        "start_time": "09:00",
        "end_time": "21:00",
    }


def test_staff_cannot_build_guest_itinerary(client):
    staff = register(client, "p1@test.dev", role="STAFF")
    res = client.post("/api/v1/itineraries", headers=staff["headers"], json=_payload())
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "FORBIDDEN"


def test_create_and_list_itinerary(client):
    guest = register(client, "p2@test.dev")
    make_world(client, guest)
    res = client.post("/api/v1/itineraries", headers=guest["headers"], json=_payload())
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data["replanned"] is False
    assert data["score"] > 0
    assert data["explanation"]
    assert data["weights"]["pace"] == "moderate"
    assert len(data["days"]) == 2
    for day in data["days"]:
        assert day["stops"], "each day must contain planned stops"
        for stop in day["stops"]:
            assert re.fullmatch(r"\d{2}:\d{2}", stop["start_time"])
            assert stop["end_time"] > stop["start_time"]
            assert stop["travel_minutes"] >= 0
            assert stop["distance_km"] > 0
            assert stop["status"] in ("PLANNED", "REPLACED")

    res = client.get("/api/v1/itineraries", headers=guest["headers"])
    assert res.status_code == 200
    assert res.json()["data"]["total"] == 1


def test_closed_day_poi_is_skipped(client):
    guest = register(client, "p3@test.dev")
    make_world(client, guest)
    db = _db(client)
    today = date.today()
    db.add(
        POI(
            city="Jaipur",
            name="Weekly Day Shrine",
            category="Religious",
            lat=26.9,
            lng=75.8,
            open_time="08:00",
            close_time="20:00",
            closed_days=[today.weekday()],
            visit_minutes=90,
            rating=5.0,
            popularity=1.0,
            local_discovery=0.9,
            weather_sensitivity="LOW",
        )
    )
    db.commit()
    db.close()

    res = client.post("/api/v1/itineraries", headers=guest["headers"], json=_payload())
    data = res.json()["data"]
    today_names = [s["name"] for s in data["days"][0]["stops"]]
    assert "Weekly Day Shrine" not in today_names


def test_weather_capture_blocks_sensitive_outdoor_and_enables_replan(client):
    guest = register(client, "p4@test.dev", role="GUEST")
    staff = register(client, "p4s@test.dev", role="STAFF")
    make_world(client, guest, staff)

    db = _db(client)
    db.add_all(
        [
            POI(
                city="Jaipur",
                name="Albert Hall Museum",
                category="Museum",
                lat=26.9116,
                lng=75.8203,
                open_time="09:00",
                close_time="20:00",
                visit_minutes=90,
                rating=4.7,
                popularity=0.85,
                local_discovery=0.5,
                weather_sensitivity="LOW",
                indoor=True,
                outdoor=False,
            ),
            POI(
                city="Jaipur",
                name="Saffron Restaurant",
                category="Food",
                lat=26.9218,
                lng=75.8302,
                open_time="11:00",
                close_time="23:00",
                visit_minutes=60,
                rating=4.3,
                popularity=0.8,
                local_discovery=0.4,
                weather_sensitivity="LOW",
                indoor=True,
                outdoor=False,
            ),
            POI(
                city="Jaipur",
                name="Jantar Mantar Observatory",
                category="Heritage",
                lat=26.9247,
                lng=75.8247,
                open_time="09:00",
                close_time="17:00",
                visit_minutes=80,
                rating=4.5,
                popularity=0.9,
                local_discovery=0.6,
                weather_sensitivity="LOW",
                indoor=True,
                outdoor=False,
            ),
            POI(
                city="Jaipur",
                name="Raj Mandir Cinema",
                category="Entertainment",
                lat=26.9140,
                lng=75.8205,
                open_time="13:00",
                close_time="23:00",
                visit_minutes=150,
                rating=4.6,
                popularity=0.86,
                local_discovery=0.5,
                weather_sensitivity="LOW",
                indoor=True,
                outdoor=False,
            ),
        ]
    )
    db.commit()
    db.close()

    res = client.post(
        "/api/v1/weather/capture",
        headers=staff["headers"],
        json={"condition": "heavy rain", "temp_c": 26, "precip_mm": 14, "wind_kmh": 30},
    )
    assert res.status_code == 200, res.text
    weather = res.json()["data"]
    assert weather["id"] > 0
    assert weather["condition"] == "heavy rain"

    db = _db(client)
    assert db.query(WeatherEvent).count() == 1
    db.close()

    res = client.post("/api/v1/itineraries", headers=guest["headers"], json=_payload())
    data = res.json()["data"]
    all_names = [s["name"] for day in data["days"] for s in day["stops"]]
    assert "Amber Fort" not in all_names, "rain should remove the high-sensitivity outdoor fort"
    assert len(data["days"][1]["stops"]) >= 2, "day 2 must have stops to rework"

    target_stop = data["days"][1]["stops"][0]
    res = client.post(
        f"/api/v1/itineraries/{data['id']}/replan",
        headers=guest["headers"],
        json={
            "event_type": "WEATHER",
            "severity": "HIGH",
            "message": "Heavy rain until 15:00",
            "affected_stop_ids": [target_stop["id"]],
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["meta"]["replanned"] is True
    assert body["meta"]["changes"] >= 1
    assert body["meta"]["disruption"]["affected_stop_ids"] == [target_stop["id"]]
    assert body["data"]["replanned"] is True

    statuses = {s["id"]: s["status"] for day in body["data"]["days"] for s in day["stops"]}
    assert statuses[target_stop["id"]] == "REMOVED"
    assert any(s == "REPLACED" for s in statuses.values())

    db = _db(client)
    assert db.query(DisruptionEvent).count() == 1
    assert db.query(DisruptionEvent).first().message == "Heavy rain until 15:00"
    db.close()


def test_replan_requires_affected_targets(client):
    guest = register(client, "p5@test.dev")
    make_world(client, guest)
    res = client.post("/api/v1/itineraries", headers=guest["headers"], json=_payload())
    itin_id = res.json()["data"]["id"]
    res = client.post(
        f"/api/v1/itineraries/{itin_id}/replan",
        headers=guest["headers"],
        json={"message": "Something happened"},
    )
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "INVALID_DISRUPTION"


def test_guest_cannot_manage_others_itinerary(client):
    guest_a = register(client, "p6@test.dev")
    guest_b = register(client, "p7@test.dev")
    make_world(client, guest_a)
    res = client.post("/api/v1/itineraries", headers=guest_a["headers"], json=_payload())
    itin_id = res.json()["data"]["id"]

    res = client.get(f"/api/v1/itineraries/{itin_id}", headers=guest_b["headers"])
    assert res.status_code == 403

    res = client.delete(f"/api/v1/itineraries/{itin_id}", headers=guest_b["headers"])
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "FORBIDDEN"


def test_delete_itinerary(client):
    guest = register(client, "p8@test.dev")
    make_world(client, guest)
    res = client.post("/api/v1/itineraries", headers=guest["headers"], json=_payload())
    itin_id = res.json()["data"]["id"]

    res = client.delete(f"/api/v1/itineraries/{itin_id}", headers=guest["headers"])
    assert res.status_code == 200
    assert res.json()["data"]["deleted"] == itin_id

    res = client.get("/api/v1/itineraries", headers=guest["headers"])
    assert res.json()["data"]["total"] == 0

    res = client.delete(f"/api/v1/itineraries/{itin_id}", headers=guest["headers"])
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "ITINERARY_NOT_FOUND"


def test_invalid_day_range(client):
    guest = register(client, "p9@test.dev")
    make_world(client, guest)
    payload = _payload()
    payload["days"] = 8
    res = client.post("/api/v1/itineraries", headers=guest["headers"], json=payload)
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "INVALID_DAY_RANGE"
