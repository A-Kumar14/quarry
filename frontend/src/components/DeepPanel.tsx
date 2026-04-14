import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Skeleton, Tooltip } from '@mui/material';
import { motion, AnimatePresence, type Transition } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useDeepAnalysis } from '../hooks/useDeepAnalysis';
import { maybeRequestDiagram } from '../utils/maybeRequestDiagram';
import type { DiagramSpec } from '../types/diagram';
import type { DeepResponse } from '../types/deep';
import RadialOrbitalTimeline, { type OrbitalTimelineItem } from './ui/radial-orbital-timeline';
import type {
  Claim,
  Gap,
  TimelineEvent,
  Perspective,
  SessionContext,
  Confidence,
  GapSeverity,
  SourceRole,
} from '../types/deep';

// ── Design tokens (mirrors ExplorePage / CLAUDE.md system) ───────────────────

const T = {
  serif:      'var(--font-serif)',
  sans:       'var(--font-family)',
  mono:       'var(--font-mono)',
  fg:         'var(--fg-primary)',
  fgSec:      'var(--fg-secondary)',
  fgDim:      'var(--fg-dim)',
  accent:     'var(--accent)',
  accentDim:  'rgba(249,115,22,0.10)',
  accentBdr:  'rgba(249,115,22,0.30)',
  border:     'var(--border)',
  card:       'var(--glass-card-bg)',
  cardBlur:   'var(--glass-card-blur)',
  cardBdrT:   'var(--glass-card-border-t)',
  cardBdrL:   'var(--glass-card-border-l)',
  cardBdrR:   'var(--glass-card-border-r)',
  cardBdrB:   'var(--glass-card-border-b)',
  cardShadow: 'var(--glass-card-shadow)',
} as const;

const card: React.CSSProperties = {
  background:          T.card,
  backdropFilter:      T.cardBlur,
  WebkitBackdropFilter: T.cardBlur,
  borderRadius:        14,
  borderTop:    `1px solid ${T.cardBdrT}`,
  borderLeft:   `1px solid ${T.cardBdrL}`,
  borderRight:  `1px solid ${T.cardBdrR}`,
  borderBottom: `1px solid ${T.cardBdrB}`,
  boxShadow:    T.cardShadow,
  padding:      '16px 18px',
};

// ── Motion config — subtle only ───────────────────────────────────────────────

const BASE_TRANSITION: Transition = { duration: 0.22, ease: 'easeOut' };

const FADE_UP = {
  initial:    { opacity: 0, y: 8 },
  animate:    { opacity: 1, y: 0 },
  exit:       { opacity: 0, y: -4 },
  transition: BASE_TRANSITION,
};

const STAGGER = (i: number) => ({
  ...FADE_UP,
  transition: { ...BASE_TRANSITION, delay: i * 0.055 } as Transition,
});

// ── Colour helpers ────────────────────────────────────────────────────────────

const CONFIDENCE_COLOR: Record<Confidence, string> = {
  high:      '#22c55e',
  medium:    '#f59e0b',
  low:       '#94a3b8',
  contested: '#ef4444',
};

const GAP_COLOR: Record<GapSeverity, string> = {
  critical: '#ef4444',
  moderate: '#f59e0b',
  minor:    '#94a3b8',
};

const ROLE_LABEL: Record<SourceRole, string> = {
  state:      'State',
  ngo:        'NGO',
  wire:       'Wire',
  local:      'Local',
  academic:   'Academic',
  think_tank: 'Think Tank',
  corporate:  'Corporate',
  unknown:    'Unknown',
};

const ROLE_COLOR: Record<SourceRole, string> = {
  state:      '#6366f1',
  ngo:        '#22c55e',
  wire:       '#f59e0b',
  local:      '#ec4899',
  academic:   '#0ea5e9',
  think_tank: '#8b5cf6',
  corporate:  '#94a3b8',
  unknown:    '#6b7280',
};

// ── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography sx={{
      fontFamily:    T.sans,
      fontSize:      '0.58rem',
      fontWeight:    600,
      letterSpacing: '0.13em',
      textTransform: 'uppercase',
      color:         T.fgDim,
      mb:            1.5,
    }}>
      {children}
    </Typography>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────

