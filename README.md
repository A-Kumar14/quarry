# Quarry

An epistemic research tool for journalists and analysts — search the web, synthesise conflicting sources, and write with inline citations.

[Report Bug](https://github.com/A-Kumar14/quarry/issues/new?labels=bug) · [Request Feature](https://github.com/A-Kumar14/quarry/issues/new?labels=enhancement) · [Issues](https://github.com/A-Kumar14/quarry/issues)

---

## Table of Contents

1. [About](#about)
2. [What Makes Quarry Different](#what-makes-quarry-different)
3. [Built With](#built-with)
4. [Getting Started](#getting-started)
   - [Prerequisites](#prerequisites)
   - [Installation](#installation)
5. [Usage](#usage)
6. [API Keys](#api-keys)
7. [Roadmap](#roadmap)
8. [Contact](#contact)

---

## About

Quarry is a full-stack research platform built for epistemic transparency — not just "here is the answer", but "here is what sources say, where they agree, and where they contradict each other."

**Quarry Search** — ask any question and get a streamed answer synthesised from live web sources. Every claim carries an inline confidence badge (verified / contested / speculative / unknown). A contradiction detector runs in the background and flags sources that disagree on the facts. A Perspectives tab surfaces the range of viewpoints across different outlets.

**Deep Mode** — enable multi-pass retrieval for complex queries. Quarry decomposes the question into sub-queries, retrieves sources for each, and shows a transparency panel listing every sub-query run.

**Finance Terminal** — a command-driven market terminal. Type `AAPL`, `COMPARE AAPL MSFT NVDA`, `/analyze NVDA`, or plain English to get live prices, sparklines, charts, and AI analysis.

**Quarry Write** — a document editor with floating formatting toolbar, markdown shortcuts, focus mode, live word count, and read-time estimate. Claim Landscape lets you insert verified claims directly from search results into the document. Export with APA or MLA bibliography generated from your cited sources.

---

## What Makes Quarry Different

| Feature | Quarry | Standard AI search |
|---|---|---|
| Inline confidence badges | Yes — verified / contested / speculative / unknown | No |
| Contradiction detection | Yes — surfaces disagreeing sources | No |
| Perspectives tab | Yes — clusters viewpoints by outlet lean | No |
| Source provenance dots | Yes — colour-coded by funding type, editorial lean, credibility tier | No |
| Deep mode sub-query transparency | Yes — shows every sub-query run | No |
| Write surface with citation insertion | Yes — insert claims from search into doc | No |
| Pipeline trace | Yes — raw claims extracted, verified, contested counts shown | No |

---

## Built With

- [React 18](https://reactjs.org/) + [MUI](https://mui.com/)
- [FastAPI](https://fastapi.tiangolo.com/) (Python 3.10+)
- [OpenRouter](https://openrouter.ai/) — GPT-4o default, any model configurable
- [DuckDuckGo](https://duckduckgo.com/) search (no API key needed)
- [trafilatura](https://trafilatura.readthedocs.io/) for web scraping
- [react-force-graph-2d](https://github.com/vasturiano/react-force-graph) for Knowledge Graph

---

## Getting Started

### Prerequisites

- **Python 3.11+**
- **Node.js 18+** and npm
- An **OpenRouter API key** — get one at [openrouter.ai](https://openrouter.ai)

### Installation

1. **Clone the repo**
   ```sh
   git clone https://github.com/A-Kumar14/quarry.git
   cd quarry
   ```

2. **Set up the backend**
   ```sh
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate        # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Create `backend/.env`**
   ```sh
   cp backend/.env.example backend/.env
   ```
   Open `backend/.env` and add your keys (see [API Keys](#api-keys)).

4. **Set up the frontend**
   ```sh
   cd frontend
   npm install
   ```

5. **Create `frontend/.env`**
   ```
   REACT_APP_API_URL=http://localhost:8000
   ```

6. **Start both servers** (two separate terminals)
   ```sh
   # Terminal 1 — backend
   cd backend && uvicorn main:app --reload --port 8000

   # Terminal 2 — frontend
   cd frontend && npm start
   ```
   Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## Usage

### Quarry Search (`/`)

Type any question and press Enter. Results stream in real time with inline source citations and confidence badges on individual claims.

Use the tab bar to switch between:
- **Result** — streamed answer with inline confidence badges
- **Perspectives** — viewpoint clusters by outlet
- **Citations** — all sources with credibility indicators and provenance dots
- **Contradictions** — sources that disagree on the facts
- **Images** — og:image thumbnails from results
- **Knowledge Graph** — entity relationship map

Toggle **Deep** next to the search bar for multi-pass analysis on complex topics. A sub-query transparency panel shows the decomposition Quarry used.

### Finance Terminal (`/finance`)

| Command | What it does |
|---|---|
| `AAPL` | Live quote + sparkline |
| `AAPL VS MSFT` | Side-by-side price comparison |
| `COMPARE AAPL MSFT NVDA` | Multi-ticker table |
| `INDICES` | Market overview (DOW, S&P 500, NASDAQ) |
| `/analyze NVDA` | Full AI analysis — technicals, fundamentals, catalysts |
| `/technicals AAPL` | RSI, MACD, SMA with interpretation |
| `/macro` | Fed, rates, inflation, sector rotation |
| `EXPLAIN P/E ratio` | Plain-English definition of any finance term |
| `HELP` | Full command reference |

### Quarry Write (`/write`)

A document-first writing surface connected to your search results:

- **Floating toolbar** — appears on text selection; Bold, Italic, Underline, Strikethrough, Link, Highlight
- **Markdown shortcuts** — `# ` / `## ` / `### ` for headings, `- ` for bullets, `1. ` for numbered lists, `> ` for blockquotes, `` ` `` for inline code
- **Focus mode** — dims the interface to just the document
- **Insert claim** — click any claim in the Claim Landscape panel on the Search page to insert it directly into your document
- **Export** — copy as markdown or export with auto-generated APA / MLA bibliography

---

## API Keys

| Key | Required | Used for | Where to get it |
|---|---|---|---|
| `OPENROUTER_API_KEY` | **Yes** | All AI responses | [openrouter.ai](https://openrouter.ai) |
| `GNEWS_API_KEY` | No | Trending news panel | [gnews.io](https://gnews.io) — 100 req/day free |

Image search uses `og:image` extraction from DuckDuckGo results — no key needed.

To change the default model (`openai/gpt-4o`), set `OPENROUTER_CHAT_MODEL` in `backend/.env` to any OpenRouter model ID — for example `x-ai/grok-3` or `google/gemini-2.0-flash-exp:free`.

---

## Roadmap

- [x] Streaming search-augmented generation with inline citations
- [x] Contradiction detection across sources
- [x] Finance terminal with QFL command parser
- [x] Perspectives tab — viewpoint clustering by outlet
- [x] Inline confidence badges (verified / contested / speculative / unknown)
- [x] Source provenance dots — credibility tier, funding type, editorial lean
- [x] Deep mode — query decomposition + sub-query transparency panel
- [x] Pipeline trace — claims extracted, verified, contested counts
- [x] Write surface — floating toolbar, markdown shortcuts, focus mode
- [x] Claim insertion from search results into document
- [x] APA / MLA bibliography export
- [ ] User accounts and cloud sync
- [ ] PDF export
- [ ] Custom watchlist persistence across devices
- [ ] Voice input

See [open issues](https://github.com/A-Kumar14/quarry/issues) for proposed features and known bugs.

---

## Contact

**A-Kumar14** — [github.com/A-Kumar14](https://github.com/A-Kumar14)

Project link: [https://github.com/A-Kumar14/quarry](https://github.com/A-Kumar14/quarry)

---
