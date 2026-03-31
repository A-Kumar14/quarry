"""
routers/explore.py — Streaming search-augmented generation endpoint.
"""

import asyncio
import collections
import hashlib
import json
import logging
import os
import re
import time
import trafilatura

import httpx
from fastapi import APIRouter, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from schemas import ExploreSearchRequest, RelatedSearchRequest, ResearchRequest, CiteRequest, OutlineRequest
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


def _build_user_context(request: Request) -> str:
    """Extract user profile from JWT and build a context string for the AI."""
    try:
        from services.auth_service import (
            is_auth_enabled, _dev_bypass_token, decode_token, _load_users, get_user_from_token
        )
        if not is_auth_enabled():
            return ""
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return ""
        token = auth_header[7:]

        # Dev bypass — use first user
        dev = _dev_bypass_token()
        if dev and token == dev:
            users = _load_users()
            user = users[0] if users else None
        else:
            user = get_user_from_token(token)

        if not user:
            return ""
        p = user.get("profile") or {}

        # Only build context if the user has filled in at least one field
        parts = []
        if p.get("role"):        parts.append(f"Role: {p['role']}")
        if p.get("organization"): parts.append(f"Organization: {p['organization']}")
        if p.get("beat"):        parts.append(f"Journalism beat / area of focus: {p['beat']}")
        if p.get("expertise_level"): parts.append(f"Expertise level: {p['expertise_level']}")
        if p.get("topics_of_focus"):
            parts.append(f"Topics of focus: {', '.join(p['topics_of_focus'])}")
        if p.get("preferred_source_types"):
            parts.append(f"Preferred source types: {', '.join(p['preferred_source_types'])}")

        if not parts:
            return ""
        return "[USER PROFILE]\n" + "\n".join(parts) + "\n[END USER PROFILE]"
    except Exception:
        return ""


@router.post("/explore/search")
@limiter.limit("15/minute")
async def explore_search(
    request: Request,
    body: ExploreSearchRequest,
    deep: bool = Query(False),
):
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

    user_context = _build_user_context(request)

    async def _stream():
        try:
            try:
                stream = ai_service.explore_the_web(query=query, deep=deep, user_context=user_context)
            except TypeError:
                # Backward-compatible with older mocks/signatures (tests monkeypatch
                # explore_the_web with a sync generator that only accepts `query`).
                stream = ai_service.explore_the_web(query=query)

            if hasattr(stream, "__aiter__"):
                async for chunk in stream:
                    yield chunk
            else:
                for chunk in stream:
                    yield chunk
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
    force: bool = Query(False),
    topic: str = Query("", max_length=32),
):
    """Proxy GNews top-headlines server-side."""
    gnews_key = os.getenv("GNEWS_API_KEY", "")
    if not gnews_key:
        raise HTTPException(status_code=503, detail="News service not configured")

    cache_key = f"trending:{max}:{topic}"
    if not force:
        cached = _news_cache.get(cache_key)
        if cached and time.time() - cached["ts"] < _NEWS_CACHE_TTL:
            return cached["data"]

    topic_param = f"&topic={topic}" if topic else ""
    url = f"https://gnews.io/api/v4/top-headlines?lang=en&max={max}{topic_param}&apikey={gnews_key}"
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
                file_context=body.file_context,
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


