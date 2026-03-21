# Quarry — Project Guidelines

## Overview
Quarry is an AI-powered research and finance platform with three main surfaces:
- **Quarry Search** (`/`) — web search + AI synthesis with sources, contradictions, follow-ups
- **Quarry Research** (`/research`) — conversational research assistant (multi-turn, file upload)
- **Finance Terminal** (`/finance`) — QFL command-based live market data, charts, AI analysis

## Tech Stack
- **Frontend**: React (CRA), MUI (sx prop), Lucide icons, ReactMarkdown + remark-gfm
- **Backend**: FastAPI + Python, yfinance, trafilatura, duckduckgo-search (ddgs), SSE streaming

## Architecture
- All AI responses stream as Server-Sent Events (`text/event-stream`)
- LLM provider chain: OpenRouter → OpenAI → Gemini (auto-detected from env vars)
- Finance data: yfinance 2.x (note: `raw["Close"]` returns DataFrame — use `hasattr(closes, "columns")` guard)
- Web scraping: trafilatura with 4s timeout, max 3 pages, 2000 char truncation

## Design System — "Modern Newspaper"
The UI follows a **premium newspaper aesthetic** with sepia/paper tones. Key rules:

- **Background**: sepia gradient `#EDE8DF → #E5DDD0 → #DDD5C0` — never change this
- **Fonts**: `var(--font-serif)` for headings/titles, `var(--font-family)` for body, `var(--font-mono)` for code/dates
- **Border-radius**: `12px` on cards, search bar, and image containers (unified system)
- **Hover interactions**: `translateY(-1px)` + `shadow-md` on all interactive cards, `transition: all 0.16–0.18s ease`
- **Source labels**: uppercase, `fontSize: '0.5rem'`, `letterSpacing: '0.12em'`
- **Headlines**: `lineHeight: 1.3` (leading-tight)
- **Deep toggle**: inset box-shadow `inset 0 2px 5px rgba(0,0,0,0.13)` when active (pressed/physical look)
- **CTA blocks**: 2-column grid, thin `1px solid rgba(0,0,0,0.10)` border
- **Calendar ticker**: single-line watermark, `opacity: 0.38`, no competing density

## QFL (Quarry Finance Language)
Terminal command parser in `frontend/src/pages/FinancePage.js → parseQFL()`:
- `AAPL` — single ticker quote
- `AAPL VS MSFT` — side-by-side comparison
- `COMPARE AAPL MSFT NVDA` — multi-ticker table
- `INDICES` / `INDEX` — market overview
- `HELP` — command reference
- Reserved KEYWORDS are checked **before** the ticker regex to prevent collision

## Key Files
- `frontend/src/pages/ExplorePage.js` — main search page (home + results)
- `frontend/src/pages/FinancePage.js` — finance terminal + QFL parser
- `frontend/src/pages/ResearchPage.js` — conversational research assistant
- `frontend/src/components/MonthlyFiguresMarquee.js` — calendar watermark ticker
- `backend/services/ai_service.py` — SAG pipeline, contradiction detection, research session
- `backend/services/search_service.py` — DuckDuckGo search, trafilatura scraping, ESPN scores
- `backend/services/finance_service.py` — yfinance quotes, chart history, news
- `backend/services/llm.py` — LLM provider abstraction (OpenRouter/OpenAI/Gemini)
- `backend/routers/explore.py` — FastAPI routes for search, finance, images, trending

## Performance Constraints
- `max_tokens: 1000` across all LLM calls
- Search: `max_results=5`, `max_pages=3`, scrape timeout `8s`, per-page timeout `4s`
- ESPN scores: all 8 leagues fetched in parallel with 4s total deadline
- Contradiction detection: runs in `ThreadPoolExecutor` with 6s deadline

## Commit Style
- Descriptive subject line, no co-author attribution
- Group related changes into a single commit rather than many small ones
