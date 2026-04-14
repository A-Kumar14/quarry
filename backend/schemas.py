import re
from typing import Any, Dict, List, Literal, Optional, Union

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
    file_context: Optional[str] = Field(None, max_length=15000)


class OutlineRequest(BaseModel):
    query: str = Field(..., max_length=500)
    context: str = Field("", max_length=3000)

    @field_validator("query")
    @classmethod
    def validate_query(cls, v: str) -> str:
        v = _sanitize_str(v)
        if not v:
            raise ValueError("query cannot be empty")
        return v


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


# ── Deep Analysis schema ──────────────────────────────────────────────────────

class DeepSourceRef(BaseModel):
    """A single source backing a claim."""
    title: str = Field(..., description="Title of the source article or page")
    url: str = Field(..., description="Full URL of the source")
    quote: Optional[str] = Field(
        None,
        description="Verbatim or near-verbatim excerpt from the source supporting the claim. Null if no direct quote available.",
    )


class DeepClaim(BaseModel):
    """A key factual claim extracted from the sources."""
    text: str = Field(..., description="The claim, stated as a complete, standalone sentence")
    confidence: Literal["high", "medium", "low", "contested"] = Field(
        ...,
        description=(
            "high — multiple independent sources agree; "
            "medium — one strong source or paraphrase of official statement; "
            "low — single peripheral source or inference; "
            "contested — sources actively disagree on this point"
        ),
    )
    sources: List[DeepSourceRef] = Field(
        default_factory=list,
        description="Sources that directly support or contest this claim",
    )


class DeepGap(BaseModel):
    """An unanswered question or missing piece of evidence."""
    question: str = Field(
        ...,
        description="The specific thing that is not answered by the available sources, framed as a question",
    )
    why_it_matters: str = Field(
        ...,
        description="One sentence explaining the epistemic or research significance of this gap",
    )
    severity: Literal["critical", "moderate", "minor"] = Field(
        ...,
        description=(
            "critical — gap makes it impossible to draw a reliable conclusion; "
            "moderate — gap weakens the analysis but a partial conclusion is still possible; "
            "minor — gap is interesting but does not materially affect the main finding"
        ),
    )


class DeepTimelineEvent(BaseModel):
    """A dated event relevant to the query."""
    date: str = Field(
        ...,
        description="ISO 8601 date (YYYY-MM-DD) or approximate string like '2024-Q3' or 'early 2023'",
    )
    event: str = Field(..., description="What happened, in one concise sentence")
    source_url: Optional[str] = Field(
        None, description="URL of the source mentioning this event"
    )


class DeepPerspective(BaseModel):
    """The stance of a source actor (outlet, org, government body, etc.)."""
    actor: str = Field(
        ...,
        description="Name of the outlet, organisation, government body, or source category",
    )
    role: Literal["state", "ngo", "wire", "local", "academic", "think_tank", "corporate", "unknown"] = Field(
        ...,
        description="Institutional role of the actor",
    )
    stance: str = Field(
        ...,
        description="1-2 sentence characterisation of this actor's position or framing on the topic",
    )
    url: Optional[str] = Field(None, description="Representative URL for this actor's coverage")


class DeepAnalysis(BaseModel):
    """Structured epistemic breakdown of a query — machine-readable, suitable for diagrams."""
    claims: List[DeepClaim] = Field(
        default_factory=list,
        description="Key factual claims found in the sources, each with confidence and attribution",
    )
    gaps: List[DeepGap] = Field(
        default_factory=list,
        description="Unanswered questions and missing evidence identified in the source pool",
    )
    timeline_events: List[DeepTimelineEvent] = Field(
        default_factory=list,
        description="Chronological events relevant to the query. Empty list if no timeline is discernible.",
    )
    perspectives: List[DeepPerspective] = Field(
        default_factory=list,
        description="Editorial stances and roles of the sources covering this topic",
    )


class DeepAnalysisResponse(BaseModel):
    """Full response returned by /deep_analyze."""
    answer: str = Field(
        ...,
        description="Concise natural-language answer (2-4 paragraphs, markdown allowed). No chain-of-thought.",
    )
    analysis: DeepAnalysis


