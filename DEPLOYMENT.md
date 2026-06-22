# Quarry — Deployment

Split hosting: **Vercel** (frontend) + **Railway** (backend).

## Railway backend

| Setting | Value |
|---------|-------|
| Root directory | repo root |
| Builder | Dockerfile (`railway.toml`) |
| Health check | `/health` |
| Volume mount | `/app/data` (users, chat, ChromaDB) |

### Required variables (Railway dashboard)

| Variable | Example |
|----------|---------|
| `OPENROUTER_API_KEY` | `sk-or-v1-...` |
| `CORS_ORIGINS` | `https://quarry-one.vercel.app` |
| `JWT_SECRET` | `python3 -c "import secrets; print(secrets.token_hex(32))"` |

### Optional variables

- `GNEWS_API_KEY` — trending news
- `OPENROUTER_CHAT_MODEL` — default `openai/gpt-4o`
- `JWT_EXPIRE_DAYS` — default `30`

Do **not** set `REACT_APP_API_URL` on Railway — that is frontend-only.

### Volume

Without a volume at `/app/data`, redeploys wipe `users.json`, `conversations.json`, and `chroma/`.

1. Railway project → backend service → **Volumes**
2. Add volume, mount path: `/app/data`

## Vercel frontend

| Setting | Value |
|---------|-------|
| Root directory | `frontend` |
| Build | `CI=false npm run build` |
| Output | `build` |

### Required variables (Vercel dashboard)

| Variable | Value |
|----------|-------|
| `REACT_APP_API_URL` | `https://<your-railway-backend>.up.railway.app` |

Redeploy after changing `REACT_APP_*` (CRA bakes them at build time).

## Verification

```bash
curl -s https://<railway-backend>/health
curl -sI -X OPTIONS "https://<railway-backend>/explore/search" \
  -H "Origin: https://quarry-one.vercel.app" \
  -H "Access-Control-Request-Method: POST"
```
