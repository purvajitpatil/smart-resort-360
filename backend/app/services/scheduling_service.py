"""Staff scheduling — weekly roster, coverage gaps, and occupancy-based forecast.

The whole module is rule-based and explainable. No ML, no heuristics that
aren't visible in the response. Every "needed staff" number traces back to
the occupancy forecast for that day, and every "gap" surfaces the delta.
"""

from __future__ import annotations

import math
from datetime import UTC, date, datetime, timedelta
from typing import Iterable

from sqlalchemy.orm import Session

from app.models.hotel import Department, Room, Staff, Stay

# --- Constants ----------------------------------------------------------------

SHIFT_DEFINITIONS = {
    "Morning":  {"start": "06:00", "end": "14:00", "label": "Morning (06:00–14:00)"},
    "Evening":  {"start": "14:00", "end": "22:00", "label": "Evening (14:00–22:00)"},
    "Night":    {"start": "22:00", "end": "06:00", "label": "Night (22:00–06:00)"},
}

# Required staff per shift per 25% of occupancy. Tweakable in one place.
# e.g. 75% occupancy → ceil(75/25) = 3 staff per shift for Housekeeping.
DEPARTMENT_COVERAGE_FACTOR = {
    "Front Desk":      30,   # 1 per 30% occupancy
    "Housekeeping":    25,
    "Concierge":       35,
    "Maintenance":     40,
    "Food & Beverage": 30,
    "Security":        50,
}

DEFAULT_COVERAGE_FACTOR = 30  # safe default for unknown departments


# --- Helpers ------------------------------------------------------------------


def _staffing_for_department(dept_name: str, occupancy_pct: float, shift: str) -> int:
    factor = DEPARTMENT_COVERAGE_FACTOR.get(dept_name, DEFAULT_COVERAGE_FACTOR)
    needed = max(1, math.ceil(occupancy_pct / factor))
    # Night shift is leaner
    if shift == "Night":
        needed = max(1, math.ceil(needed * 0.6))
    return needed


def _occupancy_for_date(db: Session, hotel_id: int, target: date) -> float:
    """Project occupancy for a future date.

    Heuristic (explainable, no ML):
    - floor = currently-booked rooms / total rooms
    - day-of-week boost: Fri/Sat add 12%, Sun add 6%
    - history blend: if we have stays data from the same day-of-week in the
      last 30 days, use that historical average occupancy.
    """
    total_rooms = db.query(Room).filter(Room.hotel_id == hotel_id).count()
    if total_rooms == 0:
        return 0.0

    # Booked = active or future stays whose window covers target
    booked = (
        db.query(Stay)
        .filter(
            Stay.hotel_id == hotel_id,
            Stay.check_in <= target,
            Stay.check_out >= target,
        )
        .count()
    )
    floor_pct = min(100.0, (booked / total_rooms) * 100)

    # Day-of-week boost
    dow = target.weekday()  # Mon=0
    boost = 0.0
    if dow in (4, 5):  # Fri, Sat
        boost = 12.0
    elif dow == 6:  # Sun
        boost = 6.0

    # Historical blend
    hist_avg = _historical_avg_for_dow(db, hotel_id, dow, total_rooms)
    if hist_avg is not None:
        # Weighted blend: 40% historical, 60% current floor
        return round(min(100.0, hist_avg * 0.4 + floor_pct * 0.6 + boost), 1)

    return round(min(100.0, floor_pct + boost), 1)


def _historical_avg_for_dow(db: Session, hotel_id: int, dow: int, total_rooms: int) -> float | None:
    """Average occupancy on this day-of-week across the last 30 days of stays."""
    if total_rooms == 0:
        return None
    cutoff = date.today() - timedelta(days=30)
    rows: list[tuple[date, date]] = (
        db.query(Stay.check_in, Stay.check_out)
        .filter(Stay.hotel_id == hotel_id, Stay.check_in >= cutoff)
        .all()
    )
    if not rows:
        return None
    total_occ = 0
    days_counted = 0
    for check_in, check_out in rows:
        nights = (check_out - check_in).days or 1
        # Credit each night to the day-of-week it falls on
        for n in range(nights):
            day = check_in + timedelta(days=n)
            if day.weekday() == dow:
                total_occ += 1
                days_counted += 1
    if days_counted == 0:
        return None
    avg_rooms = total_occ / days_counted
    return min(100.0, (avg_rooms / total_rooms) * 100)


def _gap_severity(delta: int) -> str:
    if delta >= 3:
        return "CRITICAL"
    if delta == 2:
        return "HIGH"
    if delta == 1:
        return "MEDIUM"
    return "OK"


# --- Roster -------------------------------------------------------------------


