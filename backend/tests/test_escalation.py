"""Time-aware routing and the SLA escalation ladder.

These lock in the behaviour behind the hardest demo question: what actually
happens when a guest complains about noise at 2 AM.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.models.requests import RequestPriority, RequestStatus, ServiceRequest
from app.services import escalation_service as esc
from tests._support import make_world, register

TWO_AM = datetime(2026, 5, 12, 2, 0, tzinfo=UTC)
TWO_PM = datetime(2026, 5, 12, 14, 0, tzinfo=UTC)


def test_night_window_boundaries():
    assert esc.is_night(datetime(2026, 5, 12, 23, 0, tzinfo=UTC))
    assert esc.is_night(datetime(2026, 5, 12, 3, 30, tzinfo=UTC))
    assert esc.is_night(datetime(2026, 5, 12, 5, 59, tzinfo=UTC))
    assert not esc.is_night(datetime(2026, 5, 12, 6, 0, tzinfo=UTC))
    assert not esc.is_night(datetime(2026, 5, 12, 22, 59, tzinfo=UTC))


def test_noise_at_2am_is_high_priority_and_routed_to_duty_manager():
    plan = esc.classify("Room is very noisy", "Can't sleep", "MAINTENANCE", TWO_AM)

    assert plan["night"] is True
    assert plan["sleep_blocking"] is True
    assert plan["priority"] == RequestPriority.HIGH.value
    # Housekeeping/Maintenance are not staffed at 2 AM — the duty desk is.
    assert plan["department"] == "Front Desk"
    # Compressed because the guest is trying to sleep.
    assert plan["sla_minutes"] == 15
    assert plan["ladder"][0]["role"] == "DUTY_MANAGER"


def test_same_complaint_at_2pm_is_handled_differently():
    plan = esc.classify("Room is very noisy", "Can't sleep", "MAINTENANCE", TWO_PM)

    assert plan["night"] is False
    assert plan["sleep_blocking"] is False
    # Still a comfort complaint, but not sleep-blocking.
    assert plan["priority"] == RequestPriority.MEDIUM.value
    assert plan["department"] == "Maintenance"
    assert plan["sla_minutes"] > 15
    assert plan["ladder"][0]["role"] == "DEPARTMENT"


def test_night_ladder_escalates_faster_than_day_ladder():
    night_last = esc.NIGHT_LADDER[-1].after_minutes
    day_last = esc.DAY_LADDER[-1].after_minutes
    assert night_last < day_last


def test_sla_scales_with_priority_and_category():
    # Food is served faster than maintenance is fixed.
    assert esc.sla_for("FOOD", RequestPriority.LOW.value) < esc.sla_for(
        "MAINTENANCE", RequestPriority.LOW.value
    )
    # Higher priority always means a tighter window.
    assert esc.sla_for("HOUSEKEEPING", RequestPriority.HIGH.value) < esc.sla_for(
        "HOUSEKEEPING", RequestPriority.LOW.value
    )


def test_status_moves_from_on_track_to_breached():
    created = datetime(2026, 5, 12, 14, 0, tzinfo=UTC)
    req = ServiceRequest(
        code="SR-TEST-1",
        guest_id=1,
        hotel_id=1,
        category="HOUSEKEEPING",
        title="Extra towels",
        priority=RequestPriority.LOW.value,
        status=RequestStatus.PENDING.value,
        sla_minutes=40,
    )
    req.created_at = created

    fresh = esc.status_of(req, created + timedelta(minutes=1))
    assert fresh["state"] == "on_track"

    near = esc.status_of(req, created + timedelta(minutes=35))
    assert near["state"] == "at_risk"

    late = esc.status_of(req, created + timedelta(minutes=50))
    assert late["state"] == "breached"
    assert late["remaining_minutes"] < 0


def test_closed_requests_never_report_a_breach():
    created = datetime(2026, 5, 12, 14, 0, tzinfo=UTC)
    req = ServiceRequest(
        code="SR-TEST-2",
        guest_id=1,
        hotel_id=1,
        category="FOOD",
        title="Late dinner",
        priority=RequestPriority.LOW.value,
        status=RequestStatus.COMPLETED.value,
        sla_minutes=20,
    )
    req.created_at = created
    assert esc.status_of(req, created + timedelta(hours=6))["state"] == "closed"


def test_tier_climbs_with_elapsed_time():
    created = datetime(2026, 5, 12, 14, 0, tzinfo=UTC)
    req = ServiceRequest(
        code="SR-TEST-3",
        guest_id=1,
        hotel_id=1,
        category="HOUSEKEEPING",
        title="Extra pillows",
        priority=RequestPriority.LOW.value,
        status=RequestStatus.PENDING.value,
        sla_minutes=45,
    )
    req.created_at = created

    assert esc.current_tier(req, created).tier == 1
    assert esc.current_tier(req, created + timedelta(minutes=20)).tier == 2
    assert esc.current_tier(req, created + timedelta(minutes=40)).tier == 3
    assert esc.current_tier(req, created + timedelta(minutes=90)).tier == 4


def test_explain_reads_as_a_walkthrough():
    text = esc.explain("Noisy AC unit", None, "MAINTENANCE", TWO_AM)
    assert "night shift" in text
    assert "Duty Manager" in text
    assert "Escalation path" in text


def test_guest_urgency_is_never_downgraded(client):
    """A guest marking something HIGH outranks the router's own guess."""
    guest = register(client, "esc-guest@test.dev")
    staff = register(client, "esc-staff@test.dev", role="STAFF")
    make_world(client, guest, staff)

    res = client.post(
        "/api/v1/requests",
        headers=guest["headers"],
        json={"category": "Housekeeping", "title": "Extra pillows", "priority": "HIGH"},
    )
    assert res.status_code == 200, res.text
    created = res.json()["data"]
    # The router would have called this LOW; the guest said HIGH, so HIGH wins.
    assert created["priority"] == "HIGH"
    # And the SLA follows the priority that actually landed on the ticket.
    assert created["sla_minutes"] == esc.sla_for("Housekeeping", "HIGH")


