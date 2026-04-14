import React from 'react';
import { Box, Typography } from '@mui/material';
import { motion, type Transition } from 'framer-motion';
// DiagramCard is a .js file — CRA allowJs:true handles the import
// @ts-ignore — no type declaration for this JS component
import DiagramCard from './DiagramCard';
import type { DiagramSpec, DiagramNode, DiagramEdge, NodeStatus } from '../types/diagram';

// ── Motion config ─────────────────────────────────────────────────────────────

const BASE: Transition = { duration: 0.28, ease: 'easeOut' };

const MOUNT = {
  initial:    { opacity: 0, scale: 0.98 },
  animate:    { opacity: 1, scale: 1 },
  transition: BASE,
};

const SLIDE = (i: number) => ({
  initial:    { opacity: 0, x: -6 },
  animate:    { opacity: 1, x: 0 },
  transition: { ...BASE, delay: i * 0.06 } as Transition,
});

// ── Design tokens ─────────────────────────────────────────────────────────────

const T = {
  serif:  'var(--font-serif)',
  sans:   'var(--font-family)',
  mono:   'var(--font-mono)',
  fg:     'var(--fg-primary)',
  fgSec:  'var(--fg-secondary)',
  fgDim:  'var(--fg-dim)',
  accent: 'var(--accent)',
  border: 'var(--border)',
  card:   'var(--glass-card-bg)',
  blur:   'var(--glass-card-blur)',
  bdrT:   'var(--glass-card-border-t)',
  bdrL:   'var(--glass-card-border-l)',
  bdrR:   'var(--glass-card-border-r)',
  bdrB:   'var(--glass-card-border-b)',
  shadow: 'var(--glass-card-shadow)',
} as const;

const cardStyle: React.CSSProperties = {
  background:          T.card,
  backdropFilter:      T.blur,
  WebkitBackdropFilter: T.blur,
  borderRadius:        14,
  borderTop:    `1px solid ${T.bdrT}`,
  borderLeft:   `1px solid ${T.bdrL}`,
  borderRight:  `1px solid ${T.bdrR}`,
  borderBottom: `1px solid ${T.bdrB}`,
  boxShadow:    T.shadow,
  padding:      '16px 18px',
};

// ── Status colours ────────────────────────────────────────────────────────────

const NODE_STATUS_COLOR: Record<NodeStatus, string> = {
  operational: '#22c55e',
  blocked:     '#ef4444',
  proposed:    '#f59e0b',
  suspended:   '#94a3b8',
  unknown:     '#6b7280',
};

// ── Diagram header ────────────────────────────────────────────────────────────

