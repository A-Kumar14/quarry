# Quarry — Project Context

> Full-stack AI search engine. Web search + real-time scraping + LLM reasoning, streamed to a liquid-glass React UI.

---

## What It Does

Quarry takes a natural-language query, searches the web, scrapes the top result pages for actual content, injects everything into an LLM prompt, and streams a cited Markdown answer back to the user. Follow-up questions continue as a threaded conversation, each one aware of the original query.

Additional tabs on every result show:
- **Knowledge Graph** — force-directed concept graph extracted from the answer
- **News** — GNews articles for the same query (client-side)
- **Images** — Google Images via ScrapingBee (backend-proxied, paginated)

---

## Repository Layout

```
quarry/
├── backend/
│   ├── main.py                  # FastAPI app, CORS, rate limiting
│   ├── schemas.py               # Pydantic request models
│   ├── requirements.txt
│   ├── .env                     # Real keys — gitignored
│   ├── .env.example             # Placeholder template — committed
│   ├── routers/
│   │   └── explore.py           # /explore/search (SSE) + /explore/images
│   └── services/
│       ├── registry.py          # Module-level singletons (LLMService, AIService)
│       ├── llm.py               # LLM abstraction (OpenRouter / OpenAI / Gemini)
│       ├── ai_service.py        # SAG pipeline — search → scrape → stream LLM
│       ├── search_service.py    # DuckDuckGo search, trafilatura scraping, ESPN scores
│       └── image_service.py     # ScrapingBee Google Images, paginated
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── App.js               # BrowserRouter → single route → ExplorePage
│   │   ├── index.css            # CSS variables, animations
│   │   ├── pages/
│   │   │   └── ExplorePage.js   # All state, all logic, all UI components (~1130 lines)
│   │   ├── components/
│   │   │   ├── GlassCard.js     # Shared glass-morphism card primitive
│   │   │   ├── KnowledgeGraph.js# react-force-graph-2d wrapper + minimap + drawer
│   │   │   ├── ComparisonView.js# Side-by-side A/B card (currently unused)
│   │   │   ├── NewsTab.js       # GNews API → article cards + summary strip
│   │   │   ├── ImagesTab.js     # Backend image endpoint → grid + Show More
│   │   │   ├── PixelFigurines.jsx # SVG pixel-art home screen decorations
│   │   │   ├── Toast.js         # Fixed-position notification toast
│   │   │   └── PerspectivesTab.js # Reddit search (orphaned, not imported)
│   │   └── utils/
│   │       └── sourceQuality.js # getSourceQuality(url) → high/medium/unknown
│   ├── .env                     # REACT_APP_* keys — gitignored
│   ├── .env.example             # (root level) REACT_APP_API_URL placeholder
│   └── package.json
│
├── .gitignore
├── .env.example                 # Root frontend env template
└── QUARRY.md                    # This file
```

---

## Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Web framework | FastAPI 0.115 |
| Server | Uvicorn + Watchfiles (dev), Gunicorn (prod) |
| Streaming | Server-Sent Events (`StreamingResponse`, `text/event-stream`) |
| LLM access | OpenAI SDK pointed at OpenRouter (or OpenAI/Gemini directly) |
| Web search | DuckDuckGo via `ddgs` — no API key |
| Web scraping | `trafilatura` — extracts clean Markdown from HTML |
| Image search | ScrapingBee Google Images API — requires key |
| Live scores | ESPN public scoreboard API — no key |
| Rate limiting | `slowapi` (15 req/min on search, 30 req/min on images) |
| Validation | Pydantic v2 |
| Config | `python-dotenv` |

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 19 (Create React App) |
| Component lib | MUI v7 (Material UI) |
| Routing | react-router-dom v7 |
| Markdown | react-markdown + remark-gfm |
| Knowledge graph | react-force-graph-2d |
| Icons | lucide-react |
| News | GNews API (client-side) |
| Env prefix | `REACT_APP_` (CRA convention) |

