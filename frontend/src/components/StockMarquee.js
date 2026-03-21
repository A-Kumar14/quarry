import React, { useEffect, useState, useCallback } from 'react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const PLACEHOLDER = [
  { symbol: 'DOW',     name: 'Dow Jones Industrial Avg.',   price: null, change: null, changePct: null, sparkline: [] },
  { symbol: 'S&P 500', name: "Standard & Poor's 500",       price: null, change: null, changePct: null, sparkline: [] },
  { symbol: 'NASDAQ',  name: 'Nasdaq Composite',            price: null, change: null, changePct: null, sparkline: [] },
  { symbol: 'AAPL',    name: 'Apple Inc.',                  price: null, change: null, changePct: null, sparkline: [] },
  { symbol: 'MSFT',    name: 'Microsoft Corp.',             price: null, change: null, changePct: null, sparkline: [] },
  { symbol: 'NVDA',    name: 'Nvidia Corp.',                price: null, change: null, changePct: null, sparkline: [] },
  { symbol: 'TSLA',    name: 'Tesla Inc.',                  price: null, change: null, changePct: null, sparkline: [] },
  { symbol: 'AMZN',    name: 'Amazon.com',                  price: null, change: null, changePct: null, sparkline: [] },
  { symbol: 'META',    name: 'Meta Platforms',              price: null, change: null, changePct: null, sparkline: [] },
  { symbol: 'GOOGL',   name: 'Alphabet Inc.',               price: null, change: null, changePct: null, sparkline: [] },
  { symbol: 'BRK-B',   name: 'Berkshire Hathaway Inc.',     price: null, change: null, changePct: null, sparkline: [] },
  { symbol: 'BA',      name: 'The Boeing Company',          price: null, change: null, changePct: null, sparkline: [] },
  { symbol: 'DIS',     name: 'The Walt Disney Co.',         price: null, change: null, changePct: null, sparkline: [] },
  { symbol: 'GE',      name: 'GE Aerospace',                price: null, change: null, changePct: null, sparkline: [] },
  { symbol: 'HD',      name: 'The Home Depot, Inc.',        price: null, change: null, changePct: null, sparkline: [] },
  { symbol: 'NKE',     name: 'NIKE, Inc.',                  price: null, change: null, changePct: null, sparkline: [] },
  { symbol: 'V',       name: 'Visa Inc.',                   price: null, change: null, changePct: null, sparkline: [] },
  { symbol: 'JPM',     name: 'JPMorgan Chase',              price: null, change: null, changePct: null, sparkline: [] },
  { symbol: 'NFLX',    name: 'Netflix Inc.',                price: null, change: null, changePct: null, sparkline: [] },
  { symbol: 'AMD',     name: 'Advanced Micro Devs',         price: null, change: null, changePct: null, sparkline: [] },
];

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function fmtPrice(n) {
  if (n == null) return '———';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtChange(n) {
  if (n == null) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/* ── SVG Sparkline ───────────────────────────────────────────────────────── */
function Sparkline({ prices, up }) {
  if (!prices || prices.length < 2) {
    // Placeholder dashed line
    return (
      <svg width={80} height={30} style={{ display: 'block', opacity: 0.25 }}>
        <line x1={0} y1={15} x2={80} y2={15}
          stroke="#888" strokeWidth={1.5} strokeDasharray="4 3" />
      </svg>
    );
  }

  const W = 80, H = 30;
  const min   = Math.min(...prices);
  const max   = Math.max(...prices);
  const range = max - min || 1;
  const pad   = 2;

  const pts = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * W;
    const y = pad + (H - 2 * pad) - ((p - min) / range) * (H - 2 * pad);
    return [x, y];
  });

  const lineStr = pts.map(([x, y]) => `${x},${y}`).join(' ');
  const fillStr = `0,${H} ${lineStr} ${W},${H}`;
  const color   = up ? '#22c55e' : '#ef4444';

  return (
    <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={`sg-${up ? 'u' : 'd'}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity={0.18} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={fillStr} fill={`url(#sg-${up ? 'u' : 'd'})`} />
      <polyline points={lineStr} fill="none" stroke={color} strokeWidth={1.5}
        strokeLinejoin="round" strokeLinecap="round" />
      {/* Dashed baseline (prev close level) */}
      <line x1={0} y1={H - pad} x2={W} y2={H - pad}
        stroke={color} strokeWidth={0.6} strokeDasharray="3 3" opacity={0.4} />
    </svg>
  );
}

/* ── Single stock card ───────────────────────────────────────────────────── */
function StockCard({ s, live }) {
  const hasData = live && s.price != null;
  const up      = (s.change ?? 0) >= 0;
  const pillBg  = hasData ? (up ? '#16a34a' : '#dc2626') : 'rgba(100,90,80,0.18)';

  return (
    <div style={{
      width:         240,
      flexShrink:    0,
      padding:       '7px 14px 8px',
      borderRight:   '1px solid rgba(80,64,48,0.09)',
      display:       'flex',
      flexDirection: 'column',
      gap:           2,
    }}>
      {/* Row 1 — symbol · sparkline · price */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Symbol + name */}
        <div style={{ flex: '0 0 auto', minWidth: 62 }}>
          <div style={{
            fontFamily:    '"Courier New", monospace',
            fontSize:      '0.72rem',
            fontWeight:    700,
            color:         'var(--fg-primary, #1a130a)',
            letterSpacing: '-0.01em',
            whiteSpace:    'nowrap',
          }}>
            {s.symbol}
          </div>
          <div style={{
            fontFamily:  'var(--font-family, sans-serif)',
            fontSize:    '0.45rem',
            color:       'var(--fg-dim, #9a8570)',
            marginTop:   1,
            maxWidth:    68,
            overflow:    'hidden',
            textOverflow:'ellipsis',
            whiteSpace:  'nowrap',
          }}>
            {s.name}
          </div>
        </div>

        {/* Sparkline */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <Sparkline prices={s.sparkline} up={up} />
        </div>

        {/* Price + change pill */}
        <div style={{ flex: '0 0 auto', textAlign: 'right' }}>
          <div style={{
            fontFamily:    '"Courier New", monospace',
            fontSize:      '0.75rem',
            fontWeight:    600,
            color:         'var(--fg-primary, #1a130a)',
            letterSpacing: '0.01em',
            whiteSpace:    'nowrap',
            animation:     !hasData ? 'stockPulse 1.8s ease-in-out infinite' : 'none',
          }}>
            {hasData ? fmtPrice(s.price) : '· · ·'}
          </div>

          {/* Change pill */}
          <div style={{
            display:       'inline-block',
            marginTop:     3,
            padding:       '1.5px 7px',
            borderRadius:  5,
            background:    pillBg,
            fontFamily:    '"Courier New", monospace',
            fontSize:      '0.5rem',
            fontWeight:    700,
            color:         hasData ? '#fff' : 'rgba(100,90,80,0.5)',
            whiteSpace:    'nowrap',
            minWidth:      44,
            textAlign:     'center',
            animation:     !hasData ? 'stockPulse 1.8s ease-in-out infinite' : 'none',
          }}>
            {hasData ? fmtChange(s.change) : '—'}
          </div>
        </div>
      </div>
    </div>
  );
}

export const STOCK_H = 46;

/* ── Main component ──────────────────────────────────────────────────────── */
export default function StockMarquee({ inline = false }) {
  const [stocks, setStocks] = useState(PLACEHOLDER);
  const [live,   setLive]   = useState(false);

  const load = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/explore/stocks`);
      if (!res.ok) throw new Error('non-2xx');
      const data = await res.json();
      if (data.stocks?.length) { setStocks(data.stocks); setLive(true); }
    } catch { /* keep showing placeholder / previous data */ }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 90 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const items = [...stocks, ...stocks];

  return (
    <div style={{
      ...(inline
        ? { position: 'relative', flexShrink: 0 }
        : { position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9998 }),
      height:           STOCK_H,
      overflow:         'hidden',
      background:       'rgba(245,240,232,0.97)',
      backdropFilter:   'blur(12px) saturate(150%)',
      WebkitBackdropFilter: 'blur(12px) saturate(150%)',
      borderBottom:     '1px solid rgba(80,64,48,0.12)',
      maskImage:        'linear-gradient(to right, transparent 0%, black 4%, black 96%, transparent 100%)',
      WebkitMaskImage:  'linear-gradient(to right, transparent 0%, black 4%, black 96%, transparent 100%)',
    }}>
      <div
        style={{
          display:   'flex',
          width:     'max-content',
          animation: 'stockScroll 80s linear infinite',
          willChange:'transform',
        }}
        onMouseEnter={e => { e.currentTarget.style.animationPlayState = 'paused'; }}
        onMouseLeave={e => { e.currentTarget.style.animationPlayState = 'running'; }}
      >
        {items.map((s, idx) => (
          <StockCard key={idx} s={s} live={live} />
        ))}
      </div>

      <style>{`
        @keyframes stockScroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes stockPulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
