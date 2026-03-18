"""
test_health.py — Tests for the GET /health endpoint.
No mocking needed; this endpoint has no dependencies.
"""


def test_health_returns_200(client):
    response = client.get("/health")
    assert response.status_code == 200


def test_health_returns_json_ok(client):
    response = client.get("/health")
    assert response.json() == {"status": "ok"}


def test_health_content_type_is_json(client):
    response = client.get("/health")
    assert "application/json" in response.headers["content-type"]
