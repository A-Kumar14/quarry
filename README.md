<a id="readme-top"></a>

[![Issues][issues-shield]][issues-url]
[![MIT License][license-shield]][license-url]

<br />
<div align="center">
  <h1 align="center">Quarry</h1>
  <p align="center">
    An AI-powered research and finance platform — search the web, synthesise sources, cite with confidence.
    <br />
    <a href="https://github.com/A-Kumar14/quarry/blob/main/CONTEXT/ARCHITECTURE.md"><strong>Read the architecture docs »</strong></a>
    <br />
    <br />
    <a href="https://github.com/A-Kumar14/quarry/issues/new?labels=bug">Report Bug</a>
    &middot;
    <a href="https://github.com/A-Kumar14/quarry/issues/new?labels=enhancement">Request Feature</a>
  </p>
</div>

---

<details>
  <summary>Table of Contents</summary>
  <ol>
    <li><a href="#about">About</a></li>
    <li><a href="#built-with">Built With</a></li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#api-keys">API Keys</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
  </ol>
</details>

---

## About

Quarry is a full-stack AI research platform with three surfaces:

**Quarry Search** — type any question and get a live, streamed answer synthesised from real web sources. Every claim is cited inline with `[1]`, `[2]` references that link back to the original pages. A contradiction detector runs in the background and flags any sources that disagree on the facts.

**Quarry Research** — a multi-turn research assistant built for deep work. Upload PDFs, Word docs, or text files and ask questions against them. Quarry handles session persistence, so you can close the tab and pick up where you left off.

**Finance Terminal** — a command-driven market terminal powered by QFL (Quarry Finance Language). Type `AAPL`, `COMPARE AAPL MSFT NVDA`, `/analyze NVDA`, or plain English and get live prices, sparklines, charts, and AI analysis.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

## Built With

[![React][React-badge]][React-url]
[![FastAPI][FastAPI-badge]][FastAPI-url]
[![OpenRouter][OpenRouter-badge]][OpenRouter-url]
[![MUI][MUI-badge]][MUI-url]
[![TailwindCSS][Tailwind-badge]][Tailwind-url]
[![Python][Python-badge]][Python-url]

<p align="right">(<a href="#readme-top">back to top</a>)</p>

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
   ```
   OPENROUTER_API_KEY=sk-or-...
   GNEWS_API_KEY=...                  # optional
   ```

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
   ```sh
   chmod +x dev.sh && ./dev.sh
   ```

   Or manually in two separate terminals:
   ```sh
   # Terminal 1 — backend
   cd backend && uvicorn main:app --reload --port 8000

   # Terminal 2 — frontend
   cd frontend && npm start
   ```

   Open **http://localhost:3000** in your browser.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

## Usage

### Quarry Search (`/`)

Type any question and press Enter. Results stream in real time with inline source citations. Use the tabs to switch between the Answer, Citations, Contradictions, Perspectives, Images, and News views.

For follow-up questions, keep typing — each follow-up is aware of the original query and previous answers. Toggle **Deep Mode** next to the search bar for a more thorough two-pass analysis on complex topics.

### Finance Terminal (`/finance`)

The terminal accepts QFL commands or plain English:

| Command | What it does |
|---|---|
| `AAPL` | Live quote + sparkline for a single ticker |
| `AAPL VS MSFT` | Side-by-side price comparison |
| `COMPARE AAPL MSFT NVDA` | Multi-ticker comparison table |
| `INDICES` | Market overview (DOW, S&P 500, NASDAQ) |
| `/analyze NVDA` | Full AI analysis — technicals, fundamentals, catalysts |
| `/technicals AAPL` | RSI, MACD, SMA with interpretation |
| `/macro` | Fed, rates, inflation, sector rotation |
| `EXPLAIN P/E ratio` | Plain-English definition of any finance term |
| `HELP` | Full command reference |

### Quarry Research (`/research`)

Start a conversation or upload a document (PDF, DOCX, TXT, MD, CSV — up to 10 MB). Quarry reads the file and answers questions against it. Sessions are saved automatically and accessible from the Sessions page.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

## API Keys

| Key | Required | Used for | Where to get it |
|---|---|---|---|
| `OPENROUTER_API_KEY` | **Yes** | All AI responses | [openrouter.ai](https://openrouter.ai) |
| `GNEWS_API_KEY` | No | News tab + trending articles | [gnews.io](https://gnews.io) — 100 req/day free |

Image search uses `og:image` extraction from DuckDuckGo results — no API key needed.

To change the default model (`openai/gpt-4o`), set `OPENROUTER_CHAT_MODEL` in `backend/.env` to any OpenRouter model ID — for example `anthropic/claude-sonnet-4.5`, `x-ai/grok-3`, or `google/gemini-2.0-flash-exp:free`.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

## Roadmap

- [x] Streaming search-augmented generation with inline citations
- [x] Contradiction detection across sources
- [x] Finance terminal with QFL command parser
- [x] Multi-turn research assistant with file upload
- [x] Live ESPN scores injection for sports queries
- [x] Academic paper outline generator
- [x] Session persistence for research conversations
- [ ] User accounts and cloud sync
- [ ] PDF export for research sessions
- [ ] Custom watchlist persistence across devices
- [ ] Voice input

See [open issues](https://github.com/A-Kumar14/quarry/issues) for proposed features and known bugs.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

## License

Distributed under the MIT License.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

## Contact

**A-Kumar14** — [github.com/A-Kumar14](https://github.com/A-Kumar14)

Project link: [https://github.com/A-Kumar14/quarry](https://github.com/A-Kumar14/quarry)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

<!-- MARKDOWN LINKS & BADGES -->
[issues-shield]: https://img.shields.io/github/issues/A-Kumar14/quarry.svg?style=for-the-badge
[issues-url]: https://github.com/A-Kumar14/quarry/issues
[license-shield]: https://img.shields.io/badge/license-MIT-green.svg?style=for-the-badge
[license-url]: https://github.com/A-Kumar14/quarry/blob/main/LICENSE

[React-badge]: https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB
[React-url]: https://reactjs.org/
[FastAPI-badge]: https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white
[FastAPI-url]: https://fastapi.tiangolo.com/
[OpenRouter-badge]: https://img.shields.io/badge/OpenRouter-6B21A8?style=for-the-badge&logo=openai&logoColor=white
[OpenRouter-url]: https://openrouter.ai/
[MUI-badge]: https://img.shields.io/badge/MUI_v7-007FFF?style=for-the-badge&logo=mui&logoColor=white
[MUI-url]: https://mui.com/
[Tailwind-badge]: https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white
[Tailwind-url]: https://tailwindcss.com/
[Python-badge]: https://img.shields.io/badge/Python_3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white
[Python-url]: https://python.org/