function DeepSkeleton() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Answer skeleton */}
      <Box sx={{ ...card, p: 2 }}>
        <Skeleton variant="text" width="55%" height={14} sx={{ bgcolor: 'var(--bg-tertiary)', mb: 1.5 }} />
        {[90, 75, 85, 60].map((w, i) => (
          <Skeleton key={i} variant="text" width={`${w}%`} height={12}
            sx={{ bgcolor: 'var(--bg-tertiary)', mb: 0.6 }} />
        ))}
      </Box>
      {/* Claims skeleton */}
      <Box sx={{ ...card, p: 2 }}>
        <Skeleton variant="text" width="35%" height={11} sx={{ bgcolor: 'var(--bg-tertiary)', mb: 1.5 }} />
        {[1, 2, 3].map(i => (
          <Box key={i} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'flex-start' }}>
            <Skeleton variant="circular" width={8} height={8} sx={{ bgcolor: 'var(--bg-tertiary)', mt: '4px', flexShrink: 0 }} />
            <Skeleton variant="text" width="80%" height={12} sx={{ bgcolor: 'var(--bg-tertiary)' }} />
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ── Answer block ──────────────────────────────────────────────────────────────

const ANSWER_PROSE: object = {
  '& p':     { fontFamily: T.sans, fontSize: '0.85rem', fontWeight: 300, lineHeight: 1.8, color: T.fg, my: 0.75 },
  '& strong':{ fontWeight: 600 },
  '& a':     { color: T.accent, textDecorationColor: T.accentBdr },
  '& h1,& h2,& h3': { fontFamily: T.serif, fontWeight: 600, color: T.fg, mt: 1.5, mb: 0.5 },
  '& ul,& ol': { pl: 2.5, my: 0.5 },
  '& li':    { fontFamily: T.sans, fontSize: '0.84rem', lineHeight: 1.75, color: T.fg },
};

function AnswerBlock({ answer }: { answer: string }) {
  return (
    <motion.div {...FADE_UP}>
      <Box style={card}>
        <SectionLabel>Answer</SectionLabel>
        <Box sx={ANSWER_PROSE}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
        </Box>
      </Box>
    </motion.div>
  );
}

// ── Claims card ───────────────────────────────────────────────────────────────

function ClaimsCard({ claims }: { claims: Claim[] }) {
  if (!claims.length) return null;
  return (
    <motion.div {...STAGGER(0)}>
      <Box style={card}>
        <SectionLabel>Key Claims</SectionLabel>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {claims.map((claim, i) => {
            const color = CONFIDENCE_COLOR[claim.confidence];
            const single = claim.sources.length === 1;
            return (
              <motion.div key={i} {...STAGGER(i)}>
                <Box sx={{
                  display: 'flex', alignItems: 'flex-start', gap: '8px',
                  p: '10px 12px', borderRadius: '10px',
                  background: `${color}08`,
                  border: `1px solid ${color}22`,
                }}>
                  {/* Confidence dot */}
                  <Box sx={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: color, mt: '5px', flexShrink: 0,
                    boxShadow: `0 0 5px ${color}55`,
                  }} />

                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{
                      fontFamily: T.sans, fontSize: '0.78rem',
                      color: T.fg, lineHeight: 1.55,
                    }}>
                      {claim.text}
                    </Typography>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: '5px', flexWrap: 'wrap' }}>
                      {/* Source count */}
                      <Typography sx={{
                        fontFamily: T.mono, fontSize: '0.59rem',
                        color: T.fgDim,
                      }}>
                        {claim.sources.length} source{claim.sources.length !== 1 ? 's' : ''}
                      </Typography>

                      {/* Single-source warning badge */}
                      {single && (
                        <Tooltip title="Only one source backs this claim — verify independently" placement="top">
                          <Box sx={{
                            fontFamily: T.mono, fontSize: '0.56rem',
                            background: 'rgba(245,158,11,0.12)',
                            border: '1px solid rgba(245,158,11,0.35)',
                            borderRadius: '5px', px: '5px', py: '1px',
                            color: '#b45309', cursor: 'default',
                          }}>
                            single source
                          </Box>
                        </Tooltip>
                      )}

                      {/* Confidence label */}
                      <Box sx={{
                        fontFamily: T.mono, fontSize: '0.56rem',
                        color, background: `${color}12`,
                        border: `1px solid ${color}30`,
                        borderRadius: '5px', px: '5px', py: '1px',
                      }}>
                        {claim.confidence}
                      </Box>
                    </Box>

                    {/* Source titles on hover — show top 2 */}
                    {claim.sources.length > 0 && (
                      <Box sx={{ mt: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {claim.sources.slice(0, 2).map((s, j) => (
                          <Typography key={j} component="a"
                            href={s.url} target="_blank" rel="noopener noreferrer"
                            sx={{
                              fontFamily: T.mono, fontSize: '0.58rem',
                              color: T.fgDim, textDecoration: 'none',
                              overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                              '&:hover': { color: T.accent },
                            }}
                          >
                            ↗ {s.title || (() => { try { return new URL(s.url).hostname.replace('www.',''); } catch { return s.url; } })()}
                          </Typography>
                        ))}
                      </Box>
                    )}
                  </Box>
                </Box>
              </motion.div>
            );
          })}
        </Box>
      </Box>
    </motion.div>
  );
}

