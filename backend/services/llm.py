"""
services/llm.py — LLM service with provider auto-detection.

Provider chain: OpenRouter → OpenAI → Gemini (detected from env vars).
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
    p = os.getenv("AI_PROVIDER", "").lower()
    if p in ("openrouter", "gemini", "openai"):
        return p
    if os.getenv("OPENROUTER_API_KEY"):
        return "openrouter"
    if os.getenv("OPENAI_API_KEY"):
        return "openai"
    if os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY"):
        return "gemini"
    return "openai"


AI_PROVIDER = _detect_provider()
logger.info("LLMService: provider=%s", AI_PROVIDER)


class LLMService:
    """LLM calls. Instantiate once as a module-level singleton."""

    def __init__(self):
        self._provider = AI_PROVIDER
        self._sync_client = None
        self._gemini_configured = False
        self._genai = None

    def resolve_model(self, model_id: Optional[str]) -> str:
        if not model_id or (isinstance(model_id, str) and model_id.strip().lower() in ("null", "none")):
            return self._default_model()
        if self._provider == "openrouter":
            if "/" in model_id:
                return model_id
            return _OR_ALIASES.get(model_id, model_id)
        return model_id

    def _default_model(self) -> str:
        def _env(var: str, fallback: str) -> str:
            v = os.getenv(var, "").strip()
            return fallback if not v or v.lower() in ("null", "none") else v

        if self._provider == "openrouter":
            return _env("OPENROUTER_CHAT_MODEL", "openai/gpt-4o")
        if self._provider == "gemini":
            return _env("GEMINI_CHAT_MODEL", "gemini-2.0-flash")
        return _env("OPENAI_CHAT_MODEL", "gpt-4o")

    def complete(self, prompt: str, max_tokens: int = 150) -> str:
        """Non-streaming single-turn completion. Returns the full response string."""
        messages = [{"role": "user", "content": prompt}]
        resolved = self.resolve_model(None)

        if self._provider == "gemini" and not self._is_openrouter_model(resolved):
            genai = self._get_genai()
            gmodel = genai.GenerativeModel(model_name=resolved)
            response = gmodel.generate_content(
                prompt, generation_config={"max_output_tokens": max_tokens}
            )
            return getattr(response, "text", "") or ""

        client = self._get_sync_client()
        resp = client.chat.completions.create(
            model=resolved, messages=messages, stream=False, max_tokens=max_tokens
        )
        return resp.choices[0].message.content or ""

    def stream_sync(
        self, messages: List[dict], model: Optional[str] = None
    ) -> Iterator[str]:
        resolved = self.resolve_model(model)

        if self._provider == "gemini" and not self._is_openrouter_model(resolved):
            yield from self._stream_gemini(messages, resolved)
            return

        client = self._get_sync_client()
        stream = client.chat.completions.create(
            model=resolved, messages=messages, stream=True, max_tokens=2048
        )
        for chunk in stream:
            text = getattr(chunk.choices[0].delta, "content", None) or ""
            if text:
                yield text

    def chat_sync(
        self, messages: List[dict], model: Optional[str] = None, timeout: int = 15
    ) -> str:
        """Non-streaming multi-turn completion. Returns the full response string."""
        resolved = self.resolve_model(model)

        if self._provider == "gemini" and not self._is_openrouter_model(resolved):
            genai = self._get_genai()
            sys_msg = next((m["content"] for m in messages if m["role"] == "system"), "")
            user_msgs = [m["content"] for m in messages if m["role"] in ("user", "assistant")]
            gmodel = genai.GenerativeModel(
                model_name=resolved,
                system_instruction=sys_msg if sys_msg else None,
            )
            query = user_msgs[-1] if user_msgs else ""
            response = gmodel.generate_content(
                query, stream=False, generation_config={"max_output_tokens": 2048}
            )
            return getattr(response, "text", "") or ""

        client = self._get_sync_client()
        response = client.chat.completions.create(
            model=resolved, messages=messages, stream=False,
            max_tokens=2048, timeout=timeout,
        )
        return response.choices[0].message.content or ""

    def _get_sync_client(self):
        if self._sync_client is None:
            import openai

            if self._provider == "openrouter":
                api_key = os.getenv("OPENROUTER_API_KEY")
                if not api_key:
                    raise ValueError("OPENROUTER_API_KEY is required")
                self._sync_client = openai.OpenAI(
                    base_url="https://openrouter.ai/api/v1",
                    api_key=api_key,
                )
            else:
                api_key = os.getenv("OPENAI_API_KEY")
                if not api_key:
                    raise ValueError("OPENAI_API_KEY is required")
                self._sync_client = openai.OpenAI(api_key=api_key)
        return self._sync_client

    def _is_openrouter_model(self, model_id: str) -> bool:
        return self._provider == "openrouter" or "/" in model_id

    def _get_genai(self):
        if not self._gemini_configured:
            import google.generativeai as genai
            api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
            if not api_key:
                raise ValueError("GOOGLE_API_KEY is required for Gemini")
            genai.configure(api_key=api_key)
            self._genai = genai
            self._gemini_configured = True
        return self._genai

    def _stream_gemini(self, messages, model) -> Iterator[str]:
        genai = self._get_genai()
        sys_msg = next((m["content"] for m in messages if m["role"] == "system"), "")
        user_msgs = [m["content"] for m in messages if m["role"] in ("user", "assistant")]
        gmodel = genai.GenerativeModel(
            model_name=model,
            system_instruction=sys_msg if sys_msg else None,
        )
        query = user_msgs[-1] if user_msgs else ""
        response = gmodel.generate_content(
            query, stream=True, generation_config={"max_output_tokens": 2048}
        )
        for chunk in response:
            text = getattr(chunk, "text", "") or ""
            if text:
                yield text
