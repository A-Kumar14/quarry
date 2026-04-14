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


# ── POST /chat/message — agentic SSE ─────────────────────────────────────────

@router.post("/message")
async def chat_message(request: Request, body: ChatMessageRequest):
    return StreamingResponse(
        _agentic_stream(body),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


def _is_first_message(session_id: str, branch_id: str) -> bool:
    """True if the branch has no messages yet (this is message #1)."""
    msgs = store.get_branch_messages(session_id, branch_id)
    return len(msgs) == 0


async def _agentic_stream(body: ChatMessageRequest):
    # ── 1. Resolve or create session/branch ───────────────────────────────
    if body.session_id and body.branch_id:
        session_id = body.session_id
        branch_id = body.branch_id
        is_first = _is_first_message(session_id, branch_id)
    else:
        session_id, branch_id = store.create_session()
        is_first = True

    yield _sse({"type": "session", "session_id": session_id, "branch_id": branch_id})

    # ── 2. Persist user message ────────────────────────────────────────────
    user_msg_id = str(uuid.uuid4())
    user_msg = {
        "id": user_msg_id,
        "role": "user",
        "content": body.message,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "research_data": None,
    }
    try:
        store.add_message(session_id, branch_id, user_msg)
    except Exception as exc:
        logger.warning("chat.store_user_msg_failed: %s", exc)

    # ── 3. Build message list for LLM ─────────────────────────────────────
    llm_messages = [{"role": "system", "content": _SYSTEM_PROMPT}]
    for h in body.history:
        if isinstance(h, dict) and h.get("role") in ("user", "assistant"):
            llm_messages.append({"role": h["role"], "content": h.get("content", "")})
    llm_messages.append({"role": "user", "content": body.message})

    # ── 4. Agentic tool decision ───────────────────────────────────────────
    sources: list[dict] = []
    search_query: Optional[str] = None

    try:
        _, tool_calls = await asyncio.to_thread(
            llm_service.chat_sync_with_tools,
            messages=llm_messages,
            tools=_SEARCH_TOOL,
        )
    except Exception as exc:
        logger.error("chat.tool_decision_failed: %s", exc)
        tool_calls = []

    if tool_calls:
        tc = tool_calls[0]
        try:
            args = json.loads(tc.function.arguments)
            search_query = args.get("query", body.message)
        except (json.JSONDecodeError, AttributeError):
            search_query = body.message

        yield _sse({"type": "searching", "query": search_query})

        # Run web search + build context (sync, run in thread)
        try:
            results = await asyncio.to_thread(
                search_service.web_search, search_query, 5
            )
            scraped = await asyncio.to_thread(
                search_service.scrape_urls,
                [r["url"] for r in results[:3]],
                3,
            )
            context_block, sources = search_service.build_context(results, scraped)
        except Exception as exc:
            logger.error("chat.search_failed: %s", exc)
            context_block = ""
            sources = []

        yield _sse({"type": "sources", "sources": sources})

        # Inject search results into messages
        tool_result_content = (
            f"Search results for '{search_query}':\n\n{context_block}"
            if context_block
            else f"No results found for '{search_query}'."
        )
        llm_messages.append({
            "role": "assistant",
            "content": None,
            "tool_calls": [
                {
                    "id": getattr(tc, "id", "call_0"),
                    "type": "function",
                    "function": {
                        "name": "search_web",
                        "arguments": tc.function.arguments,
                    },
                }
            ],
        })
        llm_messages.append({
            "role": "tool",
            "tool_call_id": getattr(tc, "id", "call_0"),
            "content": tool_result_content,
        })

    # ── 5. Stream final answer ────────────────────────────────────────────
    full_response = ""
    try:
        def _collect_stream(messages):
            return list(llm_service.stream_sync(messages))

        tokens = await asyncio.to_thread(_collect_stream, llm_messages)
        for token in tokens:
            full_response += token
            yield _sse({"type": "chunk", "text": token})
    except Exception as exc:
        logger.error("chat.stream_failed: %s", exc)
        yield _sse({"type": "chunk", "text": "[Error generating response]"})

    # ── 6. Persist assistant message ──────────────────────────────────────
    asst_msg_id = str(uuid.uuid4())
    research_data = None
    if sources:
        research_data = {
            "sources": sources,
            "contradictions": [],
            "perspectives": [],
            "query_used": search_query,
        }

    asst_msg = {
        "id": asst_msg_id,
        "role": "assistant",
        "content": full_response,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "research_data": research_data,
    }
    try:
        store.add_message(session_id, branch_id, asst_msg)
    except Exception as exc:
        logger.warning("chat.store_asst_msg_failed: %s", exc)

    # Store in Chroma for semantic search
    if full_response:
        session_list = store.get_sessions()
        session_title = next(
            (s["title"] for s in session_list if s["id"] == session_id),
            "Untitled",
        )
        try:
            await asyncio.to_thread(
                chroma.store_message,
                asst_msg_id,
                full_response,
                {
                    "session_id": session_id,
                    "branch_id": branch_id,
                    "role": "assistant",
                    "timestamp": asst_msg["timestamp"],
                    "session_title": session_title,
                },
            )
        except Exception as exc:
            logger.warning("chat.chroma_store_failed: %s", exc)

    # ── 7. Auto-title on first message ────────────────────────────────────
    if is_first and full_response:
        try:
            title = await asyncio.to_thread(
                llm_service.chat_sync,
                messages=[
                    {
                        "role": "user",
                        "content": (
                            f"Generate a 4-6 word title for a research conversation "
                            f"that started with: '{body.message[:120]}'. "
                            "Reply with ONLY the title, no punctuation, no quotes."
                        ),
                    }
                ],
                timeout=8,
            )
            title = title.strip()[:60] or "New conversation"
            store.update_session_title(session_id, title)
            yield _sse({"type": "title", "title": title})
        except Exception as exc:
            logger.warning("chat.auto_title_failed: %s", exc)

    yield "data: [DONE]\n\n"
