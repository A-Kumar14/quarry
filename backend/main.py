"""
main.py — Ask API entry point.
"""

import logging
import os

from dotenv import load_dotenv

load_dotenv(dotenv_path=".env") or load_dotenv(dotenv_path=".env.example")

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.middleware.base import BaseHTTPMiddleware

from routers import explore
from routers.sources import router as sources_router
from routers.auth import router as auth_router

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="Ask API", version="1.0.0")
app.response_class = JSONResponse

# pytest-flask compatibility shims
# The test suite uses `pytest-flask`, which expects a Flask-like interface
# on the injected `app` fixture. Quarry is a FastAPI app, so we provide the
# minimal attributes/methods needed for the plugin to push/pop a context.
if not hasattr(app, "config"):
    app.config = {}

if not hasattr(app, "test_request_context"):
    def _test_request_context(*_args, **_kwargs):
        class _DummyCtx:
            def push(self_inner):  # noqa: N802
                return None
            def pop(self_inner):  # noqa: N802
                return None
        return _DummyCtx()
    app.test_request_context = _test_request_context

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# ── Security headers middleware ────────────────────────────────────────────────

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        response.headers["Cache-Control"] = "no-store"
        return response


app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── JWT auth middleware ────────────────────────────────────────────────────────
# Protects all routes except /auth/*, /health, and /docs* (OpenAPI).
# Auth is SKIPPED entirely if JWT_SECRET is not set (preserves test compatibility).
# If DEV_BYPASS_TOKEN is set, a request bearing that exact token is always allowed.

_UNPROTECTED = {"/health", "/docs", "/openapi.json", "/redoc"}
# Paths where the prefix alone is enough to exempt the request
_UNPROTECTED_PREFIXES = ("/explore/img-proxy",)

class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        from services.auth_service import (
            is_auth_enabled, _dev_bypass_token, get_user_from_token
        )
        path = request.url.path

        # Always allow auth endpoints, public routes, CORS preflight, and when auth is off
        if (
            not is_auth_enabled()
            or request.method == "OPTIONS"
            or path.startswith("/auth")
            or path in _UNPROTECTED
            or any(path.startswith(p) for p in _UNPROTECTED_PREFIXES)
        ):
            return await call_next(request)

        token = None
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]

        if not token:
            return JSONResponse(status_code=401, content={"detail": "Not authenticated"})

        # Dev bypass: exact match against DEV_BYPASS_TOKEN env var
        dev_bypass = _dev_bypass_token()
        if dev_bypass and token == dev_bypass:
            return await call_next(request)

        user = get_user_from_token(token)
        if not user:
            return JSONResponse(status_code=401, content={"detail": "Invalid or expired token"})

        return await call_next(request)

app.add_middleware(AuthMiddleware)

app.include_router(explore.router)
app.include_router(sources_router)
app.include_router(auth_router)


# ── Generic exception handler (prevents API key / traceback leakage) ──────────

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error("unhandled exception path=%s error=%s", request.url.path, exc, exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
