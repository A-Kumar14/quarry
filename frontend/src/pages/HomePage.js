import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, BookOpen, FlaskConical, TrendingUp, ChevronRight, Zap, Clock, FileText, RefreshCw, PenLine } from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';

/* ── Design tokens (mirrors index.css vars) ─────────────────────────────── */
const T = {
  bg:          'linear-gradient(158deg,#EDE8DF 0%,#E5DDD0 40%,#DDD5C0 75%,#E8E2D5 100%)',
  glass:       'rgba(255,250,235,0.55)',
  glassBorder: '1px solid rgba(255,255,245,0.85)',
  glassShadow: '0 8px 32px rgba(140,110,60,0.09),0 2px 0 rgba(255,254,225,0.65) inset',
  accent:      '#F97316',
  accentDim:   'rgba(249,115,22,0.10)',
  fg:          '#26180a',
  fgSec:       '#5a4222',
  fgDim:       'rgba(80,58,22,0.42)',
  border:      'rgba(175,150,105,0.18)',
  serif:       "'Playfair Display',Georgia,serif",
  sans:        "'DM Sans',system-ui,sans-serif",
  mono:        "'IBM Plex Mono',monospace",
};

/* ── Static fallback content ─────────────────────────────────────────────── */
const FALLBACK_SUGGESTIONS = [
  'Sudan humanitarian crisis 2025',
  'Gaza reconstruction funding',
  'Haiti gang violence displacement',
  'Myanmar junta airstrikes',
  'Sahel drought food insecurity',
];

const FALLBACK_FEATURED = {
  kicker:  'CRISIS INTELLIGENCE',
  headline:'Sudan: 18 months of conflict, 10 million displaced — where are international donors?',
  summary: 'A Quarry deep-dive across 34 sources surfaced significant contradictions between UN funding pledges and actual disbursements. Three competing narratives identified.',
  tags:    ['Sudan', 'Humanitarian', '34 sources', '6 contradictions'],
  meta:    'Updated 2 h ago',
};

const FALLBACK_SMALLER = [
  { kicker: 'ACCOUNTABILITY', headline: 'Gaza reconstruction: who controls the $50 bn pledge?',             meta: '12 sources · 4 h ago' },
  { kicker: 'DISPLACEMENT',   headline: 'Haiti displacement rises 28% as gang violence expands north',       meta: '9 sources · 7 h ago'  },
  { kicker: 'CLIMATE',        headline: 'Sahel drought: conflicting data on crop-failure projections',        meta: '15 sources · 1 d ago' },
];

const FALLBACK_ENTRY = [
  'Myanmar junta air campaign: verified strike locations vs. claimed civilian deaths',
  'DRC: eastern province mineral revenue flows — three contradictory assessments',
  'Yemen: Red Sea shipping disruption — economic modelling divergence',
  'Bangladesh floods 2025: early-warning system failure timeline',
];

const FALLBACK_TRENDING = [
  { label: 'Sudan ceasefire', count: 42 },
  { label: 'Gaza aid corridor', count: 37 },
  { label: 'Haiti kidnappings', count: 29 },
  { label: 'Myanmar airstrike', count: 24 },
  { label: 'Sahel food crisis', count: 19 },
];

const MARKETS = [
  { ticker: 'WTI',  name: 'Crude Oil',    price: '78.42', change: '+0.8%', up: true  },
  { ticker: 'GOLD', name: 'Gold',         price: '2 341', change: '-0.3%', up: false },
  { ticker: 'USD',  name: 'Dollar Index', price: '104.1', change: '+0.1%', up: true  },
  { ticker: 'WEAT', name: 'Wheat',        price: '534',   change: '-1.2%', up: false },
];

const MODES = [
  { id: 'search',   label: 'Search',   icon: Search,      desc: 'Find sources & contradictions' },
  { id: 'write',    label: 'Write',    icon: BookOpen,     desc: 'Draft with citations' },
  { id: 'research', label: 'Research', icon: FlaskConical, desc: 'Deep multi-step analysis' },
  { id: 'finance',  label: 'Markets',  icon: TrendingUp,   desc: 'Stocks & commodities' },
];

