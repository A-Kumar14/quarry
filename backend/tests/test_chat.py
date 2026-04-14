"""Tests for chat endpoints and services."""
import json
import os
import pytest
import tempfile
from pathlib import Path


# ── conversation_store tests ──────────────────────────────────────────────────

@pytest.fixture
def tmp_store(monkeypatch, tmp_path):
    """Redirect conversation_store to a temp file."""
    tmp_file = tmp_path / "conversations.json"
    import services.conversation_store as cs
    monkeypatch.setattr(cs, "DATA_FILE", tmp_file)
    # Reset in-memory cache
    cs._data_cache = None
    yield cs
    cs._data_cache = None


def test_create_session_returns_ids(tmp_store):
    session_id, branch_id = tmp_store.create_session()
    assert isinstance(session_id, str) and len(session_id) == 36
    assert isinstance(branch_id, str) and len(branch_id) == 36


def test_get_sessions_empty(tmp_store):
    result = tmp_store.get_sessions()
    assert result == []


def test_create_and_get_sessions(tmp_store):
    sid, bid = tmp_store.create_session(title="Test session")
    sessions = tmp_store.get_sessions()
    assert len(sessions) == 1
    assert sessions[0]["id"] == sid
    assert sessions[0]["title"] == "Test session"


def test_add_message_and_retrieve(tmp_store):
    sid, bid = tmp_store.create_session()
    msg = {"id": "msg-1", "role": "user", "content": "Hello", "timestamp": "2026-01-01T00:00:00"}
    tmp_store.add_message(sid, bid, msg)
    messages = tmp_store.get_branch_messages(sid, bid)
    assert len(messages) == 1
    assert messages[0]["content"] == "Hello"


def test_fork_branch(tmp_store):
    sid, bid = tmp_store.create_session()
    msg1 = {"id": "msg-1", "role": "user", "content": "Hello", "timestamp": "2026-01-01T00:00:00"}
    msg2 = {"id": "msg-2", "role": "assistant", "content": "Hi", "timestamp": "2026-01-01T00:00:01"}
    tmp_store.add_message(sid, bid, msg1)
    tmp_store.add_message(sid, bid, msg2)

    new_bid = tmp_store.fork_branch(sid, from_message_id="msg-1", label="Fork test")
    assert new_bid != bid

    forked_msgs = tmp_store.get_branch_messages(sid, new_bid)
    # Fork from msg-1 means the new branch starts with msg-1 included
    assert len(forked_msgs) == 1
    assert forked_msgs[0]["id"] == "msg-1"


def test_update_session_title(tmp_store):
    sid, bid = tmp_store.create_session()
    tmp_store.update_session_title(sid, "New title")
    sessions = tmp_store.get_sessions()
    assert sessions[0]["title"] == "New title"
