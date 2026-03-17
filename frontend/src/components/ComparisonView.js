import React from 'react';
import GlassCard from './GlassCard';

function parseEntities(query) {
  const match = query.match(/^(.+?)\s+(?:vs\.?|versus)\s+(.+)$/i);
  if (match) return [match[1].trim(), match[2].trim()];
  return ['Option A', 'Option B'];
}

const COLORS = ['#F97316', '#7C3AED'];

export default function ComparisonView({ query }) {
  const entities = parseEntities(query);
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
      {entities.map((entity, i) => (
        <GlassCard
          key={i}
          style={{
            flex: '1 1 180px',
            padding: '16px 20px',
            borderTop: `3px solid ${COLORS[i]}`,
            background: 'rgba(255, 255, 255, 0.55)',
          }}
        >
          <div style={{
            fontFamily: 'var(--font-family)',
            fontSize: '0.6rem',
            fontWeight: 700,
            color: COLORS[i],
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}>
            {i === 0 ? 'Option A' : 'Option B'}
          </div>
          <div style={{
            fontFamily: 'var(--font-family)',
            fontSize: '1rem',
            fontWeight: 700,
            color: 'var(--fg-primary)',
            lineHeight: 1.3,
          }}>
            {entity}
          </div>
          <div style={{
            fontFamily: 'var(--font-family)',
            fontSize: '0.73rem',
            color: 'var(--fg-dim)',
            marginTop: 10,
          }}>
            See full analysis below ↓
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
