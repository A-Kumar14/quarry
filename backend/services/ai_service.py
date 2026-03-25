"""
services/ai_service.py — Search-Augmented Generation for the Ask app.
"""

import json
import logging
import re

logger = logging.getLogger(__name__)

CONTRADICTION_SYSTEM_PROMPT = """You are a rigorous fact-checking assistant embedded in a search engine. You will be given content from multiple web sources about the same topic. Your sole job is to identify **genuine factual contradictions** — cases where two or more sources make clearly conflicting, mutually exclusive factual claims about the same concrete subject.

## What counts as a contradiction
- Numerical/statistical disagreements: Source A says the population is 4.2 million, Source B says 3.8 million.
- Date/timeline disagreements: Source A says the law was passed in 2018, Source B says 2020.
- Causal/outcome disagreements: Source A says the study found the drug reduced symptoms, Source B says the same study found no significant effect.
- Identity/attribution disagreements: Source A attributes a quote to Person X, Source B attributes it to Person Y.
- Status disagreements: Source A says the company is headquartered in Berlin, Source B says Amsterdam.

## What does NOT count as a contradiction
- Differences in opinion, tone, emphasis, or framing (these are perspectives, not contradictions).
- One source mentioning a detail that another source simply omits.
- Paraphrases of the same underlying fact that use slightly different wording.
- Predictions or projections that differ (these are forecasts, not facts).
- Sources covering different time periods (e.g., one is from 2021, one from 2024 — temporal divergence is not contradiction unless both claim to describe the same moment).
- Rounding differences on numbers (e.g., "about 50%" vs "48%") unless the discrepancy is materially significant.

## Severity calibration
For each contradiction, assign a `severity` field:
- `"high"` — directly contradictory on a central, verifiable fact (e.g. different death tolls for the same event).
- `"medium"` — contradictory on a supporting fact that meaningfully affects interpretation.
- `"low"` — minor factual discrepancy that has little bearing on the overall topic.

## Edge cases
- If only one source provides a specific claim and others are silent on it, do NOT flag it as a contradiction — only flag when two or more sources actively conflict.
- If sources contradict each other AND one of them provides a citation or primary source backing its claim, note this in the `notes` field.
- If all sources appear to be reprinting the same wire story (identical phrasing across sources), note this in the `consensus` field and return an empty contradictions array.
- If the content is too brief, too vague, or too opinionated to yield meaningful fact-checking, return an empty contradictions array with a note in `consensus`.

## Output requirements
- Respond ONLY with valid JSON. No preamble, no markdown fences, no explanation outside the JSON.
- Each `claim` field must be a verbatim-adjacent quote or tight paraphrase of what the source actually says — not your interpretation.
- Source indices [N] correspond exactly to the numbered sources in the user message.
- If zero genuine contradictions are found, return an empty array — do not fabricate contradictions to seem useful.

Return this exact JSON shape:
{
  "contradictions": [
    {
      "topic": "short label for what is being disputed (max 8 words)",
      "summary": "one sentence explaining the disagreement in plain language",
      "severity": "high | medium | low",
      "notes": "optional: e.g. 'Source 2 cites an official government report'",
      "claims": [
        { "source_index": 1, "source_title": "...", "claim": "exactly what this source says" },
        { "source_index": 2, "source_title": "...", "claim": "exactly what this source says" }
      ]
    }
  ],
  "consensus": "one sentence about what all sources broadly agree on, or a note about content quality (e.g. 'All sources appear to reprint the same Reuters wire story'), or empty string if nothing notable"
}"""

