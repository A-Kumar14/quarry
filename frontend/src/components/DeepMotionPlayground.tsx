/**
 * DeepMotionPlayground.tsx
 *
 * Interactive demo of the Deep mode motion design system.
 * Mount this in any dev page to verify all 5 patterns feel right together.
 *
 * Panels:
 *   A — "Analysis in progress" state + appearCard stagger
 *   B — updateCard flash (without re-mounting)
 *   C — pulseBadge on a live indicator
 *   D — settleBars for coverage meters
 *   E — fadeSwap between diagram types
 */

import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import {
  motion,
  AnimatePresence,
  useAnimationControls,
  type Transition,
} from 'framer-motion';
import {
  appearCardVariants,
  staggerCards,
  updateCardVariants,
  pulseBadgeAnimate,
  settleBarTransition,
  fadeSwapVariants,
  analysingPulse,
} from '../motion/deepMotion';

// ── Design tokens ─────────────────────────────────────────────────────────────

const T = {
  serif:     'var(--font-serif)',
  sans:      'var(--font-family)',
  mono:      'var(--font-mono)',
  fg:        'var(--fg-primary)',
  fgSec:     'var(--fg-secondary)',
  fgDim:     'var(--fg-dim)',
  accent:    'var(--accent)',
  accentDim: 'rgba(249,115,22,0.10)',
  accentBdr: 'rgba(249,115,22,0.28)',
  border:    'var(--border)',
  bg:        'var(--bg-secondary)',
  card:      'var(--glass-card-bg)',
  blur:      'var(--glass-card-blur)',
  bdrT:      'var(--glass-card-border-t)',
  bdrL:      'var(--glass-card-border-l)',
  bdrR:      'var(--glass-card-border-r)',
  bdrB:      'var(--glass-card-border-b)',
  shadow:    'var(--glass-card-shadow)',
} as const;

const glassCard: React.CSSProperties = {
  background:           T.card,
  backdropFilter:       T.blur,
  WebkitBackdropFilter: T.blur,
  borderRadius:         13,
  borderTop:    `1px solid ${T.bdrT}`,
  borderLeft:   `1px solid ${T.bdrL}`,
  borderRight:  `1px solid ${T.bdrR}`,
  borderBottom: `1px solid ${T.bdrB}`,
  boxShadow:    T.shadow,
  padding:      '14px 16px',
};

// ── Small helpers ─────────────────────────────────────────────────────────────

function SectionLabel({ label, pattern }: { label: string; pattern: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 1.25 }}>
      <Typography sx={{
        fontFamily: T.serif, fontSize: '0.82rem', fontWeight: 600, color: T.fg,
      }}>
        {label}
      </Typography>
      <Typography sx={{
        fontFamily: T.mono, fontSize: '0.56rem', color: T.accent,
        background: T.accentDim, border: `1px solid ${T.accentBdr}`,
        borderRadius: '5px', px: '6px', py: '1px',
      }}>
        {pattern}
      </Typography>
    </Box>
  );
}

function PanelDivider() {
  return <Box sx={{ height: '1px', background: T.border, my: 3, opacity: 0.6 }} />;
}

function Btn({
  onClick, children, accent = false, disabled = false,
}: {
  onClick: () => void;
  children: React.ReactNode;
  accent?: boolean;
  disabled?: boolean;
}) {
  return (
    <Box
      component="button"
      onClick={disabled ? undefined : onClick}
      sx={{
        fontFamily: T.sans, fontSize: '0.72rem', fontWeight: 500,
        color:      accent ? '#fff' : T.fgSec,
        background: accent ? T.accent : 'transparent',
        border:     `1px solid ${accent ? 'transparent' : T.border}`,
        borderRadius: '8px', px: '12px', py: '6px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        transition: 'all 0.14s',
        '&:hover': disabled ? {} : {
          background: accent ? 'rgba(249,115,22,0.85)' : T.accentDim,
          borderColor: accent ? 'transparent' : T.accentBdr,
          color: accent ? '#fff' : T.fg,
        },
      }}
    >
      {children}
    </Box>
  );
}

// ── Mock data ─────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'loading' | 'complete';

interface MockClaim {
  id: string;
  text: string;
  confidence: 'high' | 'medium' | 'low' | 'contested';
  sources: number;
}

interface MockGap {
  id: string;
  question: string;
  severity: 'critical' | 'moderate' | 'minor';
}

