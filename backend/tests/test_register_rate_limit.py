"""
test_register_rate_limit.py — /auth/register must be rate limited (5/hour per IP)
so the open signup endpoint can't be used for account farming / LLM-cost abuse.

Auth is disabled in the test env (JWT_SECRET=""), so the handler body returns 503,
but the slowapi limiter counts the request before the body runs — which is exactly
the behaviour we want to verify.
"""

import uuid

import pytest

import routers.auth as auth_mod


@pytest.fixture
def fresh_auth_rl(monkeypatch):
    """Isolated rate-limit counter for the auth-router limiter."""
    try:
        auth_mod.limiter._storage.storage.clear()
    except AttributeError:
        pass
    key = f"reg-test-{uuid.uuid4().hex}"
    monkeypatch.setattr(auth_mod.limiter, "_key_func", lambda _: key)
    return key


_VALID_BODY = {"username": "newuser", "email": "new@example.com", "password": "abcdef12"}


def test_register_allows_five_then_blocks_sixth(client, fresh_auth_rl):
    for i in range(5):
        resp = client.post("/auth/register", json=_VALID_BODY)
        assert resp.status_code != 429, f"request {i + 1} should not be rate limited"

    resp = client.post("/auth/register", json=_VALID_BODY)
    assert resp.status_code == 429


def test_register_limit_counter_is_isolated(client, fresh_auth_rl):
    """A fresh counter means the first request is never pre-limited."""
    resp = client.post("/auth/register", json=_VALID_BODY)
    assert resp.status_code != 429
