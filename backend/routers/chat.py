"""
routers/chat.py — Chat session management and AI message streaming.
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from services.registry import llm_service, ai_service
import services.conversation_store as store
import services.chroma_service as chroma
from services import search_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])

_SEARCH_TOOL = [
    {
        "type": "function",
        "function": {
            "name": "search_web",
            "description": (
                "Search the web for up-to-date information about a topic. "
                "Call this when the user asks about current events, facts, "
                "specific people/places/organisations, or anything that requires "
                "real-world knowledge beyond your training data."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Specific search query to send to the web",
                    }
                },
                "required": ["query"],
            },
        },
    }
]

_SYSTEM_PROMPT = (
    "You are Quarry, an epistemic research assistant for journalists and policy analysts. "
    "Your goal is not to give confident answers, but to surface what is being said, "
    "where it comes from, and where sources contradict each other. "
    "Be concise, direct, and never fabricate sources. "
    "When you search the web, synthesise the results transparently."
)


# ── Schemas ───────────────────────────────────────────────────────────────────

class ChatMessageRequest(BaseModel):
    session_id: Optional[str] = None
    branch_id: Optional[str] = None
    message: str
    history: list = []


class ForkRequest(BaseModel):
    from_message_id: str
    branch_label: Optional[str] = None


# ── Session endpoints ─────────────────────────────────────────────────────────

@router.post("/sessions")
async def create_session():
    sid, bid = store.create_session()
    return {"session_id": sid, "branch_id": bid, "title": "New conversation"}


@router.get("/sessions")
async def list_sessions():
    return {"sessions": store.get_sessions()}


@router.post("/sessions/{session_id}/fork")
async def fork_session(session_id: str, body: ForkRequest):
    try:
        new_bid = store.fork_branch(
            session_id,
            from_message_id=body.from_message_id,
            label=body.branch_label,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    label = body.branch_label or "Fork"
    return {"branch_id": new_bid, "label": label}


@router.get("/search")
async def search_conversations(q: str):
    results = chroma.semantic_search(q, n_results=5)
    return {"results": results}