@router.post("/explore/outline")
@limiter.limit("10/minute")
async def explore_outline(request: Request, body: OutlineRequest):
    """Stream a structured academic paper outline for the given topic."""

    def _stream():
        try:
            yield from ai_service.generate_outline(query=body.query, context=body.context)
        except Exception as exc:
            logger.error("explore_outline.failed: %s", exc)
            yield f"data: {json.dumps({'type': 'error', 'text': 'Outline generation failed.'})}\n\n"

    return StreamingResponse(
        _stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/explore/search-sources")
@limiter.limit("20/minute")
async def explore_search_sources(
    request: Request,
    query: str = Query(...)
):
    from services import search_service
    from services.ai_service import retrieve
    from services.source_service import get_source_profile, profile_to_dict

    try:
        retrieved_sources = await retrieve(query, search_service, max_results=8)
        sources = [
            {
                "title": r.get("title", ""),
                "url": r.get("url", ""),
                "snippet": r.get("snippet", ""),
            }
            for r in (retrieved_sources or [])
            if r.get("url")
        ]

        # Enrich with source profiles
        for src in sources:
            profile = get_source_profile(src.get("url", ""))
            src.update(profile_to_dict(profile))

        return {"sources": sources}
    except Exception as exc:
        logger.error("explore_search_sources.failed: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to research sources")


class SummarizeRequest(BaseModel):
    url: str
    snippet: str = ""   # fallback if scraping fails

@router.post("/explore/summarize-source")
@limiter.limit("30/minute")
async def explore_summarize_source(request: Request, body: SummarizeRequest):
    from services.registry import llm_service
    import asyncio

    try:
        # Run blocking scrape in a thread so we don't stall the event loop.
        loop = asyncio.get_running_loop()

        def _scrape():
            try:
                dl = trafilatura.fetch_url(body.url, no_ssl=True)
                text = trafilatura.extract(dl) if dl else ""
                return (text or "")[:6000]
            except Exception:
                return ""

        try:
            content = await asyncio.wait_for(
                loop.run_in_executor(None, _scrape),
                timeout=12,
            )
        except asyncio.TimeoutError:
            content = ""

        # Fallback to snippet when scraping fails or is blocked
        if not content:
            content = (body.snippet or "").strip()

        if not content:
            return {"summary": "Could not retrieve content for this source."}

        prompt = (
            "Give a concise, factual 3-4 sentence summary of the article below. "
            "State the core facts directly — no preamble like 'This article discusses'.\n\n"
            f"ARTICLE:\n{content}"
        )

        # chat_sync passes timeout directly to the HTTP call — no asyncio wrapper needed.
        # Run in a thread so we don't block the event loop.
        messages = [{"role": "user", "content": prompt}]
        summary = await loop.run_in_executor(
            None,
            lambda: llm_service.chat_sync(messages, model="openai/gpt-4o-mini", timeout=20),
        )

        return {"summary": summary.strip()}
    except Exception as exc:
        logger.error("explore_summarize_source.failed url=%s error=%s", body.url, exc)
        return {"summary": "Could not summarize this source right now."}


_MAX_FILE_BYTES = 10 * 1024 * 1024  # 10 MB
_MAX_TEXT_CHARS = 12_000             # chars sent to LLM context
_ALLOWED_EXTS   = {".pdf", ".docx", ".txt", ".md", ".csv"}


@router.post("/explore/parse-file")
@limiter.limit("20/minute")
async def explore_parse_file(request: Request, file: UploadFile = File(...)):
    """Extract plain text from an uploaded PDF, DOCX, TXT, MD, or CSV file."""
    import io
    import os as _os

    ext = _os.path.splitext(file.filename or "")[1].lower()
    if ext not in _ALLOWED_EXTS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(sorted(_ALLOWED_EXTS))}",
        )

    raw = await file.read()
    if len(raw) > _MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 10 MB.")

    text = ""
    try:
        if ext == ".pdf":
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(raw))
            pages  = [page.extract_text() or "" for page in reader.pages]
            text   = "\n\n".join(p.strip() for p in pages if p.strip())

        elif ext == ".docx":
            import docx as _docx
            doc    = _docx.Document(io.BytesIO(raw))
            text   = "\n\n".join(p.text.strip() for p in doc.paragraphs if p.text.strip())

        else:  # .txt / .md / .csv
            text = raw.decode("utf-8", errors="replace")

    except Exception as exc:
        logger.error("parse_file.failed filename=%s ext=%s error=%s", file.filename, ext, exc)
        raise HTTPException(status_code=422, detail="Could not extract text from this file.")

    # Normalise whitespace and truncate for LLM context
    import re as _re
    text = _re.sub(r"\n{4,}", "\n\n\n", text).strip()
    truncated = len(text) > _MAX_TEXT_CHARS
    text = text[:_MAX_TEXT_CHARS]

    return {
        "filename":  file.filename,
        "ext":       ext,
        "text":      text,
        "chars":     len(text),
        "truncated": truncated,
    }


