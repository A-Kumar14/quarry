import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Typography, Skeleton, Tooltip } from '@mui/material';
import { TrendingUp, ArrowLeft, RefreshCw, Terminal, BarChart2, Zap, FileText, Globe, Layers, Hash, Activity, Copy, Check } from 'lucide-react';
import NavControls from '../components/NavControls';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import StockMarquee from '../components/StockMarquee';
import { useTopOffset } from '../SettingsContext';
import { useDarkMode } from '../DarkModeContext';

const API           = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const MONO          = '"IBM Plex Mono", "JetBrains Mono", "Courier New", monospace';
const WATCHLIST_KEY = 'quarry_watchlist';
const INDICES       = ['^DJI', '^GSPC', '^IXIC'];
const INDEX_DISPLAY = ['DOW', 'S&P 500', 'NASDAQ'];
const DEFAULT_WATCH = ['AAPL', 'NVDA', 'MSFT', 'TSLA', 'META'];

// Company domain lookup for logo favicons
const COMPANY_DOMAINS = {
  AAPL: 'apple.com',       MSFT: 'microsoft.com',  NVDA: 'nvidia.com',
  GOOGL: 'google.com',     GOOG: 'google.com',     AMZN: 'amazon.com',
  META: 'meta.com',        TSLA: 'tesla.com',       NFLX: 'netflix.com',
  AMD: 'amd.com',          INTC: 'intel.com',       QCOM: 'qualcomm.com',
  ORCL: 'oracle.com',      CRM: 'salesforce.com',   ADBE: 'adobe.com',
  NOW: 'servicenow.com',   UBER: 'uber.com',         LYFT: 'lyft.com',
  SNAP: 'snap.com',        PINS: 'pinterest.com',   TWTR: 'twitter.com',
  SHOP: 'shopify.com',     SQ: 'squareup.com',       PYPL: 'paypal.com',
  V: 'visa.com',           MA: 'mastercard.com',     AXP: 'americanexpress.com',
  JPM: 'jpmorganchase.com', BAC: 'bankofamerica.com', GS: 'goldmansachs.com',
  WFC: 'wellsfargo.com',   C: 'citigroup.com',       MS: 'morganstanley.com',
  BRK: 'berkshirehathaway.com', 'BRK-B': 'berkshirehathaway.com',
  JNJ: 'jnj.com',          PFE: 'pfizer.com',        MRNA: 'modernatx.com',
  UNH: 'unitedhealthgroup.com', CVS: 'cvshealth.com',
  WMT: 'walmart.com',      TGT: 'target.com',        COST: 'costco.com',
  HD: 'homedepot.com',     LOW: 'lowes.com',
  BA: 'boeing.com',        GE: 'ge.com',              CAT: 'caterpillar.com',
  DIS: 'disney.com',       PARA: 'paramount.com',
  NKE: 'nike.com',         SBUX: 'starbucks.com',    MCD: 'mcdonalds.com',
  XOM: 'exxonmobil.com',   CVX: 'chevron.com',       COP: 'conocophillips.com',
  PLTR: 'palantir.com',    COIN: 'coinbase.com',     HOOD: 'robinhood.com',
  RIVN: 'rivian.com',      LCID: 'lucidmotors.com',  F: 'ford.com',
  GM: 'gm.com',            TM: 'toyota.com',
};

function getLogoUrl(symbol) {
  if (!symbol) return null;
  const key = symbol.replace(/[^A-Z0-9-]/g, '');
  const domain = COMPANY_DOMAINS[key];
  if (!domain) return null;
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}

/* ── Watchlist persistence ───────────────────────────────────────────────── */

function getSavedWatchlist() {
  try {
    const v = JSON.parse(localStorage.getItem(WATCHLIST_KEY) || 'null');
    return Array.isArray(v) && v.length ? v : DEFAULT_WATCH;
  } catch { return DEFAULT_WATCH; }
}
function saveWatchlist(list) {
  try { localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list)); } catch {}
}

/* ── Slash commands registry ─────────────────────────────────────────────── */

const SLASH_COMMANDS = [
  { name: 'analyze',    Icon: BarChart2,  args: '<TICKER>',      desc: 'AI deep-dive: technicals, fundamentals, catalysts, risks & verdict' },
  { name: 'technicals', Icon: Activity,   args: '<TICKER>',      desc: 'RSI(14), MACD, SMA(20/50) — computed from live price history'      },
  { name: 'earnings',   Icon: FileText,   args: '<TICKER>',      desc: 'AI analysis of latest earnings, revenue and guidance'               },
  { name: 'macro',      Icon: Globe,      args: '',              desc: 'Macro environment: Fed, rates, inflation & sector rotation'          },
  { name: 'brief',      Icon: Zap,        args: '',              desc: 'Morning market brief — indices, movers & key headlines'             },
  { name: 'sector',     Icon: Layers,     args: '[sector name]', desc: 'Sector rotation analysis and relative performance'                   },
  { name: 'compare',    Icon: Hash,       args: '<T1> <T2>',     desc: 'Side-by-side comparison with AI narrative'                          },
];

/* ── QFL syntax highlighter ─────────────────────────────────────────────── */

const QFL_KEYWORDS  = new Set(['HELP','INDICES','INDEX','MARKET','OVERVIEW','RATES','RATE','BONDS','YIELDS','COMPARE','WATCH','NEWS','EXPLAIN','SCREEN']);
const QFL_OPERATORS = new Set(['VS','ADD','REMOVE']);
const QFL_TICKER_RE = /^[A-Z^.]{1,6}$/;

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlightQFL(raw) {
  if (!raw) return '';
  return raw.split(/(\s+)/).map(tok => {
    if (/^\s+$/.test(tok)) return tok;
    // Slash commands — purple
    if (tok.startsWith('/')) {
      const cmdName = tok.slice(1).toLowerCase();
      const valid = SLASH_COMMANDS.some(c => c.name === cmdName || c.name.startsWith(cmdName));
      return `<span style="color:${valid ? '#a78bfa' : '#c084fc'};font-weight:700">${escHtml(tok)}</span>`;
    }
    const up = tok.toUpperCase();
    if (QFL_KEYWORDS.has(up))
      return `<span style="color:#fb923c;font-weight:700">${escHtml(tok)}</span>`;
    if (QFL_OPERATORS.has(up))
      return `<span style="color:#60a5fa;font-weight:600">${escHtml(tok)}</span>`;
    if (QFL_TICKER_RE.test(up) && tok === tok.toUpperCase())
      return `<span style="color:#e2e8f0;font-weight:600">${escHtml(tok)}</span>`;
    return `<span style="color:rgba(200,210,220,0.58)">${escHtml(tok)}</span>`;
  }).join('');
}

/* ── QFL parser ──────────────────────────────────────────────────────────── */

// Maps common index names/phrases → yfinance symbols
const INDEX_ALIASES = {
  'NASDAQ': '^IXIC', 'DOW': '^DJI', 'SP500': '^GSPC',
  'DJI': '^DJI',    'GSPC': '^GSPC', 'IXIC': '^IXIC',
  'S&P 500': '^GSPC', 'S&P500': '^GSPC', 'S&P': '^GSPC',
  'DOW JONES': '^DJI', 'DOW 30': '^DJI',
};

function parseQFL(raw) {
  const input = raw.trim();

  // Slash command — /analyze AAPL, /technicals NVDA, etc.
  if (input.startsWith('/')) {
    const [rawCmd, ...argParts] = input.slice(1).split(/\s+/);
    return { type: 'SLASH', command: rawCmd.toLowerCase(), args: argParts.filter(Boolean), raw: input };
  }

  const up    = input.toUpperCase();
  const parts = up.split(/\s+/);

  // Resolve whole-input index aliases first (handles "S&P 500", "DOW JONES", etc.)
  if (INDEX_ALIASES[up]) {
    return { type: 'QUOTE', tickers: [INDEX_ALIASES[up]], raw: input };
  }

  // Reserved keywords — must be checked before the single-ticker catch-all
  const KEYWORDS = new Set(['HELP', 'INDICES', 'INDEX', 'MARKET', 'OVERVIEW', 'RATES', 'RATE',
    'BONDS', 'YIELDS', 'COMPARE', 'WATCH', 'NEWS', 'EXPLAIN', 'SCREEN']);

  // HELP / ?
  if (parts[0] === 'HELP' || input === '?') {
    return { type: 'HELP', raw: input };
  }

  // INDICES / MARKET
  if (['INDICES', 'INDEX', 'MARKET', 'OVERVIEW'].includes(parts[0]) && parts.length === 1) {
    return { type: 'INDICES', raw: input };
  }

  // RATES / BONDS / YIELDS
  if (['RATES', 'RATE', 'BONDS', 'YIELDS'].includes(parts[0]) && parts.length === 1) {
    return { type: 'AI', query: 'Current US interest rates, treasury yields, and Fed policy outlook', raw: input };
  }

  // WATCH ADD / WATCH REMOVE
  if (parts[0] === 'WATCH' && parts[1] === 'ADD' && parts[2]) {
    return { type: 'WATCH_ADD', ticker: parts[2], raw: input };
  }
  if (parts[0] === 'WATCH' && parts[1] === 'REMOVE' && parts[2]) {
    return { type: 'WATCH_REMOVE', ticker: parts[2], raw: input };
  }

  // NEWS TICKER
  if (parts[0] === 'NEWS' && parts.length === 2) {
    return { type: 'AI', query: `Latest news and analysis for ${parts[1]} stock`, raw: input };
  }

  // EXPLAIN <term>
  if (parts[0] === 'EXPLAIN' && parts.length >= 2) {
    return { type: 'AI', query: `Explain the financial term: ${parts.slice(1).join(' ')}`, raw: input };
  }

  // SCREEN
  if (parts[0] === 'SCREEN') {
    return { type: 'AI', query: `Stock screener: ${parts.slice(1).join(' ')}`, raw: input };
  }

  // COMPARE AAPL MSFT NVDA
  if (parts[0] === 'COMPARE' && parts.length >= 3) {
    return { type: 'COMPARE', tickers: parts.slice(1), raw: input };
  }

  // VS comparison: AAPL VS MSFT
  if (parts.length === 3 && parts[1] === 'VS') {
    return { type: 'COMPARE', tickers: [parts[0], parts[2]], raw: input };
  }

  // Single ticker: AAPL — only if not a reserved keyword
  if (parts.length === 1 && /^[A-Z.^]{1,6}$/.test(parts[0]) && !KEYWORDS.has(parts[0])) {
    const resolved = INDEX_ALIASES[parts[0]] || parts[0];
    return { type: 'QUOTE', tickers: [resolved], raw: input };
  }

  // Default: AI natural language
  return { type: 'AI', query: input, raw: input };
}

