// ── Deep Analysis TypeScript types ────────────────────────────────────────────
// Mirror of the Pydantic schema in backend/schemas.py

export type Confidence = 'high' | 'medium' | 'low' | 'contested';
export type GapSeverity = 'critical' | 'moderate' | 'minor';
export type SourceRole =
  | 'state'
  | 'ngo'
  | 'wire'
  | 'local'
  | 'academic'
  | 'think_tank'
  | 'corporate'
  | 'unknown';

export interface SourceRef {
  title: string;
  url: string;
  quote: string | null;
}

export interface Claim {
  text: string;
  confidence: Confidence;
  sources: SourceRef[];
}

export interface Gap {
  question: string;
  why_it_matters: string;
  severity: GapSeverity;
}

export interface TimelineEvent {
  date: string;       // ISO 8601 or approximate e.g. "early 2024"
  event: string;
  source_url: string | null;
}

export interface Perspective {
  actor: string;
  role: SourceRole;
  stance: string;
  url: string | null;
}

export interface DeepAnalysis {
  claims: Claim[];
  gaps: Gap[];
  timeline_events: TimelineEvent[];
  perspectives: Perspective[];
}

export interface DeepResponse {
  answer: string;
  analysis: DeepAnalysis;
}

// Shape passed from ExplorePage via sessionContext
export interface SessionSource {
  title: string;
  url: string;
  snippet: string;
  markdown?: string;
}

export interface SessionContext {
  sources: SessionSource[];
}
