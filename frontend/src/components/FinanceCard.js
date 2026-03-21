import React from 'react';
import { Box, Typography } from '@mui/material';
import { ExternalLink } from 'lucide-react';
import GlassCard from './GlassCard';

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function fmtPrice(n) {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtMarketCap(n) {
  if (!n) return null;
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

function fmtTime(ts) {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ── Sparkline SVG ───────────────────────────────────────────────────────── */
function Sparkline({ prices, up }) {
  const W = 120, H = 40;
  const color = up ? '#16a34a' : '#dc2626';

  if (!prices || prices.length < 2) {
    return (
      <svg width={W} height={H} style={{ display: 'block', opacity: 0.2 }}>
        <line x1={0} y1={H / 2} x2={W} y2={H / 2}
          stroke="#888" strokeWidth={1.5} strokeDasharray="4 3" />
      </svg>
    );
  }

  const min   = Math.min(...prices);
  const max   = Math.max(...prices);
  const range = max - min || 1;
  const pad   = 3;

  const pts = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * W;
    const y = pad + (H - 2 * pad) - ((p - min) / range) * (H - 2 * pad);
    return [x, y];
  });

  const lineStr = pts.map(([x, y]) => `${x},${y}`).join(' ');
  const fillStr = `0,${H} ${lineStr} ${W},${H}`;

  return (
    <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={`fc-grad-${up ? 'u' : 'd'}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity={0.22} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={fillStr} fill={`url(#fc-grad-${up ? 'u' : 'd'})`} />
      <polyline points={lineStr} fill="none" stroke={color} strokeWidth={2}
        strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ── Main component ──────────────────────────────────────────────────────── */
export default function FinanceCard({ data }) {
  if (!data) return null;

  const up      = (data.changePct ?? 0) >= 0;
  const color   = up ? '#16a34a' : '#dc2626';
  const pillBg  = up ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.10)';
  const sign    = up ? '+' : '';
  const mcap    = fmtMarketCap(data.marketCap);
  const news    = data.news || [];

  return (
    <GlassCard style={{ padding: '16px 20px', marginBottom: 12 }}>
      {/* ── Header row: ticker / name / price / pill ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>

        {/* Left: ticker + name + market cap */}
        <Box sx={{ flex: '0 0 auto' }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
            <Typography sx={{
              fontFamily:    '"Courier New", monospace',
              fontSize:      '1.1rem',
              fontWeight:    700,
              color:         'var(--fg-primary)',
              letterSpacing: '-0.02em',
              lineHeight:    1,
            }}>
              {data.ticker}
            </Typography>
            {mcap && (
              <Typography sx={{
                fontFamily:  'var(--font-family)',
                fontSize:    '0.62rem',
                color:       'var(--fg-dim)',
                fontWeight:  400,
              }}>
                {mcap} mkt cap
              </Typography>
            )}
          </Box>
          <Typography sx={{
            fontFamily:  'var(--font-family)',
            fontSize:    '0.7rem',
            color:       'var(--fg-secondary)',
            mt:          0.25,
            whiteSpace:  'nowrap',
          }}>
            {data.name}
          </Typography>
        </Box>

        {/* Center: sparkline */}
        <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', minWidth: 80 }}>
          <Sparkline prices={data.sparkline} up={up} />
        </Box>

        {/* Right: price + change pill */}
        <Box sx={{ flex: '0 0 auto', textAlign: 'right' }}>
          <Typography sx={{
            fontFamily:    '"Courier New", monospace',
            fontSize:      '1.45rem',
            fontWeight:    700,
            color:         'var(--fg-primary)',
            lineHeight:    1,
            letterSpacing: '-0.02em',
          }}>
            ${fmtPrice(data.price)}
          </Typography>
          <Box sx={{
            display:      'inline-flex',
            alignItems:   'center',
            gap:          0.5,
            mt:           0.5,
            px:           1,
            py:           '3px',
            borderRadius: 999,
            background:   pillBg,
            border:       `1px solid ${up ? 'rgba(22,163,74,0.25)' : 'rgba(220,38,38,0.20)'}`,
          }}>
            <Typography sx={{
              fontFamily:    '"Courier New", monospace',
              fontSize:      '0.72rem',
              fontWeight:    600,
              color:         color,
              whiteSpace:    'nowrap',
            }}>
              {sign}{fmtPrice(data.change)}  ({sign}{data.changePct?.toFixed(2)}%)
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* ── Divider ── */}
      {news.length > 0 && (
        <Box sx={{ height: '1px', bgcolor: 'var(--border)', my: 1.25 }} />
      )}

      {/* ── News items ── */}
      {news.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
          <Typography sx={{
            fontFamily:    'var(--font-family)',
            fontSize:      '0.55rem',
            fontWeight:    500,
            color:         'var(--fg-dim)',
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            mb:            0.25,
          }}>
            Recent News
          </Typography>
          {news.map((item, i) => (
            <Box
              key={i}
              component={item.url ? 'a' : 'div'}
              href={item.url || undefined}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                display:        'flex',
                alignItems:     'flex-start',
                gap:            0.75,
                textDecoration: 'none',
                p:              '5px 8px',
                borderRadius:   '7px',
                transition:     'background 0.12s',
                '&:hover':      item.url ? { background: 'rgba(229,221,208,0.5)' } : {},
              }}
            >
              <Typography sx={{
                fontFamily: 'var(--font-family)',
                fontSize:   '0.75rem',
                fontWeight: 400,
                color:      'var(--fg-secondary)',
                lineHeight: 1.4,
                flex:       1,
              }}>
                {item.title}
                {item.publisher && (
                  <span style={{ color: 'var(--fg-dim)', fontSize: '0.68rem', marginLeft: 4 }}>
                    · {item.publisher}
                    {item.published ? ` · ${fmtTime(item.published)}` : ''}
                  </span>
                )}
              </Typography>
              {item.url && (
                <ExternalLink size={11} style={{ color: 'var(--fg-dim)', flexShrink: 0, marginTop: 2 }} />
              )}
            </Box>
          ))}
        </Box>
      )}

      {/* ── "Today's intraday data" label ── */}
      <Typography sx={{
        fontFamily:  'var(--font-family)',
        fontSize:    '0.55rem',
        color:       'var(--fg-dim)',
        mt:          news.length > 0 ? 1 : 0.75,
        textAlign:   'right',
        letterSpacing: '0.04em',
      }}>
        Intraday · via Yahoo Finance · auto-refreshed
      </Typography>
    </GlassCard>
  );
}