/* ── Live trending hook ──────────────────────────────────────────────────── */
function useTrendingNews() {
  const [articles, setArticles] = useState([]);
  const [isLive,   setIsLive]   = useState(false);
  const [spinning, setSpinning] = useState(false);

  const fetch_ = useCallback(async (force = false) => {
    setSpinning(true);
    try {
      const url = `${API}/explore/trending-news?max=6${force ? '&force=true' : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('trending error');
      const data = await res.json();
      const arts = (data.articles || []).filter(a => a.title).slice(0, 6);
      if (arts.length >= 3) { setArticles(arts); setIsLive(true); }
    } catch { /* silent — caller uses fallbacks */ }
    finally { setSpinning(false); }
  }, []);

  useEffect(() => { fetch_(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { articles, isLive, spinning, refetch: () => fetch_(true) };
}

/* ── localStorage helpers ────────────────────────────────────────────────── */

function loadArtifacts() {
  try { return JSON.parse(localStorage.getItem('quarry_documents') || '[]'); } catch (_) { return []; }
}

function loadSearchHistory() {
  try { return JSON.parse(localStorage.getItem('quarry_search_history') || '[]'); } catch (_) { return []; }
}

function ago(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)    return 'just now';
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function stripMd(text) {
  return (text || '').replace(/#{1,6}\s+/g, '').replace(/\*+/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/`[^`]+`/g, '').trim();
}

function wordCount(text) {
  return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

function Topbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const NAV = [
    { label: 'Write',     path: '/write'     },
    { label: 'Artifacts', path: '/artifacts' },
    { label: 'Research',  path: '/research'  },
    { label: 'Sources',   path: '/sources'   },
    { label: 'Settings',  path: '/settings'  },
  ];

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 100,
      height: 44,
      background: 'rgba(237,232,223,0.88)',
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      borderBottom: `1px solid ${T.border}`,
      display: 'flex', alignItems: 'center',
      padding: '0 24px',
      gap: 24,
    }}>
      {/* Wordmark */}
      <span style={{
        fontFamily: T.serif,
        fontSize: '1rem',
        fontWeight: 400,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: T.accent,
        flex: '0 0 auto',
      }}>Quarry</span>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Nav buttons */}
      {NAV.map(({ label, path }) => {
        const isActive = location.pathname === path;
        return (
          <button
            key={path}
            onClick={() => navigate(path)}
            style={{
              background: isActive ? T.accentDim : 'none',
              border: isActive ? `1px solid rgba(249,115,22,0.22)` : 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: T.sans, fontSize: '0.78rem', fontWeight: isActive ? 600 : 500,
              color: isActive ? T.accent : T.fgSec,
              letterSpacing: '0.01em',
              padding: '4px 8px',
              transition: 'color 0.15s, background 0.15s',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = T.fg; }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = T.fgSec; }}
          >
            {label === 'Write' && <PenLine size={11} />}
            {label}
          </button>
        );
      })}
    </header>
  );
}



