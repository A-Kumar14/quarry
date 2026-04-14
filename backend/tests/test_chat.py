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


# ── chroma_service tests ──────────────────────────────────────────────────────

@pytest.fixture
def tmp_chroma(monkeypatch, tmp_path):
    """Redirect chroma_service to a temp directory."""
    import services.chroma_service as cs
    monkeypatch.setattr(cs, "CHROMA_DIR", str(tmp_path / "chroma"))
    cs._client = None
    cs._collection = None
    yield cs
    cs._client = None
    cs._collection = None


def test_store_and_search(tmp_chroma):
    tmp_chroma.store_message(
        message_id="m1",
        content="The RSF grew out of the Janjaweed militias in Sudan",
        metadata={"session_id": "s1", "branch_id": "b1", "role": "assistant",
                  "timestamp": "2026-01-01T00:00:00", "session_title": "Sudan"},
    )
    results = tmp_chroma.semantic_search("Sudan militia history")
    assert len(results) >= 1
    assert any("RSF" in r["excerpt"] for r in results)


def test_search_empty_collection(tmp_chroma):
    results = tmp_chroma.semantic_search("anything")
    assert results == []


# ── /chat session endpoint tests ─────────────────────────────────────────────

def test_create_session(client, monkeypatch, tmp_path):
    import services.conversation_store as cs
    monkeypatch.setattr(cs, "DATA_FILE", tmp_path / "conversations.json")
    cs._data_cache = None

    resp = client.post("/chat/sessions")
    assert resp.status_code == 200
    body = resp.json()
    assert "session_id" in body
    assert "branch_id" in body
    assert body["title"] == "New conversation"


def test_get_sessions_empty(client, monkeypatch, tmp_path):
    import services.conversation_store as cs
    monkeypatch.setattr(cs, "DATA_FILE", tmp_path / "conversations.json")
    cs._data_cache = None

    resp = client.get("/chat/sessions")
    assert resp.status_code == 200
    assert resp.json()["sessions"] == []


def test_fork_session(client, monkeypatch, tmp_path):
    import services.conversation_store as cs
    monkeypatch.setattr(cs, "DATA_FILE", tmp_path / "conversations.json")
    cs._data_cache = None

    # Create session and add a message directly via store
    sid, bid = cs.create_session()
    cs.add_message(sid, bid, {
        "id": "msg-abc",
        "role": "user",
        "content": "test",
        "timestamp": "2026-01-01T00:00:00",
    })

    resp = client.post(f"/chat/sessions/{sid}/fork", json={"from_message_id": "msg-abc"})
    assert resp.status_code == 200
    assert "branch_id" in resp.json()
    assert "label" in resp.json()


def test_chat_search(client, monkeypatch, tmp_path):
    import services.chroma_service as cs_chroma
    monkeypatch.setattr(cs_chroma, "CHROMA_DIR", str(tmp_path / "chroma"))
    cs_chroma._client = None
    cs_chroma._collection = None

    resp = client.get("/chat/search?q=test")
    assert resp.status_code == 200
    assert "results" in resp.json()
