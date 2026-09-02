"""Service-request lifecycle orchestration (guest + staff)."""

from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.auth import User
from app.models.guest import GuestProfile
from app.models.hotel import Staff, Stay
from app.models.payments import Feedback
from app.models.requests import (
    RequestPriority,
    RequestStatus,
    RequestStatusHistory,
    ServiceRequest,
)
from app.schemas.requests import (
    QueueStatsOut,
    RequestCreateIn,
    RequestHistoryOut,
    RequestListOut,
    RequestOut,
)
from app.services import escalation_service, inventory_service, memory_service, notifications_service
from app.utils.responses import ApiError

_TERMINAL = {
    RequestStatus.COMPLETED.value,
    RequestStatus.CANCELLED.value,
    RequestStatus.REJECTED.value,
}

SLA_MINUTES = {
    RequestPriority.LOW: 90,
    RequestPriority.MEDIUM: 60,
    RequestPriority.HIGH: 45,
}

# (from_status) -> allowed actions
_ALLOWED = {
    RequestStatus.PENDING.value: {"assign", "start", "cancel"},
    RequestStatus.ASSIGNED.value: {"start", "complete", "cancel", "assign"},
    RequestStatus.IN_PROGRESS.value: {"complete", "cancel"},
}

_ACTION_TO_STATUS = {
    "assign": RequestStatus.ASSIGNED,
    "start": RequestStatus.IN_PROGRESS,
    "complete": RequestStatus.COMPLETED,
    "cancel": RequestStatus.CANCELLED,
}


def create(db: Session, profile: GuestProfile, payload: RequestCreateIn) -> RequestOut:
    stay = (
        db.query(Stay)
        .filter(Stay.guest_id == profile.id, Stay.status == "ACTIVE")
        .order_by(Stay.check_in.desc())
        .first()
    )
    if stay is None:
        raise ApiError(400, "NO_ACTIVE_STAY", "You must have an active stay to place a service request.")

    code = _next_code(db)

    # Time-aware routing. The guest picks a priority; the router can only raise
    # it, never lower it, so an explicit "this is urgent" is always respected.
    plan = escalation_service.classify(payload.title, payload.description, payload.category)
    priority = _max_priority(payload.priority.value, plan["priority"])
    # The SLA has to track the priority that actually lands on the ticket, which
    # may be higher than the one the router inferred.
    sla_minutes = escalation_service.sla_for(
        payload.category,
        priority,
        night=plan["night"],
        sleep_blocking=plan["sleep_blocking"],
    )
    department_id = _department_by_name(db, plan["department"]) or _default_department(
        db, payload.category
    )

    req = ServiceRequest(
        code=code,
        hotel_id=stay.hotel_id,
        guest_id=profile.id,
        room_id=stay.room_id,
        stay_id=stay.id,
        category=payload.category,
        title=payload.title,
        description=payload.description,
        quantity=payload.quantity,
        priority=priority,
        status=RequestStatus.PENDING.value,
        sla_minutes=sla_minutes,
        department_id=department_id,
    )
    db.add(req)
    db.flush()
    db.add(
        RequestStatusHistory(
            request_id=req.id,
            from_status=None,
            to_status=RequestStatus.PENDING.value,
            actor_user_id=profile.user_id,
            note=f"Raised by guest · {plan['rationale']['routing']}",
        )
    )
    db.commit()

    # Learn from it. This is what makes the next stay feel different.
    memory_service.observe_request(db, req)

    _notify(
        db,
        req,
        f"Request {req.code} received",
        f"{req.title or req.category} — {req.status}. We're on it, {profile.full_name}.",
    )
    return to_out(req)


_PRIORITY_RANK = {
    RequestPriority.LOW.value: 0,
    RequestPriority.MEDIUM.value: 1,
    RequestPriority.HIGH.value: 2,
}


def _max_priority(guest_choice: str, routed: str) -> str:
    """Never de-escalate what the guest flagged as urgent."""
    return guest_choice if _PRIORITY_RANK[guest_choice] >= _PRIORITY_RANK[routed] else routed


def _department_by_name(db: Session, name: str) -> int | None:
    from app.models.hotel import Department

    row = db.query(Department).filter(Department.name == name).first()
    return row.id if row else None


