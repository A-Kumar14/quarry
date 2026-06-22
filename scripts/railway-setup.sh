#!/usr/bin/env bash
# Quarry — Railway backend setup (run after: railway login && railway link)
set -euo pipefail

echo "Quarry Railway setup"
echo "===================="
echo ""
echo "1. In Railway dashboard: create project 'quarry', connect github.com/A-Kumar14/quarry"
echo "2. Service uses repo root Dockerfile + railway.toml"
echo "3. Add volume mounted at /app/data"
echo "4. Set variables below (railway variables set ...)"
echo ""

if ! railway whoami &>/dev/null; then
  echo "Run: railway login"
  exit 1
fi

read -rsp "OPENROUTER_API_KEY: " OPENROUTER_API_KEY; echo
JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")

railway variables set \
  "OPENROUTER_API_KEY=${OPENROUTER_API_KEY}" \
  "CORS_ORIGINS=https://quarry-one.vercel.app" \
  "JWT_SECRET=${JWT_SECRET}"

echo ""
echo "Optional: railway variables set GNEWS_API_KEY=..."
echo "Deploy: git push origin main (or railway up)"
echo "Then set Vercel REACT_APP_API_URL to your Railway public URL and redeploy frontend."
