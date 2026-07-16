import React from 'react';
import { CheckCircle2 } from 'lucide-react';

/* ── Quote block — one side of a contradiction ────────────────────────────── */
function QuoteBlock({ claim, accent, labelColor }) {
  if (!claim) return null;
  return (
    <div style={{ borderLeft: `2px solid ${accent}`, paddingLeft: 10, minWidth: 0 }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: '0.59rem', fontWeight: 500,
        color: labelColor, marginBottom: 3, textTransform: 'uppercase',
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {claim.source_title?.slice(0, 40) || 'Source'}
      </div>
      <div style={{
        fontFamily: 'var(--font-family)', fontSize: '0.78rem',
        color: 'var(--fg-primary)', lineHeight: 1.55,
      }}>
        {claim.claim}
      </div>
    </div>
  );
}

/* ── Single contradiction card — side-by-side quote pair ──────────────────── */
function ContradictionCard({ item }) {
  const claims = item.claims || [];
  const claimA = claims[0] || null;
  const claimB = claims[1] || null;

  return (
    <div style={{
      border: '1px solid rgba(239,68,68,0.18)',
      background: 'rgba(239,68,68,0.05)',
      borderRadius: 10,
      padding: '14px 16px',
    }}>
      {/* Topic label */}
      <div style={{
        fontFamily: 'var(--font-family)', fontSize: '0.65rem', fontWeight: 600,
        color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.08em',
        marginBottom: 8,
      }}>
        {item.topic || 'Contested point'}
      </div>

      {/* Two-column quote pair */}
      {(claimA || claimB) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <QuoteBlock claim={claimA} accent="var(--blue)" labelColor="var(--blue)" />
          <QuoteBlock claim={claimB} accent="#ef4444" labelColor="#dc2626" />
        </div>
      )}

      {/* Additional claims (3+) */}
      {claims.slice(2).map((c, j) => (
        <div key={j} style={{ marginTop: 10 }}>
          <QuoteBlock claim={c} accent="var(--border)" labelColor="var(--fg-dim)" />
        </div>
      ))}

      {/* Point of contention */}
      {item.summary && (
        <div style={{
          marginTop: 10,
          fontFamily: 'var(--font-family)', fontSize: '0.7rem',
          color: 'var(--fg-secondary)', fontStyle: 'italic', lineHeight: 1.5,
        }}>
          {item.summary}
        </div>
      )}
    </div>
  );
}

/* ── Consensus card — green variant ───────────────────────────────────────── */
function ConsensusCard({ consensus }) {
  if (!consensus) return null;
  return (
    <div style={{
      border: '1px solid rgba(34,197,94,0.22)',
      background: 'rgba(34,197,94,0.05)',
      borderRadius: 10,
      padding: '12px 16px',
    }}>
      <div style={{
        fontFamily: 'var(--font-family)', fontSize: '0.65rem', fontWeight: 600,
        color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.08em',
        marginBottom: 5,
      }}>
        Consensus
      </div>
      <div style={{
        fontFamily: 'var(--font-family)', fontSize: '0.82rem', fontWeight: 300,
        color: 'var(--fg-primary)', lineHeight: 1.65,
      }}>
        {consensus}
      </div>
    </div>
  );
}

/* ── Main export ──────────────────────────────────────────────────────────── */
export default function ContradictionsTab({ data }) {
  /* Loading skeleton */
  if (data === null) {
    return (
      <>
        <style>{`
          @keyframes ctPulse { 0%,100%{opacity:0.5} 50%{opacity:1} }
        `}</style>
        <div style={{ padding: '8px 0' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              height: 110, borderRadius: 10,
              background: 'var(--bg-secondary)',
              marginBottom: 12,
              animation: 'ctPulse 1.5s ease-in-out infinite',
            }} />
          ))}
        </div>
      </>
    );
  }

  /* No contradictions — lead with agreement, then consensus card */
  if (!data.contradictions || data.contradictions.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: '72ch' }}>
        <div style={{ textAlign: 'center', padding: '20px 0 4px' }}>
          <CheckCircle2
            size={28}
            style={{ color: '#16a34a', display: 'block', margin: '0 auto 10px' }}
          />
          <div style={{
            fontFamily: 'var(--font-family)', fontSize: '0.88rem',
            fontWeight: 600, color: 'var(--fg-primary)',
          }}>
            Sources largely agree
          </div>
        </div>
        <ConsensusCard consensus={data.consensus} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: '72ch' }}>
      {data.contradictions.map((item, i) => <ContradictionCard key={i} item={item} />)}
      <ConsensusCard consensus={data.consensus} />
    </div>
  );
}