def _default_department(db: Session, category: str) -> int | None:
    from app.models.hotel import Department

    exact = db.query(Department).filter(Department.name == category).first()
    if exact is not None:
        return exact.id
    name = category.lower()
    for keyword, dept in {
        "housekeeping": "Housekeeping",
        "clean": "Housekeeping",
        "food": "Food & Beverage",
        "dining": "Food & Beverage",
        "beverage": "Food & Beverage",
        "restaurant": "Food & Beverage",
        "bar": "Food & Beverage",
        "lavatory": "Housekeeping",
        "repair": "Maintenance",
        "maintenance": "Maintenance",
        "air": "Maintenance",
        "wifi": "IT & Media",
        "internet": "IT & Media",
        "concierge": "Concierge",
    }.items():
        if keyword in name:
            row = db.query(Department).filter(Department.name == dept).first()
            return row.id if row else None
    return None


def _next_code(db: Session) -> str:
    today = datetime.now().strftime("%y%m%d")
    count = int(
        db.execute(
            select(func.count(ServiceRequest.id)).where(ServiceRequest.code.like(f"SR-{today}-%"))
        ).scalar_one()
    )
    for n in range(count + 1, count + 10_000):
        candidate = f"SR-{today}-{n:03d}"
        exists = (
            db.execute(select(ServiceRequest.id).where(ServiceRequest.code == candidate)).first() is not None
        )
        if not exists:
            return candidate
    raise ApiError(500, "INTERNAL_ERROR", "Could not allocate a request code.")


def list_for_guest(db: Session, profile: GuestProfile) -> RequestListOut:
    items = (
        db.query(ServiceRequest)
        .filter(ServiceRequest.guest_id == profile.id)
        .order_by(ServiceRequest.created_at.desc())
        .all()
    )
    ratings = {
        fb.request_id: fb.rating
        for fb in db.query(Feedback)
        .filter(Feedback.guest_id == profile.id, Feedback.request_id.isnot(None))
        .all()
    }
    return RequestListOut(
        items=[to_out(r, ratings.get(r.id)) for r in items],
        total=len(items),
        filters={"scope": "mine"},
    )


def cancel_for_guest(db: Session, profile: GuestProfile, code: str) -> RequestOut:
    req = _get_by_code(db, code)
    if req.guest_id != profile.id:
        raise ApiError(403, "FORBIDDEN", "This request does not belong to you.")
    return _transition(
        db,
        req,
        profile.user_id,
        RequestStatus.CANCELLED,
        note="Cancelled by guest",
        forced=True,
    )


def list_for_staff(
    db: Session,
    status: str | None,
    category: str | None,
    priority: str | None,
    search: str | None,
) -> RequestListOut:
    query = db.query(ServiceRequest)
    if status:
        query = query.filter(ServiceRequest.status == status)
    if category:
        query = query.filter(ServiceRequest.category.ilike(f"%{category}%"))
    if priority:
        query = query.filter(ServiceRequest.priority == priority)
    if search:
        like = f"%{search}%"
        query = query.filter(
            ServiceRequest.code.ilike(like)
            | ServiceRequest.title.ilike(like)
            | ServiceRequest.guest.has(GuestProfile.full_name.ilike(like))
        )
    items = query.order_by(ServiceRequest.created_at.desc()).limit(200).all()
    return RequestListOut(
        items=[to_out(r) for r in items],
        total=len(items),
        filters={
            "status": status,
            "category": category,
            "priority": priority,
            "search": search,
        },
    )


def get_by_code(db: Session, code: str) -> RequestOut:
    return to_out(_get_by_code(db, code))


def get_request_row(db: Session, code: str) -> ServiceRequest:
    return _get_by_code(db, code)


def _get_by_code(db: Session, code: str) -> ServiceRequest:
    req = db.query(ServiceRequest).filter(ServiceRequest.code == code).first()
    if req is None:
        raise ApiError(404, "REQUEST_NOT_FOUND", f"No service request with code {code!r}.")
    return req


def assign(db: Session, staff_user: User, code: str, note: str | None = None) -> RequestOut:
    req = _get_by_code(db, code)
    staff = db.query(Staff).filter(Staff.user_id == staff_user.id).first()
    if staff is None:
        raise ApiError(400, "NO_STAFF_PROFILE", "This staff account has no duty profile; ask an admin.")
    status = req.status
    if status not in _ALLOWED or "assign" not in _ALLOWED[status]:
        raise ApiError(409, "INVALID_TRANSITION", f"Cannot assign a {status} request.")
    old = req.status
    req.status = RequestStatus.ASSIGNED.value
    req.assigned_staff_id = staff.id
    req.department_id = staff.department_id
    db.add(
        RequestStatusHistory(
            request_id=req.id,
            from_status=old,
            to_status=req.status,
            actor_user_id=staff_user.id,
            note=note or "Accepted by staff",
        )
    )
    db.commit()
    _notify(
        db,
        req,
        f"Request {req.code} assigned",
        f"{req.title or req.category} — {staff_user.full_name} is on it.",
    )
    return to_out(req)


