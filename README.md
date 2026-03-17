# Ask

Web search + AI reasoning with inline citations and a knowledge graph.
Extracted from FileGeek's Explore feature.

## Stack

- **Frontend**: React 19, react-scripts (CRA), MUI 7, react-force-graph-2d
- **Backend**: FastAPI, DuckDuckGo search, trafilatura scraping, OpenAI/OpenRouter/Gemini streaming

## Quick start

### 1. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # add your API key
python main.py                # runs on http://localhost:8000
```

### 2. Frontend

```bash
cd frontend
echo "REACT_APP_API_URL=http://localhost:8000" > .env
npm install
npm start                     # runs on http://localhost:3000
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | Yes (or OpenAI/Gemini) | API key for OpenRouter |
| `OPENAI_API_KEY` | Alt | Direct OpenAI key |
| `GOOGLE_API_KEY` | Alt | Gemini key |
| `AI_PROVIDER` | No | Force provider: `openrouter`, `openai`, `gemini` |
| `OPENROUTER_CHAT_MODEL` | No | Override model (default: `openai/gpt-4o`) |
| `REACT_APP_API_URL` | No | Backend URL (default: `http://localhost:8000`) |

## Production

```bash
# Backend
gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app

# Frontend
npm run build   # outputs to frontend/build/
```
