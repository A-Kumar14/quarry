"""
test_search_service.py — Unit tests for services/search_service.py.
All outbound HTTP calls are mocked.
"""

import pytest
from unittest.mock import patch, MagicMock

from services.search_service import build_context, fetch_live_scores


# ── build_context ─────────────────────────────────────────────────────────────

class TestBuildContext:
    def test_returns_tuple(self):
        ctx, sources = build_context([], [])
        assert isinstance(ctx, str)
        assert isinstance(sources, list)

    def test_empty_inputs_return_empty(self):
        ctx, sources = build_context([], [])
        assert ctx == ""
        assert sources == []

    def test_numbered_entries_in_context(self):
        results = [
            {"title": "Page A", "url": "https://a.com", "snippet": "Snippet A"},
            {"title": "Page B", "url": "https://b.com", "snippet": "Snippet B"},
        ]
        ctx, _ = build_context(results, [])
        assert "[1]" in ctx
        assert "[2]" in ctx

    def test_sources_list_has_correct_keys(self):
        results = [{"title": "T", "url": "https://example.com", "snippet": "S"}]
        _, sources = build_context(results, [])
        assert len(sources) == 1
        assert "title"   in sources[0]
        assert "url"     in sources[0]
        assert "snippet" in sources[0]

    def test_sources_list_values_match_results(self):
        results = [{"title": "My Title", "url": "https://x.com", "snippet": "My snippet"}]
        _, sources = build_context(results, [])
        assert sources[0]["title"]   == "My Title"
        assert sources[0]["url"]     == "https://x.com"
        assert sources[0]["snippet"] == "My snippet"

    def test_scraped_markdown_appears_in_context(self):
        results = [{"title": "T", "url": "https://a.com", "snippet": "fallback"}]
        scraped = [{"url": "https://a.com", "markdown": "## Actual scraped content"}]
        ctx, _ = build_context(results, scraped)
        assert "Actual scraped content" in ctx

    def test_snippet_used_when_no_scraped_content(self):
        results = [{"title": "T", "url": "https://a.com", "snippet": "Only snippet available"}]
        ctx, _ = build_context(results, [])
        assert "Only snippet available" in ctx

    def test_scraped_content_takes_priority_over_snippet(self):
        results = [{"title": "T", "url": "https://a.com", "snippet": "fallback snippet"}]
        scraped = [{"url": "https://a.com", "markdown": "scraped markdown wins"}]
        ctx, _ = build_context(results, scraped)
        # Scraped content is used; snippet may still appear as a label but markdown takes over
        assert "scraped markdown wins" in ctx

    def test_multiple_results_all_appear_in_context(self):
        results = [
            {"title": "Alpha", "url": "https://alpha.com", "snippet": "first"},
            {"title": "Beta",  "url": "https://beta.com",  "snippet": "second"},
            {"title": "Gamma", "url": "https://gamma.com", "snippet": "third"},
        ]
        ctx, sources = build_context(results, [])
        assert len(sources) == 3
        assert "Alpha" in ctx
        assert "Beta"  in ctx
        assert "Gamma" in ctx

    def test_url_in_context(self):
        results = [{"title": "T", "url": "https://check-url.com", "snippet": "s"}]
        ctx, _ = build_context(results, [])
        assert "https://check-url.com" in ctx

    def test_partial_scrape_uses_available_content(self):
        """Only URL 1 was scraped; URL 2 should fall back to snippet."""
        results = [
            {"title": "A", "url": "https://a.com", "snippet": "a-snippet"},
            {"title": "B", "url": "https://b.com", "snippet": "b-snippet"},
        ]
        scraped = [{"url": "https://a.com", "markdown": "a-scraped"}]
        ctx, _ = build_context(results, scraped)
        assert "a-scraped"  in ctx
        assert "b-snippet" in ctx


# ── fetch_live_scores ─────────────────────────────────────────────────────────

def _fake_espn_response(team_a="Arsenal", team_b="Chelsea", score_a="2", score_b="1"):
    mock = MagicMock()
    mock.ok = True
    mock.json.return_value = {
        "events": [{
            "competitions": [{
                "competitors": [
                    {"team": {"displayName": team_a}, "score": score_a},
                    {"team": {"displayName": team_b}, "score": score_b},
                ]
            }],
            "status": {
                "type": {"description": "In Progress"},
                "displayClock": "72'",
            },
        }]
    }
    return mock


class TestFetchLiveScores:
    def test_non_score_query_returns_empty(self):
        result = fetch_live_scores("what is the capital of France")
        assert result == ""

    def test_score_keyword_triggers_request(self):
        with patch("requests.get") as mock_get:
            mock_get.return_value = _fake_espn_response()
            result = fetch_live_scores("what is the live score today")
        assert mock_get.called

    def test_valid_response_contains_live_scores_header(self):
        with patch("requests.get") as mock_get:
            mock_get.return_value = _fake_espn_response()
            result = fetch_live_scores("score of the match")
        assert "[LIVE SCORES — ESPN]" in result

    def test_valid_response_contains_team_names(self):
        with patch("requests.get") as mock_get:
            mock_get.return_value = _fake_espn_response("Real Madrid", "Barcelona")
            result = fetch_live_scores("real madrid score")
        assert "Real Madrid" in result
        assert "Barcelona"   in result

    def test_valid_response_contains_score(self):
        with patch("requests.get") as mock_get:
            mock_get.return_value = _fake_espn_response(score_a="3", score_b="0")
            result = fetch_live_scores("live match score")
        assert "3" in result
        assert "0" in result

    def test_request_failure_returns_empty_string(self):
        import requests as req_lib
        with patch(
            "requests.get",
            side_effect=req_lib.exceptions.ConnectionError("no connection"),
        ):
            result = fetch_live_scores("live score")
        assert result == ""

    def test_non_ok_response_skips_league(self):
        mock = MagicMock()
        mock.ok = False
        with patch("requests.get", return_value=mock):
            result = fetch_live_scores("live score result")
        # All leagues failed → no events → empty string
        assert result == ""

    def test_empty_events_returns_empty_string(self):
        mock = MagicMock()
        mock.ok = True
        mock.json.return_value = {"events": []}
        with patch("requests.get", return_value=mock):
            result = fetch_live_scores("score vs match")
        assert result == ""

    def test_clock_appears_in_output(self):
        with patch("requests.get") as mock_get:
            mock_get.return_value = _fake_espn_response()
            result = fetch_live_scores("live score")
        assert "72'" in result
