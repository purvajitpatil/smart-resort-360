"""Guest profile + preferences orchestration."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.auth import User
from app.models.guest import GuestPreferences, GuestProfile
from app.schemas.guest import GuestProfileOut, PreferencesIn

_DEFAULT_PREFS: dict = {
    "interests": [],
    "budget": "medium",
    "pace": "moderate",
    "preferred_start_time": "09:00",
    "preferred_end_time": "21:00",
    "walking_tolerance": "medium",
    "food_preferences": [],
    "travel_group": "solo",
    "accessibility_requirements": [],
    "preferred_activity_duration": "medium",
}


def get_or_create_profile(db: Session, user: User) -> GuestProfile:
    profile = db.query(GuestProfile).filter(GuestProfile.user_id == user.id).first()
    if profile is not None:
        return profile
    profile = GuestProfile(user_id=user.id, full_name=user.full_name, email=user.email)
    db.add(profile)
    db.flush()
    db.add(GuestPreferences(guest_id=profile.id, **_DEFAULT_PREFS))
    db.commit()
    return profile


def my_profile(db: Session, user: User) -> GuestProfileOut:
    profile = get_or_create_profile(db, user)
    return _to_out(profile)


def update_preferences(db: Session, user: User, payload: PreferencesIn) -> GuestProfileOut:
    profile = get_or_create_profile(db, user)
    prefs = db.query(GuestPreferences).filter(GuestPreferences.guest_id == profile.id).first()
    if prefs is None:
        prefs = GuestPreferences(guest_id=profile.id, **payload.model_dump())
        db.add(prefs)
    else:
        for key, value in payload.model_dump().items():
            setattr(prefs, key, value)
    db.commit()
    return _to_out(profile)


def _to_out(profile: GuestProfile) -> GuestProfileOut:
    prefs = profile.preferences
    prefs_dict = dict(_DEFAULT_PREFS)
    if prefs is not None:
        prefs_dict.update({k: getattr(prefs, k, _DEFAULT_PREFS[k]) for k in _DEFAULT_PREFS})
    return GuestProfileOut(
        id=profile.id,
        full_name=profile.full_name,
        phone=profile.phone,
        email=profile.email,
        preferences=prefs_dict,
    )
