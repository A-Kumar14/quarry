"""
test_explore_images.py — Tests for GET /explore/images endpoint.
"""

import pytest

FAKE_IMAGES = [
    {"title": "Dog 1", "image": "data:image/jpeg;base64,aaa", "source": "https://a.com", "domain": "a.com"},
    {"title": "Dog 2", "image": "data:image/jpeg;base64,bbb", "source": "https://b.com", "domain": "b.com"},
]


# ── Happy path ────────────────────────────────────────────────────────────────

def test_images_returns_200(client, monkeypatch):
    from services import image_service
    monkeypatch.setattr(image_service, "search_images", lambda q, page=0: FAKE_IMAGES)

    resp = client.get("/explore/images?q=dogs")
    assert resp.status_code == 200


def test_images_response_shape(client, monkeypatch):
    from services import image_service
    monkeypatch.setattr(image_service, "search_images", lambda q, page=0: FAKE_IMAGES)

    resp = client.get("/explore/images?q=cats")
    body = resp.json()

    assert "images" in body
    assert "query" in body
    assert "page" in body


def test_images_query_echoed_in_response(client, monkeypatch):
    from services import image_service
    monkeypatch.setattr(image_service, "search_images", lambda q, page=0: FAKE_IMAGES)

    resp = client.get("/explore/images?q=pandas")
    assert resp.json()["query"] == "pandas"


def test_images_page_echoed_in_response(client, monkeypatch):
    from services import image_service
    monkeypatch.setattr(image_service, "search_images", lambda q, page=0: [])

    resp = client.get("/explore/images?q=dogs&page=2")
    assert resp.json()["page"] == 2


def test_images_pagination_passes_page_to_service(client, monkeypatch):
    from services import image_service

    received = {}

    def capturing(q, page=0):
        received["page"] = page
        return []

    monkeypatch.setattr(image_service, "search_images", capturing)

    client.get("/explore/images?q=test&page=3")
    assert received["page"] == 3


def test_images_returns_correct_image_list(client, monkeypatch):
    from services import image_service
    monkeypatch.setattr(image_service, "search_images", lambda q, page=0: FAKE_IMAGES)

    resp = client.get("/explore/images?q=dogs")
    body = resp.json()

    assert len(body["images"]) == 2
    assert body["images"][0]["title"] == "Dog 1"
    assert body["images"][1]["title"] == "Dog 2"


# ── Validation errors ─────────────────────────────────────────────────────────

def test_images_missing_q_returns_422(client):
    resp = client.get("/explore/images")
    assert resp.status_code == 422


def test_images_q_too_long_returns_422(client):
    resp = client.get(f"/explore/images?q={'x' * 201}")
    assert resp.status_code == 422


def test_images_page_above_20_returns_422(client):
    resp = client.get("/explore/images?q=test&page=21")
    assert resp.status_code == 422


def test_images_page_below_0_returns_422(client):
    resp = client.get("/explore/images?q=test&page=-1")
    assert resp.status_code == 422


def test_images_page_0_is_valid(client, monkeypatch):
    from services import image_service
    monkeypatch.setattr(image_service, "search_images", lambda q, page=0: [])

    resp = client.get("/explore/images?q=test&page=0")
    assert resp.status_code == 200


def test_images_page_20_is_valid(client, monkeypatch):
    from services import image_service
    monkeypatch.setattr(image_service, "search_images", lambda q, page=0: [])

    resp = client.get("/explore/images?q=test&page=20")
    assert resp.status_code == 200


# ── Service error handling ────────────────────────────────────────────────────

def test_images_service_exception_returns_500(client, monkeypatch):
    from services import image_service

    def boom(q, page=0):
        raise RuntimeError("ScrapingBee is down")

    monkeypatch.setattr(image_service, "search_images", boom)

    resp = client.get("/explore/images?q=dogs")
    assert resp.status_code == 500
    assert "detail" in resp.json()


def test_images_empty_result_is_valid(client, monkeypatch):
    from services import image_service
    monkeypatch.setattr(image_service, "search_images", lambda q, page=0: [])

    resp = client.get("/explore/images?q=nothing")
    assert resp.status_code == 200
    assert resp.json()["images"] == []