---

## API Keys Required

| Key | Where | Used For | Free Tier |
|---|---|---|---|
| `OPENROUTER_API_KEY` | `backend/.env` | LLM inference | Yes (pay-per-token) |
| `SCRAPINGBEE_API_KEY` | `backend/.env` | Google Images search | 1,000 free credits |
| `REACT_APP_GNEWS_API_KEY` | `frontend/.env` | News tab + trending chips | 100 req/day free |
| `REACT_APP_UNSPLASH_ACCESS_KEY` | `frontend/.env` | (no longer used) | — |

Keys never committed — `backend/.env` and `frontend/.env` are both gitignored.

---

## Environment Files

### `backend/.env`
```
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-v1-...
SCRAPINGBEE_API_KEY=...
```

### `frontend/.env`
```
REACT_APP_API_URL=http://localhost:8000
REACT_APP_GNEWS_API_KEY=...
REACT_APP_UNSPLASH_ACCESS_KEY=...   # kept but unused
```

> **CRA note:** `REACT_APP_*` vars are baked in at `npm start` / build time. Restart the dev server after editing `.env`.

---

## Running Locally

### Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 main.py
# → http://localhost:8000
```

### Frontend
```bash
cd frontend
npm install
npm start
# → http://localhost:3000
```

---

## API Endpoints

### `POST /explore/search`
Streams a Search-Augmented Generation response as SSE.

**Request body:**
```json
{
  "query": "what are piranhas?",
  "context": null,           // previous query string for follow-ups
  "session_id": null         // reserved, unused
}
```

**SSE event types streamed back:**
```
data: {"type": "sources", "sources": [{title, url, snippet, favicon}]}
data: {"type": "chunk",   "text": "...markdown fragment..."}
data: {"type": "error",   "text": "...error message..."}
data: [DONE]
```

Follow-up queries pass `context: <original_query>`. The backend prepends:
> `Follow-up on "<context>": <query>`
before searching, so the search results stay on-topic.

### `GET /explore/images?q=<query>&page=<n>`
Returns one page (6 images) of Google Images results via ScrapingBee.

**Response:**
```json
{
  "images": [
    {
      "title": "...",
      "image": "data:image/jpeg;base64,...",
      "source": "https://source-page-url",
      "domain": "example.com"
    }
  ],
  "query": "...",
  "page": 0
}
```

`page` is 0-based. The frontend hits `page=0` on mount, then increments for each "Show more" click.

### `GET /health`
```json
{"status": "ok"}
```

---

## Data Flow — Main Search

```
User types query → hits Enter / clicks Search
        ↓
[Frontend] POST /explore/search  {query}
        ↓
[Backend] search_service.web_search(query, max_results=8)
  → DuckDuckGo text search → [{title, url, snippet}]
        ↓
search_service.scrape_urls(top_5_urls)
  → trafilatura fetches each in parallel (ThreadPoolExecutor, 15s timeout)
  → returns [{url, markdown}] (truncated to 3 000 chars each)
        ↓
search_service.fetch_live_scores(query)
  → if score-related keywords detected:
      hits ESPN free API for 8 soccer leagues
      returns formatted "[LIVE SCORES — ESPN]" block
        ↓
search_service.build_context(results, scraped)
  → numbered context block + source list
  → adds Google favicon URLs to each source
        ↓
ai_service: SSE yield sources event
        ↓
llm_service.stream_sync(system_prompt + context + user_query)
  → OpenRouter (or OpenAI/Gemini) streaming response
  → SSE yield chunk events one token at a time
        ↓
[Frontend] reads SSE stream:
  - sources event → setSources([...]) → renders SourceChips
  - chunk events  → setAnswer(prev + text) → live-renders Markdown
  - [DONE]        → setStreaming(false)
