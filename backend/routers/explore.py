"""
routers/explore.py — Streaming search-augmented generation endpoint.
"""

import asyncio
import collections
import datetime
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

from schemas import (
    ExploreSearchRequest, RelatedSearchRequest, ResearchRequest,
    CiteRequest, OutlineRequest,
    DeepAnalyzeRequest, DeepAnalysisResponse, DeepAnalysis,
    DeepSourceContext,
    DeepDiagramRequest, DiagramSpec,
)
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
        if p.get("beat"):        parts.append(f"Focus area: {p['beat']}")
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
    """AI-assisted Reddit perspectives retrieval + opinion summary."""
    import urllib.parse

    geo_keywords = {
        "war", "conflict", "ceasefire", "ukraine", "russia", "gaza", "israel",
        "timeline", "frontline", "battle", "military", "invasion", "sanctions",
        "geopolitics", "nato", "syria", "sudan", "iran", "china", "taiwan",
    }
    geo_entities = {"ukraine", "russia", "gaza", "israel", "lebanon", "syria", "sudan", "iran", "taiwan", "china"}
    medical_terms = {"medical", "hospital", "hospitals", "clinic", "clinics", "healthcare", "health", "facility", "facilities"}
    attack_terms = {"attack", "attacks", "target", "targeting", "strike", "strikes", "bomb", "bombing", "war", "conflict"}
    geo_subreddits = {
        "worldnews", "geopolitics", "ukraine", "ukrainerussiareport", "combatfootage",
        "credibledefense", "lesscredibledefence", "europe", "middleeastnews",
        "news", "internationalnews",
    }
    sports_keywords = {
        "sports", "soccer", "football", "fifa", "uefa", "premier", "league", "la", "liga",
        "bundesliga", "serie", "champions", "transfer", "goal", "match", "nba", "nfl", "mlb", "nhl",
    }
    sports_subreddits = {
        "soccer", "football", "premierleague", "laliga", "bundesliga", "seriea",
        "championsleague", "fifa", "worldcup", "sports", "nba", "nfl", "mlb", "hockey",
    }

    def _tokenize(text: str) -> list[str]:
        words = re.findall(r"[a-zA-Z0-9]+", (text or "").lower())
        stop = {
            "the", "and", "with", "from", "that", "this", "have", "what",
            "about", "current", "situation", "timeline", "into", "your",
            "where", "counts", "count", "documented",
        }
        return [w for w in words if len(w) > 2 and w not in stop]

    def _unique_keep_order(items: list[str]) -> list[str]:
        out: list[str] = []
        seen: set[str] = set()
        for item in items:
            key = item.strip().lower()
            if not key or key in seen:
                continue
            seen.add(key)
            out.append(item.strip())
        return out

    def _normalise_subreddit(name: str) -> str:
        return (name or "").lower().replace("r/", "").strip()

    def _word_set(text: str) -> set[str]:
        return set(re.findall(r"[a-zA-Z0-9]+", (text or "").lower()))

    def _token_match_score(title_words: set[str], body_words: set[str], sub_words: set[str], query_tokens: list[str]) -> tuple[float, int]:
        if not query_tokens:
            return 0.0, 0
        title_hits = sum(1 for t in query_tokens if t in title_words)
        body_hits = sum(1 for t in query_tokens if t in body_words)
        sub_hits = sum(1 for t in query_tokens if t in sub_words)
        # Title relevance dominates; body/subreddit are light support signals.
        score = (title_hits * 2.5) + (body_hits * 0.45) + (sub_hits * 0.35)
        return float(score), title_hits

    async def _plan_queries(user_query: str) -> list[str]:
        prompt = (
            "You are helping retrieve relevant Reddit discussions for a research query. "
            "Produce 3 short Reddit search queries that maximize relevance and avoid generic chatter. "
            "Return ONLY JSON in shape: {\"queries\": [\"...\", \"...\", \"...\"]}."
        )
        uq = (user_query or "").strip()
        uq_tokens = _tokenize(uq)
        is_sports_fallback = any(t in sports_keywords for t in uq_tokens)
        fallback = _unique_keep_order([
            uq,
            f"{uq} {'match updates' if is_sports_fallback else 'latest updates'}",
            f"{uq} discussion",
        ])[:3]
        try:
            raw = await asyncio.to_thread(
                llm_service.chat_sync,
                [{"role": "system", "content": prompt}, {"role": "user", "content": user_query}],
                "openai/gpt-4o-mini",
                12,
                140,
            )
            cleaned = (raw or "").strip().replace("```json", "").replace("```", "").strip()
            data = json.loads(cleaned)
            if isinstance(data, dict) and isinstance(data.get("queries"), list):
                queries = [str(x).strip() for x in data["queries"] if str(x).strip()]
                queries = _unique_keep_order([user_query, *queries])[:3]
                return queries if queries else fallback
        except Exception as exc:
            logger.warning("explore_perspectives.plan_queries_failed q=%s error=%s", user_query, exc)
        return fallback

    def _relevance_score(post: dict, token_match: float, is_geo_query: bool, is_sports_query: bool) -> float:
        if token_match <= 0:
            return 0.0
        subreddit = _normalise_subreddit(post.get("subreddit_name_prefixed", ""))

        # Keep popularity as tie-break signal, not dominant ranking factor.
        social = min(float(post.get("score", 0)) / 5000.0, 1.0)
        comments = min(float(post.get("num_comments", 0)) / 2000.0, 1.0)
        subreddit_bonus = 0.0
        if is_geo_query and subreddit in geo_subreddits:
            subreddit_bonus = 1.0
        if is_sports_query and subreddit in sports_subreddits:
            subreddit_bonus = 0.9
        return token_match + social + comments + subreddit_bonus

    async def _summarize_reddit_opinion(user_query: str, posts: list[dict]) -> str:
        if not posts:
            return "No clear Reddit discussion signal was retrieved for this query."
        reduced = [
            {
                "title": p.get("title", ""),
                "subreddit": p.get("subreddit_name_prefixed", ""),
                "score": p.get("score", 0),
                "comments": p.get("num_comments", 0),
            }
            for p in posts[:8]
        ]
        prompt = (
            "You are an analyst summarizing Reddit discussion patterns.\n"
            "Given a query and retrieved Reddit posts, write 2-3 sentences on what people are discussing, "
            "where opinions diverge, and any limits in source quality/relevance.\n"
            "Do not restate article facts. Focus on community discourse.\n"
            "Return ONLY JSON in shape: {\"summary\": \"...\"}."
        )
        try:
            raw = await asyncio.to_thread(
                llm_service.chat_sync,
                [
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": json.dumps({"query": user_query, "posts": reduced})},
                ],
                "openai/gpt-4o-mini",
                12,
                180,
            )
            cleaned = (raw or "").strip().replace("```json", "").replace("```", "").strip()
            data = json.loads(cleaned)
            text = str(data.get("summary", "")).strip()
            if text:
                return text
        except Exception as exc:
            logger.warning("explore_perspectives.summarize_failed q=%s error=%s", user_query, exc)
        return "Discussion is mixed and somewhat fragmented across subreddits; review post-level context before drawing conclusions."

    planned_queries = await _plan_queries(q)
    query_tokens = _tokenize(q)
    is_geo_query = any(t in geo_keywords for t in query_tokens)
    is_sports_query = any(t in sports_keywords for t in query_tokens)
    has_geo_entities = any(t in geo_entities for t in query_tokens)
    is_medical_attack_query = any(t in medical_terms for t in query_tokens) and any(t in attack_terms for t in query_tokens)
    per_query_limit = max(4, min(8, limit + 2))
    collected: dict[str, dict] = {}

    try:
        async with httpx.AsyncClient(
            timeout=8,
            headers={"User-Agent": "quarry-search/1.0 (web app)"},
        ) as client:
            for rq in planned_queries:
                url = (
                    "https://www.reddit.com/search.json"
                    f"?q={urllib.parse.quote_plus(rq)}&sort=relevance&limit={per_query_limit}&t=year"
                )
                resp = await client.get(url)
                if resp.status_code != 200:
                    continue
                data = resp.json()
                for child in (data.get("data", {}).get("children") or []):
                    post = child.get("data") or {}
                    pid = str(post.get("id", "")).strip()
                    if not pid:
                        continue
                    title_words = _word_set(post.get("title", ""))
                    body_words = _word_set(post.get("selftext", ""))
                    sub_words = _word_set(post.get("subreddit_name_prefixed", ""))
                    token_match, title_hits = _token_match_score(title_words, body_words, sub_words, query_tokens)
                    subreddit = _normalise_subreddit(post.get("subreddit_name_prefixed", ""))
                    if token_match <= 0:
                        continue

                    # Require title-level relevance, but be less strict for sports/general queries.
                    if is_geo_query:
                        if subreddit not in geo_subreddits and title_hits < 2:
                            continue
                    elif is_sports_query:
                        if subreddit not in sports_subreddits and title_hits < 1:
                            continue
                    elif title_hits < 1:
                        continue

                    # For crisis/geopolitics queries, require stronger lexical relevance.
                    if is_geo_query and token_match < 2.5:
                        continue
                    if is_geo_query and subreddit not in geo_subreddits and token_match < 4.0:
                        continue
                    if is_sports_query and token_match < 1.0:
                        continue
                    if is_sports_query and subreddit not in sports_subreddits and token_match < 1.8:
                        continue

                    # For medical-facility attack queries, enforce intent anchors.
                    if is_medical_attack_query:
                        has_medical = bool((title_words | body_words) & medical_terms)
                        has_attack = bool((title_words | body_words) & attack_terms)
                        has_geo = bool((title_words | body_words) & geo_entities) if has_geo_entities else True
                        if not (has_medical and has_attack and has_geo):
                            continue

                    post["__relevance"] = _relevance_score(post, token_match, is_geo_query, is_sports_query)
                    if pid not in collected or post["__relevance"] > collected[pid].get("__relevance", 0):
                        collected[pid] = post
    except Exception as exc:
        logger.error("explore_perspectives.failed q=%s error=%s", q, exc)
        raise HTTPException(status_code=502, detail="Perspectives fetch failed")

    ranked = sorted(
        collected.values(),
        key=lambda p: (p.get("__relevance", 0), p.get("score", 0), p.get("num_comments", 0)),
        reverse=True,
    )
    posts = [p for p in ranked if p.get("__relevance", 0) >= 1.0][:limit]
    for p in posts:
        p.pop("__relevance", None)

    opinion_summary = await _summarize_reddit_opinion(q, posts)
    return {
        "posts": posts,
        "opinion_summary": opinion_summary,
        "search_queries_used": planned_queries,
    }


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
        "You are a knowledge-graph builder for a research workspace library. "
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
    "Sports":   "#22c55e",
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
_SPORTS_KW = {
    "soccer", "football", "fifa", "uefa", "premier", "league", "la", "liga",
    "bundesliga", "serie", "transfer", "goal", "goals", "match", "club",
    "coach", "manager", "stadium", "champions",
}

