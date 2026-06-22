# Railway dashboard checklist

Complete these steps in [railway.com](https://railway.com) after `railway login` (interactive — run in your terminal).

## Quarry backend

1. **Project** → `quarry` → connect `A-Kumar14/quarry` (root directory: repo root).
2. **Service** → uses `Dockerfile` + `railway.toml`, health check `/health`.
3. **Variables** → set:
   - `OPENROUTER_API_KEY`
   - `CORS_ORIGINS` = `https://quarry-one.vercel.app`
   - `JWT_SECRET` = output of `python3 -c "import secrets; print(secrets.token_hex(32))"`
4. **Volumes** → mount at `/app/data`.
5. **Deploy** → trigger redeploy; copy the public URL (e.g. `https://….up.railway.app`).
6. **Vercel** → update `REACT_APP_API_URL` to that URL if it changed, then redeploy frontend.

Or run: `./scripts/railway-setup.sh` (after `railway link` in the quarry repo).

Verify: `curl -s https://<railway-url>/health` → `200`

## Engel backend

1. **Project** → `engel` → connect `A-Kumar14/engel`.
2. **Add Postgres** plugin.
3. **Web service** → root directory: `backend`, health check `/api/health`.
4. **Variables** → reference `DATABASE_URL` from Postgres; set:
   - `CORS_ORIGINS` = `https://a-kumar14.github.io,http://127.0.0.1:8080,http://localhost:8080`
   - `WAITLIST_SUCCESS_URL` = `https://a-kumar14.github.io/engel/confirmed.html`
   - `PUBLIC_API_BASE_URL` = your Railway public URL (no trailing slash)
   - `RESEND_API_KEY`, `WAITLIST_FROM_EMAIL`, `ENV=prod`
5. **Deploy** → verify `curl https://<url>/api/health`.

Or run: `./scripts/railway-setup.sh` in the engel repo (after `railway link`).

### Migrate data from Render (optional)

```bash
pg_dump "$RENDER_DATABASE_URL" --no-owner --no-acl -f engel_backup.sql
psql "$RAILWAY_DATABASE_URL" -f engel_backup.sql
```

Then delete Render `engel-api` and `engel-db`.

## RK-main

No Railway setup. Keep on **Vercel**; delete Render `rising-kashmir` if still running.

## Portfolio

No Railway setup. Stays on **GitHub Pages**.
