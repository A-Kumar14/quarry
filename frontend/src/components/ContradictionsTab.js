import React from 'react';
import { AlertTriangle, CheckCircle2, Shield } from 'lucide-react';

/* ── Severity heuristic ───────────────────────────────────────────────────── */
function getSeverity(item) {
  const claims = item.claims || [];
  if (claims.length >= 3) return 'high';
  const text = (item.summary || '').toLowerCase();
  if (text.includes('contradict') || text.includes('conflict') || text.includes('false')) return 'high';
  if (text.includes('dispute') || text.includes('disagree') || text.includes('differ')) return 'medium';
  return claims.length >= 2 ? 'medium' : 'low';
}

const SEV_COLOR = { high: '#ef4444', medium: '#f59e0b', low: '#6b7280' };
const SEV_BG    = {
  high:   'rgba(239,68,68,0.07)',
  medium: 'rgba(245,158,11,0.07)',
  low:    'rgba(107,114,128,0.07)',
};
const SEV_BORDER = {
  high:   'rgba(239,68,68,0.22)',
  medium: 'rgba(245,158,11,0.22)',
  low:    'rgba(107,114,128,0.18)',
};

/* ── Single versus card ───────────────────────────────────────────────────── */
function VersusCard({ item }) {
  const sev    = getSeverity(item);
  const color  = SEV_COLOR[sev];
  const claims = item.claims || [];
  const claimA = claims[0] || null;
  const claimB = claims[1] || null;

  return (
    <div style={{
      background: 'var(--glass-bg)',
      backdropFilter: 'var(--glass-blur)',
      WebkitBackdropFilter: 'var(--glass-blur)',
      border: `1px solid ${SEV_BORDER[sev]}`,
      borderRadius: 14,
      overflow: 'hidden',
      marginBottom: 12,
      boxShadow: 'var(--glass-shadow)',
    }}>

      {/* ── Header row: severity + topic ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px 8px',
        background: SEV_BG[sev],
        borderBottom: `1px solid ${SEV_BORDER[sev]}`,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '2px 8px', borderRadius: 99,
          background: `${color}18`,
          border: `1px solid ${color}44`,
        }}>
          <AlertTriangle size={10} color={color} />
          <span style={{
            fontFamily: 'var(--font-family)', fontSize: '0.62rem',
            fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.07em',
          }}>
            {sev}
          </span>
        </div>
        <span style={{
          fontFamily: 'var(--font-family)', fontSize: '0.84rem',
          fontWeight: 600, color: 'var(--fg-primary)', flex: 1,
        }}>
          {item.topic}
        </span>
      </div>

      {/* ── Versus body ── */}
      <div style={{ padding: '12px 14px' }}>

        {/* Two-column claim layout */}
        {(claimA || claimB) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 0, alignItems: 'stretch', marginBottom: 10 }}>

            {/* Left claim */}
            <div style={{
              padding: '10px 12px',
              background: 'rgba(239,68,68,0.04)',
              borderRadius: '8px 0 0 8px',
              border: '1px solid rgba(239,68,68,0.12)',
              borderRight: 'none',
            }}>
              {claimA && (
                <>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: '0.60rem',
                    color: 'var(--fg-dim)', marginBottom: 5,
                    letterSpacing: '0.04em', textTransform: 'uppercase',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {claimA.source_title?.slice(0, 28) || 'Source A'}
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-family)', fontSize: '0.79rem',
                    color: 'var(--fg-primary)', lineHeight: 1.5,
                  }}>
                    {claimA.claim}
                  </div>
                </>
              )}
            </div>

            {/* VS divider */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, flexShrink: 0,
              background: 'rgba(0,0,0,0.04)',
              borderTop: '1px solid var(--border)',
              borderBottom: '1px solid var(--border)',
            }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '0.58rem',
                fontWeight: 700, color: 'var(--fg-dim)', letterSpacing: '0.05em',
              }}>
                vs
              </span>
            </div>

            {/* Right claim */}
            <div style={{
              padding: '10px 12px',
              background: 'rgba(96,165,250,0.04)',
              borderRadius: '0 8px 8px 0',
              border: '1px solid rgba(96,165,250,0.12)',
              borderLeft: 'none',
            }}>
              {claimB && (
                <>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: '0.60rem',
                    color: 'var(--fg-dim)', marginBottom: 5,
                    letterSpacing: '0.04em', textTransform: 'uppercase',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    textAlign: 'right',
                  }}>
                    {claimB.source_title?.slice(0, 28) || 'Source B'}
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-family)', fontSize: '0.79rem',
                    color: 'var(--fg-primary)', lineHeight: 1.5, textAlign: 'right',
                  }}>
                    {claimB.claim}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Additional claims (3+) */}
        {claims.slice(2).map((c, j) => (
          <div key={j} style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            padding: '7px 10px', marginBottom: 6,
            background: 'rgba(0,0,0,0.03)',
            border: '1px solid var(--border)',
            borderRadius: 7,
          }}>
            <span style={{
              background: `${color}18`, color, borderRadius: 999,
              fontSize: '0.68rem', fontWeight: 700,
              padding: '1px 6px', fontFamily: 'var(--font-family)',
              flexShrink: 0, marginTop: 2,
            }}>
              {c.source_index || j + 3}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.60rem', color: 'var(--fg-dim)', marginBottom: 2 }}>
                {c.source_title?.slice(0, 36) || ''}
              </div>
              <div style={{ fontFamily: 'var(--font-family)', fontSize: '0.79rem', color: 'var(--fg-primary)', lineHeight: 1.45 }}>
                {c.claim}
              </div>
            </div>
          </div>
        ))}

        {/* Point of contention (summary) */}
        {item.summary && (
          <div style={{
            padding: '7px 10px',
            background: `${color}08`,
            border: `1px solid ${color}20`,
            borderRadius: 7,
            fontFamily: 'var(--font-family)', fontSize: '0.77rem',
            color: 'var(--fg-secondary)', fontStyle: 'italic', lineHeight: 1.5,
          }}>
            <span style={{ fontWeight: 600, fontStyle: 'normal', color, marginRight: 4 }}>Point of contention:</span>
            {item.summary}
          </div>
        )}
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
              height: 110, borderRadius: 14,
              background: 'var(--bg-secondary)',
              marginBottom: 10,
              animation: 'ctPulse 1.5s ease-in-out infinite',
            }} />
          ))}
        </div>
      </>
    );
  }

  /* No contradictions */
  if (!data.contradictions || data.contradictions.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0' }}>
        <CheckCircle2
          size={28}
          style={{ color: '#16a34a', display: 'block', margin: '0 auto 10px' }}
        />
        <div style={{
          fontFamily: 'var(--font-family)', fontSize: '0.88rem',
          fontWeight: 600, color: 'var(--fg-primary)', marginBottom: 4,
        }}>
          Sources largely agree
        </div>
        {data.consensus && (
          <div style={{
            fontFamily: 'var(--font-family)', fontSize: '0.8rem',
            color: 'var(--fg-secondary)', maxWidth: 380,
            margin: '0 auto', lineHeight: 1.5,
          }}>
            {data.consensus}
          </div>
        )}
      </div>
    );
  }

  /* Sort by severity: high → medium → low */
  const sorted = [...data.contradictions].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return (order[getSeverity(a)] ?? 2) - (order[getSeverity(b)] ?? 2);
  });

  return (
    <div>
      {/* Header legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {[
          { sev: 'high',   label: 'High conflict' },
          { sev: 'medium', label: 'Moderate' },
          { sev: 'low',    label: 'Low' },
        ].map(({ sev, label }) => (
          sorted.some(i => getSeverity(i) === sev) && (
            <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: SEV_COLOR[sev] }} />
              <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.68rem', color: 'var(--fg-dim)' }}>{label}</span>
            </div>
          )
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Shield size={11} color="var(--fg-dim)" />
          <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.68rem', color: 'var(--fg-dim)' }}>
            {data.contradictions.length} conflict{data.contradictions.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {sorted.map((item, i) => <VersusCard key={i} item={item} />)}

      {/* Consensus footer */}
      {data.consensus && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <div style={{
            fontFamily: 'var(--font-family)', fontSize: '0.62rem', fontWeight: 700,
            color: 'var(--fg-dim)', letterSpacing: '0.07em',
            textTransform: 'uppercase', marginBottom: 4,
          }}>
            Sources agree on
          </div>
          <div style={{
            fontFamily: 'var(--font-family)', fontSize: '0.8rem',
            color: 'var(--fg-secondary)', lineHeight: 1.5,
          }}>
            {data.consensus}
          </div>
        </div>
      )}
    </div>
  );
}
