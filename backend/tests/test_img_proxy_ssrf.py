"""
test_img_proxy_ssrf.py — The /explore/img-proxy endpoint must enforce the SSRF
guard (is_safe_url) and must never make a network call for unsafe targets.
"""

import pytest

import routers.explore as explore_mod


UNSAFE_URLS = [
    "http://169.254.169.254/latest/meta-data/",   # cloud metadata
    "http://localhost/admin",
    "http://127.0.0.1/",
    "http://10.0.0.1/",
    "http://192.168.0.1/",
    "http://172.16.0.1/",
    "file:///etc/passwd",
    "ftp://internal/data",
    "http://metadata.google.internal/computeMetadata/v1/",
]


@pytest.fixture
def no_network(monkeypatch):
    """Replace httpx.AsyncClient with a fake that records whether it was used."""
    state = {"called": False}

    class _Resp:
        headers = {"content-type": "image/png"}
        content = b"\x89PNG\r\n\x1a\n"

    class _FakeClient:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def get(self, url, headers=None):
            state["called"] = True
            return _Resp()

    monkeypatch.setattr(explore_mod.httpx, "AsyncClient", lambda *a, **k: _FakeClient())
    return state


@pytest.mark.parametrize("url", UNSAFE_URLS)
def test_unsafe_url_rejected_without_network(client, no_network, url):
    resp = client.get("/explore/img-proxy", params={"url": url})
    assert resp.status_code == 400, f"{url} should be rejected"
    assert no_network["called"] is False, f"network call was made for unsafe url {url}"


def test_public_url_is_proxied(client, no_network):
    resp = client.get("/explore/img-proxy", params={"url": "https://example.com/photo.png"})
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("image/")
    assert no_network["called"] is True