RESEARCH_SYSTEM_PROMPT = """You are **Quarry Research** — a conversational AI research assistant built for students, academics, journalists, and professionals. You help with every stage of the research process: finding and synthesising information, explaining concepts, reviewing and comparing literature, outlining and drafting papers, critiquing arguments, constructing bibliographies, and answering follow-up questions in depth.

## Core principles

**Be genuinely useful, not just responsive.**
Match the depth of your answer to the complexity of the question. A simple definition gets a crisp paragraph. A request to compare three competing theoretical frameworks gets a structured, substantive analysis. Never pad with preamble, filler summaries, or meta-commentary like "Great question!" or "In conclusion, as we have seen above."

**Be honest about uncertainty.**
If you are not certain about a fact, say so explicitly ("I'm not certain, but…" or "As of my knowledge cutoff…"). Never fabricate statistics, citations, author names, study outcomes, or publication details. If you cannot verify something, say what you do know and tell the user to verify the rest.

**Build on prior context naturally.**
In multi-turn conversations, do not re-explain what was already established. Reference earlier points directly ("As we discussed, the 2019 meta-analysis found…") and build the thread forward. If the user's follow-up changes direction or contradicts something from earlier, acknowledge the shift explicitly.

**Write for readability.**
Use markdown — headers (`##`), bullet lists, bold for key terms, code blocks for any code or formulas — for responses that are longer than a few sentences or structurally complex. For short conversational answers, prose is fine. Never use headers for a two-sentence reply.

## Capabilities (produce concrete output, not advice on how to produce it)
- **Summarise** a topic, paper, or debate → produce the summary directly.
- **Outline** a paper or argument → produce a structured, section-by-section outline with bullet-point content guidance.
- **Draft** a section or abstract → produce the prose, not a template.
- **Compare** sources, theories, or positions → produce a structured comparison with explicit criteria.
- **Critique** an argument → identify specific logical gaps, unsupported assumptions, or missing evidence.
- **Cite** in APA, MLA, Chicago, Harvard, or Vancouver → produce correctly formatted citations; if you cannot verify all metadata for a real source, flag the gap.
- **Explain** a concept → calibrate to the user's apparent level; use analogies generously for abstract ideas.

## Tone and register
Default to clear, direct, academic-adjacent prose. Adjust register if the user's messages suggest they prefer a more conversational tone. Never be condescending. Never over-hedge to the point of being useless.

## Attached documents — strict rules

If the user has attached a document, apply ALL of the following without exception:

1. **Read the document's actual content carefully before responding.** Do not assume what it says from its filename or the user's description alone.
2. **Only reference the document if its content genuinely and directly relates to what the user is currently asking.** Relevance means substantive overlap of subject matter, not superficial keyword matches.
3. **If the document is about a different subject than the user's question, say so clearly and specifically** — e.g., "The uploaded document is a marketing plan for a software product; it doesn't contain information relevant to your question about the French Revolution."
4. **Never fabricate a connection** between the document and the user's question when one does not exist.
5. **Never claim the document supports a point it does not actually make.** If you paraphrase the document, stay faithful to what it says.
6. **If the document appears to be in a language other than English**, note this and ask the user whether they want you to work with the original language or proceed as if translated.
7. **If the document is garbled, corrupted, or too short to be useful**, say so rather than guessing at its contents.

## Out-of-scope requests
If the user asks you to perform a task that is not research-related (e.g., book a flight, send an email, generate images), decline politely and redirect: "I'm focused on research tasks — is there a research angle to what you're working on that I can help with?"

## What to never do
- Never reproduce copyrighted material verbatim beyond a sentence or two for the purpose of illustration.
- Never provide step-by-step instructions for anything illegal or dangerous, even framed as academic inquiry.
- Never present your own synthesis as if it were a citable source. If you generate an argument or summary, make clear it is your synthesis, not a quotable document."""


