"""
test_contradictions.py — Unit tests for AIService.detect_contradictions.
No real API calls are made; the LLM client is fully mocked.
"""

import json
import pytest
from unittest.mock import MagicMock
from services.ai_service import AIService


SOURCES = [
    {"title": "Source A", "url": "https://a.com", "snippet": "snippet A"},
    {"title": "Source B", "url": "https://b.com", "snippet": "snippet B"},
]

SCRAPED = [
    {"url": "https://a.com", "markdown": "Scraped content from A"},
    {"url": "https://b.com", "markdown": "Scraped content from B"},
]


@pytest.fixture
def svc():
    s = AIService()
    s._llm = MagicMock()
    return s


def _valid_response(contradictions=None, consensus="sources agree"):
    return json.dumps({
        "contradictions": contradictions or [
            {
                "topic": "date of event",
                "summary": "Sources disagree on the year.",
                "claims": [
                    {"source_index": 1, "source_title": "Source A", "claim": "It happened in 2019"},
                    {"source_index": 2, "source_title": "Source B", "claim": "It happened in 2021"},
                ],
            }
        ],
        "consensus": consensus,
    })


class TestDetectContradictions:

    def test_returns_contradictions_on_valid_json(self, svc):
        svc._llm.chat_sync.return_value = _valid_response()
        result = svc.detect_contradictions(SOURCES, SCRAPED)
        assert len(result["contradictions"]) == 1
        item = result["contradictions"][0]
        assert "topic" in item
        assert "summary" in item
        assert "claims" in item

    def test_returns_empty_on_no_contradictions(self, svc):
        svc._llm.chat_sync.return_value = json.dumps(
            {"contradictions": [], "consensus": "sources agree on basics"}
        )
        result = svc.detect_contradictions(SOURCES, SCRAPED)
        assert result["contradictions"] == []
        assert result["consensus"] == "sources agree on basics"

    def test_returns_error_shape_on_invalid_json(self, svc):
        svc._llm.chat_sync.return_value = "not json at all"
        result = svc.detect_contradictions(SOURCES, SCRAPED)
        assert result == {"contradictions": [], "consensus": "", "error": True}

    def test_returns_error_shape_on_missing_key(self, svc):
        svc._llm.chat_sync.return_value = json.dumps({"consensus": "ok"})
        result = svc.detect_contradictions(SOURCES, SCRAPED)
        assert result.get("error") is True

    def test_returns_error_shape_on_llm_exception(self, svc):
        svc._llm.chat_sync.side_effect = RuntimeError("timeout")
        result = svc.detect_contradictions(SOURCES, SCRAPED)
        assert result.get("error") is True

    def test_returns_empty_on_no_sources(self, svc):
        result = svc.detect_contradictions(sources=[], scraped=[])
        assert result["contradictions"] == []
        assert svc._llm.chat_sync.call_count == 0

    def test_uses_scraped_content_over_snippet(self, svc):
        svc._llm.chat_sync.return_value = _valid_response()
        svc.detect_contradictions(SOURCES, SCRAPED)
        _, kwargs = svc._llm.chat_sync.call_args
        user_msg = kwargs["messages"][1]["content"] if "messages" in kwargs else svc._llm.chat_sync.call_args[0][0][1]["content"]
        # Extract the user message regardless of positional/keyword calling
        call_messages = svc._llm.chat_sync.call_args[0][0] if svc._llm.chat_sync.call_args[0] else svc._llm.chat_sync.call_args[1]["messages"]
        user_content = next(m["content"] for m in call_messages if m["role"] == "user")
        assert "Scraped content from A" in user_content
        assert "snippet A" not in user_content

    def test_falls_back_to_snippet_when_no_scrape(self, svc):
        svc._llm.chat_sync.return_value = _valid_response()
        svc.detect_contradictions(SOURCES, scraped=[])
        call_messages = svc._llm.chat_sync.call_args[0][0]
        user_content = next(m["content"] for m in call_messages if m["role"] == "user")
        assert "snippet A" in user_content

    def test_truncates_user_message_at_12000_chars(self, svc):
        svc._llm.chat_sync.return_value = _valid_response()
        big_sources = [
            {"title": f"Source {i}", "url": f"https://s{i}.com", "snippet": "x" * 3000}
            for i in range(10)
        ]
        svc.detect_contradictions(big_sources, scraped=[])
        call_messages = svc._llm.chat_sync.call_args[0][0]
        user_content = next(m["content"] for m in call_messages if m["role"] == "user")
        assert len(user_content) <= 12000

    def test_strips_markdown_fences(self, svc):
        fenced = '```json\n{"contradictions": [], "consensus": ""}\n```'
        svc._llm.chat_sync.return_value = fenced
        result = svc.detect_contradictions(SOURCES, SCRAPED)
        assert "error" not in result
        assert result["contradictions"] == []
