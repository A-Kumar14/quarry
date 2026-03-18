"""
test_cors.py — Tests for CORS middleware behaviour.
"""

import pytest


# ── Default wildcard CORS (allow_origins=["*"]) ───────────────────────────────

def test_cors_header_present_for_localhost_origin(client):
    """Any Origin should receive an Access-Control-Allow-Origin header."""
    resp = client.get("/health", headers={"Origin": "http://localhost:3000"})
    assert resp.status_code == 200
    assert "access-control-allow-origin" in resp.headers


def test_cors_header_present_for_arbitrary_origin(client):
    resp = client.get("/health", headers={"Origin": "https://myapp.example.com"})
    assert "access-control-allow-origin" in resp.headers


def test_preflight_returns_200(client):
    """OPTIONS preflight to /explore/search should succeed."""
    resp = client.options(
        "/explore/search",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type",
        },
    )
    assert resp.status_code == 200


def test_preflight_exposes_allow_methods(client):
    resp = client.options(
        "/explore/search",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert "access-control-allow-methods" in resp.headers


def test_preflight_exposes_allow_headers(client):
    resp = client.options(
        "/explore/search",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type",
        },
    )
    assert "access-control-allow-headers" in resp.headers


def test_request_without_origin_still_works(client):
    """Non-browser requests (no Origin header) should always succeed."""
    resp = client.get("/health")
    assert resp.status_code == 200


# ── Specific origin CORS ──────────────────────────────────────────────────────

def test_specific_origin_is_reflected():
    """
    When allow_origins is set to a specific domain, the middleware echoes
    that exact origin (not '*') in the response header.
    Verified by constructing a fresh app with the specific origin configured.
    """
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.testclient import TestClient

    specific_app = FastAPI()
    specific_app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @specific_app.get("/ping")
    def ping():
        return {"pong": True}

    with TestClient(specific_app) as tc:
        resp = tc.get("/ping", headers={"Origin": "http://localhost:3000"})
        assert resp.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_disallowed_origin_not_reflected():
    """
    An origin not in the allow list should not be reflected.
    """
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.testclient import TestClient

    restricted_app = FastAPI()
    restricted_app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @restricted_app.get("/ping")
    def ping():
        return {"pong": True}

    with TestClient(restricted_app) as tc:
        resp = tc.get("/ping", headers={"Origin": "https://evil.com"})
        acao = resp.headers.get("access-control-allow-origin", "")
        assert acao != "https://evil.com"
