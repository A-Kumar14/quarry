"""
search_service.py — Web search + scraping pipeline.

Uses DuckDuckGo (free, no API key) for search and trafilatura for clean
Markdown extraction from web pages.
"""

from __future__ import annotations

import logging
import concurrent.futures
from typing import Any

logger = logging.getLogger(__name__)

# ── DuckDuckGo search ──────────────────────────────────────────────────────────

def web_search(query: str, max_results: int = 8) -> list[dict[str, str]]:
    """Return a list of {title, url, snippet} dicts from DuckDuckGo."""
    try:
        try:
            from ddgs import DDGS
        except ImportError:
            from duckduckgo_search import DDGS
        results: list[dict[str, str]] = []
        with DDGS() as ddgs:
            for r in ddgs.text(query, max_results=max_results):
                results.append({
                    "title": r.get("title", ""),
                    "url": r.get("href", r.get("link", "")),
                    "snippet": r.get("body", r.get("description", "")),
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
        downloaded = trafilatura.fetch_url(url)
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
        # Truncate to ~3 000 chars to keep context manageable
        return {"url": url, "markdown": text[:3000]}
    except Exception as exc:
        logger.warning("scrape.failed url=%s: %s", url, exc)
        return None

def scrape_urls(urls: list[str], max_pages: int = 5) -> list[dict[str, str]]:
    """Scrape up to *max_pages* URLs in parallel. Returns [{url, markdown}]."""
    targets = urls[:max_pages]
    scraped: list[dict[str, str]] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        futures = {pool.submit(_scrape_one, url): url for url in targets}
        for future in concurrent.futures.as_completed(futures, timeout=15):
            result = future.result()
            if result:
                scraped.append(result)
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

    all_events: list[dict] = []
    for league_id, league_name in _ESPN_LEAGUES:
        try:
            url = (
                f"https://site.api.espn.com/apis/site/v2/sports/soccer"
                f"/{league_id}/scoreboard"
            )
            r = requests.get(url, timeout=4, headers={"User-Agent": "Mozilla/5.0"})
            if not r.ok:
                continue
            for event in r.json().get("events", []):
                comps = event.get("competitions", [{}])
                competitors = comps[0].get("competitors", []) if comps else []
                status = event.get("status", {})
                names = [c.get("team", {}).get("displayName", "") for c in competitors]
                scores = [c.get("score", "?") for c in competitors]
                all_events.append({
                    "league":  league_name,
                    "names":   names,
                    "score":   " - ".join(scores),
                    "state":   status.get("type", {}).get("description", ""),
                    "clock":   status.get("displayClock", ""),
                })
        except Exception as exc:
            logger.warning("fetch_live_scores.%s: %s", league_id, exc)

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
            lines.append(f"Content:\n{md}")
        elif snippet:
            lines.append(f"Snippet: {snippet}")
        lines.append("")  # blank separator

    context_block = "\n".join(lines)
    return context_block, sources
