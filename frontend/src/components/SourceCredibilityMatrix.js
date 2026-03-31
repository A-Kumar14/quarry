import React, { useMemo, useState } from 'react';
import { Box, Typography, Tooltip } from '@mui/material';

// Maps credibility_tier (1/2/3/null) and editorial_lean to grid positions
const LEAN_COLS = ['Left', 'Centre', 'Right', 'Unknown'];
const TIER_ROWS = [
  { label: 'Tier 1', key: 1, color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  { label: 'Tier 2', key: 2, color: '#f59e0b', bg: 'rgba(245,158,11,0.10)' },
  { label: 'Tier 3', key: 3, color: '#9ca3af', bg: 'rgba(156,163,175,0.10)' },
];

function normaliseLean(lean) {
  if (!lean) return 'Unknown';
  const l = lean.toLowerCase();
  if (l.includes('left'))   return 'Left';
  if (l.includes('right'))  return 'Right';
  if (l.includes('centre') || l.includes('center') || l.includes('neutral')) return 'Centre';
  return 'Unknown';
}

function normaliseTier(tier) {
  const n = parseInt(tier, 10);
  if (n === 1) return 1;
  if (n === 2) return 2;
  if (n === 3) return 3;
  return 3; // default unknown sources to tier 3
}

export default function SourceCredibilityMatrix({ sources = [] }) {
  const [highlight, setHighlight] = useState(null); // "tier:lean" key

  // Build grid: { "1:Left": [src,...], "1:Centre": [...], ... }
  const grid = useMemo(() => {
    const map = {};
    for (const tier of TIER_ROWS) {
      for (const lean of LEAN_COLS) {
        map[`${tier.key}:${lean}`] = [];
      }
    }
    for (const src of sources) {
      const t = normaliseTier(src.credibility_tier);
      const l = normaliseLean(src.editorial_lean);
      const k = `${t}:${l}`;
      if (map[k]) map[k].push(src);
    }
    return map;
  }, [sources]);

  if (!sources.length) return null;

  const highlightedSources = highlight ? (grid[highlight] || []) : [];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography sx={{
        fontFamily: 'var(--font-family)', fontSize: '0.625rem', fontWeight: 600,
        color: 'var(--fg-dim)', letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.8,
      }}>
        Source Map
      </Typography>

      {/* Column headers */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '44px repeat(4, 1fr)', gap: '3px' }}>
        <div />
        {LEAN_COLS.map(col => (
          <Box key={col} sx={{
            textAlign: 'center',
            fontFamily: 'var(--font-mono)', fontSize: '0.56rem',
            color: 'var(--fg-dim)', letterSpacing: '0.06em',
            textTransform: 'uppercase', pb: 0.5,
          }}>
            {col}
          </Box>
        ))}

        {/* Grid rows */}
        {TIER_ROWS.map(tier => (
          <React.Fragment key={tier.key}>
            {/* Row label */}
            <Box sx={{
              display: 'flex', alignItems: 'center',
              fontFamily: 'var(--font-mono)', fontSize: '0.56rem',
              color: tier.color, letterSpacing: '0.05em',
              textTransform: 'uppercase', fontWeight: 600, pr: 0.5,
            }}>
              {tier.label}
            </Box>

            {LEAN_COLS.map(lean => {
              const key = `${tier.key}:${lean}`;
              const count = (grid[key] || []).length;
              const isActive = highlight === key;

              return (
                <Tooltip
                  key={lean}
                  title={
                    count > 0
                      ? (grid[key] || []).map(s => s.outlet_name || s.domain || new URL(s.url || 'http://x').hostname.replace('www.', '')).join(', ')
                      : ''
                  }
                  placement="top"
                >
                  <Box
                    onClick={() => setHighlight(isActive ? null : key)}
                    sx={{
                      height: 32, borderRadius: '7px',
                      background: count > 0
                        ? (isActive ? `${tier.color}30` : tier.bg)
                        : 'rgba(0,0,0,0.03)',
                      border: `1px solid ${count > 0 ? (isActive ? tier.color : `${tier.color}40`) : 'var(--border)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: count > 0 ? 'pointer' : 'default',
                      transition: 'all 0.14s',
                      '&:hover': count > 0 ? { borderColor: tier.color, transform: 'scale(1.04)' } : {},
                    }}
                  >
                    {count > 0 && (
                      <Typography sx={{
                        fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
                        fontWeight: 700, color: tier.color,
                      }}>
                        {count}
                      </Typography>
                    )}
                  </Box>
                </Tooltip>
              );
            })}
          </React.Fragment>
        ))}
      </Box>

      {/* Highlighted source list */}
      {highlight && highlightedSources.length > 0 && (
        <Box sx={{
          mt: 0.5, p: 1.25, borderRadius: '10px',
          background: 'rgba(0,0,0,0.03)', border: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', gap: 0.75,
        }}>
          {highlightedSources.map((src, i) => {
            const domain = (() => {
              try { return new URL(src.url || '').hostname.replace('www.', ''); }
              catch { return src.domain || ''; }
            })();
            return (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: src.state_affiliation ? '#ef4444'
                    : TIER_ROWS.find(t => t.key === normaliseTier(src.credibility_tier))?.color || '#9ca3af',
                }} />
                <Typography sx={{
                  fontFamily: 'var(--font-family)', fontSize: '0.72rem',
                  color: 'var(--fg-secondary)', lineHeight: 1.3,
                }}>
                  {src.outlet_name || domain || 'Source'}
                  {src.state_affiliation && (
                    <span style={{ marginLeft: 5, fontSize: '0.60rem', color: '#ef4444', fontWeight: 600 }}>
                      State-backed
                    </span>
                  )}
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}

      {/* Legend */}
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 0.25 }}>
        {TIER_ROWS.map(t => (
          <Box key={t.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: t.color }} />
            <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.60rem', color: 'var(--fg-dim)' }}>
              {t.label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
