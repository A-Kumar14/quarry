# Quarry — Architecture & Technical Reference

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Backend Architecture](#backend-architecture)
   - [Entry Point & Middleware](#entry-point--middleware)
   - [Routers](#routers)
   - [Services](#services)
   - [LLM Layer](#llm-layer)
5. [Frontend Architecture](#frontend-architecture)
   - [Routing & App Shell](#routing--app-shell)
   - [Pages](#pages)
   - [Components](#components)
   - [Context Providers](#context-providers)
   - [CSS Design System](#css-design-system)
6. [Core Data Flows](#core-data-flows)
   - [Search-Augmented Generation (SAG)](#search-augmented-generation-sag)
   - [SSE Streaming Protocol](#sse-streaming-protocol)
   - [Finance Query Pipeline](#finance-query-pipeline)
   - [Research Session Flow](#research-session-flow)
7. [QFL — Quarry Finance Language](#qfl--quarry-finance-language)
8. [AI Prompting Architecture](#ai-prompting-architecture)
9. [Caching & Performance](#caching--performance)
10. [Security](#security)
11. [Environment & Configuration](#environment--configuration)

---

## Overview

Quarry is a full-stack AI research and finance platform with three surfaces:

| Surface | Route | Purpose |
|---|---|---|
| **Quarry Search** | `/` | Web search + AI synthesis with live streaming, source citations, and contradiction detection |
| **Quarry Research** | `/research` | Multi-turn conversational research assistant with file upload |
| **Finance Terminal** | `/finance` | Command-driven live market data, charts, and AI analysis via QFL |

All AI responses are streamed as Server-Sent Events. The backend is a single FastAPI process; the frontend is a React SPA configured via `REACT_APP_API_URL`.

---

## Tech Stack

### Frontend

| Layer | Technology | Version |
|---|---|---|
| Framework | React (CRA) | 19.1 |
| Routing | React Router DOM | 7.13 |
| UI Components | MUI (Material UI) | 7.3.7 |
| CSS-in-JS | Emotion (react + styled) | 11.x |
| Utility CSS | Tailwind CSS | 3.4 |
| Icons | Lucide React | 0.564 |
| Animations | Framer Motion | 12.38 |
| Markdown rendering | react-markdown + remark-gfm | 10.1 / 4.0 |
| Graph visualisation | react-force-graph-2d | 1.29 |
| Build tooling | PostCSS + Autoprefixer | 8.5 / 10.4 |

### Backend

| Layer | Technology | Version |
|---|---|---|
| Web framework | FastAPI | 0.115.5 |
| ASGI server | Uvicorn + Gunicorn | 0.30.6 / 23.0 |
| Rate limiting | SlowAPI | 0.1.9 |
| AI SDK (OpenRouter) | openai (compat client) | 1.95.1 |
| Web search | ddgs (DuckDuckGo) | 0.1+ |
| Web scraping | trafilatura | 1.12+ |
| HTML parsing | BeautifulSoup4 + lxml | 4.12 / 5.0 |
| HTTP clients | Requests + HTTPX | 2.32 / 0.27 |
| Stock data | yfinance | 0.2.40+ |
| File parsing | pypdf + python-docx | 4.0 / 1.1 |
| Config | python-dotenv | 1.1.1 |

### AI / LLM

- **Provider**: OpenRouter exclusively (`https://openrouter.ai/api/v1`)
- **Client**: OpenAI Python SDK pointed at OpenRouter's base URL
- **Streaming**: Server-Sent Events for all user-facing AI responses
- **Token budget**: `max_tokens: 1000` across all LLM calls
- **Default model**: `openai/gpt-4o` (overridable via `OPENROUTER_CHAT_MODEL`)

---

## Project Structure

```
quarry/
├── CLAUDE.md                      # Project coding guidelines
├── README.md                      # User-facing docs
├── dev.sh                         # Dev startup script
├── CONTEXT/
│   ├── ARCHITECTURE.md            # This file
│   └── PHILOSOPHY.md              # Design philosophy
│
├── backend/
│   ├── main.py                    # FastAPI app, CORS, security headers, rate-limiter
│   ├── schemas.py                 # Pydantic request/response models
│   ├── routers/
│   │   └── explore.py             # All HTTP routes (~570 lines)
│   ├── services/
│   │   ├── registry.py            # Module-level service singletons
│   │   ├── llm.py                 # OpenRouter LLM abstraction
│   │   ├── ai_service.py          # SAG pipeline, prompts, contradiction detection
│   │   ├── search_service.py      # DuckDuckGo search + trafilatura scraping
│   │   ├── finance_service.py     # yfinance quotes, charts, news
│   │   ├── image_service.py       # og:image extraction via DDGS (no API key)
│   │   └── citation_service.py    # Citation formatting (APA, MLA, Chicago, BibTeX, Vancouver)
│   ├── tests/                     # Unit + integration tests
│   ├── .env.example
│   └── requirements.txt
│
└── frontend/
    ├── src/
    │   ├── App.js                 # Root component + react-router routes
    │   ├── index.js               # ReactDOM entry point
    │   ├── index.css              # CSS variables, dark mode, animations
    │   ├── DarkModeContext.js     # Dark/light mode global state + background wrapper
    │   ├── SettingsContext.js     # Persistent user preferences
    │   ├── pages/
    │   │   ├── ExplorePage.js     # Main search page (~1700 lines)
    │   │   ├── FinancePage.js     # Finance terminal + QFL parser (~1300 lines)
    │   │   ├── ResearchPage.js    # Research assistant (~400 lines)
    │   │   ├── ResearchSessionsPage.js
    │   │   ├── SavedPage.js
    │   │   ├── SettingsPage.js
    │   │   └── SourcesPage.js
    │   └── components/
    │       ├── NavControls.js         # Top-right icon cluster
    │       ├── NavDock.js             # Bottom navigation dock
    │       ├── GlassCard.js           # Glass-morphism card primitive
    │       ├── StockMarquee.js        # Horizontal scrolling ticker
    │       ├── MonthlyFiguresMarquee.js  # Calendar watermark strip
    │       ├── FinanceCard.js         # Inline stock card in search results
    │       ├── ContradictionsTab.js   # Contradiction detection results
    │       ├── CitationsPanel.js      # Source citation display
    │       ├── ImagesTab.js           # Image search results grid
    │       ├── NewsTab.js             # GNews article cards
    │       ├── PerspectivesTab.js     # Reddit post results
    │       ├── KnowledgeGraph.js      # Force-directed concept graph
    │       ├── ComparisonView.js      # Side-by-side stock comparison
    │       ├── Spinner.js             # Loading indicator
    │       └── Toast.js               # Notification system
    ├── package.json
    ├── tailwind.config.js
    └── postcss.config.js
```

---

## Backend Architecture

### Entry Point & Middleware

**`main.py`** creates the FastAPI app and configures:

- **CORS**: Origins from `CORS_ORIGINS` env var (defaults to `*` for dev)
- **Security headers** (custom middleware applied to every response):
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: no-referrer`
  - `Permissions-Policy: geolocation=(), microphone=(), camera=()`
  - `Cache-Control: no-store`
- **SlowAPI rate limiter**: keyed by client IP; applied per-route via decorators
- **Router**: `explore.router` mounted — all routes self-prefix as `/explore/...`
- **Health check**: `GET /health` → `{"status": "ok"}` (no rate limit)

---

### Routers

**`routers/explore.py`** defines all application routes.

#### Streaming Routes (SSE — `text/event-stream`)

| Route | Rate Limit | Purpose |
|---|---|---|
| `POST /explore/search` | 15/min | Main SAG pipeline — sources, chunks, stock, contradictions |
| `POST /explore/research` | 30/min | Multi-turn research assistant |
| `POST /explore/outline` | 10/min | Academic paper outline generator |

All streaming routes use `StreamingResponse(content=generator(), media_type="text/event-stream")`.

#### Data Routes (JSON)

| Route | Rate Limit | Purpose |
|---|---|---|
| `POST /explore/related` | 30/min | 3 AI-generated follow-up query suggestions |
| `POST /explore/cite` | 30/min | Resolve URL → formatted citation |
| `POST /explore/parse-file` | 20/min | Extract text from PDF/DOCX/TXT/MD/CSV (max 10MB) |
| `GET /explore/news` | 30/min | GNews API proxy — query-specific news (cached 5min) |
| `GET /explore/trending-news` | 30/min | GNews top-headlines (cached 5min) |
| `GET /explore/perspectives` | 30/min | Reddit search proxy |
| `GET /explore/images` | 30/min | og:image extraction via DDGS (9 per page) |
| `GET /explore/suggest` | 60/min | Query autocomplete via Datamuse |
| `GET /explore/stocks` | 60/min | Batch stock quotes + sparklines (cached 90s) |
| `GET /explore/quote/{ticker}` | 60/min | Single ticker quote + recent news |
| `GET /explore/chart/{ticker}` | 60/min | Historical OHLC (1D/1W/1M/3M/1Y/5Y, cached 5min) |

#### Per-Query Deduplication

Identical queries are blocked for 60 seconds (per-hash sliding window) to prevent search hammering.

---

### Services

#### `registry.py`

Instantiates module-level singletons so services aren't re-created per request:

```python
llm_service = LLMService()
ai_service  = AIService()
```

`AIService` lazy-loads `llm_service` on first use via `_get_llm()`.

---

#### `search_service.py`

**`web_search(query, max_results=5)`**
- Uses `ddgs.DDGS().text()` — DuckDuckGo, no API key required
- HTML entity decoding applied to titles/snippets
- Returns `[{title, url, snippet}]`

**`scrape_urls(urls, max_pages=3)`**
- Filters unsafe URLs via `is_safe_url()` before fetching (SSRF guard)
- Runs `_scrape_one()` in `ThreadPoolExecutor(max_workers=3)`; 8s total / 4s per-URL timeout
- Uses `trafilatura` to extract clean Markdown (no links, no images)
- Truncates each page to **2000 chars**
- Runs output through `sanitize_scraped_content()` (strips prompt-injection patterns)

**`build_context(results, scraped)`**
- Merges snippets + scraped Markdown into a numbered block
- Returns `(context_block: str, sources: list[dict])`

**`fetch_live_scores(query)`**
- Polls 8 ESPN scoreboard endpoints in parallel (Champions League, Europa, Premier League, La Liga, Bundesliga, Serie A, Ligue 1, MLS)
- 3s per-request timeout; 4s hard deadline across all 8
- Returns pre-formatted `[LIVE SCORES — ESPN]` block or empty string

---

#### `finance_service.py`

**`is_finance_query(query) → (bool, ticker | None)`**

Classification order:
1. Explicit `$TICKER` pattern → immediate match
2. Bare uppercase token in `KNOWN_TICKERS` + finance keyword in query
3. Strong finance phrases ("stock price", "share price", "market cap", etc.)
4. General market keywords ("earnings", "ipo", "dividends", etc.)

**`extract_ticker(query) → str | None`**

Priority: `$TICKER` syntax → `KNOWN_TICKERS` set → company name map (longest match).

**`get_quote(ticker) → dict | None`**
- Downloads 2 days of 5-minute candles via `yfinance.download()`
- yfinance 2.x guard: `if hasattr(closes, "columns"): closes = closes.iloc[:, 0]`
- Sparkline downsampled to ≤40 points; cached **60s** per ticker
- Returns: `{ticker, rawTicker, name, price, change, changePct, sparkline, marketCap}`

**`get_chart_history(ticker, period)`** → `[{date, open, high, low, close, volume}]`

Known tickers: 40+ symbols including mega-caps (AAPL, MSFT, NVDA, TSLA…) and indices (`^DJI`, `^GSPC`, `^IXIC`, `^VIX`, `^RUT`).

---

#### `ai_service.py`

The core intelligence layer. See [AI Prompting Architecture](#ai-prompting-architecture) for prompt details.

**Public methods:**

| Method | Type | Used by |
|---|---|---|
| `explore_the_web(query)` | SSE generator | `POST /explore/search` |
| `research_session(messages, message, file_context)` | SSE generator | `POST /explore/research` |
| `generate_outline(query, context)` | SSE generator | `POST /explore/outline` |
| `detect_contradictions(sources, scraped)` | Sync → dict | Called internally post-stream |

**`_is_research_query(query)`** — returns `False` for sports, live scores, current events, weather, stock prices, crypto. Used to skip contradiction detection for time-sensitive queries.

**`sanitize_sse_chunk(text)`** — strips null bytes, collapses `\n\n`, neutralises `data:` at line starts. Applied to every LLM chunk before writing to the stream.

---

#### `image_service.py`

Fetches images without any external API key by extracting `og:image` / `twitter:image` meta tags from DuckDuckGo web search results.

- `ThreadPoolExecutor(max_workers=8)` for parallel fetching
- Reads only the first 32KB per page (stops at `</head>`)
- Handles both `property/content` and reversed `content/property` attribute order
- Skips: tracking pixels, SVGs, placeholder images, `/1x1` paths
- Skips domains: `facebook.com`, `twitter.com`, `youtube.com`
- Returns `PAGE_SIZE = 9` results per page

---

#### `citation_service.py`

Resolves a URL → structured metadata → formatted citation string.

**Metadata sources (priority):** arXiv API → CrossRef API → HTML meta-tag scraping (`og:`, `citation_*`, `dc.*`)

**Supported styles:** APA, MLA, Chicago, Harvard, Vancouver

---

### LLM Layer

**`llm.py`** — `LLMService` singleton. All AI calls route exclusively through OpenRouter:

```python
client = openai.OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY"),
)
```

**Model aliases** (`resolve_model()`):

| Shorthand | OpenRouter path |
|---|---|
| `gpt-4o` | `openai/gpt-4o` |
| `gpt-4o-mini` | `openai/gpt-4o-mini` |
| `gemini-2.0-flash` | `google/gemini-2.0-flash-exp:free` |
| `gemini-3-flash` | `google/gemini-3-flash-preview` |
| `claude-3.5-sonnet` | `anthropic/claude-3.5-sonnet` |
| `claude-sonnet-4.5` | `anthropic/claude-sonnet-4.5` |
| `grok-3` | `x-ai/grok-3` |

Any model ID containing `/` passes through unchanged.

**Three call types:**

| Method | Streaming | `max_tokens` | Used for |
|---|---|---|---|
| `complete(prompt, max_tokens=150)` | No | 150 | Short single-turn completions |
| `stream_sync(messages, model)` | Yes | 1000 | All user-facing streamed responses |
| `chat_sync(messages, model, timeout=15)` | No | 1000 | Contradiction detection, related searches |

---

## Frontend Architecture

### Routing & App Shell

**`App.js`** wraps the entire tree in provider order:

```jsx
<DarkModeProvider>
  <SettingsProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/"                  element={<ExplorePage />} />
        <Route path="/research"          element={<ResearchPage />} />
        <Route path="/research/sessions" element={<ResearchSessionsPage />} />
        <Route path="/finance"           element={<FinancePage />} />
        <Route path="/saved"             element={<SavedPage />} />
        <Route path="/settings"          element={<SettingsPage />} />
        <Route path="/sources"           element={<SourcesPage />} />
      </Routes>
    </BrowserRouter>
  </SettingsProvider>
</DarkModeProvider>
```

---

### Pages

#### `ExplorePage.js` (~1700 lines)

The main search interface. Two internal phases: `'home'` (landing) and `'results'` (after query).

**Key state:**
- `phase` — `'home' | 'results' | 'error'`
- `answer` — accumulated Markdown from LLM stream
- `sources` — `[{title, url, snippet, favicon}]`
- `stockData` — live quote object (if finance query)
- `contradictions` — `{contradictions: [...], consensus: ""}`
- `streaming` — true while SSE stream is active
- `deepMode` — enables 2-pass deep search
- `followUpBlocks` — threaded follow-up `{query, answer, sources}` array

**Home layout:**
```
[Calendar ticker — full width, if enabled]

           Quarry
  ─────── AI Research Engine ───────

       [Search bar + Deep toggle]

  Watchlist  |  Trending              ← 2-column, 640px max-width
  (6 stocks) |  (6 compact pills)

  [Quarry Research] [Finance Terminal] ← CTA row, same container width
```

The `NavControls` pill is fixed top-right. Its `top` offset increases by 36px when the calendar bar is visible, with `transition: top 0.18s ease`.

**Results tab structure:** Answer · Citations · Contradictions · Perspectives · Images · News

---

#### `FinancePage.js` (~1300 lines)

Finance terminal. Forces dark mode on mount and restores the previous value on unmount:

```javascript
useEffect(() => {
    const prev = dark;
    setDark(true);
    return () => { setDark(prev); };
}, []);
```

**Client-side technical indicators:**
- `calcSMA(prices, period)` — Simple Moving Average
- `calcEMA(prices, period)` — Exponential Moving Average
- `calcRSI(prices, period)` — Relative Strength Index (0–100)
- `calcMACD(prices)` — MACD line, signal line, histogram

---

#### `ResearchPage.js` (~400 lines)

Multi-turn research assistant with session persistence and file upload.

**Session storage** (localStorage):
- `quarry_session_${uuid}`: `{id, messages, topic, updatedAt, createdAt}`
- `quarry_sessions_index`: ordered array of IDs

**File handling:**
1. User attaches file → frontend POSTs to `/explore/parse-file`
2. Extracted text stored as `file_context` in state
3. `file_context` sent with every subsequent message
4. Backend appends it to the system prompt (not to chat history, keeping history clean)

---

### Components

| Component | Purpose |
|---|---|
| `NavControls` | Top-right pill: Settings popover (dark mode + calendar toggles), Saved link, Account placeholder |
| `NavDock` | Bottom navigation dock |
| `GlassCard` | Glass-morphism card wrapper (CSS variable tokens, 12px border-radius) |
| `StockMarquee` | Auto-scrolling horizontal watchlist ticker |
| `MonthlyFiguresMarquee` | Calendar watermark strip (opacity 0.38) |
| `FinanceCard` | Inline stock card injected into search results for finance queries |
| `ContradictionsTab` | Contradiction results with high/medium/low severity badges and notes field |
| `CitationsPanel` | Source list with favicons, quality scoring, citation formatter |
| `ImagesTab` | Paginated image grid (9/page) |
| `NewsTab` | GNews article cards |
| `PerspectivesTab` | Reddit post results |
| `KnowledgeGraph` | react-force-graph-2d force-directed concept map |
| `ComparisonView` | Side-by-side multi-ticker comparison table |
| `Spinner` | Animated CSS loading indicator |
| `Toast` | Auto-dismiss notification (bottom-right) |

---

### Context Providers

#### `DarkModeContext.js`

```javascript
const [dark, setDark] = useDarkMode();
```

- Persists to `localStorage.quarry_dark` (`'1'` / `'0'`)
- Applies `.dark` class to `<html>` and `<body>`
- **The provider `<div>` wrapper IS the page background** — `backgroundAttachment: fixed` pins the gradient while content scrolls
  - Light: `#EDE8DF → #E5DDD0 → #DDD5C0 → #E8E2D5` (158deg)
  - Dark: `#1c1814 → #221d17 → #2a2318 → #1f1b14` (158deg)
- Background transition: `0.4s ease`

#### `SettingsContext.js`

```javascript
const { settings, set } = useSettings();
```

| Setting | Default | Purpose |
|---|---|---|
| `showCalendar` | `true` | Show/hide the calendar event ticker strip |
| `financeAutoDetect` | `true` | Auto-detect tickers in search queries |

Persisted to `localStorage.quarry_settings` (JSON). `useTopOffset()` always returns `0`.

---

### CSS Design System

All design tokens in `index.css` as CSS custom properties.

#### Light mode

```css
--bg-primary:   #EDE8DF;        /* Sepia page background */
--fg-primary:   #26180a;        /* Deep brown text */
--fg-secondary: #5a4222;
--fg-dim:       #8a6d47;
--accent:       #F97316;        /* Orange CTA */
--blue:         #1e40af;
--border:       rgba(175,150,105,0.18);
--font-serif:   'Playfair Display', Georgia, serif;
--font-family:  'DM Sans', system-ui, sans-serif;
--font-mono:    'IBM Plex Mono', 'Fira Code', monospace;
```

#### Dark mode (`.dark` on `<html>`)

```css
--bg-primary:   #0d1117;
--fg-primary:   #e6edf3;
--fg-secondary: #8b949e;
--accent:       #fb923c;        /* Brighter orange for dark contrast */
--blue:         #60a5fa;
```

#### Design rules

- **Background**: Never change the sepia gradient — it is the brand identity
- **Border radius**: `12px` on cards, search bar, image containers — unified system
- **Hover**: `translateY(-1px)` + `shadow-md`, `transition: all 0.16–0.18s ease`
- **Source labels**: uppercase, `fontSize: 0.5rem`, `letterSpacing: 0.12em`
- **Headlines**: `lineHeight: 1.3`
- **Deep toggle active**: `inset 0 2px 5px rgba(0,0,0,0.13)` box-shadow
- **Calendar ticker**: `opacity: 0.38`, no competing density

#### Animations

| Name | Used for |
|---|---|
| `blinkPulse` | Text cursor blink |
| `slideInRight` | Graph drawer entrance |
| `trendingPulse` | Live trending indicator pulse |
| `spin` | Refresh icon rotation |
| `navPopIn` | Settings popover entrance (opacity + scale, 0.14s) |

---

## Core Data Flows

### Search-Augmented Generation (SAG)

```
User submits query
        │
        ▼
[search_service.web_search()]
  DuckDuckGo → 5 results [{title, url, snippet}]
        │
        ▼
[search_service.scrape_urls()]
  ThreadPoolExecutor (3 workers, 8s total / 4s per URL)
  trafilatura → clean Markdown, truncated to 2000 chars/page
  sanitize_scraped_content() strips prompt-injection patterns
        │
        ▼
[search_service.build_context()]
  Numbered [N] context block + source metadata list
        │
        ├── [fetch_live_scores()]     if sports signals in query
        │     ESPN API, 8 leagues in parallel, 4s deadline
        │     Prepended to context_block if relevant matches found
        │
        └── [is_finance_query()]      if finance signals in query
              get_quote(ticker) + get_company_news(ticker)
              [LIVE FINANCE DATA] block prepended to context_block
        │
        ▼
[build_explore_system_prompt()]
  _EXPLORE_BASE + _FINANCE_INSTRUCTION? + _SCORES_INSTRUCTION? + context_block
        │
        ▼
[SSE stream begins]
  yield: {"type":"sources",        "sources":[...]}
  yield: {"type":"stock",          "data":{...}}       ← if finance query
  yield: {"type":"chunk",          "text":"..."}       ← repeated
  yield: [DONE]
        │
        ▼  (background thread, post-stream)
[detect_contradictions()]
  ThreadPoolExecutor(1), 6s deadline
  CONTRADICTION_SYSTEM_PROMPT + source content (1500 chars each)
        │
        ▼
  yield: {"type":"contradictions", "data":{...}}
```

---

### SSE Streaming Protocol

**Every event:**
```
data: {"type": "<event_type>", ...}\n\n
```

**Stream terminator:**
```
data: [DONE]\n\n
```

**Event reference:**

| Type | Payload | Timing |
|---|---|---|
| `sources` | `{sources: [{title, url, snippet, favicon}]}` | After search completes |
| `stock` | `{data: {ticker, price, change, changePct, sparkline, news}}` | If finance query |
| `chunk` | `{text: "fragment"}` | Each LLM token/chunk |
| `contradictions` | `{data: {contradictions: [...], consensus: ""}}` | After `[DONE]` |
| `error` | `{text: "message"}` | On pipeline failure |

**Frontend reader** (`ExplorePage.js`):
```javascript
const reader = res.body.getReader();
const decoder = new TextDecoder();
let buf = '';

while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split('\n\n');
    buf = parts.pop(); // retain incomplete event
    for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') { setStreaming(false); continue; }
        const evt = JSON.parse(raw);
        // dispatch on evt.type: sources / chunk / stock / contradictions / error
    }
}
```

Favicons are added server-side just before the `sources` event:
```python
src["favicon"] = f"https://www.google.com/s2/favicons?domain={domain}&sz=32"
```

---

### Finance Query Pipeline

```
Query: "AAPL stock price"
        │
        ▼
[is_finance_query()] → (True, "AAPL")
        │
        ▼
[get_quote("AAPL")]
  yfinance 2-day 5m download
  DataFrame guard: closes = closes.iloc[:, 0] if hasattr(closes, "columns")
  Sparkline downsampled to ≤40 points; cached 60s
        │
        ▼
[get_company_news("AAPL")] → top 6 headlines
        │
        ▼
[LIVE FINANCE DATA — AAPL] block prepended to context_block
_FINANCE_INSTRUCTION injected → LLM leads with price snapshot,
no future speculation, no investment advice
```

---

### Research Session Flow

```
User sends message (+ optional file)
        │
        ├── POST /explore/parse-file   if file present
        │     pypdf / python-docx / plain text
        │     Max 12,000 chars; stored as file_context
        │
        ▼
POST /explore/research
  {messages: [...history], message: "...", file_context: "..." | null}
        │
        ▼
system = RESEARCH_SYSTEM_PROMPT
if file_context:
    system += "## ATTACHED DOCUMENT\n" + 7 strict rules + file_context

full_messages = [system, ...history, user_message]
        │
        ▼
llm.stream_sync(full_messages) → chunk events → [DONE]
        │
        ▼
Frontend: appends reply to messages[], saves to localStorage
```

---

## QFL — Quarry Finance Language

`parseQFL(raw)` in `FinancePage.js` — strict priority order:

| Priority | Pattern | Example | Result type |
|---|---|---|---|
| 1 | Slash command | `/analyze AAPL` | `SLASH` |
| 2 | Index alias | `S&P 500` | `QUOTE` → `^GSPC` |
| 3 | `HELP` / `?` | `HELP` | `HELP` |
| 4 | Index keywords | `INDICES`, `MARKET` | `INDICES` |
| 5 | Rates keywords | `RATES`, `BONDS` | `AI` |
| 6 | Watch operations | `WATCH ADD AAPL` | `WATCH_ADD` |
| 7 | VS comparison | `AAPL VS MSFT` | `COMPARE` |
| 8 | COMPARE multi | `COMPARE AAPL MSFT NVDA` | `COMPARE` |
| 9 | NEWS / EXPLAIN / SCREEN | `NEWS AAPL` | `AI` |
| 10 | Single ticker | `AAPL` (regex `/^[A-Z^.]{1,6}$/`, not in KEYWORDS) | `QUOTE` |
| 11 | Default | anything else | `AI` |

### Slash Commands

| Command | Purpose |
|---|---|
| `/analyze <TICKER>` | Full analysis: technicals, fundamentals, catalysts, risks, verdict |
| `/technicals <TICKER>` | RSI(14), MACD, SMA(20/50) with interpretation |
| `/earnings <TICKER>` | Latest earnings analysis |
| `/macro` | Fed, rates, inflation, sector rotation |
| `/brief` | Morning market brief |
| `/sector <name>` | Sector rotation analysis |
| `/compare <A> <B>` | Side-by-side AI narrative comparison |

### Reserved Keywords

`HELP`, `INDICES`, `INDEX`, `MARKET`, `OVERVIEW`, `RATES`, `RATE`, `BONDS`, `YIELDS`, `COMPARE`, `WATCH`, `NEWS`, `EXPLAIN`, `SCREEN`

Checked **before** the ticker regex — prevents `NEWS`, `SCREEN`, etc. being misidentified as ticker symbols.

### Index Aliases

| Input | Resolves to |
|---|---|
| `DOW`, `DOW JONES` | `^DJI` |
| `S&P 500`, `SP500`, `S&P` | `^GSPC` |
| `NASDAQ` | `^IXIC` |
| `RUSSELL`, `RUSSELL 2000` | `^RUT` |
| `VIX` | `^VIX` |

### QFL Syntax Highlighter

Applied to terminal input in real time:

| Token | Colour |
|---|---|
| Slash commands | Purple `#a78bfa` + bold |
| Keywords | Orange `#fb923c` + bold |
| Operators (`VS`, `ADD`, `REMOVE`) | Blue `#60a5fa` + bold |
| Ticker symbols | White `#e2e8f0` + bold |
| Other | Dimmed grey |

---

## AI Prompting Architecture

All prompts are module-level constants in `ai_service.py`. Nothing constructed inline at call sites.

### Prompt Constants

| Constant | Purpose |
|---|---|
| `CONTRADICTION_SYSTEM_PROMPT` | Rigorous fact-checking with severity calibration (high/medium/low), distinguishes contradiction from opinion/omission/temporal divergence |
| `RESEARCH_SYSTEM_PROMPT` | Multi-turn research assistant — 7 strict document rules, honesty about uncertainty, concrete output not templates |
| `OUTLINE_SYSTEM_PROMPT` | Academic paper outline — 6 sections + References, 4–6 substantive topic-specific bullets per section |
| `_EXPLORE_BASE` | `str.format()` template for the SAG system prompt (3 injection slots) |
| `_FINANCE_INSTRUCTION` | Injected when `stock_data` is present — lead with price snapshot, no speculation |
| `_SCORES_INSTRUCTION` | Injected when `live_scores_text` is present — prefer ESPN block for time-sensitive data |

### `build_explore_system_prompt()`

```python
def build_explore_system_prompt(
    context_block: str,
    stock_data=None,
    live_scores: bool = False
) -> str:
    return _EXPLORE_BASE.format(
        finance_instruction = _FINANCE_INSTRUCTION if stock_data else "",
        scores_instruction  = _SCORES_INSTRUCTION if live_scores else "",
        context_block       = context_block,
    )
```

The base prompt requires the LLM to: cite with `[N]` notation, run a relevance check before answering, use appropriate structure, acknowledge source conflicts, and flag stale data on fast-moving topics.

### Contradiction Detection

- Post-stream, `ThreadPoolExecutor(max_workers=1)`, **6s deadline** (tail-latency guard)
- Skipped entirely for non-research queries via `_is_research_query()`
- JSON schema includes `severity` (high/medium/low) and `notes`
- `setdefault("severity", "medium")` and `setdefault("notes", "")` backfill model omissions
- Never raises — returns empty dict on any failure

### Research Document Rules (7)

1. Read actual content before responding
2. Only reference if genuinely relevant (substantive overlap, not keyword match)
3. If different subject, say so clearly and specifically
4. Never fabricate a connection
5. Never claim it supports a point it doesn't make
6. If non-English, ask user how to proceed
7. If garbled/corrupted/too short, say so rather than guessing

---

## Caching & Performance

| Layer | TTL | Location |
|---|---|---|
| Finance quotes | 60s | Module-level dict in `finance_service.py` |
| Batch stocks endpoint | 90s | `_stocks_cache` in `explore.py` |
| Chart history | 5 min | `_chart_cache` in `explore.py` |
| News | 5 min | `_news_cache` in `explore.py` |
| LLM tokens | — | `max_tokens: 1000` hard cap on all calls |

**Concurrency limits:**

| Operation | Workers | Deadline |
|---|---|---|
| URL scraping | 3 | 8s total, 4s per URL |
| ESPN scores | 8 parallel | 4s total |
| Image og:image extraction | 8 | 6s per request |
| Contradiction detection | 1 background thread | 6s |

**Search limits:** 5 results, 3 pages scraped, 2000 chars/page truncation.

---

## Security

### SSRF Guard (`is_safe_url`)

Blocks before any URL is fetched:
- Private IP ranges: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`
- Cloud metadata: `169.254.169.254`, `fd00::/8`, `metadata.internal`
- Only `http` and `https` schemes allowed

### Prompt Injection Prevention (`sanitize_scraped_content`)

Strips from all scraped content before it enters LLM context:
`[INST]`, `<<SYS>>`, `</s>`, `<system>:`, `ignore previous instructions`, `disregard`, `new instruction` → replaced with `[removed]`

### SSE Injection Prevention (`sanitize_sse_chunk`)

Every LLM chunk before writing to stream:
- Strips null bytes
- Collapses `\n\n` (prevents fake SSE event boundaries)
- Neutralises `data:` at line starts with zero-width space

### HTTP Security Headers

Applied to every response via custom middleware:
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: no-referrer
Permissions-Policy: geolocation=(), microphone=(), camera=()
Cache-Control: no-store
```

### Rate Limiting

- Per-IP via SlowAPI (see route table for per-endpoint limits)
- Per-query hash deduplication: same query blocked 60s
- File uploads: 10MB max, MIME allowlist (.pdf, .docx, .txt, .md, .csv)

---

## Environment & Configuration

### Backend `.env`

```bash
# Required
OPENROUTER_API_KEY=sk-or-...

# Optional
OPENROUTER_CHAT_MODEL=openai/gpt-4o    # Default model; falls back if unset
CORS_ORIGINS=http://localhost:3000      # Comma-separated; defaults to *
GNEWS_API_KEY=...                       # Required for /explore/news and /explore/trending-news
```

### Frontend `.env`

```bash
REACT_APP_API_URL=http://localhost:8000
```

### Running locally

```bash
bash dev.sh   # convenience script at project root

# or manually:
cd backend  && uvicorn main:app --reload --port 8000
cd frontend && npm start     # http://localhost:3000
```

### Production

```bash
# Backend
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000

# Frontend
npm run build    # static output in frontend/build/
```

### No database

All user state (saved searches, watchlist, research sessions, dark mode, settings) lives exclusively in `localStorage` on the client. The backend is fully stateless.
