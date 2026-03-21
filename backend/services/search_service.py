"""
search_service.py — Web search + scraping pipeline.

Uses DuckDuckGo (free, no API key) for search and trafilatura for clean
Markdown extraction from web pages.
"""

from __future__ import annotations

import ipaddress
import logging
import re
import concurrent.futures
from typing import Any
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

# ── Prompt injection sanitizer ─────────────────────────────────────────────────

_INJECTION_PATTERNS = [
    re.compile(r"ignore\s+(all\s+)?(previous|prior|above)\s+instructions?", re.IGNORECASE),
    re.compile(r"you\s+are\s+(now\s+)?(a\s+|an\s+)?(different|new|another)", re.IGNORECASE),
    re.compile(r"\[INST\]|\[/INST\]|<<SYS>>|<</SYS>>", re.IGNORECASE),
    re.compile(r"<(system|user|assistant)>", re.IGNORECASE),
    re.compile(r"(?m)^(system|assistant|user)\s*:", re.IGNORECASE),
    re.compile(r"disregard\s+(all\s+)?previous", re.IGNORECASE),
]


def sanitize_scraped_content(text: str) -> str:
    """Strip prompt injection patterns from scraped web content."""
    for pattern in _INJECTION_PATTERNS:
        text = pattern.sub("[removed]", text)
    return text


# ── SSRF guard ────────────────────────────────────────────────────────────────

_PRIVATE_NETWORKS = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),   # link-local / cloud metadata
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
]

_BLOCKED_HOSTNAMES = {
    "localhost",
    "metadata.google.internal",
    "instance-data",
    "169.254.169.254",  # AWS metadata IP as hostname string
}


def is_safe_url(url: str) -> bool:
    """Return True only if the URL is safe to scrape (no SSRF risk)."""
    try:
        parsed = urlparse(url)
    except Exception:
        return False

    if parsed.scheme not in ("http", "https"):
        return False

    host = parsed.hostname
    if not host:
        return False

    if host.lower() in _BLOCKED_HOSTNAMES:
        return False

    try:
        addr = ipaddress.ip_address(host)
        for net in _PRIVATE_NETWORKS:
            if addr in net:
                return False
    except ValueError:
        pass  # Not an IP address — hostname is allowed

    return True

# ── DuckDuckGo search ──────────────────────────────────────────────────────────

def _decode_html_entities(text: str) -> str:
    """Decode HTML entities (e.g. &#8217; → ', &amp; → &) in a string."""
    try:
        from html import unescape
        return unescape(text)
    except Exception:
        return text


def web_search(query: str, max_results: int = 5) -> list[dict[str, str]]:
    """Return a list of {title, url, snippet} dicts from DuckDuckGo."""
    try:
        try:
            from ddgs import DDGS
        except ImportError:
            from duckduckgo_search import DDGS
        results: list[dict[str, str]] = []
        with DDGS() as ddgs:
            for r in ddgs.text(query, max_results=max_results, timeout=8):
                results.append({
                    "title": _decode_html_entities(r.get("title", "")),
                    "url": r.get("href", r.get("link", "")),
                    "snippet": _decode_html_entities(r.get("body", r.get("description", ""))),
                })
        logger.info("web_search.ok query=%s count=%d", query, len(results))
        return results
    except Exception as exc:
        logger.error("web_search.failed: %s", exc)
        return []

# ── Trafilatura scraping ───────────────────────────────────────────────────────

def _scrape_one(url: str) -> dict[str, str] | None:
    """Fetch a URL and return clean Markdown, or None on failure."""
    try:
        import trafilatura
        downloaded = trafilatura.fetch_url(url, no_ssl=False, timeout=4)
        if not downloaded:
            return None
        text = trafilatura.extract(
            downloaded,
            output_format="markdown",
            include_links=False,
            include_images=False,
        )
        if not text:
            return None
        # Truncate to 2 000 chars — enough context, less to send to the LLM
        return {"url": url, "markdown": text[:2000]}
    except Exception as exc:
        logger.warning("scrape.failed url=%s: %s", url, exc)
        return None

def scrape_urls(urls: list[str], max_pages: int = 3) -> list[dict[str, str]]:
    """Scrape up to *max_pages* URLs in parallel. Returns [{url, markdown}]."""
    targets = [u for u in urls if is_safe_url(u)][:max_pages]
    scraped: list[dict[str, str]] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        futures = {pool.submit(_scrape_one, url): url for url in targets}
        for future in concurrent.futures.as_completed(futures, timeout=8):
            try:
                result = future.result()
                if result:
                    scraped.append(result)
            except Exception:
                pass
    logger.info("scrape.done scraped=%d attempted=%d", len(scraped), len(targets))
    return scraped