/* ── Technical indicator math ────────────────────────────────────────────── */

function calcSMA(prices, period) {
  return prices.map((_, i) => {
    if (i < period - 1) return null;
    return prices.slice(i - period + 1, i + 1).reduce((s, v) => s + v, 0) / period;
  });
}

function calcEMA(prices, period) {
  const k = 2 / (period + 1);
  const result = new Array(prices.length).fill(null);
  let seed = prices.slice(0, period).reduce((s, v) => s + v, 0) / period;
  result[period - 1] = seed;
  for (let i = period; i < prices.length; i++) {
    seed = prices[i] * k + seed * (1 - k);
    result[i] = seed;
  }
  return result;
}

function calcRSI(prices, period = 14) {
  if (prices.length < period + 1) return null;
  const changes = prices.slice(1).map((v, i) => v - prices[i]);
  let avgGain = changes.slice(0, period).filter(c => c > 0).reduce((s, c) => s + c, 0) / period;
  let avgLoss = changes.slice(0, period).filter(c => c < 0).reduce((s, c) => s + Math.abs(c), 0) / period;
  for (let i = period; i < changes.length; i++) {
    const g = changes[i] > 0 ? changes[i] : 0;
    const l = changes[i] < 0 ? Math.abs(changes[i]) : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - (100 / (1 + avgGain / avgLoss));
}

function calcMACD(prices) {
  const ema12 = calcEMA(prices, 12);
  const ema26 = calcEMA(prices, 26);
  const macdLine = ema12.map((v, i) => v != null && ema26[i] != null ? v - ema26[i] : null);
  // Signal = EMA(9) of MACD
  const validStart = macdLine.findIndex(v => v != null);
  if (validStart < 0) return { line: null, signal: null, histogram: null };
  const macdValues = macdLine.slice(validStart).filter(v => v != null);
  const k = 2 / 10;
  let sig = macdValues.slice(0, 9).reduce((s, v) => s + v, 0) / 9;
  for (let i = 9; i < macdValues.length; i++) {
    sig = macdValues[i] * k + sig * (1 - k);
  }
  const last = macdValues[macdValues.length - 1] ?? null;
  const hist  = last != null ? last - sig : null;
  return { line: last, signal: sig, histogram: hist };
}

/* ── Formatting helpers ──────────────────────────────────────────────────── */

function fmtPrice(n) {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtMcap(n) {
  if (!n) return '—';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

/* ── Mini sparkline ──────────────────────────────────────────────────────── */

function MiniSparkline({ prices, up }) {
  const W = 56, H = 22;
  const color = up ? '#16a34a' : '#dc2626';
  if (!prices || prices.length < 2) {
    return (
      <svg width={W} height={H} style={{ display: 'block', opacity: 0.25 }}>
        <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="#888" strokeWidth={1} strokeDasharray="3 2" />
      </svg>
    );
  }
  const min = Math.min(...prices), max = Math.max(...prices);
  const range = max - min || 1;
  const pad = 2;
  const pts = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * W;
    const y = pad + (H - 2 * pad) - ((p - min) / range) * (H - 2 * pad);
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={W} height={H} style={{ display: 'block', flexShrink: 0 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5}
        strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ── Sidebar stock row ───────────────────────────────────────────────────── */

function StockRow({ stock, onQuery, onRemove, removable = true }) {
  const up     = (stock.changePct ?? 0) >= 0;
  const color  = up ? '#16a34a' : '#dc2626';
  const sign   = up ? '+' : '';
  const sym    = stock.symbol || stock.ticker || stock.rawTicker || '';
  const logo   = getLogoUrl(stock.rawTicker || sym);

  return (
    <Box
      onClick={() => onQuery({ type: 'QUOTE', tickers: [stock.rawTicker || sym], raw: stock.rawTicker || sym })}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1,
        px: 1.25, py: 0.9, borderRadius: '8px', cursor: 'pointer',
        position: 'relative', transition: 'background 0.12s',
        '&:hover': { background: 'rgba(249,115,22,0.06)' },
        '&:hover .rm': { opacity: 1 },
      }}
    >
      {logo && (
        <img src={logo} alt="" width={14} height={14}
          style={{ borderRadius: 3, flexShrink: 0, objectFit: 'contain' }}
          onError={e => { e.target.style.display = 'none'; }} />
      )}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Typography sx={{ fontFamily: MONO, fontSize: '0.78rem', fontWeight: 700, color: 'var(--fg-primary)' }}>
            {sym}
          </Typography>
          <Typography sx={{ fontFamily: MONO, fontSize: '0.78rem', fontWeight: 600, color: 'var(--fg-primary)' }}>
            ${stock.price?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.2 }}>
          <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.61rem', color: 'var(--fg-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 90 }}>
            {stock.name}
          </Typography>
          <Typography sx={{ fontFamily: MONO, fontSize: '0.63rem', fontWeight: 600, color }}>
            {sign}{stock.changePct?.toFixed(2)}%
          </Typography>
        </Box>
      </Box>
      <MiniSparkline prices={stock.sparkline} up={up} />
      {removable && (
        <Box
          className="rm"
          onClick={e => { e.stopPropagation(); onRemove(stock.rawTicker || sym); }}
          sx={{ opacity: 0, position: 'absolute', right: 2, top: '50%', transform: 'translateY(-50%)', p: 0.4, cursor: 'pointer', transition: 'opacity 0.12s', borderRadius: '50%', '&:hover': { background: 'rgba(220,38,38,0.10)' } }}
        >
          <Box sx={{ width: 8, height: 8, position: 'relative' }}>
            <Box sx={{ position: 'absolute', inset: 0, '&:before,&:after': { content: '""', position: 'absolute', top: '50%', left: 0, width: '100%', height: '1.5px', bgcolor: 'var(--error)', transform: 'rotate(45deg)' }, '&:after': { transform: 'rotate(-45deg)' } }} />
          </Box>
        </Box>
      )}
    </Box>
  );
}

function RowSkeleton() {
  return (
    <Box sx={{ px: 1.25, py: 0.75 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
        <Skeleton variant="text" width={38} sx={{ bgcolor: 'var(--bg-tertiary)', height: 14 }} />
        <Skeleton variant="text" width={50} sx={{ bgcolor: 'var(--bg-tertiary)', height: 14 }} />
      </Box>
      <Skeleton variant="text" width="55%" sx={{ bgcolor: 'var(--bg-tertiary)', height: 11 }} />
    </Box>
  );
}

/* ── Terminal output block types ─────────────────────────────────────────── */

const ANS = {
  '& p':              { fontFamily: 'var(--font-family)', fontWeight: 300, fontSize: '0.88rem', lineHeight: 1.8, color: 'var(--fg-primary)', my: 0.5 },
  '& h2, & h3':       { fontFamily: 'var(--font-serif)', fontWeight: 600, color: 'var(--fg-primary)', mt: 1.5, mb: 0.4 },
  '& h2':             { fontSize: '0.95rem' },
  '& h3':             { fontSize: '0.87rem' },
  '& code':           { fontFamily: 'var(--font-mono)', fontSize: '0.8rem', bgcolor: 'rgba(221,213,192,0.5)', px: '4px', borderRadius: '4px' },
  '& ul, & ol':       { pl: 2.5, my: 0.4 },
  '& li':             { color: 'var(--fg-primary)', fontWeight: 300, fontSize: '0.88rem', lineHeight: 1.75, mb: 0.2 },
  '& strong':         { fontWeight: 600 },
  '& a':              { color: 'var(--accent)', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } },
  '& table':          { borderCollapse: 'collapse', width: '100%', my: 1 },
  '& th, & td':       { border: '1px solid var(--border)', p: '5px 10px', fontSize: '0.82rem' },
  '& th':             { bgcolor: 'rgba(229,221,208,0.5)', fontWeight: 500 },
};

/* ── Terminal output card — replaces GlassCard for all output blocks ─────── */

function TerminalBlock({ children, style }) {
  const [dark] = useDarkMode();
  return (
    <div style={{
      borderRadius: 4,
      border: dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(175,150,105,0.34)',
      borderTop: dark ? '2px solid rgba(249,115,22,0.22)' : '2px solid rgba(175,150,105,0.34)',
      background: dark ? 'rgba(16,20,30,0.88)' : 'rgba(237,232,223,0.55)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      overflow: 'hidden',
      ...style,
    }}>
      {children}
    </div>
  );
}

/* ── Compare table ───────────────────────────────────────────────────────── */

function CompareResult({ stocks }) {
  if (!stocks || stocks.length === 0) {
    return (
      <TerminalBlock style={{ padding: '14px 18px' }}>
        <Typography sx={{ fontFamily: MONO, fontSize: '0.78rem', color: 'var(--error)' }}>
          ERR: Could not fetch comparison data.
        </Typography>
      </TerminalBlock>
    );
  }
  return (
    <TerminalBlock style={{ padding: '14px 20px' }}>
      <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.54rem', fontWeight: 500, color: 'var(--fg-dim)', letterSpacing: '0.10em', textTransform: 'uppercase', mb: 1.25 }}>
        Comparison
      </Typography>
      <Box sx={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['', 'Ticker', 'Name', 'Price', 'Change', '%', 'Mkt Cap', '5D'].map(h => (
                <th key={h} style={{
                  padding: '5px 10px', textAlign: ['Price', '%', 'Mkt Cap', '5D'].includes(h) ? 'right' : 'left',
                  fontFamily: 'var(--font-family)', fontSize: '0.62rem', fontWeight: 600,
                  color: 'var(--fg-dim)', letterSpacing: '0.06em', textTransform: 'uppercase',
                  borderBottom: '1px solid var(--border)', paddingBottom: 6,
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stocks.map((s, i) => {
              const sym   = s.symbol || s.ticker || '';
              const up    = (s.changePct ?? 0) >= 0;
              const color = up ? '#16a34a' : '#dc2626';
              const sign  = up ? '+' : '';
              const logo  = getLogoUrl(s.rawTicker || sym);
              return (
                <tr key={i} style={{ borderBottom: i < stocks.length - 1 ? '1px solid rgba(193,180,155,0.2)' : 'none' }}>
                  <td style={{ padding: '8px 6px 8px 10px', width: 28 }}>
                    {logo
                      ? <img src={logo} alt="" width={18} height={18}
                          style={{ borderRadius: 4, display: 'block', objectFit: 'contain' }}
                          onError={e => { e.target.style.display = 'none'; }} />
                      : <Box sx={{ width: 18, height: 18, borderRadius: '4px', bgcolor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Typography sx={{ fontFamily: MONO, fontSize: '0.44rem', fontWeight: 700, color: 'var(--fg-dim)' }}>{sym.slice(0,2)}</Typography>
                        </Box>
                    }
                  </td>
                  <td style={{ padding: '8px 10px', fontFamily: MONO, fontSize: '0.82rem', fontWeight: 700, color: 'var(--fg-primary)' }}>
                    {sym}
                  </td>
                  <td style={{ padding: '8px 10px', fontFamily: 'var(--font-family)', fontSize: '0.72rem', color: 'var(--fg-secondary)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.name}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: MONO, fontSize: '0.82rem', fontWeight: 600, color: 'var(--fg-primary)' }}>
                    ${fmtPrice(s.price)}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: MONO, fontSize: '0.78rem', color }}>
                    {sign}{fmtPrice(s.change)}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: MONO, fontSize: '0.78rem', fontWeight: 600, color }}>
                    {sign}{s.changePct?.toFixed(2)}%
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: MONO, fontSize: '0.72rem', color: 'var(--fg-secondary)' }}>
                    {fmtMcap(s.marketCap)}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                    <MiniSparkline prices={s.sparkline} up={up} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Box>
    </TerminalBlock>
  );
}

/* ── Help card ───────────────────────────────────────────────────────────── */

const HELP_COMMANDS = [
  ['AAPL',                   'Live quote for any ticker'],
  ['AAPL VS MSFT',           'Side-by-side comparison'],
  ['COMPARE AAPL MSFT NVDA', 'Multi-stock comparison table'],
  ['INDICES',                'Market overview (DOW, S&P, NASDAQ)'],
  ['NEWS AAPL',              'AI-powered news analysis'],
  ['RATES',                  'Interest rates & treasury yields'],
  ['EXPLAIN <term>',         'Define any financial term'],
  ['WATCH ADD AAPL',         'Add ticker to your watchlist'],
  ['WATCH REMOVE AAPL',      'Remove from watchlist'],
  ['HELP',                   'Show this reference'],
  ['<natural language>',     'Ask anything in plain English'],
];

function HelpResult() {
  return (
    <TerminalBlock style={{ padding: '16px 20px' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
        <Terminal size={13} style={{ color: 'var(--accent)' }} />
        <Typography sx={{ fontFamily: MONO, fontSize: '0.72rem', fontWeight: 700, color: 'var(--fg-primary)', letterSpacing: '0.04em' }}>
          QUARRY FINANCE LANGUAGE (QFL)
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {HELP_COMMANDS.map(([cmd, desc], i) => (
          <Box key={i} sx={{ display: 'flex', gap: 2, alignItems: 'baseline' }}>
            <Typography sx={{ fontFamily: MONO, fontSize: '0.76rem', fontWeight: 600, color: 'var(--accent)', minWidth: 220, flexShrink: 0 }}>
              {cmd}
            </Typography>
            <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.78rem', fontWeight: 300, color: 'var(--fg-secondary)' }}>
              {desc}
            </Typography>
          </Box>
        ))}
      </Box>
      <Box sx={{ mt: 1.5, pt: 1.25, borderTop: '1px solid var(--border)' }}>
        <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.68rem', color: 'var(--fg-dim)' }}>
          Commands are case-insensitive. Press ↑/↓ in the terminal to navigate command history.
        </Typography>
      </Box>
    </TerminalBlock>
  );
}

/* ── Technicals card ─────────────────────────────────────────────────────── */

function TechnicalsCard({ ticker }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState('');

  useEffect(() => {
    if (!ticker) return;
    setLoading(true); setErr('');
    fetch(`${API}/explore/chart/${encodeURIComponent(ticker)}?period=3M`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => {
        const prices = d.prices || [];
        const rsi  = calcRSI(prices);
        const sma20 = calcSMA(prices, 20);
        const sma50 = calcSMA(prices, 50);
        const macd  = calcMACD(prices);
        const last  = prices[prices.length - 1] ?? null;
        const s20   = sma20[sma20.length - 1];
        const s50   = sma50[sma50.length - 1];
        setData({ rsi, macd, sma20: s20, sma50: s50, price: last });
        setLoading(false);
      })
      .catch(() => { setErr('Could not compute technicals.'); setLoading(false); });
  }, [ticker]);

  if (loading) {
    return (
      <TerminalBlock style={{ padding: '16px 20px' }}>
        {[60, 45, 72].map((w, i) => (
          <Skeleton key={i} variant="text" width={`${w}%`} sx={{ bgcolor: 'var(--bg-tertiary)', height: 16, mb: 0.5 }} />
        ))}
      </TerminalBlock>
    );
  }
  if (err) {
    return (
      <TerminalBlock style={{ padding: '14px 18px' }}>
        <Typography sx={{ fontFamily: MONO, fontSize: '0.78rem', color: 'var(--error)' }}>{err}</Typography>
      </TerminalBlock>
    );
  }

  const { rsi, macd, sma20, sma50, price } = data;

  // Signal logic
  function rsiSignal(v) {
    if (v == null) return { label: '–', color: 'var(--fg-dim)' };
    if (v > 70)   return { label: 'Overbought', color: '#ef4444' };
    if (v < 30)   return { label: 'Oversold',   color: '#22c55e' };
    return { label: 'Neutral', color: '#fb923c' };
  }
  function trendSignal() {
    if (!price || !sma20 || !sma50) return { label: '–', color: 'var(--fg-dim)' };
    if (price > sma20 && sma20 > sma50) return { label: 'Bullish',  color: '#22c55e' };
    if (price < sma20 && sma20 < sma50) return { label: 'Bearish',  color: '#ef4444' };
    return { label: 'Mixed', color: '#fb923c' };
  }
  function macdSignal() {
    if (!macd || macd.histogram == null) return { label: '–', color: 'var(--fg-dim)' };
    if (macd.histogram > 0 && macd.line > 0) return { label: 'Bullish crossover', color: '#22c55e' };
    if (macd.histogram < 0 && macd.line < 0) return { label: 'Bearish crossover', color: '#ef4444' };
    if (macd.histogram > 0) return { label: 'Momentum building', color: '#fb923c' };
    return { label: 'Momentum fading', color: '#ef4444' };
  }

  const rsiSig   = rsiSignal(rsi);
  const trendSig = trendSignal();
  const macdSig  = macdSignal();

  const row = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1, borderBottom: '1px solid var(--border)' };
  const label = { fontFamily: 'var(--font-family)', fontSize: '0.72rem', color: 'var(--fg-secondary)' };
  const val   = { fontFamily: MONO, fontSize: '0.75rem', fontWeight: 700, color: 'var(--fg-primary)' };

  return (
    <TerminalBlock style={{ padding: '16px 20px' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
        <Activity size={13} style={{ color: 'var(--accent)' }} />
        <Typography sx={{ fontFamily: MONO, fontSize: '0.72rem', fontWeight: 700, color: 'var(--fg-primary)', letterSpacing: '0.04em' }}>
          TECHNICALS — {ticker} <Typography component="span" sx={{ fontFamily: 'var(--font-family)', fontSize: '0.60rem', fontWeight: 400, color: 'var(--fg-dim)', ml: 0.5 }}>3-month window</Typography>
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        {/* RSI */}
        <Box sx={row}>
          <Box>
            <Typography sx={label}>RSI (14)</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography sx={val}>{rsi != null ? rsi.toFixed(1) : '–'}</Typography>
            <Box sx={{ px: 1, py: '2px', borderRadius: 999, background: rsiSig.color + '20', border: `1px solid ${rsiSig.color}40` }}>
              <Typography sx={{ fontFamily: MONO, fontSize: '0.62rem', fontWeight: 700, color: rsiSig.color }}>{rsiSig.label}</Typography>
            </Box>
          </Box>
        </Box>
        {/* SMA 20 / 50 */}
        <Box sx={row}>
          <Typography sx={label}>SMA (20 / 50)</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography sx={{ ...val, fontSize: '0.70rem' }}>
              {sma20 != null ? sma20.toFixed(2) : '–'} / {sma50 != null ? sma50.toFixed(2) : '–'}
            </Typography>
            <Box sx={{ px: 1, py: '2px', borderRadius: 999, background: trendSig.color + '20', border: `1px solid ${trendSig.color}40` }}>
              <Typography sx={{ fontFamily: MONO, fontSize: '0.62rem', fontWeight: 700, color: trendSig.color }}>{trendSig.label}</Typography>
            </Box>
          </Box>
        </Box>
        {/* MACD */}
        <Box sx={{ ...row, borderBottom: 'none' }}>
          <Box>
            <Typography sx={label}>MACD (12/26/9)</Typography>
            <Typography sx={{ fontFamily: MONO, fontSize: '0.60rem', color: 'var(--fg-dim)', mt: 0.2 }}>
              Line: {macd?.line != null ? macd.line.toFixed(3) : '–'} · Signal: {macd?.signal != null ? macd.signal.toFixed(3) : '–'} · Hist: {macd?.histogram != null ? macd.histogram.toFixed(3) : '–'}
            </Typography>
          </Box>
          <Box sx={{ px: 1, py: '2px', borderRadius: 999, background: macdSig.color + '20', border: `1px solid ${macdSig.color}40`, flexShrink: 0, ml: 2 }}>
            <Typography sx={{ fontFamily: MONO, fontSize: '0.62rem', fontWeight: 700, color: macdSig.color }}>{macdSig.label}</Typography>
          </Box>
        </Box>
      </Box>
      <Box sx={{ mt: 1.25, pt: 1, borderTop: '1px solid var(--border)' }}>
        <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.65rem', color: 'var(--fg-dim)' }}>
          Indicators computed client-side from 3-month daily close prices. Not investment advice.
        </Typography>
      </Box>
    </TerminalBlock>
  );
}

/* ── Command palette ─────────────────────────────────────────────────────── */

function CommandPalette({ query, onSelect, activeIdx, dark }) {
  const filtered = SLASH_COMMANDS.filter(c =>
    !query || c.name.startsWith(query.toLowerCase())
  );
  if (filtered.length === 0) return null;

  return (
    <div style={{
      position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, right: 0,
      zIndex: 500,
      background: dark ? 'rgba(14,17,26,0.97)' : 'rgba(253,250,243,0.98)',
      border: dark ? '1px solid rgba(167,139,250,0.20)' : '1px solid rgba(167,139,250,0.30)',
      borderRadius: 10,
      backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
      boxShadow: dark ? '0 -16px 48px rgba(0,0,0,0.60)' : '0 -12px 36px rgba(100,70,200,0.10)',
      overflow: 'hidden',
      animation: 'palIn 0.13s ease',
    }}>
      {/* Header */}
      <div style={{
        padding: '7px 14px 5px',
        borderBottom: dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
        fontFamily: 'var(--font-family)', fontSize: '0.52rem', fontWeight: 600,
        color: dark ? 'rgba(167,139,250,0.70)' : 'rgba(109,40,217,0.60)',
        letterSpacing: '0.12em', textTransform: 'uppercase',
      }}>
        Slash Commands
      </div>
      {filtered.map((cmd, i) => {
        const isActive = i === activeIdx;
        const { Icon } = cmd;
        return (
          <div
            key={cmd.name}
            onMouseDown={e => { e.preventDefault(); onSelect(cmd); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 14px',
              cursor: 'pointer',
              background: isActive
                ? (dark ? 'rgba(167,139,250,0.12)' : 'rgba(167,139,250,0.08)')
                : 'transparent',
              borderLeft: isActive ? '2px solid #a78bfa' : '2px solid transparent',
              transition: 'background 0.08s',
            }}
          >
            <Icon size={13} style={{ color: '#a78bfa', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{
                fontFamily: '"IBM Plex Mono","Courier New",monospace',
                fontSize: '0.78rem', fontWeight: 700, color: '#a78bfa',
              }}>/{cmd.name}</span>
              {cmd.args && (
                <span style={{
                  fontFamily: '"IBM Plex Mono","Courier New",monospace',
                  fontSize: '0.72rem', fontWeight: 400,
                  color: dark ? 'rgba(200,210,220,0.45)' : 'rgba(80,70,60,0.45)',
                  marginLeft: 6,
                }}>{cmd.args}</span>
              )}
              <div style={{
                fontFamily: 'var(--font-family)', fontSize: '0.64rem',
                color: dark ? 'rgba(160,170,180,0.55)' : 'rgba(80,70,60,0.55)',
                marginTop: 1,
              }}>{cmd.desc}</div>
            </div>
          </div>
        );
      })}
      <style>{`@keyframes palIn { from { opacity:0; transform:translateY(6px) scale(0.98); } to { opacity:1; transform:translateY(0) scale(1); } }`}</style>
    </div>
  );
}

/* ── System message (watch add/remove, errors) ───────────────────────────── */

function SystemMessage({ text, variant = 'info' }) {
  const color = variant === 'error' ? 'var(--error)' : variant === 'success' ? '#16a34a' : 'var(--fg-dim)';
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.5 }}>
      <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
      <Typography sx={{ fontFamily: MONO, fontSize: '0.76rem', color }}>
        {text}
      </Typography>
    </Box>
  );
}

/* ── AI streaming result ─────────────────────────────────────────────────── */

function AIResult({ text, streaming, sources }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);

  return (
    <TerminalBlock style={{ padding: '16px 20px' }}>
      <Box sx={ANS}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      </Box>
      {streaming && (
        <Box component="span" sx={{ display: 'inline-block', width: '2px', height: '1em', bgcolor: 'var(--accent)', ml: '2px', animation: 'blinkPulse 1s step-end infinite', verticalAlign: 'text-bottom' }} />
      )}
      {!streaming && sources?.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1.25, pt: 1, borderTop: '1px solid var(--border)' }}>
          {sources.slice(0, 5).map((src, i) => (
            <Box key={i} component="a" href={src.url} target="_blank" rel="noopener noreferrer"
              sx={{ display: 'flex', alignItems: 'center', gap: 0.4, px: 0.9, py: '2px', borderRadius: 999, textDecoration: 'none', border: '1px solid var(--border)', background: 'var(--gbtn-bg)', fontFamily: 'var(--font-family)', fontSize: '0.60rem', color: 'var(--fg-dim)', transition: 'all 0.12s', '&:hover': { borderColor: 'rgba(249,115,22,0.3)', color: 'var(--fg-secondary)' } }}>
              {src.favicon && <img src={src.favicon} alt="" width={10} height={10} style={{ borderRadius: 2 }} />}
              [{i + 1}] {(src.title || src.url)?.slice(0, 36)}
            </Box>
          ))}
        </Box>
      )}
      {!streaming && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
          <Tooltip title={copied ? 'Copied!' : 'Copy response'} placement="top">
            <Box
              component="button"
              onClick={handleCopy}
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.5,
                px: 1, py: '3px', borderRadius: '5px', cursor: 'pointer',
                border: '1px solid', transition: 'all 0.14s ease',
                background: copied ? 'rgba(34,197,94,0.08)' : 'transparent',
                borderColor: copied ? 'rgba(34,197,94,0.3)' : 'var(--border)',
                '&:hover': { borderColor: 'var(--fg-dim)', background: 'rgba(255,255,255,0.04)' },
              }}
            >
              {copied
                ? <Check size={10} color="#22c55e" />
                : <Copy size={10} color="var(--fg-dim)" />}
              <Typography sx={{ fontFamily: MONO, fontSize: '0.58rem', color: copied ? '#22c55e' : 'var(--fg-dim)', letterSpacing: '0.04em' }}>
                {copied ? 'COPIED' : 'COPY'}
              </Typography>
            </Box>
          </Tooltip>
        </Box>
      )}
    </TerminalBlock>
  );
}

/* ── Terminal output item ────────────────────────────────────────────────── */

/* ── Stock chart ─────────────────────────────────────────────────────────── */

const PERIODS = ['1D', '1W', '1M', '3M', '1Y', '5Y'];

function StockChart({ ticker, dark }) {
  const [period,    setPeriod]    = useState('1M');
  const [chartData, setChartData] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [err,       setErr]       = useState('');

  useEffect(() => {
    if (!ticker) return;
    setLoading(true); setErr('');
    fetch(`${API}/explore/chart/${encodeURIComponent(ticker)}?period=${period}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { setChartData(d); setLoading(false); })
      .catch(() => { setErr('Chart unavailable'); setLoading(false); });
  }, [ticker, period]);

  const up        = (chartData?.pctChange ?? 0) >= 0;
  const color     = up ? '#22c55e' : '#ef4444';   // used only for period % readout
  const sign      = up ? '+' : '';
  const lineColor = dark ? '#fb923c' : '#f97316'; // orange — Quarry Finance theme

  // SVG chart
  const W = 700, H = 130, PAD = { t: 10, r: 8, b: 28, l: 52 };
  const iW = W - PAD.l - PAD.r, iH = H - PAD.t - PAD.b;

  function buildPath(prices) {
    if (!prices || prices.length < 2) return '';
    const min = Math.min(...prices), max = Math.max(...prices);
    const range = max - min || 1;
    const pts = prices.map((p, i) => {
      const x = PAD.l + (i / (prices.length - 1)) * iW;
      const y = PAD.t + iH - ((p - min) / range) * iH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return `M ${pts.join(' L ')}`;
  }

  function buildFill(prices) {
    if (!prices || prices.length < 2) return '';
    const min = Math.min(...prices), max = Math.max(...prices);
    const range = max - min || 1;
    const pts = prices.map((p, i) => {
      const x = PAD.l + (i / (prices.length - 1)) * iW;
      const y = PAD.t + iH - ((p - min) / range) * iH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const bL = `${PAD.l},${(PAD.t + iH).toFixed(1)}`;
    const bR = `${(PAD.l + iW).toFixed(1)},${(PAD.t + iH).toFixed(1)}`;
    return `M ${bL} L ${pts.join(' L ')} L ${bR} Z`;
  }

  function yLabels(prices) {
    if (!prices || prices.length < 2) return [];
    const min = Math.min(...prices), max = Math.max(...prices);
    const range = max - min || 1;
    return [0, 0.25, 0.5, 0.75, 1].map(frac => {
      const val = min + frac * range;
      const y   = PAD.t + iH - frac * iH;
      const label = val >= 1000 ? `$${(val / 1000).toFixed(1)}k` : `$${val.toFixed(0)}`;
      return { y, label };
    });
  }

  function xLabels(dates, prices) {
    if (!dates || dates.length < 2) return [];
    const n = Math.min(5, dates.length);
    return Array.from({ length: n }, (_, i) => {
      const idx = Math.round((i / (n - 1)) * (dates.length - 1));
      const x   = PAD.l + (idx / (dates.length - 1)) * iW;
      const raw = dates[idx] || '';
      const label = raw.includes(' ')
        ? raw.slice(11, 16)
        : raw.slice(5);
      return { x, label };
    });
  }

  return (
    <Box>
      {/* Period buttons */}
      <Box sx={{ display: 'flex', gap: 0.5, mb: 1.25 }}>
        {PERIODS.map(p => (
          <Box
            key={p}
            onClick={() => setPeriod(p)}
            sx={{
              px: 1.1, py: 0.35, borderRadius: '6px', cursor: 'pointer',
              fontFamily: MONO, fontSize: '0.70rem', fontWeight: 600,
              transition: 'all 0.12s',
              ...(p === period
                ? { bgcolor: 'var(--accent)', color: '#fff' }
                : { color: 'var(--fg-dim)', '&:hover': { color: 'var(--fg-primary)', bgcolor: 'var(--bg-tertiary)' } }
              ),
            }}
          >
            {p}
          </Box>
        ))}
        {chartData && (
          <Typography sx={{ ml: 'auto', fontFamily: MONO, fontSize: '0.72rem', fontWeight: 600, color, alignSelf: 'center' }}>
            {sign}{chartData.pctChange?.toFixed(2)}%
          </Typography>
        )}
      </Box>

      {/* Chart */}
      {loading && (
        <Skeleton variant="rectangular" height={130} sx={{ bgcolor: 'var(--bg-tertiary)', borderRadius: '8px' }} />
      )}
      {err && !loading && (
        <Box sx={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography sx={{ fontFamily: MONO, fontSize: '0.70rem', color: 'var(--fg-dim)' }}>{err}</Typography>
        </Box>
      )}
      {!loading && !err && chartData?.prices?.length > 1 && (
        <Box sx={{ overflowX: 'auto', background: 'rgba(0,0,0,0.38)', borderRadius: '6px', p: '8px 4px 4px' }}>
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', minWidth: 280 }}>
            <defs>
              <linearGradient id="cg-line" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={lineColor} stopOpacity={0.22} />
                <stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>

            {/* Y gridlines + labels */}
            {yLabels(chartData.prices).map(({ y, label }, i) => (
              <g key={i}>
                <line x1={PAD.l} y1={y} x2={PAD.l + iW} y2={y}
                  stroke={dark ? 'rgba(255,255,255,0.06)' : 'rgba(193,180,155,0.2)'}
                  strokeWidth={0.5} strokeDasharray="3 3" />
                <text x={PAD.l - 5} y={y + 3.5} textAnchor="end"
                  fontFamily="'IBM Plex Mono', 'Courier New', monospace" fontSize={9}
                  fill={dark ? 'rgba(200,190,175,0.50)' : 'rgba(120,105,80,0.7)'}>
                  {label}
                </text>
              </g>
            ))}

            {/* X date labels */}
            {xLabels(chartData.dates, chartData.prices).map(({ x, label }, i) => (
              <text key={i} x={x} y={H - 6} textAnchor="middle"
                fontFamily="'IBM Plex Mono', 'Courier New', monospace" fontSize={9}
                fill={dark ? 'rgba(200,190,175,0.45)' : 'rgba(120,105,80,0.6)'}>
                {label}
              </text>
            ))}

            {/* Fill */}
            <path d={buildFill(chartData.prices)} fill="url(#cg-line)" />
            {/* Line */}
            <path d={buildPath(chartData.prices)} fill="none" stroke={lineColor} strokeWidth={1.8}
              strokeLinejoin="round" strokeLinecap="round" />
          </svg>
        </Box>
      )}
    </Box>
  );
}

/* ── Quote detail (chart + header + actions) ─────────────────────────────── */

function QuoteDetail({ data, onAction }) {
  const [dark] = useDarkMode();
  const sym   = data.symbol || data.ticker || data.rawTicker || '';
  const logo  = getLogoUrl(data.rawTicker || sym);
  const up    = (data.changePct ?? 0) >= 0;
  const color = up ? '#16a34a' : '#dc2626';
  const pillBg= up ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.10)';
  const sign  = up ? '+' : '';

  const actions = [
    { label: 'Analyze',  cmd: `${sym} stock analysis and outlook` },
    { label: 'News',     cmd: `NEWS ${sym}` },
    { label: 'Earnings', cmd: `${sym} latest earnings and revenue` },
    { label: 'Compare',  cmd: `COMPARE ${sym} ` },
  ];

  return (
    <TerminalBlock style={{ padding: '16px 20px', marginBottom: 12 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
        {logo && (
          <img src={logo} alt="" width={28} height={28}
            style={{ borderRadius: 7, objectFit: 'contain', flexShrink: 0 }}
            onError={e => { e.target.style.display = 'none'; }} />
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
            <Typography sx={{ fontFamily: MONO, fontSize: '1.05rem', fontWeight: 700, color: 'var(--fg-primary)' }}>
              {sym}
            </Typography>
            <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.68rem', color: 'var(--fg-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {data.name}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
          <Typography sx={{ fontFamily: MONO, fontSize: '1.35rem', fontWeight: 700, color: 'var(--fg-primary)', lineHeight: 1 }}>
            ${data.price?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Typography>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', mt: 0.4, px: 1, py: '2px', borderRadius: 999, background: pillBg, border: `1px solid ${up ? 'rgba(22,163,74,0.25)' : 'rgba(220,38,38,0.20)'}` }}>
            <Typography sx={{ fontFamily: MONO, fontSize: '0.70rem', fontWeight: 600, color, whiteSpace: 'nowrap' }}>
              {sign}{fmtPrice(data.change)} ({sign}{data.changePct?.toFixed(2)}%)
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Chart */}
      <StockChart ticker={data.rawTicker || sym} dark={dark} />

      {/* Quick action buttons */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1.5, pt: 1.25, borderTop: '1px solid var(--border)' }}>
        {actions.map(({ label, cmd }) => (
          <Box
            key={label}
            onClick={() => onAction(cmd)}
            sx={{
              px: 1.25, py: 0.45, borderRadius: '7px', cursor: 'pointer',
              border: '1px solid var(--border)', background: 'rgba(249,115,22,0.05)',
              fontFamily: 'var(--font-family)', fontSize: '0.72rem', fontWeight: 500,
              color: 'var(--accent)', transition: 'all 0.12s',
              '&:hover': { background: 'rgba(249,115,22,0.12)', borderColor: 'rgba(249,115,22,0.4)' },
            }}
          >
            {label} →
          </Box>
        ))}
      </Box>
    </TerminalBlock>
  );
}

/* ── Terminal output block ───────────────────────────────────────────────── */

function OutputItem({ item, onAction }) {
  const num = item.cellNum;
  return (
    <Box sx={{ mb: 3, display: 'flex', gap: 0 }}>
      {/* Left gutter — Jupyter-style cell number */}
      <Box sx={{
        width: 52, flexShrink: 0, pt: 0.25,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', pr: 1.5,
        userSelect: 'none',
      }}>
        {/* In [n]: */}
        {item.command && (
          <Typography sx={{ fontFamily: MONO, fontSize: '0.62rem', color: 'var(--fg-dim)', lineHeight: 1, mb: 0.5, whiteSpace: 'nowrap' }}>
            [{num}]:
          </Typography>
        )}
      </Box>

      {/* Cell body */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* Command echo */}
        {item.command && (
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75,
            px: 1.25, py: 0.5,
            borderLeft: '2px solid var(--accent)',
            background: 'rgba(249,115,22,0.04)',
          }}>
            <Typography sx={{ fontFamily: MONO, fontSize: '0.78rem', fontWeight: 500, color: 'var(--fg-primary)', letterSpacing: '0.02em' }}>
              {item.command}
            </Typography>
          </Box>
        )}

      {/* Result */}
      {item.type === 'loading' && (
        <TerminalBlock style={{ padding: '16px 20px' }}>
          {[72, 58, 82].map((w, i) => (
            <Skeleton key={i} variant="text" width={`${w}%`} sx={{ bgcolor: 'var(--bg-tertiary)', height: 16, mb: 0.4 }} />
          ))}
        </TerminalBlock>
      )}
      {item.type === 'quote' && item.data && <QuoteDetail data={item.data} onAction={onAction} />}
      {item.type === 'compare' && <CompareResult stocks={item.data} />}
      {item.type === 'indices' && <CompareResult stocks={item.data} />}
      {item.type === 'ai' && (
        <AIResult text={item.text || ''} streaming={item.streaming} sources={item.sources} />
      )}
      {item.type === 'help' && <HelpResult />}
      {item.type === 'technicals' && <TechnicalsCard ticker={item.ticker} />}
      {item.type === 'system' && <SystemMessage text={item.text} variant={item.variant} />}
      {item.type === 'error' && <SystemMessage text={item.text} variant="error" />}
      </Box>
    </Box>
  );
}

/* ── Finance dashboard (empty-state) ────────────────────────────────────── */

const QUICK_COMMANDS = ['AAPL', 'INDICES', 'NVDA VS MSFT', 'RATES', 'HELP'];

/* Reusable section label */
function DashLabel({ label }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
      <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.50rem', fontWeight: 600, color: 'var(--fg-dim)', letterSpacing: '0.14em', textTransform: 'uppercase', flexShrink: 0 }}>
        {label}
      </Typography>
      <Box sx={{ flex: 1, height: '1px', bgcolor: 'rgba(255,255,255,0.07)' }} />
    </Box>
  );
}

/* Sparkline path builder */
function buildSpark(pts, w, h) {
  if (!pts || pts.length < 2) return '';
  const min = Math.min(...pts), max = Math.max(...pts), range = max - min || 1;
  return pts.map((v, j) => {
    const x = ((j / (pts.length - 1)) * w).toFixed(1);
    const y = (h - ((v - min) / range) * h).toFixed(1);
    return `${j === 0 ? 'M' : 'L'}${x},${y}`;
  }).join(' ');
}

function TopMovers({ prices, onCommand }) {
  const allPrices = prices || [];
  const indexPrices = allPrices.filter(s => INDICES.includes(s.rawTicker));
  const userPrices  = allPrices.filter(s => !INDICES.includes(s.rawTicker));

  /* Top movers from user watchlist sorted by |changePct| */
  const movers = [...userPrices]
    .filter(s => s.changePct != null)
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));

  const tileBase = {
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.07)',
    borderTop: '1px solid rgba(255,255,255,0.11)',
    background: 'rgba(255,255,255,0.03)',
    cursor: 'pointer', transition: 'all 0.13s',
  };
  const tileHover = { background: 'rgba(249,115,22,0.07)', borderColor: 'rgba(249,115,22,0.26)', borderTopColor: 'rgba(249,115,22,0.26)' };

  return (
    <Box sx={{ pt: 2, pb: 4, px: 0.5 }}>

      {/* ── Indices overview ── */}
      <Box sx={{ mb: 3 }}>
        <DashLabel label="Market Overview" />
        {indexPrices.length === 0 ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
            {[0,1,2].map(i => <Skeleton key={i} variant="rounded" height={80} sx={{ borderRadius: '8px', bgcolor: 'rgba(255,255,255,0.05)' }} />)}
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
            {indexPrices.map((s, i) => {
              const up  = s.changePct >= 0;
              const clr = up ? '#22c55e' : '#ef4444';
              const sym = s.symbol || s.ticker || '';
              const sp  = buildSpark(s.sparkline, 72, 28);
              return (
                <Box key={i} onClick={() => onCommand(s.rawTicker || sym)} sx={{ ...tileBase, p: '14px 16px', '&:hover': tileHover }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.25 }}>
                    <Box>
                      <Typography sx={{ fontFamily: MONO, fontSize: '0.62rem', fontWeight: 700, color: 'var(--fg-dim)', letterSpacing: '0.08em' }}>
                        {sym}
                      </Typography>
                      <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.56rem', fontWeight: 300, color: 'var(--fg-dim)', mt: 0.25, lineHeight: 1, opacity: 0.7 }}>
                        {s.name?.length > 16 ? s.name.slice(0, 16) + '…' : s.name}
                      </Typography>
                    </Box>
                    {sp && (
                      <svg width={72} height={28} style={{ display: 'block', opacity: 0.80 }}>
                        <path d={sp} fill="none" stroke={clr} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </Box>
                  <Typography sx={{ fontFamily: MONO, fontSize: '1.05rem', fontWeight: 700, color: 'var(--fg-primary)', lineHeight: 1, mb: 0.5 }}>
                    {s.price?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                  <Typography sx={{ fontFamily: MONO, fontSize: '0.66rem', fontWeight: 600, color: clr }}>
                    {up ? '+' : ''}{s.changePct?.toFixed(2)}%
                  </Typography>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>

      {/* ── Top movers ── */}
      <Box sx={{ mb: 3 }}>
        <DashLabel label="Top Movers" />
        {movers.length === 0 ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
            {[0,1,2,3].map(i => <Skeleton key={i} variant="rounded" height={72} sx={{ borderRadius: '8px', bgcolor: 'rgba(255,255,255,0.05)' }} />)}
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
            {movers.slice(0, 6).map((s, i) => {
              const up  = s.changePct >= 0;
              const clr = up ? '#22c55e' : '#ef4444';
              const sym = s.symbol || s.ticker || s.rawTicker || '';
              const sp  = buildSpark(s.sparkline, 80, 26);
              const logo = getLogoUrl(s.rawTicker || sym);
              return (
                <Box key={i} onClick={() => onCommand(s.rawTicker || sym)} sx={{ ...tileBase, p: '11px 14px', display: 'flex', alignItems: 'center', gap: 1.5, '&:hover': tileHover }}>
                  {logo && (
                    <img src={logo} alt="" width={18} height={18}
                      style={{ borderRadius: 4, flexShrink: 0, objectFit: 'contain' }}
                      onError={e => { e.target.style.display = 'none'; }} />
                  )}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.25 }}>
                      <Typography sx={{ fontFamily: MONO, fontSize: '0.74rem', fontWeight: 700, color: 'var(--fg-primary)' }}>
                        {sym}
                      </Typography>
                      <Typography sx={{ fontFamily: MONO, fontSize: '0.68rem', fontWeight: 600, color: clr }}>
                        {up ? '+' : ''}{s.changePct?.toFixed(2)}%
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography sx={{ fontFamily: MONO, fontSize: '0.82rem', fontWeight: 600, color: 'var(--fg-primary)', lineHeight: 1 }}>
                        ${s.price?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Typography>
                      {sp && (
                        <svg width={80} height={26} style={{ display: 'block', opacity: 0.80, flexShrink: 0 }}>
                          <path d={sp} fill="none" stroke={clr} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>

      {/* ── Quick commands ── */}
      <Box>
        <DashLabel label="Quick Commands" />
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
          {QUICK_COMMANDS.map(cmd => (
            <Box
              key={cmd}
              onClick={() => onCommand(cmd)}
              sx={{
                px: 1.25, py: 0.45, borderRadius: '5px', cursor: 'pointer',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.03)',
                fontFamily: MONO, fontSize: '0.68rem', color: 'var(--fg-dim)',
                transition: 'all 0.12s',
                '&:hover': { borderColor: 'rgba(249,115,22,0.4)', color: 'var(--accent)', background: 'rgba(249,115,22,0.06)' },
              }}
            >
              {cmd}
            </Box>
          ))}
        </Box>
      </Box>

    </Box>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */

export default function FinancePage() {
  const navigate       = useNavigate();
  const topOffset      = useTopOffset();
  const [dark, setDark] = useDarkMode();
  const cellCountRef   = useRef(0);

  /* Force dark mode only while Finance page is open — restore previous value on leave */
  useEffect(() => {
    const prev = dark;
    setDark(true);
    return () => { setDark(prev); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Watchlist
  const [watchlist,     setWatchlist]     = useState(getSavedWatchlist);
  const [prices,        setPrices]        = useState([]);
  const [pricesLoading, setPricesLoading] = useState(true);

  // Terminal
  const [outputs,    setOutputs]    = useState([]);
  const [cmdInput,   setCmdInput]   = useState('');
  const [cmdHistory, setCmdHistory] = useState([]);
  const [, setHistIdx] = useState(-1);

  // Command palette
  const [paletteOpen,    setPaletteOpen]    = useState(false);
  const [paletteQuery,   setPaletteQuery]   = useState('');
  const [paletteIdx,     setPaletteIdx]     = useState(0);

  const abortRef   = useRef(null);
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);
  const outputsRef = useRef([]);

  useEffect(() => { outputsRef.current = outputs; }, [outputs]);

  /* ── Load sidebar prices ── */
  const loadPrices = useCallback(async () => {
    const symbols = [...INDICES, ...watchlist].join(',');
    try {
      const res  = await fetch(`${API}/explore/stocks?symbols=${encodeURIComponent(symbols)}`);
      const data = res.ok ? await res.json() : { stocks: [] };
      setPrices(data.stocks || []);
    } catch { setPrices([]); }
    finally  { setPricesLoading(false); }
  }, [watchlist]);

  useEffect(() => {
    setPricesLoading(true);
    loadPrices();
    const id = setInterval(loadPrices, 90_000);
    return () => clearInterval(id);
  }, [loadPrices]);

  /* ── Auto-scroll ── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [outputs]);

  /* ── Derived ── */
  const indexRows = prices.filter(s => INDEX_DISPLAY.includes(s.ticker));
  const userRows  = prices.filter(s => !INDEX_DISPLAY.includes(s.ticker));

  /* ── Add/remove watchlist ── */
  const addTicker = useCallback((ticker) => {
    const t = ticker.trim().toUpperCase();
    if (!t) return false;
    if (watchlist.includes(t)) return false;
    if (watchlist.length >= 20) return false;
    const next = [...watchlist, t];
    setWatchlist(next); saveWatchlist(next);
    return true;
  }, [watchlist]);

  const removeTicker = useCallback((ticker) => {
    const next = watchlist.filter(t => t !== ticker);
    setWatchlist(next); saveWatchlist(next);
    setPrices(prev => prev.filter(s => s.rawTicker !== ticker && s.ticker !== ticker));
  }, [watchlist]);

  /* ── Execute a parsed command ── */
  const executeCommand = useCallback(async (cmd) => {
    const id  = Date.now();
    cellCountRef.current += 1;
    const cellNum = cellCountRef.current;

    if (cmd.type === 'SLASH') {
      const { command, args } = cmd;
      const ticker = (args[0] || '').toUpperCase();

      if (command === 'technicals') {
        if (!ticker) {
          setOutputs(prev => [...prev, { id, cellNum, command: cmd.raw, type: 'error', text: 'Usage: /technicals <TICKER>' }]);
          return;
        }
        setOutputs(prev => [...prev, { id, cellNum, command: cmd.raw, type: 'technicals', ticker }]);
        return;
      }

      // All other slash commands route to AI with structured prompts
      const SLASH_PROMPTS = {
        analyze:  ticker ? `Deep investment analysis for ${ticker}: (1) Technical outlook, (2) Fundamental metrics, (3) Recent catalysts, (4) Analyst consensus, (5) Key risks, (6) Verdict with target range. Be concise and structured.` : null,
        earnings: ticker ? `Latest earnings analysis for ${ticker}: actual vs estimates, revenue trend, EPS growth, management guidance, and market reaction.` : null,
        macro:    'Current macro environment analysis: Federal Reserve policy, interest rates, inflation trajectory, employment, sector rotation implications, and near-term market outlook.',
        brief:    'Morning market brief: key index levels and moves, top pre-market movers, major overnight headlines, economic data due today, and one key thing to watch.',
        sector:   args.length > 0 ? `Sector rotation analysis for ${args.join(' ')} sector: relative performance, top picks, headwinds/tailwinds, and whether to overweight or underweight.` : 'Current sector rotation analysis: which sectors are leading/lagging, where institutional money is flowing, and best opportunities now.',
        compare:  args.length >= 2 ? `Compare ${args[0].toUpperCase()} vs ${args[1].toUpperCase()}: business model, growth rates, valuation multiples, competitive positioning, and investment recommendation.` : null,
      };

      const query = SLASH_PROMPTS[command];
      if (!query) {
        setOutputs(prev => [...prev, { id, cellNum, command: cmd.raw, type: 'error', text: `ERR: Unknown command /${command}. Type /help or HELP.` }]);
        return;
      }

      // Execute as AI query
      await executeCommand({ ...cmd, type: 'AI', query });
      return;
    }

    if (cmd.type === 'HELP') {
      setOutputs(prev => [...prev, { id, cellNum, command: cmd.raw, type: 'help' }]);
      return;
    }

    if (cmd.type === 'WATCH_ADD') {
      const added = addTicker(cmd.ticker);
      setOutputs(prev => [...prev, {
        id, cellNum, command: cmd.raw, type: 'system',
        text: added ? `${cmd.ticker} added to watchlist.` : `${cmd.ticker} is already in your watchlist.`,
        variant: added ? 'success' : 'info',
      }]);
      return;
    }

    if (cmd.type === 'WATCH_REMOVE') {
      const t = cmd.ticker.toUpperCase();
      if (watchlist.includes(t)) {
        removeTicker(t);
        setOutputs(prev => [...prev, { id, cellNum, command: cmd.raw, type: 'system', text: `${t} removed from watchlist.`, variant: 'info' }]);
      } else {
        setOutputs(prev => [...prev, { id, cellNum, command: cmd.raw, type: 'system', text: `${t} is not in your watchlist.`, variant: 'error' }]);
      }
      return;
    }

    if (cmd.type === 'QUOTE') {
      setOutputs(prev => [...prev, { id, cellNum, command: cmd.raw, type: 'loading' }]);
      try {
        const sym = cmd.tickers[0];
        const res  = await fetch(`${API}/explore/quote/${encodeURIComponent(sym)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const stock = await res.json();
        // rawTicker is already set by finance_service — ensure it's present for chart
        if (stock && !stock.rawTicker) stock.rawTicker = sym;
        setOutputs(prev => prev.map(o => o.id === id
          ? { ...o, type: 'quote', data: stock }
          : o
        ));
      } catch {
        setOutputs(prev => prev.map(o => o.id === id
          ? { ...o, type: 'error', text: `ERR: No data for ${cmd.tickers[0]}` }
          : o
        ));
      }
      return;
    }

    if (cmd.type === 'COMPARE' || cmd.type === 'INDICES') {
      const syms = cmd.type === 'INDICES' ? INDICES : cmd.tickers;
      setOutputs(prev => [...prev, { id, cellNum, command: cmd.raw, type: 'loading' }]);
      try {
        const res  = await fetch(`${API}/explore/stocks?symbols=${encodeURIComponent(syms.join(','))}`);
        const data = res.ok ? await res.json() : { stocks: [] };
        setOutputs(prev => prev.map(o => o.id === id
          ? { ...o, type: cmd.type === 'INDICES' ? 'indices' : 'compare', data: data.stocks || [] }
          : o
        ));
      } catch {
        setOutputs(prev => prev.map(o => o.id === id
          ? { ...o, type: 'error', text: 'ERR: Network error fetching data.' }
          : o
        ));
      }
      return;
    }

    if (cmd.type === 'AI') {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      setOutputs(prev => [...prev, { id, cellNum, command: cmd.raw, type: 'ai', text: '', streaming: true, sources: [] }]);

      try {
        const res = await fetch(`${API}/explore/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: cmd.query }),
          signal: abortRef.current.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const reader  = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split('\n\n');
          buf = parts.pop();
          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (raw === '[DONE]') {
              setOutputs(prev => prev.map(o => o.id === id ? { ...o, streaming: false } : o));
              continue;
            }
            try {
              const evt = JSON.parse(raw);
              if (evt.type === 'chunk') {
                setOutputs(prev => prev.map(o => o.id === id ? { ...o, text: o.text + evt.text } : o));
              } else if (evt.type === 'sources') {
                setOutputs(prev => prev.map(o => o.id === id ? { ...o, sources: evt.sources || [] } : o));
              }
              // stock/contradictions events are intentionally ignored — the quote card is already shown
            } catch { /* ignore */ }
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          setOutputs(prev => prev.map(o => o.id === id ? { ...o, type: 'error', text: `ERR: ${err.message}`, streaming: false } : o));
        }
      } finally {
        setOutputs(prev => prev.map(o => o.id === id ? { ...o, streaming: false } : o));
      }
    }
  }, [addTicker, removeTicker, watchlist]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Palette helpers ── */
  const paletteFiltered = SLASH_COMMANDS.filter(c =>
    !paletteQuery || c.name.startsWith(paletteQuery.toLowerCase())
  );

  const handleInputChange = useCallback((val) => {
    setCmdInput(val);
    setHistIdx(-1);
    if (val.startsWith('/')) {
      const after = val.slice(1);
      // Only show palette while typing the command name (no space yet)
      if (!after.includes(' ')) {
        setPaletteOpen(true);
        setPaletteQuery(after);
        setPaletteIdx(0);
        return;
      }
    }
    setPaletteOpen(false);
    setPaletteQuery('');
  }, []);

  const selectPaletteItem = useCallback((cmd) => {
    const completion = `/${cmd.name}${cmd.args ? ' ' : ''}`;
    setCmdInput(completion);
    setPaletteOpen(false);
    setPaletteQuery('');
    inputRef.current?.focus();
  }, []);

  /* ── Submit command ── */
  const submitCmd = useCallback((rawInput) => {
    const input = (rawInput || cmdInput).trim();
    if (!input) return;

    setPaletteOpen(false);
    setCmdInput('');
    setCmdHistory(prev => [input, ...prev.slice(0, 49)]);
    setHistIdx(-1);

    const cmd = parseQFL(input);
    executeCommand(cmd);
  }, [cmdInput, executeCommand]);

  /* ── Keyboard navigation ── */
  const handleKeyDown = (e) => {
    // Palette navigation
    if (paletteOpen && paletteFiltered.length > 0) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setPaletteIdx(i => (i - 1 + paletteFiltered.length) % paletteFiltered.length);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setPaletteIdx(i => (i + 1) % paletteFiltered.length);
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && paletteFiltered.length > 0 && paletteIdx >= 0)) {
        e.preventDefault();
        selectPaletteItem(paletteFiltered[paletteIdx]);
        return;
      }
      if (e.key === 'Escape') {
        setPaletteOpen(false);
        return;
      }
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      submitCmd();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHistIdx(prev => {
        const next = Math.min(prev + 1, cmdHistory.length - 1);
        if (cmdHistory[next] !== undefined) setCmdInput(cmdHistory[next]);
        return next;
      });
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHistIdx(prev => {
        const next = prev - 1;
        if (next < 0) { setCmdInput(''); return -1; }
        if (cmdHistory[next] !== undefined) setCmdInput(cmdHistory[next]);
        return next;
      });
    }
  };

  return (
    <Box sx={{ height: '100vh', paddingTop: `${topOffset}px`, display: 'flex', flexDirection: 'column', background: 'transparent' }}>

      {/* ── Top bar ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2.5, py: 1.1, borderBottom: '1px solid var(--border)', background: dark ? 'rgba(10,12,18,0.98)' : 'rgba(237,232,223,0.92)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', flexShrink: 0 }}>
        <Box onClick={() => navigate('/')} sx={{ display: 'flex', alignItems: 'center', gap: 0.6, cursor: 'pointer', opacity: 0.55, '&:hover': { opacity: 1 }, transition: 'opacity 0.14s' }}>
          <ArrowLeft size={13} color="var(--fg-secondary)" />
          <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.70rem', color: 'var(--fg-secondary)' }}>Home</Typography>
        </Box>
        <Box sx={{ width: '1px', height: 14, bgcolor: 'var(--border)' }} />
        <TrendingUp size={14} color="var(--accent)" />
        <Typography sx={{ fontFamily: MONO, fontSize: '0.82rem', fontWeight: 700, color: 'var(--fg-primary)', letterSpacing: '-0.01em' }}>
          Finance Terminal
        </Typography>
        <Box sx={{
          px: 0.75, py: 0.2, borderRadius: '5px', ml: 0.5,
          border: '1px solid rgba(249,115,22,0.25)', bgcolor: 'rgba(249,115,22,0.07)',
          fontFamily: MONO, fontSize: '0.58rem', fontWeight: 700,
          color: 'rgba(249,115,22,0.75)', letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>
          QFL
        </Box>
        <Box sx={{ flex: 1 }} />
        <Box onClick={loadPrices} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', opacity: 0.45, '&:hover': { opacity: 0.9 }, transition: 'opacity 0.14s' }}>
          <RefreshCw size={11} color="var(--fg-dim)" style={{ animation: pricesLoading ? 'finSpin 1s linear infinite' : 'none' }} />
          <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.62rem', color: 'var(--fg-dim)' }}>Refresh</Typography>
        </Box>
        <NavControls />
      </Box>

      {/* ── Stock marquee strip ── */}
      <StockMarquee inline />

      {/* ── Body ── */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Left sidebar ── */}
        <Box sx={{
          width: 232, flexShrink: 0,
          borderRight: dark ? '1px solid rgba(255,255,255,0.07)' : '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', overflowY: 'auto',
          background: dark ? 'rgba(12,14,22,0.99)' : 'rgba(225,218,205,0.55)',
          '&::-webkit-scrollbar': { width: 3 },
          '&::-webkit-scrollbar-thumb': { bgcolor: dark ? 'rgba(255,255,255,0.12)' : 'rgba(175,150,105,0.28)', borderRadius: 2 },
        }}>
          {/* Sidebar sections */}
          {[
            {
              label: 'Market',
              content: pricesLoading
                ? [0, 1, 2].map(i => <RowSkeleton key={i} />)
                : indexRows.map(s => <StockRow key={s.ticker} stock={s} onQuery={c => executeCommand(c)} onRemove={() => {}} removable={false} />),
            },
            {
              label: 'Watchlist',
              content: pricesLoading
                ? [0, 1, 2, 3].map(i => <RowSkeleton key={i} />)
                : userRows.length === 0
                  ? <Typography sx={{ fontFamily: MONO, fontSize: '0.66rem', color: 'var(--fg-dim)', px: 1.25, py: 0.5 }}>
                      WATCH ADD &lt;TICKER&gt;
                    </Typography>
                  : userRows.map(s => <StockRow key={s.rawTicker || s.ticker} stock={s} onQuery={c => executeCommand(c)} onRemove={removeTicker} />),
            },
          ].map(({ label, content }) => (
            <Box key={label} sx={{ pb: 0.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, pt: 1.25, pb: 0.75 }}>
                <Typography sx={{
                  fontFamily: 'var(--font-family)', fontSize: '0.50rem', fontWeight: 600,
                  color: 'var(--fg-dim)', letterSpacing: '0.14em', textTransform: 'uppercase', flexShrink: 0,
                }}>
                  {label}
                </Typography>
                <Box sx={{ flex: 1, height: '1px', bgcolor: dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)' }} />
              </Box>
              {content}
            </Box>
          ))}

          {/* Quick commands */}
          <Box sx={{ mt: 'auto', borderTop: '1px solid var(--border)', p: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
              <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.50rem', fontWeight: 600, color: 'var(--fg-dim)', letterSpacing: '0.14em', textTransform: 'uppercase', flexShrink: 0 }}>
                Commands
              </Typography>
              <Box sx={{ flex: 1, height: '1px', bgcolor: dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)' }} />
            </Box>
            {[['AAPL VS MSFT', 'cmp'], ['INDICES', 'mkt'], ['RATES', 'yld'], ['HELP', 'ref']].map(([cmd, label]) => (
              <Box
                key={cmd}
                onClick={() => submitCmd(cmd)}
                sx={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  px: 1, py: 0.45, borderRadius: '3px', cursor: 'pointer',
                  transition: 'background 0.12s',
                  '&:hover': { background: 'rgba(249,115,22,0.07)' },
                }}
              >
                <Typography sx={{ fontFamily: MONO, fontSize: '0.68rem', color: 'var(--accent)' }}>{cmd}</Typography>
                <Typography sx={{ fontFamily: MONO, fontSize: '0.58rem', color: 'var(--fg-dim)' }}>{label}</Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* ── Terminal panel ── */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* ── Input bar at TOP — like a real terminal ── */}
          <Box sx={{
            px: 3, py: 1.1,
            background: dark ? 'rgba(8,10,16,0.99)' : 'rgba(237,232,223,0.85)',
            borderBottom: dark ? '2px solid rgba(249,115,22,0.30)' : '2px solid rgba(175,150,105,0.30)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1,
            position: 'relative',
          }}>
            {/* Command palette — floats above input bar */}
            {paletteOpen && (
              <CommandPalette
                query={paletteQuery}
                onSelect={selectPaletteItem}
                activeIdx={paletteIdx}
                dark={dark}
              />
            )}
            {/* Prompt glyph */}
            <Typography sx={{ fontFamily: MONO, fontSize: '0.90rem', fontWeight: 700, color: paletteOpen ? '#a78bfa' : 'var(--accent)', flexShrink: 0, lineHeight: 1, userSelect: 'none', transition: 'color 0.15s' }}>
              ›
            </Typography>
            {/* Highlighted input wrapper */}
            <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
              {/* Syntax-highlight overlay — sits behind the transparent input */}
              {cmdInput && (
                <div
                  aria-hidden
                  style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    fontFamily: MONO, fontSize: '0.86rem', fontWeight: 500,
                    letterSpacing: '0.01em', padding: '3px 0',
                    pointerEvents: 'none', userSelect: 'none',
                    whiteSpace: 'pre', overflow: 'hidden',
                    display: 'flex', alignItems: 'center',
                  }}
                  dangerouslySetInnerHTML={{ __html: highlightQFL(cmdInput) }}
                />
              )}
              <input
                ref={inputRef}
                className="qfl-input"
                value={cmdInput}
                onChange={e => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => setTimeout(() => setPaletteOpen(false), 150)}
                placeholder="enter command or /command…"
                autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                autoFocus
                style={{
                  width: '100%', border: 'none', outline: 'none',
                  background: 'transparent',
                  fontFamily: MONO, fontSize: '0.86rem', fontWeight: 500,
                  color: cmdInput ? 'transparent' : undefined,
                  caretColor: paletteOpen ? '#a78bfa' : '#fb923c',
                  padding: '3px 0', letterSpacing: '0.01em',
                  position: 'relative', zIndex: 1,
                }}
              />
            </div>
            {cmdHistory.length > 0 && !paletteOpen && (
              <Typography sx={{ fontFamily: MONO, fontSize: '0.58rem', color: 'var(--fg-dim)', flexShrink: 0, userSelect: 'none' }}>
                ↑↓
              </Typography>
            )}
            {paletteOpen && (
              <Typography sx={{ fontFamily: MONO, fontSize: '0.58rem', color: '#a78bfa', flexShrink: 0, userSelect: 'none' }}>
                ↑↓ tab
              </Typography>
            )}
          </Box>

          {/* Output feed */}
          <Box
            onClick={() => inputRef.current?.focus()}
            sx={{
              flex: 1, overflowY: 'auto', px: 3, py: 2.5, cursor: 'text',
              background: dark ? 'rgba(6,8,14,1)' : 'transparent',
              '&::-webkit-scrollbar': { width: 4 },
              '&::-webkit-scrollbar-thumb': { bgcolor: dark ? 'rgba(255,255,255,0.10)' : 'rgba(175,150,105,0.28)', borderRadius: 2 },
            }}
          >
            <Box sx={{ maxWidth: 820, mx: 'auto' }}>
              {outputs.length === 0 ? (
                <TopMovers prices={prices} onCommand={cmd => submitCmd(cmd)} />
              ) : (
                outputs.map(item => <OutputItem key={item.id} item={item} onAction={cmd => submitCmd(cmd)} />)
              )}
              <div ref={bottomRef} />
            </Box>
          </Box>
        </Box>
      </Box>

      <style>{`
        @keyframes blinkPulse { 50% { opacity: 0; } }
        @keyframes finSpin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
        .qfl-input::placeholder { color: rgba(160,170,180,0.38); }
      `}</style>
    </Box>
  );
}