_SPORTS_FALLBACK_PINS = [
    {
        "label": "London",
        "desc": "Premier League title race and transfer discussions.",
        "lat": 51.5074,
        "lng": -0.1278,
        "type": "Sports",
        "color": _TYPE_COLORS["Sports"],
    },
    {
        "label": "Madrid",
        "desc": "La Liga competition and squad planning updates.",
        "lat": 40.4168,
        "lng": -3.7038,
        "type": "Sports",
        "color": _TYPE_COLORS["Sports"],
    },
    {
        "label": "Barcelona",
        "desc": "Club rebuild storylines and manager strategy coverage.",
        "lat": 41.3874,
        "lng": 2.1686,
        "type": "Sports",
        "color": _TYPE_COLORS["Sports"],
    },
    {
        "label": "Munich",
        "desc": "Bundesliga title dynamics and Champions League positioning.",
        "lat": 48.1351,
        "lng": 11.5820,
        "type": "Sports",
        "color": _TYPE_COLORS["Sports"],
    },
    {
        "label": "Milan",
        "desc": "Serie A race and transfer market movement.",
        "lat": 45.4642,
        "lng": 9.1900,
        "type": "Sports",
        "color": _TYPE_COLORS["Sports"],
    },
    {
        "label": "Buenos Aires",
        "desc": "South American football headlines and player pipeline news.",
        "lat": -34.6037,
        "lng": -58.3816,
        "type": "Sports",
        "color": _TYPE_COLORS["Sports"],
    },
    {
        "label": "Sao Paulo",
        "desc": "Brazilian football transfer developments and club form.",
        "lat": -23.5505,
        "lng": -46.6333,
        "type": "Sports",
        "color": _TYPE_COLORS["Sports"],
    },
    {
        "label": "Doha",
        "desc": "Regional football governance and tournament planning signals.",
        "lat": 25.2854,
        "lng": 51.5310,
        "type": "Sports",
        "color": _TYPE_COLORS["Sports"],
    },
]


