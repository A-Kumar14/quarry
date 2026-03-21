import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Typography, Skeleton } from '@mui/material';
import { TrendingUp, ArrowLeft, RefreshCw, Settings, Terminal, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import GlassCard from '../components/GlassCard';
import StockMarquee from '../components/StockMarquee';
import { useTopOffset } from '../SettingsContext';

const API           = process.env.REACT_APP_API_URL || 'http://localhost:8000';
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
          <Typography sx={{ fontFamily: '"Courier New", monospace', fontSize: '0.78rem', fontWeight: 700, color: 'var(--fg-primary)' }}>
            {sym}
          </Typography>
          <Typography sx={{ fontFamily: '"Courier New", monospace', fontSize: '0.78rem', fontWeight: 600, color: 'var(--fg-primary)' }}>
            ${stock.price?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.2 }}>
          <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.61rem', color: 'var(--fg-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 90 }}>
            {stock.name}
          </Typography>
          <Typography sx={{ fontFamily: '"Courier New", monospace', fontSize: '0.63rem', fontWeight: 600, color }}>
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

/* ── Compare table ───────────────────────────────────────────────────────── */

function CompareResult({ stocks }) {
  if (!stocks || stocks.length === 0) {
    return (
      <GlassCard style={{ padding: '14px 18px' }}>
        <Typography sx={{ fontFamily: '"Courier New", monospace', fontSize: '0.78rem', color: 'var(--error)' }}>
          ERROR: Could not fetch comparison data.
        </Typography>
      </GlassCard>
    );
  }
  return (
    <GlassCard style={{ padding: '14px 20px' }}>
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
                          <Typography sx={{ fontFamily: '"Courier New", monospace', fontSize: '0.44rem', fontWeight: 700, color: 'var(--fg-dim)' }}>{sym.slice(0,2)}</Typography>
                        </Box>
                    }
                  </td>
                  <td style={{ padding: '8px 10px', fontFamily: '"Courier New", monospace', fontSize: '0.82rem', fontWeight: 700, color: 'var(--fg-primary)' }}>
                    {sym}
                  </td>
                  <td style={{ padding: '8px 10px', fontFamily: 'var(--font-family)', fontSize: '0.72rem', color: 'var(--fg-secondary)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.name}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: '"Courier New", monospace', fontSize: '0.82rem', fontWeight: 600, color: 'var(--fg-primary)' }}>
                    ${fmtPrice(s.price)}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: '"Courier New", monospace', fontSize: '0.78rem', color }}>
                    {sign}{fmtPrice(s.change)}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: '"Courier New", monospace', fontSize: '0.78rem', fontWeight: 600, color }}>
                    {sign}{s.changePct?.toFixed(2)}%
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: '"Courier New", monospace', fontSize: '0.72rem', color: 'var(--fg-secondary)' }}>
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
    </GlassCard>
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
    <GlassCard style={{ padding: '16px 20px' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
        <Terminal size={13} style={{ color: 'var(--accent)' }} />
        <Typography sx={{ fontFamily: '"Courier New", monospace', fontSize: '0.72rem', fontWeight: 700, color: 'var(--fg-primary)', letterSpacing: '0.04em' }}>
          QUARRY FINANCE LANGUAGE (QFL)
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {HELP_COMMANDS.map(([cmd, desc], i) => (
          <Box key={i} sx={{ display: 'flex', gap: 2, alignItems: 'baseline' }}>
            <Typography sx={{ fontFamily: '"Courier New", monospace', fontSize: '0.76rem', fontWeight: 600, color: 'var(--accent)', minWidth: 220, flexShrink: 0 }}>
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
    </GlassCard>
  );
}

/* ── System message (watch add/remove, errors) ───────────────────────────── */

function SystemMessage({ text, variant = 'info' }) {
  const color = variant === 'error' ? 'var(--error)' : variant === 'success' ? '#16a34a' : 'var(--fg-dim)';
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.5 }}>
      <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
      <Typography sx={{ fontFamily: '"Courier New", monospace', fontSize: '0.76rem', color }}>
        {text}
      </Typography>
    </Box>
  );
}

/* ── AI streaming result ─────────────────────────────────────────────────── */

function AIResult({ text, streaming, sources }) {
  return (
    <GlassCard style={{ padding: '16px 20px' }}>
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
    </GlassCard>
  );
}

