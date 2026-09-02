"""Central model registry — importing this creates all tables."""

from app.models.auth import User, UserRole
from app.models.base import Base
from app.models.chat import ChatMessage, ChatSession
from app.models.guest import Group, GroupMember, GroupVote, GuestPreferences, GuestProfile
from app.models.hotel import Booking, Department, Hotel, Room, Staff, Stay
from app.models.inbox import InboxNotification
from app.models.inventory import InventoryItem
from app.models.memory import GuestMemory, MemoryApplication, MemoryKind, MemoryStatus
from app.models.payments import Feedback, Notification, Payment
from app.models.requests import RequestStatusHistory, ServiceRequest
from app.models.travel import (
    POI,
    DisruptionEvent,
    Itinerary,
    ItineraryDay,
    ItineraryStop,
    POICategory,
    Recommendation,
    WeatherEvent,
)

__all__ = [
    "Base",
    "User",
    "UserRole",
    "Hotel",
    "Department",
    "Staff",
    "Room",
    "Booking",
    "Stay",
    "GuestProfile",
    "GuestPreferences",
    "Group",
    "GroupMember",
    "GroupVote",
    "InventoryItem",
    "ServiceRequest",
    "RequestStatusHistory",
    "POI",
    "POICategory",
    "Itinerary",
    "ItineraryDay",
    "ItineraryStop",
    "Recommendation",
    "WeatherEvent",
    "DisruptionEvent",
    "ChatSession",
    "ChatMessage",
    "InboxNotification",
    "GuestMemory",
    "MemoryApplication",
    "MemoryKind",
    "MemoryStatus",
    "Notification",
    "Payment",
    "Feedback",
]
