"""
services/ai_service.py — Search-Augmented Generation for the Ask app.
"""

import logging

logger = logging.getLogger(__name__)

class AIService:
    def __init__(self):
        self._llm = None

    def _get_llm(self):
        if self._llm is None:
            from services.registry import llm_service
            self._llm = llm_service
        return self._llm

    def explore_the_web(self, query: str):
        """
        Search-Augmented Generation streaming generator.
        Yields SSE-formatted strings: sources event, then chunk events, then [DONE].
        """
        import json as _json
        from services import search_service

        sources: list[dict] = []

        try:
            results = search_service.web_search(query, max_results=8)
            urls = [r["url"] for r in results if r.get("url")]
            scraped = search_service.scrape_urls(urls, max_pages=5)
            context_block, sources = search_service.build_context(results, scraped)
        except Exception as exc:
            logger.error("explore_the_web.search_failed: %s", exc)
            context_block = ""
            sources = []

        system_prompt = (
            "You are Ask — an AI research assistant. "
            "You have been given web search results below. Use them to answer the user's question. "
            "You MUST cite sources using inline notation like [1], [2], [3] that correspond exactly "
            "to the numbered sources in the context. Be thorough and well-structured using Markdown.\n\n"
            "--- WEB CONTEXT ---\n"
            f"{context_block}\n"
            "--- END CONTEXT ---"
        )

        if sources:
            for src in sources:
                try:
                    from urllib.parse import urlparse
                    domain = urlparse(src["url"]).netloc.replace("www.", "")
                    src["favicon"] = f"https://www.google.com/s2/favicons?domain={domain}&sz=32"
                except Exception:
                    src["favicon"] = ""
            yield f"data: {_json.dumps({'type': 'sources', 'sources': sources})}\n\n"

        try:
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": query},
            ]
            llm = self._get_llm()
            for text in llm.stream_sync(messages):
                yield f"data: {_json.dumps({'type': 'chunk', 'text': text})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as exc:
            logger.error("explore_the_web.stream_failed: %s", exc)
            yield f"data: {_json.dumps({'type': 'error', 'text': str(exc)})}\n\n"