function DiagramHeader({ title, diagramType, confidence }: {
  title: string;
  diagramType: string;
  confidence?: string;
}) {
  const typeLabel: Record<string, string> = {
    timeline:    'Timeline',
    actorGraph:  'Actor Graph',
    corridorMap: 'Corridor Map',
  };
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      mb: 1.5,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Box sx={{
          width: 6, height: 6, borderRadius: '50%',
          background: T.accent,
          boxShadow: `0 0 7px rgba(249,115,22,0.55)`,
        }} />
        <Typography sx={{
          fontFamily: T.serif, fontSize: '0.88rem', fontWeight: 600,
          color: T.fg, lineHeight: 1.3,
        }}>
          {title}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Box sx={{
          fontFamily: T.mono, fontSize: '0.56rem', fontWeight: 600,
          color: T.fgDim, background: 'rgba(249,115,22,0.08)',
          border: '1px solid rgba(249,115,22,0.20)',
          borderRadius: '5px', px: '6px', py: '2px',
        }}>
          {typeLabel[diagramType] ?? diagramType}
        </Box>
        {confidence && (
          <Box sx={{
            fontFamily: T.mono, fontSize: '0.56rem',
            color: T.fgDim, borderRadius: '5px', px: '5px', py: '2px',
            border: `1px solid ${T.border}`,
          }}>
            {confidence}
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ── TIMELINE renderer ─────────────────────────────────────────────────────────
// Custom JSX — Mermaid's timeline diagram type is too limited.

function TimelineView({ nodes, meta }: { nodes: DiagramNode[]; meta: DiagramSpec['meta'] }) {
  // Sort by date string (ISO sort works for YYYY-MM-DD; approximates sort alphabetically)
  const sorted = [...nodes].sort((a, b) => {
    const da = a.meta?.date ?? '';
    const db = b.meta?.date ?? '';
    return String(da).localeCompare(String(db));
  });

  return (
    <Box>
      {meta.context && (
        <Typography sx={{
          fontFamily: T.sans, fontSize: '0.72rem',
          color: T.fgSec, lineHeight: 1.5, mb: 1.5,
        }}>
          {meta.context}
        </Typography>
      )}
      <Box sx={{
        position: 'relative', pl: '20px',
        '&::before': {
          content: '""',
          position: 'absolute', left: '7px', top: '6px',
          bottom: '6px', width: '1.5px',
          background: `linear-gradient(to bottom, ${T.accent}, rgba(249,115,22,0.15))`,
          borderRadius: '2px',
        },
      }}>
        {sorted.map((node, i) => (
          <motion.div key={node.id} {...SLIDE(i)}>
            <Box sx={{
              position: 'relative', mb: i < sorted.length - 1 ? 1.75 : 0,
              '&::before': {
                content: '""',
                position: 'absolute', left: '-16px', top: '5px',
                width: 8, height: 8, borderRadius: '50%',
                background: T.accent,
                boxShadow: `0 0 6px rgba(249,115,22,0.50)`,
                border: '1.5px solid rgba(255,255,255,0.6)',
              },
            }}>
              {node.meta?.date && (
                <Typography sx={{
                  fontFamily: T.mono, fontSize: '0.60rem',
                  color: T.accent, mb: '3px',
                }}>
                  {String(node.meta.date)}
                </Typography>
              )}
              <Typography sx={{
                fontFamily: T.sans, fontSize: '0.78rem', fontWeight: 500,
                color: T.fg, lineHeight: 1.5,
              }}>
                {node.label}
              </Typography>
              {node.meta?.description && (
                <Typography sx={{
                  fontFamily: T.sans, fontSize: '0.71rem',
                  color: T.fgSec, lineHeight: 1.5, mt: '2px',
                }}>
                  {String(node.meta.description)}
                </Typography>
              )}
            </Box>
          </motion.div>
        ))}
      </Box>
    </Box>
  );
}

// ── Mermaid compilers ─────────────────────────────────────────────────────────

function compileActorGraph(nodes: DiagramNode[], edges: DiagramEdge[]): string {
  const lines: string[] = ['flowchart LR'];

  // Node definitions — group by type using subgraphs for cleaner layout
  const typeGroups: Record<string, DiagramNode[]> = {};
  nodes.forEach(n => {
    const t = n.type ?? 'unknown';
    if (!typeGroups[t]) typeGroups[t] = [];
    typeGroups[t].push(n);
  });

  // Emit nodes with rounded rectangles; escape labels
  nodes.forEach(n => {
    const label = n.label.replace(/"/g, "'");
    lines.push(`  ${n.id}("${label}")`);
  });

  // Edges
  edges.forEach(e => {
    const label = e.label ? `|"${e.label.replace(/"/g, "'")}"| ` : '';
    if (e.status === 'blocked' || e.status === 'contested') {
      lines.push(`  ${e.source} -. ${label}-> ${e.target}`);
    } else {
      lines.push(`  ${e.source} --> ${label}${e.target}`);
    }
  });

  return lines.join('\n');
}

function compileCorridorMap(nodes: DiagramNode[], edges: DiagramEdge[]): string {
  const lines: string[] = ['flowchart TD'];

  nodes.forEach(n => {
    const label = n.label.replace(/"/g, "'");
    const color = NODE_STATUS_COLOR[n.status ?? 'unknown'];
    // Use different shapes to distinguish location types
    const isCrossing = n.type === 'border_crossing' || n.type === 'port' || n.type === 'maritime_corridor';
    const shape = isCrossing ? `{{"${label}"}}` : `["${label}"]`;
    lines.push(`  ${n.id}${shape}`);
    // Inline style for status colour
    lines.push(`  style ${n.id} fill:${color}22,stroke:${color},color:#26180a`);
  });

  edges.forEach(e => {
    const label = e.label ? `|"${e.label.replace(/"/g, "'")}"| ` : '';
    if (e.status === 'blocked') {
      lines.push(`  ${e.source} -. ${label}X ${e.target}`);
    } else if (e.status === 'proposed') {
      lines.push(`  ${e.source} -.-> ${label}${e.target}`);
    } else {
      lines.push(`  ${e.source} --> ${label}${e.target}`);
    }
  });

  return lines.join('\n');
}

// ── Legend for corridor map ───────────────────────────────────────────────────

const STATUS_LABELS: [NodeStatus, string][] = [
  ['operational', 'Operational'],
  ['blocked',     'Blocked'],
  ['proposed',    'Proposed'],
  ['suspended',   'Suspended'],
];

function CorridorLegend() {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 1 }}>
      {STATUS_LABELS.map(([status, label]) => (
        <Box key={status} sx={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '2px', background: NODE_STATUS_COLOR[status] }} />
          <Typography sx={{ fontFamily: T.mono, fontSize: '0.59rem', color: T.fgDim }}>{label}</Typography>
        </Box>
      ))}
    </Box>
  );
}

// ── DeepDiagram (public API) ──────────────────────────────────────────────────

interface DeepDiagramProps {
  spec: DiagramSpec;
}

export default function DeepDiagram({ spec }: DeepDiagramProps) {
  // Should not be mounted with a null spec, but guard anyway
  if (!spec.diagramType) return null;

  return (
    <motion.div {...MOUNT}>
      <Box style={cardStyle}>
        <DiagramHeader
          title={spec.title || spec.diagramType}
          diagramType={spec.diagramType}
          confidence={spec.meta.confidence}
        />

        {/* ── Timeline ─────────────────────────────────────────────────────── */}
        {spec.diagramType === 'timeline' && (
          <TimelineView nodes={spec.nodes} meta={spec.meta} />
        )}

        {/* ── Actor Graph ───────────────────────────────────────────────────── */}
        {spec.diagramType === 'actorGraph' && (
          <motion.div {...SLIDE(0)}>
            {spec.meta.context && (
              <Typography sx={{
                fontFamily: T.sans, fontSize: '0.72rem',
                color: T.fgSec, lineHeight: 1.5, mb: 1,
              }}>
                {spec.meta.context}
              </Typography>
            )}
            <DiagramCard chartCode={compileActorGraph(spec.nodes, spec.edges)} />
          </motion.div>
        )}

        {/* ── Corridor Map ──────────────────────────────────────────────────── */}
        {spec.diagramType === 'corridorMap' && (
          <motion.div {...SLIDE(0)}>
            {spec.meta.context && (
              <Typography sx={{
                fontFamily: T.sans, fontSize: '0.72rem',
                color: T.fgSec, lineHeight: 1.5, mb: 1,
              }}>
                {spec.meta.context}
              </Typography>
            )}
            <DiagramCard chartCode={compileCorridorMap(spec.nodes, spec.edges)} />
            <CorridorLegend />
          </motion.div>
        )}

        {/* ── Footer context ────────────────────────────────────────────────── */}
        {spec.meta.date_range && (
          <Typography sx={{
            fontFamily: T.mono, fontSize: '0.59rem',
            color: T.fgDim, mt: 1.5,
          }}>
            Period: {spec.meta.date_range}
          </Typography>
        )}
      </Box>
    </motion.div>
  );
}
