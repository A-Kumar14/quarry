import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, Search } from 'lucide-react';
import GlassCard from './GlassCard';

/* ── Skeleton pulse ──────────────────────────────────────────────────────── */
function GapSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          style={{
            height: 52,
            borderRadius: 10,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            animation: `gapPulse 1.4s ease-in-out ${i * 0.18}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes gapPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

/* ── Empty state ─────────────────────────────────────────────────────────── */
function GapEmpty() {
  return (
    <GlassCard style={{ padding: '28px 24px', textAlign: 'center' }}>
      <HelpCircle size={20} style={{ color: 'var(--fg-dim)', margin: '0 auto 10px', display: 'block' }} />
      <div style={{ fontFamily: 'var(--font-family)', fontSize: '0.85rem', color: 'var(--fg-dim)' }}>
        No research gaps detected for this query.
      </div>
    </GlassCard>
  );
}

/* ── Single gap card ─────────────────────────────────────────────────────── */
function GapCard({ gap, index, onNewSearch }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.22 }}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 14px',
        background: 'rgba(249,115,22,0.04)',
        border: '1px solid rgba(249,115,22,0.14)',
        borderRadius: 10,
      }}
    >
      {/* Number circle */}
      <div style={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
        background: 'rgba(249,115,22,0.10)',
        border: '1px solid rgba(249,115,22,0.22)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-mono)', fontSize: '0.64rem', fontWeight: 700,
        color: 'var(--accent)',
      }}>
        {index + 1}
      </div>

      {/* Gap text + investigate button */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-family)', fontSize: '0.83rem',
          color: 'var(--fg-primary)', lineHeight: 1.5, marginBottom: 8,
        }}>
          {gap}
        </div>
        <button
          onClick={() => onNewSearch(gap)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
            background: 'rgba(249,115,22,0.08)',
            border: '1px solid rgba(249,115,22,0.22)',
            fontFamily: 'var(--font-family)', fontSize: '0.68rem',
            fontWeight: 500, color: 'var(--accent)',
            transition: 'background 0.14s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(249,115,22,0.15)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(249,115,22,0.08)'}
        >
          <Search size={10} />
          Investigate →
        </button>
      </div>
    </motion.div>
  );
}

/* ── Main export ─────────────────────────────────────────────────────────── */
export default function GapsTab({ gaps = [], loading = false, onNewSearch }) {
  if (loading) return <GapSkeleton />;

  if (!gaps || gaps.length === 0) return <GapEmpty />;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
        <HelpCircle size={12} color="var(--accent)" />
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: '0.65rem', fontWeight: 600,
          color: 'var(--fg-dim)', letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          {gaps.length} unanswered question{gaps.length !== 1 ? 's' : ''}
        </span>
      </div>

      <AnimatePresence>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {gaps.map((gap, i) => (
            <GapCard key={i} gap={gap} index={i} onNewSearch={onNewSearch} />
          ))}
        </div>
      </AnimatePresence>
    </div>
  );
}