@router.post("/explore/cite")
@limiter.limit("30/minute")
async def explore_cite(request: Request, body: CiteRequest):
    """Resolve citation metadata for a URL and return formatted citation."""
    import asyncio
    from services import citation_service

    try:
        result = await asyncio.to_thread(citation_service.cite, body.url, body.style)
        return result
    except Exception as exc:
        logger.error("explore_cite.failed url=%s error=%s", body.url, exc)
        raise HTTPException(status_code=500, detail="Citation lookup failed")


@router.get("/explore/suggest")
@limiter.limit("60/minute")
async def explore_suggest(
    request: Request,
    q: str = Query(..., max_length=200),
):
    """Return search query suggestions via Datamuse."""
    if not q.strip():
        return {"suggestions": []}
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.get(
                "https://api.datamuse.com/sug",
                params={"s": q.strip(), "max": 6},
            )
            if r.status_code == 200:
                data = r.json()
                return {"suggestions": [item["word"] for item in data if "word" in item]}
    except Exception as exc:
        logger.warning("explore_suggest.failed: %s", exc)
    return {"suggestions": []}


_stocks_cache: dict = {}
_STOCKS_CACHE_TTL = 90  # seconds

_STOCK_NAMES: dict[str, str] = {
    "^DJI":  "Dow Jones Industrial Avg.",
    "^GSPC": "Standard & Poor's 500",
    "^IXIC": "Nasdaq Composite",
    "AAPL":  "Apple Inc.",         "MSFT":  "Microsoft Corp.",
    "GOOGL": "Alphabet Inc.",      "AMZN":  "Amazon.com",
    "NVDA":  "Nvidia Corp.",       "TSLA":  "Tesla Inc.",
    "META":  "Meta Platforms",     "JPM":   "JPMorgan Chase",
    "V":     "Visa Inc.",          "NFLX":  "Netflix Inc.",
    "AMD":   "Advanced Micro Devs","ORCL":  "Oracle Corp.",
    "BRK-B": "Berkshire Hathaway Inc.", "TSM": "TSMC",
    "BA":    "The Boeing Company", "DIS":   "The Walt Disney Co.",
    "GE":    "GE Aerospace",       "HD":    "The Home Depot, Inc.",
    "NKE":   "NIKE, Inc.",         "PYPL":  "PayPal Holdings",
}

# Display symbols for index tickers (strip ^ for label)
_STOCK_DISPLAY: dict[str, str] = {
    "^DJI": "DOW",  "^GSPC": "S&P 500", "^IXIC": "NASDAQ",
}