/* ── Terminal output item ────────────────────────────────────────────────── */

/* ── Stock chart ─────────────────────────────────────────────────────────── */

const PERIODS = ['1D', '1W', '1M', '3M', '1Y', '5Y'];

function StockChart({ ticker }) {
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

  const up    = (chartData?.pctChange ?? 0) >= 0;
  const color = up ? '#16a34a' : '#dc2626';
  const sign  = up ? '+' : '';

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
              fontFamily: '"Courier New", monospace', fontSize: '0.70rem', fontWeight: 600,
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
          <Typography sx={{ ml: 'auto', fontFamily: '"Courier New", monospace', fontSize: '0.72rem', fontWeight: 600, color, alignSelf: 'center' }}>
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
          <Typography sx={{ fontFamily: '"Courier New", monospace', fontSize: '0.70rem', color: 'var(--fg-dim)' }}>{err}</Typography>
        </Box>
      )}
      {!loading && !err && chartData?.prices?.length > 1 && (
        <Box sx={{ overflowX: 'auto' }}>
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', minWidth: 280 }}>
            <defs>
              <linearGradient id={`cg-${up ? 'u' : 'd'}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={color} stopOpacity={0.18} />
                <stop offset="100%" stopColor={color} stopOpacity={0.01} />
              </linearGradient>
            </defs>

            {/* Y gridlines + labels */}
            {yLabels(chartData.prices).map(({ y, label }, i) => (
              <g key={i}>
                <line x1={PAD.l} y1={y} x2={PAD.l + iW} y2={y}
                  stroke="rgba(193,180,155,0.2)" strokeWidth={0.5} strokeDasharray="3 3" />
                <text x={PAD.l - 5} y={y + 3.5} textAnchor="end"
                  fontFamily="'Courier New', monospace" fontSize={9} fill="rgba(120,105,80,0.7)">
                  {label}
                </text>
              </g>
            ))}

            {/* X date labels */}
            {xLabels(chartData.dates, chartData.prices).map(({ x, label }, i) => (
              <text key={i} x={x} y={H - 6} textAnchor="middle"
                fontFamily="'Courier New', monospace" fontSize={9} fill="rgba(120,105,80,0.6)">
                {label}
              </text>
            ))}

            {/* Fill */}
            <path d={buildFill(chartData.prices)} fill={`url(#cg-${up ? 'u' : 'd'})`} />
            {/* Line */}
            <path d={buildPath(chartData.prices)} fill="none" stroke={color} strokeWidth={1.8}
              strokeLinejoin="round" strokeLinecap="round" />
          </svg>
        </Box>
      )}
    </Box>
  );
}

/* ── Quote detail (chart + header + actions) ─────────────────────────────── */

