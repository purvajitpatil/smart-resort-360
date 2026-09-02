"""Predictive maintenance: surface systemic faults from repeated complaints.

The cheapest, most defensible form of predictive maintenance is pattern
detection. When the same class of fault (AC, lift, plumbing, power, wifi, TV)
appears across several maintenance requests inside a short rolling window, it
almost never means several independent failures — it means one shared root
cause (e.g. the central AC plant) is failing. Surfacing that before it hits
every room is the value.

Rule-based on purpose: no black-box model to defend in front of judges. The
heuristic is explicit, the thresholds are stated, and every alert carries the
request codes that triggered it so staff can verify.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.models.requests import ServiceRequest

WINDOW_DAYS = 7
ALERT_THRESHOLD = 3      # 3+ complaints in the window => systemic risk
HIGH_THRESHOLD = 5       # 5+ => clearly a central-system failure

FAULT_KEYWORDS: dict[str, tuple[str, ...]] = {
    "AC": ("ac", "air conditioning", "aircon", "cooling", "air con", "ac not", "cool"),
    "Lift": ("lift", "elevator"),
    "Plumbing": ("water", "leaking", "leak", "pipe", "plumbing", "tap", "drain"),
    "Electrical": ("electricity", "power", "light", "socket", "plug", "switch", "fuse"),
    "WiFi": ("wifi", "internet", "network", "connection"),
    "TV": ("tv", "television", "remote", "channel"),
}

FAULT_ALERTS: dict[str, tuple[str, str]] = {
    "AC": (
        "Inspect the central AC plant",
        "{count} AC complaints in {window} days — check the chiller/compressor before more rooms are affected",
    ),
    "Lift": (
        "Schedule lift maintenance immediately",
        "{count} lift complaints in {window} days — potential lift system fault",
    ),
    "Plumbing": (
        "Dispatch plumber to inspect risers",
        "{count} plumbing complaints in {window} days — possible pipe/pump issue",
    ),
    "Electrical": (
        "Check electrical distribution",
        "{count} electrical complaints in {window} days — possible circuit/panel fault",
    ),
    "WiFi": (
        "Investigate network infrastructure",
        "{count} WiFi complaints in {window} days — possible router/AP fault",
    ),
    "TV": (
        "Check TV/STB provisioning",
        "{count} TV complaints in {window} days — possible set-top/streaming fault",
    ),
}


def pattern_sweep(db: Session, hotel_id: int) -> list[dict]:
    """Return systemic-fault alerts from maintenance requests in the window."""
    cutoff = datetime.now(UTC) - timedelta(days=WINDOW_DAYS)
    reqs = (
        db.query(ServiceRequest)
        .filter(ServiceRequest.hotel_id == hotel_id, ServiceRequest.created_at >= cutoff)
        .all()
    )

    hits: dict[str, list[str]] = defaultdict(list)
    for req in reqs:
        text = f"{req.title} {req.description or ''}".lower()
        for fault, keywords in FAULT_KEYWORDS.items():
            if any(kw in text for kw in keywords):
                hits[fault].append(req.code)

    alerts = []
    for fault, codes in hits.items():
        count = len(codes)
        if count < ALERT_THRESHOLD:
            continue
        action, template = FAULT_ALERTS.get(fault, ("Investigate", "{count} {fault} complaints in {window} days"))
        severity = "HIGH" if count >= HIGH_THRESHOLD else "MEDIUM"
        alerts.append(
            {
                "fault": fault,
                "count": count,
                "request_codes": sorted(codes),
                "severity": severity,
                "window_days": WINDOW_DAYS,
                "alert": template.format(count=count, window=WINDOW_DAYS, fault=fault),
                "action": action,
            }
        )

    alerts.sort(key=lambda a: a["count"], reverse=True)
    return alerts


__all__ = ["pattern_sweep"]
