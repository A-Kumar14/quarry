"""
test_rate_limiting.py — Verify slowapi rate limits on the explore endpoints.

Each test uses `unique_rl_key` which patches the limiter's key_func to return
a unique string, giving each test its own fresh counter.
"""

import pytest


def _mini_stream(query: str):
    """Minimal SSE generator used to keep search requests cheap in rate limit tests."""
    yield "data: [DONE]\n\n"


def _mock_images(q, page=0):
    return []


# ── Search endpoint — 15/minute ───────────────────────────────────────────────

def test_search_rate_limit_15_requests_succeed(client, unique_rl_key, monkeypatch):
    from services.registry import ai_service
    monkeypatch.setattr(ai_service, "explore_the_web", _mini_stream)

    for i in range(15):
        resp = client.post("/explore/search", json={"query": f"query {i}"})
        assert resp.status_code == 200, f"Request {i + 1} should succeed, got {resp.status_code}"


def test_search_rate_limit_16th_returns_429(client, unique_rl_key, monkeypatch):
    from services.registry import ai_service
    monkeypatch.setattr(ai_service, "explore_the_web", _mini_stream)

    for _ in range(15):
        client.post("/explore/search", json={"query": "ok"})

    resp = client.post("/explore/search", json={"query": "over limit"})
    assert resp.status_code == 429


def test_search_rate_limit_error_body(client, unique_rl_key, monkeypatch):
    """429 response should be a JSON body with an error detail."""
    from services.registry import ai_service
    monkeypatch.setattr(ai_service, "explore_the_web", _mini_stream)

    for _ in range(15):
        client.post("/explore/search", json={"query": "ok"})

    resp = client.post("/explore/search", json={"query": "over limit"})
    assert resp.status_code == 429
    body = resp.json()
    # slowapi returns {"error": "..."} or {"detail": "..."}
    assert "error" in body or "detail" in body


# ── Images endpoint — 30/minute ───────────────────────────────────────────────

def test_images_rate_limit_30_requests_succeed(client, unique_rl_key, monkeypatch):
    from services import image_service
    monkeypatch.setattr(image_service, "search_images", _mock_images)

    for i in range(30):
        resp = client.get(f"/explore/images?q=dogs&page={i % 5}")
        assert resp.status_code == 200, f"Request {i + 1} should succeed, got {resp.status_code}"


def test_images_rate_limit_31st_returns_429(client, unique_rl_key, monkeypatch):
    from services import image_service
    monkeypatch.setattr(image_service, "search_images", _mock_images)

    for _ in range(30):
        client.get("/explore/images?q=dogs")

    resp = client.get("/explore/images?q=dogs")
    assert resp.status_code == 429


# ── Key isolation — different tests don't share counters ──────────────────────

def test_rate_limit_keys_are_isolated(client, unique_rl_key, monkeypatch):
    """Each test gets a fresh counter; 1 request should always succeed."""
    from services.registry import ai_service
    monkeypatch.setattr(ai_service, "explore_the_web", _mini_stream)

    resp = client.post("/explore/search", json={"query": "first request in fresh bucket"})
    assert resp.status_code == 200