# ── Context builder ───────────────────────────────────────────────────────────

_SCORE_KEYWORDS = {'score', 'live', 'result', 'vs', 'match', 'game', 'playing', 'beat', 'won', 'goal', 'final'}

_ESPN_LEAGUES = [
    ('UEFA.CHAMPIONS',  'UEFA Champions League'),
    ('UEFA.EUROPA',     'UEFA Europa League'),
    ('eng.1',           'Premier League'),
    ('esp.1',           'La Liga'),
    ('ger.1',           'Bundesliga'),
    ('ita.1',           'Serie A'),
    ('fra.1',           'Ligue 1'),
    ('usa.1',           'MLS'),
]


def fetch_live_scores(query: str) -> str:
    """
    Hit ESPN's free (no-auth) soccer scoreboard API and return a
    pre-formatted string for injection into the LLM context.
    Returns an empty string when the query doesn't look score-related
    or no matching events are found.
    """
    import requests

    q_lower = query.lower()
    if not any(k in q_lower for k in _SCORE_KEYWORDS):
        return ""

    def _fetch_league(league_id: str, league_name: str) -> list[dict]:
        try:
            url = (
                f"https://site.api.espn.com/apis/site/v2/sports/soccer"
                f"/{league_id}/scoreboard"
            )
            r = requests.get(url, timeout=3, headers={"User-Agent": "Mozilla/5.0"})
            if not r.ok:
                return []
            events = []
            for event in r.json().get("events", []):
                comps = event.get("competitions", [{}])
                competitors = comps[0].get("competitors", []) if comps else []
                status = event.get("status", {})
                names = [c.get("team", {}).get("displayName", "") for c in competitors]
                scores = [c.get("score", "?") for c in competitors]
                events.append({
                    "league": league_name,
                    "names":  names,
                    "score":  " - ".join(scores),
                    "state":  status.get("type", {}).get("description", ""),
                    "clock":  status.get("displayClock", ""),
                })
            return events
        except Exception as exc:
            logger.warning("fetch_live_scores.%s: %s", league_id, exc)
            return []

    all_events: list[dict] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(_ESPN_LEAGUES)) as pool:
        futures = {pool.submit(_fetch_league, lid, lname): lid for lid, lname in _ESPN_LEAGUES}
        for future in concurrent.futures.as_completed(futures, timeout=4):
            try:
                all_events.extend(future.result())
            except Exception:
                pass

    if not all_events:
        return ""

    # Prefer events whose team names appear in the query
    def relevance(ev: dict) -> int:
        return sum(
            1 for name in ev["names"]
            for word in name.lower().split()
            if len(word) > 3 and word in q_lower
        )

    all_events.sort(key=relevance, reverse=True)
    relevant = [e for e in all_events if relevance(e) > 0] or all_events[:5]

    lines = ["[LIVE SCORES — ESPN]"]
    for e in relevant[:6]:
        detail = f" {e['clock']}" if e["clock"] else ""
        teams  = " vs ".join(e["names"])
        lines.append(f"{e['league']}: {teams} — {e['score']} [{e['state']}{detail}]")

    return "\n".join(lines)


def build_context(
    results: list[dict[str, str]],
    scraped: list[dict[str, str]],
) -> tuple[str, list[dict[str, str]]]:
    """
    Combine search snippets and scraped Markdown into a numbered context block
    suitable for injection into an LLM system prompt.

    Returns (context_block, source_list) where source_list = [{title, url, snippet}].
    """
    # Build a URL → scraped-markdown lookup
    scraped_map: dict[str, str] = {s["url"]: s["markdown"] for s in scraped}

    lines: list[str] = []
    sources: list[dict[str, str]] = []

    for idx, r in enumerate(results, start=1):
        url = r.get("url", "")
        title = r.get("title", url)
        snippet = r.get("snippet", "")
        md = scraped_map.get(url, "")

        sources.append({"title": title, "url": url, "snippet": snippet})
        lines.append(f"[{idx}] **{title}**\nURL: {url}")
        if md:
            lines.append(f"Content:\n{sanitize_scraped_content(md)}")
        elif snippet:
            lines.append(f"Snippet: {snippet}")
        lines.append("")  # blank separator

    context_block = "\n".join(lines)
    return context_block, sources
