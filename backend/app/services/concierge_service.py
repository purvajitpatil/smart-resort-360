"""Rule-based AI concierge with real tool-calling.

The concierge never invents answers. It routes a guest's message to an intent,
executes real business tools against the live database (recommendations,
itinerary planning, replanning, service requests, weather) and explains what
each tool did. ``mode`` is always honest: ``rules`` by default; ``llm`` only
when an OpenAI-compatible provider is configured (``LLM_PROVIDER != local`` +
``LLM_API_KEY``), and even then the reply is phrased from the same real tool
results. On any LLM failure the rule composer takes over (Live → Curated).
"""

from __future__ import annotations

import re
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.config import settings
from app.models.auth import User
from app.models.chat import ChatMessage, ChatSession
from app.models.guest import GuestProfile
from app.models.hotel import Hotel
from app.models.travel import POI
from app.schemas.concierge import ChatMessageOut, ChatReplyOut, ConversationOut, ToolCallOut
from app.schemas.travel import DisruptionIn, ItineraryCreateIn
from app.services import guest_service, planner_service, recommend_service, requests_service
from app.utils.responses import ApiError

_SESSION_TITLE = "Travel concierge"

_REQUEST_KEYWORDS: list[tuple[str, str, str]] = [
    (
        "HOUSEKEEPING",
        "towels|towel|pillow|pillows|sheets|blanket|extra (bedding|linen)|clean the room",
        "housekeeping",
    ),
    ("TRANSPORT", "taxi|cab|airport|pickup|drop|transport|car", "transport"),
    ("DINING", "food|thali|meal|dinner|lunch|breakfast|restaurant|coffee|water|mini ?bar", "room service"),
    ("LAUNDRY", "laundry|wash|iron", "laundry"),
    ("MAINTENANCE", "ac |a/c|air ?condition|leak|bulb|broken|wifi|internet|repair", "maintenance"),
    ("FRONT_DESK", "checkout|later checkout|late check|tv|billing|invoice|keys", "front desk"),
]


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower())


def parse_intent(text: str) -> tuple[str, dict[str, object]]:
    t = _normalize(text)
    lower = " " + t + " "
    params: dict[str, object] = {}

    if any(
        word in lower
        for word in (" hello", " hi ", " hey", " namaste", "good morning", "good evening", "good afternoon")
    ):
        return "greeting", params
    if any(word in lower for word in ("help", " what can you do", "how do i", "which things", "assist")):
        return "help", params
    if any(
        word in lower
        for word in (
            "replan",
            "re-plan",
            "revise",
            "weather changed",
            "change my plan",
            "new plan",
            "plan again",
        )
    ):
        params["rain"] = "rain" in lower or "weather" in lower
        return "replan", params
    if any(
        word in lower
        for word in ("plan", "itinerary", "schedule", "build me", "make me", "day trip", "a day out", "route")
    ):
        days = _day_count(t)
        start = _start_date(lower)
        params["days"] = days
        params["start"] = start.isoformat()
        return "plan", params

    matched = next((m for m in _REQUEST_KEYWORDS if re.search(m[1], lower)), None)
    if matched is not None:
        params["category"] = matched[0]
        params["title"] = text.strip()
        params["priority"] = (
            "HIGH"
            if any(w in lower for w in ("urgently", "urgent", "asap", "immediately", "right now"))
            else "MEDIUM"
        )
        return "request", params

    if any(word in lower for word in ("weather", " forecast", "rain", "temperature", "temp")):
        return "weather", params
    if any(
        word in lower
        for word in (
            "recommend",
            "suggest",
            "what to do",
            "do today",
            "things to do",
            "explore",
            "must see",
            "sightseeing",
            "best",
            "places",
            "top",
        )
    ):
        params["limit"] = 5
        return "recommend", params
    return "clarify", params


def _day_count(text: str) -> int:
    words = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "couple": 2}
    for word, value in words.items():
        if re.search(rf"\b{word}\b", text):
            return value
    match = re.search(r"(\d+)\s*(?:days?|day)", text)
    if match:
        return min(7, max(1, int(match.group(1))))
    return 1


def _start_date(lower: str) -> date:
    if "tomorrow" in lower:
        return date.today() + timedelta(days=1)
    return date.today()


