"""
services/llm.py — LLM service via OpenRouter only.
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


class LLMService:
    """LLM calls via OpenRouter. Instantiate once as a module-level singleton."""

    def __init__(self):
        self._client = None

    def resolve_model(self, model_id: Optional[str]) -> str:
        if not model_id or (isinstance(model_id, str) and model_id.strip().lower() in ("null", "none")):
            return self._default_model()
        if "/" in model_id:
            return model_id
        return _OR_ALIASES.get(model_id, model_id)

    def _default_model(self) -> str:
        v = os.getenv("OPENROUTER_CHAT_MODEL", "").strip()
        return v if v and v.lower() not in ("null", "none") else "openai/gpt-4o"

    def _get_client(self):
        if self._client is None:
            import openai
            api_key = os.getenv("OPENROUTER_API_KEY")
            if not api_key:
                raise ValueError("OPENROUTER_API_KEY is required")
            self._client = openai.OpenAI(
                base_url="https://openrouter.ai/api/v1",
                api_key=api_key,
            )
        return self._client

    def complete(self, prompt: str, max_tokens: int = 150) -> str:
        """Non-streaming single-turn completion."""
        client = self._get_client()
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
        self, messages: List[dict], model: Optional[str] = None, timeout: int = 15
    ) -> str:
        """Non-streaming multi-turn completion."""
        client = self._get_client()
        response = client.chat.completions.create(
            model=self.resolve_model(model),
            messages=messages,
            stream=False,
            max_tokens=1000,
            timeout=timeout,
        )
        return response.choices[0].message.content or ""