def _classify_type(title: str) -> str:
    words = set(title.lower().split())
    if words & _SPORTS_KW:    return "Sports"
    if words & _CONFLICT_KW:  return "Conflict"
    if words & _FAMINE_KW:    return "Famine"
    if words & _POLITICS_KW:  return "Politics"
    return "Conflict"


def _build_globe_query(topic: str) -> str:
    t = (topic or "").strip().lower()
    if not t:
        return "conflict OR war OR airstrike OR famine OR protest OR coup OR crisis"
    if any(k in t for k in ("soccer", "football", "fifa", "uefa", "la liga", "premier league", "transfer")):
        return "soccer OR football OR fifa OR uefa OR transfer OR \"premier league\" OR \"la liga\" OR \"champions league\""
    if any(k in t for k in ("nba", "basketball")):
        return "nba OR basketball OR playoffs OR trade"
    if any(k in t for k in ("nfl", "american football")):
        return "nfl OR football OR trade OR draft"
    return f"\"{topic}\""


def _is_sports_topic(topic: str) -> bool:
    t = (topic or "").strip().lower()
    return any(k in t for k in (
        "soccer", "football", "fifa", "uefa", "premier league", "la liga",
        "bundesliga", "serie a", "champions league", "transfer", "club"
    ))


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
async def globe_pins(request: Request, topic: str = ""):
    """
    Return geolocated crisis pins for the globe visualisation.
    Queries GDELT GEO API (last 24 h), clusters by proximity,
    caps at 20 pins, and caches the result for 15 minutes.
    Falls back to an empty list on any fetch error — frontend uses WORLD_PINS.
    """
    cache_key = f"globe_pins:{(topic or '').strip().lower()}"
    now = time.time()
    cached = _news_cache.get(cache_key)
    if cached and (now - cached["ts"]) < _GLOBE_PINS_TTL:
        return JSONResponse(cached["data"])

    gdelt_url = "https://api.gdeltproject.org/api/v2/geo/geo"
    params = {
        "query":      _build_globe_query(topic),
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
                    loc = article.get("location") or {}

                    # GDELT GEO API may expose lat/long at top level or inside
                    # a nested 'location' object — handle both.
                    lat = article.get("lat") or article.get("latitude")
                    lng = (article.get("long") or article.get("longitude")
                           or article.get("lng"))
                    if lat is None or lng is None:
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
                    label   = (article.get("name")
                               or loc.get("name")
                               or article.get("domain")
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
    source_name = "gdelt"

    if _is_sports_topic(topic) and len(pins) < 3:
        pins = _SPORTS_FALLBACK_PINS
        source_name = "sports_fallback"
    result = {
        "pins":       pins,
        "source":     source_name,
        "topic":      topic,
        "fetched_at": int(now),
        "live":       len(raw_pins) > 0,
    }
    _news_cache[cache_key] = {"data": result, "ts": now}
    return JSONResponse(result)


# ── Daily Brief ───────────────────────────────────────────────────────────────

class DailyBriefRequest(BaseModel):
    beats: list[str] = []
    profile: dict = {}


class StoryPlanRequest(BaseModel):
    headline: str
    summary: str
    hook: str = ""
    beat: str = ""
    profile: dict = {}


def _fetch_news_ddg(query: str, max_results: int = 5) -> list[dict]:
    """Search DuckDuckGo for recent news snippets."""
    from services.search_service import web_search
    results = web_search(f"{query} news today 2025", max_results=max_results)
    return results


async def _build_daily_digest(body: DailyBriefRequest):
    """
    Fetch live news + generate a personalized AI daily digest with topic cards.
    Returns JSON: { summary, topics[], articles_count }
    """
    # Build search terms from profile + local beats
    search_terms: list[str] = []
    p = body.profile or {}
    focus_area = p.get("focus_area") or p.get("beat")
    if focus_area:
        search_terms.append(focus_area)
    for t in (p.get("topics_of_focus") or [])[:3]:
        if t:
            search_terms.append(t)
    for b in body.beats[:3]:
        if b:
            search_terms.append(b)
    if not search_terms:
        search_terms = ["world news", "international crisis", "breaking news"]

    # Parallel news fetch
    loop = asyncio.get_event_loop()
    tasks = [
        loop.run_in_executor(None, _fetch_news_ddg, term, 4)
        for term in search_terms[:5]
    ]
    results_nested = await asyncio.gather(*tasks, return_exceptions=True)

    articles: list[dict] = []
    seen_urls: set[str] = set()
    for batch in results_nested:
        if isinstance(batch, Exception):
            continue
        for a in batch:
            url = a.get("url", "")
            if url and url not in seen_urls:
                seen_urls.add(url)
                articles.append(a)

    articles = articles[:15]

    # Build prompt
    today = datetime.date.today().strftime("%B %d, %Y")
    profile_line = ""
    if p:
        parts = []
        if p.get("role"):            parts.append(f"Role: {p['role']}")
        if p.get("organization"):    parts.append(f"Org: {p['organization']}")
        if focus_area:               parts.append(f"Focus area: {focus_area}")
        if p.get("topics_of_focus"): parts.append(f"Focus: {', '.join(p['topics_of_focus'])}")
        profile_line = " | ".join(parts)

    articles_block = "\n".join(
        f"[{i+1}] {a['title']}\n    {a['snippet'][:200]}\n    URL: {a['url']}"
        for i, a in enumerate(articles)
    ) or "No live articles fetched — use your general knowledge of today's events."

    prompt = f"""You are an AI daily digest assistant for researchers and analysts. Today is {today}.

USER PROFILE: {profile_line or "General researcher"}

LIVE NEWS ARTICLES:
{articles_block}

Generate a daily digest. Return ONLY a raw JSON object (no markdown fences) in this exact schema:
{{
  "summary": "2-3 sentence personalized digest written directly to the user. Mention their focus area when relevant. Calm, direct tone.",
  "topics": [
    {{
      "headline": "Punchy 7-10 word news headline",
      "summary": "2 sentences: what happened and why it matters right now.",
      "hook": "One sharp sentence: the best next research angle for this user.",
      "urgency": "Breaking|Developing|Analysis|Feature",
      "beat": "Which focus area this belongs to",
      "source": "Source name or domain",
      "url": "URL from the articles list above, or empty string",
      "relevance": "High|Medium|Low",
      "contradiction_potential": "High|Medium|Low",
      "questions": ["Key question 1", "Key question 2", "Key question 3"]
    }}
  ]
}}

Rules:
- Include 5-7 topics total
- Mix urgency levels (at least 1 Breaking or Developing if the news supports it)
- Mark relevance High only if it directly overlaps with the user's focus area
- contradiction_potential High = sources are likely to disagree on this topic
- Return ONLY the JSON object, nothing else"""

    try:
        raw = llm_service.chat_sync(
            [{"role": "user", "content": prompt}],
            timeout=45,
            max_tokens=2500,
        )
        raw = raw.strip()
        # Strip markdown fences if model added them anyway
        raw = re.sub(r"^```[a-z]*\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw).strip()
        data = json.loads(raw)
        data["articles_count"] = len(articles)
        data["generated_at"] = today
        return JSONResponse(data)
    except Exception as exc:
        logger.error("daily_digest.failed: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to generate daily digest")


@router.post("/explore/daily-digest")
@limiter.limit("10/minute")
async def daily_digest(request: Request, body: DailyBriefRequest):
    """
    Daily digest endpoint (preferred).
    """
    return await _build_daily_digest(body)


@router.post("/explore/daily-brief")
@limiter.limit("10/minute")
async def daily_brief(request: Request, body: DailyBriefRequest):
    """
    Backward-compatible alias for older clients.
    """
    return await _build_daily_digest(body)


@router.post("/explore/story-plan")
@limiter.limit("15/minute")
async def story_plan(request: Request, body: StoryPlanRequest):
    """
    Stream a full research plan for a chosen topic.
    SSE: data: <text chunk>\n\n  …  data: [DONE]\n\n
    """
    p = body.profile or {}
    profile_line = ""
    if p:
        parts = []
        if p.get("role"):            parts.append(p["role"])
        if p.get("organization"):    parts.append(p["organization"])
        if p.get("focus_area") or p.get("beat"):
            parts.append(f"focus area: {p.get('focus_area') or p.get('beat')}")
        profile_line = ", ".join(parts)

    prompt = f"""You are a senior research editor helping a user ({profile_line or "general researcher"}) plan analysis work.

TOPIC: {body.headline}
SUMMARY: {body.summary}
{f"USER ANGLE: {body.hook}" if body.hook else ""}

Write a detailed, actionable research plan in this exact structure using markdown:

## The Angle
One sharp paragraph: what this user's specific take should be, framed for their focus area ({body.beat or "general research"}).

## Why Now — The News Hook
Explain why this topic matters now.

## Core Questions to Answer
- Question 1 (the essential "what happened")
- Question 2 (the "why / what caused it")
- Question 3 (the "who is affected and how")
- Question 4 (the "what comes next / implications")

## Sources to Reach Out To
- **[Source type]** — why they matter for this topic
- (list 4-5 specific source types: officials, experts, NGOs, affected people, documents)

## Potential Contradictions & Tensions
Where are sources likely to disagree? What claims should be verified against each other? Flag 2-3 specific tensions.

## Suggested Notes Structure
1. **Lead** — the single most important opening sentence
2. **Nut graf** — why this matters, context
3. **Key facts** — the 3-4 essential data points
4. **Voices** — quotes that give human texture
5. **Analysis** — what it means for the bigger picture
6. **Conclusion** — what to track next

## Research Starting Points
Suggest 3 specific search queries to continue investigation in Quarry."""

    user_ctx = _build_user_context(request)
    if user_ctx:
        prompt = user_ctx + "\n\n" + prompt

    def _generate():
        try:
            for chunk in llm_service.stream_sync(
                [{"role": "user", "content": prompt}]
            ):
                yield f"data: {json.dumps({'text': chunk})}\n\n"
        except Exception as exc:
            logger.error("story_plan.stream_failed: %s", exc)
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        _generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ── Deep Analysis ─────────────────────────────────────────────────────────────

_DEEP_SYSTEM_PROMPT = """\
You are Quarry Deep Analysis — an epistemic reasoning engine embedded in an \
investigative research tool. You receive a query and a set of web sources \
scraped for that query.

## Your task

Reason internally as much as needed. Then output EXACTLY ONE JSON object \
conforming to the schema below. Output nothing else — no preamble, no markdown \
fences, no explanation, no chain-of-thought prose. If you are unsure about \
a field, use null or an empty array rather than fabricating content.

## Output schema

{
  "answer": "<string: concise natural-language answer, 2-4 paragraphs, \
markdown allowed, inline citations like [Source Title](url) encouraged. \
DO NOT include internal reasoning here — only the answer the user would read.>",

  "analysis": {

    "claims": [
      {
        "text": "<string: one complete, standalone factual claim>",
        "confidence": "<'high' | 'medium' | 'low' | 'contested'>",
        "sources": [
          {
            "title": "<string: source article title>",
            "url": "<string: full URL>",
            "quote": "<string: verbatim or near-verbatim excerpt | null>"
          }
        ]
      }
    ],

    "gaps": [
      {
        "question": "<string: specific unanswered question, framed as a question>",
        "why_it_matters": "<string: one sentence on research or epistemic significance>",
        "severity": "<'critical' | 'moderate' | 'minor'>"
      }
    ],

    "timeline_events": [
      {
        "date": "<string: ISO 8601 'YYYY-MM-DD', or approximate e.g. 'early 2024', '2023-Q2'>",
        "event": "<string: what happened, one sentence>",
        "source_url": "<string: URL | null>"
      }
    ],

    "perspectives": [
      {
        "actor": "<string: outlet name, org name, or category e.g. 'Government of Sudan'>",
        "role": "<'state' | 'ngo' | 'wire' | 'local' | 'academic' | 'think_tank' | 'corporate' | 'unknown'>",
        "stance": "<string: 1-2 sentence characterisation of their position or framing>",
        "url": "<string: representative URL | null>"
      }
    ]
  }
}

## Confidence calibration

- high — two or more independent, primary sources explicitly state this
- medium — one credible source states it, or multiple sources imply it
- low — inferred from context, single peripheral source, or paraphrase
- contested — sources actively and explicitly disagree on this point

## What NOT to do

- Do NOT output any text before or after the JSON object.
- Do NOT wrap the JSON in markdown code fences (no ```json).
- Do NOT include your reasoning steps in the output.
- Do NOT fabricate claims, quotes, URLs, or timeline events not present \
in the provided sources.
- Do NOT flag perspective differences as contradictions — \
contradictions are factual conflicts, not editorial framing differences.
- Do NOT include a claim in `claims[]` unless at least one source \
in the provided context supports it.
- If no timeline events are discernible, return an empty array for \
timeline_events — do not invent dates.
"""


def _build_deep_user_message(query: str, sources: list[DeepSourceContext]) -> str:
    """Format the query + scraped sources into a user message for the LLM."""
    parts = [f"QUERY: {query}\n"]

    if not sources:
        parts.append("No sources were provided. Answer based on your training knowledge, but flag all claims as low-confidence and note in gaps[] that no live sources were available.\n")
    else:
        parts.append(f"SOURCES ({len(sources)} total):\n")
        for i, s in enumerate(sources, 1):
            parts.append(f"[{i}] {s.title}")
            parts.append(f"URL: {s.url}")
            if s.snippet:
                parts.append(f"Snippet: {s.snippet}")
            if s.markdown:
                # Trim to avoid overshooting context; first 2500 chars per source
                trimmed = s.markdown[:2500]
                if len(s.markdown) > 2500:
                    trimmed += "\n[…truncated]"
                parts.append(f"Content:\n{trimmed}")
            parts.append("")  # blank line between sources

    return "\n".join(parts)


def _parse_deep_response(raw: str) -> DeepAnalysisResponse:
    """
    Parse the raw LLM string into a DeepAnalysisResponse.
    Strips accidental markdown fences before parsing.
    Raises ValueError on invalid JSON or schema mismatch.
    """
    text = raw.strip()

    # Strip ```json ... ``` or ``` ... ``` fences if the model disobeyed
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
        text = text.strip()

    data = json.loads(text)  # raises json.JSONDecodeError on bad JSON

    # Pydantic validates and coerces
    return DeepAnalysisResponse(**data)


@router.post("/deep_analyze", response_model=DeepAnalysisResponse)
@limiter.limit("10/minute")
async def deep_analyze(request: Request, body: DeepAnalyzeRequest):
    """
    Deep epistemic analysis of a query using pre-fetched session sources.

    Accepts the query and optionally the sources already retrieved by the
    main /explore/search call (passed back from the frontend as session_context).
    Returns a structured DeepAnalysisResponse — NOT a stream.
    """
    query = body.query

    # Extract sources from session_context
    raw_sources: list[dict] = []
    if body.session_context and isinstance(body.session_context.get("sources"), list):
        raw_sources = body.session_context["sources"]

    sources = [
        DeepSourceContext(
            title=s.get("title", ""),
            url=s.get("url", ""),
            snippet=s.get("snippet", ""),
            markdown=s.get("markdown", ""),
        )
        for s in raw_sources
        if isinstance(s, dict) and s.get("url")
    ]

    user_message = _build_deep_user_message(query, sources)

    user_context = _build_user_context(request)
    system_prompt = _DEEP_SYSTEM_PROMPT
    if user_context:
        system_prompt = f"{user_context}\n\n{system_prompt}"

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user",   "content": user_message},
    ]

    try:
        raw = await asyncio.to_thread(
            llm_service.chat_sync,
            messages,
            "openai/gpt-4o",   # deep mode always uses the full model
            45,                 # timeout — deep analysis is allowed more time
            3000,               # max_tokens — analysis JSON can be large
        )
    except Exception as exc:
        logger.error("deep_analyze.llm_failed: %s", exc)
        raise HTTPException(status_code=502, detail="LLM call failed. Please try again.")

    try:
        result = _parse_deep_response(raw)
    except (json.JSONDecodeError, ValueError, Exception) as exc:
        logger.error("deep_analyze.parse_failed: %s | raw=%s", exc, raw[:400])
        raise HTTPException(
            status_code=502,
            detail="Deep analysis returned malformed data. Please retry.",
        )

    return result


# ── Deep Diagram ──────────────────────────────────────────────────────────────

_DEEP_DIAGRAM_SYSTEM_PROMPT = """\
You are Quarry Diagram Engine — a specialist that decides whether the accumulated \
session context warrants an auto-generated diagram, and if so, emits a compact \
machine-readable diagram specification.

## Decision rule

Emit a diagram ONLY if at least one of the following is true:
- There are 2 or more distinct dated events that together form a sequence → use "timeline"
- There are 3 or more distinct actors with meaningful relationships (e.g. state, NGO, \
armed group, corridor operators) → use "actorGraph"
- There is a geographical route, crossing, corridor, or supply chain with multiple \
named locations and a mix of operational/blocked/proposed statuses → use "corridorMap"

If NONE of these conditions hold, output exactly: {"diagramType": null}

## Output format

If a diagram IS warranted, output ONLY valid JSON — no preamble, no markdown fences, \
no explanation. Match this schema exactly:

{
  "diagramType": "timeline" | "actorGraph" | "corridorMap",
  "title": "<8 words or fewer>",
  "nodes": [
    {
      "id": "<short_snake_case_id>",
      "label": "<display label>",
      "type": "<see type rules below>",
      "status": "<'operational'|'blocked'|'proposed'|'suspended'|'unknown' — corridorMap only, else omit>",
      "meta": { ... }
    }
  ],
  "edges": [
    {
      "source": "<node id>",
      "target": "<node id>",
      "label": "<relation in 3 words or fewer>",
      "status": "<'active'|'blocked'|'proposed'|'contested' — omit if not relevant>"
    }
  ],
  "meta": {
    "context": "<one sentence>",
    "date_range": "<e.g. '2023-10 – 2024-04' — timeline only>",
    "confidence": "<'high'|'medium'|'low'>"
  }
}

## Type rules

timeline  — nodes have meta.date (ISO 8601 or approximate) and meta.description; \
no edges needed.

actorGraph — node.type one of: state | ngo | wire | armed_group | intergovernmental | \
media | unknown. Edges are directional relations: label must be a short verb phrase \
("blocks aid", "coordinates with", "receives funding", "opens crossing").

corridorMap — node.type one of: border_crossing | port | warehouse | city | airstrip | \
maritime_corridor | unknown. Edge label is a route description. Node status captures \
current operational state.

## What NOT to do
- Do NOT emit chain-of-thought text.
- Do NOT add markdown code fences.
- Do NOT fabricate nodes or events not grounded in the session summary.
- Do NOT use generic labels like "Actor A" — use real names from the session.
- Do NOT emit more than 12 nodes or 16 edges — keep the spec renderable.
"""


def _build_diagram_user_message(query: str, session_summary: str) -> str:
    parts = [f"CURRENT QUERY: {query}\n"]
    if session_summary.strip():
        parts.append(f"SESSION SUMMARY:\n{session_summary.strip()}")
    else:
        parts.append(
            "SESSION SUMMARY: Only one query so far. "
            "Decide based solely on the current query content."
        )
    return "\n".join(parts)


def _parse_diagram_response(raw: str) -> DiagramSpec:
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
        text = text.strip()
    data = json.loads(text)
    # Normalise: frontend sends camelCase alias, pydantic model accepts both
    return DiagramSpec(**data)


@router.post("/deep_diagram", response_model=DiagramSpec)
@limiter.limit("15/minute")
async def deep_diagram(request: Request, body: DeepDiagramRequest):
    """
    Decide whether the current session warrants an auto-generated diagram.
    Returns a DiagramSpec with diagramType=null if no diagram is warranted,
    or a full spec (timeline / actorGraph / corridorMap) otherwise.
    """
    user_message = _build_diagram_user_message(body.query, body.session_summary)
    messages = [
        {"role": "system", "content": _DEEP_DIAGRAM_SYSTEM_PROMPT},
        {"role": "user",   "content": user_message},
    ]

    try:
        raw = await asyncio.to_thread(
            llm_service.chat_sync,
            messages,
            "openai/gpt-4o",
            30,    # timeout
            1500,  # max_tokens — diagram JSON is compact
        )
    except Exception as exc:
        logger.error("deep_diagram.llm_failed: %s", exc)
        raise HTTPException(status_code=502, detail="Diagram LLM call failed.")

    try:
        return _parse_diagram_response(raw)
    except (json.JSONDecodeError, ValueError, Exception) as exc:
        logger.error("deep_diagram.parse_failed: %s | raw=%s", exc, raw[:300])
        # Graceful degradation: return no-diagram spec rather than a 502
        return DiagramSpec(diagramType=None, title="", nodes=[], edges=[])