// ── Gaps card ─────────────────────────────────────────────────────────────────

interface GapsCardProps {
  gaps: Gap[];
  onPromptAsk: (question: string) => void;
}

function GapsCard({ gaps, onPromptAsk }: GapsCardProps) {
  if (!gaps.length) return null;
  return (
    <motion.div {...STAGGER(1)}>
      <Box style={card}>
        <SectionLabel>Research Gaps</SectionLabel>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {gaps.map((gap, i) => {
            const color = GAP_COLOR[gap.severity];
            return (
              <motion.div key={i} {...STAGGER(i)}>
                <Box sx={{
                  p: '10px 12px', borderRadius: '10px',
                  background: `${color}07`,
                  border: `1px solid ${color}20`,
                }}>
                  {/* Question + severity */}
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: '5px' }}>
                    <Typography sx={{
                      fontFamily: T.sans, fontSize: '0.77rem', fontWeight: 500,
                      color: T.fg, lineHeight: 1.5, flex: 1,
                    }}>
                      {gap.question}
                    </Typography>
                    <Box sx={{
                      fontFamily: T.mono, fontSize: '0.55rem',
                      color, background: `${color}12`,
                      border: `1px solid ${color}30`,
                      borderRadius: '5px', px: '5px', py: '1px',
                      flexShrink: 0, alignSelf: 'flex-start', mt: '2px',
                    }}>
                      {gap.severity}
                    </Box>
                  </Box>

                  {/* Why it matters */}
                  <Typography sx={{
                    fontFamily: T.sans, fontSize: '0.72rem',
                    color: T.fgSec, lineHeight: 1.5, mb: '8px',
                  }}>
                    {gap.why_it_matters}
                  </Typography>

                  {/* Prompt Ask */}
                  <Box
                    component="button"
                    onClick={() => onPromptAsk(gap.question)}
                    sx={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      fontFamily: T.sans, fontSize: '0.67rem', fontWeight: 500,
                      color: T.accent, background: T.accentDim,
                      border: `1px solid ${T.accentBdr}`,
                      borderRadius: '7px', px: '9px', py: '4px',
                      cursor: 'pointer', transition: 'all 0.14s',
                      '&:hover': { background: 'rgba(249,115,22,0.18)' },
                    }}
                  >
                    Investigate →
                  </Box>
                </Box>
              </motion.div>
            );
          })}
        </Box>
      </Box>
    </motion.div>
  );
}

// ── Timeline strip ────────────────────────────────────────────────────────────

