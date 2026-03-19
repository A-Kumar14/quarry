"""
test_chat_sync.py — Unit tests for LLMService.chat_sync.
No real API calls are made; SDK clients are fully mocked.
"""

import pytest
from unittest.mock import MagicMock
from services.llm import LLMService


MESSAGES = [{"role": "user", "content": "Hello"}]


def _make_response(content: str | None) -> MagicMock:
    response = MagicMock()
    response.choices[0].message.content = content
    return response


def _make_client(content: str | None = "hello") -> MagicMock:
    client = MagicMock()
    client.chat.completions.create.return_value = _make_response(content)
    return client


@pytest.fixture
def svc() -> LLMService:
    s = LLMService()
    s._provider = "openrouter"
    return s


class TestChatSync:

    def test_chat_sync_calls_openai_create(self, svc, monkeypatch):
        client = _make_client("hello")
        monkeypatch.setattr(svc, "_get_sync_client", lambda: client)
        result = svc.chat_sync(MESSAGES)
        assert result == "hello"

    def test_chat_sync_passes_messages(self, svc, monkeypatch):
        client = _make_client()
        monkeypatch.setattr(svc, "_get_sync_client", lambda: client)
        svc.chat_sync(MESSAGES)
        _, kwargs = client.chat.completions.create.call_args
        assert kwargs["messages"] == MESSAGES

    def test_chat_sync_stream_false(self, svc, monkeypatch):
        client = _make_client()
        monkeypatch.setattr(svc, "_get_sync_client", lambda: client)
        svc.chat_sync(MESSAGES)
        _, kwargs = client.chat.completions.create.call_args
        assert kwargs["stream"] is False

    def test_chat_sync_timeout_passed(self, svc, monkeypatch):
        client = _make_client()
        monkeypatch.setattr(svc, "_get_sync_client", lambda: client)
        svc.chat_sync(MESSAGES)
        _, kwargs = client.chat.completions.create.call_args
        assert kwargs["timeout"] == 15

    def test_chat_sync_custom_timeout(self, svc, monkeypatch):
        client = _make_client()
        monkeypatch.setattr(svc, "_get_sync_client", lambda: client)
        svc.chat_sync(MESSAGES, timeout=5)
        _, kwargs = client.chat.completions.create.call_args
        assert kwargs["timeout"] == 5

    def test_chat_sync_empty_content_returns_empty_string(self, svc, monkeypatch):
        client = _make_client(None)
        monkeypatch.setattr(svc, "_get_sync_client", lambda: client)
        result = svc.chat_sync(MESSAGES)
        assert result == ""

    def test_chat_sync_propagates_exception(self, svc, monkeypatch):
        client = MagicMock()
        client.chat.completions.create.side_effect = RuntimeError("api down")
        monkeypatch.setattr(svc, "_get_sync_client", lambda: client)
        with pytest.raises(RuntimeError, match="api down"):
            svc.chat_sync(MESSAGES)

    def test_chat_sync_resolves_model_alias(self, svc, monkeypatch):
        client = _make_client()
        monkeypatch.setattr(svc, "_get_sync_client", lambda: client)
        svc.chat_sync(MESSAGES, model="gpt-4o")
        _, kwargs = client.chat.completions.create.call_args
        assert kwargs["model"] == "openai/gpt-4o"
