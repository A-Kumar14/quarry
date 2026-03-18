"""
routers/explore.py — Streaming search-augmented generation endpoint.
"""

import collections
import hashlib
import json
import logging
import os
import time

import httpx
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import JSONResponse, StreamingResponse

from schemas import ExploreSearchRequest, RelatedSearchRequest, ResearchRequest
from services.registry import ai_service, llm_service
from services import image_service
from slowapi import Limiter
from slowapi.util import get_remote_address

logger = logging.getLogger(__name__)
router = APIRouter(tags=["explore"])
limiter = Limiter(key_func=get_remote_address)

_news_cache: dict = {}          # {cache_key: {"data": ..., "ts": float}}
_NEWS_CACHE_TTL = 300           # 5 minutes

# ── Per-query-hash rate limiting (5 identical queries / minute) ───────────────

_QUERY_RATE_LIMIT = 5
_QUERY_RATE_WINDOW = 60.0
_query_windows: dict[str, collections.deque] = collections.defaultdict(collections.deque)


def _check_query_rate(query: str) -> bool:
    """Returns True if the query is within the per-query limit, False if exceeded."""
    key = hashlib.md5(query.lower().strip().encode()).hexdigest()
    now = time.time()
    window = _query_windows[key]
    while window and window[0] < now - _QUERY_RATE_WINDOW:
        window.popleft()
    if len(window) >= _QUERY_RATE_LIMIT:
        return False
    window.append(now)
    return True


@router.post("/explore/search")
@limiter.limit("15/minute")
async def explore_search(request: Request, body: ExploreSearchRequest):
    """Stream a Search-Augmented Generation response."""

    query = body.query
    if body.context:
        query = f'Follow-up on "{body.context}": {body.query}'

    if not _check_query_rate(query):
        return JSONResponse(
            status_code=429,
            content={"detail": "Too many requests for this query. Please wait before searching again."},
            headers={"Retry-After": "60"},
        )

    def _stream():
        try:
            yield from ai_service.explore_the_web(query=query)
        except Exception as exc:
            logger.error("explore_search.failed: %s", exc)
            yield f"data: {json.dumps({'type': 'error', 'text': 'An error occurred. Please try again.'})}\n\n"

    return StreamingResponse(
        _stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/explore/news")
@limiter.limit("30/minute")
async def explore_news(
    request: Request,
    q: str = Query(..., max_length=300),
    max: int = Query(6, ge=1, le=10),
):
    """Proxy GNews search server-side to avoid browser CORS restrictions."""
    gnews_key = os.getenv("GNEWS_API_KEY", "")
    if not gnews_key:
        raise HTTPException(status_code=503, detail="News service not configured")

    # Shorten query to improve GNews relevance (first 5 words)
    short_q = " ".join(q.split()[:5])
    cache_key = f"{short_q}:{max}"

    cached = _news_cache.get(cache_key)
    if cached and time.time() - cached["ts"] < _NEWS_CACHE_TTL:
        return cached["data"]

    url = (
        f"https://gnews.io/api/v4/search"
        f"?q={short_q}&lang=en&max={max}&apikey={gnews_key}"
    )
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        logger.error("explore_news.failed q=%s error=%s", short_q, exc)
        raise HTTPException(status_code=502, detail="News fetch failed")

    _news_cache[cache_key] = {"data": data, "ts": time.time()}
    return data


@router.get("/explore/trending-news")
@limiter.limit("30/minute")
async def explore_trending_news(
    request: Request,
    max: int = Query(6, ge=1, le=10),
):
    """Proxy GNews top-headlines server-side."""
    gnews_key = os.getenv("GNEWS_API_KEY", "")
    if not gnews_key:
        raise HTTPException(status_code=503, detail="News service not configured")

    cache_key = f"trending:{max}"
    cached = _news_cache.get(cache_key)
    if cached and time.time() - cached["ts"] < _NEWS_CACHE_TTL:
        return cached["data"]

    url = f"https://gnews.io/api/v4/top-headlines?lang=en&max={max}&apikey={gnews_key}"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        logger.error("explore_trending_news.failed error=%s", exc)
        raise HTTPException(status_code=502, detail="Trending news fetch failed")

    _news_cache[cache_key] = {"data": data, "ts": time.time()}
    return data


@router.post("/explore/related")
@limiter.limit("30/minute")
async def explore_related(request: Request, body: RelatedSearchRequest):
    """Return 3 AI-generated related search suggestions."""
    query = body.query.strip()
    snippet = body.answer_snippet.strip()

    prompt = (
        f'A user searched for: "{query}"\n'
        f'The answer began: "{snippet[:500]}"\n\n'
        "Suggest exactly 3 related search queries that explore different angles "
        "(e.g. latest news, deeper background, practical implications). "
        "Return ONLY a JSON array of 3 short strings, no explanation. "
        'Example: ["angle one", "angle two", "angle three"]'
    )

    fallback = [
        f"{query} latest updates",
        f"{query} explained in depth",
        f"{query} implications",
    ]

    try:
        raw = llm_service.complete(prompt, max_tokens=120)
        # Extract the JSON array from the response
        start = raw.find("[")
        end = raw.rfind("]") + 1
        if start != -1 and end > start:
            import ast
            related = ast.literal_eval(raw[start:end])
            if isinstance(related, list) and len(related) >= 3:
                return {"related": [str(s) for s in related[:3]]}
        return {"related": fallback}
    except Exception as exc:
        logger.error("explore_related.failed query=%s error=%s", query, exc)
        return {"related": fallback}


@router.post("/explore/research")
@limiter.limit("30/minute")
async def explore_research(request: Request, body: ResearchRequest):
    """Multi-turn research assistant session."""

    def _stream():
        try:
            yield from ai_service.research_session(
                messages=[m.model_dump() for m in body.messages],
                message=body.message,
            )
        except Exception as exc:
            import json as _json
            logger.error("explore_research.failed: %s", exc)
            yield f"data: {_json.dumps({'type': 'error', 'text': 'An error occurred. Please try again.'})}\n\n"

    return StreamingResponse(
        _stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/explore/images")
@limiter.limit("30/minute")
async def explore_images(
    request: Request,
    q: str = Query(..., max_length=200),
    page: int = Query(0, ge=0, le=20),
):
    """Return one page of Google Images results (6 per page) via ScrapingBee."""
    try:
        images = image_service.search_images(q, page=page)
        return {"images": images, "query": q, "page": page}
    except Exception as exc:
        logger.error("explore_images.failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