function TimelineStrip({ events }: { events: TimelineEvent[] }) {
  if (!events.length) return null;
  return (
    <motion.div {...STAGGER(2)}>
      <Box style={card}>
        <SectionLabel>Timeline</SectionLabel>
        <Box sx={{
          position: 'relative',
          pl: '18px',
          '&::before': {
            content: '""',
            position: 'absolute', left: '6px',
            top: 0, bottom: 0,
            width: '1px',
            background: T.accentBdr,
          },
        }}>
          {events.map((ev, i) => (
            <motion.div key={i} {...STAGGER(i)}>
              <Box sx={{
                position: 'relative', mb: i < events.length - 1 ? 1.5 : 0,
                '&::before': {
                  content: '""',
                  position: 'absolute', left: '-15px', top: '6px',
                  width: 6, height: 6, borderRadius: '50%',
                  background: T.accent,
                  boxShadow: `0 0 6px rgba(249,115,22,0.45)`,
                },
              }}>
                <Typography sx={{
                  fontFamily: T.mono, fontSize: '0.59rem',
                  color: T.accent, mb: '2px',
                }}>
                  {ev.date}
                </Typography>
                <Typography sx={{
                  fontFamily: T.sans, fontSize: '0.76rem',
                  color: T.fg, lineHeight: 1.5,
                }}>
                  {ev.source_url ? (
                    <Box component="a" href={ev.source_url}
                      target="_blank" rel="noopener noreferrer"
                      sx={{ color: T.fg, textDecoration: 'none', '&:hover': { color: T.accent } }}>
                      {ev.event}
                    </Box>
                  ) : ev.event}
                </Typography>
              </Box>
            </motion.div>
          ))}
        </Box>
      </Box>
    </motion.div>
  );
}

// ── Perspectives footer ───────────────────────────────────────────────────────

function PerspectivesFooter({ perspectives }: { perspectives: Perspective[] }) {
  if (!perspectives.length) return null;
  return (
    <motion.div {...STAGGER(3)}>
      <Box style={card}>
        <SectionLabel>Perspectives</SectionLabel>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {perspectives.map((p, i) => {
            const color = ROLE_COLOR[p.role];
            return (
              <motion.div key={i} {...STAGGER(i)}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: '9px' }}>
                  {/* Role badge */}
                  <Box sx={{
                    fontFamily: T.mono, fontSize: '0.55rem', fontWeight: 600,
                    color, background: `${color}12`,
                    border: `1px solid ${color}30`,
                    borderRadius: '5px', px: '6px', py: '2px',
                    flexShrink: 0, mt: '2px',
                    whiteSpace: 'nowrap',
                  }}>
                    {ROLE_LABEL[p.role]}
                  </Box>

                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    {/* Actor name */}
                    <Typography sx={{
                      fontFamily: T.sans, fontSize: '0.74rem', fontWeight: 500,
                      color: T.fg,
                      overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                    }}>
                      {p.url ? (
                        <Box component="a" href={p.url}
                          target="_blank" rel="noopener noreferrer"
                          sx={{ color: T.fg, textDecoration: 'none', '&:hover': { color: T.accent } }}>
                          {p.actor}
                        </Box>
                      ) : p.actor}
                    </Typography>
                    {/* Stance */}
                    <Typography sx={{
                      fontFamily: T.sans, fontSize: '0.71rem',
                      color: T.fgSec, lineHeight: 1.5, mt: '2px',
                    }}>
                      {p.stance}
                    </Typography>
                  </Box>
                </Box>
              </motion.div>
            );
          })}
        </Box>
      </Box>
    </motion.div>
  );
}

// ── Error state ───────────────────────────────────────────────────────────────

function DeepError({ message }: { message: string }) {
  return (
    <motion.div {...FADE_UP}>
      <Box style={{
        ...card,
        borderColor: 'rgba(239,68,68,0.25)',
        background: 'rgba(239,68,68,0.05)',
      }}>
        <Typography sx={{
          fontFamily: T.sans, fontSize: '0.78rem',
          color: '#ef4444', lineHeight: 1.6,
        }}>
          Deep analysis failed: {message}
        </Typography>
      </Box>
    </motion.div>
  );
}

// ── DeepPanel (public API) ────────────────────────────────────────────────────

interface DeepPanelProps {
  query: string;
  sessionContext: SessionContext | null;
  onPromptAsk?: (question: string) => void;
}

