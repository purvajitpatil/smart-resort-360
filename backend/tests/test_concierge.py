"""AI concierge (real tool calls) + WhatsApp-style notification inbox."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.chat import ChatMessage
from app.models.requests import ServiceRequest
from app.models.travel import DisruptionEvent, Recommendation
from tests import _support


def _db(client: TestClient) -> Session:
    return client.app.state.session_local()


def _chat(client: TestClient, headers: dict, message: str) -> dict:
    res = client.post("/api/v1/chat/messages", json={"message": message}, headers=headers)
    assert res.status_code == 200, res.text
    return res.json()["data"]


def test_help_intent_runs_help_tool(client):
    guest = _support.register(client, "help_guest@test.dev")
    _support.make_world(client, guest)
    data = _chat(client, guest["headers"], "what can you do?")
    assert data["intent"] == "help"
    assert data["mode"] == "rules"
    assert data["tool_calls"][0]["tool"] == "help"
    assert data["assistant"]


def test_greeting_needs_no_tools(client):
    guest = _support.register(client, "greet_guest@test.dev")
    _support.make_world(client, guest)
    data = _chat(client, guest["headers"], "Hello!")
    assert data["intent"] == "greeting"
    assert data["tool_calls"] == []
    assert "concierge" in data["assistant"].lower()


def test_recommend_tool_runs_real_rows_and_persists(client):
    guest = _support.register(client, "rec_guest@test.dev")
    world = _support.make_world(client, guest)
    data = _chat(client, guest["headers"], "suggest things to do today")
    assert data["intent"] == "recommend"
    call = {t["tool"]: t for t in data["tool_calls"]}["recommend"]
    assert call["status"] == "ok"
    assert 1 <= len(call["detail"]["items"]) <= 5
    db = _db(client)
    assert db.query(Recommendation).filter(Recommendation.guest_id == world["profile"].id).count() >= 1
    db.close()
    conv = client.get("/api/v1/chat/conversation", headers=guest["headers"]).json()["data"]
    roles = [m["role"] for m in conv["messages"]]
    assert roles[-2:] == ["USER", "ASSISTANT"]


def test_request_tool_creates_real_request_and_notifies(client):
    guest = _support.register(client, "req_guest@test.dev")
    world = _support.make_world(client, guest)
    data = _chat(client, guest["headers"], "please send towels to my room urgently")
    assert data["intent"] == "request"
    call = data["tool_calls"][0]
    assert call["tool"] == "request"
    assert call["status"] == "ok"
    code = call["detail"]["code"]
    db = _db(client)
    req = db.query(ServiceRequest).filter(ServiceRequest.code == code).first()
    assert req is not None
    assert req.category == "HOUSEKEEPING"
    assert req.priority == "HIGH"
    from app.models.inbox import InboxNotification

    assert (
        db.query(InboxNotification)
        .filter(
            InboxNotification.guest_id == world["profile"].id, InboxNotification.title.ilike("%received%")
        )
        .count()
        >= 1
    )
    db.close()


def test_request_without_active_stay_reports_error(client):
    guest = _support.register(client, "nostay_guest@test.dev")
    res = client.post(
        "/api/v1/chat/messages", json={"message": "please send towels to my room"}, headers=guest["headers"]
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["intent"] == "request"
    assert data["tool_calls"][0]["status"] == "error"


def test_weather_tool_no_event_then_captured(client):
    guest = _support.register(client, "wx_guest@test.dev")
    staff = _support.register(client, "wx_staff@test.dev", role="STAFF")
    _support.make_world(client, guest, staff)
    first = _chat(client, guest["headers"], "what's the weather now?")
    assert "No live weather" in first["tool_calls"][0]["summary"]

    res = client.post(
        "/api/v1/weather/capture",
        json={"condition": "heavy rain", "temp_c": 26.0, "precip_mm": 12.0},
        headers=staff["headers"],
    )
    assert res.status_code == 200

    second = _chat(client, guest["headers"], "weather update?")
    summary = second["tool_calls"][0]["summary"]
    assert "heavy rain" in summary.lower()


def test_plan_tool_builds_itinerary_and_replan_adds_disruption(client):
    guest = _support.register(client, "plan_guest@test.dev")
    _support.make_world(client, guest)
    data = _chat(client, guest["headers"], "plan a day for me tomorrow")
    assert data["intent"] == "plan"
    plan = data["tool_calls"][0]
    assert plan["tool"] == "plan"
    assert plan["status"] == "ok"
    itinerary_id = plan["detail"]["itinerary_id"]
    db = _db(client)

    replanned = _chat(client, guest["headers"], "weather changed — replan my day")
    assert replanned["intent"] == "replan"
    assert replanned["tool_calls"][0]["status"] == "ok"
    assert db.query(DisruptionEvent).filter(DisruptionEvent.itinerary_id == itinerary_id).count() >= 1
    from app.models.inbox import InboxNotification

    assert (
        db.query(InboxNotification).filter(InboxNotification.title == "Your plan was replanned").count() >= 1
    )
    db.close()


def test_replan_without_itinerary_is_skipped(client):
    guest = _support.register(client, "noplan_guest@test.dev")
    _support.make_world(client, guest)
    data = _chat(client, guest["headers"], "please replan my day, weather changed")
    assert data["tool_calls"][0]["status"] == "skipped"


def test_rbac_chat_guest_only_and_demo_send_staff_only(client):
    guest = _support.register(client, "rbac_guest@test.dev")
    staff = _support.register(client, "rbac_staff@test.dev", role="STAFF")
    _support.make_world(client, guest, staff)
    res = client.post("/api/v1/chat/messages", json={"message": "hi"}, headers=staff["headers"])
    assert res.status_code == 403
    res = client.post(
        "/api/v1/notifications/demo/send",
        json={"title": "x", "body": "y"},
        headers=guest["headers"],
    )
    assert res.status_code == 403


def test_notifications_inbox_flow(client):
    guest = _support.register(client, "inbox_guest@test.dev")
    staff = _support.register(client, "inbox_staff@test.dev", role="STAFF")
    world = _support.make_world(client, guest, staff)

    res = client.post(
        "/api/v1/notifications/demo/send",
        json={
            "guest_id": world["profile"].id,
            "title": "Complimentary dessert",
            "body": "At dinner tonight.",
        },
        headers=staff["headers"],
    )
    assert res.status_code == 200, res.text

    data = client.get("/api/v1/notifications", headers=guest["headers"]).json()["data"]
    assert data["total"] >= 1
    assert data["unread"] >= 1
    assert any("Complimentary dessert" in n["title"] for n in data["items"])
    assert all(n["demo"] is True for n in data["items"])

    res = client.post("/api/v1/notifications/read-all", headers=guest["headers"])
    assert res.json()["data"]["marked_read"] >= 1
    data = client.get("/api/v1/notifications", headers=guest["headers"]).json()["data"]
    assert data["unread"] == 0


def test_staff_complete_notifies_guest(client):
    guest = _support.register(client, "hook_guest@test.dev")
    staff = _support.register(client, "hook_staff@test.dev", role="STAFF")
    _support.make_world(client, guest, staff)
    data = _chat(client, guest["headers"], "send towels to my room")
    code = data["tool_calls"][0]["detail"]["code"]

    res = client.get(f"/api/v1/requests/{code}", headers=staff["headers"])
    assert res.status_code == 200
    res = client.patch(f"/api/v1/requests/{code}/assign", headers=staff["headers"])
    assert res.status_code == 200
    res = client.patch(
        f"/api/v1/requests/{code}/status",
        json={"action": "start"},
        headers=staff["headers"],
    )
    assert res.status_code == 200
    res = client.patch(
        f"/api/v1/requests/{code}/status",
        json={"action": "complete"},
        headers=staff["headers"],
    )
    assert res.status_code == 200

    inbox = client.get("/api/v1/notifications", headers=guest["headers"]).json()["data"]
    bodies = [n["body"] for n in inbox["items"]]
    assert any("is on it" in b for b in bodies)
    assert any("now COMPLETED" in b for b in bodies)


def test_conversation_reset(client):
    guest = _support.register(client, "reset_guest@test.dev")
    _support.make_world(client, guest)
    _chat(client, guest["headers"], "hello there")
    db = _db(client)
    assert db.query(ChatMessage).filter(ChatMessage.role == "ASSISTANT").count() >= 1
    db.close()
    res = client.delete("/api/v1/chat/conversation", headers=guest["headers"])
    assert res.status_code == 200
    conv = client.get("/api/v1/chat/conversation", headers=guest["headers"]).json()["data"]
    assert conv["messages"] == []
