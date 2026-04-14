"""
routers/notes.py — lightweight notes API + AI suggestions.
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address

from services.registry import llm_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/notes", tags=["notes"])
limiter = Limiter(key_func=get_remote_address)

# In-memory store for now: {user_key: [note, ...]}
_NOTES_STORE: dict[str, list[dict[str, Any]]] = {}


class NoteCreateRequest(BaseModel):
    title: str = Field(..., max_length=200)
    body: str = Field("", max_length=100000)
    topic: str | list[str] = Field(default="")


class NoteUpdateRequest(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    body: Optional[str] = Field(None, max_length=100000)
    topic: Optional[str | list[str]] = None


class SuggestionNote(BaseModel):
    id: str
    title: str = Field("", max_length=200)
    body: str = Field("", max_length=100000)
    topic: str | list[str] = Field(default="")


class NotesSuggestionsRequest(BaseModel):
    notes: list[SuggestionNote] = Field(default_factory=list, max_length=200)


def _normalise_topic(topic: str | list[str] | None) -> list[str]:
    if topic is None:
        return []
    if isinstance(topic, str):
        v = topic.strip()
        return [v] if v else []
    if isinstance(topic, list):
        return [str(t).strip() for t in topic if str(t).strip()]
    return []


def _get_user_key(request: Request) -> str:
    """Resolve user key from JWT when available, else anon."""
    try:
        from services.auth_service import is_auth_enabled, _dev_bypass_token, get_user_from_token, _load_users

        if not is_auth_enabled():
            return "anon"
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return "anon"
        token = auth_header[7:]
        dev = _dev_bypass_token()
        if dev and token == dev:
            users = _load_users()
            if users:
                return str(users[0].get("id", "anon"))
            return "anon"
        user = get_user_from_token(token)
        if not user:
            return "anon"
        return str(user.get("id", "anon"))
    except Exception:
        return "anon"


def _get_user_notes(user_key: str) -> list[dict[str, Any]]:
    return _NOTES_STORE.setdefault(user_key, [])


@router.get("")
@limiter.limit("60/minute")
async def list_notes(request: Request):
    user_key = _get_user_key(request)
    notes = sorted(_get_user_notes(user_key), key=lambda n: n.get("updatedAt", ""), reverse=True)
    return {"notes": notes}


@router.get("/{note_id}")
@limiter.limit("60/minute")
async def get_note(request: Request, note_id: str):
    user_key = _get_user_key(request)
    notes = _get_user_notes(user_key)
    note = next((n for n in notes if n.get("id") == note_id), None)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note


@router.post("")
@limiter.limit("60/minute")
async def create_note(request: Request, body: NoteCreateRequest):
    user_key = _get_user_key(request)
    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    note = {
        "id": uuid.uuid4().hex,
        "title": body.title.strip() or "Untitled note",
        "body": body.body or "",
        "topic": _normalise_topic(body.topic),
        "createdAt": now_iso,
        "updatedAt": now_iso,
    }
    notes = _get_user_notes(user_key)
    notes.insert(0, note)
    return note


@router.patch("/{note_id}")
@limiter.limit("60/minute")
async def update_note(request: Request, note_id: str, body: NoteUpdateRequest):
    user_key = _get_user_key(request)
    notes = _get_user_notes(user_key)
    note = next((n for n in notes if n.get("id") == note_id), None)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    if body.title is not None:
        note["title"] = body.title.strip() or "Untitled note"
    if body.body is not None:
        note["body"] = body.body
    if body.topic is not None:
        note["topic"] = _normalise_topic(body.topic)
    note["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    return note


@router.post("/suggestions")
@limiter.limit("30/minute")
async def notes_suggestions(request: Request, body: NotesSuggestionsRequest):
    if not body.notes:
        return {"suggestions": []}

    compact_notes = [
        {
            "id": n.id,
            "title": n.title,
            "topic": n.topic,
            "body": (n.body or "")[:1600],
        }
        for n in body.notes[:40]
    ]

    system_prompt = (
        "You are a research workflow assistant for Quarry. "
        "Given a user's notes, propose concrete next moves for research and writing. "
        "Do not rewrite notes. Do not fabricate facts. "
        "Return only valid JSON with shape: "
        "{\"suggestions\":[{\"title\":\"...\",\"description\":\"...\"}]}. "
        "Provide 2-5 concise suggestions."
    )

    try:
        raw = llm_service.chat_sync(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps({"notes": compact_notes})},
            ],
            model="openai/gpt-4o-mini",
            timeout=16,
            max_tokens=320,
        )
        cleaned = (raw or "").strip().replace("```json", "").replace("```", "").strip()
        data = json.loads(cleaned)
        suggestions = data.get("suggestions", [])
        if not isinstance(suggestions, list):
            suggestions = []
        normalized = []
        for s in suggestions[:5]:
            if not isinstance(s, dict):
                continue
            title = str(s.get("title", "")).strip()
            description = str(s.get("description", "")).strip()
            if title and description:
                normalized.append({"title": title, "description": description})
        return {"suggestions": normalized}
    except Exception as exc:
        logger.error("notes_suggestions.failed: %s", exc)
        return {"suggestions": []}
