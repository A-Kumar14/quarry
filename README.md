# Quarry

A full-stack AI search engine. Web search + real-time scraping + LLM reasoning, streamed to a React UI.

---

## What It Does

Quarry takes a natural-language query, searches the web via DuckDuckGo, scrapes the top result pages for actual content, injects everything into an LLM prompt, and streams a cited Markdown answer back to the user. Follow-up questions continue as a threaded conversation, each one aware of the original query.

Every result exposes five tabs:

| Tab | Description |
|---|---|
| Result | Streamed LLM answer with inline citations, inline images, and a quick summary |
| News | Google News-style 2-column article grid with a sources sidebar |
| Images | Masonry image grid with filter chips, lightbox panel, and infinite scroll |
| Perspectives | Reddit threads for the query |
| Knowledge Graph | Force-directed concept graph extracted from the answer |

The homepage also provides a **Quarry Research** mode: a 5-phase structured research assistant (Onboarding, Scope, Research, Synthesis, Wrap-up) with a multi-turn streaming chat interface and phase progress tracker.

---

## Repository Layout

```
quarry/
├── backend/
│   ├── main.py                  # FastAPI app, CORS, rate limiting, security headers
│   ├── schemas.py               # Pydantic request/response models
│   ├── requirements.txt
│   ├── .env                     # Real keys — gitignored
│   ├── .env.example             # Placeholder template — committed
│   ├── Makefile                 # Dev workflow shortcuts
│   ├── pytest.ini
│   ├── routers/
│   │   └── explore.py           # All /explore/* endpoints
│   ├── services/
│   │   ├── registry.py          # Module-level singletons
│   │   ├── llm.py               # LLM abstraction (OpenRouter / OpenAI / Gemini)
│   │   ├── ai_service.py        # SAG pipeline + research session streaming
│   │   ├── search_service.py    # DuckDuckGo search, trafilatura scraping
│   │   └── image_service.py     # og:image extraction from search result pages
│   ├── security/
│   └── tests/                   # 16 test files covering endpoints and services
│
├── frontend/
│   ├── src/
│   │   ├── App.js               # Routes: / and /research
│   │   ├── index.css            # CSS variables, DM Sans + Inter, animations
│   │   ├── pages/
│   │   │   ├── ExplorePage.js   # Main search page
│   │   │   └── ResearchPage.js  # 5-phase research chat
│   │   ├── components/
│   │   │   ├── GlassCard.js
│   │   │   ├── Spinner.js
│   │   │   ├── KnowledgeGraph.js
│   │   │   ├── NewsTab.js
│   │   │   ├── ImagesTab.js
│   │   │   ├── PerspectivesTab.js
│   │   │   ├── PixelFigurines.jsx
│   │   │   └── Toast.js
│   │   └── utils/
│   │       └── sourceQuality.js
│   └── package.json
│
└── dev.sh                       # Opens split Terminal windows for backend + frontend
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
| Web search | DuckDuckGo via `ddgs` — no API key needed |
| Web scraping | `trafilatura` for clean Markdown extraction |
| Image search | `og:image` meta tag extraction from search result pages |
| News | GNews API, server-side proxied with 5-minute cache |
| Rate limiting | `slowapi` per endpoint |
| Validation | Pydantic v2 |
| Security | CORS, security headers, SSRF protection, prompt injection sanitization |

### Frontend

| Layer | Technology |
|---|---|
| Framework | React 19 (Create React App) |
| Component lib | MUI v7 |
| Routing | react-router-dom v7 |
| Markdown | react-markdown + remark-gfm |
| Knowledge graph | react-force-graph-2d |
| Icons | lucide-react |
| Fonts | Inter (UI), DM Sans (News/Images tabs) |

---

## API Keys Required

| Key | File | Used For | Free Tier |
|---|---|---|---|
| `OPENROUTER_API_KEY` | `backend/.env` | LLM inference | Pay-per-token |
| `GNEWS_API_KEY` | `backend/.env` | News tab + trending articles | 100 req/day |

Image search uses `og:image` extraction from DuckDuckGo results — no API key required.

---

## Environment Files

**`backend/.env`**
```
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-v1-...
GNEWS_API_KEY=...
```

**`frontend/.env`**
```
REACT_APP_API_URL=http://localhost:8000
```

`REACT_APP_*` vars are baked in at `npm start` / build time. Restart the dev server after editing `.env`.

---

## Running Locally

**Quick start (split terminal)**
```bash
chmod +x dev.sh
./dev.sh
```

Opens two Terminal windows side by side — backend on the left, frontend on the right.

**Backend (manual)**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 main.py
```

**Frontend (manual)**
```bash
cd frontend
npm install
npm start
```

**Tests**
```bash
cd backend
make test
```

---

## API Endpoints

### `POST /explore/search`
Streams a Search-Augmented Generation response as SSE.

```json
{ "query": "what are piranhas?", "context": null }
```

SSE events returned:
```
data: {"type": "sources", "sources": [{title, url, snippet, favicon}]}
data: {"type": "chunk",   "text": "...markdown fragment..."}
data: {"type": "error",   "text": "..."}
data: [DONE]
```

Pass `context: "<original query>"` for follow-up questions. The backend prepends the context to keep search results on topic.