const MOCK_CLAIMS_V1: MockClaim[] = [
  { id: 'c1', text: 'Egypt opened the Rafah crossing for aid lorries on 21 October 2023.', confidence: 'high', sources: 4 },
  { id: 'c2', text: 'The Cyprus maritime corridor was proposed but never operationalised.', confidence: 'medium', sources: 2 },
  { id: 'c3', text: 'The floating pier collapsed twice before permanent suspension.', confidence: 'contested', sources: 1 },
];

const MOCK_CLAIMS_V2: MockClaim[] = [
  { id: 'c1', text: 'Egypt opened the Rafah crossing for aid lorries on 21 October 2023.', confidence: 'high', sources: 5 },
  { id: 'c2', text: 'The Cyprus maritime corridor was proposed but operational status remains disputed.', confidence: 'low', sources: 1 },
  { id: 'c3', text: 'The floating pier collapsed twice before permanent suspension.', confidence: 'contested', sources: 3 },
  { id: 'c4', text: 'UNRWA estimates 500+ lorries/day required to meet minimum aid thresholds.', confidence: 'medium', sources: 2 },
];

const MOCK_GAPS: MockGap[] = [
  { id: 'g1', question: 'What is the current daily throughput at Kerem Shalom?', severity: 'critical' },
  { id: 'g2', question: 'Did any aid reach northern Gaza via the pier before its suspension?', severity: 'moderate' },
];

const COVERAGE_BARS = [
  { label: 'Source diversity',  value: 78, color: '#22c55e' },
  { label: 'Claim confidence',  value: 61, color: '#f59e0b' },
  { label: 'Gap coverage',      value: 42, color: '#ef4444' },
  { label: 'Timeline density',  value: 55, color: '#6366f1' },
];

type DiagramType = 'timeline' | 'actorGraph' | 'corridorMap';
const DIAGRAM_TYPES: DiagramType[] = ['timeline', 'actorGraph', 'corridorMap'];

const CONFIDENCE_COLOR: Record<MockClaim['confidence'], string> = {
  high:      '#22c55e',
  medium:    '#f59e0b',
  low:       '#94a3b8',
  contested: '#ef4444',
};

const SEV_COLOR: Record<MockGap['severity'], string> = {
  critical: '#ef4444',
  moderate: '#f59e0b',
  minor:    '#94a3b8',
};

// ── Panel A: appearCard + loading state ───────────────────────────────────────

function PanelAppear({ phase, claims, gaps }: { phase: Phase; claims: MockClaim[]; gaps: MockGap[] }) {
  return (
    <Box>
      <SectionLabel label="Appear + Loading" pattern="appearCard · analysingPulse" />

      {/* Loading state */}
      <AnimatePresence mode="wait">
        {phase === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 } as Transition}
          >
            <Box style={{ ...glassCard, marginBottom: 10 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <motion.div {...analysingPulse}>
                  <Box sx={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: T.accent,
                  }} />
                </motion.div>
                <motion.div {...analysingPulse}>
                  <Typography sx={{
                    fontFamily: T.mono, fontSize: '0.68rem', color: T.fgDim,
                  }}>
                    Analysing sources…
                  </Typography>
                </motion.div>
                {/* three staggered skeleton lines */}
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px', ml: 1 }}>
                  {[75, 55, 65].map((w, i) => (
                    <motion.div key={i}
                      animate={{ opacity: [0.3, 0.65, 0.3] }}
                      transition={{ duration: 1.6, ease: 'easeInOut', repeat: Infinity, delay: i * 0.22 } as Transition}
                    >
                      <Box sx={{ height: 6, width: `${w}%`, borderRadius: 3, background: T.border }} />
                    </motion.div>
                  ))}
                </Box>
              </Box>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cards appearing with stagger */}
      <AnimatePresence>
        {phase === 'complete' && (
          <motion.div
            key="cards"
            variants={staggerCards}
            initial="hidden"
            animate="visible"
          >
            {/* Claims card */}
            <motion.div variants={appearCardVariants} style={{ marginBottom: 8 }}>
              <Box style={glassCard}>
                <Typography sx={{ fontFamily: T.sans, fontSize: '0.58rem', fontWeight: 600, color: T.fgDim, letterSpacing: '0.12em', textTransform: 'uppercase', mb: 1 }}>Key Claims</Typography>
                {claims.map(c => (
                  <Box key={c.id} sx={{ display: 'flex', alignItems: 'flex-start', gap: '7px', mb: 0.65 }}>
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: CONFIDENCE_COLOR[c.confidence], mt: '4px', flexShrink: 0 }} />
                    <Typography sx={{ fontFamily: T.sans, fontSize: '0.74rem', color: T.fg, lineHeight: 1.5, flex: 1 }}>{c.text}</Typography>
                    <Typography sx={{ fontFamily: T.mono, fontSize: '0.58rem', color: T.fgDim, flexShrink: 0, mt: '2px' }}>{c.sources}s</Typography>
                  </Box>
                ))}
              </Box>
            </motion.div>

            {/* Gaps card */}
            <motion.div variants={appearCardVariants}>
              <Box style={glassCard}>
                <Typography sx={{ fontFamily: T.sans, fontSize: '0.58rem', fontWeight: 600, color: T.fgDim, letterSpacing: '0.12em', textTransform: 'uppercase', mb: 1 }}>Research Gaps</Typography>
                {gaps.map(g => (
                  <Box key={g.id} sx={{ mb: 0.65, p: '8px 10px', borderRadius: '8px', background: `${SEV_COLOR[g.severity]}08`, border: `1px solid ${SEV_COLOR[g.severity]}22` }}>
                    <Typography sx={{ fontFamily: T.sans, fontSize: '0.74rem', color: T.fg, lineHeight: 1.5 }}>{g.question}</Typography>
                  </Box>
                ))}
              </Box>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
}