def test_routing_explainer_endpoint(client):
    staff = register(client, "esc-explain@test.dev", role="STAFF")
    res = client.post(
        "/api/v1/ops/routing/explain",
        headers=staff["headers"],
        json={
            "title": "Room is noisy",
            "category": "MAINTENANCE",
            "at": "2026-05-12T02:00:00Z",
        },
    )
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data["priority"] == "HIGH"
    assert data["department"] == "Front Desk"
    assert data["sla_minutes"] == 15
    assert "walkthrough" in data


def test_routing_explainer_accepts_clock_time(client):
    staff = register(client, "esc-clock@test.dev", role="STAFF")
    res = client.post(
        "/api/v1/ops/routing/explain",
        headers=staff["headers"],
        json={"title": "Noisy neighbours", "category": "COMPLAINT", "at": "02:00"},
    )
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data["night"] is True
    assert data["priority"] == "HIGH"
    assert data["sla_minutes"] == 15
    assert "walkthrough" in data


def test_routing_explainer_rejects_bad_timestamp(client):
    staff = register(client, "esc-badts@test.dev", role="STAFF")
    res = client.post(
        "/api/v1/ops/routing/explain",
        headers=staff["headers"],
        json={"title": "Noisy", "category": "MAINTENANCE", "at": "not-a-date"},
    )
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "INVALID_TIMESTAMP"


def test_escalation_sweep_surfaces_overdue_requests(client):
    guest = register(client, "esc-sweep-g@test.dev")
    staff = register(client, "esc-sweep-s@test.dev", role="STAFF")
    world = make_world(client, guest, staff)

    client.post(
        "/api/v1/requests",
        headers=guest["headers"],
        json={"category": "Housekeeping", "title": "Extra towels", "priority": "LOW"},
    )

    # Age the request past its SLA so the sweep has something to report.
    factory = client.app.state.session_local
    db = factory()
    try:
        row = db.query(ServiceRequest).first()
        row.created_at = datetime.now(UTC) - timedelta(hours=3)
        db.commit()
    finally:
        db.close()

    res = client.get(
        "/api/v1/ops/escalations",
        headers=staff["headers"],
        params={"hotel_id": world["hotel_id"]},
    )
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data["total"] >= 1
    assert data["breached"] >= 1
    assert data["items"][0]["tier"] >= 3


def test_escalations_require_staff(client):
    guest = register(client, "esc-noauth@test.dev")
    res = client.get("/api/v1/ops/escalations", headers=guest["headers"])
    assert res.status_code == 403


def test_daily_brief_is_staff_only_and_returns_actionable_signals(client):
    guest = register(client, "brief-guest@test.dev")
    staff = register(client, "brief-staff@test.dev", role="STAFF")
    make_world(client, guest, staff)

    forbidden = client.get("/api/v1/ops/daily-brief", headers=guest["headers"])
    assert forbidden.status_code == 403

    response = client.get("/api/v1/ops/daily-brief", headers=staff["headers"])
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["hotel"] == "Test Palace"
    assert data["actions"]
    assert data["actions"][0]["route"].startswith("/app")
    assert set(data["signals"]) == {
        "occupancy_pct",
        "projected_daily_revenue",
        "open_requests",
        "inventory_alerts",
        "scheduling_gaps",
        "segments_covered",
    }
