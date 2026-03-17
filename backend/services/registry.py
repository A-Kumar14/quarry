"""
services/registry.py — Module-level service singletons.
All heavy work is deferred to first use — no I/O at import time.
"""

from services.llm import LLMService
from services.ai_service import AIService

llm_service = LLMService()
ai_service = AIService()
