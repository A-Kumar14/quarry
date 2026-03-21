"""
services/ai_service.py — Search-Augmented Generation for the Ask app.
"""

import json
import logging
import re

logger = logging.getLogger(__name__)

CONTRADICTION_SYSTEM_PROMPT = """You are a fact-checking assistant. You will be given content from multiple web sources about the same topic. Your job is to identify factual contradictions — cases where two or more sources make clearly conflicting factual claims about the same subject.

Rules:
- Only flag real factual contradictions (e.g. Source A says X happened in 2019, Source B says 2021). Do not flag differences in opinion, emphasis, or framing.
- Each contradiction must name at least two sources by their [N] index number.
- If sources largely agree or there is insufficient content to detect contradictions, return an empty contradictions array.
- Respond ONLY with valid JSON. No preamble, no markdown fences, no explanation outside the JSON.

Return this exact JSON shape:
{
  "contradictions": [
    {
      "topic": "short label for what is being disputed (max 8 words)",
      "summary": "one sentence explaining the disagreement",
      "claims": [
        { "source_index": 1, "source_title": "...", "claim": "what this source says" },
        { "source_index": 2, "source_title": "...", "claim": "what this source says" }
      ]
    }
  ],
  "consensus": "one sentence about what all sources agree on (or empty string if nothing notable)"
}"""

RESEARCH_SYSTEM_PROMPT = """You are **Quarry Research** — a conversational AI research assistant. You help students, researchers, and professionals with any aspect of research: finding information, explaining concepts, reviewing literature, outlining papers, comparing sources, analyzing arguments, drafting content, and citing properly.

Be direct, thorough, and genuinely useful. Adapt your depth to the question — a quick answer for a simple question, a structured response for a complex research task. Never pad responses with unnecessary preamble or summaries.

## Guidelines

- Use markdown formatting (headers, bullet lists, bold) to make longer responses readable and well-structured.
- When asked to outline, draft, or summarize something, produce a concrete, usable result — not just advice on how to do it.
- Cite evidence and acknowledge uncertainty when making factual claims. Do not fabricate sources or statistics.
- When the user asks follow-up questions, build naturally on prior turns without re-explaining what was already said.

## Uploaded documents

If the user has attached a document, apply these rules strictly:
1. Read the document's actual content carefully before responding.
2. Only reference the document if its content **genuinely and directly** relates to what the user is asking.
3. If the document is about a different subject, say so clearly and honestly — e.g. "This document covers X, which is unrelated to your question about Y."
4. **Never fabricate a connection** between the document and the user's question.
5. **Never claim** the document is relevant when it is not."""


def sanitize_sse_chunk(text: str) -> str:
    """
    Prevent SSE stream injection by removing sequences from LLM output
    that could create new synthetic SSE events when embedded in a stream.

    Although the text is JSON-encoded before being placed in `data:` lines
    (which already escapes newlines), this guard handles any path that might
    bypass JSON encoding, and strips null bytes defensively.
    """
    # Strip null bytes
    text = text.replace("\x00", "")
    # Collapse 2+ real newlines to a single newline (SSE boundary is \n\n)
    text = re.sub(r"\n{2,}", "\n", text)
    # Neutralise any literal "data:" at the start of a line with a zero-width space
    text = re.sub(r"(?m)^data\s*:", "data\u200b:", text)
    return text

