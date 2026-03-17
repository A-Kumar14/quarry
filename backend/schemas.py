from pydantic import BaseModel, Field
from typing import Optional


class ExploreSearchRequest(BaseModel):
    query: str = Field(..., max_length=500)
    context: Optional[str] = Field(None, max_length=500)  # previous query for follow-ups
    session_id: Optional[str] = None
