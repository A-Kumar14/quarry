"""
test_ssrf.py — Tests for the SSRF guard (is_safe_url) and that scrape_urls
filters unsafe URLs before making any network calls.
"""

import pytest
from unittest.mock import patch, MagicMock
from services.search_service import is_safe_url, scrape_urls


# ── is_safe_url ───────────────────────────────────────────────────────────────

class TestIsSafeUrl:
    # --- Safe URLs ---
    def test_public_http_url_is_safe(self):
        assert is_safe_url("http://example.com/page") is True

    def test_public_https_url_is_safe(self):
        assert is_safe_url("https://www.bbc.com/news") is True

    def test_public_url_with_path_is_safe(self):
        assert is_safe_url("https://docs.python.org/3/library/re.html") is True

    # --- Blocked schemes ---
    def test_file_scheme_blocked(self):
        assert is_safe_url("file:///etc/passwd") is False

    def test_ftp_scheme_blocked(self):
        assert is_safe_url("ftp://internal.host/data") is False

    def test_gopher_scheme_blocked(self):
        assert is_safe_url("gopher://evil.com") is False

    # --- Localhost ---
    def test_localhost_blocked(self):
        assert is_safe_url("http://localhost/admin") is False

    def test_localhost_https_blocked(self):
        assert is_safe_url("https://localhost:8080/secret") is False

    # --- Private IP ranges ---
    def test_10_x_x_x_blocked(self):
        assert is_safe_url("http://10.0.0.1/") is False

    def test_10_range_edge_blocked(self):
        assert is_safe_url("http://10.255.255.255/") is False

    def test_172_16_blocked(self):
        assert is_safe_url("http://172.16.0.1/") is False

    def test_172_31_blocked(self):
        assert is_safe_url("http://172.31.255.255/") is False

    def test_192_168_blocked(self):
        assert is_safe_url("http://192.168.1.1/") is False

    def test_127_0_0_1_blocked(self):
        assert is_safe_url("http://127.0.0.1/") is False

    def test_127_loopback_range_blocked(self):
        assert is_safe_url("http://127.0.0.2/exploit") is False

    def test_link_local_metadata_ip_blocked(self):
        """AWS/Azure instance metadata endpoint."""
        assert is_safe_url("http://169.254.169.254/latest/meta-data/") is False

    def test_link_local_range_blocked(self):
        assert is_safe_url("http://169.254.1.1/") is False

    # --- Cloud metadata hostnames ---
    def test_gcp_metadata_hostname_blocked(self):
        assert is_safe_url("http://metadata.google.internal/computeMetadata/v1/") is False

    # --- Edge cases ---
    def test_empty_string_blocked(self):
        assert is_safe_url("") is False

    def test_no_scheme_blocked(self):
        assert is_safe_url("example.com/page") is False

    def test_missing_host_blocked(self):
        assert is_safe_url("https:///path") is False


# ── scrape_urls filters unsafe URLs ──────────────────────────────────────────

class TestScrapeUrlsSSRFFilter:
    def test_private_ip_never_scraped(self):
        """scrape_urls must not make requests to private IP addresses."""
        with patch("trafilatura.fetch_url") as mock_fetch:
            mock_fetch.return_value = None
            scrape_urls(["http://192.168.1.1/secret"], max_pages=5)
            mock_fetch.assert_not_called()

    def test_localhost_never_scraped(self):
        with patch("trafilatura.fetch_url") as mock_fetch:
            mock_fetch.return_value = None
            scrape_urls(["http://localhost/admin"], max_pages=5)
            mock_fetch.assert_not_called()

    def test_safe_url_is_scraped(self):
        """Safe public URLs should still be attempted."""
        with patch("trafilatura.fetch_url", return_value=None):
            # No assertion on call count — just confirm no exception
            result = scrape_urls(["https://example.com"], max_pages=5)
            assert isinstance(result, list)

    def test_mixed_urls_only_safe_scraped(self):
        """Only safe URLs from a mixed list should reach trafilatura."""
        call_args = []

        def fake_fetch(url):
            call_args.append(url)
            return None

        with patch("trafilatura.fetch_url", side_effect=fake_fetch):
            scrape_urls(
                [
                    "https://example.com",       # safe
                    "http://192.168.0.1/",        # private
                    "http://localhost/",           # localhost
                    "https://another-safe.com",   # safe
                ],
                max_pages=10,
            )

        for url in call_args:
            assert is_safe_url(url), f"Unsafe URL reached scraper: {url}"
