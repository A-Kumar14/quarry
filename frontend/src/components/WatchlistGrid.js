import React, { useState, useEffect } from 'react';
import { Box, Typography, Skeleton } from '@mui/material';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';

/** Mini stock cards with sparklines — layout controlled via `columns`. */
export default function WatchlistGrid({ dark, columns = '1fr 1fr' }) {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/explore/stocks?symbols=` + encodeURIComponent('^DJI,^GSPC,^IXIC,AAPL,NVDA,MSFT'))
      .then(r => r.json())
      .then(d => { setStocks(d.stocks || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: columns, gap: 0.75, height: '100%', gridAutoRows: '1fr' }}>
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} variant="rounded" sx={{ borderRadius: '10px', bgcolor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', minHeight: 62 }} />
        ))}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: columns, gap: 0.75, height: '100%', gridAutoRows: '1fr' }}>
      {stocks.slice(0, 6).map((s, i) => {
        const up = s.changePct >= 0;
        const clr = up ? '#22c55e' : '#ef4444';
        const isIndex = s.rawTicker?.startsWith('^');
        const pts = s.sparkline || [];
        let sparkPath = '';
        if (pts.length > 1) {
          const min = Math.min(...pts), max = Math.max(...pts);
          const range = max - min || 1;
          sparkPath = pts.map((v, j) => {
            const x = ((j / (pts.length - 1)) * 54).toFixed(1);
            const y = (18 - ((v - min) / range) * 18).toFixed(1);
            return `${j === 0 ? 'M' : 'L'}${x},${y}`;
          }).join(' ');
        }
        return (
          <Box
            key={i}
            sx={{
              p: '9px 11px',
              borderRadius: '10px',
              border: dark ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(175,150,105,0.26)',
              borderTop: dark ? '1px solid rgba(255,255,255,0.14)' : '1px solid rgba(255,255,248,0.88)',
              background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,252,244,0.75)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              boxShadow: dark
                ? '0 3px 12px rgba(0,0,0,0.30), 0 1px 0 rgba(255,255,255,0.04) inset'
                : '0 3px 12px rgba(140,110,60,0.07), 0 1px 0 rgba(255,254,228,0.80) inset',
              cursor: 'pointer',
              transition: 'all 0.14s ease',
              '&:hover': {
                transform: 'translateY(-1px)',
                boxShadow: dark
                  ? '0 6px 18px rgba(0,0,0,0.40)'
                  : '0 6px 18px rgba(140,110,60,0.12)',
              },
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.75 }}>
              <Box>
                <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.60rem', fontWeight: 700, color: 'var(--fg-primary)', letterSpacing: '0.06em', lineHeight: 1 }}>
                  {s.symbol}
                </Typography>
                <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.54rem', fontWeight: 300, color: 'var(--fg-dim)', mt: 0.25, lineHeight: 1 }}>
                  {(s.name?.length > 12 ? s.name.slice(0, 12) + '…' : s.name) || s.symbol}
                </Typography>
              </Box>
              {sparkPath && (
                <svg width={54} height={18} style={{ display: 'block', opacity: 0.75 }}>
                  <path d={sparkPath} fill="none" stroke={clr} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
              <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 600, color: 'var(--fg-primary)', lineHeight: 1 }}>
                {isIndex ? '' : '$'}{s.price?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Typography>
              <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.60rem', fontWeight: 500, color: clr, lineHeight: 1 }}>
                {up ? '+' : ''}{s.changePct?.toFixed(2)}%
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