```

---

## Data Flow — Deep Search

Triggered by toggling the ⚡ Deep button before searching.

```
Phase 1: normal search (label "1/2")
  → same as above

Phase 2: second SSE call (label "2/2")
  → query: "<original> detailed analysis"
  → skipSources=true (sources already shown from phase 1)
  → appends "\n\n## Additional context\n\n" + second stream to answer
  → sets isDeepSearch=true → shows "Deep" badge on Quick Summary
```

Both phases use the same `readStream()` helper; the second call reuses the existing AbortController signal.

---

## Data Flow — Follow-up Thread

```
User types follow-up → hits Enter in FollowUpBar
        ↓
[Frontend] runFollowUp(text)
  → appends {id, question, sources:[], answer:'', streaming:true} to followUpBlocks
  → POST /explore/search {query: text, context: submittedQueryRef.current}
        ↓
[Backend] prepends "Follow-up on "<context>": " to query
  → same SAG pipeline as main search
        ↓
[Frontend] SSE updates the specific block by id via setFollowUpBlocks
  → auto-scrolls to new block via lastBlockRef
```

Max 5 follow-up blocks (`MAX_FOLLOW_UPS = 5`). After that, FollowUpBar shows "Start a new search to continue."

---

## LLM Service — Provider Auto-detection

`services/llm.py` detects which provider to use in this order:

1. `AI_PROVIDER` env var (explicit: `openrouter` / `openai` / `gemini`)
2. `OPENROUTER_API_KEY` present → OpenRouter
3. `OPENAI_API_KEY` present → OpenAI
4. `GOOGLE_API_KEY` or `GEMINI_API_KEY` present → Gemini
5. Falls back to OpenAI

Default model per provider:
- OpenRouter: `openai/gpt-4o` (overridable via `OPENROUTER_CHAT_MODEL`)
- OpenAI: `gpt-4o` (overridable via `OPENAI_CHAT_MODEL`)
- Gemini: `gemini-2.0-flash` (overridable via `GEMINI_CHAT_MODEL`)

OpenRouter model aliases supported: `gpt-4o`, `gpt-4o-mini`, `gemini-2.0-flash`, `grok-3`, `claude-sonnet-4.5`, etc.

---

## Frontend Components

### `ExplorePage.js` (~1130 lines)
The single page. Contains all state and most UI components inline (not extracted to separate files). Key internal components:

| Component | Purpose |
|---|---|
| `useTrendingChips()` | Hook — fetches GNews top headlines for suggestion chips; falls back to 6 hardcoded suggestions |
| `SearchBar` | Glass-morphism input with Deep toggle (⚡) and Search button |
| `ResultBlock` | Two-column card: 35% sources + 65% answer+tabs. Owns `activeTab` state |
| `TabStrip` | Result / Knowledge Graph / News / Images tabs |
| `QuickSummary` | Collapsible pill showing 2–3 bullet points + Deep badge + confidence badge |
| `CollapsibleAnswer` | Full Markdown answer with blinking cursor while streaming |
| `FollowUpBar` | Glass input bar at bottom of each completed block |
| `ThreadDivider` | 1px vertical line separating conversation blocks |
| `CitationLink` | Converts `[1]` / `[2]` inline citations to orange numbered badges with tooltip |
| `SourceChip` | Source card: favicon + quality dot + numbered title + external link icon |

### State shape (main block)
```js
query          // current input value
phase          // 'idle' | 'searching' | 'results' | 'error'
sources        // [{title, url, snippet, favicon}]
answer         // full markdown string (grows as chunks arrive)
streaming      // bool — true while SSE is open
errorMsg       // string
deepMode       // bool — Deep toggle UI state
isDeepSearch   // bool — true after phase 2 completes
deepLabel      // '1/2' | '2/2' | ''
toast          // {show: bool, message: string}
followUpBlocks // [{id, question, sources, answer, streaming, errorMsg}]
```

### `KnowledgeGraph.js`
- Wraps `react-force-graph-2d`
- Nodes extracted from answer: query node → source nodes + topic nodes (H2/H3 headers) → concept nodes (bold terms)
- Minimap: canvas overlay capturing final node positions via `onEngineStop`
- Side drawer slides in on node click (type badge + name + source URL)
- DOM tooltip on hover via `mousemove` event

### `PixelFigurines.jsx`
Three inline SVG pixel-art characters (`<rect>` elements only, no paths):
- **ScoutFigurine** — navy cap, orange jacket, magnifying glass
- **ArchivistFigurine** — glasses, open book, sitting on coloured book stack
- **WandererFigurine** — teal jacket, backpack, compass

Placed in home screen corners (fixed, `pointer-events: none`, `z-index: 0`). Float animation via `@keyframes floatIdle`, left/right groups offset by 1.5s. Hidden on mobile (<768px), scaled to 70% on tablet.

### `sourceQuality.js`
Classifies source URLs as `high` / `medium` / `unknown`:
- **High:** `.gov`, `.edu` TLDs, or domains in a curated set (bbc.com, reuters.com, nature.com, etc.)
- **Medium:** Wikipedia, major news sites not in the high set
- **Unknown:** everything else

Colour-coded dots on SourceChips: green / orange / gray.

---

## Styling

All CSS variables defined in `frontend/src/index.css`:

```css
--bg-primary:   #EDEAE5   /* warm beige page background */
--bg-secondary: #F2EEE7
--bg-tertiary:  #E8E2D9
--fg-primary:   #111827   /* near-black text */
--fg-secondary: #4B5563
--fg-dim:       #9CA3AF
--accent:       #F97316   /* orange — buttons, citations, active states */
--accent-dim:   rgba(249,115,22,0.12)
--border:       #E5E7EB
--error:        #DC2626
--font-family:  'Inter', system-ui, sans-serif
--font-mono:    'JetBrains Mono', monospace
```

Glass-morphism pattern used throughout:
```css
background: rgba(255,255,255,0.15);
backdrop-filter: blur(12px);
border: 1px solid rgba(255,255,255,0.25);
border-radius: 16px;
box-shadow: 0 4px 24px rgba(0,0,0,0.06);
```

Home screen animated radial gradient: `.home-radial-bg::before` with `radialBreath` keyframe (scale + translateY, 7s).

---

## Share & Save

**Share:** copies `<origin>/?q=<encoded_query>` to clipboard → Toast 2s. On mount, `ExplorePage` checks `window.location.search` for `?q=` and auto-runs the search.

**Save:** downloads a `.md` file: `ask-<slug>-<timestamp>.md` containing the query + full answer.

---

## Known Limitations / Things to Know

- **Scraping success rate varies.** `trafilatura` can't scrape JS-rendered pages (SPAs, paywalled sites). When all 5 scrape attempts fail, the LLM only gets search snippets — answers are noticeably shallower.
- **ScrapingBee credits.** Each "Show More" click on Images tab = 1 API call = 1 credit consumed. Free tier gives 1,000 credits.
- **GNews free tier** = 100 requests/day. Trending chips + News tab both use the same key.
- **ESPN live scores** only cover soccer (8 leagues). Non-soccer sport queries get no live data.
- **CRA env vars** are injected at build/start time. Always restart `npm start` after editing `frontend/.env`.
- **OpenRouter key scope.** The key in `backend/.env` has been rotated at least twice due to accidental commits. Keep it out of `.env.example` and any committed file.
- **`PerspectivesTab.js`** exists in the repo but is no longer imported anywhere. It was replaced by the News and Images tabs.
- **`ComparisonView.js`** exists but is no longer imported. It was a side-by-side A/B card triggered on "vs" queries — removed by user request.

---

## GitHub

Repository: `https://github.com/A-Kumar14/quarry`
Branch: `main`
Commits: 3 (initial → env fix → feature batch)