// ── Panel B: updateCard ───────────────────────────────────────────────────────

function UpdateableCard({ claim, version }: { claim: MockClaim; version: number }) {
  const controls = useAnimationControls();
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return; }
    controls.start('flash').then(() => controls.set('idle'));
  }, [version, controls]);

  const color = CONFIDENCE_COLOR[claim.confidence];

  return (
    <motion.div
      animate={controls}
      variants={updateCardVariants}
      initial="idle"
      style={{ borderRadius: 13, marginBottom: 8 }}
    >
      <Box style={glassCard}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <Box sx={{ width: 7, height: 7, borderRadius: '50%', background: color, mt: '4px', flexShrink: 0, boxShadow: `0 0 5px ${color}55` }} />
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontFamily: T.sans, fontSize: '0.76rem', color: T.fg, lineHeight: 1.55 }}>
              {claim.text}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: '5px' }}>
              <Box sx={{ fontFamily: T.mono, fontSize: '0.57rem', color, background: `${color}12`, border: `1px solid ${color}30`, borderRadius: '5px', px: '5px', py: '1px' }}>
                {claim.confidence}
              </Box>
              <Typography sx={{ fontFamily: T.mono, fontSize: '0.57rem', color: T.fgDim }}>
                {claim.sources} source{claim.sources !== 1 ? 's' : ''}
              </Typography>
              {claim.sources === 1 && (
                <Box sx={{ fontFamily: T.mono, fontSize: '0.57rem', color: '#b45309', background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.30)', borderRadius: '5px', px: '5px', py: '1px' }}>
                  single source
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      </Box>
    </motion.div>
  );
}

function PanelUpdate({ claims, version }: { claims: MockClaim[]; version: number }) {
  return (
    <Box>
      <SectionLabel label="Content Update" pattern="updateCard" />
      {claims.map(c => (
        <UpdateableCard key={c.id} claim={c} version={version} />
      ))}
    </Box>
  );
}

// ── Panel C: pulseBadge ───────────────────────────────────────────────────────

function PanelPulse({ active }: { active: boolean }) {
  return (
    <Box>
      <SectionLabel label="Live Indicator" pattern="pulseBadge" />
      <Box style={glassCard}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          {active ? (
            <motion.div {...pulseBadgeAnimate}>
              <Box sx={{ width: 7, height: 7, borderRadius: '50%', background: T.accent, boxShadow: '0 0 8px rgba(249,115,22,0.5)' }} />
            </motion.div>
          ) : (
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', background: T.border }} />
          )}
          <Typography sx={{ fontFamily: T.mono, fontSize: '0.66rem', fontWeight: 600, color: active ? T.accent : T.fgDim, letterSpacing: '0.09em', textTransform: 'uppercase' }}>
            {active ? 'Deep Analysis · Live' : 'Idle'}
          </Typography>
        </Box>
        <Typography sx={{ fontFamily: T.sans, fontSize: '0.70rem', color: T.fgSec, mt: 1, lineHeight: 1.6 }}>
          {active
            ? 'The badge breathes at 2.2s/cycle — slow enough to read as "working", not "warning".'
            : 'Badge is static when no analysis is running.'}
        </Typography>
      </Box>
    </Box>
  );
}

// ── Panel D: settleBars ───────────────────────────────────────────────────────

function PanelBars({ run }: { run: number }) {
  // Re-animate whenever `run` increments by resetting key
  return (
    <Box>
      <SectionLabel label="Coverage Meters" pattern="settleBars" />
      <Box style={glassCard}>
        {COVERAGE_BARS.map((bar, i) => (
          <Box key={bar.label} sx={{ mb: i < COVERAGE_BARS.length - 1 ? 1.5 : 0 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: '5px' }}>
              <Typography sx={{ fontFamily: T.sans, fontSize: '0.72rem', color: T.fgSec }}>
                {bar.label}
              </Typography>
              <Typography sx={{ fontFamily: T.mono, fontSize: '0.60rem', color: T.fgDim }}>
                {bar.value}%
              </Typography>
            </Box>
            <Box sx={{ height: 5, borderRadius: 99, background: T.border, overflow: 'hidden' }}>
              <motion.div
                key={`bar-${bar.label}-${run}`}
                initial={{ width: '0%' }}
                animate={{ width: `${bar.value}%` }}
                transition={settleBarTransition(i)}
                style={{ height: '100%', borderRadius: 99, background: bar.color, transformOrigin: 'left' }}
              />
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ── Panel E: fadeSwap ─────────────────────────────────────────────────────────

const DIAGRAM_PREVIEW: Record<DiagramType, { label: string; description: string; color: string }> = {
  timeline: {
    label:       'Timeline',
    description: '8 events · Oct 2023 – Apr 2024',
    color:       '#f59e0b',
  },
  actorGraph: {
    label:       'Actor Graph',
    description: '6 nodes · 9 relations',
    color:       '#6366f1',
  },
  corridorMap: {
    label:       'Corridor Map',
    description: '5 locations · 3 blocked, 1 operational',
    color:       '#22c55e',
  },
};

function FakeDigram({ type }: { type: DiagramType }) {
  const d = DIAGRAM_PREVIEW[type];
  return (
    <Box sx={{
      minHeight: 90,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 1,
      background: `${d.color}09`,
      border: `1px dashed ${d.color}40`,
      borderRadius: 10, p: 2,
    }}>
      <Box sx={{ fontFamily: T.mono, fontSize: '0.60rem', fontWeight: 700, color: d.color, letterSpacing: '0.10em', textTransform: 'uppercase' }}>
        {d.label}
      </Box>
      <Typography sx={{ fontFamily: T.sans, fontSize: '0.70rem', color: T.fgSec }}>
        {d.description}
      </Typography>
    </Box>
  );
}

function PanelFadeSwap({ diagramType }: { diagramType: DiagramType }) {
  return (
    <Box>
      <SectionLabel label="Diagram Swap" pattern="fadeSwap" />
      <Box style={glassCard}>
        <Typography sx={{ fontFamily: T.sans, fontSize: '0.70rem', color: T.fgSec, mb: 1.25, lineHeight: 1.5 }}>
          Old diagram exits (scale 0.97, 180ms), new diagram enters (scale 0.97→1, 240ms).
        </Typography>
        <AnimatePresence mode="wait">
          <motion.div
            key={diagramType}
            variants={fadeSwapVariants}
            initial="enter"
            animate="visible"
            exit="exit"
          >
            <FakeDigram type={diagramType} />
          </motion.div>
        </AnimatePresence>
      </Box>
    </Box>
  );
}

// ── DeepMotionPlayground ──────────────────────────────────────────────────────

export default function DeepMotionPlayground() {
  const [phase,       setPhase]       = useState<Phase>('idle');
  const [updateV,     setUpdateV]     = useState(0);
  const [claims,      setClaims]      = useState<MockClaim[]>(MOCK_CLAIMS_V1);
  const [barRun,      setBarRun]      = useState(0);
  const [diagramIdx,  setDiagramIdx]  = useState(0);
  const diagramType = DIAGRAM_TYPES[diagramIdx % DIAGRAM_TYPES.length];

  // Simulate async analysis
  const runAnalysis = () => {
    setPhase('loading');
    setTimeout(() => setPhase('complete'), 2200);
  };

  const resetAnalysis = () => {
    setPhase('idle');
    setClaims(MOCK_CLAIMS_V1);
    setUpdateV(0);
  };

  const triggerUpdate = () => {
    setClaims(v => v === MOCK_CLAIMS_V1 ? MOCK_CLAIMS_V2 : MOCK_CLAIMS_V1);
    setUpdateV(v => v + 1);
  };

  return (
    <Box sx={{
      maxWidth: 560,
      mx: 'auto',
      p: 3,
      background: 'var(--bg-primary)',
      minHeight: '100vh',
      fontFamily: T.sans,
    }}>

      {/* ── Header ── */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', mb: 0.5 }}>
          <motion.div {...pulseBadgeAnimate}>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', background: T.accent, boxShadow: '0 0 8px rgba(249,115,22,0.45)' }} />
          </motion.div>
          <Typography sx={{ fontFamily: T.mono, fontSize: '0.62rem', fontWeight: 600, color: T.accent, letterSpacing: '0.10em', textTransform: 'uppercase' }}>
            Motion Playground
          </Typography>
        </Box>
        <Typography sx={{ fontFamily: T.serif, fontSize: '1.15rem', fontWeight: 600, color: T.fg }}>
          Deep Mode Motion System
        </Typography>
        <Typography sx={{ fontFamily: T.sans, fontSize: '0.72rem', color: T.fgSec, mt: 0.25 }}>
          5 reusable patterns — interact with each panel below.
        </Typography>
      </Box>

      {/* ── Controls ── */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
        <Btn onClick={runAnalysis} accent disabled={phase === 'loading'}>
          {phase === 'loading' ? 'Analysing…' : phase === 'complete' ? 'Re-run' : 'Run Analysis'}
        </Btn>
        {phase === 'complete' && (
          <>
            <Btn onClick={triggerUpdate}>Update data</Btn>
            <Btn onClick={() => setBarRun(v => v + 1)}>Re-settle bars</Btn>
          </>
        )}
        <Btn onClick={() => setDiagramIdx(v => v + 1)}>Swap diagram</Btn>
        {phase !== 'idle' && <Btn onClick={resetAnalysis}>Reset</Btn>}
      </Box>

      {/* ── Panel A: appearCard + loading ── */}
      <PanelAppear phase={phase} claims={claims} gaps={MOCK_GAPS} />

      <PanelDivider />

      {/* ── Panel B: updateCard ── */}
      <Box>
        <Box sx={{ mb: 0.75 }}>
          <Typography sx={{ fontFamily: T.sans, fontSize: '0.66rem', color: T.fgDim, fontStyle: 'italic' }}>
            Cards below flash (glow + micro-scale) when "Update data" fires — no re-mount, no position change.
          </Typography>
        </Box>
        <PanelUpdate claims={claims} version={updateV} />
      </Box>

      <PanelDivider />

      {/* ── Panel C: pulseBadge ── */}
      <PanelPulse active={phase !== 'idle'} />

      <PanelDivider />

      {/* ── Panel D: settleBars ── */}
      <PanelBars run={barRun} />

      <PanelDivider />

      {/* ── Panel E: fadeSwap ── */}
      <PanelFadeSwap diagramType={diagramType} />

      {/* ── Pattern key ── */}
      <Box sx={{ mt: 3, p: '14px 16px', borderRadius: 10, border: `1px solid ${T.border}`, background: T.accentDim }}>
        <Typography sx={{ fontFamily: T.mono, fontSize: '0.60rem', fontWeight: 700, color: T.accent, mb: 1, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Pattern Reference
        </Typography>
        {[
          ['appearCard',    '220ms · decelerate · 65ms stagger'],
          ['updateCard',    '480ms · easeInOut · imperative controls'],
          ['pulseBadge',    '2200ms · easeInOut · ∞ loop'],
          ['settleBars',    '580ms · ease-out-quad · 80ms stagger'],
          ['fadeSwap',      '180ms exit · 240ms enter · AnimatePresence wait'],
        ].map(([name, spec]) => (
          <Box key={name} sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 0.5 }}>
            <Typography sx={{ fontFamily: T.mono, fontSize: '0.64rem', fontWeight: 600, color: T.accent, minWidth: 110 }}>
              {name}
            </Typography>
            <Typography sx={{ fontFamily: T.mono, fontSize: '0.60rem', color: T.fgSec }}>
              {spec}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
