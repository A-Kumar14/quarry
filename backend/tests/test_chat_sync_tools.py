"""Test chat_sync_with_tools on LLMService."""
import pytest


def test_chat_sync_with_tools_no_tool_call(monkeypatch):
    """When model returns plain text, tool_calls should be empty list."""
    from services.llm import LLMService

    class FakeMsg:
        content = "plain answer"
        tool_calls = None

    class FakeChoice:
        message = FakeMsg()

    class FakeResp:
        choices = [FakeChoice()]

    svc = LLMService()

    def fake_create(**kwargs):
        return FakeResp()

    import types
    fake_client = types.SimpleNamespace(
        chat=types.SimpleNamespace(
            completions=types.SimpleNamespace(create=fake_create)
        )
    )
    monkeypatch.setattr(svc, "_get_sync_client", lambda: fake_client)

    content, tool_calls = svc.chat_sync_with_tools(
        messages=[{"role": "user", "content": "hi"}],
        tools=[{"type": "function", "function": {"name": "search_web", "parameters": {}}}],
    )
    assert content == "plain answer"
    assert tool_calls == []


def test_chat_sync_with_tools_with_tool_call(monkeypatch):
    """When model returns a tool call, content is empty and tool_calls is populated."""
    import types
    from services.llm import LLMService

    fake_tool_call = types.SimpleNamespace(
        function=types.SimpleNamespace(name="search_web", arguments='{"query": "Sudan"}'),
        id="call_123",
    )

    class FakeMsg:
        content = None
        tool_calls = [fake_tool_call]

    class FakeChoice:
        message = FakeMsg()

    class FakeResp:
        choices = [FakeChoice()]

    svc = LLMService()

    def fake_create(**kwargs):
        return FakeResp()

    fake_client = types.SimpleNamespace(
        chat=types.SimpleNamespace(
            completions=types.SimpleNamespace(create=fake_create)
        )
    )
    monkeypatch.setattr(svc, "_get_sync_client", lambda: fake_client)

    content, tool_calls = svc.chat_sync_with_tools(
        messages=[{"role": "user", "content": "Tell me about Sudan"}],
        tools=[{"type": "function", "function": {"name": "search_web", "parameters": {}}}],
    )
    assert content == ""
    assert len(tool_calls) == 1
    assert tool_calls[0].function.name == "search_web"
