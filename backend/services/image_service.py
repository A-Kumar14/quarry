"""
services/image_service.py — Google Images search via ScrapingBee.
"""

from __future__ import annotations

import logging
import os
import requests

logger = logging.getLogger(__name__)

SCRAPINGBEE_KEY = os.getenv("SCRAPINGBEE_API_KEY", "")

PAGE_SIZE = 6


def search_images(query: str, page: int = 0) -> list[dict]:
    """
    Return PAGE_SIZE image dicts from Google Images via the ScrapingBee API.
    page=0 is the first batch, page=1 the next, etc.
    Returns [] if the key is missing, the request fails, or no more results.
    """
    if not SCRAPINGBEE_KEY:
        logger.warning("image_service: SCRAPINGBEE_API_KEY not set")
        return []

    try:
        resp = requests.get(
            "https://app.scrapingbee.com/api/v1/google",
            params={
                "api_key":      SCRAPINGBEE_KEY,
                "search":       query,
                "search_type":  "images",
                "nb_results":   PAGE_SIZE,
                "page":         page,
                "country_code": "us",
            },
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json() or {}

        results = []
        for img in data.get("images", []):
            image_data = img.get("image") or ""
            if not image_data:
                continue
            results.append({
                "title":  img.get("title") or "",
                "image":  image_data,
                "source": img.get("url") or "",
                "domain": img.get("domain") or "",
            })

        logger.info("image_service.ok query=%s page=%d count=%d", query, page, len(results))
        return results

    except Exception as exc:
        logger.error("image_service.failed query=%s page=%d error=%s", query, page, exc)
        return []
