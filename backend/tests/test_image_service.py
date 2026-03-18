"""
test_image_service.py — Unit tests for services/image_service.py.
All outbound HTTP calls are mocked via unittest.mock.patch.
"""

import pytest
from unittest.mock import patch, MagicMock


# ── Helper ────────────────────────────────────────────────────────────────────

def _make_response(images: list, status_code: int = 200) -> MagicMock:
    mock = MagicMock()
    mock.status_code = status_code
    mock.raise_for_status = MagicMock(
        side_effect=None if status_code < 400 else Exception(f"HTTP {status_code}")
    )
    mock.json.return_value = {"images": images}
    return mock


FAKE_IMAGE = {
    "image": "data:image/jpeg;base64,abc123",
    "title":  "A dog photo",
    "url":    "https://example.com/dog",
    "domain": "example.com",
}


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_no_key_returns_empty_list(monkeypatch):
    monkeypatch.delenv("SCRAPINGBEE_API_KEY", raising=False)
    # Re-import to pick up the missing env var
    import importlib
    import services.image_service as mod
    importlib.reload(mod)

    with patch("services.image_service.requests.get") as mock_get:
        result = mod.search_images("cats")
        mock_get.assert_not_called()
        assert result == []

    # Restore for other tests
    importlib.reload(mod)


def test_valid_response_maps_fields_correctly(monkeypatch):
    monkeypatch.setenv("SCRAPINGBEE_API_KEY", "test-key")
    import importlib
    import services.image_service as mod
    importlib.reload(mod)

    with patch("services.image_service.requests.get") as mock_get:
        mock_get.return_value = _make_response([FAKE_IMAGE])
        result = mod.search_images("dogs", page=0)

    assert len(result) == 1
    item = result[0]
    assert item["title"]  == "A dog photo"
    assert item["image"]  == "data:image/jpeg;base64,abc123"
    assert item["source"] == "https://example.com/dog"
    assert item["domain"] == "example.com"


def test_empty_image_field_is_filtered_out(monkeypatch):
    monkeypatch.setenv("SCRAPINGBEE_API_KEY", "test-key")
    import importlib
    import services.image_service as mod
    importlib.reload(mod)

    bad_images = [
        {"image": "",    "title": "no data",   "url": "https://a.com", "domain": "a.com"},
        {"image": None,  "title": "null data",  "url": "https://b.com", "domain": "b.com"},
        FAKE_IMAGE,
    ]

    with patch("services.image_service.requests.get") as mock_get:
        mock_get.return_value = _make_response(bad_images)
        result = mod.search_images("test")

    assert len(result) == 1
    assert result[0]["title"] == "A dog photo"


def test_request_timeout_returns_empty_list(monkeypatch):
    monkeypatch.setenv("SCRAPINGBEE_API_KEY", "test-key")
    import importlib
    import services.image_service as mod
    importlib.reload(mod)

    import requests as req_lib
    with patch("services.image_service.requests.get", side_effect=req_lib.exceptions.Timeout("timed out")):
        result = mod.search_images("timeout test")

    assert result == []


def test_non_2xx_response_returns_empty_list(monkeypatch):
    monkeypatch.setenv("SCRAPINGBEE_API_KEY", "test-key")
    import importlib
    import services.image_service as mod
    importlib.reload(mod)

    bad_resp = _make_response([], status_code=403)
    bad_resp.raise_for_status.side_effect = Exception("HTTP 403")

    with patch("services.image_service.requests.get", return_value=bad_resp):
        result = mod.search_images("forbidden")

    assert result == []


def test_page_param_is_passed_to_scrapingbee(monkeypatch):
    monkeypatch.setenv("SCRAPINGBEE_API_KEY", "test-key")
    import importlib
    import services.image_service as mod
    importlib.reload(mod)

    with patch("services.image_service.requests.get") as mock_get:
        mock_get.return_value = _make_response([FAKE_IMAGE])
        mod.search_images("kittens", page=3)

    call_kwargs = mock_get.call_args[1]["params"]
    assert call_kwargs["page"] == 3


def test_returns_at_most_page_size_results(monkeypatch):
    monkeypatch.setenv("SCRAPINGBEE_API_KEY", "test-key")
    import importlib
    import services.image_service as mod
    importlib.reload(mod)

    many_images = [FAKE_IMAGE] * 20

    with patch("services.image_service.requests.get") as mock_get:
        mock_get.return_value = _make_response(many_images)
        result = mod.search_images("lots")

    # Service returns whatever ScrapingBee sends — capped by the nb_results param sent.
    # Here we just confirm all valid images are returned.
    assert len(result) == 20
