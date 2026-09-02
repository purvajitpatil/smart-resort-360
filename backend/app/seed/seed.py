"""Deterministic demo seed data for the Smart Resort 360 MVP.

Idempotent: safe to run on every startup. Builds the "Smart Resort 360 Grand
Jaipur" hotel world, demo users, guest profiles + stays, service requests and
the curated Jaipur POI catalogue loaded from data/pois/jaipur.json.
"""

from __future__ import annotations

import json
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from app.config import settings
from app.models import (
    POI,
    Booking,
    Department,
    Feedback,
    GuestMemory,
    GuestPreferences,
    GuestProfile,
    Hotel,
    InventoryItem,
    Itinerary,
    MemoryKind,
    Room,
    ServiceRequest,
    Staff,
    Stay,
    User,
    UserRole,
)
from app.services import memory_service, planner_service, security

DEPARTMENTS = [
    ("Housekeeping", "#14b8a6"),
    ("Food & Beverage", "#f59e0b"),
    ("Maintenance", "#ef4444"),
    ("Front Desk", "#6366f1"),
    ("Concierge", "#8b5cf6"),
    ("Wellness", "#10b981"),
]

ROOM_SPECS = [
    (1, "Deluxe", 2, 4500.0),
    (2, "Deluxe", 2, 4800.0),
    (3, "Family", 4, 6500.0),
    (4, "Suite", 4, 9500.0),
]


def upsert_user(db: Session, email: str, password: str, full_name: str, role: str) -> User:
    normalized = email.strip().lower()
    user = db.query(User).filter(User.email == normalized).first()
    if user is None:
        user = User(
            email=normalized,
            hashed_password=security.hash_password(password),
            full_name=full_name,
            role=role,
            is_active=True,
        )
        db.add(user)
        db.flush()
    return user


def _load_pois(path: Path) -> list[dict[str, Any]]:
    return json.loads(path.read_text(encoding="utf-8"))


def _to_time(value: str) -> str | None:
    value = (value or "").strip()
    return None if value in {"", "Anytime"} else value


def _pois_file() -> Path | None:
    if settings.seed_data_file:
        path = Path(settings.seed_data_file)
        return path if path.exists() else None
    path = Path(__file__).resolve().parents[3] / "data" / "pois" / "jaipur.json"
    return path if path.exists() else None


