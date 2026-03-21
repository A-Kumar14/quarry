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
from fastapi import APIRouter, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse

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
    force: bool = Query(False),
):
    """Proxy GNews top-headlines server-side."""
    gnews_key = os.getenv("GNEWS_API_KEY", "")
    if not gnews_key:
        raise HTTPException(status_code=503, detail="News service not configured")

    cache_key = f"trending:{max}"
    if not force:
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
