"""
services/image_service.py — Images from og:image / twitter:image meta tags
scraped from DuckDuckGo web search results. No API key required.
"""

from __future__ import annotations

import logging
import re
import concurrent.futures
from urllib.parse import urlparse

import requests

logger    = logging.getLogger(__name__)
PAGE_SIZE = 9

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
}

_OG_RE  = re.compile(
    r'<meta[^>]+property=["\']og:image(?::url)?["\'][^>]+content=["\'](https?://[^"\'>\s]+)["\']',
    re.I,
)
_TW_RE  = re.compile(
    r'<meta[^>]+name=["\']twitter:image(?::src)?["\'][^>]+content=["\'](https?://[^"\'>\s]+)["\']',
    re.I,
)
# Some sites put content before property
_OG_REV = re.compile(
    r'<meta[^>]+content=["\'](https?://[^"\'>\s]+)["\'][^>]+property=["\']og:image(?::url)?["\']',
    re.I,
)

_SKIP_DOMAINS = {"facebook.com", "twitter.com", "t.co", "youtube.com", "youtu.be"}


def _extract_og_image(url: str, source_domain: str) -> dict | None:
    """Fetch first ~32 KB of a page and extract its social preview image."""
    try:
        resp = requests.get(
            url, headers=_HEADERS, timeout=6,
            allow_redirects=True, stream=True,
        )
        if not resp.ok:
            return None

        # Read only enough to find the <head> meta tags
        raw = b""
        for chunk in resp.iter_content(chunk_size=4096):
            raw += chunk
            if len(raw) >= 32_768 or b"</head>" in raw:
                break
        resp.close()

        text = raw.decode("utf-8", errors="ignore")
        img_url = None
        for pat in (_OG_RE, _OG_REV, _TW_RE):
            m = pat.search(text)
            if m:
                img_url = m.group(1)
                break

        if not img_url:
            return None

        # Skip tiny tracking pixels / SVG / placeholder images
        if any(x in img_url for x in ("/1x1", "placeholder", ".svg", "blank")):
            return None

        return {
            "title":     _extract_title(text),
            "image":     img_url,
            "thumbnail": img_url,
            "source":    url,
            "domain":    source_domain,
            "width":     0,
            "height":    0,
        }
    except Exception:
        return None


def _extract_title(html: str) -> str:
    m = re.search(r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\'](.*?)["\']', html, re.I)
    if m:
        return m.group(1).strip()
    m = re.search(r'<title[^>]*>(.*?)</title>', html, re.I | re.S)
    if m:
        return re.sub(r"<[^>]+>", "", m.group(1)).strip()[:120]
    return ""


def search_images(query: str, page: int = 0) -> list[dict]:
    """
    Fetch web search results for query and extract og:image from each page.
    Returns PAGE_SIZE results per page.
    """
    try:
        try:
            from ddgs import DDGS
        except ImportError:
            from duckduckgo_search import DDGS

        # Fetch more results than we need to account for pages without images
        target = PAGE_SIZE * (page + 1)
        candidates: list[dict] = []

        with DDGS() as ddgs:
            for r in ddgs.text(query, max_results=target + 12):
                href = r.get("href") or r.get("url") or r.get("link") or ""
                if not href:
                    continue
                try:
                    domain = urlparse(href).hostname or ""
                    domain = domain.removeprefix("www.")
                except Exception:
                    domain = ""
                if any(s in domain for s in _SKIP_DOMAINS):
                    continue
                candidates.append({"url": href, "domain": domain})

        offset = page * PAGE_SIZE
        batch  = candidates[offset:offset + PAGE_SIZE + 6]  # extra buffer

        # Fetch og:images in parallel
        results: list[dict] = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            futs = {
                pool.submit(_extract_og_image, c["url"], c["domain"]): c
                for c in batch
            }
            for fut in concurrent.futures.as_completed(futs):
                img = fut.result()
                if img:
                    results.append(img)
                if len(results) >= PAGE_SIZE:
                    break

        logger.info("image_service.ok query=%s page=%d count=%d", query, page, len(results))
        return results[:PAGE_SIZE]

    except Exception as exc:
        logger.error("image_service.failed query=%s page=%d error=%s", query, page, exc)
        return []
