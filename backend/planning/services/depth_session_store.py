"""Temporary in-memory depth sessions — no permanent image storage.

Depth maps are held briefly so the browser can send session_id instead of
re-uploading the full depth tensor. Entries expire and are discarded.
JPEG camera frames are never stored here.
"""
from __future__ import annotations

import threading
import time
import uuid
from typing import Any, Dict, Optional

_lock = threading.Lock()
_STORE: Dict[str, Dict[str, Any]] = {}

DEFAULT_TTL_SEC = 30 * 60
MAX_ENTRIES = 64


def create_depth_session(payload: Dict[str, Any], *, ttl_sec: int = DEFAULT_TTL_SEC) -> str:
    """Store a depth payload; return opaque session_id."""
    sid = str(uuid.uuid4())
    expires = time.time() + max(60, int(ttl_sec))
    with _lock:
        _purge_locked()
        if len(_STORE) >= MAX_ENTRIES:
            oldest = min(_STORE.items(), key=lambda kv: kv[1].get("created", 0))
            _STORE.pop(oldest[0], None)
        _STORE[sid] = {
            "payload": payload,
            "expires": expires,
            "created": time.time(),
        }
    return sid


# Alias used by vision_measurement
put_depth_session = create_depth_session


def get_depth_session(session_id: str) -> Optional[Dict[str, Any]]:
    if not session_id:
        return None
    with _lock:
        _purge_locked()
        entry = _STORE.get(session_id)
        if not entry:
            return None
        if entry["expires"] < time.time():
            _STORE.pop(session_id, None)
            return None
        return entry["payload"]


def delete_depth_session(session_id: str) -> None:
    with _lock:
        _STORE.pop(session_id, None)


def clear_depth_sessions_for_tests() -> None:
    with _lock:
        _STORE.clear()


def _purge_locked() -> None:
    now = time.time()
    expired = [k for k, v in _STORE.items() if v.get("expires", 0) < now]
    for k in expired:
        _STORE.pop(k, None)