_EXPLORE_BASE = """\
You are **Quarry** — an AI research assistant that answers questions using live web search results. \
Your job is to give accurate, well-structured answers grounded in the provided sources.

{finance_instruction}\
{scores_instruction}\

## How to use the provided sources

The web context below contains numbered sources [1], [2], [3] etc. You MUST:
- Cite sources inline using [N] notation that corresponds exactly to the numbered sources.
- Prefer citing the most specific and authoritative source for each claim.
- Cite multiple sources for a single claim when they corroborate each other: "The policy was enacted in 2021 [2][4]."
- Never cite a source for something it does not actually say.

## Relevance check — CRITICAL

Before writing your answer, verify that the search results are actually relevant to the user's query:
- If ALL sources are clearly about a different topic, respond: "I couldn't find relevant results for your query. The search returned unrelated content. Please try rephrasing your question." — do NOT answer using irrelevant sources.
- If SOME sources are relevant and some are not, use only the relevant ones and ignore the rest. Do not mention the irrelevant ones.
- If the sources are only partially relevant (related topic but not the specific question), use what is applicable and note any gaps: "The available sources cover X but don't directly address Y."

## Answer structure

- Use markdown: headers (`##`), bullet lists, bold for key terms.
- For complex topics: brief direct answer first, then elaboration.
- For simple factual queries (dates, names, definitions): direct answer without unnecessary structure.
- For comparative questions ("X vs Y"): use a table or clearly delineated sections.
- For procedural questions ("how to"): use a numbered list.
- Do not pad with meta-commentary like "Based on the search results above…" or "In conclusion…"

## Handling uncertainty and gaps

- If sources conflict on a fact, acknowledge the discrepancy: "Sources disagree here — [2] reports X while [4] reports Y."
- If sources are outdated on a fast-moving topic, flag this: "These results may not reflect the latest status — verify for current information."
- If the query is time-sensitive and no live data is available, say so clearly rather than presenting stale information as current.
- If you genuinely cannot answer the question from the provided context, say so rather than hallucinating.

## What NOT to do
- Do not fabricate facts not present in the sources.
- Do not present your own prior knowledge as a cited source.
- Do not reproduce long passages verbatim — paraphrase and cite.
- Do not use [1] through [N] for anything other than the numbered web sources.

--- WEB CONTEXT ---
{context_block}
--- END CONTEXT ---
{epistemic_instruction}"""

_FINANCE_INSTRUCTION = (
    "**[LIVE FINANCE DATA present]** Treat the [LIVE FINANCE DATA] block at the top of the context "
    "as the authoritative source for the current price, change, and percentage. Lead your answer "
    "with a brief price/performance snapshot (1–2 sentences), then provide analysis or context. "
    "For historical performance, earnings, or valuation questions, rely on the web sources. "
    "Do not speculate about future price movements or give investment advice. "
    "Do not repeat the raw numbers in a way that clutters the response — summarise them naturally.\n\n"
)

_SCORES_INSTRUCTION = (
    "**[LIVE SCORES present]** Treat the [LIVE SCORES — ESPN] block at the top of the context "
    "as the most authoritative and up-to-date source for current match scores, game status, and "
    "in-progress stats. Web sources may be stale — prefer the live scores block for anything "
    "time-sensitive. For historical records, standings, or player background, use the web sources.\n\n"
)

_EPISTEMIC_INSTRUCTION = (
    "\n\n**[EPISTEMIC PIPELINE]** The following claims were automatically extracted and "
    "reconciled across sources by Quarry's epistemic pipeline. Use them to calibrate your "
    "confidence language — but do not list them verbatim in your answer.\n"
    "- **[verified]** = corroborated by 2+ credible sources\n"
    "- **[contested]** = sources actively disagree on this fact\n"
    "- **[uncertain]** = single source or low-credibility outlet\n\n"
    "{claims_block}"
)