export default function DeepPanel({ query, sessionContext, onPromptAsk }: DeepPanelProps) {
  const { answer, analysis, isLoading, error } = useDeepAnalysis(query, sessionContext);
  const [timelineSpec, setTimelineSpec] = useState<DiagramSpec | null>(null);

  const handlePromptAsk = (question: string) => {
    onPromptAsk?.(question);
  };

  useEffect(() => {
    if (!query || !answer || !analysis || isLoading || error) {
      setTimelineSpec(null);
      return;
    }
    if ((analysis.timeline_events || []).length < 2) {
      setTimelineSpec(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const deepTurn: DeepResponse = { answer, analysis };
    maybeRequestDiagram([deepTurn], query, controller.signal).then((spec) => {
      if (cancelled) return;
      if (spec?.diagramType === 'timeline') setTimelineSpec(spec);
      else setTimelineSpec(null);
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [query, answer, analysis, isLoading, error]);

  const orbitalItems = useMemo<OrbitalTimelineItem[]>(() => {
    if (!timelineSpec || timelineSpec.diagramType !== 'timeline') return [];
    const edgeMap = new Map<string, Set<string>>();
    (timelineSpec.edges || []).forEach((e) => {
      if (!edgeMap.has(e.source)) edgeMap.set(e.source, new Set());
      if (!edgeMap.has(e.target)) edgeMap.set(e.target, new Set());
      edgeMap.get(e.source)?.add(e.target);
      edgeMap.get(e.target)?.add(e.source);
    });

    const sortedNodes = [...(timelineSpec.nodes || [])].sort((a, b) =>
      String(a.meta?.date || '').localeCompare(String(b.meta?.date || ''))
    );

    return sortedNodes.map((n, i) => {
      const total = sortedNodes.length;
      const midpoint = Math.floor(total / 2);
      const baseEnergy = total <= 1 ? 90 : 100 - Math.round((i / (total - 1)) * 60);
      const status: OrbitalTimelineItem['status'] =
        i < midpoint ? 'completed' : i === midpoint ? 'in-progress' : 'pending';
      return {
        id: n.id,
        title: n.label,
        date: String(n.meta?.date || ''),
        content: String(n.meta?.description || ''),
        relatedIds: Array.from(edgeMap.get(n.id) || []),
        status,
        energy: Math.max(20, Math.min(100, baseEnergy)),
      };
    });
  }, [timelineSpec]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>

      {/* Header label */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', mb: 0.5 }}>
        <Box sx={{
          width: 7, height: 7, borderRadius: '50%',
          background: T.accent,
          boxShadow: '0 0 8px rgba(249,115,22,0.5)',
          animation: 'deepPulse 2s ease-in-out infinite',
        }} />
        <Typography sx={{
          fontFamily: T.mono, fontSize: '0.62rem', fontWeight: 600,
          color: T.accent, letterSpacing: '0.10em', textTransform: 'uppercase',
        }}>
          Deep Analysis
        </Typography>
        <style>{`
          @keyframes deepPulse {
            0%, 100% { opacity: 1; box-shadow: 0 0 8px rgba(249,115,22,0.5); }
            50%       { opacity: 0.6; box-shadow: 0 0 14px rgba(249,115,22,0.3); }
          }
        `}</style>
      </Box>

      <AnimatePresence mode="wait">
        {isLoading && (
          <motion.div key="skeleton" {...FADE_UP}>
            <DeepSkeleton />
          </motion.div>
        )}

        {error && !isLoading && (
          <motion.div key="error" {...FADE_UP}>
            <DeepError message={error} />
          </motion.div>
        )}

        {!isLoading && !error && answer && analysis && (
          <motion.div key="content">
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <AnswerBlock answer={answer} />
              <ClaimsCard claims={analysis.claims} />
              <GapsCard gaps={analysis.gaps} onPromptAsk={handlePromptAsk} />
              {orbitalItems.length > 1 ? (
                <motion.div {...STAGGER(2)}>
                  <RadialOrbitalTimeline timelineData={orbitalItems} />
                </motion.div>
              ) : (
                <TimelineStrip events={analysis.timeline_events} />
              )}
              <PerspectivesFooter perspectives={analysis.perspectives} />
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
}