def _guest_hotel(db: Session, profile: GuestProfile) -> Hotel | None:
    stay = None
    try:
        from app.services import hotel_service

        stay = hotel_service.current_stay(db, profile)
    except Exception:  # noqa: BLE001
        stay = None
    if stay is not None and stay.room and stay.room.hotel_id:
        hotel = db.get(Hotel, stay.room.hotel_id)
        if hotel is not None:
            return hotel
    return db.query(Hotel).first()


def _tool_weather(db: Session) -> ToolCallOut:
    weather = recommend_service.latest_weather(db)
    if weather is None:
        return ToolCallOut(tool="weather", status="ok", summary="No live weather captured for Jaipur yet.")
    detail = {
        "condition": weather.condition,
        "temp_c": weather.temp_c,
        "precip_mm": weather.precip_mm,
        "captured_at": weather.recorded_at.isoformat(timespec="minutes") if weather.recorded_at else None,
    }
    summary = f"Current in Jaipur: {weather.condition}, {weather.temp_c}°C."
    return ToolCallOut(tool="weather", status="ok", summary=summary, detail=detail)


def _tool_recommend(db: Session, profile: GuestProfile, limit: int = 5) -> ToolCallOut:
    out = recommend_service.recommend(db, profile, limit=limit)
    detail = {
        "based_on": out.based_on,
        "items": [
            {"name": item.poi.name, "category": item.poi.category, "score": item.score, "reason": item.reason}
            for item in out.items
        ],
    }
    return ToolCallOut(
        tool="recommend",
        status="ok",
        summary=f"Top {len(out.items)} picks scored from real attributes.",
        detail=detail,
    )


def _tool_plan(db: Session, profile: GuestProfile, start: str, days: int, message: str) -> ToolCallOut:
    hotel = _guest_hotel(db, profile)
    if hotel is None:
        return ToolCallOut(tool="plan", status="error", summary="No hotel is configured yet.")
    prefs = profile.preferences
    start_time = getattr(prefs, "preferred_start_time", None) or "09:00"
    end_time = getattr(prefs, "preferred_end_time", None) or "21:00"
    try:
        out = planner_service.create(
            db,
            profile,
            hotel,
            ItineraryCreateIn(start_date=start, days=days, start_time=start_time, end_time=end_time),
        )
    except ApiError as exc:
        return ToolCallOut(tool="plan", status="error", summary=exc.detail.get("message", str(exc.detail)))
    stops = sum(len(day.stops) for day in out.days)
    return ToolCallOut(
        tool="plan",
        status="ok",
        summary=f"Built a {days}-day route from {out.start_date} with {stops} stops.",
        detail={"itinerary_id": out.id, "days": len(out.days), "stops": stops, "score": out.score},
    )


def _tool_replan(db: Session, profile: GuestProfile) -> ToolCallOut:
    listing = planner_service.list_for_guest(db, profile)
    if not listing.items:
        return ToolCallOut(tool="replan", status="skipped", summary="You have no itinerary to replan yet.")
    itinerary = planner_service.get(db, listing.items[0].id)
    if itinerary is None:
        return ToolCallOut(
            tool="replan", status="skipped", summary="Your latest itinerary could not be loaded."
        )

    stops = [s for d in planner_service._days(db, itinerary) for s in planner_service._stops_of_day(db, d)]
    planned = [s for s in stops if s.status == "PLANNED"]
    sensitive = []
    for s in planned:
        if s.poi_id:
            poi = db.get(POI, s.poi_id)
            if poi is not None and poi.outdoor and poi.weather_sensitivity == "HIGH":
                sensitive.append(s)
    targets = sensitive or planned[:3]
    if not targets:
        return ToolCallOut(
            tool="replan", status="skipped", summary="Nothing planned to rebuild after the weather change."
        )
    disruption = DisruptionIn(
        event_type="WEATHER",
        severity="MEDIUM",
        message="Heavy rain is expected — rebuilding outdoor stops",
        affected_stop_ids=[s.id for s in targets],
    )
    try:
        _, _, changes = planner_service.replan(db, itinerary.id, disruption)
    except ApiError as exc:
        return ToolCallOut(tool="replan", status="error", summary=exc.detail.get("message", str(exc.detail)))
    return ToolCallOut(
        tool="replan",
        status="ok",
        summary=(
            f"Replanned day 1: {len(targets)} stop(s) rebuilt to weather-safe picks "
            f"({changes} total changes)."
        ),
        detail={"itinerary_id": itinerary.id, "targeted_stops": len(targets), "changes": changes},
    )


