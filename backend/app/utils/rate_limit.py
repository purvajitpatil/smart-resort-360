"""In-memory sliding-window rate limiter.

Sufficient for a single-process demo. Swap the store for Redis in production
without changing call sites (see CacheService abstraction for the pattern).
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque


class RateLimiter:
    def __init__(self, limit_per_minute: int) -> None:
        self.limit = limit_per_minute
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key: str) -> tuple[bool, int]:
        """Return (allowed, retry_after_seconds). Prunes expired hits."""
        now = time.monotonic()
        with self._lock:
            window = self._hits[key]
            while window and now - window[0] > 60.0:
                window.popleft()
            if len(window) >= self.limit:
                retry = 60.0 - (now - window[0]) if window else 0.0
                return False, int(retry) + 1
            window.append(now)
            return True, 0


rate_limiter = RateLimiter(240)
