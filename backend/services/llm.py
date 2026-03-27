"""
services/llm.py — LLM service + provider detection.

The unit tests in `backend/tests/test_llm_service.py` expect:
- module-level `_detect_provider()` returning {openrouter, openai, gemini}
- `_OR_ALIASES` alias mapping for openrouter model resolution
- `LLMService` to expose `_provider` and `_get_sync_client()`
- provider-aware `resolve_model()`
"""

import logging
import os
from typing import Iterator, List, Optional

logger = logging.getLogger(__name__)

_OR_ALIASES: dict = {
    "gpt-4o":            "openai/gpt-4o",
    "gpt-4o-mini":       "openai/gpt-4o-mini",
    "gemini-2.0-flash":  "google/gemini-2.0-flash-exp:free",
    "gemini-3-flash":    "google/gemini-3-flash-preview",
    "gemini-3.1-pro":    "google/gemini-3.1-pro-preview",
    "grok-3":            "x-ai/grok-3",
    "grok-3-mini":       "x-ai/grok-3-mini",
    "claude-3.5-sonnet": "anthropic/claude-3.5-sonnet",
    "claude-sonnet-4.5": "anthropic/claude-sonnet-4.5",
    "claude-3-haiku":    "anthropic/claude-3-haiku",
}


def _detect_provider() -> str:
    """
    Detect provider from env vars.

    Tests expect:
    - `AI_PROVIDER` (case-insensitive) has priority.
    - If no explicit provider, infer from available API keys.
    - Fallback to `openai` when no keys are present.
    """
    explicit = (os.getenv("AI_PROVIDER") or "").strip().lower()
    if explicit in ("openrouter", "openai", "gemini"):
        return explicit

    if os.getenv("OPENROUTER_API_KEY"):
        return "openrouter"

    if os.getenv("OPENAI_API_KEY"):
        return "openai"

    if os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY"):
        return "gemini"

    return "openai"


class LLMService:
    """Provider-aware LLM service.

    In production this project primarily uses OpenRouter, but unit tests
    require provider detection and model resolution behaviors.
    """

    def __init__(self):
        self._client = None
        self._provider = _detect_provider()

    def _default_model(self) -> str:
        if self._provider == "openrouter":
            v = os.getenv("OPENROUTER_CHAT_MODEL", "").strip()
            return v if v and v.lower() not in ("null", "none") else "openai/gpt-4o"
        if self._provider == "openai":
            v = os.getenv("OPENAI_CHAT_MODEL", "").strip()
            return v if v and v.lower() not in ("null", "none") else "gpt-4o"
        # gemini
        v = os.getenv("GEMINI_CHAT_MODEL", "").strip()
        return v if v and v.lower() not in ("null", "none") else "gemini-1.5-flash"

    def resolve_model(self, model_id: Optional[str]) -> str:
        if not model_id or (isinstance(model_id, str) and model_id.strip().lower() in ("null", "none")):
            return self._default_model()

        model_id = str(model_id).strip()
        if not model_id:
            return self._default_model()

        # Only OpenRouter needs alias expansion (tests assert provider-specific behavior).
        if self._provider == "openrouter":
            if "/" in model_id:
                return model_id
            return _OR_ALIASES.get(model_id, model_id)

        # openai / gemini: return the ID unchanged
        return model_id

    def _get_sync_client(self):
        """
        Return a synchronous OpenAI-compatible client for the current provider.

        Tests monkeypatch this method, so the default implementation only needs
        to be correct enough for app runtime.
        """
        if self._client is not None:
            return self._client

        import openai

        if self._provider == "openrouter":
            api_key = os.getenv("OPENROUTER_API_KEY")
            if not api_key:
                raise ValueError("OPENROUTER_API_KEY is required")
            self._client = openai.OpenAI(
                base_url="https://openrouter.ai/api/v1",
                api_key=api_key,
            )
            return self._client

        if self._provider == "openai":
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                raise ValueError("OPENAI_API_KEY is required")
            self._client = openai.OpenAI(api_key=api_key)
            return self._client

        raise ValueError("gemini provider not supported by this OpenAI SDK wrapper")

    def _get_client(self):
        """Alias for synchronous SDK client (OpenAI SDK uses same client for streaming)."""
        return self._get_sync_client()

    def complete(self, prompt: str, max_tokens: int = 150) -> str:
        """Non-streaming single-turn completion."""
        client = self._get_sync_client()
        resp = client.chat.completions.create(
            model=self.resolve_model(None),
            messages=[{"role": "user", "content": prompt}],
            stream=False,
            max_tokens=max_tokens,
        )
        return resp.choices[0].message.content or ""

    def stream_sync(
        self, messages: List[dict], model: Optional[str] = None
    ) -> Iterator[str]:
        """Streaming completion yielding only token text chunks."""
        client = self._get_client()
        stream = client.chat.completions.create(
            model=self.resolve_model(model),
            messages=messages,
            stream=True,
            max_tokens=1000,
        )
        for chunk in stream:
            text = getattr(chunk.choices[0].delta, "content", None) or ""
            if text:
                yield text

    def chat_sync(
        self,
        messages: List[dict],
        model: Optional[str] = None,
        timeout: int = 15,
    ) -> str:
        """Non-streaming multi-turn completion."""
        client = self._get_sync_client()
        response = client.chat.completions.create(
            model=self.resolve_model(model),
            messages=messages,
            stream=False,
            max_tokens=1000,
            timeout=timeout,
        )
        return response.choices[0].message.content or ""
