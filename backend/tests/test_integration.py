"""
test_integration.py — End-to-end SAG pipeline test with mocked external calls.

Only real network calls (DuckDuckGo, trafilatura, LLM provider) are mocked.
Everything else — routing, SSE formatting, context building, prompt assembly — runs for real.
"""

import pytest
from unittest.mock import MagicMock


# ── Fake external data ────────────────────────────────────────────────────────

FAKE_SEARCH_RESULTS = [
    {"title": "Result 1", "url": "https://source1.com", "snippet": "Snippet about the topic."},
    {"title": "Result 2", "url": "https://source2.com", "snippet": "More details here."},
    {"title": "Result 3", "url": "https://source3.com", "snippet": "A third perspective."},
]

FAKE_SCRAPED = [
    {"url": "https://source1.com", "markdown": "# Topic\nThis is the scraped content."},
]

FAKE_LLM_TOKENS = ["The ", "answer ", "is ", "here."]


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def full_pipeline_mocks(monkeypatch):
    """
    Patch all external calls for the SAG pipeline using monkeypatch so that
    teardown is automatic.  stream_sync uses side_effect (not return_value) so
    each call to the mock gets a fresh iterator — not the same exhausted one.

    Also clears the rate-limit storage so earlier test files' quota usage
    doesn't cause 429s in these integration tests.
    """
    from unittest.mock import MagicMock
    import services.search_service as ss
    import services.registry as reg
    import routers.explore as explore_mod

    try:
        explore_mod.limiter._storage.storage.clear()
    except AttributeError:
        pass

    # Clear per-query-hash rate limit windows so tests don't bleed into each other.
    explore_mod._query_windows.clear()

    mock_search = MagicMock(return_value=FAKE_SEARCH_RESULTS)
    mock_scrape = MagicMock(return_value=FAKE_SCRAPED)
    mock_scores = MagicMock(return_value="")
    mock_llm    = MagicMock(side_effect=lambda *a, **kw: iter(FAKE_LLM_TOKENS))

    monkeypatch.setattr(ss,               "web_search",       mock_search)
    monkeypatch.setattr(ss,               "scrape_urls",      mock_scrape)
    monkeypatch.setattr(ss,               "fetch_live_scores", mock_scores)
    monkeypatch.setattr(reg.llm_service,  "stream_sync",      mock_llm)

    yield {
        "search": mock_search,
        "scrape": mock_scrape,
        "scores": mock_scores,
        "llm":    mock_llm,
    }


# ── Integration tests ─────────────────────────────────────────────────────────

def test_pipeline_returns_200(client, full_pipeline_mocks):
    resp = client.post("/explore/search", json={"query": "who won the 2024 election"})
    assert resp.status_code == 200


def test_pipeline_media_type_is_event_stream(client, full_pipeline_mocks):
    resp = client.post("/explore/search", json={"query": "who won the 2024 election"})
    assert "text/event-stream" in resp.headers["content-type"]


def test_pipeline_stream_has_sources_event(client, full_pipeline_mocks, parse_sse):
    resp = client.post("/explore/search", json={"query": "who won the 2024 election"})
    events = parse_sse(resp.text)

    source_events = [e for e in events if isinstance(e, dict) and e.get("type") == "sources"]
    assert len(source_events) == 1


def test_pipeline_sources_event_has_3_entries(client, full_pipeline_mocks, parse_sse):
    resp = client.post("/explore/search", json={"query": "who won the 2024 election"})
    events = parse_sse(resp.text)

    sources_evt = next(e for e in events if isinstance(e, dict) and e.get("type") == "sources")
    assert len(sources_evt["sources"]) == 3


def test_pipeline_sources_have_required_fields(client, full_pipeline_mocks, parse_sse):
    resp = client.post("/explore/search", json={"query": "who won the 2024 election"})
    events = parse_sse(resp.text)

    sources_evt = next(e for e in events if isinstance(e, dict) and e.get("type") == "sources")
    for src in sources_evt["sources"]:
        assert "title"   in src
        assert "url"     in src
        assert "snippet" in src
        assert "favicon" in src


def test_pipeline_sources_favicon_is_google_url(client, full_pipeline_mocks, parse_sse):
    resp = client.post("/explore/search", json={"query": "test"})
    events = parse_sse(resp.text)

    sources_evt = next(e for e in events if isinstance(e, dict) and e.get("type") == "sources")
    for src in sources_evt["sources"]:
        assert "google.com/s2/favicons" in src["favicon"]


def test_pipeline_stream_has_chunk_events(client, full_pipeline_mocks, parse_sse):
    resp = client.post("/explore/search", json={"query": "who won the 2024 election"})
    events = parse_sse(resp.text)

    chunk_events = [e for e in events if isinstance(e, dict) and e.get("type") == "chunk"]
    assert len(chunk_events) >= 1


def test_pipeline_chunk_text_matches_llm_output(client, full_pipeline_mocks, parse_sse):
    resp = client.post("/explore/search", json={"query": "who won the 2024 election"})
    events = parse_sse(resp.text)

    chunk_events = [e for e in events if isinstance(e, dict) and e.get("type") == "chunk"]
    combined_text = "".join(e["text"] for e in chunk_events)
    assert combined_text == "".join(FAKE_LLM_TOKENS)


def test_pipeline_stream_ends_with_done(client, full_pipeline_mocks, parse_sse):
    resp = client.post("/explore/search", json={"query": "who won the 2024 election"})
    events = parse_sse(resp.text)

    assert events[-1] == "[DONE]"


def test_pipeline_web_search_called_once(client, full_pipeline_mocks):
    client.post("/explore/search", json={"query": "who won the 2024 election"})
    full_pipeline_mocks["search"].assert_called_once()


def test_pipeline_scrape_called_with_urls(client, full_pipeline_mocks):
    client.post("/explore/search", json={"query": "who won the 2024 election"})
    scrape_mock = full_pipeline_mocks["scrape"]
    scrape_mock.assert_called_once()

    called_urls = scrape_mock.call_args[0][0]
    assert "https://source1.com" in called_urls
    assert "https://source2.com" in called_urls


def test_pipeline_llm_called_with_system_and_user_messages(client, full_pipeline_mocks):
    client.post("/explore/search", json={"query": "who won the 2024 election"})
    llm_mock = full_pipeline_mocks["llm"]
    llm_mock.assert_called_once()

    messages = llm_mock.call_args[0][0]
    roles = [m["role"] for m in messages]
    assert "system" in roles
    assert "user"   in roles


def test_pipeline_system_prompt_contains_context(client, full_pipeline_mocks):
    client.post("/explore/search", json={"query": "who won the 2024 election"})
    messages = full_pipeline_mocks["llm"].call_args[0][0]

    system_content = next(m["content"] for m in messages if m["role"] == "system")
    # Scraped content from source1 should be injected
    assert "scraped content" in system_content


def test_pipeline_user_message_contains_query(client, full_pipeline_mocks):
    client.post("/explore/search", json={"query": "who won the 2024 election"})
    messages = full_pipeline_mocks["llm"].call_args[0][0]

    user_content = next(m["content"] for m in messages if m["role"] == "user")
    assert "2024 election" in user_content


def test_pipeline_no_real_network_calls(client, full_pipeline_mocks):
    """Assert that all external calls were intercepted — no real I/O."""
    client.post("/explore/search", json={"query": "who won the 2024 election"})

    # Each mock was called (meaning our code reached them, not real services)
    assert full_pipeline_mocks["search"].call_count >= 1
    assert full_pipeline_mocks["scrape"].call_count  >= 1
    assert full_pipeline_mocks["llm"].call_count     >= 1
