"""POI catalogue + explainable recommendation engine."""

from __future__ import annotations

from tests._support import make_world, register


def test_poi_catalogue(client):
    guest = register(client, "t1@test.dev")
    make_world(client, guest)
    res = client.get("/api/v1/pois", headers=guest["headers"])
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["total"] == 3
    assert all(p["rating"] > 0 for p in data["items"])
    assert data["items"][0]["city"] is not None or data["items"][0]["name"]


def test_poi_catalogue_filters(client):
    guest = register(client, "t2@test.dev")
    make_world(client, guest)
    res = client.get("/api/v1/pois?category=Food", headers=guest["headers"])
    assert res.status_code == 200
    items = res.json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["name"] == "Chokhi Dhani"

    res = client.get("/api/v1/pois?q=fort", headers=guest["headers"])
    assert res.status_code == 200
    assert len(res.json()["data"]["items"]) == 1


def test_poi_detail(client):
    guest = register(client, "t3@test.dev")
    make_world(client, guest)
    from app.models.travel import POI

    db = client.app.state.session_local()
    poi_id = db.query(POI).first().id
    db.close()
    res = client.get(f"/api/v1/pois/{poi_id}", headers=guest["headers"])
    assert res.status_code == 200
    assert res.json()["data"]["name"] == "Amber Fort"

    res = client.get("/api/v1/pois/99999", headers=guest["headers"])
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "POI_NOT_FOUND"


def test_recommendations_ranked_and_explainable(client):
    guest = register(client, "t4@test.dev")
    make_world(client, guest)
    res = client.get("/api/v1/recommendations", headers=guest["headers"])
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["based_on"]
    items = data["items"]
    assert len(items) == 3
    scores = [i["score"] for i in items]
    assert scores == sorted(scores, reverse=True)
    for item in items:
        assert "factors" in item and "reason" in item
        assert set(item["factors"]) >= {"interest", "popularity", "rating", "value", "weather"}
        assert item["reason"]

    # interests set â†’ heritage/food should rank first
    res = client.put(
        "/api/v1/guest/preferences",
        headers=guest["headers"],
        json={"interests": ["heritage", "food"], "budget": "budget"},
    )
    assert res.status_code == 200
    res = client.get("/api/v1/recommendations?refresh=true", headers=guest["headers"])
    data = res.json()["data"]
    assert data["items"][0]["factors"]["interest"] > 0.4


def test_recommendations_refresh_uses_interest_match(client):
    guest = register(client, "t5@test.dev")
    make_world(client, guest)
    client.put(
        "/api/v1/guest/preferences",
        headers=guest["headers"],
        json={"interests": ["museum only subject"]},
    )
    res = client.get("/api/v1/recommendations?refresh=true", headers=guest["headers"])
    items = res.json()["data"]["items"]
    assert items[0]["poi"]["name"] == "City Palace Museum"