function QuoteDetail({ data, onAction }) {
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
    <GlassCard style={{ padding: '16px 20px', marginBottom: 12 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
        {logo && (
          <img src={logo} alt="" width={28} height={28}
            style={{ borderRadius: 7, objectFit: 'contain', flexShrink: 0 }}
            onError={e => { e.target.style.display = 'none'; }} />
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
            <Typography sx={{ fontFamily: '"Courier New", monospace', fontSize: '1.05rem', fontWeight: 700, color: 'var(--fg-primary)' }}>
              {sym}
            </Typography>
            <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.68rem', color: 'var(--fg-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {data.name}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
          <Typography sx={{ fontFamily: '"Courier New", monospace', fontSize: '1.35rem', fontWeight: 700, color: 'var(--fg-primary)', lineHeight: 1 }}>
            ${data.price?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Typography>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', mt: 0.4, px: 1, py: '2px', borderRadius: 999, background: pillBg, border: `1px solid ${up ? 'rgba(22,163,74,0.25)' : 'rgba(220,38,38,0.20)'}` }}>
            <Typography sx={{ fontFamily: '"Courier New", monospace', fontSize: '0.70rem', fontWeight: 600, color, whiteSpace: 'nowrap' }}>
              {sign}{fmtPrice(data.change)} ({sign}{data.changePct?.toFixed(2)}%)
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Chart */}
      <StockChart ticker={data.rawTicker || sym} />

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
    </GlassCard>
  );
}

/* ── Terminal output block ───────────────────────────────────────────────── */

function OutputItem({ item, onAction }) {
  return (
    <Box sx={{ mb: 2 }}>
      {/* Command echo */}
      {item.command && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
          <ChevronRight size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <Typography sx={{ fontFamily: '"Courier New", monospace', fontSize: '0.78rem', color: 'var(--fg-secondary)', letterSpacing: '0.01em' }}>
            {item.command}
          </Typography>
        </Box>
      )}

      {/* Result */}
      {item.type === 'loading' && (
        <GlassCard style={{ padding: '16px 20px' }}>
          {[72, 58, 82].map((w, i) => (
            <Skeleton key={i} variant="text" width={`${w}%`} sx={{ bgcolor: 'var(--bg-tertiary)', height: 16, mb: 0.4 }} />
          ))}
        </GlassCard>
      )}
      {item.type === 'quote' && item.data && <QuoteDetail data={item.data} onAction={onAction} />}
      {item.type === 'compare' && <CompareResult stocks={item.data} />}
      {item.type === 'indices' && <CompareResult stocks={item.data} />}
      {item.type === 'ai' && (
        <AIResult text={item.text || ''} streaming={item.streaming} sources={item.sources} />
      )}
      {item.type === 'help' && <HelpResult />}
      {item.type === 'system' && <SystemMessage text={item.text} variant={item.variant} />}
      {item.type === 'error' && <SystemMessage text={item.text} variant="error" />}
    </Box>
  );
}

/* ── Welcome prompt ──────────────────────────────────────────────────────── */

const QUICK_COMMANDS = ['AAPL', 'INDICES', 'NVDA VS MSFT', 'RATES', 'HELP'];

function WelcomePrompt({ onCommand }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 2, py: 6, px: 3, textAlign: 'center' }}>
      <Terminal size={28} color="var(--accent)" style={{ opacity: 0.5 }} />
      <Box>
        <Typography sx={{ fontFamily: '"Courier New", monospace', fontSize: '0.88rem', fontWeight: 700, color: 'var(--fg-primary)', letterSpacing: '-0.01em' }}>
          Quarry Finance Language
        </Typography>
        <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.78rem', fontWeight: 300, color: 'var(--fg-secondary)', mt: 0.5 }}>
          Type a command or ask anything in plain English
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, justifyContent: 'center', maxWidth: 400 }}>
        {QUICK_COMMANDS.map(cmd => (
          <Box
            key={cmd}
            onClick={() => onCommand(cmd)}
            sx={{
              px: 1.25, py: 0.5, borderRadius: '7px', cursor: 'pointer',
              border: '1px solid var(--border)', background: 'var(--gbtn-bg)',
              fontFamily: '"Courier New", monospace', fontSize: '0.72rem', color: 'var(--fg-secondary)',
              transition: 'all 0.12s',
              '&:hover': { borderColor: 'rgba(249,115,22,0.4)', color: 'var(--accent)', background: 'rgba(249,115,22,0.06)' },
            }}
          >
            {cmd}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */

export default function FinancePage() {
  const navigate  = useNavigate();
  const topOffset = useTopOffset();

  // Watchlist
  const [watchlist,     setWatchlist]     = useState(getSavedWatchlist);
  const [prices,        setPrices]        = useState([]);
  const [pricesLoading, setPricesLoading] = useState(true);

  // Terminal
  const [outputs,    setOutputs]    = useState([]);
  const [cmdInput,   setCmdInput]   = useState('');
  const [cmdHistory, setCmdHistory] = useState([]);
  const [, setHistIdx] = useState(-1);

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
    const id = Date.now();

    if (cmd.type === 'HELP') {
      setOutputs(prev => [...prev, { id, command: cmd.raw, type: 'help' }]);
      return;
    }

    if (cmd.type === 'WATCH_ADD') {
      const added = addTicker(cmd.ticker);
      setOutputs(prev => [...prev, {
        id, command: cmd.raw, type: 'system',
        text: added ? `${cmd.ticker} added to watchlist.` : `${cmd.ticker} is already in your watchlist.`,
        variant: added ? 'success' : 'info',
      }]);
      return;
    }

    if (cmd.type === 'WATCH_REMOVE') {
      const t = cmd.ticker.toUpperCase();
      if (watchlist.includes(t)) {
        removeTicker(t);
        setOutputs(prev => [...prev, { id, command: cmd.raw, type: 'system', text: `${t} removed from watchlist.`, variant: 'info' }]);
      } else {
        setOutputs(prev => [...prev, { id, command: cmd.raw, type: 'system', text: `${t} is not in your watchlist.`, variant: 'error' }]);
      }
      return;
    }

    if (cmd.type === 'QUOTE') {
      setOutputs(prev => [...prev, { id, command: cmd.raw, type: 'loading' }]);
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
      setOutputs(prev => [...prev, { id, command: cmd.raw, type: 'loading' }]);
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

      setOutputs(prev => [...prev, { id, command: cmd.raw, type: 'ai', text: '', streaming: true, sources: [] }]);

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

  /* ── Submit command ── */
  const submitCmd = useCallback((rawInput) => {
    const input = (rawInput || cmdInput).trim();
    if (!input) return;

    setCmdInput('');
    setCmdHistory(prev => [input, ...prev.slice(0, 49)]);
    setHistIdx(-1);

    const cmd = parseQFL(input);
    executeCommand(cmd);
  }, [cmdInput, executeCommand]);

  /* ── Keyboard navigation ── */
  const handleKeyDown = (e) => {
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
    <Box sx={{ height: '100vh', paddingTop: `${topOffset}px`, display: 'flex', flexDirection: 'column', background: 'linear-gradient(158deg,#EDE8DF 0%,#E5DDD0 40%,#DDD5C0 75%,#E8E2D5 100%)' }}>

      {/* ── Top bar ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2.5, py: 1.1, borderBottom: '1px solid var(--border)', background: 'rgba(237,232,223,0.92)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', flexShrink: 0 }}>
        <Box onClick={() => navigate('/')} sx={{ display: 'flex', alignItems: 'center', gap: 0.6, cursor: 'pointer', opacity: 0.55, '&:hover': { opacity: 1 }, transition: 'opacity 0.14s' }}>
          <ArrowLeft size={13} color="var(--fg-secondary)" />
          <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.70rem', color: 'var(--fg-secondary)' }}>Home</Typography>
        </Box>
        <Box sx={{ width: '1px', height: 14, bgcolor: 'var(--border)' }} />
        <TrendingUp size={14} color="var(--accent)" />
        <Typography sx={{ fontFamily: '"Courier New", monospace', fontSize: '0.82rem', fontWeight: 700, color: 'var(--fg-primary)', letterSpacing: '-0.01em' }}>
          Finance Terminal
        </Typography>
        <Box sx={{
          px: 0.75, py: 0.2, borderRadius: '5px', ml: 0.5,
          border: '1px solid rgba(249,115,22,0.25)', bgcolor: 'rgba(249,115,22,0.07)',
          fontFamily: '"Courier New", monospace', fontSize: '0.58rem', fontWeight: 700,
          color: 'rgba(249,115,22,0.75)', letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>
          QFL
        </Box>
        <Box sx={{ flex: 1 }} />
        <Box onClick={loadPrices} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', opacity: 0.45, '&:hover': { opacity: 0.9 }, transition: 'opacity 0.14s' }}>
          <RefreshCw size={11} color="var(--fg-dim)" style={{ animation: pricesLoading ? 'finSpin 1s linear infinite' : 'none' }} />
          <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.62rem', color: 'var(--fg-dim)' }}>Refresh</Typography>
        </Box>
        <Box onClick={() => navigate('/settings')} sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', opacity: 0.4, '&:hover': { opacity: 0.85 }, transition: 'opacity 0.14s', ml: 0.5 }}>
          <Settings size={13} color="var(--fg-dim)" />
        </Box>
      </Box>

      {/* ── Stock marquee strip ── */}
      <StockMarquee inline />

      {/* ── Body ── */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Left sidebar ── */}
        <Box sx={{ width: 248, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflowY: 'auto', background: 'rgba(229,221,208,0.45)', '&::-webkit-scrollbar': { width: 3 }, '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(175,150,105,0.28)', borderRadius: 2 } }}>

          {/* Market overview */}
          <Box sx={{ p: 1.5, pb: 0.5 }}>
            <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.54rem', fontWeight: 500, color: 'var(--fg-dim)', letterSpacing: '0.10em', textTransform: 'uppercase', mb: 0.5 }}>
              Market Overview
            </Typography>
            {pricesLoading
              ? [0, 1, 2].map(i => <RowSkeleton key={i} />)
              : indexRows.map(s => <StockRow key={s.ticker} stock={s} onQuery={c => executeCommand(c)} onRemove={() => {}} removable={false} />)
            }
          </Box>

          <Box sx={{ height: '1px', bgcolor: 'var(--border)', mx: 1.5, my: 0.75 }} />

          {/* Watchlist */}
          <Box sx={{ px: 1.5, pt: 0, flex: 1 }}>
            <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.54rem', fontWeight: 500, color: 'var(--fg-dim)', letterSpacing: '0.10em', textTransform: 'uppercase', mb: 0.5 }}>
              Watchlist
            </Typography>
            {pricesLoading
              ? [0, 1, 2, 3].map(i => <RowSkeleton key={i} />)
              : userRows.length === 0
                ? <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.70rem', color: 'var(--fg-dim)', fontStyle: 'italic', px: 1.25, py: 0.5 }}>
                    Type WATCH ADD AAPL to add tickers
                  </Typography>
                : userRows.map(s => <StockRow key={s.rawTicker || s.ticker} stock={s} onQuery={c => executeCommand(c)} onRemove={removeTicker} />)
            }
          </Box>

          {/* Quick command reference */}
          <Box sx={{ p: 1.5, borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.54rem', fontWeight: 500, color: 'var(--fg-dim)', letterSpacing: '0.10em', textTransform: 'uppercase', mb: 0.75 }}>
              Quick Commands
            </Typography>
            {[['AAPL VS MSFT', 'compare'], ['INDICES', 'market'], ['RATES', 'rates'], ['HELP', 'reference']].map(([cmd, label]) => (
              <Box
                key={cmd}
                onClick={() => submitCmd(cmd)}
                sx={{ px: 1, py: 0.5, borderRadius: '6px', cursor: 'pointer', transition: 'background 0.12s', '&:hover': { background: 'rgba(249,115,22,0.06)' }, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <Typography sx={{ fontFamily: '"Courier New", monospace', fontSize: '0.70rem', color: 'var(--accent)' }}>{cmd}</Typography>
                <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.60rem', color: 'var(--fg-dim)' }}>{label}</Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* ── Terminal panel ── */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Output feed */}
          <Box
            onClick={() => inputRef.current?.focus()}
            sx={{ flex: 1, overflowY: 'auto', px: 3, py: 2.5, cursor: 'text', '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(175,150,105,0.28)', borderRadius: 2 } }}
          >
            <Box sx={{ maxWidth: 820, mx: 'auto' }}>
              {outputs.length === 0 ? (
                <WelcomePrompt onCommand={cmd => submitCmd(cmd)} />
              ) : (
                outputs.map(item => <OutputItem key={item.id} item={item} onAction={cmd => submitCmd(cmd)} />)
              )}
              <div ref={bottomRef} />
            </Box>
          </Box>

          {/* Terminal input */}
          <Box sx={{
            px: 3, py: 1.25, borderTop: '1px solid var(--border)',
            background: 'rgba(229,221,208,0.70)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 0.75,
          }}>
            <ChevronRight size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <input
              ref={inputRef}
              value={cmdInput}
              onChange={e => { setCmdInput(e.target.value); setHistIdx(-1); }}
              onKeyDown={handleKeyDown}
              placeholder="Enter command or ask anything — type HELP to see commands"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              style={{
                flex: 1, border: 'none', outline: 'none',
                background: 'transparent',
                fontFamily: '"Courier New", monospace',
                fontSize: '0.84rem',
                color: 'var(--fg-primary)',
                padding: '4px 0',
                letterSpacing: '0.01em',
              }}
            />
            {cmdHistory.length > 0 && (
              <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.58rem', color: 'var(--fg-dim)', flexShrink: 0, userSelect: 'none' }}>
                ↑↓ history
              </Typography>
            )}
          </Box>
        </Box>
      </Box>

      <style>{`
        @keyframes blinkPulse { 50% { opacity: 0; } }
        @keyframes finSpin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
      `}</style>
    </Box>
  );
}