### `GET /explore/images?q=<query>&page=<n>`
Returns up to 9 images per page extracted from `og:image` meta tags on web search result pages.

```json
{
  "images": [
    {"title": "...", "image": "https://...", "thumbnail": "https://...", "source": "https://...", "domain": "example.com"}
  ]
}
```

### `GET /explore/news?q=<query>&max=<n>`
Proxies GNews search server-side. Cached 5 minutes per query.

### `GET /explore/trending-news?max=<n>`
Proxies GNews top headlines. Cached 5 minutes.

### `POST /explore/research`
Streams a multi-turn research session as SSE. Accepts conversation history.

```json
{
  "messages": [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}],
  "message": "latest user input"
}
```

Responses include `<!-- SESSION_STATE phase: N -->` comments for phase tracking. The frontend strips these before rendering.

### `GET /explore/related?query=<q>&snippet=<s>`
Returns 3 related search suggestions as a JSON array.

### `GET /health`
```json
{"status": "ok"}
```

---

## Data Flow — Main Search

```
User submits query
        |
POST /explore/search
        |
DuckDuckGo text search (max 8 results)
        |
Parallel page scraping via trafilatura (top 5 URLs, 3000 char limit each)
        |
SSE: sources event sent to frontend
        |
LLM streaming via OpenRouter / OpenAI / Gemini
        |
SSE: chunk events sent one token at a time
        |
Frontend accumulates chunks into live Markdown render
Frontend fetches og:images in parallel for inline image strip
Frontend fetches related searches on completion
```

---

## Data Flow — Research Mode

```
User clicks "Quarry Research" on homepage -> navigates to /research
        |
Auto-init: POST /explore/research with empty message
        |
Backend applies RESEARCH_SYSTEM_PROMPT (server-side only, never sent to frontend)
5 phases: Onboarding -> Scope -> Research -> Synthesis -> Wrap-up
        |
SSE streams response, ending with <!-- SESSION_STATE phase: N -->
        |
Frontend parses phase number, updates PhaseTracker progress bar
Frontend strips SESSION_STATE comment before displaying message
        |
User replies; full conversation history sent with each request
```

---

## Image Service

Images are sourced without any API key:

1. DuckDuckGo text search runs for the query
2. The first 32 KB of each result page is fetched in parallel (8 threads)
3. `og:image` or `twitter:image` meta tags are extracted from the HTML
4. Images that pass basic quality checks are returned

This produces topically relevant images since they come from the same pages as the search results.

---

## News Tab

The News tab renders a Google News-style layout. The left sources panel is hidden when this tab is active so the news content uses the full width.

The main panel contains a section header linking to Google News search, a 2-column card grid (source favicon, headline, thumbnail, relative timestamp per card), and a pagination control at the bottom.

The right sidebar contains a Save toggle button and source chips derived from the unique domains in the result set.

---

## Images Tab

The Images tab renders a masonry grid using CSS `columns`.

| Viewport | Columns |
|---|---|
| > 1024px | 4 |
| 768–1024px | 3 |
| 480–768px | 2 |
| < 480px | 1 |

A filter chips row above the grid lets users filter by source domain. Clicking any image card opens a right-side detail panel showing the full image, title, domain, and links to visit the source page or view the raw image. Scrolling near the bottom of the grid automatically loads the next page.

---

## LLM Provider Detection

`services/llm.py` selects a provider in this order:

1. `AI_PROVIDER` env var (`openrouter` / `openai` / `gemini`)
2. `OPENROUTER_API_KEY` present
3. `OPENAI_API_KEY` present
4. `GOOGLE_API_KEY` or `GEMINI_API_KEY` present

| Provider | Default model | Override env var |
|---|---|---|
| OpenRouter | `openai/gpt-4o` | `OPENROUTER_CHAT_MODEL` |
| OpenAI | `gpt-4o` | `OPENAI_CHAT_MODEL` |
| Gemini | `gemini-2.0-flash` | `GEMINI_CHAT_MODEL` |

---

## Security

All responses include standard security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy).

Input validation is enforced via Pydantic v2 with strict length limits on all request fields. Scraped content is sanitized before LLM injection to prevent prompt injection. SSE chunks are sanitized to prevent event stream injection. URLs are validated against a blocklist before scraping to prevent SSRF. Rate limiting is applied per endpoint via `slowapi`.

---

## Styling

CSS variables in `frontend/src/index.css`:

```css
--bg-primary:   #EDEAE5
--fg-primary:   #111827
--accent:       #F97316
--border:       #E5E7EB
--font-family:  'Inter', system-ui, sans-serif
```

News and Images tabs use DM Sans for an editorial feel distinct from the rest of the UI.

Glass-morphism pattern used throughout:
```css
background: rgba(255,255,255,0.15);
backdrop-filter: blur(12px);
border: 1px solid rgba(255,255,255,0.25);
```

---

## Known Limitations

Scraping success varies. `trafilatura` cannot scrape JS-rendered pages or paywalled sites. When all scrape attempts fail, the LLM only receives search snippets and answers are shallower.

The GNews free tier allows 100 requests per day shared across the News tab and the trending article grid on the homepage.

ESPN live scores only cover soccer (8 leagues).

CRA env vars are injected at build time. Restart `npm start` after editing `frontend/.env`.

---

## Repository

`https://github.com/A-Kumar14/quarry` — branch `main`
