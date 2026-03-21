"""
services/finance_service.py — Query classification and live finance data via yfinance.
"""

import logging
import re
import time

logger = logging.getLogger(__name__)

# ── Known tickers & company names ─────────────────────────────────────────────

KNOWN_TICKERS: dict[str, str] = {
    "AAPL":  "Apple Inc.",               "MSFT":  "Microsoft Corp.",
    "GOOGL": "Alphabet Inc.",            "GOOG":  "Alphabet Inc.",
    "AMZN":  "Amazon.com",               "NVDA":  "Nvidia Corp.",
    "TSLA":  "Tesla Inc.",               "META":  "Meta Platforms",
    "JPM":   "JPMorgan Chase",           "V":     "Visa Inc.",
    "NFLX":  "Netflix Inc.",             "AMD":   "Advanced Micro Devices",
    "ORCL":  "Oracle Corp.",             "BRK-B": "Berkshire Hathaway Inc.",
    "TSM":   "TSMC",                     "BA":    "The Boeing Company",
    "DIS":   "The Walt Disney Co.",      "GE":    "GE Aerospace",
    "HD":    "The Home Depot, Inc.",     "NKE":   "NIKE, Inc.",
    "PYPL":  "PayPal Holdings",          "INTC":  "Intel Corp.",
    "CRM":   "Salesforce Inc.",          "UBER":  "Uber Technologies",
    "SHOP":  "Shopify Inc.",             "SNOW":  "Snowflake Inc.",
    "PLTR":  "Palantir Technologies",    "COIN":  "Coinbase Global",
    "RBLX":  "Roblox Corp.",             "SPOT":  "Spotify Technology",
    "ABNB":  "Airbnb Inc.",              "LYFT":  "Lyft Inc.",
    "RIVN":  "Rivian Automotive",        "LCID":  "Lucid Group",
    "WMT":   "Walmart Inc.",             "TGT":   "Target Corp.",
    "COST":  "Costco Wholesale",         "MCD":   "McDonald's Corp.",
    "SBUX":  "Starbucks Corp.",          "PFE":   "Pfizer Inc.",
    "JNJ":   "Johnson & Johnson",        "MRNA":  "Moderna Inc.",
    "XOM":   "Exxon Mobil Corp.",        "CVX":   "Chevron Corp.",
    "GS":    "Goldman Sachs Group",      "MS":    "Morgan Stanley",
    "BAC":   "Bank of America Corp.",    "WFC":   "Wells Fargo & Co.",
    # Indices
    "^DJI":  "Dow Jones Industrial Avg.", "^GSPC": "S&P 500",
    "^IXIC": "Nasdaq Composite",          "^RUT":  "Russell 2000",
    "^VIX":  "CBOE Volatility Index",
}

COMPANY_TO_TICKER: dict[str, str] = {
    "apple":              "AAPL",  "microsoft":         "MSFT",
    "google":             "GOOGL", "alphabet":          "GOOGL",
    "amazon":             "AMZN",  "nvidia":            "NVDA",
    "tesla":              "TSLA",  "meta":              "META",
    "facebook":           "META",  "jpmorgan":          "JPM",
    "jp morgan":          "JPM",   "visa":              "V",
    "netflix":            "NFLX",  "advanced micro":    "AMD",
    "oracle":             "ORCL",  "berkshire":         "BRK-B",
    "taiwan semiconductor":"TSM",  "tsmc":              "TSM",
    "boeing":             "BA",    "disney":            "DIS",
    "ge aerospace":       "GE",    "home depot":        "HD",
    "nike":               "NKE",   "paypal":            "PYPL",
    "intel":              "INTC",  "salesforce":        "CRM",
    "uber":               "UBER",  "shopify":           "SHOP",
    "snowflake":          "SNOW",  "palantir":          "PLTR",
    "coinbase":           "COIN",  "roblox":            "RBLX",
    "spotify":            "SPOT",  "airbnb":            "ABNB",
    "walmart":            "WMT",   "target":            "TGT",
    "costco":             "COST",  "mcdonald":          "MCD",
    "starbucks":          "SBUX",  "pfizer":            "PFE",
    "johnson & johnson":  "JNJ",   "moderna":           "MRNA",
    "exxon":              "XOM",   "chevron":           "CVX",
    "goldman sachs":      "GS",    "goldman":           "GS",
    "morgan stanley":     "MS",    "bank of america":   "BAC",
    "wells fargo":        "WFC",   "rivian":            "RIVN",
    "lucid":              "LCID",  "lyft":              "LYFT",
    "dow jones":          "^DJI",  "s&p 500":           "^GSPC",
    "nasdaq":             "^IXIC", "vix":               "^VIX",
}

FINANCE_KEYWORDS = {
    "stock", "stocks", "share", "shares", "price", "market cap", "valuation",
    "earnings", "revenue", "profit", "eps", "pe ratio", "p/e", "dividend",
    "ipo", "trading", "investor", "portfolio", "ticker", "nyse",
    "bull", "bear", "rally", "dip", "correction", "short", "long",
    "options", "calls", "puts", "hedge fund", "quarterly", "fiscal",
    "balance sheet", "cash flow", "debt", "guidance", "analyst", "upgrade",
    "downgrade", "buy rating", "sell rating", "price target", "52-week",
    "all-time high", "market", "wall street", "premarket", "after-hours",
    "short squeeze", "short interest", "float", "shares outstanding",
}

