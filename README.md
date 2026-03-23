# Quarry

An AI-powered research and finance platform — search the web, synthesise sources, cite with confidence.   
**[Read the architecture docs »](https://github.com/A-Kumar14/quarry/blob/main/CONTEXT/ARCHITECTURE.md)**   
  
[Report Bug](https://github.com/A-Kumar14/quarry/issues/new?labels=bug) · [Request Feature](https://github.com/A-Kumar14/quarry/issues/new?labels=enhancement) · [Issues](https://github.com/A-Kumar14/quarry/issues)

---

Table of Contents

1. [About](#about)
2. [Built With](#built-with)
3. [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
4. [Usage](#usage)
5. [API Keys](#api-keys)
6. [Roadmap](#roadmap)
7. [Contact](#contact)

---

## About

Quarry is a full-stack AI research platform with three surfaces:

**Quarry Search** — type any question and get a live, streamed answer synthesised from real web sources. Every claim is cited inline with `[1]`, `[2]` references that link back to the original pages. A contradiction detector runs in the background and flags any sources that disagree on the facts.

**Quarry Research** — a multi-turn research assistant built for deep work. Upload PDFs, Word docs, or text files and ask questions against them. Quarry handles session persistence, so you can close the tab and pick up where you left off.

**Finance Terminal** — a command-driven market terminal powered by QFL (Quarry Finance Language). Type `AAPL`, `COMPARE AAPL MSFT NVDA`, `/analyze NVDA`, or plain English and get live prices, sparklines, charts, and AI analysis.

([back to top](#readme-top))

---

## Built With

[React](https://reactjs.org/)
[FastAPI](https://fastapi.tiangolo.com/)
[OpenRouter](https://openrouter.ai/)
[MUI](https://mui.com/)
[TailwindCSS](https://tailwindcss.com/)
[Python](https://python.org/)

([back to top](#readme-top))

---

## Getting Started

### Prerequisites

- **Python 3.11+**
- **Node.js 18+** and npm
- An **OpenRouter API key** — get one at [openrouter.ai](https://openrouter.ai)
- *(Optional)* A **GNews API key** for the News tab — free tier at [gnews.io](https://gnews.io)

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
   source .venv/bin/activate          # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
  ```
3. **Create `backend/.env`**
  ```sh
   cp backend/.env.example backend/.env
  ```
   Open `backend/.env` and fill in your keys:
4. **Set up the frontend**
  ```sh
   cd frontend
   npm install
  ```
5. **Create `frontend/.env`**
  ```
   REACT_APP_API_URL=http://localhost:8000
  ```
6. **Start both servers**
  Quick start (opens split terminals automatically):
   Or manually in two separate terminals:
   Open **[http://localhost:3000](http://localhost:3000)** in your browser.

([back to top](#readme-top))

---

## Usage

### Quarry Search (`/`)

Type any question and press Enter. Results stream in real time with inline source citations. Use the tabs to switch between the Answer, Citations, Contradictions, Perspectives, Images, and News views.

For follow-up questions, keep typing — each follow-up is aware of the original query and previous answers. Toggle **Deep Mode** next to the search bar for a more thorough two-pass analysis on complex topics.

### Finance Terminal (`/finance`)

The terminal accepts QFL commands or plain English:


| Command                  | What it does                                           |
| ------------------------ | ------------------------------------------------------ |
| `AAPL`                   | Live quote + sparkline for a single ticker             |
| `AAPL VS MSFT`           | Side-by-side price comparison                          |
| `COMPARE AAPL MSFT NVDA` | Multi-ticker comparison table                          |
| `INDICES`                | Market overview (DOW, S&P 500, NASDAQ)                 |
| `/analyze NVDA`          | Full AI analysis — technicals, fundamentals, catalysts |
| `/technicals AAPL`       | RSI, MACD, SMA with interpretation                     |
| `/macro`                 | Fed, rates, inflation, sector rotation                 |
| `EXPLAIN P/E ratio`      | Plain-English definition of any finance term           |
| `HELP`                   | Full command reference                                 |


### Quarry Research (`/research`)

Start a conversation or upload a document (PDF, DOCX, TXT, MD, CSV — up to 10 MB). Quarry reads the file and answers questions against it. Sessions are saved automatically and accessible from the Sessions page.

([back to top](#readme-top))

---

## API Keys


| Key                  | Required | Used for                     | Where to get it                                 |
| -------------------- | -------- | ---------------------------- | ----------------------------------------------- |
| `OPENROUTER_API_KEY` | **Yes**  | All AI responses             | [openrouter.ai](https://openrouter.ai)          |
| `GNEWS_API_KEY`      | No       | News tab + trending articles | [gnews.io](https://gnews.io) — 100 req/day free |


Image search uses `og:image` extraction from DuckDuckGo results — no API key needed.

To change the default model (`openai/gpt-4o`), set `OPENROUTER_CHAT_MODEL` in `backend/.env` to any OpenRouter model ID — for example `anthropic/claude-sonnet-4.5`, `x-ai/grok-3`, or `google/gemini-2.0-flash-exp:free`.

([back to top](#readme-top))

---

## Roadmap

- Streaming search-augmented generation with inline citations
- Contradiction detection across sources
- Finance terminal with QFL command parser
- Multi-turn research assistant with file upload
- Live ESPN scores injection for sports queries
- Academic paper outline generator
- Session persistence for research conversations
- User accounts and cloud sync
- PDF export for research sessions
- Custom watchlist persistence across devices
- Voice input

See [open issues](https://github.com/A-Kumar14/quarry/issues) for proposed features and known bugs.

([back to top](#readme-top))

---

## Contact

**A-Kumar14** — [github.com/A-Kumar14](https://github.com/A-Kumar14)

Project link: [https://github.com/A-Kumar14/quarry](https://github.com/A-Kumar14/quarry)

([back to top](#readme-top))

---