def _tool_request(db: Session, profile: GuestProfile, text: str, category: str, priority: str) -> ToolCallOut:
    payload = requests_service.RequestCreateIn(
        category=category,
        title=text.strip()[:90] or category,
        description=text.strip(),
        quantity=1,
        priority=priority,
    )
    try:
        out = requests_service.create(db, profile, payload)
    except ApiError as exc:
        return ToolCallOut(tool="request", status="error", summary=exc.detail.get("message", str(exc.detail)))
    return ToolCallOut(
        tool="request",
        status="ok",
        summary=f"Request {out.code} created — sent to {out.department or 'the team'} ({out.status}).",
        detail={"code": out.code, "category": out.category, "priority": out.priority, "status": out.status},
    )


def _tool_help() -> ToolCallOut:
    return ToolCallOut(
        tool="help",
        status="ok",
        summary=(
            "I can recommend places, build or replan your itinerary, report the weather "
            "and raise service requests."
        ),
        detail={"capabilities": ["recommend", "plan", "replan", "weather", "request"]},
    )


_TOOL_ROUTES = {
    "weather": lambda db, profile, params, text: [_tool_weather(db)],
    "recommend": lambda db, profile, params, text: [
        _tool_recommend(db, profile, int(params.get("limit", 5)))
    ],
    "plan": lambda db, profile, params, text: [
        _tool_plan(db, profile, str(params["start"]), int(params["days"]), text)
    ],
    "replan": lambda db, profile, params, text: [_tool_replan(db, profile)],
    "request": lambda db, profile, params, text: [
        _tool_request(db, profile, str(params["title"]), str(params["category"]), str(params["priority"]))
    ],
    "help": lambda db, profile, params, text: [_tool_help()],
    "clarify": lambda db, profile, params, text: [_tool_help()],
}


def handle(db: Session, user: User, text: str) -> ChatReplyOut:
    profile = guest_service.get_or_create_profile(db, user)
    intent, params = parse_intent(text)

    if intent == "greeting":
        reply = (
            f"Namaste, {profile.full_name}! I'm your Smart Resort 360 concierge. I can recommend places "
            "that match your tastes, plan your days, rebuild your plan when the weather turns, "
            "and raise requests like towels, a taxi or dinner — all against your live stay data."
        )
        message = _persist(db, profile, user, text, intent, reply, [], "rules")
        return _to_reply(message)

    tool_calls = []
    if intent in _TOOL_ROUTES:
        tool_calls = _TOOL_ROUTES[intent](db, profile, params, text)

    mode = "rules"
    if _llm_used():
        phrased = _compose_llm(profile, intent, tool_calls)
        if phrased:
            mode = "llm"
    reply = (
        _compose_rules(profile, intent, tool_calls)
        if mode == "rules"
        else phrased or _compose_rules(profile, intent, tool_calls)
    )

    message = _persist(db, profile, user, text, intent, reply, tool_calls, mode)
    return _to_reply(message)


def _persist(
    db: Session,
    profile: GuestProfile,
    user: User,
    user_text: str,
    intent: str,
    reply: str,
    tool_calls: list[ToolCallOut],
    mode: str,
) -> ChatMessage:
    session = (
        db.query(ChatSession)
        .filter(ChatSession.guest_id == profile.id)
        .order_by(ChatSession.id.desc())
        .first()
    )
    if session is None:
        session = ChatSession(guest_id=profile.id, title=_SESSION_TITLE)
        db.add(session)
        db.flush()

    db.add(ChatMessage(session_id=session.id, role="USER", content=user_text))
    payload = {
        "intent": intent,
        "mode": mode,
        "calls": [t.model_dump() for t in tool_calls],
    }
    db.add(ChatMessage(session_id=session.id, role="ASSISTANT", content=reply, tool_calls=payload))
    db.commit()
    return (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.id.desc())
        .first()
    )


def _to_reply(message: ChatMessage) -> ChatReplyOut:
    tool_calls = []
    intent = None
    mode = "rules"
    if message.tool_calls:
        intent = message.tool_calls.get("intent")
        mode = message.tool_calls.get("mode", "rules")
        tool_calls = [ToolCallOut(**call) for call in message.tool_calls.get("calls", [])]
    actions = _suggested_actions(intent)

    # Build a ChatMessageOut so the frontend gets meta/routed_to info
    msg_out = _message_out(message)

    return ChatReplyOut(
        assistant=message.content,
        intent=intent or "",
        mode=mode,
        tool_calls=tool_calls,
        actions=actions,
        reply=message.content,
        message=msg_out,
    )


