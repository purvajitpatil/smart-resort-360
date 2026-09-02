"""Test support: build a minimal seeded world through a client's session."""

from __future__ import annotations

from datetime import date, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.auth import User
from app.models.guest import GuestPreferences, GuestProfile
from app.models.hotel import Booking, Department, Hotel, Room, Staff, Stay
from app.models.travel import POI


def _db(client: TestClient) -> Session:
    factory = client.app.state.session_local
    return factory()


def register(client: TestClient, email: str, role: str = "GUEST", password: str = "TestPass!123") -> dict:
    res = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "full_name": "Test " + role,
            "role": role.upper(),
        },
    )
    assert res.status_code == 200, res.text
    token = res.json()["data"]["access_token"]
    return {"token": token, "headers": {"Authorization": f"Bearer {token}"}, "email": email}


def make_world(client: TestClient, guest: dict, staff: dict | None = None) -> dict:
    db = _db(client)
    try:
        hotel = Hotel(name="Test Palace", city="Jaipur")
        db.add(hotel)
        db.flush()
        dept = Department(hotel_id=hotel.id, name="Housekeeping")
        db.add(dept)
        db.flush()
        room = Room(
            hotel_id=hotel.id,
            number="101",
            floor=1,
            room_type="Deluxe",
            status="OCCUPIED",
            capacity=2,
        )
        db.add(room)
        db.flush()

        guest_user = db.query(User).filter(User.email == guest["email"]).first()
        profile = GuestProfile(
            user_id=guest_user.id,
            full_name=guest_user.full_name,
            email=guest_user.email,
        )
        db.add(profile)
        db.flush()
        db.add(GuestPreferences(guest_id=profile.id, interests=["heritage", "food"]))
        booking = Booking(
            guest_id=profile.id,
            hotel_id=hotel.id,
            room_id=room.id,
            check_in=date.today(),
            check_out=date.today() + timedelta(days=3),
            status="CONFIRMED",
        )
        db.add(booking)
        db.flush()
        stay = Stay(
            booking_id=booking.id,
            guest_id=profile.id,
            room_id=room.id,
            hotel_id=hotel.id,
            check_in=booking.check_in,
            check_out=booking.check_out,
            status="ACTIVE",
        )
        db.add(stay)

        staff_data = {}
        if staff:
            staff_user = db.query(User).filter(User.email == staff["email"]).first()
            staff_row = Staff(
                user_id=staff_user.id,
                hotel_id=hotel.id,
                department_id=dept.id,
                position="Housekeeping Lead",
            )
            db.add(staff_row)
            db.flush()
            staff_data["row"] = staff_row

        pois = [
            POI(
                city="Jaipur",
                name="Amber Fort",
                description="Grand hilltop heritage fort",
                category="Heritage",
                sub_category="Fort",
                lat=26.9855,
                lng=75.8513,
                open_time="08:00",
                close_time="17:30",
                visit_minutes=120,
                price_level=1,
                rating=4.8,
                popularity=0.95,
                local_discovery=0.3,
                weather_sensitivity="HIGH",
                indoor=False,
                outdoor=True,
            ),
            POI(
                city="Jaipur",
                name="Chokhi Dhani",
                description="Heritage village dining and cultural food experience",
                category="Food",
                sub_category="Village",
                lat=26.8581,
                lng=75.7951,
                open_time="17:00",
                close_time="23:00",
                visit_minutes=150,
                price_level=2,
                rating=4.4,
                popularity=0.7,
                local_discovery=0.5,
                weather_sensitivity="LOW",
                indoor=False,
                outdoor=True,
            ),
            POI(
                city="Jaipur",
                name="City Palace Museum",
                description="Indoor museum of royal artefacts",
                category="Museum",
                sub_category="Palace",
                lat=26.9258,
                lng=75.8237,
                open_time="09:30",
                close_time="17:00",
                visit_minutes=100,
                price_level=1,
                rating=4.6,
                popularity=0.8,
                local_discovery=0.4,
                weather_sensitivity="LOW",
                indoor=True,
                outdoor=False,
            ),
        ]
        db.add_all(pois)
        db.commit()
        return {"hotel_id": hotel.id, "profile": profile, "room": room, "stay": stay}
    finally:
        db.close()
