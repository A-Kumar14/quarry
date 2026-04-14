import type { DeepResponse } from '../types/deep';
import type { DiagramSpec } from '../types/diagram';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// ── Corridor / route keyword detector ────────────────────────────────────────

const CORRIDOR_KEYWORDS = /\b(corridor|crossing|border|route|port|maritime|pier|airstrip|checkpoint|passage|convoy)\b/i;

function hasCorridor(deepHistory: DeepResponse[]): boolean {
  return deepHistory.some(d =>
    d.analysis.claims.some(c => CORRIDOR_KEYWORDS.test(c.text)) ||
    d.analysis.gaps.some(g => CORRIDOR_KEYWORDS.test(g.question)) ||
    d.analysis.perspectives.some(p => CORRIDOR_KEYWORDS.test(p.stance))
  );
}

// ── Session summary builder ───────────────────────────────────────────────────
// Compresses prior analyses into a compact text block for the LLM prompt.
// Keeps the payload small while preserving the signal the model needs.

function buildSessionSummary(deepHistory: DeepResponse[]): string {
  const parts: string[] = [];

  deepHistory.forEach((d, i) => {
    parts.push(`[Session turn ${i + 1}]`);

    if (d.analysis.claims.length) {
      parts.push('Claims:');
      d.analysis.claims.slice(0, 5).forEach(c =>
        parts.push(`  - ${c.text} (confidence: ${c.confidence})`)
      );
    }

    if (d.analysis.timeline_events.length) {
      parts.push('Timeline events:');
      d.analysis.timeline_events.slice(0, 6).forEach(e =>
        parts.push(`  - ${e.date}: ${e.event}`)
      );
    }

    if (d.analysis.perspectives.length) {
      parts.push('Perspectives:');
      d.analysis.perspectives.slice(0, 4).forEach(p =>
        parts.push(`  - ${p.actor} (${p.role}): ${p.stance}`)
      );
    }

    if (d.analysis.gaps.length) {
      parts.push('Gaps:');
      d.analysis.gaps.slice(0, 3).forEach(g =>
        parts.push(`  - [${g.severity}] ${g.question}`)
      );
    }
  });

  return parts.join('\n');
}

// ── Heuristic: should we even call the endpoint? ──────────────────────────────
// Avoids a round-trip when there's clearly not enough signal yet.

function isWorthDiagramming(deepHistory: DeepResponse[]): boolean {
  const totalClaims = deepHistory.reduce((n, d) => n + d.analysis.claims.length, 0);
  const totalEvents = deepHistory.reduce((n, d) => n + d.analysis.timeline_events.length, 0);
  const actorSet    = new Set(deepHistory.flatMap(d => d.analysis.perspectives.map(p => p.actor)));

  const hasTimeline   = totalClaims >= 2 && totalEvents >= 2;
  const hasActorGraph = actorSet.size >= 3;
  const hasCorridorMap = actorSet.size >= 2 && hasCorridor(deepHistory);

  return hasTimeline || hasActorGraph || hasCorridorMap;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Given the session's accumulated Deep analyses, decides whether to request
 * a diagram from the backend and returns the spec (or null if none warranted).
 *
 * The function applies a lightweight local heuristic first — if the signal
 * is clearly insufficient it short-circuits without hitting the network.
 *
 * @param deepHistory  Array of DeepResponse objects from prior session turns.
 * @param currentQuery The query that triggered the most recent deep analysis.
 * @param signal       Optional AbortSignal for cancellation.
 */
export async function maybeRequestDiagram(
  deepHistory: DeepResponse[],
  currentQuery: string,
  signal?: AbortSignal,
): Promise<DiagramSpec | null> {
  if (!deepHistory.length) return null;
  if (!isWorthDiagramming(deepHistory)) return null;

  const session_summary = buildSessionSummary(deepHistory);

  try {
    const res = await fetch(`${API}/deep_diagram`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({ query: currentQuery, session_summary }),
    });

    if (!res.ok) return null;

    const spec: DiagramSpec = await res.json();

    // Backend returns { diagramType: null } when it decides no diagram is warranted
    if (!spec.diagramType) return null;

    return spec;
  } catch {
    // Network error or abort — fail silently
    return null;
  }
}
