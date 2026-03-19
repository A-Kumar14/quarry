import re
from typing import Optional

from pydantic import BaseModel, Field, field_validator


def _sanitize_str(v: str) -> str:
    """Strip whitespace, reject null bytes, reject >5 consecutive newlines."""
    v = v.strip()
    if "\x00" in v:
        raise ValueError("null bytes are not allowed")
    if re.search(r"\n{6,}", v):
        raise ValueError("too many consecutive newlines")
    return v


class ExploreSearchRequest(BaseModel):
    query: str = Field(..., max_length=500)
    context: Optional[str] = Field(None, max_length=500)  # previous query for follow-ups
    session_id: Optional[str] = None

    @field_validator("query")
    @classmethod
    def validate_query(cls, v: str) -> str:
        v = _sanitize_str(v)
        if not v:
            raise ValueError("query cannot be empty or whitespace only")
        return v

    @field_validator("context")
    @classmethod
    def validate_context(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return _sanitize_str(v)


class RelatedSearchRequest(BaseModel):
    query: str = Field(..., max_length=500)
    answer_snippet: str = Field("", max_length=1000)

    @field_validator("query")
    @classmethod
    def validate_query(cls, v: str) -> str:
        v = _sanitize_str(v)
        if not v:
            raise ValueError("query cannot be empty or whitespace only")
        return v


class ResearchMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str = Field(..., max_length=8000)


class ResearchRequest(BaseModel):
    messages: list[ResearchMessage] = Field(default_factory=list, max_length=100)
    message: str = Field("", max_length=2000)


class CiteRequest(BaseModel):
    url: str = Field(..., max_length=2000)
    style: str = Field("apa", pattern="^(apa|mla|chicago|bibtex)$")

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        v = v.strip()
        if not v.startswith(("http://", "https://")):
            raise ValueError("url must start with http:// or https://")
        return v
