"""
test_schemas.py — Pydantic schema validation tests.
No HTTP client needed — schemas are instantiated directly.
"""

import pytest
from pydantic import ValidationError
from schemas import ExploreSearchRequest, RelatedSearchRequest


# ── ExploreSearchRequest ──────────────────────────────────────────────────────

class TestExploreSearchRequest:
    def test_only_query_is_valid(self):
        req = ExploreSearchRequest(query="what is python?")
        assert req.query == "what is python?"
        assert req.context    is None
        assert req.session_id is None

    def test_all_fields_set(self):
        req = ExploreSearchRequest(
            query="follow-up",
            context="original query",
            session_id="sess-abc123",
        )
        assert req.query      == "follow-up"
        assert req.context    == "original query"
        assert req.session_id == "sess-abc123"

    def test_query_exactly_500_chars_is_valid(self):
        req = ExploreSearchRequest(query="a" * 500)
        assert len(req.query) == 500

    def test_query_501_chars_raises(self):
        with pytest.raises(ValidationError):
            ExploreSearchRequest(query="a" * 501)

    def test_missing_query_raises(self):
        with pytest.raises(ValidationError):
            ExploreSearchRequest()

    def test_none_query_raises(self):
        with pytest.raises(ValidationError):
            ExploreSearchRequest(query=None)

    def test_context_exactly_500_chars_is_valid(self):
        req = ExploreSearchRequest(query="q", context="c" * 500)
        assert len(req.context) == 500

    def test_context_501_chars_raises(self):
        with pytest.raises(ValidationError):
            ExploreSearchRequest(query="q", context="c" * 501)

    def test_context_defaults_to_none(self):
        req = ExploreSearchRequest(query="q")
        assert req.context is None

    def test_session_id_is_optional(self):
        req = ExploreSearchRequest(query="q", session_id=None)
        assert req.session_id is None

    def test_empty_string_query_raises(self):
        # field_validator strips whitespace then rejects empty result.
        with pytest.raises(ValidationError):
            ExploreSearchRequest(query="")

    def test_whitespace_only_query_raises(self):
        with pytest.raises(ValidationError):
            ExploreSearchRequest(query="   ")

    def test_null_byte_in_query_raises(self):
        with pytest.raises(ValidationError):
            ExploreSearchRequest(query="hello\x00world")

    def test_six_consecutive_newlines_raises(self):
        with pytest.raises(ValidationError):
            ExploreSearchRequest(query="a\n\n\n\n\n\nb")

    def test_five_consecutive_newlines_is_valid(self):
        # Exactly 5 consecutive newlines is below the threshold.
        req = ExploreSearchRequest(query="a\n\n\n\n\nb")
        assert "a" in req.query

    def test_leading_whitespace_stripped(self):
        req = ExploreSearchRequest(query="  hello  ")
        assert req.query == "hello"

    def test_null_byte_in_context_raises(self):
        with pytest.raises(ValidationError):
            ExploreSearchRequest(query="q", context="bad\x00context")

    def test_whitespace_context_stripped_to_empty_string(self):
        # Context is optional; whitespace-only strips to "" (not rejected like query)
        req = ExploreSearchRequest(query="q", context="   ")
        assert req.context == ""


# ── RelatedSearchRequest ──────────────────────────────────────────────────────

class TestRelatedSearchRequest:
    def test_only_query_is_valid(self):
        req = RelatedSearchRequest(query="quantum computing")
        assert req.query == "quantum computing"
        assert req.answer_snippet == ""

    def test_both_fields_set(self):
        req = RelatedSearchRequest(
            query="llm fine tuning",
            answer_snippet="Fine-tuning involves training on domain-specific data…",
        )
        assert req.answer_snippet.startswith("Fine-tuning")

    def test_query_501_chars_raises(self):
        with pytest.raises(ValidationError):
            RelatedSearchRequest(query="x" * 501)

    def test_answer_snippet_1001_chars_raises(self):
        with pytest.raises(ValidationError):
            RelatedSearchRequest(query="q", answer_snippet="s" * 1001)

    def test_answer_snippet_exactly_1000_chars_is_valid(self):
        req = RelatedSearchRequest(query="q", answer_snippet="s" * 1000)
        assert len(req.answer_snippet) == 1000

    def test_missing_query_raises(self):
        with pytest.raises(ValidationError):
            RelatedSearchRequest()

    def test_whitespace_only_query_raises(self):
        with pytest.raises(ValidationError):
            RelatedSearchRequest(query="   ")

    def test_null_byte_in_query_raises(self):
        with pytest.raises(ValidationError):
            RelatedSearchRequest(query="q\x00bad")

    def test_leading_whitespace_stripped(self):
        req = RelatedSearchRequest(query="  test query  ")
        assert req.query == "test query"
