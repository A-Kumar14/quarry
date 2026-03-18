"""
conftest.py — Shared fixtures for the Quarry backend test suite.

Env vars are set BEFORE the app is imported so that LLMService._detect_provider()
sees them at module-load time (it reads os.getenv at import, not lazily).
"""

import json
import os
import sys

import pytest

# ── Set test env vars before any app import ───────────────────────────────────
os.environ.setdefault("OPENROUTER_API_KEY", "test-key-xxxxxxxxxxxxxxxx")
os.environ.setdefault("AI_PROVIDER", "openrouter")
os.environ.setdefault("SCRAPINGBEE_API_KEY", "test-scrapingbee-key")
os.environ.setdefault("GNEWS_API_KEY", "test-gnews-key")

# Ensure backend/ directory is on sys.path so bare imports (main, services…) resolve.
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

# ── App fixture ───────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def app():
    from main import app as _app
    return _app


@pytest.fixture
def client(app):
    from fastapi.testclient import TestClient
    with TestClient(app) as c:
        yield c


# ── SSE helpers exposed as fixtures ──────────────────────────────────────────

@pytest.fixture
def parse_sse():
    """Return a function that parses raw SSE text into a list of events."""
    def _parse(text: str) -> list:
        events = []
        for line in text.splitlines():
            line = line.strip()
            if not line.startswith("data: "):
                continue
            payload = line[6:]
            if payload == "[DONE]":
                events.append("[DONE]")
            else:
                try:
                    events.append(json.loads(payload))
                except json.JSONDecodeError:
                    pass
        return events
    return _parse


@pytest.fixture
def fake_sse_stream():
    """Return a generator factory that mimics ai_service.explore_the_web output."""
    def _gen(query: str):
        yield (
            'data: {"type": "sources", "sources": ['
            '{"title": "Example", "url": "https://example.com", '
            '"snippet": "A snippet", "favicon": ""}]}\n\n'
        )
        yield 'data: {"type": "chunk", "text": "Hello world"}\n\n'
        yield "data: [DONE]\n\n"
    return _gen


# ── Rate-limit isolation fixture ──────────────────────────────────────────────

@pytest.fixture
def unique_rl_key(monkeypatch):
    """
    Give each test its own rate-limit key so counters don't bleed between tests.
    Patches the key_func on the router-level limiter, which is what slowapi uses
    for the actual counter checking.  Also clears the backing storage so previous
    test traffic (under any key) can't hit the 429 threshold prematurely.
    """
    import uuid
    import routers.explore as explore_mod

    # Wipe the in-memory counter store before each rate-limit test.
    try:
        explore_mod.limiter._storage.storage.clear()
    except AttributeError:
        pass

    key = f"test-ip-{uuid.uuid4().hex}"
    monkeypatch.setattr(explore_mod.limiter, "_key_func", lambda _: key)
    return key