def seed_database(db: Session) -> dict[str, int]:
    counts: dict[str, int] = {}

    # ---- Hotel, departments, rooms ------------------------------------------------
    hotel = db.query(Hotel).filter(Hotel.city == "Jaipur").first()
    if hotel is None:
        hotel = Hotel(
            name=settings.hotel_name,
            city="Jaipur",
            address="Sansar Chandra Road, Jaipur, Rajasthan 302001",
            lat=26.9124,
            lng=75.7873,
        )
        db.add(hotel)
        db.flush()

    departments: dict[str, Department] = {}
    for name, color in DEPARTMENTS:
        dept = db.query(Department).filter(Department.hotel_id == hotel.id, Department.name == name).first()
        if dept is None:
            dept = Department(hotel_id=hotel.id, name=name, color=color)
            db.add(dept)
            db.flush()
        departments[name] = dept

    if db.query(Room).count() == 0:
        for floor, room_type, capacity, rate in ROOM_SPECS:
            for n in range(1, 11):
                db.add(
                    Room(
                        hotel_id=hotel.id,
                        number=f"{floor}0{n}",
                        floor=floor,
                        room_type=room_type,
                        status="CLEAN",
                        capacity=capacity,
                        rate_per_night=rate,
                    )
                )
        db.flush()
        counts["rooms"] = 40

    # ---- POI catalogue (curated seed feed) ---------------------------------------
    pois_file = _pois_file()
    if db.query(POI).count() == 0 and pois_file is not None:
        for p in _load_pois(pois_file):
            db.add(
                POI(
                    city="Jaipur",
                    name=p["name"],
                    description=p.get("description"),
                    category=p.get("category", "culture"),
                    sub_category=p.get("sub_category"),
                    lat=p["lat"],
                    lng=p["lng"],
                    open_time=_to_time(p.get("open_time", "")),
                    close_time=_to_time(p.get("close_time", "")),
                    closed_days=p.get("closed_days", []),
                    visit_minutes=p.get("visit_minutes", 90),
                    price_level=p.get("price_level", 1),
                    rating=p.get("rating", 4.0),
                    family_friendly=p.get("family_friendly", True),
                    vegetarian_friendly=p.get("vegetarian_friendly", True),
                    indoor=p.get("indoor", False),
                    outdoor=p.get("outdoor", True),
                    weather_sensitivity=p.get("weather_sensitivity", "LOW"),
                    popularity=p.get("popularity", 0.5),
                    local_discovery=p.get("local_discovery", 0.2),
                    source="curated",
                )
            )
        db.flush()
        counts["pois"] = db.query(POI).count()

    # ---- Staff teams ------------------------------------------------------------------
    staff_emails = [
        ("suresh@smartresort360.demo", "Suresh Kumawat", "Housekeeping", "Housekeeping Lead", "Morning"),
        ("radhika@smartresort360.demo", "Radhika Choudhary", "Food & Beverage", "Server", "Morning"),
        ("manoj@smartresort360.demo", "Manoj Verma", "Maintenance", "Technician", "Morning"),
        ("neha@smartresort360.demo", "Neha Rathore", "Front Desk", "Front Office Associate", "Evening"),
        ("arjun@smartresort360.demo", "Arjun Shekhawat", "Concierge", "Travel Desk Executive", "Morning"),
        ("fatima@smartresort360.demo", "Fatima Khan", "Housekeeping", "Housekeeping Attendant", "Morning"),
        ("kavita@smartresort360.demo", "Kavita Meena", "Food & Beverage", "Barista", "Evening"),
    ]
    for email, name, dept_name, position, shift in staff_emails:
        user = upsert_user(
            db, email=email, password=settings.demo_staff_password, full_name=name, role=UserRole.STAFF.value
        )
        if db.query(Staff).filter(Staff.user_id == user.id).count() == 0:
            db.add(
                Staff(
                    user_id=user.id,
                    hotel_id=hotel.id,
                    department_id=departments[dept_name].id,
                    position=position,
                    shift=shift,
                )
            )
    db.flush()

    # ---- Admin / manager / demo guest ------------------------------------------------
    upsert_user(
        db, settings.admin_email, settings.demo_manager_password, "Smart Resort 360 Admin", UserRole.ADMIN.value
    )
    upsert_user(
        db,
        settings.manager_email,
        settings.demo_manager_password,
        "Aditya Rathore (Demo Manager)",
        UserRole.MANAGER.value,
    )
    db.flush()

    guest_user = upsert_user(
        db, settings.demo_guest_email, settings.demo_guest_password, "Priya Sharma", UserRole.GUEST.value
    )
    priya = db.query(GuestProfile).filter(GuestProfile.full_name == "Priya Sharma").first()
    if priya is None:
        priya = GuestProfile(
            user_id=guest_user.id,
            full_name="Priya Sharma",
            email=settings.demo_guest_email,
            phone="+91 98290 12345",
        )
        db.add(priya)
        db.flush()
        db.add(
            GuestPreferences(
                guest_id=priya.id,
                interests=["heritage", "culture", "shopping", "food"],
                budget="medium",
                pace="moderate",
                preferred_start_time="09:00",
                preferred_end_time="21:00",
                walking_tolerance="medium",
                food_preferences=["vegetarian"],
                travel_group="solo",
                accessibility_requirements=[],
                preferred_activity_duration="medium",
            )
        )
        db.flush()

    # ---- Bookings / stays ---------------------------------------------------------------
    if db.query(Booking).count() == 0:
        rooms = {r.number: r for r in db.query(Room).all()}
        today = date.today()
        guest_rows = [
            (
                "Priya Sharma",
                priya.id,
                "302",
                today - timedelta(days=1),
                today + timedelta(days=4),
                "ACTIVE",
                "CHECKED_IN",
            ),
            ("Aarav Patel", None, "101", today - timedelta(days=3), today, "CHECKED_OUT", "COMPLETED"),
            ("Meera Joshi", None, "205", today, today + timedelta(days=2), "ACTIVE", "CHECKED_IN"),
            (
                "Rohan Mehta",
                None,
                "308",
                today - timedelta(days=2),
                today + timedelta(days=1),
                "ACTIVE",
                "CHECKED_IN",
            ),
            ("Ananya Iyer", None, "407", today, today + timedelta(days=3), "ACTIVE", "CHECKED_IN"),
            (
                "Vikram Singh",
                None,
                "108",
                today - timedelta(days=5),
                today - timedelta(days=1),
                "CHECKED_OUT",
                "COMPLETED",
            ),
        ]
        for full_name, guest_id, room_no, check_in, check_out, stay_status, booking_status in guest_rows:
            if guest_id is None:
                profile = GuestProfile(full_name=full_name)
                db.add(profile)
                db.flush()
                guest_id = profile.id
            room = rooms[room_no]
            booking = Booking(
                guest_id=guest_id,
                hotel_id=hotel.id,
                room_id=room.id,
                check_in=check_in,
                check_out=check_out,
                status=booking_status,
            )
            db.add(booking)
            db.flush()
            db.add(
                Stay(
                    booking_id=booking.id,
                    guest_id=guest_id,
                    room_id=room.id,
                    hotel_id=hotel.id,
                    check_in=check_in,
                    check_out=check_out,
                    status=stay_status,
                )
            )
            room.status = "OCCUPIED" if stay_status == "ACTIVE" else "DEPARTED"
        db.flush()

    # ---- Service requests ------------------------------------------------------------------
    if db.query(ServiceRequest).count() == 0:
        active_stays = db.query(Stay).filter(Stay.status == "ACTIVE").all()
        stay_by_room = {s.room_id: s for s in active_stays}
        rooms_by_no = {r.number: r for r in db.query(Room).all()}
        housekeeping_staff = [
            s for s in db.query(Staff).all() if s.position and s.position.startswith("Housekeeping")
        ]
        fanda_staff = [s for s in db.query(Staff).all() if s.position and s.position in {"Server", "Barista"}]
        maintenance_staff = [s for s in db.query(Staff).all() if s.position == "Technician"]
        now = datetime.utcnow()
        counter = 0

        def add_request(
            room_no: str,
            category: str,
            title: str,
            description: str,
            qty: int,
            priority: str,
            status: str,
            dept_name: str | None,
            assigned_staff: list | None,
            created_at: datetime,
            resolved_at: datetime | None,
        ) -> None:
            nonlocal counter
            counter += 1
            room = rooms_by_no[room_no]
            stay = stay_by_room.get(room.id)
            guest_id = stay.guest_id if stay else priya.id
            dept = departments.get(dept_name) if dept_name else None
            req = ServiceRequest(
                code=f"SR-{now:%y%m%d}-{counter:03d}",
                guest_id=guest_id,
                stay_id=stay.id if stay else None,
                hotel_id=hotel.id,
                room_id=room.id,
                category=category,
                title=title,
                description=description,
                quantity=qty,
                priority=priority,
                status=status,
                department_id=dept.id if dept else None,
                assigned_staff_id=assigned_staff[0].id if assigned_staff else None,
                ai_created=False,
                sla_minutes={"HIGH": 45, "MEDIUM": 60, "LOW": 90}.get(priority, 60),
                resolved_at=resolved_at,
            )
            req.created_at = created_at
            req.updated_at = resolved_at or created_at
            db.add(req)

        add_request(
            "302",
            "HOUSEKEEPING",
            "Extra towels to room 302",
            "Room 302 could use an extra set of towels.",
            1,
            "MEDIUM",
            "COMPLETED",
            "Housekeeping",
            housekeeping_staff,
            now - timedelta(hours=5),
            now - timedelta(hours=3),
        )
        add_request(
            "205",
            "MAINTENANCE",
            "AC not cooling",
            "Air conditioner in room 205 is blowing warm air.",
            1,
            "HIGH",
            "IN_PROGRESS",
            "Maintenance",
            maintenance_staff,
            now - timedelta(hours=1),
            None,
        )
        # Systemic AC cluster: 3 more warm-air complaints in the 7-day window so
        # the predictive-maintenance engine flags a central-plant fault.
        add_request(
            "308",
            "MAINTENANCE",
            "AC blowing warm air",
            "Room 308 AC runs but never gets cold.",
            1,
            "MEDIUM",
            "PENDING",
            "Maintenance",
            None,
            now - timedelta(days=1),
            None,
        )
        add_request(
            "101",
            "MAINTENANCE",
            "Aircon not effective",
            "Temperature stays high despite settings in room 101.",
            1,
            "MEDIUM",
            "COMPLETED",
            "Maintenance",
            maintenance_staff,
            now - timedelta(days=2),
            now - timedelta(days=2, hours=-1),
        )
        add_request(
            "407",
            "MAINTENANCE",
            "Cooling weak in suite",
            "AC cooling feels weak overnight in suite 407.",
            1,
            "LOW",
            "COMPLETED",
            "Maintenance",
            maintenance_staff,
            now - timedelta(days=3),
            now - timedelta(days=3, hours=-1),
        )
        add_request(
            "407",
            "DINING",
            "Vegetarian thali dinner",
            "Two vegetarian thalis to room 407 at 20:00.",
            2,
            "LOW",
            "ASSIGNED",
            "Food & Beverage",
            fanda_staff,
            now - timedelta(minutes=30),
            None,
        )
        add_request(
            "302",
            "TRANSPORT",
            "Airport taxi tomorrow",
            "Taxi from hotel to Jaipur airport at 07:00.",
            1,
            "MEDIUM",
            "PENDING",
            "Concierge",
            None,
            now - timedelta(minutes=10),
            None,
        )
        add_request(
            "308",
            "FRONT_DESK",
            "Late checkout request",
            "Guest in 308 requests late checkout until 14:00.",
            1,
            "LOW",
            "PENDING",
            "Front Desk",
            None,
            now - timedelta(minutes=45),
            None,
        )
        add_request(
            "101",
            "LAUNDRY",
            "Laundry pickup",
            "Laundry pickup from room 101.",
            1,
            "LOW",
            "COMPLETED",
            "Housekeeping",
            housekeeping_staff,
            now - timedelta(days=1),
            now - timedelta(days=1),
        )
        add_request(
            "407",
            "HOUSEKEEPING",
            "Extra pillow",
            "Extra feather pillow for tonight.",
            1,
            "LOW",
            "COMPLETED",
            "Housekeeping",
            housekeeping_staff,
            now - timedelta(hours=26),
            now - timedelta(hours=25),
        )
        db.flush()
        counts["requests"] = db.query(ServiceRequest).count()

    # Commit before the planner so the SQLite write lock is free (planner commits on its own).
    db.commit()

    # ---- Demo itinerary (planner output, only when none exists yet) -----------------
    if db.query(Itinerary).count() == 0 and db.query(POI).count() > 0:
        from app.schemas.travel import ItineraryCreateIn

        payload = ItineraryCreateIn(
            start_date=date.today().isoformat(),
            days=2,
            start_time="09:00",
            end_time="21:00",
        )
        try:
            planner_service.create(db, priya, hotel, payload)
        except Exception:  # noqa: BLE001 - a seed-side plan failure must not block startup
            db.rollback()
        counts["itineraries"] = db.query(Itinerary).count()

    db.commit()

    # ---- Demo inbox (WhatsApp-style demo channel, real rows only) -----------------
    from app.models.inbox import InboxNotification
    from app.services import notifications_service

    if db.query(InboxNotification).filter(InboxNotification.guest_id == priya.id).count() == 0:
        try:
            stay = (
                db.query(Stay)
                .filter(Stay.guest_id == priya.id, Stay.status == "ACTIVE")
                .order_by(Stay.check_in.desc())
                .first()
            )
            if stay is not None:
                notifications_service.send(
                    db,
                    priya.id,
                    title="Welcome to Smart Resort 360 Grand Jaipur",
                    body=f"Namaste Priya! Room {stay.room.number if stay.room else '-'} is ready. "
                    "Ask the concierge for recommendations, plans or anything you need.",
                )
                notifications_service.send(
                    db,
                    priya.id,
                    title="Checkout update",
                    body=f"Your checkout is on {stay.check_out:%d %b %Y}. Need a late checkout? "
                    "Message the concierge or raise it from the app.",
                )
        except Exception:  # noqa: BLE001 - seed-side inbox must not block startup
            db.rollback()
        db.commit()
        counts["notifications"] = db.query(InboxNotification).count()

    # ---- Inventory (housekeeping / F&B) ------------------------------------------
    if db.query(InventoryItem).filter(InventoryItem.hotel_id == hotel.id).count() == 0:
        # Quantities set at/below reorder so the Resort Intelligence dashboard
        # shows live LOW/CRITICAL reorder signals on first boot.
        inventory_seed = [
            # (category, name, unit, quantity, threshold, reorder_qty, cost/unit)
            ("LINEN", "Bath Towels", "pieces", 18, 20, 60, 220.0),       # LOW
            ("LINEN", "Hand Towels", "pieces", 26, 20, 60, 120.0),
            ("LINEN", "Bed Linen Sets", "sets", 3, 12, 40, 450.0),       # CRITICAL
            ("LINEN", "Blankets", "pieces", 14, 10, 24, 850.0),
            ("AMENITY", "Shampoo", "bottles", 4, 15, 50, 90.0),          # CRITICAL
            ("AMENITY", "Body Soap", "pieces", 30, 20, 60, 25.0),
            ("AMENITY", "Toothbrush Kits", "kits", 12, 15, 40, 30.0),    # LOW
            ("FNB", "Mineral Water", "bottles", 60, 100, 200, 18.0),     # LOW
            ("FNB", "Coffee Sachets", "sachets", 20, 80, 200, 12.0),     # CRITICAL
            ("FNB", "Tea Bags", "sachets", 140, 100, 240, 6.0),
        ]
        for category, name, unit, qty, threshold, reorder_qty, cost in inventory_seed:
            db.add(
                InventoryItem(
                    hotel_id=hotel.id,
                    category=category,
                    name=name,
                    unit=unit,
                    quantity=qty,
                    reorder_threshold=threshold,
                    reorder_quantity=reorder_qty,
                    cost_per_unit=cost,
                )
            )
        db.flush()
        counts["inventory"] = db.query(InventoryItem).count()

    # ---- Guest sentiment (feedback on completed requests) -----------------------
    if db.query(Feedback).count() == 0:
        # Ratings skewed to tell a story: a strong F&B score and a dipping
        # housekeeping score the sentiment panel can surface as a trend.
        rating_seed = [
            # (title_substring, category, rating, comment, days_ago)
            ("Extra towels", "HOUSEKEEPING", 3, "Towels arrived but took a while.", 3),
            ("Extra pillow", "HOUSEKEEPING", 4, "Good, comfortable pillow.", 4),
            ("Laundry pickup", "HOUSEKEEPING", 2, "Pickup was late, had to call twice.", 5),
            ("Vegetarian thali", "FOOD", 5, "Delicious thali, generous portions.", 2),
            ("Aircon not effective", "MAINTENANCE", 4, "Fixed quickly after the call.", 2),
            ("Cooling weak", "MAINTENANCE", 4, "Resolved same day.", 3),
            ("AC not cooling", "MAINTENANCE", 3, "Still warm, technician said it needs parts.", 1),
        ]
        for sub, category, rating, comment, days_ago in rating_seed:
            req = (
                db.query(ServiceRequest)
                .filter(ServiceRequest.title.ilike(f"%{sub}%"))
                .order_by(ServiceRequest.id.desc())
                .first()
            )
            if req is None:
                continue
            feedback = Feedback(
                guest_id=req.guest_id,
                stay_id=req.stay_id,
                request_id=req.id,
                rating=rating,
                category=category,
                comment=comment,
            )
            feedback.created_at = (datetime.now(UTC) - timedelta(days=days_ago)).replace(tzinfo=None)
            db.add(feedback)
        db.flush()
        counts["feedback"] = db.query(Feedback).count()

    # ---- Cross-stay memory for the demo guest (Power Guest story) ---------------
    if db.query(GuestMemory).filter(GuestMemory.guest_id == priya.id).count() == 0:
        # Priya returns often; seed memories that mirror what observe_request()
        # would have learned, but with elevated stays_seen/confidence so the
        # "Power Guest" segment and its prep actions appear on first boot.
        mem_seed = [
            ("amenity.pillows", "Likes extra pillows in the room",
             "Place 2 extra pillows before arrival", "OBSERVED", 3, 4),
            ("amenity.towels", "Asks for extra towels",
             "Add a second towel set", "OBSERVED", 3, 4),
            ("comfort.temperature", "Sensitive to room temperature",
             "Pre-cool the room to 22°C an hour before check-in", "OBSERVED", 4, 5),
            ("food.vegetarian", "Orders vegetarian meals",
             "Lead with the vegetarian menu", "STATED", 2, 3),
            ("service.quiet", "Bothered by noise — needs a quiet room",
             "Assign a room away from the lift and road", "OBSERVED", 3, 4),
        ]
        for key, summary, prep, kind, observations, stays_seen in mem_seed:
            now_utc = datetime.now(UTC)
            db.add(
                GuestMemory(
                    guest_id=priya.id,
                    hotel_id=hotel.id,
                    key=key,
                    summary=summary,
                    value={"prep": prep, "category": "SEED"},
                    kind=kind,
                    status="ACTIVE",
                    observations=observations,
                    confidence=memory_service.score(observations, kind),
                    stays_seen=stays_seen,
                    first_seen_at=now_utc - timedelta(days=60),
                    last_seen_at=now_utc - timedelta(days=2),
                )
            )
        db.flush()
        counts["memories"] = db.query(GuestMemory).filter(GuestMemory.guest_id == priya.id).count()

    db.commit()

    counts["users"] = db.query(User).count()
    counts["rooms"] = db.query(Room).count()
    counts["pois"] = db.query(POI).count()
    return counts


__all__ = ["seed_database"]