def _fetch_stocks_sync(symbols_list: list[str]) -> list[dict]:
    """Fetch quotes + intraday sparkline via yfinance — runs in a thread."""
    import yfinance as yf

    # Single batch download: 2 days at 5-min intervals gives today's sparkline
    # and yesterday's close for change calculation.
    joined = " ".join(symbols_list)
    try:
        raw = yf.download(
            joined,
            period="2d",
            interval="5m",
            auto_adjust=True,
            progress=False,
            group_by="ticker",
        )
    except Exception:
        return []

    stocks = []
    multi = len(symbols_list) > 1

    for sym in symbols_list:
        try:
            closes = raw[sym]["Close"] if multi else raw["Close"]
            closes = closes.dropna()
            if closes.empty:
                continue

            dates      = [d.date() for d in closes.index]
            today      = dates[-1]
            today_vals = [float(v) for v, d in zip(closes, dates) if d == today]
            yest_vals  = [float(v) for v, d in zip(closes, dates) if d != today]

            if not today_vals:
                continue

            price      = today_vals[-1]
            prev_close = yest_vals[-1] if yest_vals else today_vals[0]
            if prev_close == 0:
                continue

            change  = price - prev_close
            pct     = (change / prev_close) * 100

            # Downsample sparkline to ≤40 points so JSON stays small
            step      = max(1, len(today_vals) // 40)
            sparkline = [round(v, 2) for v in today_vals[::step]]

            stocks.append({
                "symbol":    _STOCK_DISPLAY.get(sym, sym),
                "rawTicker": sym,
                "name":      _STOCK_NAMES.get(sym, sym),
                "price":     round(price, 2),
                "change":    round(change, 2),
                "changePct": round(pct, 4),
                "sparkline": sparkline,
            })
        except Exception:
            pass

    return stocks


@router.get("/explore/stocks")
@limiter.limit("60/minute")
async def explore_stocks(
    request: Request,
    symbols: str = Query(
        "^DJI,^GSPC,^IXIC,AAPL,MSFT,NVDA,TSLA,AMZN,META,GOOGL,BRK-B,BA,DIS,GE,HD,NKE,V,JPM,NFLX,AMD",
        max_length=500,
    ),
):
    """Return live stock quotes via yfinance (cached 60 s)."""
    cache_key = symbols
    cached = _stocks_cache.get(cache_key)
    if cached and time.time() - cached["ts"] < _STOCKS_CACHE_TTL:
        return cached["data"]

    symbols_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    try:
        import asyncio
        stocks = await asyncio.to_thread(_fetch_stocks_sync, symbols_list)
    except Exception as exc:
        logger.error("explore_stocks.failed symbols=%s error=%s", symbols, exc)
        raise HTTPException(status_code=502, detail="Stock data fetch failed")

    data = {"stocks": stocks}
    _stocks_cache[cache_key] = {"data": data, "ts": time.time()}
    return data


_chart_cache: dict = {}
_CHART_CACHE_TTL = 300  # 5 min


def _fetch_chart_sync(ticker: str, period: str) -> dict:
    import yfinance as yf

    period_map = {
        "1D": ("1d",  "5m"),
        "1W": ("5d",  "30m"),
        "1M": ("1mo", "1d"),
        "3M": ("3mo", "1d"),
        "1Y": ("1y",  "1wk"),
        "5Y": ("5y",  "1mo"),
    }
    yf_period, interval = period_map.get(period, ("1mo", "1d"))

    raw = yf.download(ticker.upper(), period=yf_period, interval=interval,
                      auto_adjust=True, progress=False)
    if raw.empty:
        return {}

    closes = raw["Close"]
    if hasattr(closes, "columns"):
        closes = closes.iloc[:, 0]
    closes = closes.dropna()
    dates  = [d.strftime("%Y-%m-%d %H:%M" if interval in ("5m", "30m") else "%Y-%m-%d")
              for d in closes.index]
    prices = [round(float(v), 2) for v in closes]

    first_price = prices[0] if prices else 0
    pct_change  = round((prices[-1] - first_price) / first_price * 100, 2) if first_price else 0

    return {
        "ticker":    ticker.upper(),
        "period":    period,
        "dates":     dates,
        "prices":    prices,
        "pctChange": pct_change,
    }


@router.get("/explore/quote/{ticker}")
@limiter.limit("60/minute")
async def explore_single_quote(request: Request, ticker: str):
    """Return a live quote for a single ticker using finance_service.get_quote()."""
    from services import finance_service
    ticker = ticker.upper().strip()
    data = finance_service.get_quote(ticker)
    if not data:
        raise HTTPException(status_code=404, detail=f"No data for {ticker}")
    try:
        news = finance_service.get_company_news(ticker)
        data["news"] = news
    except Exception:
        data["news"] = []
    return data


@router.get("/explore/chart/{ticker}")
@limiter.limit("60/minute")
async def explore_chart(request: Request, ticker: str, period: str = Query("1M")):
    """Return historical price series for a ticker and period."""
    ticker = ticker.upper().strip()
    period = period.upper().strip()
    if period not in ("1D", "1W", "1M", "3M", "1Y", "5Y"):
        period = "1M"

    key = f"{ticker}:{period}"
    cached = _chart_cache.get(key)
    if cached and time.time() - cached["ts"] < _CHART_CACHE_TTL:
        return cached["data"]

    try:
        import asyncio
        data = await asyncio.to_thread(_fetch_chart_sync, ticker, period)
    except Exception as exc:
        logger.error("explore_chart.failed ticker=%s error=%s", ticker, exc)
        raise HTTPException(status_code=502, detail="Chart data fetch failed")

    if not data:
        raise HTTPException(status_code=404, detail=f"No chart data for {ticker}")

    _chart_cache[key] = {"data": data, "ts": time.time()}
    return data


@router.get("/explore/perspectives")
@limiter.limit("30/minute")
async def explore_perspectives(
    request: Request,
    q: str = Query(..., max_length=300),
    limit: int = Query(5, ge=1, le=10),
):
    """Proxy Reddit search server-side to avoid browser CORS restrictions."""
    url = (
        f"https://www.reddit.com/search.json"
        f"?q={q}&sort=relevance&limit={limit}&t=year"
    )
    try:
        async with httpx.AsyncClient(
            timeout=8,
            headers={"User-Agent": "quarry-search/1.0 (web app)"},
        ) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        logger.error("explore_perspectives.failed q=%s error=%s", q, exc)
        raise HTTPException(status_code=502, detail="Perspectives fetch failed")

    posts = [c["data"] for c in (data.get("data", {}).get("children") or [])]
    return {"posts": posts}


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


from fastapi.responses import Response as FastAPIResponse

@router.get("/explore/img-proxy")
@limiter.limit("120/minute")
async def image_proxy(
    request: Request,
    url: str = Query(..., max_length=2000),
):
    """Proxy external news images to avoid CORS/hotlink issues."""
    # Only allow http/https URLs
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Invalid URL")
    try:
        async with httpx.AsyncClient(timeout=8, follow_redirects=True) as client:
            resp = await client.get(url, headers={
                "User-Agent": "Mozilla/5.0 (compatible; Quarry/1.0)",
                "Referer": "",
            })
        content_type = resp.headers.get("content-type", "image/jpeg")
        if not content_type.startswith("image/"):
            raise HTTPException(status_code=502, detail="Not an image")
        return FastAPIResponse(
            content=resp.content,
            media_type=content_type,
            headers={"Cache-Control": "public, max-age=3600"},
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("img_proxy.failed url=%s error=%s", url[:80], exc)
        raise HTTPException(status_code=502, detail="Image fetch failed")


# ── Topic map ─────────────────────────────────────────────────────────────────

class TopicMapRequest(BaseModel):
    sources: list[dict]  # [{title, url, domain, queries}]
    focus_query: str = ""  # optional: narrow the graph to a specific theme/question


@router.post("/explore/topic-map")
@limiter.limit("10/minute")
async def explore_topic_map(request: Request, body: TopicMapRequest):
    """Two-step LLM pipeline: extract per-source topics, then build the connection graph."""
    if not body.sources:
        return {"nodes": [], "links": []}

    sources = body.sources[:60]
    summaries = []
    for s in sources:
        q = ", ".join((s.get("queries") or [])[:3])
        summaries.append(
            f'- title="{s.get("title") or s.get("domain", "")}" '
            f'domain={s.get("domain", "")} '
            f'url={s.get("url", "")} '
            f'queries=[{q}]'
        )

    loop = asyncio.get_running_loop()

    # ── Step 1: extract key topics per source ────────────────────────────────
    step1_prompt = (
        "You are a research analyst. For each source below, extract 2–3 concise topic tags "
        "(e.g. 'climate finance', 'Sudan conflict', 'IMF policy'). "
        "Return ONLY a JSON array — no markdown — like:\n"
        '[{"url":"...","topics":["tag1","tag2"]}]\n\n'
        "Sources:\n" + "\n".join(summaries) + "\n\nReturn ONLY the JSON array."
    )

    topic_tags: list[dict] = []
    try:
        raw1 = await asyncio.wait_for(
            loop.run_in_executor(
                None,
                lambda: llm_service.chat_sync(
                    [{"role": "user", "content": step1_prompt}],
                    model="openai/gpt-4o-mini",
                    timeout=25,
                ),
            ),
            timeout=30,
        )
        m1 = re.search(r'\[[\s\S]*\]', raw1)
        if m1:
            topic_tags = json.loads(m1.group())
    except Exception as exc:
        logger.warning("topic_map.step1.failed: %s", exc)

    # Build enriched source descriptions from step-1 tags
    enriched = []
    tag_map = {t.get("url", ""): t.get("topics", []) for t in topic_tags}
    for s in sources:
        url = s.get("url", "")
        tags = tag_map.get(url, [])
        tag_str = ", ".join(tags) if tags else ", ".join((s.get("queries") or [])[:2])
        enriched.append(
            f'- url={url} domain={s.get("domain", "")} '
            f'title="{s.get("title") or s.get("domain", "")}" '
            f'topics=[{tag_str}]'
        )

    # ── Step 2: cluster into nodes and find connections ───────────────────────
    focus_clause = (
        f'\nIMPORTANT: The user wants to explore "{body.focus_query}". '
        "Prioritise nodes and links that are relevant to this theme. "
        "Still include other major clusters but make sure connections to this theme are prominent.\n"
        if body.focus_query.strip() else ""
    )
    step2_prompt = (
        "You are a knowledge-graph builder for a journalist's research library. "
        "Using the source-topic data below, create a well-connected topic graph.\n"
        + focus_clause + "\n"
        "Sources with topics:\n" + "\n".join(enriched) + "\n\n"
        "Return ONLY a JSON object — no markdown — with this exact shape:\n"
        '{"nodes":[{"id":"snake_case_id","label":"Human Label","description":"1-sentence summary of what this cluster covers","urls":["url1","url2"]}],'
        '"links":[{"source":"node_id1","target":"node_id2","label":"≤6 words: shared theme","strength":1}]}\n'
        "Rules:\n"
        "- 6–14 nodes, each grouping sources that share a genuine theme\n"
        "- node id: lowercase_underscore, unique\n"
        "- description: one sentence explaining what unites the sources in this cluster\n"
        "- each node urls list: actual URLs from the sources above\n"
        "- 10–24 links; only connect nodes with real thematic overlap\n"
        "- link label: ≤6 words describing the connection (e.g. 'shared funding actors', 'overlapping regions')\n"
        "- strength: 1 (weak), 2 (moderate), 3 (strong) — how closely the topics are related\n"
        "- no duplicate or self-referencing links\n"
        "Return ONLY the JSON."
    )

    try:
        raw2 = await asyncio.wait_for(
            loop.run_in_executor(
                None,
                lambda: llm_service.chat_sync(
                    [{"role": "user", "content": step2_prompt}],
                    model="openai/gpt-4o-mini",
                    timeout=35,
                ),
            ),
            timeout=40,
        )
        m2 = re.search(r'\{[\s\S]*\}', raw2)
        if m2:
            return json.loads(m2.group())
    except Exception as exc:
        logger.error("topic_map.step2.failed: %s", exc)

    return {"nodes": [], "links": []}


# ── Globe pins — live crisis events from GDELT (15-min cache) ─────────────────

_GLOBE_PINS_TTL = 900  # 15 minutes

_TYPE_COLORS = {
    "Conflict": "#e24b4a",
    "Famine":   "#facc15",
    "Politics": "#7f77dd",
}

_CONFLICT_KW = {
    "war", "conflict", "attack", "airstrike", "strike", "killed", "bomb",
    "shelling", "troops", "military", "ceasefire", "offensive", "siege",
    "casualties", "hostilities", "fighting", "forces", "rebels",
}
_FAMINE_KW = {
    "famine", "hunger", "drought", "food", "starvation", "malnutrition",
    "humanitarian", "displacement", "flooding", "flood", "refugee",
}
_POLITICS_KW = {
    "protest", "coup", "election", "government", "president", "opposition",
    "sanctions", "demonstration", "uprising", "parliament", "referendum",
    "crackdown", "detained", "arrested",
}


def _classify_type(title: str) -> str:
    words = set(title.lower().split())
    if words & _CONFLICT_KW:  return "Conflict"
    if words & _FAMINE_KW:    return "Famine"
    if words & _POLITICS_KW:  return "Politics"
    return "Conflict"


def _cluster_pins(raw: list[dict], threshold_deg: float = 3.5, max_pins: int = 20) -> list[dict]:
    """
    Greedily merge pins within threshold_deg of an existing cluster centre.
    The cluster representative keeps the first pin's data; count drives ranking.
    """
    clusters: list[dict] = []
    for pin in raw:
        lat, lng = pin["lat"], pin["lng"]
        merged = False
        for c in clusters:
            if abs(c["lat"] - lat) < threshold_deg and abs(c["lng"] - lng) < threshold_deg:
                c["count"] += 1
                merged = True
                break
        if not merged:
            clusters.append({**pin, "count": 1})
    clusters.sort(key=lambda c: c["count"], reverse=True)
    return clusters[:max_pins]


@router.get("/explore/globe-pins")
@limiter.limit("30/minute")
async def globe_pins(request: Request):
    """
    Return geolocated crisis pins for the globe visualisation.
    Queries GDELT GEO API (last 24 h), clusters by proximity,
    caps at 20 pins, and caches the result for 15 minutes.
    Falls back to an empty list on any fetch error — frontend uses WORLD_PINS.
    """
    cache_key = "globe_pins"
    now = time.time()
    cached = _news_cache.get(cache_key)
    if cached and (now - cached["ts"]) < _GLOBE_PINS_TTL:
        return JSONResponse(cached["data"])

    gdelt_url = "https://api.gdeltproject.org/api/v2/geo/geo"
    params = {
        "query":      "conflict OR war OR airstrike OR famine OR protest OR coup OR crisis",
        "mode":       "artgeo",
        "format":     "json",
        "timespan":   "24h",
        "maxrecords": "250",
    }

    raw_pins: list[dict] = []
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            r = await client.get(gdelt_url, params=params)
            if r.status_code == 200:
                data = r.json()
                articles = data.get("articles") or []
                for article in articles:
                    title = article.get("title") or ""

                    # GDELT GEO API may expose lat/long at top level or inside
                    # a nested 'location' object — handle both.
                    lat = article.get("lat") or article.get("latitude")
                    lng = (article.get("long") or article.get("longitude")
                           or article.get("lng"))
                    if lat is None or lng is None:
                        loc = article.get("location") or {}
                        lat = loc.get("lat") or loc.get("latitude")
                        lng = (loc.get("long") or loc.get("longitude")
                               or loc.get("lng"))
                    if lat is None or lng is None:
                        continue
                    try:
                        lat, lng = float(lat), float(lng)
                    except (TypeError, ValueError):
                        continue

                    ev_type = _classify_type(title)
                    label   = (article.get("domain")
                               or article.get("sourcecountry")
                               or "Event")
                    raw_pins.append({
                        "label": label[:40],
                        "desc":  title[:140],
                        "lat":   lat,
                        "lng":   lng,
                        "type":  ev_type,
                        "color": _TYPE_COLORS[ev_type],
                    })
    except Exception as exc:
        logger.warning("globe_pins.gdelt_failed: %s", exc)

    pins = _cluster_pins(raw_pins)
    result = {
        "pins":       pins,
        "source":     "gdelt",
        "fetched_at": int(now),
        "live":       len(raw_pins) > 0,
    }
    _news_cache[cache_key] = {"data": result, "ts": now}
    return JSONResponse(result)
