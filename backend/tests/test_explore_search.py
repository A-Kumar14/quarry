"""
test_explore_search.py — Tests for POST /explore/search (SSE endpoint).
"""

import json
import pytest


# ── Helpers ───────────────────────────────────────────────────────────────────

def _post_search(client, payload):
    return client.post("/explore/search", json=payload)


# ── Happy path ────────────────────────────────────────────────────────────────

def test_search_returns_200(client, fake_sse_stream, monkeypatch):
    from services.registry import ai_service
    monkeypatch.setattr(ai_service, "explore_the_web", fake_sse_stream)

    response = _post_search(client, {"query": "test query"})
    assert response.status_code == 200


def test_search_media_type_is_event_stream(client, fake_sse_stream, monkeypatch):
    from services.registry import ai_service
    monkeypatch.setattr(ai_service, "explore_the_web", fake_sse_stream)

    response = _post_search(client, {"query": "test query"})
    assert "text/event-stream" in response.headers["content-type"]


def test_search_stream_contains_sources_event(client, fake_sse_stream, monkeypatch, parse_sse):
    from services.registry import ai_service
    monkeypatch.setattr(ai_service, "explore_the_web", fake_sse_stream)

    response = _post_search(client, {"query": "test query"})
    events = parse_sse(response.text)

    source_events = [e for e in events if isinstance(e, dict) and e.get("type") == "sources"]
    assert len(source_events) >= 1
    assert isinstance(source_events[0]["sources"], list)


def test_search_stream_contains_chunk_event(client, fake_sse_stream, monkeypatch, parse_sse):
    from services.registry import ai_service
    monkeypatch.setattr(ai_service, "explore_the_web", fake_sse_stream)

    response = _post_search(client, {"query": "test query"})
    events = parse_sse(response.text)

    chunk_events = [e for e in events if isinstance(e, dict) and e.get("type") == "chunk"]
    assert len(chunk_events) >= 1
    assert chunk_events[0]["text"] == "Hello world"


def test_search_stream_ends_with_done(client, fake_sse_stream, monkeypatch, parse_sse):
    from services.registry import ai_service
    monkeypatch.setattr(ai_service, "explore_the_web", fake_sse_stream)

    response = _post_search(client, {"query": "test query"})
    events = parse_sse(response.text)

    assert events[-1] == "[DONE]"


# ── Follow-up context prepending ──────────────────────────────────────────────

def test_followup_prepends_context(client, monkeypatch, parse_sse):
    """When context is provided, the query sent to explore_the_web should be prefixed."""
    from services.registry import ai_service

    received_queries = []

    def capturing_stream(query: str):
        received_queries.append(query)
        yield 'data: {"type": "chunk", "text": "ok"}\n\n'
        yield "data: [DONE]\n\n"

    monkeypatch.setattr(ai_service, "explore_the_web", capturing_stream)

    _post_search(client, {"query": "more info", "context": "original topic"})

    assert len(received_queries) == 1
    assert received_queries[0].startswith('Follow-up on "original topic":')
    assert "more info" in received_queries[0]


def test_no_context_sends_query_as_is(client, monkeypatch):
    from services.registry import ai_service

    received_queries = []

    def capturing_stream(query: str):
        received_queries.append(query)
        yield "data: [DONE]\n\n"

    monkeypatch.setattr(ai_service, "explore_the_web", capturing_stream)

    _post_search(client, {"query": "standalone query"})
    assert received_queries[0] == "standalone query"


# ── Validation errors ─────────────────────────────────────────────────────────

def test_search_missing_query_field_returns_422(client):
    response = _post_search(client, {"context": "no query here"})
    assert response.status_code == 422


def test_search_query_too_long_returns_422(client):
    response = _post_search(client, {"query": "x" * 501})
    assert response.status_code == 422


def test_search_query_exactly_500_chars_is_valid(client, fake_sse_stream, monkeypatch):
    from services.registry import ai_service
    monkeypatch.setattr(ai_service, "explore_the_web", fake_sse_stream)

    response = _post_search(client, {"query": "a" * 500})
    assert response.status_code == 200


def test_search_context_too_long_returns_422(client):
    response = _post_search(client, {"query": "ok", "context": "x" * 501})
    assert response.status_code == 422


# ── Service error handling ────────────────────────────────────────────────────

def test_search_service_exception_yields_error_event(client, monkeypatch, parse_sse):
    """When explore_the_web raises, the stream should yield an error SSE event."""
    from services.registry import ai_service

    def exploding_stream(query: str):
        raise RuntimeError("upstream service down")
        yield  # make it a generator

    monkeypatch.setattr(ai_service, "explore_the_web", exploding_stream)

    response = _post_search(client, {"query": "test"})
    assert response.status_code == 200  # stream always opens with 200

    events = parse_sse(response.text)
    error_events = [e for e in events if isinstance(e, dict) and e.get("type") == "error"]
    assert len(error_events) >= 1
    # Raw exception text must NOT leak; only a generic message is returned.
    assert "upstream service down" not in error_events[0]["text"]
    assert error_events[0]["text"] != ""


def test_search_mid_stream_exception_yields_error_event(client, monkeypatch, parse_sse):
    """Exception raised partway through the generator is also caught."""
    from services.registry import ai_service

    def mid_explode(query: str):
        yield 'data: {"type": "chunk", "text": "partial"}\n\n'
        raise ValueError("mid-stream failure")

    monkeypatch.setattr(ai_service, "explore_the_web", mid_explode)

    response = _post_search(client, {"query": "test"})
    events = parse_sse(response.text)

    error_events = [e for e in events if isinstance(e, dict) and e.get("type") == "error"]
    assert len(error_events) >= 1
    # Raw exception text must NOT leak; only a generic message is returned.
    assert "mid-stream failure" not in error_events[0]["text"]
    assert error_events[0]["text"] != ""