def weekly_roster(db: Session, hotel_id: int, start: date | None = None) -> dict:
    """Return a 7-day roster starting at `start` (defaults to today).

    Each day shows per-department per-shift staff lists with a coverage gap
    column and an AI-suggested headcount.
    """
    if start is None:
        start = date.today()
    end = start + timedelta(days=6)

    departments = db.query(Department).filter(Department.hotel_id == hotel_id).all()
    if not departments:
        # Provide a default list so the UI has something to render
        departments = [
            Department(id=0, hotel_id=hotel_id, name="Front Desk", color="indigo"),
            Department(id=0, hotel_id=hotel_id, name="Housekeeping", color="emerald"),
            Department(id=0, hotel_id=hotel_id, name="Concierge", color="amber"),
            Department(id=0, hotel_id=hotel_id, name="Maintenance", color="rose"),
        ]

    all_staff = db.query(Staff).filter(Staff.hotel_id == hotel_id).all()
    # Group staff by department name (uses the Department FK relationship)
    dept_by_id = {d.id: d for d in departments}
    staff_by_dept: dict[str, list[Staff]] = {}
    for s in all_staff:
        dept_obj = dept_by_id.get(s.department_id)
        dept_name = dept_obj.name if dept_obj else (s.position or "Unassigned")
        staff_by_dept.setdefault(dept_name, []).append(s)

    days_out: list[dict] = []
    for i in range(7):
        d = start + timedelta(days=i)
        occ_pct = _occupancy_for_date(db, hotel_id, d)

        dept_rows: list[dict] = []
        for dept in departments:
            shifts: list[dict] = []
            for shift_name, shift_info in SHIFT_DEFINITIONS.items():
                assigned = [s for s in staff_by_dept.get(dept.name, []) if s.shift == shift_name]
                needed = _staffing_for_department(dept.name, occ_pct, shift_name)
                delta = needed - len(assigned)
                severity = _gap_severity(max(delta, 0))
                shifts.append({
                    "shift": shift_name,
                    "shift_label": shift_info["label"],
                    "start": shift_info["start"],
                    "end": shift_info["end"],
                    "assigned": [
                        {"id": s.id, "name": s.user.full_name if s.user else f"Staff #{s.id}", "position": s.position or ""}
                        for s in assigned
                    ],
                    "needed": needed,
                    "available": len(assigned),
                    "gap": max(delta, 0),
                    "severity": severity,
                })
            dept_rows.append({
                "department": dept.name,
                "color": dept.color or "indigo",
                "shifts": shifts,
            })

        days_out.append({
            "date": d.isoformat(),
            "day_of_week": d.strftime("%A"),
            "is_today": d == date.today(),
            "is_weekend": d.weekday() >= 5,
            "occupancy_pct": occ_pct,
            "departments": dept_rows,
        })

    return {
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "days": days_out,
        "total_staff": len(all_staff),
    }


def coverage_analysis(db: Session, hotel_id: int, start: date | None = None) -> list[dict]:
    """Flatten the roster into a list of coverage gaps."""
    roster = weekly_roster(db, hotel_id, start)
    gaps: list[dict] = []
    for day in roster["days"]:
        for dept in day["departments"]:
            for shift in dept["shifts"]:
                if shift["gap"] > 0:
                    gaps.append({
                        "date": day["date"],
                        "day_of_week": day["day_of_week"],
                        "department": dept["department"],
                        "shift": shift["shift"],
                        "needed": shift["needed"],
                        "available": shift["available"],
                        "gap": shift["gap"],
                        "severity": shift["severity"],
                        "occupancy_pct": day["occupancy_pct"],
                        "recommendation": _recommendation(dept["department"], shift, day["occupancy_pct"]),
                    })
    gaps.sort(key=lambda g: (-g["gap"], g["date"], g["shift"]))
    return gaps


def _recommendation(department: str, shift: dict, occ_pct: float) -> str:
    if shift["available"] == 0:
        return f"Add at least {shift['needed']} {department} for {shift['shift']} shift ({int(occ_pct)}% projected occupancy)."
    return f"Add {shift['gap']} {department} for {shift['shift']} shift to cover {int(occ_pct)}% occupancy."


def occupancy_forecast(db: Session, hotel_id: int, days: int = 7, start: date | None = None) -> list[dict]:
    """Return per-day occupancy projection with staffing recommendations."""
    if start is None:
        start = date.today()
    out: list[dict] = []
    for i in range(days):
        d = start + timedelta(days=i)
        occ = _occupancy_for_date(db, hotel_id, d)
        # Aggregate: pick the most-staffed department count as the day's ask
        needed_total = sum(
            _staffing_for_department(dept, occ, shift)
            for dept in DEPARTMENT_COVERAGE_FACTOR
            for shift in SHIFT_DEFINITIONS
        )
        out.append({
            "date": d.isoformat(),
            "day_of_week": d.strftime("%a"),
            "is_weekend": d.weekday() >= 5,
            "predicted_occupancy_pct": occ,
            "staffing_needed_total": needed_total,
            "band": "HIGH" if occ >= 85 else "MEDIUM" if occ >= 60 else "LOW",
        })
    return out


def scheduling_insight(db: Session, hotel_id: int) -> dict:
    """Compact summary for the daily brief."""
    gaps = coverage_analysis(db, hotel_id)
    critical = sum(1 for g in gaps if g["severity"] == "CRITICAL")
    high = sum(1 for g in gaps if g["severity"] == "HIGH")
    forecast = occupancy_forecast(db, hotel_id, days=7)
    avg_occ = round(sum(f["predicted_occupancy_pct"] for f in forecast) / max(len(forecast), 1), 1)
    peak = max(forecast, key=lambda f: f["predicted_occupancy_pct"]) if forecast else None
    return {
        "total_gaps": len(gaps),
        "critical_gaps": critical,
        "high_gaps": high,
        "avg_forecast_occupancy_7d": avg_occ,
        "peak_day": peak["date"] if peak else None,
        "peak_occupancy_pct": peak["predicted_occupancy_pct"] if peak else None,
        "available": True,
    }
