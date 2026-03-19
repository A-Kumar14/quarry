"""
Tests for services/citation_service.py — metadata extraction and formatting.
No real HTTP calls are made; requests.get is monkeypatched.
"""

import json
import pytest
from unittest.mock import patch, MagicMock

from services.citation_service import (
    CitationMeta,
    resolve_metadata,
    format_apa,
    format_mla,
    format_chicago,
    format_bibtex,
    cite,
    _extract_arxiv_id,
    _extract_doi,
    _last_first,
    _format_author_list_apa,
)


# ── Helper ────────────────────────────────────────────────────────────────────

def _make_meta(**kw):
    defaults = dict(
        title="Deep Learning for NLP",
        authors=["Jane Doe", "Bob Smith"],
        year="2021",
        source="Nature",
        url="https://example.com/paper",
        doi="10.1234/test.2021",
        volume="42",
        issue="3",
        pages="100–120",
        publisher="Springer",
        arxiv_id="",
    )
    defaults.update(kw)
    return CitationMeta(**defaults)


# ── URL parsing ───────────────────────────────────────────────────────────────

class TestUrlParsing:
    def test_extract_arxiv_id(self):
        url = "https://arxiv.org/abs/2301.07041"
        assert _extract_arxiv_id(url) == "2301.07041"

    def test_extract_arxiv_id_pdf(self):
        url = "https://arxiv.org/pdf/1706.03762v5"
        assert _extract_arxiv_id(url) == "1706.03762v5"

    def test_extract_arxiv_id_none_for_non_arxiv(self):
        assert _extract_arxiv_id("https://example.com/paper") is None

    def test_extract_doi_from_doi_url(self):
        url = "https://doi.org/10.1038/nature14539"
        assert _extract_doi(url) == "10.1038/nature14539"

    def test_extract_doi_embedded_in_url(self):
        url = "https://example.com/article/10.1001/jama.2020.12345/full"
        assert _extract_doi(url) == "10.1001/jama.2020.12345/full"

    def test_extract_doi_none_for_plain_url(self):
        assert _extract_doi("https://example.com/page") is None


# ── Formatters ────────────────────────────────────────────────────────────────

class TestFormatters:
    def test_apa_includes_author_year_title_source(self):
        meta = _make_meta()
        result = format_apa(meta)
        assert "Doe" in result
        assert "2021" in result
        assert "Deep Learning for NLP" in result
        assert "Nature" in result

    def test_apa_doi_url(self):
        meta = _make_meta()
        result = format_apa(meta)
        assert "10.1234/test.2021" in result

    def test_apa_no_authors_still_renders(self):
        meta = _make_meta(authors=[])
        result = format_apa(meta)
        assert "Deep Learning for NLP" in result

    def test_mla_author_inverted(self):
        meta = _make_meta(authors=["Jane Doe"])
        result = format_mla(meta)
        assert result.startswith("Doe,")

    def test_mla_title_quoted(self):
        meta = _make_meta()
        result = format_mla(meta)
        assert '"Deep Learning for NLP' in result

    def test_chicago_author_inverted(self):
        meta = _make_meta(authors=["Jane Doe"])
        result = format_chicago(meta)
        assert "Doe," in result

    def test_bibtex_starts_with_at(self):
        meta = _make_meta()
        result = format_bibtex(meta)
        assert result.startswith("@article{")

    def test_bibtex_contains_required_fields(self):
        meta = _make_meta()
        result = format_bibtex(meta)
        assert "author" in result
        assert "title" in result
        assert "year" in result

    def test_bibtex_misc_when_no_source(self):
        meta = _make_meta(source="")
        result = format_bibtex(meta)
        assert result.startswith("@misc{")


# ── Helper functions ──────────────────────────────────────────────────────────

class TestHelpers:
    def test_last_first_simple(self):
        assert _last_first("Jane Doe") == "Doe, J."

    def test_last_first_middle_name(self):
        result = _last_first("Jane Marie Doe")
        assert result == "Doe, J. M."

    def test_apa_two_authors_ampersand(self):
        result = _format_author_list_apa(["Jane Doe", "Bob Smith"])
        assert "& Smith," in result or "& Smith" in result

    def test_apa_single_author_no_ampersand(self):
        result = _format_author_list_apa(["Jane Doe"])
        assert "&" not in result


# ── resolve_metadata routing ──────────────────────────────────────────────────

class TestResolveMetadata:
    def test_routes_arxiv_url_to_arxiv_api(self):
        arxiv_xml = """<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Attention Is All You Need</title>
    <author><name>Ashish Vaswani</name></author>
    <published>2017-06-12T00:00:00Z</published>
  </entry>
</feed>"""
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.text = arxiv_xml

        with patch("services.citation_service.requests.get", return_value=mock_resp):
            meta = resolve_metadata("https://arxiv.org/abs/1706.03762")

        assert "Attention" in meta.title
        assert meta.year == "2017"
        assert "Vaswani" in meta.authors[0]

    def test_routes_doi_url_to_crossref(self):
        crossref_json = {
            "message": {
                "title": ["Test Paper"],
                "author": [{"given": "Alice", "family": "Wonder"}],
                "published-print": {"date-parts": [[2020]]},
                "container-title": ["Science"],
                "volume": "10",
                "issue": "2",
                "page": "1-10",
                "publisher": "AAAS",
            }
        }
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = crossref_json

        with patch("services.citation_service.requests.get", return_value=mock_resp):
            meta = resolve_metadata("https://doi.org/10.1126/science.abc1234")

        assert meta.title == "Test Paper"
        assert meta.year == "2020"
        assert "Wonder" in meta.authors[0]

    def test_falls_back_to_html_scraping(self):
        html = """<html><head>
            <meta property="og:title" content="Scraped Title" />
            <meta name="author" content="John Author" />
            <meta property="article:published_time" content="2022-03-15" />
        </head><body></body></html>"""
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.text = html

        with patch("services.citation_service.requests.get", return_value=mock_resp):
            meta = resolve_metadata("https://example.com/article")

        assert meta.title == "Scraped Title"
        assert meta.year == "2022"


# ── cite() integration ────────────────────────────────────────────────────────

class TestCite:
    def test_cite_returns_citation_meta_style(self):
        html = """<html><head>
            <meta property="og:title" content="My Article" />
        </head><body></body></html>"""
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.text = html

        with patch("services.citation_service.requests.get", return_value=mock_resp):
            result = cite("https://example.com/article", "apa")

        assert "citation" in result
        assert result["style"] == "apa"
        assert "meta" in result
        assert "My Article" in result["citation"]

    def test_cite_bibtex_style(self):
        html = "<html><head><title>BibTeX Test</title></head><body></body></html>"
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.text = html

        with patch("services.citation_service.requests.get", return_value=mock_resp):
            result = cite("https://example.com/paper", "bibtex")

        assert result["citation"].startswith("@")
