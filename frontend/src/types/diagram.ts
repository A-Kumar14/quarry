// ── Diagram spec TypeScript types ─────────────────────────────────────────────
// Mirrors DiagramSpec Pydantic model in backend/schemas.py

export type DiagramType = 'timeline' | 'actorGraph' | 'corridorMap';

export type NodeStatus = 'operational' | 'blocked' | 'proposed' | 'suspended' | 'unknown';
export type EdgeStatus = 'active' | 'blocked' | 'proposed' | 'contested';

export type ActorNodeType =
  | 'state' | 'ngo' | 'wire' | 'armed_group'
  | 'intergovernmental' | 'media' | 'unknown';

export type CorridorNodeType =
  | 'border_crossing' | 'port' | 'warehouse'
  | 'city' | 'airstrip' | 'maritime_corridor' | 'unknown';

export interface DiagramNodeMeta {
  // timeline
  date?: string;
  description?: string;
  // anything extra
  [key: string]: unknown;
}

export interface DiagramNode {
  id: string;
  label: string;
  type?: ActorNodeType | CorridorNodeType | string;
  status?: NodeStatus;
  meta?: DiagramNodeMeta;
}

export interface DiagramEdge {
  source: string;   // node id
  target: string;   // node id
  label?: string;
  status?: EdgeStatus;
  meta?: Record<string, unknown>;
}

export interface DiagramMeta {
  context?: string;
  date_range?: string;
  confidence?: 'high' | 'medium' | 'low';
  source_queries?: string[];
}

/** A null diagramType means the LLM decided no diagram is warranted. */
export interface DiagramSpec {
  diagramType: DiagramType | null;
  title: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  meta: DiagramMeta;
}
