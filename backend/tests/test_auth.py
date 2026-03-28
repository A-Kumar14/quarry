import os
import pytest
from fastapi.testclient import TestClient


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def set_jwt_secret(monkeypatch):
    """Enable auth for every test in this module, then restore the empty value."""
    monkeypatch.setenv("JWT_SECRET", "test-secret-12345")
    yield
    # monkeypatch restores automatically after each test

@pytest.fixture(autouse=True)
def clear_users(tmp_path, monkeypatch):
    """Redirect auth tests to a temp users file — never touch the real data/users.json."""
    import services.auth_service as svc
    temp_file = tmp_path / "users_test.json"
    monkeypatch.setattr(svc, "USERS_FILE", temp_file)
    yield
    if temp_file.exists():
        temp_file.unlink()


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_register_success(client):
    resp = client.post("/auth/register", json={
        "username": "testuser",
        "email": "test@example.com",
        "password": "password123"
    })
    assert resp.status_code == 201
    assert "token" in resp.json()
    assert resp.json()["user"]["username"] == "testuser"


def test_register_duplicate_username(client):
    client.post("/auth/register", json={
        "username": "dupe",
        "email": "first@example.com",
        "password": "password123"
    })
    resp = client.post("/auth/register", json={
        "username": "dupe",
        "email": "second@example.com",
        "password": "password123"
    })
    assert resp.status_code == 409
    assert "Username already taken" in resp.json()["detail"]


def test_login_success(client):
    client.post("/auth/register", json={
        "username": "loginuser",
        "email": "login@example.com",
        "password": "password123"
    })
    resp = client.post("/auth/login", json={
        "username": "loginuser",
        "password": "password123"
    })
    assert resp.status_code == 200
    assert "token" in resp.json()


def test_login_invalid_password(client):
    client.post("/auth/register", json={
        "username": "wrongpass",
        "email": "wrong@example.com",
        "password": "password123"
    })
    resp = client.post("/auth/login", json={
        "username": "wrongpass",
        "password": "wrongpassword"
    })
    assert resp.status_code == 401


def test_me_endpoint_requires_token(client):
    resp = client.get("/auth/me")
    assert resp.status_code == 401


def test_me_endpoint_success(client):
    register_resp = client.post("/auth/register", json={
        "username": "meuser",
        "email": "me@example.com",
        "password": "password123"
    })
    token = register_resp.json()["token"]
    resp = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["username"] == "meuser"


def test_protected_route_blocked_without_token(client):
    resp = client.post("/explore/search", json={"query": "test"})
    assert resp.status_code == 401


def test_developer_bypass(client, monkeypatch):
    monkeypatch.setenv("DEV_BYPASS_TOKEN", "dev-token-xyz")
    resp = client.post(
        "/explore/search",
        json={"query": "test"},
        headers={"Authorization": "Bearer dev-token-xyz"},
    )
    # Not 401 — dev token is accepted; may be 200/422/500 depending on mocks
    assert resp.status_code != 401