STRONG_FINANCE_PHRASES = {
    "stock price", "share price", "earnings report", "stock market",
    "market cap", "ipo date", "dividend yield", "pe ratio", "p/e ratio",
    "trading at", "what happened to", "why is", "why did", "down today",
    "up today", "fell today", "rose today", "dropped today",
}

# ── Query classification ───────────────────────────────────────────────────────

_INDEX_MAP = {"^DJI": "DOW", "^GSPC": "S&P 500", "^IXIC": "NASDAQ", "^RUT": "Russell 2000", "^VIX": "VIX"}


def _display_ticker(ticker: str) -> str:
    return _INDEX_MAP.get(ticker, ticker)


def extract_ticker(query: str) -> str | None:
    """Extract a ticker symbol from a free-text query. Returns the raw yfinance key."""
    # 1. Explicit $TICKER
    m = re.search(r'\$([A-Z\^]{1,6}(?:-[AB])?)', query)
    if m:
        candidate = m.group(1)
        if candidate in KNOWN_TICKERS:
            return candidate

    # 2. Bare uppercase ticker against known list (avoids false positives like "I" or "A")
    for word in re.findall(r'\b([A-Z\^]{1,5}(?:-[AB])?)\b', query):
        if word in KNOWN_TICKERS:
            return word

    # 3. Company name lookup
    q_lower = query.lower()
    for name, ticker in sorted(COMPANY_TO_TICKER.items(), key=lambda x: -len(x[0])):
        if name in q_lower:
            return ticker

    return None


def is_finance_query(query: str) -> tuple[bool, str | None]:
    """
    Returns (is_finance, ticker_or_None).
    Classifies a query as finance-related based on ticker presence + keywords.
    """
    q_lower = query.lower()
    ticker = extract_ticker(query)
    has_finance_kw = any(kw in q_lower for kw in FINANCE_KEYWORDS)

    # Explicit $TICKER — unambiguous
    if re.search(r'\$[A-Z]{1,5}', query):
        return True, ticker

    # Known ticker + any finance keyword
    if ticker and has_finance_kw:
        return True, ticker

    # Strong finance phrases even without a specific ticker
    if any(phrase in q_lower for phrase in STRONG_FINANCE_PHRASES) and ticker:
        return True, ticker

    # Query is entirely about the stock market in general (no specific ticker)
    general_market = {"stock market", "dow jones", "s&p 500", "nasdaq", "wall street"}
    if any(phrase in q_lower for phrase in general_market):
        return True, ticker

    return False, None


# ── Live quote fetching ────────────────────────────────────────────────────────

_quote_cache: dict = {}
_QUOTE_TTL = 60  # seconds


def get_quote(ticker: str) -> dict | None:
    """
    Fetch current price, change, sparkline for a ticker.
    Uses yf.download (same pattern as the stocks marquee endpoint).
    Cached 60 seconds.
    """
    key = ticker.upper()
    cached = _quote_cache.get(key)
    if cached and time.time() - cached["ts"] < _QUOTE_TTL:
        return cached["data"]

    try:
        import yfinance as yf

        raw = yf.download(
            key,
            period="2d",
            interval="5m",
            auto_adjust=True,
            progress=False,
        )
        if raw.empty:
            return None

        closes = raw["Close"]
        # yfinance ≥2.x returns a DataFrame with the ticker as column header
        # even for single-symbol downloads — flatten to a Series.
        if hasattr(closes, "columns"):
            closes = closes.iloc[:, 0]
        closes = closes.dropna()
        if closes.empty:
            return None

        dates = [d.date() for d in closes.index]
        today = dates[-1]
        today_vals = [float(v) for v, d in zip(closes, dates) if d == today]
        yest_vals  = [float(v) for v, d in zip(closes, dates) if d != today]

        if not today_vals:
            return None

        price      = today_vals[-1]
        prev_close = yest_vals[-1] if yest_vals else today_vals[0]
        if prev_close == 0:
            return None

        change = round(price - prev_close, 2)
        pct    = round((change / prev_close) * 100, 2)

        step      = max(1, len(today_vals) // 40)
        sparkline = [round(v, 2) for v in today_vals[::step]]

        # Best-effort market cap
        market_cap = None
        try:
            info = yf.Ticker(key).fast_info
            market_cap = getattr(info, "market_cap", None)
        except Exception:
            pass

        data = {
            "ticker":    _display_ticker(key),
            "rawTicker": key,
            "name":      KNOWN_TICKERS.get(key, key),
            "price":     round(price, 2),
            "change":    change,
            "changePct": pct,
            "sparkline": sparkline,
            "marketCap": market_cap,
        }
        _quote_cache[key] = {"data": data, "ts": time.time()}
        return data

    except Exception as exc:
        logger.error("finance_service.get_quote ticker=%s error=%s", key, exc)
        return None


def get_company_news(ticker: str) -> list[dict]:
    """Return up to 4 recent news headlines for a ticker via yfinance."""
    try:
        import yfinance as yf
        items = yf.Ticker(ticker.upper()).news or []
        results = []
        for item in items[:6]:
            # yfinance ≥0.2.50 wraps content in a nested dict
            content = item.get("content") if isinstance(item.get("content"), dict) else {}
            title = content.get("title") or item.get("title", "")
            url   = (content.get("canonicalUrl") or {}).get("url", "") or item.get("link", "")
            pub   = (content.get("provider") or {}).get("displayName", "") or item.get("publisher", "")
            if title:
                results.append({"title": title, "url": url, "publisher": pub})
        return results[:4]
    except Exception as exc:
        logger.error("finance_service.get_company_news ticker=%s error=%s", ticker, exc)
        return []