def _suggested_actions(intent: str | None) -> list[str]:
    return {
        "recommend": ["Plan my day", "Send laundry up", "What's the weather now?"],
        "plan": ["Replan for rain", "Suggest more places", "Send towels to my room"],
        "replan": ["Show my new plan", "What's the weather now?", "Book a taxi tomorrow"],
        "weather": ["Suggest things to do", "Plan a day tomorrow", "Order dinner"],
        "request": ["Suggest things to do", "Track my request", "Replan for rain"],
        "help": ["Suggest things to do", "Plan tomorrow", "Send towels to my room"],
    }.get(intent or "", ["Suggest things to do", "Plan tomorrow", "Send towels to my room"])


def _compose_rules(profile: GuestProfile, intent: str, tool_calls: list[ToolCallOut]) -> str:
    if not tool_calls:
        return "I can help you with that — try one of the suggested actions below."
    parts = [f"{call.summary}" for call in tool_calls]
    return " ".join(parts)


def _llm_used() -> bool:
    return settings.llm_provider.lower() != "local" and bool(settings.llm_api_key and settings.llm_base_url)


def _compose_llm(profile: GuestProfile, intent: str, tool_calls: list[ToolCallOut]) -> str | None:
    """Phrase the final reply from real tool results using a configured provider."""
    try:
        import httpx

        payload = {
            "model": settings.llm_model or "default",
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are the Smart Resort 360 hotel concierge. You may ONLY summarize the supplied "
                        "tool results factually and warmly. Never invent facts, times or places."
                    ),
                },
                {
                    "role": "user",
                    "content": f"Guest: {profile.full_name}. Intent: {intent}.\nTool results:\n"
                    + "\n".join(f"- {t.tool}: {t.summary}" for t in tool_calls),
                },
            ],
            "temperature": 0.2,
            "max_tokens": 220,
        }
        headers = {"Authorization": f"Bearer {settings.llm_api_key}"}
        base = settings.llm_base_url.rstrip("/")
        resp = httpx.post(f"{base}/chat/completions", json=payload, headers=headers, timeout=20)
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"].strip()
        return content or None
    except Exception:  # noqa: BLE001 - fall back to the curated rule composer
        return None


def conversation(db: Session, user: User) -> ConversationOut:
    profile = guest_service.get_or_create_profile(db, user)
    session = (
        db.query(ChatSession)
        .filter(ChatSession.guest_id == profile.id)
        .order_by(ChatSession.id.desc())
        .first()
    )
    if session is None:
        return ConversationOut(id=0, guest_id=profile.id, title=_SESSION_TITLE, created_at="", messages=[])
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.id.asc())
        .all()
    )
    message_outs = [_message_out(m) for m in messages]
    last_assistant = next((m for m in reversed(message_outs) if m.role == "assistant"), None)
    return ConversationOut(
        id=session.id,
        guest_id=session.guest_id,
        title=session.title,
        created_at=session.created_at.isoformat(timespec="seconds"),
        messages=message_outs,
        reply=last_assistant,
    )


def reset(db: Session, user: User) -> None:
    profile = guest_service.get_or_create_profile(db, user)
    sessions = db.query(ChatSession).filter(ChatSession.guest_id == profile.id).all()
    for session in sessions:
        db.query(ChatMessage).filter(ChatMessage.session_id == session.id).delete()
        db.delete(session)
    db.commit()


def _message_out(message: ChatMessage) -> ChatMessageOut:
    intent = None
    calls: list[ToolCallOut] = []
    if message.tool_calls:
        intent = message.tool_calls.get("intent")
        calls = [ToolCallOut(**call) for call in message.tool_calls.get("calls", [])]

    # Extract routed_to from tool_calls for the meta field
    routed_to: str | None = None
    for call in calls:
        detail = call.detail or {}
        routed_to = detail.get("department") or detail.get("category") or routed_to

    return ChatMessageOut(
        id=message.id,
        role=message.role,
        content=message.content,
        intent=intent,
        tool_calls=calls,
        created_at=message.created_at.isoformat(timespec="seconds"),
        tool_calls_raw=message.tool_calls,
        meta={"intent": intent, "routed_to": routed_to},
    )


__all__ = ["conversation", "handle", "parse_intent", "reset"]