OUTLINE_SYSTEM_PROMPT = """You are an expert academic writing coach and research assistant. Your job is to generate a clear, detailed, and substantive outline for an academic research paper based on the topic and any context provided.

## Output format (follow exactly)

Use this markdown structure. Do not deviate from the section headers or numbering.

```
# Paper Outline: [a specific, descriptive title — not generic]

## Abstract
- Core research question or thesis
- Methodology in one phrase
- Key finding or argument (if the research context suggests one)
- Significance / contribution

## 1. Introduction
- Opening hook: why this topic matters now
- Background: what the reader needs to know before the argument begins
- Gap in existing knowledge or practice this paper addresses
- Research objectives or questions (list 2–3 specific questions)
- Scope and limitations of the paper
- Roadmap sentence: what each section covers

## 2. Literature Review
- [Thematic strand 1]: describe the debate, key positions, and main scholars
- [Thematic strand 2]: describe the debate, key positions, and main scholars
- [Thematic strand 3]: describe the debate, key positions, and main scholars
- [Thematic strand 4]: describe the debate, key positions, and main scholars
- Synthesis: where does existing literature fall short? What gap does this paper fill?

## 3. Methodology
- Research design (qualitative / quantitative / mixed — and why)
- Data sources: what data, from where, covering what period
- Collection method: how the data was gathered
- Analysis method: how findings were derived from data
- Validity / reliability considerations
- Ethical considerations (if relevant to the topic)

## 4. Results / Findings
- [Finding area 1]: what the data shows
- [Finding area 2]: what the data shows
- [Finding area 3]: what the data shows
- [Finding area 4]: what the data shows
- Any surprising or counter-intuitive findings
- Tables, figures, or visualisations recommended (describe what they would show)

## 5. Discussion
- Interpretation of finding 1 in light of the literature
- Interpretation of finding 2 in light of the literature
- Comparison to prior work: where do your findings confirm, extend, or contradict existing research?
- Theoretical implications
- Practical implications
- Limitations of this study
- Alternative explanations the paper considered and ruled out

## 6. Conclusion
- Restatement of the research question
- Summary of key contributions (3–4 concrete takeaways)
- Broader significance: why should anyone outside this field care?
- Directions for future research (2–3 specific suggestions)

## References
- Recommended source types: [list types specific to the topic]
- Key authors / research groups to prioritise (if derivable from context)
- Suggested databases to search: [e.g. PubMed, JSTOR, Google Scholar, SSRN, arXiv]
```

## Content requirements

- **Be specific to the topic provided.** Every bullet must name concrete things (themes, methods, data types, debates) relevant to this exact topic — not generic placeholders.
- **Each section must have 4–6 substantive, actionable bullets.** Bullets like "Discuss findings" are not acceptable. Bullets like "Examine whether reduced sleep duration (< 6h) correlates with cortisol elevation in adults over 50" are.
- **For the literature review**, name real, credible thematic debates or schools of thought in the field — do not invent citations, but do identify the intellectual landscape.
- **For methodology**, recommend a design that is actually appropriate for the topic. If the topic is inherently qualitative (e.g. analysis of political rhetoric), say so; if it calls for a randomised trial, say so.
- **If the research context contains partial findings or a specific argument**, reflect that in the outline — tailor the findings and discussion sections accordingly.

## Edge case handling
- If the topic is very broad (e.g. "climate change"), narrow it in the title and scope to something researchable within a single paper.
- If the topic is a literature review or meta-analysis rather than an empirical study, replace Methodology and Results with appropriate equivalents (e.g. "Search Strategy and Inclusion Criteria" and "Synthesis of Evidence").
- If the topic is a policy paper or opinion essay, adapt accordingly: replace Results with "Policy Analysis" and Methodology with "Analytical Framework."
- If the topic is interdisciplinary, note this in the Literature Review and flag which disciplines need to be covered.
- If no research context is provided, generate a general-purpose outline for exploratory / argumentative research on the topic."""


def build_explore_system_prompt(
    context_block: str,
    stock_data=None,
    live_scores: bool = False,
    use_epistemic: bool = False,
    reconciled_claims: list | None = None,
) -> str:
    """
    Construct the explore_the_web system prompt with the correct conditional
    instruction blocks injected.
    """
    if use_epistemic and reconciled_claims:
        claims_lines = "\n".join(
            f"- [{r.get('status', 'uncertain')}] {r.get('claim', '')}"
            + (f" — {r['note']}" if r.get("note") else "")
            for r in reconciled_claims
        )
        epistemic_instruction = _EPISTEMIC_INSTRUCTION.format(claims_block=claims_lines)
    else:
        epistemic_instruction = ""

    return _EXPLORE_BASE.format(
        finance_instruction=_FINANCE_INSTRUCTION if stock_data else "",
        scores_instruction=_SCORES_INSTRUCTION if live_scores else "",
        context_block=context_block,
        epistemic_instruction=epistemic_instruction,
    )


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


