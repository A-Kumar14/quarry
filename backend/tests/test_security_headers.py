"""
test_security_headers.py — Tests for security headers middleware and
the generic exception handler that prevents API key leakage.
"""

import pytest


# ── Security headers ──────────────────────────────────────────────────────────

def test_x_content_type_options_on_health(client):
    resp = client.get("/health")
    assert resp.headers.get("x-content-type-options") == "nosniff"


def test_x_frame_options_on_health(client):
    resp = client.get("/health")
    assert resp.headers.get("x-frame-options") == "DENY"


def test_referrer_policy_on_health(client):
    resp = client.get("/health")
    assert resp.headers.get("referrer-policy") == "no-referrer"


def test_permissions_policy_on_health(client):
    resp = client.get("/health")
    assert "permissions-policy" in resp.headers


def test_cache_control_no_store_on_health(client):
    resp = client.get("/health")
    assert "no-store" in resp.headers.get("cache-control", "")


def test_security_headers_on_images_endpoint(client, monkeypatch):
    from services import image_service
    monkeypatch.setattr(image_service, "search_images", lambda q, page=0: [])
    resp = client.get("/explore/images?q=cats")
    assert resp.headers.get("x-content-type-options") == "nosniff"
    assert resp.headers.get("x-frame-options") == "DENY"


# ── Error stream — no traceback / key leakage in SSE output ──────────────────
#
# The /explore/search endpoint always returns 200 with an SSE stream.
# Exceptions inside explore_the_web are caught and emitted as a generic
# SSE error event — the raw exception text must NOT appear in the response.

def test_error_stream_returns_200(client, monkeypatch):
    """Stream endpoint always returns 200; errors are embedded in the SSE stream."""
    from services.registry import ai_service

    def _boom(query):
        raise RuntimeError("OPENROUTER_API_KEY=sk-secret-key-1234567890")

    monkeypatch.setattr(ai_service, "explore_the_web", _boom)
    resp = client.post("/explore/search", json={"query": "trigger error"})
    assert resp.status_code == 200


def test_error_stream_does_not_leak_api_key(client, monkeypatch):
    """API keys in exception messages must not appear in the SSE output."""
    from services.registry import ai_service

    def _boom(query):
        raise RuntimeError("OPENROUTER_API_KEY=sk-secret-key-1234567890")

    monkeypatch.setattr(ai_service, "explore_the_web", _boom)
    resp = client.post("/explore/search", json={"query": "trigger error"})
    body = resp.text
    assert "sk-secret-key" not in body
    assert "OPENROUTER_API_KEY" not in body
    assert "Traceback" not in body


def test_error_stream_contains_generic_message(client, monkeypatch):
    """The SSE error event must contain only a safe, generic message."""
    import json
    from services.registry import ai_service

    def _boom(query):
        raise ValueError("internal detail that should not leak")

    monkeypatch.setattr(ai_service, "explore_the_web", _boom)
    resp = client.post("/explore/search", json={"query": "trigger error"})

    error_events = []
    for line in resp.text.splitlines():
        line = line.strip()
        if line.startswith("data: ") and line[6:] != "[DONE]":
            try:
                evt = json.loads(line[6:])
                if evt.get("type") == "error":
                    error_events.append(evt)
            except json.JSONDecodeError:
                pass

    assert len(error_events) == 1
    assert "internal detail" not in error_events[0]["text"]
    assert error_events[0]["text"] != ""