# ── Deep Analysis request ─────────────────────────────────────────────────────

class DeepSourceContext(BaseModel):
    """A single source passed in from the frontend session."""
    title: str = Field("", max_length=500)
    url: str = Field("", max_length=2000)
    snippet: str = Field("", max_length=1000)
    markdown: str = Field("", max_length=6000)


class DeepAnalyzeRequest(BaseModel):
    query: str = Field(..., max_length=500)
    session_context: Optional[Dict[str, Any]] = Field(
        None,
        description=(
            "Optional context from the current session. "
            "Expected keys: sources (list of {title, url, snippet, markdown})"
        ),
    )

    @field_validator("query")
    @classmethod
    def validate_query(cls, v: str) -> str:
        v = _sanitize_str(v)
        if not v:
            raise ValueError("query cannot be empty")
        return v


# ── Deep Diagram schema ───────────────────────────────────────────────────────

class DiagramNode(BaseModel):
    id: str = Field(..., description="Unique identifier for this node")
    label: str = Field(..., description="Human-readable label shown on the diagram")
    type: Optional[str] = Field(
        None,
        description=(
            "actorGraph: 'state' | 'ngo' | 'wire' | 'armed_group' | 'intergovernmental' | 'unknown'. "
            "corridorMap: 'border_crossing' | 'port' | 'warehouse' | 'city' | 'airstrip' | 'unknown'. "
            "timeline: unused."
        ),
    )
    status: Optional[Literal["operational", "blocked", "proposed", "suspended", "unknown"]] = Field(
        None,
        description="Operational status — relevant for corridorMap nodes",
    )
    meta: Optional[Dict[str, Any]] = Field(
        None,
        description=(
            "timeline: { date: str, description: str }. "
            "actorGraph/corridorMap: any extra display hints."
        ),
    )


class DiagramEdge(BaseModel):
    source: str = Field(..., description="id of the source node")
    target: str = Field(..., description="id of the target node")
    label: Optional[str] = Field(
        None,
        description="Relation label e.g. 'opens corridor', 'blocks aid', 'coordinates with'",
    )
    status: Optional[Literal["active", "blocked", "proposed", "contested"]] = Field(
        None,
        description="Status of this relation / route",
    )
    meta: Optional[Dict[str, Any]] = None


class DiagramMeta(BaseModel):
    context: Optional[str] = Field(
        None,
        description="One-sentence context e.g. 'Gaza humanitarian access, April 2024'",
    )
    date_range: Optional[str] = Field(
        None,
        description="Timeline date range e.g. '2023-10 – 2024-04'",
    )
    confidence: Optional[Literal["high", "medium", "low"]] = Field(
        None,
        description="How confident the model is that this diagram is accurate",
    )
    source_queries: Optional[List[str]] = Field(
        None,
        description="The session queries that contributed to this diagram",
    )


class DiagramSpec(BaseModel):
    """
    A compact, machine-readable diagram specification.
    `diagramType: null` signals that no diagram is warranted for this session.
    """
    diagram_type: Optional[Literal["timeline", "actorGraph", "corridorMap"]] = Field(
        None,
        alias="diagramType",
        description="null → no diagram warranted",
    )
    title: str = Field("", description="Short diagram title (max ~8 words)")
    nodes: List[DiagramNode] = Field(default_factory=list)
    edges: List[DiagramEdge] = Field(default_factory=list)
    meta: DiagramMeta = Field(default_factory=DiagramMeta)

    model_config = {"populate_by_name": True}


# ── Deep Diagram request ──────────────────────────────────────────────────────

class DeepDiagramRequest(BaseModel):
    query: str = Field(..., max_length=500)
    session_summary: str = Field(
        "",
        max_length=5000,
        description="Compressed text summary of prior Deep analyses in this session",
    )

    @field_validator("query")
    @classmethod
    def validate_query(cls, v: str) -> str:
        v = _sanitize_str(v)
        if not v:
            raise ValueError("query cannot be empty")
        return v