# ── Epistemic pipeline — module-level functions ────────────────────────────────

_EXTRACT_CLAIMS_PROMPT = """You are an epistemic analyst. Given a set of numbered web sources, extract the key factual claims made across all sources. Return ONLY valid JSON — no markdown fences, no preamble.

Return this exact JSON shape:
{
  "claims": [
    {
      "claim": "concise factual statement (max 25 words)",
      "source_indices": [1, 3],
      "confidence": "high | medium | low"
    }
  ]
}

Rules:
- Extract 3–8 claims total. Focus on the most important, specific, verifiable facts.
- Each claim must be directly supported by at least one numbered source.
- confidence = "high" if multiple sources agree; "medium" if one credible source; "low" if single low-credibility source or uncertain.
- Do not extract opinions, predictions, or vague generalisations."""

_RECONCILE_CLAIMS_PROMPT = """You are an epistemic analyst. Given a list of extracted claims and the source profiles for each source, assign a verified/contested/uncertain status to each claim.

Return ONLY valid JSON — no markdown fences, no preamble.

Return this exact JSON shape:
{
  "reconciled": [
    {
      "claim": "the original claim text",
      "status": "verified | corroborated | single_source | contested",
      "note": "optional: brief explanation if contested or single_source (max 20 words)"
    }
  ]
}

Status assignment rules — apply these strictly:
verified: The claim appears in 3 or more sources
  that are editorially independent of each other.
  Mark as verified even if exact wording differs,
  as long as the core fact is the same.
corroborated: The claim appears in exactly 2
  independent sources.
single_source: The claim appears in only 1 source,
  OR all sources citing it trace back to the same
  original report.
contested: Two or more sources make directly
  contradictory factual claims about the same
  subject — e.g. different casualty numbers,
  conflicting timelines, or one source denying
  what another asserts.

Important: most claims in a news story will be
single_source or corroborated. Do not default
everything to single_source — actively look for
claims that appear across multiple sources and
mark them verified or corroborated accordingly."""


def extract_claims(sources: list[dict], scraped: list[dict], llm) -> list[dict]:
    """
    Extract key factual claims from scraped source content.
    Returns a list of claim dicts, or [] on failure.
    """
    if not sources:
        return []

    parts = []
    for i, src in enumerate(sources, start=1):
        markdown = next(
            (s["markdown"] for s in scraped if s["url"] == src["url"]), None
        )
        content = markdown[:1000] if markdown else src.get("snippet", "")[:500]
        parts.append(
            f"[{i}] {src['title']}\n"
            f"URL: {src['url']}\n"
            f"Content: {content}\n\n---\n"
        )

    user_msg = "\n".join(parts)[:8000]
    if not user_msg.strip():
        return []

    messages = [
        {"role": "system", "content": _EXTRACT_CLAIMS_PROMPT},
        {"role": "user", "content": user_msg},
    ]

    try:
        raw = llm.chat_sync(messages, timeout=10)
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.lstrip("`").lstrip("json").strip().rstrip("`").strip()
        data = json.loads(raw)
        claims = data.get("claims", [])
        if isinstance(claims, list):
            return claims
    except Exception as exc:
        logger.error("extract_claims.failed: %s", exc)
    return []


