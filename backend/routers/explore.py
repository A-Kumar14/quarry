"""
routers/explore.py — Streaming search-augmented generation endpoint.
"""

import json
import logging

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from schemas import ExploreSearchRequest
from services.registry import ai_service
from slowapi import Limiter
from slowapi.util import get_remote_address

logger = logging.getLogger(__name__)
router = APIRouter(tags=["explore"])
limiter = Limiter(key_func=get_remote_address)

@router.post("/explore/search")
@limiter.limit("15/minute")
async def explore_search(request: Request, body: ExploreSearchRequest):
    """Stream a Search-Augmented Generation response."""

    query = body.query
    if body.context:
        query = f'Follow-up on "{body.context}": {body.query}'

    def _stream():
        try:
            yield from ai_service.explore_the_web(query=query)
        except Exception as exc:
            logger.error("explore_search.failed: %s", exc)
            yield f"data: {json.dumps({'type': 'error', 'text': str(exc)})}\n\n"

    return StreamingResponse(
        _stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
