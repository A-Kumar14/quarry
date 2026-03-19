import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function ContradictionsTab({ data }) {
  if (data === null) {
    return (
      <>
        <style>{`
          @keyframes ctPulse {
            0%, 100% { opacity: 0.6; }
            50%       { opacity: 1; }
          }
        `}</style>
        <div style={{ padding: '8px 0' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              height: 72,
              borderRadius: 12,
              background: 'var(--bg-secondary)',
              marginBottom: 10,
              animation: 'ctPulse 1.5s ease-in-out infinite',
            }} />
          ))}
        </div>
      </>
    );
  }

  if (!data.contradictions || data.contradictions.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0' }}>
        <CheckCircle2
          size={28}
          style={{ color: '#16a34a', marginBottom: 10, display: 'block', margin: '0 auto 10px' }}
        />
        <div style={{
          fontFamily: 'var(--font-family)',
          fontSize: '0.88rem',
          fontWeight: 600,
          color: 'var(--fg-primary)',
          marginBottom: 4,
        }}>
          Sources largely agree
        </div>
        {data.consensus && (
          <div style={{
            fontFamily: 'var(--font-family)',
            fontSize: '0.8rem',
            color: 'var(--fg-secondary)',
            maxWidth: 380,
            margin: '0 auto',
            lineHeight: 1.5,
          }}>
            {data.consensus}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {data.contradictions.map((item, i) => (
        <div key={i} style={{
          background: 'rgba(255,255,255,0.55)',
          border: '1px solid rgba(255,255,255,0.4)',
          borderRadius: 12,
          padding: '14px 16px',
          marginBottom: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
            <AlertTriangle size={14} style={{ color: '#d97706', flexShrink: 0 }} />
            <span style={{
              fontFamily: 'var(--font-family)',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--fg-primary)',
            }}>
              {item.topic}
            </span>
          </div>

          <div style={{
            fontFamily: 'var(--font-family)',
            fontSize: '0.8rem',
            color: 'var(--fg-secondary)',
            fontStyle: 'italic',
            marginBottom: 10,
            lineHeight: 1.5,
          }}>
            {item.summary}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {(item.claims || []).map((claim, j) => (
              <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{
                  background: 'rgba(249,115,22,0.15)',
                  color: 'var(--accent)',
                  borderRadius: 999,
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '1px 7px',
                  fontFamily: 'var(--font-family)',
                  flexShrink: 0,
                  marginTop: 2,
                }}>
                  {claim.source_index}
                </span>
                <div>
                  <div style={{
                    fontFamily: 'var(--font-family)',
                    fontSize: '0.72rem',
                    color: 'var(--fg-dim)',
                    marginBottom: 2,
                  }}>
                    {claim.source_title?.length > 30
                      ? claim.source_title.slice(0, 30) + '…'
                      : claim.source_title}
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-family)',
                    fontSize: '0.82rem',
                    color: 'var(--fg-primary)',
                    lineHeight: 1.5,
                  }}>
                    {claim.claim}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {data.consensus && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <div style={{
            fontFamily: 'var(--font-family)',
            fontSize: '0.62rem',
            fontWeight: 700,
            color: 'var(--fg-dim)',
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            marginBottom: 4,
          }}>
            Sources agree on
          </div>
          <div style={{
            fontFamily: 'var(--font-family)',
            fontSize: '0.8rem',
            color: 'var(--fg-secondary)',
            lineHeight: 1.5,
          }}>
            {data.consensus}
          </div>
        </div>
      )}
    </div>
  );
}