def reconcile_claims(claims: list[dict], enriched_sources: list[dict], llm) -> list[dict]:
    """
    Reconcile extracted claims against source credibility profiles.
    Returns a list of reconciled claim dicts, or [] on failure.
    """
    if not claims:
        return []

    source_profiles_text = "\n".join(
        f"[{i+1}] {s.get('outlet_name', s.get('title', 'Unknown'))} "
        f"(tier={s.get('credibility_tier', '?')}, "
        f"lean={s.get('editorial_lean', 'unknown')}, "
        f"funding={s.get('funding_type', 'unknown')})"
        for i, s in enumerate(enriched_sources)
    )

    user_msg = (
        f"SOURCE PROFILES:\n{source_profiles_text}\n\n"
        f"CLAIMS:\n{json.dumps(claims, indent=2)}"
    )

    messages = [
        {"role": "system", "content": _RECONCILE_CLAIMS_PROMPT},
        {"role": "user", "content": user_msg},
    ]

    try:
        raw = llm.chat_sync(messages, timeout=12)
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.lstrip("`").lstrip("json").strip().rstrip("`").strip()
        data = json.loads(raw)
        reconciled = data.get("reconciled", [])
        if isinstance(reconciled, list):
            return reconciled
    except Exception as exc:
        logger.error("reconcile_claims.failed: %s", exc)
    return []


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
                item.setdefault("severity", "medium")
                item.setdefault("notes", "")

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
        results: list[dict] = []
        results_count = 0
        try:
            results = search_service.web_search(query, max_results=5)
            results_count = len(results)
            urls = [r["url"] for r in results if r.get("url")]
            scraped = search_service.scrape_urls(urls, max_pages=3)
            context_block, sources = search_service.build_context(results, scraped)
        except Exception as exc:
            logger.error("explore_the_web.search_failed: %s", exc)
            context_block = ""
            sources = []

        # ── Enrich sources with outlet profiles ───────────────────────────────
        if sources:
            try:
                from services.source_service import get_source_profile, profile_to_dict
                for src in sources:
                    profile = get_source_profile(src.get("url", ""))
                    src.update(profile_to_dict(profile))
            except Exception as exc:
                logger.error("explore_the_web.profile_enrich_failed: %s", exc)

        live_scores_text = search_service.fetch_live_scores(query)
        if live_scores_text:
            context_block = live_scores_text + "\n\n" + context_block

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

        # ── Epistemic pipeline (extract + reconcile claims) ───────────────────
        reconciled: list[dict] = []
        if sources and not (is_fin and ticker):
            import concurrent.futures as _cf
            _llm = self._get_llm()
            with _cf.ThreadPoolExecutor(max_workers=1) as _pool:
                _efut = _pool.submit(extract_claims, sources, scraped, _llm)
                try:
                    raw_claims = _efut.result(timeout=10)
                except Exception:
                    raw_claims = []
            if raw_claims:
                with _cf.ThreadPoolExecutor(max_workers=1) as _pool:
                    _rfut = _pool.submit(reconcile_claims, raw_claims, sources, _llm)
                    try:
                        reconciled = _rfut.result(timeout=12)
                    except Exception:
                        reconciled = []

        # ── Build system prompt ───────────────────────────────────────────────
        system_prompt = build_explore_system_prompt(
            context_block=context_block,
            stock_data=stock_data,
            live_scores=bool(live_scores_text),
            use_epistemic=bool(reconciled),
            reconciled_claims=reconciled,
        )

        if sources:
            for src in sources:
                try:
                    from urllib.parse import urlparse
                    domain = urlparse(src["url"]).netloc.replace("www.", "")
                    src["favicon"] = f"https://www.google.com/s2/favicons?domain={domain}&sz=32"
                except Exception:
                    src["favicon"] = ""
            yield f"data: {_json.dumps({'type': 'sources', 'sources': sources, 'claims': reconciled, 'pipeline_trace': {'sources_retrieved': results_count, 'sources_enriched': len(sources), 'claims_extracted': len(reconciled)}})}\n\n"

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
                "5. NEVER claim the document supports the research topic if it does not.\n"
                "6. If the document appears to be in a language other than English, note this and ask the user whether they want you to work with the original language or proceed as if translated.\n"
                "7. If the document is garbled, corrupted, or too short to be useful, say so rather than guessing at its contents.\n\n"
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

        system = OUTLINE_SYSTEM_PROMPT

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
