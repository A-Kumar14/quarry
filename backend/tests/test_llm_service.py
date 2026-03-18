"""
test_llm_service.py — Unit tests for services/llm.py.
Tests provider detection and model resolution without making real API calls.
"""

import pytest
from services.llm import LLMService, _detect_provider, _OR_ALIASES


# ── _detect_provider ──────────────────────────────────────────────────────────

class TestDetectProvider:
    def test_explicit_openrouter(self, monkeypatch):
        monkeypatch.setenv("AI_PROVIDER", "openrouter")
        monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
        assert _detect_provider() == "openrouter"

    def test_explicit_openai(self, monkeypatch):
        monkeypatch.setenv("AI_PROVIDER", "openai")
        assert _detect_provider() == "openai"

    def test_explicit_gemini(self, monkeypatch):
        monkeypatch.setenv("AI_PROVIDER", "gemini")
        assert _detect_provider() == "gemini"

    def test_case_insensitive_env_var(self, monkeypatch):
        monkeypatch.setenv("AI_PROVIDER", "OpenRouter")
        assert _detect_provider() == "openrouter"

    def test_openrouter_key_implies_openrouter(self, monkeypatch):
        monkeypatch.delenv("AI_PROVIDER", raising=False)
        monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-v1-test")
        monkeypatch.delenv("OPENAI_API_KEY",      raising=False)
        monkeypatch.delenv("GOOGLE_API_KEY",      raising=False)
        monkeypatch.delenv("GEMINI_API_KEY",      raising=False)
        assert _detect_provider() == "openrouter"

    def test_openai_key_implies_openai(self, monkeypatch):
        monkeypatch.delenv("AI_PROVIDER",         raising=False)
        monkeypatch.delenv("OPENROUTER_API_KEY",  raising=False)
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
        monkeypatch.delenv("GOOGLE_API_KEY",      raising=False)
        monkeypatch.delenv("GEMINI_API_KEY",      raising=False)
        assert _detect_provider() == "openai"

    def test_google_api_key_implies_gemini(self, monkeypatch):
        monkeypatch.delenv("AI_PROVIDER",         raising=False)
        monkeypatch.delenv("OPENROUTER_API_KEY",  raising=False)
        monkeypatch.delenv("OPENAI_API_KEY",      raising=False)
        monkeypatch.setenv("GOOGLE_API_KEY", "goog-test")
        monkeypatch.delenv("GEMINI_API_KEY",      raising=False)
        assert _detect_provider() == "gemini"

    def test_gemini_api_key_implies_gemini(self, monkeypatch):
        monkeypatch.delenv("AI_PROVIDER",         raising=False)
        monkeypatch.delenv("OPENROUTER_API_KEY",  raising=False)
        monkeypatch.delenv("OPENAI_API_KEY",      raising=False)
        monkeypatch.delenv("GOOGLE_API_KEY",      raising=False)
        monkeypatch.setenv("GEMINI_API_KEY", "gemini-test")
        assert _detect_provider() == "gemini"

    def test_no_keys_falls_back_to_openai(self, monkeypatch):
        monkeypatch.delenv("AI_PROVIDER",         raising=False)
        monkeypatch.delenv("OPENROUTER_API_KEY",  raising=False)
        monkeypatch.delenv("OPENAI_API_KEY",      raising=False)
        monkeypatch.delenv("GOOGLE_API_KEY",      raising=False)
        monkeypatch.delenv("GEMINI_API_KEY",      raising=False)
        assert _detect_provider() == "openai"

    def test_explicit_provider_takes_priority_over_key(self, monkeypatch):
        """Explicit AI_PROVIDER should win even when other keys are present."""
        monkeypatch.setenv("AI_PROVIDER", "gemini")
        monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-v1-test")
        assert _detect_provider() == "gemini"


# ── resolve_model ─────────────────────────────────────────────────────────────

class TestResolveModel:
    def _svc(self, provider: str) -> LLMService:
        svc = LLMService()
        svc._provider = provider
        return svc

    # OpenRouter aliases
    def test_short_alias_resolves_to_full_id(self):
        svc = self._svc("openrouter")
        assert svc.resolve_model("gpt-4o") == "openai/gpt-4o"

    def test_mini_alias_resolves(self):
        svc = self._svc("openrouter")
        assert svc.resolve_model("gpt-4o-mini") == "openai/gpt-4o-mini"

    def test_gemini_flash_alias_resolves(self):
        svc = self._svc("openrouter")
        assert svc.resolve_model("gemini-2.0-flash") == _OR_ALIASES["gemini-2.0-flash"]

    def test_fully_qualified_id_passes_through(self):
        svc = self._svc("openrouter")
        assert svc.resolve_model("openai/gpt-4o") == "openai/gpt-4o"

    def test_unknown_alias_passes_through(self):
        svc = self._svc("openrouter")
        assert svc.resolve_model("some-unknown-model") == "some-unknown-model"

    # Null / None handling
    def test_none_falls_back_to_default(self, monkeypatch):
        monkeypatch.setenv("AI_PROVIDER", "openrouter")
        monkeypatch.delenv("OPENROUTER_CHAT_MODEL", raising=False)
        svc = self._svc("openrouter")
        result = svc.resolve_model(None)
        assert result == "openai/gpt-4o"

    def test_string_null_falls_back_to_default(self, monkeypatch):
        monkeypatch.setenv("AI_PROVIDER", "openrouter")
        monkeypatch.delenv("OPENROUTER_CHAT_MODEL", raising=False)
        svc = self._svc("openrouter")
        assert svc.resolve_model("null") == "openai/gpt-4o"

    def test_string_none_falls_back_to_default(self, monkeypatch):
        monkeypatch.setenv("AI_PROVIDER", "openrouter")
        monkeypatch.delenv("OPENROUTER_CHAT_MODEL", raising=False)
        svc = self._svc("openrouter")
        assert svc.resolve_model("none") == "openai/gpt-4o"

    # OpenAI provider — model passed through unchanged
    def test_openai_provider_returns_model_unchanged(self):
        svc = self._svc("openai")
        assert svc.resolve_model("gpt-4o") == "gpt-4o"

    def test_openai_custom_model_env_var(self, monkeypatch):
        monkeypatch.setenv("OPENAI_CHAT_MODEL", "gpt-4-turbo")
        monkeypatch.setenv("AI_PROVIDER", "openai")
        svc = self._svc("openai")
        assert svc.resolve_model(None) == "gpt-4-turbo"

    def test_openrouter_custom_model_env_var(self, monkeypatch):
        monkeypatch.setenv("OPENROUTER_CHAT_MODEL", "anthropic/claude-3.5-sonnet")
        svc = self._svc("openrouter")
        result = svc.resolve_model(None)
        assert result == "anthropic/claude-3.5-sonnet"