class AIService:
    def __init__(self):
        self._llm = None

    def _get_llm(self):
        if self._llm is None:
            from services.registry import llm_service
            self._llm = llm_service
        return self._llm

    @staticmethod
    def _is_research_query(query: str) -> bool:
        """
        Return False for sports, live scores, current events, and simple lookup
        queries where contradiction detection adds no value.
        """
        q = query.lower()
        live_signals = {
            # sports / scores
            " vs ", " v ", " vs.", "score", "scores", "scoreline", "result",
            "match", "game", "goals", "goal", "fixture", "kickoff", "kick-off",
            "standings", "table", "lineup", "line-up", "transfer", "signing",
            "champion", "champions league", "premier league", "la liga", "serie a",
            "bundesliga", "ligue 1", "nba", "nfl", "mlb", "nhl", "ufc", "f1",
            # live / current events
            "today", "tonight", "right now", "live", "latest", "breaking",
            "just in", "this week", "yesterday", "this morning", "right now",
            "current", "ongoing", "happening",
            # weather / finance / crypto
            "weather", "forecast", "temperature",
            "stock price", "share price", "crypto", "bitcoin", "ethereum",
        }
        return not any(signal in q for signal in live_signals)

    def detect_contradictions(self, sources: list[dict], scraped: list[dict]) -> dict:
        """
        Analyse sources for factual contradictions via a non-streaming LLM call.
        Always returns a dict; never raises.
        """
        if not sources:
            return {"contradictions": [], "consensus": ""}

        parts = []
        for i, src in enumerate(sources, start=1):
            markdown = next(
                (s["markdown"] for s in scraped if s["url"] == src["url"]), None
            )
            content = markdown[:1500] if markdown else src.get("snippet", "")
            parts.append(
                f"[{i}] {src['title']}\n"
                f"URL: {src['url']}\n"
                f"Content: {content}\n\n---\n"
            )

        user_msg = "\n".join(parts)[:12000]

        if not user_msg.strip():
            return {"contradictions": [], "consensus": ""}

        messages = [
            {"role": "system", "content": CONTRADICTION_SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ]

        try:
            llm = self._get_llm()
            raw = llm.chat_sync(messages, timeout=15)

            # Strip markdown fences if present
            raw = raw.strip()
            if raw.startswith("```"):
                raw = raw.lstrip("`").lstrip("json").strip()
                raw = raw.rstrip("`").strip()

            data = json.loads(raw)

            if (
                not isinstance(data, dict)
                or "contradictions" not in data
                or not isinstance(data["contradictions"], list)
            ):
                raise ValueError("invalid shape")

            for item in data["contradictions"]:
                if not all(k in item for k in ("topic", "summary", "claims")):
                    raise ValueError("invalid shape")
                if not isinstance(item["claims"], list):
                    raise ValueError("invalid shape")

            data.setdefault("consensus", "")
            return data

        except Exception as exc:
            logger.error("detect_contradictions.failed: %s", exc)
            return {"contradictions": [], "consensus": "", "error": True}

    def explore_the_web(self, query: str):
        """
        Search-Augmented Generation streaming generator.
        Yields SSE-formatted strings: sources event, then chunk events, then [DONE].
        """
        import json as _json
        from services import search_service
        from services import finance_service

        sources: list[dict] = []

        scraped: list[dict] = []
        try:
            results = search_service.web_search(query, max_results=5)
            urls = [r["url"] for r in results if r.get("url")]
            scraped = search_service.scrape_urls(urls, max_pages=3)
            context_block, sources = search_service.build_context(results, scraped)
        except Exception as exc:
            logger.error("explore_the_web.search_failed: %s", exc)
            context_block = ""
            sources = []

        live_scores = search_service.fetch_live_scores(query)
        if live_scores:
            context_block = live_scores + "\n\n" + context_block

        # ── Finance mode: inject live price data ──────────────────────────────
        stock_data = None
        is_fin, ticker = finance_service.is_finance_query(query)
        if is_fin and ticker:
            try:
                stock_data = finance_service.get_quote(ticker)
                if stock_data:
                    news_items = finance_service.get_company_news(ticker)
                    stock_data["news"] = news_items
                    sign = "+" if stock_data["change"] >= 0 else ""
                    news_text = "\n".join(
                        f"- {n['title']}" + (f" ({n['publisher']})" if n.get("publisher") else "")
                        for n in news_items[:3]
                    ) or "No recent headlines available."
                    finance_block = (
                        f"[LIVE FINANCE DATA — {stock_data['ticker']}]\n"
                        f"Company: {stock_data['name']}\n"
                        f"Price: ${stock_data['price']:,.2f}  "
                        f"Change: {sign}{stock_data['change']:.2f} ({sign}{stock_data['changePct']:.2f}%)\n"
                        f"Recent News:\n{news_text}\n"
                    )
                    context_block = finance_block + "\n\n" + context_block
            except Exception as exc:
                logger.error("explore_the_web.finance_inject_failed: %s", exc)

        # ── Build system prompt ───────────────────────────────────────────────
        finance_instruction = (
            "If [LIVE FINANCE DATA] is present at the top of the context, use it as the "
            "authoritative source for current price and change. Lead your answer with a brief "
            "price/performance summary before providing analysis. "
        ) if stock_data else ""

        system_prompt = (
            "You are Quarry — an AI research assistant. "
            "You have been given web search results below. Use them to answer the user's question. "
            "If [LIVE SCORES — ESPN] data is present at the top of the context, treat it as the "
            "most authoritative and up-to-date source for current match scores and status. "
            + finance_instruction +
            "IMPORTANT: Before answering, verify the search results are actually relevant to the "
            "user's query. If the sources are clearly about a different topic (e.g. the user asks "
            "about cooking but results are about politics), say: \"I couldn't find relevant results "
            "for your query. The search returned unrelated content. Please try rephrasing your "
            "question.\" — do NOT answer using irrelevant sources. "
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

        if stock_data:
            yield f"data: {_json.dumps({'type': 'stock', 'data': stock_data})}\n\n"

        try:
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": query},
            ]
            llm = self._get_llm()
            for text in llm.stream_sync(messages):
                yield f"data: {_json.dumps({'type': 'chunk', 'text': sanitize_sse_chunk(text)})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as exc:
            logger.error("explore_the_web.stream_failed: %s", exc)
            yield f"data: {_json.dumps({'type': 'error', 'text': str(exc)})}\n\n"
            yield "data: [DONE]\n\n"

        # Contradiction detection — run in a thread with a short deadline so it
        # never adds more than ~5 s of tail latency to the stream.
        if self._is_research_query(query) and sources:
            import concurrent.futures as _cf
            with _cf.ThreadPoolExecutor(max_workers=1) as _pool:
                _fut = _pool.submit(self.detect_contradictions, sources, scraped)
                try:
                    contradictions_data = _fut.result(timeout=6)
                except Exception:
                    contradictions_data = {"contradictions": [], "consensus": ""}
            yield f"data: {_json.dumps({'type': 'contradictions', 'data': contradictions_data})}\n\n"
        else:
            yield f"data: {_json.dumps({'type': 'contradictions', 'data': None})}\n\n"

    def research_session(self, messages: list[dict], message: str, file_context: str | None = None):
        """
        Multi-turn research assistant. Accepts conversation history and the new user message.
        file_context is extracted text from user-uploaded files — passed separately so it
        never inflates the validated message field.
        Yields SSE-formatted strings.
        """
        import json as _json
        llm = self._get_llm()

        trigger = message.strip()
        if not trigger:
            return  # nothing to respond to — caller should not send empty messages

        # If the user attached a file, append its content to the system prompt so the
        # LLM has the full document as background context without polluting chat history.
        system = RESEARCH_SYSTEM_PROMPT
        if file_context and file_context.strip():
            system += (
                "\n\n## ATTACHED DOCUMENT (user-uploaded)\n"
                "The user has attached the following document. Rules for using it:\n"
                "1. Read its actual content carefully before responding.\n"
                "2. Only reference it if its content GENUINELY and DIRECTLY relates to the current research topic.\n"
                "3. If the document is about a different subject than the research topic, tell the user clearly and honestly — e.g. 'This document is about X, which does not relate to your research on Y.'\n"
                "4. NEVER fabricate or invent a connection between the document and the research topic.\n"
                "5. NEVER claim the document supports the research topic if it does not.\n\n"
                f"{file_context.strip()}\n\n## END OF ATTACHED DOCUMENT"
            )

        full_messages = [
            {"role": "system", "content": system},
            *[{"role": m["role"], "content": m["content"]} for m in messages],
            {"role": "user", "content": trigger},
        ]

        try:
            for text in llm.stream_sync(full_messages):
                yield f"data: {_json.dumps({'type': 'chunk', 'text': text})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as exc:
            logger.error("research_session.stream_failed: %s", exc)
            yield f"data: {_json.dumps({'type': 'error', 'text': 'An error occurred. Please try again.'})}\n\n"

    def generate_outline(self, query: str, context: str):
        """
        Generate a structured academic paper outline for the given topic.
        Yields SSE-formatted strings.
        """
        import json as _json
        llm = self._get_llm()

        system = (
            "You are an academic writing assistant. Generate a clear, detailed outline "
            "for an academic research paper based on the topic and any provided context.\n\n"
            "Structure your response in this exact format using markdown:\n\n"
            "# Paper Outline: [descriptive title]\n\n"
            "## Abstract\n- [2–3 bullets: key claim, method, contribution]\n\n"
            "## 1. Introduction\n- Background and motivation\n- Problem statement\n"
            "- Research objectives\n- [1–2 topic-specific bullets]\n\n"
            "## 2. Literature Review\n- [4–5 specific themes/debates from existing research]\n\n"
            "## 3. Methodology\n- Research approach\n- Data sources and collection\n"
            "- Analysis method\n- [1–2 topic-specific bullets]\n\n"
            "## 4. Results / Findings\n- [4–5 concrete result areas to cover]\n\n"
            "## 5. Discussion\n- Interpretation of findings\n- Comparison to prior literature\n"
            "- Implications\n- Limitations\n\n"
            "## 6. Conclusion\n- Summary of contributions\n- Future research directions\n\n"
            "## References\n- [Suggested source types: journals, conference papers, books, reports]\n\n"
            "Be specific to the topic. Each section must have 3–5 actionable bullets."
        )

        user_parts = [f'Research topic: "{query}"']
        if context.strip():
            user_parts.append(f"Research context/findings:\n{context[:2000]}")
        user_parts.append("Generate the paper outline now.")
        user_msg = "\n\n".join(user_parts)

        messages = [
            {"role": "system", "content": system},
            {"role": "user",   "content": user_msg},
        ]

        try:
            for text in llm.stream_sync(messages):
                safe = sanitize_sse_chunk(text)
                if safe:
                    yield f"data: {_json.dumps({'type': 'chunk', 'text': safe})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as exc:
            logger.error("generate_outline.stream_failed: %s", exc)
            yield f"data: {_json.dumps({'type': 'error', 'text': 'Outline generation failed. Please try again.'})}\n\n"