function SearchSurface({ query, setQuery, mode, setMode, onSubmit }) {
  const handleKey = useCallback((e) => {
    if (e.key === 'Enter' && query.trim()) onSubmit();
  }, [query, onSubmit]);

  return (
    <div style={{
      background: T.glass,
      border: T.glassBorder,
      boxShadow: T.glassShadow,
      backdropFilter: 'blur(18px)',
      WebkitBackdropFilter: 'blur(18px)',
      borderRadius: 16,
      padding: '24px 28px',
      width: '100%',
      maxWidth: 720,
      margin: '0 auto',
    }}>
      {/* Input row */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center',
          background: 'rgba(255,252,240,0.70)',
          border: `1px solid ${T.border}`,
          borderRadius: 10, padding: '0 14px', gap: 10,
        }}>
          <Search size={15} color={T.fgDim} />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder={mode === 'finance' ? 'Enter ticker or company…' : 'Investigate a crisis, claim, or source…'}
            style={{
              flex: 1, border: 'none', background: 'transparent', outline: 'none',
              fontFamily: T.sans, fontSize: '0.92rem', fontWeight: 400,
              color: T.fg, padding: '11px 0',
            }}
          />
        </div>
        <button
          onClick={() => query.trim() && onSubmit()}
          disabled={!query.trim()}
          style={{
            background: query.trim() ? T.accent : 'rgba(249,115,22,0.30)',
            color: '#fff',
            border: 'none', borderRadius: 10, cursor: query.trim() ? 'pointer' : 'not-allowed',
            padding: '11px 22px',
            fontFamily: T.sans, fontSize: '0.88rem', fontWeight: 500,
            boxShadow: query.trim() ? '0 2px 12px rgba(249,115,22,0.28)' : 'none',
            transition: 'background 0.15s, transform 0.15s',
            display: 'flex', alignItems: 'center', gap: 7,
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => { if (query.trim()) e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          <Zap size={14} />
          {mode === 'write' ? 'Draft' : mode === 'research' ? 'Analyse' : mode === 'finance' ? 'Quote' : 'Investigate'}
        </button>
      </div>

      {/* Mode pills */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {MODES.map(m => {
          const Icon = m.icon;
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              title={m.desc}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '5px 13px', borderRadius: 20,
                border: active ? `1px solid ${T.accent}` : `1px solid ${T.border}`,
                background: active ? T.accentDim : 'rgba(255,250,232,0.45)',
                color: active ? T.accent : T.fgSec,
                fontFamily: T.sans, fontSize: '0.78rem', fontWeight: 500,
                cursor: 'pointer', letterSpacing: '0.01em',
                transition: 'all 0.15s',
              }}
            >
              <Icon size={12} />
              {m.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SuggestionChips({ onChip, suggestions }) {
  const items = suggestions && suggestions.length >= 3 ? suggestions : FALLBACK_SUGGESTIONS;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 720, margin: '0 auto' }}>
      {items.map((s, i) => (
        <button
          key={i}
          onClick={() => onChip(typeof s === 'string' ? s : s.title)}
          style={{
            background: 'rgba(255,250,232,0.50)',
            border: `1px solid ${T.border}`,
            borderRadius: 20, padding: '4px 13px',
            fontFamily: T.sans, fontSize: '0.74rem', fontWeight: 400,
            color: T.fgSec, cursor: 'pointer',
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = T.accentDim;
            e.currentTarget.style.color = T.accent;
            e.currentTarget.style.borderColor = 'rgba(249,115,22,0.25)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255,250,232,0.50)';
            e.currentTarget.style.color = T.fgSec;
            e.currentTarget.style.borderColor = T.border;
          }}
        >
          {typeof s === 'string' ? s : s.title}
        </button>
      ))}
    </div>
  );
}

function FeaturedCard({ story, onSearch }) {
  return (
    <div
      onClick={() => onSearch(story.headline, 'search')}
      style={{
        background: T.glass,
        border: T.glassBorder,
        boxShadow: T.glassShadow,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRadius: 14, padding: '28px 32px',
        cursor: 'pointer', marginBottom: 12,
        transition: 'transform 0.16s, box-shadow 0.16s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 16px 48px rgba(140,110,60,0.13),0 2px 0 rgba(255,254,225,0.65) inset';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = T.glassShadow;
      }}
    >
      <div style={{ fontFamily: T.mono, fontSize: '0.68rem', fontWeight: 600, color: T.accent, letterSpacing: '0.12em', marginBottom: 10 }}>
        {story.kicker}
      </div>
      <h2 style={{ fontFamily: T.serif, fontSize: '1.45rem', fontWeight: 400, color: T.fg, lineHeight: 1.3, marginBottom: 12, letterSpacing: '-0.01em' }}>
        {story.headline}
      </h2>
      <p style={{ fontFamily: T.sans, fontSize: '0.84rem', fontWeight: 300, color: T.fgSec, lineHeight: 1.6, marginBottom: 16 }}>
        {story.summary}
      </p>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 14 }}>
        {story.tags.map(tag => (
          <span key={tag} style={{
            padding: '3px 10px', borderRadius: 12,
            background: T.accentDim, border: `1px solid rgba(249,115,22,0.20)`,
            fontFamily: T.sans, fontSize: '0.72rem', fontWeight: 500, color: '#c2540a',
          }}>{tag}</span>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontFamily: T.mono, fontSize: '0.7rem', color: T.fgDim }}>{story.meta}</span>
        <ChevronRight size={13} color={T.accent} />
      </div>
    </div>
  );
}

function SmallStoryCard({ story, onSearch }) {
  return (
    <div
      onClick={() => onSearch(story.headline, 'search')}
      style={{
        background: 'rgba(255,250,232,0.38)',
        border: `1px solid ${T.border}`,
        borderRadius: 12, padding: '14px 18px',
        cursor: 'pointer',
        transition: 'transform 0.15s, background 0.15s',
        display: 'flex', flexDirection: 'column', gap: 6,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.background = 'rgba(255,250,232,0.60)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.background = 'rgba(255,250,232,0.38)';
      }}
    >
      <div style={{ fontFamily: T.mono, fontSize: '0.63rem', fontWeight: 600, color: T.accent, letterSpacing: '0.10em' }}>
        {story.kicker}
      </div>
      <div style={{ fontFamily: T.serif, fontSize: '0.95rem', fontWeight: 400, color: T.fg, lineHeight: 1.35 }}>
        {story.headline}
      </div>
      <div style={{ fontFamily: T.mono, fontSize: '0.67rem', color: T.fgDim }}>{story.meta}</div>
    </div>
  );
}

function EntryList({ stories, onSearch }) {
  return (
    <div style={{
      background: 'rgba(255,250,232,0.38)',
      border: `1px solid ${T.border}`,
      borderRadius: 12, overflow: 'hidden',
    }}>
      {stories.map((s, i) => (
        <div
          key={i}
          onClick={() => onSearch(s, 'search')}
          style={{
            padding: '11px 18px',
            borderBottom: i < stories.length - 1 ? `1px solid ${T.border}` : 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
            transition: 'background 0.13s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,250,232,0.60)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ fontFamily: T.mono, fontSize: '0.7rem', color: T.fgDim, flex: '0 0 auto' }}>
            {String(i + 1).padStart(2, '0')}
          </span>
          <span style={{ fontFamily: T.sans, fontSize: '0.82rem', fontWeight: 400, color: T.fg, lineHeight: 1.4 }}>
            {s}
          </span>
          <ChevronRight size={12} color={T.fgDim} style={{ marginLeft: 'auto', flex: '0 0 auto' }} />
        </div>
      ))}
    </div>
  );
}

function TrendingPanel({ articles, isLive, spinning, onRefresh }) {
  // Build display items from live articles or static fallback
  const items = isLive && articles.length >= 3
    ? articles.slice(0, 5).map((a, i) => ({ label: a.title, source: a.source?.name, count: null, href: a.url }))
    : FALLBACK_TRENDING;

  return (
    <div style={{
      background: T.glass,
      border: T.glassBorder,
      boxShadow: T.glassShadow,
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      borderRadius: 14, padding: '20px 22px',
      marginBottom: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 16 }}>
        {/* Live pulse dot */}
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: isLive ? T.accent : T.fgDim,
          animation: isLive ? 'trendPulse 1.6s ease-in-out infinite' : 'none',
          flexShrink: 0,
        }} />
        <span style={{ fontFamily: T.mono, fontSize: '0.70rem', fontWeight: 600, color: isLive ? T.accent : T.fgSec, letterSpacing: '0.10em' }}>
          {isLive ? 'LIVE TRENDING' : 'TRENDING'}
        </span>
        {/* Refresh */}
        <div
          onClick={onRefresh}
          style={{ marginLeft: 'auto', cursor: 'pointer', opacity: 0.5, transition: 'opacity 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
          onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}
        >
          <RefreshCw size={10} color={T.fgDim} style={{ animation: spinning ? 'spin 1s linear infinite' : 'none' }} />
        </div>
      </div>
      {items.map((item, i) => (
        <div
          key={i}
          onClick={() => item.href && window.open(item.href, '_blank', 'noopener,noreferrer')}
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '8px 0',
            borderBottom: i < items.length - 1 ? `1px solid ${T.border}` : 'none',
            cursor: item.href ? 'pointer' : 'default',
          }}
          onMouseEnter={e => { if (item.href) e.currentTarget.style.opacity = '0.75'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
        >
          <span style={{ fontFamily: T.mono, fontSize: '0.68rem', color: T.fgDim, flex: '0 0 18px', mt: '2px' }}>
            {String(i + 1).padStart(2, '0')}
          </span>
          <span style={{ fontFamily: T.sans, fontSize: '0.80rem', fontWeight: 400, color: T.fg, flex: 1, lineHeight: 1.4,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {item.source && <span style={{ color: T.accent, fontSize: '0.62rem', fontFamily: T.mono, letterSpacing: '0.08em', display: 'block', marginBottom: 1 }}>{item.source}</span>}
            {item.label}
          </span>
          {item.count !== null && (
            <span style={{
              fontFamily: T.mono, fontSize: '0.68rem', fontWeight: 500,
              color: T.accent, background: T.accentDim,
              padding: '2px 7px', borderRadius: 8, flexShrink: 0,
            }}>
              {item.count}
            </span>
          )}
        </div>
      ))}
      <style>{`@keyframes trendPulse { 0%,100%{opacity:1} 50%{opacity:0.3} } @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}

function MarketsPanel() {
  return (
    <div style={{
      background: T.glass,
      border: T.glassBorder,
      boxShadow: T.glassShadow,
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      borderRadius: 14, padding: '20px 22px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 16 }}>
        <TrendingUp size={14} color={T.fgSec} />
        <span style={{ fontFamily: T.mono, fontSize: '0.70rem', fontWeight: 600, color: T.fgSec, letterSpacing: '0.10em' }}>
          MARKETS
        </span>
      </div>
      {MARKETS.map(m => (
        <div key={m.ticker} style={{
          display: 'flex', alignItems: 'center',
          padding: '8px 0',
          borderBottom: `1px solid ${T.border}`,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: T.mono, fontSize: '0.73rem', fontWeight: 600, color: T.fg }}>{m.ticker}</div>
            <div style={{ fontFamily: T.sans, fontSize: '0.70rem', fontWeight: 300, color: T.fgDim }}>{m.name}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: T.mono, fontSize: '0.82rem', fontWeight: 500, color: T.fg }}>{m.price}</div>
            <div style={{ fontFamily: T.mono, fontSize: '0.70rem', fontWeight: 500, color: m.up ? '#22c55e' : '#ef4444' }}>
              {m.change}
            </div>
          </div>
        </div>
      ))}
      <div style={{ fontFamily: T.mono, fontSize: '0.63rem', color: T.fgDim, marginTop: 10 }}>
        Indicative only · delayed
      </div>
    </div>
  );
}

/* ── Main export ─────────────────────────────────────────────────────────── */

export default function HomePage({ onSearch }) {
  const navigate   = useNavigate();
  const [query, setQuery] = useState('');
  const [mode,  setMode]  = useState('search');
  const [artifacts,     setArtifacts]     = useState([]);
  const [searchHistory, setSearchHistory] = useState([]);
  const { articles: trendingArticles, isLive, spinning, refetch } = useTrendingNews();

  useEffect(() => {
    setArtifacts(loadArtifacts());
    setSearchHistory(loadSearchHistory());
  }, []);

  const handleSubmit = useCallback(() => {
    if (!query.trim()) return;
    if (onSearch) onSearch(query.trim(), mode);
  }, [query, mode, onSearch]);

  const handleChip = useCallback((text) => {
    setQuery(text);
    if (onSearch) onSearch(text, mode);
  }, [mode, onSearch]);

  const handleStorySearch = useCallback((text, m) => {
    setQuery(text);
    if (onSearch) onSearch(text, m || mode);
  }, [mode, onSearch]);

  // Open a saved artifact in WritePage (same bridge as ArtifactsPage)
  const handleOpenArtifact = useCallback((doc) => {
    sessionStorage.setItem('quarry_write_session', JSON.stringify({
      query:   doc.query || doc.title || '',
      content: doc.content || '',
      docId:   doc.id,
    }));
    navigate('/write');
  }, [navigate]);

  // Derive live story cards from trending articles
  const liveHasStories = isLive && trendingArticles.length >= 3;
  const featuredStory = liveHasStories
    ? {
        kicker:   (trendingArticles[0].source?.name || 'BREAKING').toUpperCase(),
        headline:  trendingArticles[0].title,
        summary:   trendingArticles[0].description || '',
        tags:      [trendingArticles[0].source?.name].filter(Boolean),
        meta:      trendingArticles[0].publishedAt ? new Date(trendingArticles[0].publishedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Today',
        url:       trendingArticles[0].url,
      }
    : FALLBACK_FEATURED;
  const smallerStories = liveHasStories
    ? trendingArticles.slice(1, 4).map(a => ({
        kicker:   (a.source?.name || 'NEWS').toUpperCase(),
        headline:  a.title,
        meta:      a.publishedAt ? new Date(a.publishedAt).toLocaleString('en-US', { month: 'short', day: 'numeric' }) : '',
        url:       a.url,
      }))
    : FALLBACK_SMALLER;
  const entryStories = liveHasStories
    ? trendingArticles.slice(4).map(a => a.title)
    : FALLBACK_ENTRY;

  return (
    <div style={{ minHeight: '100vh', fontFamily: T.sans }}>
      <Topbar />

      {/* Hero + search */}
      <section style={{ padding: '56px 24px 40px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            fontFamily: T.mono, fontSize: '0.70rem', fontWeight: 600,
            letterSpacing: '0.14em', color: T.accent,
            textTransform: 'uppercase', marginBottom: 14,
          }}>
            AI Research Engine
          </div>
          <h1 style={{
            fontFamily: T.serif, fontSize: 'clamp(2rem, 5vw, 2.8rem)',
            fontWeight: 400, color: T.fg, lineHeight: 1.15,
            letterSpacing: '-0.02em', marginBottom: 16,
          }}>
            Research. Verify.<br/>Write with confidence.
          </h1>
          <p style={{
            fontFamily: T.sans, fontSize: '1rem', fontWeight: 300,
            color: T.fgSec, lineHeight: 1.65, maxWidth: 480, margin: '0 auto 36px',
          }}>
            Search the web, see where sources contradict
            each other, and write your story — all in one place.
          </p>
        </div>

        <SearchSurface
          query={query}
          setQuery={setQuery}
          mode={mode}
          setMode={setMode}
          onSubmit={handleSubmit}
        />

        <div style={{ marginTop: 16 }}>
          <SuggestionChips onChip={handleChip} suggestions={trendingArticles} />
        </div>
      </section>

      {/* Two-column grid */}
      <section style={{
        maxWidth: 1100, margin: '0 auto',
        padding: '0 24px 64px',
        display: 'grid',
        gridTemplateColumns: '1fr 300px',
        gap: 20,
      }}>
        {/* Left: stories feed */}
        <div>
          {artifacts.length > 0 ? (
            <>
              <div style={{
                fontFamily: T.mono, fontSize: '0.68rem', fontWeight: 600,
                color: T.fgDim, letterSpacing: '0.12em', textTransform: 'uppercase',
                marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <FileText size={11} color={T.fgDim} />
                Your research
                <span style={{ fontWeight: 400, opacity: 0.7 }}>· {artifacts.length} {artifacts.length === 1 ? 'story' : 'stories'}</span>
              </div>

              {/* Most recent as featured */}
              {(() => {
                const doc = artifacts[0];
                const plain = stripMd(doc.content);
                const wc    = wordCount(doc.content);
                const sc    = (doc.sources || []).length;
                return (
                  <div
                    onClick={() => handleOpenArtifact(doc)}
                    style={{
                      background: T.glass, border: T.glassBorder, boxShadow: T.glassShadow,
                      backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                      borderRadius: 14, padding: '24px 28px',
                      cursor: 'pointer', marginBottom: 12,
                      transition: 'transform 0.16s, box-shadow 0.16s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 16px 48px rgba(140,110,60,0.13),0 2px 0 rgba(255,254,225,0.65) inset';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = T.glassShadow;
                    }}
                  >
                    <div style={{ fontFamily: T.mono, fontSize: '0.68rem', fontWeight: 600, color: T.accent, letterSpacing: '0.12em', marginBottom: 10 }}>
                      DRAFTED · {ago(doc.savedAt || doc.updatedAt || Date.now())}
                    </div>
                    <h2 style={{ fontFamily: T.serif, fontSize: '1.35rem', fontWeight: 400, color: T.fg, lineHeight: 1.3, marginBottom: 10, letterSpacing: '-0.01em' }}>
                      {doc.title || '(Untitled)'}
                    </h2>
                    {plain.length > 0 && (
                      <p style={{ fontFamily: T.sans, fontSize: '0.84rem', fontWeight: 300, color: T.fgSec, lineHeight: 1.6, marginBottom: 14 }}>
                        {plain.slice(0, 180)}{plain.length > 180 ? '…' : ''}
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                      {wc > 0 && <span style={{ padding: '3px 10px', borderRadius: 12, background: T.accentDim, border: '1px solid rgba(249,115,22,0.20)', fontFamily: T.sans, fontSize: '0.72rem', fontWeight: 500, color: '#c2540a' }}>{wc} words</span>}
                      {sc > 0  && <span style={{ padding: '3px 10px', borderRadius: 12, background: T.accentDim, border: '1px solid rgba(249,115,22,0.20)', fontFamily: T.sans, fontSize: '0.72rem', fontWeight: 500, color: '#c2540a' }}>{sc} sources</span>}
                    </div>
                  </div>
                );
              })()}

              {/* Next 2 as small cards */}
              {artifacts.length > 1 && (
                <div style={{ display: 'grid', gridTemplateColumns: artifacts.length >= 3 ? '1fr 1fr' : '1fr', gap: 10, marginBottom: 12 }}>
                  {artifacts.slice(1, 3).map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => handleOpenArtifact(doc)}
                      style={{
                        background: 'rgba(255,250,232,0.38)', border: `1px solid ${T.border}`,
                        borderRadius: 12, padding: '14px 18px', cursor: 'pointer',
                        transition: 'transform 0.15s, background 0.15s',
                        display: 'flex', flexDirection: 'column', gap: 6,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.background = 'rgba(255,250,232,0.60)'; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = 'rgba(255,250,232,0.38)'; }}
                    >
                      <div style={{ fontFamily: T.mono, fontSize: '0.63rem', fontWeight: 600, color: T.accent, letterSpacing: '0.10em' }}>
                        DRAFTED
                      </div>
                      <div style={{ fontFamily: T.serif, fontSize: '0.92rem', fontWeight: 400, color: T.fg, lineHeight: 1.35,
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {doc.title || '(Untitled)'}
                      </div>
                      <div style={{ fontFamily: T.mono, fontSize: '0.67rem', color: T.fgDim }}>
                        {wordCount(doc.content)} words · {ago(doc.savedAt || doc.updatedAt || Date.now())}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Remaining as entry list */}
              {artifacts.length > 3 && (
                <div style={{ background: 'rgba(255,250,232,0.38)', border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
                  {artifacts.slice(3, 8).map((doc, i, arr) => (
                    <div
                      key={doc.id}
                      onClick={() => handleOpenArtifact(doc)}
                      style={{
                        padding: '11px 18px',
                        borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : 'none',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                        transition: 'background 0.13s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,250,232,0.60)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ fontFamily: T.mono, fontSize: '0.7rem', color: T.fgDim, flex: '0 0 auto' }}>
                        {String(i + 4).padStart(2, '0')}
                      </span>
                      <span style={{ fontFamily: T.sans, fontSize: '0.82rem', fontWeight: 400, color: T.fg, lineHeight: 1.4, flex: 1,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {doc.title || '(Untitled)'}
                      </span>
                      <span style={{ fontFamily: T.mono, fontSize: '0.67rem', color: T.fgDim, flex: '0 0 auto' }}>
                        {ago(doc.savedAt || doc.updatedAt || Date.now())}
                      </span>
                      <ChevronRight size={12} color={T.fgDim} style={{ flex: '0 0 auto' }} />
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{
                fontFamily: T.mono, fontSize: '0.68rem', fontWeight: 600,
                color: T.fgDim, letterSpacing: '0.12em', textTransform: 'uppercase',
                marginBottom: 14,
              }}>
                Suggested investigations
              </div>

              {/* story thumbnail cards driven by live or fallback */}
              <FeaturedCard
                story={featuredStory}
                onSearch={(text, m) => { if (featuredStory.url) window.open(featuredStory.url, '_blank', 'noopener,noreferrer'); else handleStorySearch(text, m); }}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                {smallerStories.map((s, i) => (
                  <SmallStoryCard
                    key={i}
                    story={s}
                    onSearch={(text, m) => { if (s.url) window.open(s.url, '_blank', 'noopener,noreferrer'); else handleStorySearch(text, m); }}
                  />
                ))}
              </div>

              <EntryList stories={entryStories} onSearch={handleStorySearch} />
            </>
          )}
        </div>

        {/* Right: trending + markets */}
        <div>
          <div style={{
            fontFamily: T.mono, fontSize: '0.68rem', fontWeight: 600,
            color: T.fgDim, letterSpacing: '0.12em', textTransform: 'uppercase',
            marginBottom: 14,
          }}>
            Signals
          </div>

          {/* Recent searches (live) or hardcoded trending (fallback) */}
          {searchHistory.length > 0 ? (
            <div style={{
              background: T.glass, border: T.glassBorder, boxShadow: T.glassShadow,
              backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
              borderRadius: 14, padding: '20px 22px', marginBottom: 14,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 16 }}>
                <Clock size={14} color={T.accent} />
                <span style={{ fontFamily: T.mono, fontSize: '0.70rem', fontWeight: 600, color: T.accent, letterSpacing: '0.10em' }}>
                  RECENT SEARCHES
                </span>
              </div>
              {searchHistory.slice(0, 8).map((q, i) => (
                <div
                  key={i}
                  onClick={() => handleStorySearch(q, 'search')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 0',
                    borderBottom: i < Math.min(searchHistory.length, 8) - 1 ? `1px solid ${T.border}` : 'none',
                    cursor: 'pointer',
                    transition: 'opacity 0.13s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.72'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  <span style={{ fontFamily: T.mono, fontSize: '0.68rem', color: T.fgDim, flex: '0 0 18px' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span style={{ fontFamily: T.sans, fontSize: '0.80rem', fontWeight: 400, color: T.fg, flex: 1,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {q}
                  </span>
                  <ChevronRight size={11} color={T.fgDim} style={{ flex: '0 0 auto' }} />
                </div>
              ))}
            </div>
          ) : (
            <TrendingPanel
              articles={trendingArticles}
              isLive={isLive}
              spinning={spinning}
              onRefresh={refetch}
            />
          )}

          <MarketsPanel />
        </div>
      </section>
    </div>
  );
}
