# Quarry — Claude Code Context

## What Quarry Is Becoming
Quarry is an epistemic research tool for crisis journalists and policy analysts.
The philosophical difference from Perplexity:
- Perplexity optimises for CONFIDENCE ("here is the answer")
- Quarry optimises for EPISTEMIC TRANSPARENCY ("here is what is being said,
  where it comes from, and where sources contradict each other")

## Stack (Read Before Every Session)
- Frontend: React 18 (CRA), MUI (sx prop), Lucide icons, ReactMarkdown + remark-gfm,
  react-force-graph-2d (KnowledgeGraph only)
- Backend: FastAPI, Python 3.10+, Railway deployment
- LLM: OpenRouter ONLY (openai/gpt-4o default) — llm.py has stream_sync() and chat_sync()
- Search: DuckDuckGo via ddgs library (no API key)
- Scraping: trafilatura (max_pages=5, 3000 char truncation)
- No database (in-memory source profiles only — see Session 1)
- No auth

## Design System — "Modern Newspaper" (DO NOT CHANGE)
- Background: sepia gradient #EDE8DF → #E5DDD0 → #DDD5C0
- var(--font-serif) for headings, var(--font-family) Inter for body
- var(--font-mono) for code/dates
- accent: #F97316 (orange)
- Border-radius: 12px on cards
- Glass-morphism: rgba(255,255,255,0.15), blur(12px), 1px solid rgba(255,255,255,0.25)
- Hover: translateY(-1px) + shadow, 0.16-0.18s ease

## Critical Architecture Facts

### Backend Pipeline (ai_service.py)
explore_the_web(query) currently does:
  search → scrape → build_context → SINGLE LLM call → stream
Session 2 replaces this with a 4-step pipeline.

detect_contradictions(sources) ALREADY EXISTS in ai_service.py
  - Takes list of {title, url, snippet} sources
  - Returns {contradictions: [...], consensus: str}
  - Called from /explore/search endpoint AFTER the main stream completes
  - ContradictionsTab.js is ALREADY wired to receive this data
  DO NOT REBUILD THIS. Session 2 enriches it with new pipeline data.

### Frontend Structure (ExplorePage.js — 1744 lines)
MiniTabStrip tabs: Result / Perspectives / Citations / Images / Contradictions
ContradictionsTab is already imported and receiving data.
KnowledgeGraph is available as a component (react-force-graph-2d).
WatchlistGrid shows 6 stock mini-cards on the homepage idle state.
OutlinePanel streams from /explore/outline.
MonthlyFiguresMarquee has been archived — remove any imports if they error.

### Utility Files
sourceQuality.js — classifies URLs as high/medium/unknown (hardcoded domain list)
  → Session 3 adds sourceProfile.js (API-backed) alongside it
sourceLibrary.js — localStorage saved-sources system
  → DO NOT TOUCH THIS. It's a separate feature.

### LLM Usage Pattern
stream_sync(messages) → yields text tokens (for SSE streaming)
chat_sync(messages, timeout=15) → returns full string (for pipeline steps)
Use chat_sync() for extract_claims() and reconcile_claims() in Session 2.
Use stream_sync() for generate_brief() in Session 2.

## Files That Must Never Be Modified
- backend/services/citation_service.py
- backend/services/finance_service.py
- frontend/src/utils/sourceLibrary.js
- Any file in frontend/src/archived/

## Test Suite
Run with: cd backend && python3 -m pytest
Baseline: 169 passing, 14 pre-existing failures (stale imports — NOT introduced by us).
All 169 passing tests must still pass after each session.
The key SSE contract that tests enforce:
  sources event → chunk events → [DONE]
This order must be preserved in the new pipeline.

## What NOT To Do
- Do NOT modify backend/security/ (any file)
- Do NOT delete sourceLibrary.js (different feature from sourceQuality.js)
- Do NOT rebuild detect_contradictions — it already works
- Do NOT change the SSE event format from `data: JSON\n\n`
- Do NOT add ChromaDB, auth, or a database (in-memory source profiles only)
- Do NOT install new npm packages without checking first
- Do NOT change the sepia/newspaper design system

## Session State
Phase: PHASE 1 — Foundation
Last completed: Step 0 (branch created, dead pages archived)
Branch: overhaul/epistemic-pipeline
