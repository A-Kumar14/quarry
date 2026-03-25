import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, BookOpen, FlaskConical, TrendingUp, ChevronRight, Zap } from 'lucide-react';

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

/* ── Hardcoded content ───────────────────────────────────────────────────── */
const SUGGESTIONS = [
  'Sudan humanitarian crisis 2025',
  'Gaza reconstruction funding',
  'Haiti gang violence displacement',
  'Myanmar junta airstrikes',
  'Sahel drought food insecurity',
];

const FEATURED_STORY = {
  kicker:  'CRISIS INTELLIGENCE',
  headline:'Sudan: 18 months of conflict, 10 million displaced — where are international donors?',
  summary: 'A Quarry deep-dive across 34 sources surfaced significant contradictions between UN funding pledges and actual disbursements. Three competing narratives identified.',
  tags:    ['Sudan', 'Humanitarian', '34 sources', '6 contradictions'],
  meta:    'Updated 2 h ago',
};

const SMALLER_STORIES = [
  {
    kicker:  'ACCOUNTABILITY',
    headline:'Gaza reconstruction: who controls the $50 bn pledge?',
    meta:    '12 sources · 4 h ago',
  },
  {
    kicker:  'DISPLACEMENT',
    headline:'Haiti displacement rises 28% as gang violence expands north',
    meta:    '9 sources · 7 h ago',
  },
  {
    kicker:  'CLIMATE',
    headline:'Sahel drought: conflicting data on crop-failure projections',
    meta:    '15 sources · 1 d ago',
  },
];

const ENTRY_STORIES = [
  'Myanmar junta air campaign: verified strike locations vs. claimed civilian deaths',
  'DRC: eastern province mineral revenue flows — three contradictory assessments',
  'Yemen: Red Sea shipping disruption — economic modelling divergence',
  'Bangladesh floods 2025: early-warning system failure timeline',
];

const TRENDING = [
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
  { id: 'search',   label: 'Search',   icon: Search,        desc: 'Find sources & contradictions' },
  { id: 'write',    label: 'Write',    icon: BookOpen,       desc: 'Draft with citations' },
  { id: 'research', label: 'Research', icon: FlaskConical,   desc: 'Deep multi-step analysis' },
  { id: 'finance',  label: 'Markets',  icon: TrendingUp,     desc: 'Stocks & commodities' },
];

/* ── Sub-components ──────────────────────────────────────────────────────── */

function Topbar() {
  const navigate = useNavigate();
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
      {[
        { label: 'Artifacts', path: '/artifacts' },
        { label: 'Research', path: '/research' },
        { label: 'Sources',  path: '/sources'  },
        { label: 'Settings', path: '/settings' },
      ].map(({ label, path }) => (
        <button
          key={path}
          onClick={() => navigate(path)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: T.sans, fontSize: '0.78rem', fontWeight: 500,
            color: T.fgSec, letterSpacing: '0.01em',
            padding: '4px 8px', borderRadius: 6,
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => e.target.style.color = T.fg}
          onMouseLeave={e => e.target.style.color = T.fgSec}
        >
          {label}
        </button>
      ))}
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

function SuggestionChips({ onChip }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 720, margin: '0 auto' }}>
      {SUGGESTIONS.map(s => (
        <button
          key={s}
          onClick={() => onChip(s)}
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
          {s}
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

function TrendingPanel() {
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
        <TrendingUp size={14} color={T.accent} />
        <span style={{ fontFamily: T.mono, fontSize: '0.70rem', fontWeight: 600, color: T.accent, letterSpacing: '0.10em' }}>
          TRENDING QUERIES
        </span>
      </div>
      {TRENDING.map((item, i) => (
        <div key={item.label} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 0',
          borderBottom: i < TRENDING.length - 1 ? `1px solid ${T.border}` : 'none',
        }}>
          <span style={{ fontFamily: T.mono, fontSize: '0.68rem', color: T.fgDim, flex: '0 0 18px' }}>
            {String(i + 1).padStart(2, '0')}
          </span>
          <span style={{ fontFamily: T.sans, fontSize: '0.82rem', fontWeight: 400, color: T.fg, flex: 1 }}>
            {item.label}
          </span>
          <span style={{
            fontFamily: T.mono, fontSize: '0.68rem', fontWeight: 500,
            color: T.accent, background: T.accentDim,
            padding: '2px 7px', borderRadius: 8,
          }}>
            {item.count}
          </span>
        </div>
      ))}
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
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('search');

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
          <SuggestionChips onChip={handleChip} />
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
          <div style={{
            fontFamily: T.mono, fontSize: '0.68rem', fontWeight: 600,
            color: T.fgDim, letterSpacing: '0.12em', textTransform: 'uppercase',
            marginBottom: 14,
          }}>
            Recent intelligence
          </div>

          <FeaturedCard story={FEATURED_STORY} onSearch={handleStorySearch} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
            {SMALLER_STORIES.map((s, i) => (
              <SmallStoryCard key={i} story={s} onSearch={handleStorySearch} />
            ))}
          </div>

          <EntryList stories={ENTRY_STORIES} onSearch={handleStorySearch} />
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
          <TrendingPanel />
          <MarketsPanel />
        </div>
      </section>
    </div>
  );
}