def transition(
    db: Session,
    staff_user: User,
    code: str,
    action: str,
    note: str | None = None,
) -> RequestOut:
    req = _get_by_code(db, code)
    to_status = _ACTION_TO_STATUS.get(action)
    if to_status is None:
        raise ApiError(422, "INVALID_ACTION", f"Unknown action {action!r}.")
    if req.status in _TERMINAL:
        raise ApiError(409, "INVALID_TRANSITION", f"Cannot act on a {req.status} request.")
    allowed = _ALLOWED.get(req.status, set())
    if action not in allowed and action != "assign":
        raise ApiError(409, "INVALID_TRANSITION", f"Cannot {action} a {req.status} request.")
    if action == "assign":
        return assign(db, staff_user, code, note)
    return _transition(db, req, staff_user.id, to_status, note=note)


def _notify(db: Session, req: ServiceRequest, title: str, body: str) -> None:
    if req.guest_id:
        try:
            notifications_service.send(db, req.guest_id, title=title, body=body)
        except Exception:  # noqa: BLE001 - a lost notification must never break a request update
            pass


def _transition(
    db: Session,
    req: ServiceRequest,
    actor_user_id: int,
    to_status: RequestStatus,
    note: str | None,
    forced: bool = False,
) -> RequestOut:
    if not forced and req.status in _TERMINAL:
        raise ApiError(409, "INVALID_TRANSITION", f"Cannot change a {req.status} request.")
    old = req.status
    req.status = to_status.value
    if to_status in (RequestStatus.COMPLETED, RequestStatus.CANCELLED):
        req.resolved_at = datetime.now()
    if to_status == RequestStatus.COMPLETED:
        inventory_service.consume_on_complete(db, req)
    db.add(
        RequestStatusHistory(
            request_id=req.id,
            from_status=old,
            to_status=req.status,
            actor_user_id=actor_user_id,
            note=note,
        )
    )
    db.commit()
    _notify(
        db,
        req,
        f"Request {req.code} updated",
        f"{req.title or req.category} is now {req.status}.",
    )
    return to_out(req)


def queue_stats(db: Session) -> QueueStatsOut:
    rows = db.execute(
        select(ServiceRequest.status, func.count(ServiceRequest.id)).group_by(ServiceRequest.status)
    )
    by_status = {status: int(count) for status, count in rows}
    rows = db.execute(
        select(ServiceRequest.priority, func.count(ServiceRequest.id))
        .where(ServiceRequest.status.notin_(_TERMINAL))
        .group_by(ServiceRequest.priority)
    )
    by_priority = {priority: int(count) for priority, count in rows}
    now = datetime.now()
    open_items = (
        db.execute(select(ServiceRequest).where(ServiceRequest.status.notin_(_TERMINAL))).scalars().all()
    )
    overdue = sum(
        1
        for r in open_items
        if r.sla_minutes and r.created_at and now > r.created_at + timedelta(minutes=r.sla_minutes)
    )
    return QueueStatsOut(
        by_status=by_status,
        by_priority=by_priority,
        overdue_count=int(overdue),
        open_count=len(open_items),
    )


def to_out(req: ServiceRequest, rating: int | None = None) -> RequestOut:
    now = datetime.now()
    deadline = None
    overdue = False
    if req.sla_minutes and req.created_at:
        deadline = req.created_at + timedelta(minutes=req.sla_minutes)
        overdue = req.status not in _TERMINAL and now > deadline
    return RequestOut(
        id=req.id,
        code=req.code,
        category=req.category,
        title=req.title,
        description=req.description,
        quantity=req.quantity,
        priority=req.priority,
        status=req.status,
        room_number=req.room.number if req.room else None,
        guest_name=req.guest.full_name if req.guest else None,
        assigned_to=req.assigned_staff.user.full_name if req.assigned_staff else None,
        department=req.department.name if req.department else None,
        sla_minutes=req.sla_minutes,
        sla_deadline=deadline,
        sla_overdue=overdue,
        resolved_at=req.resolved_at,
        created_at=req.created_at,
        updated_at=req.updated_at,
        user_rating=rating,
        history=[
            RequestHistoryOut(
                id=h.id,
                from_status=h.from_status,
                to_status=h.to_status,
                actor_user_id=h.actor_user_id,
                note=h.note,
                created_at=h.created_at,
            )
            for h in req.history
        ],
    )
