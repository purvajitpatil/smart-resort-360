"""AI concierge chat + notification inbox contracts."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ToolCallOut(BaseModel):
    tool: str
    status: str
    summary: str
    detail: dict = Field(default_factory=dict)


class ChatMessageOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: int
    role: str
    content: str
    intent: str | None = None
    created_at: str
    tool_calls_raw: dict[str, Any] | None = Field(default=None, alias="tool_calls")
    # Alias the frontend expects for the text content
    message: str = Field(default="", description="Alias for content", validation_alias="content")
    # Routing metadata exposed for the chat UI
    meta: dict[str, Any] = Field(
        default_factory=dict,
        description="Exposes routing/department from tool_calls for the frontend UI",
    )

    @field_validator("tool_calls_raw", mode="before")
    @classmethod
    def _normalize_tool_calls(cls, v: Any) -> dict[str, Any] | None:
        """Accept dict (DB) or list[dict] (serialised ToolCallOut list)."""
        if v is None:
            return None
        if isinstance(v, dict):
            return v
        if isinstance(v, list):
            # Serialised from ToolCallOut model_dump() — keep as-is for now
            return {"calls": v}
        return None

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "ChatMessageOut":
        """Build from a DB-loaded row (tool_calls stored as dict)."""
        tc = raw.get("tool_calls") or {}
        intent = tc.get("intent")
        routed_to: str | None = None
        for call in tc.get("calls", []):
            detail = call.get("detail", {})
            routed_to = detail.get("department") or detail.get("category") or routed_to

        return cls(
            id=raw["id"],
            role=raw["role"],
            content=raw["content"],
            intent=intent,
            created_at=raw["created_at"],
            tool_calls_raw=tc if isinstance(tc, dict) else None,
            meta={"intent": intent, "routed_to": routed_to},
        )

    def get_assistant_message(self) -> "ChatMessageOut":
        """Return a ChatMessageOut suitable for the frontend message pattern."""
        return ChatMessageOut(
            id=self.id,
            role=self.role,
            content=self.content,
            intent=self.intent,
            created_at=self.created_at,
            tool_calls_raw=self.tool_calls_raw,
            meta=self.meta,
        )


class ConversationOut(BaseModel):
    id: int
    guest_id: int
    title: str
    created_at: str
    messages: list[ChatMessageOut] = Field(default_factory=list)
    # Expose the last assistant message as 'reply' for the frontend's reply.message pattern
    reply: ChatMessageOut | None = Field(default=None)


class ChatReplyOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    # Primary fields
    assistant: str = Field(validation_alias="content", description="The text reply from the concierge")
    intent: str
    mode: str
    tool_calls: list[ToolCallOut] = Field(default_factory=list)
    actions: list[str] = Field(default_factory=list)
    # Aliases the guest-app frontend expects (reply.message pattern)
    reply: str = Field(default="", description="Alias for assistant (reply text)")
    message: ChatMessageOut | None = Field(default=None, description="Full message object with meta")

    @field_validator("reply", mode="before")
    @classmethod
    def _alias_reply(cls, v: Any, info: Any) -> str:
        if v:
            return v
        # Pull from assistant field
        return info.data.get("assistant", "")

    def to_reply_dict(self) -> dict[str, Any]:
        """Render a dict that satisfies the guest-app frontend pattern."""
        out = self.model_dump(by_alias=True)
        # Ensure reply is the text
        out["reply"] = self.assistant
        return out


class ChatIn(BaseModel):
    """Body of POST /chat/messages.

    The frontend has been known to use ``content`` in some code paths; accept
    both so a typo in the UI doesn't take the demo out at the worst moment.
    """

    message: str | None = Field(default=None, min_length=1, max_length=2000, alias="message")
    content: str | None = Field(default=None, min_length=1, max_length=2000, alias="content")

    @field_validator("content", mode="before")
    @classmethod
    def _noop(cls, v: Any) -> Any:
        return v

    def resolve(self) -> str:
        return (self.content or self.message or "").strip()


class NotificationOut(BaseModel):
    id: int
    channel: str
    title: str
    body: str
    read: bool
    demo: bool
    created_at: str


class NotificationsOut(BaseModel):
    items: list[NotificationOut]
    total: int
    unread: int


class NotificationSendIn(BaseModel):
    guest_id: int | None = None
    series: str = Field(default="whatsapp", max_length=16)
    title: str = Field(min_length=1, max_length=120)
    body: str = Field(min_length=1, max_length=2000)
