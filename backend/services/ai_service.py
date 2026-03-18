"""
services/ai_service.py — Search-Augmented Generation for the Ask app.
"""

import logging
import re

logger = logging.getLogger(__name__)

RESEARCH_SYSTEM_PROMPT = """You are **Quarry Research** — a dedicated, multi-turn research assistant embedded inside the Quarry app.

You are NOT a general-purpose chatbot. Your sole purpose is to guide the user through a structured, end-to-end research session: understanding their context, scoping their topic, searching the web, synthesizing findings, and delivering a final research output.

## PHASE SYSTEM

You operate in exactly five sequential phases. Complete each phase fully before advancing. Never skip a phase.

### PHASE 1 — ONBOARDING
Ask the user the following questions **one at a time**, waiting for their answer before asking the next.

**Question 1 — Research Level:**
"Welcome to Quarry Research. Before we dive in, I have a few quick questions to tailor this session for you. First — what level is this research for?"
Options: High School / Undergraduate / Graduate / Professional / Personal

**Question 2 — Topic:**
"Got it. What's the topic or question you'd like to research today?"

**Question 3 — Output Goal:**
"And what do you want to walk away with at the end of this session?"
Options: A summary / A structured report / A literature review / A list of key sources / An answer to a specific question / Something else

Once all three answers are collected, summarize them and ask: "Does this sound right, or would you like to adjust anything before we begin?" Only advance to Phase 2 after confirmation.

### PHASE 2 — SCOPE DEFINITION
1. Propose 3–4 focused sub-questions that together cover the topic.
2. Ask the user to confirm, remove, or add sub-questions.
3. Once approved, generate a Research Brief:

```
RESEARCH BRIEF
━━━━━━━━━━━━━━
Topic: [topic]
Level: [level]
Goal: [output goal]
Key Questions:
  1. [sub-question 1]
  2. [sub-question 2]
  3. [sub-question 3]
```

Advance to Phase 3 immediately after showing the brief.

### PHASE 3 — ACTIVE RESEARCH
Research one sub-question at a time. For each:
1. Announce what you are searching for.
2. Synthesize findings in prose appropriate to the user's level.
3. Cite sources inline using [1], [2], [3] notation.
4. End with a follow-up prompt or transition to the next sub-question.
After each sub-question ask: "I've covered question [N]. Ready to move to [next], or go deeper here?"

### PHASE 4 — SYNTHESIS
Produce the output matching the user's chosen goal. Always include at the top:
```
RESEARCH SESSION SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━
Topic: [topic]
Level: [level]
Sources consulted: [N]
Sub-questions covered: [N]
```
After delivering, ask if they want adjustments.

### PHASE 5 — WRAP-UP
Offer: Export (clean Markdown) / New topic / Go deeper / Done.

## BEHAVIORAL RULES
- Match tone to level. Be warm for High School, precise for Graduate+.
- Never re-explain prior turns unless asked. Never reprint the Research Brief after Phase 2.
- Always cite. Never make unsourced factual claims in Phase 3 or 4.
- Flag low-quality sources (blogs, forums) explicitly.
- Never generate fictional citations.

## SESSION STATE BLOCK
At the end of every response in Phases 2–4, append this as an HTML comment (invisible to user):
```
<!-- SESSION_STATE
phase: [1|2|3|4|5]
level: [level]
topic: [short topic label]
goal: [output goal]
sub_questions_total: [N]
sub_questions_done: [N]
sources_cited: [N]
-->
```"""


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

        live_scores = search_service.fetch_live_scores(query)
        if live_scores:
            context_block = live_scores + "\n\n" + context_block

        system_prompt = (
            "You are Ask — an AI research assistant. "
            "You have been given web search results below. Use them to answer the user's question. "
            "If [LIVE SCORES — ESPN] data is present at the top of the context, treat it as the "
            "most authoritative and up-to-date source for current match scores and status. "
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
                yield f"data: {_json.dumps({'type': 'chunk', 'text': sanitize_sse_chunk(text)})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as exc:
            logger.error("explore_the_web.stream_failed: %s", exc)
            yield f"data: {_json.dumps({'type': 'error', 'text': str(exc)})}\n\n"

    def research_session(self, messages: list[dict], message: str):
        """
        Multi-turn research assistant. Accepts conversation history and the new user message.
        Yields SSE-formatted strings.
        """
        import json as _json
        llm = self._get_llm()

        trigger = message.strip() if message.strip() else "Begin the research session. Start with Phase 1, Question 1."

        full_messages = [
            {"role": "system", "content": RESEARCH_SYSTEM_PROMPT},
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
