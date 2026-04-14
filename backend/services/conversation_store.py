"""
conversation_store.py — Thread-safe JSON persistence for chat sessions.

Structure of conversations.json:
{
  "sessions": {
    "<session_id>": {
      "title": "string",
      "created_at": "iso",
      "branches": {
        "<branch_id>": {
          "label": "string",
          "created_at": "iso",
          "messages": [
            {
              "id": "uuid",
              "role": "user|assistant",
              "content": "string",
              "timestamp": "iso",
              "research_data": null | {sources, contradictions, perspectives, query_used}
            }
          ]
        }
      }
    }
  }
}
"""

import json
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

DATA_FILE = Path(__file__).parent.parent / "data" / "conversations.json"

_lock = threading.Lock()
_data_cache: Optional[dict] = None


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load() -> dict:
    global _data_cache
    if _data_cache is not None:
        return _data_cache
    if DATA_FILE.exists():
        try:
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                _data_cache = json.load(f)
                return _data_cache
        except (json.JSONDecodeError, OSError):
            pass
    _data_cache = {"sessions": {}}
    return _data_cache


def _save(data: dict) -> None:
    global _data_cache
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    _data_cache = data


def create_session(title: str = "New conversation") -> tuple[str, str]:
    """Create a new session with one default branch. Returns (session_id, branch_id)."""
    with _lock:
        data = _load()
        sid = str(uuid.uuid4())
        bid = str(uuid.uuid4())
        data["sessions"][sid] = {
            "title": title,
            "created_at": _now(),
            "branches": {
                bid: {
                    "label": "main",
                    "created_at": _now(),
                    "messages": [],
                }
            },
        }
        _save(data)
    return sid, bid


def get_sessions() -> list[dict]:
    """Return all sessions sorted by created_at descending."""
    with _lock:
        data = _load()
    sessions = []
    for sid, s in data["sessions"].items():
        branches = []
        for bid, b in s.get("branches", {}).items():
            branches.append({
                "id": bid,
                "label": b.get("label", "main"),
                "message_count": len(b.get("messages", [])),
                "created_at": b.get("created_at", ""),
            })
        sessions.append({
            "id": sid,
            "title": s.get("title", "New conversation"),
            "created_at": s.get("created_at", ""),
            "branches": branches,
        })
    sessions.sort(key=lambda x: x["created_at"], reverse=True)
    return sessions


def get_branch_messages(session_id: str, branch_id: str) -> list[dict]:
    """Return messages for a specific branch."""
    with _lock:
        data = _load()
    session = data["sessions"].get(session_id)
    if not session:
        return []
    branch = session["branches"].get(branch_id)
    if not branch:
        return []
    return list(branch.get("messages", []))


def add_message(session_id: str, branch_id: str, message: dict) -> None:
    """Append a message dict to the branch."""
    with _lock:
        data = _load()
        session = data["sessions"].get(session_id)
        if not session:
            return
        branch = session["branches"].get(branch_id)
        if not branch:
            return
        branch.setdefault("messages", []).append(message)
        _save(data)


def fork_branch(session_id: str, from_message_id: str, label: Optional[str] = None) -> str:
    """Create a new branch from a specific message (inclusive). Returns new branch_id."""
    with _lock:
        data = _load()
        session = data["sessions"].get(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        # Find the message across all branches
        source_msgs: list[dict] = []
        for b in session["branches"].values():
            msgs = b.get("messages", [])
            for i, m in enumerate(msgs):
                if m["id"] == from_message_id:
                    source_msgs = msgs[: i + 1]
                    break
            if source_msgs:
                break

        if not source_msgs:
            raise ValueError(f"Message {from_message_id} not found in session {session_id}")

        new_bid = str(uuid.uuid4())
        session["branches"][new_bid] = {
            "label": label or "Fork",
            "created_at": _now(),
            "messages": [dict(m) for m in source_msgs],
        }
        _save(data)
    return new_bid


def update_session_title(session_id: str, title: str) -> None:
    """Update the auto-generated title of a session."""
    with _lock:
        data = _load()
        if session_id in data["sessions"]:
            data["sessions"][session_id]["title"] = title
            _save(data)
