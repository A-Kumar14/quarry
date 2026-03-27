import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, ChevronDown, Zap, FileText, PenLine, AlertTriangle, ExternalLink } from 'lucide-react';
import { useDarkMode } from '../DarkModeContext';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';

/* ── Design tokens — all CSS variables so light/dark adapts automatically ── */
const T = {
  bg:          'var(--bg-primary)',
  glass:       'var(--glass-bg)',
  glassBorder: '1px solid var(--glass-border)',
  glassShadow: 'var(--glass-shadow)',
  accent:      '#F97316',
  accentDim:   'rgba(249,115,22,0.15)',
  fg:          'var(--fg-primary)',
  fgSec:       'var(--fg-secondary)',
  fgDim:       'var(--fg-dim)',
  border:      'var(--border)',
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

const TOPICS = [
  { id: 'world',    label: 'World',    gnews: ''           },
  { id: 'politics', label: 'Politics', gnews: 'nation'     },
  { id: 'sports',   label: 'Sports',   gnews: 'sports'     },
  { id: 'tech',     label: 'Tech',     gnews: 'technology' },
  { id: 'finance',  label: 'Finance',  gnews: 'business'   },
];

/* ── Recently Contested helpers ─────────────────────────────────────────── */
const CONTESTED_KEY = 'quarry_contested_claims';

export function saveContestedClaims(query, claims) {
  if (!claims?.length) return;
  const contested = claims.filter(c => c.status === 'contested');
  if (!contested.length) return;
  try {
    const existing = JSON.parse(localStorage.getItem(CONTESTED_KEY) || '[]');
    const entries = contested.map(c => ({
      claim: c.claim_text || c.claim || '',
      query,
      sourceCount: c.source_outlets?.length || 0,
      savedAt: Date.now(),
    }));
    const merged = [...entries, ...existing].slice(0, 20);
    localStorage.setItem(CONTESTED_KEY, JSON.stringify(merged));
  } catch {}
}

function loadContestedClaims() {
  try { return JSON.parse(localStorage.getItem(CONTESTED_KEY) || '[]'); }
  catch { return []; }
}

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

/* ── Topic-filtered news hook ────────────────────────────────────────────── */
function useTopicNews(topic) {
  const [articles, setArticles] = useState([]);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    if (topic === 'world') return; // world uses parent fetch
    setLoading(true);
    const gnews = TOPICS.find(t => t.id === topic)?.gnews || '';
    const param  = gnews ? `&topic=${gnews}` : '';
    fetch(`${API}/explore/trending-news?max=10${param}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        const raw = (data.articles || []).filter(a => a.title);
        // Deduplicate by URL
        const seen = new Set();
        const deduped = raw.filter(a => { if (seen.has(a.url)) return false; seen.add(a.url); return true; });
        setArticles(deduped.slice(0, 8));
      })
      .catch(() => setArticles([]))
      .finally(() => setLoading(false));
  }, [topic]);

  return { articles, loading };
}

/* ── localStorage helpers ────────────────────────────────────────────────── */

function loadArtifacts() {
  try {
    const docs = JSON.parse(localStorage.getItem('quarry_documents') || '[]');
    // Deduplicate by title — keep the most recently updated per title
    const seen = new Map();
    for (const doc of docs) {
      const key = (doc.title || doc.query || 'Untitled').trim().toLowerCase();
      if (!seen.has(key) || (doc.updatedAt || 0) > (seen.get(key).updatedAt || 0)) {
        seen.set(key, doc);
      }
    }
    return [...seen.values()].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } catch (_) { return []; }
}

function ago(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)    return 'just now';
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

/* ── Topbar ───────────────────────────────────────────────────────────────── */
function TopbarWithData() {
  const navigate = useNavigate();
  const location = useLocation();
  const [dark] = useDarkMode();
  const [artifacts, setArtifacts] = useState([]);
  const artifactsLoaded = useRef(false);

  const onArtifactsOpen = () => {
    if (!artifactsLoaded.current) { setArtifacts(loadArtifacts()); artifactsLoaded.current = true; }
  };

  const handleArtifactSelect = useCallback((doc) => {
    sessionStorage.setItem('quarry_write_session', JSON.stringify({
      query: doc.query || doc.title || '', content: doc.content || '', docId: doc.id,
    }));
    navigate('/write');
  }, [navigate]);

  const SIMPLE_NAV = [
    { label: 'Write',    path: '/write',    Icon: PenLine },
    { label: 'Sources',  path: '/sources',  Icon: null    },
    { label: 'Settings', path: '/settings', Icon: null    },
  ];

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 100, height: 44,
      background: dark ? 'rgba(26,22,20,0.88)' : 'rgba(237,232,223,0.88)',
      backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
      borderBottom: `1px solid ${T.border}`,
      display: 'flex', alignItems: 'center', padding: '0 24px', gap: 12,
    }}>
      <span style={{ fontFamily: T.serif, fontSize: '1rem', fontWeight: 400, letterSpacing: '0.16em',
        textTransform: 'uppercase', color: T.accent, flex: '0 0 auto' }}>Quarry</span>
      <div style={{ flex: 1 }} />

      <LazyNavDropdown label="Artifacts" icon={FileText} items={artifacts} onOpen={onArtifactsOpen}
        emptyMsg="No saved artifacts yet"
        onSelect={handleArtifactSelect}
        renderItem={doc => (
          <div>
            <div style={{ fontFamily: T.sans, fontSize: '0.78rem', fontWeight: 500, color: T.fg, marginBottom: 2,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 280 }}>
              {doc.title || doc.query || 'Untitled'}
            </div>
            <div style={{ fontFamily: T.mono, fontSize: '0.62rem', color: T.fgDim }}>
              {doc.updatedAt ? ago(doc.updatedAt) : ''}{doc.sources?.length ? ` · ${doc.sources.length} sources` : ''}
            </div>
          </div>
        )} />

{SIMPLE_NAV.map(({ label, path, Icon }) => {
        const isActive = location.pathname === path;
        return (
          <button key={path} onClick={() => navigate(path)} style={{
            background: isActive ? T.accentDim : 'none',
            border: isActive ? `1px solid rgba(249,115,22,0.22)` : 'none',
            borderRadius: 6, cursor: 'pointer',
            fontFamily: T.sans, fontSize: '0.78rem', fontWeight: isActive ? 600 : 500,
            color: isActive ? T.accent : T.fgSec,
            letterSpacing: '0.01em', padding: '4px 8px',
            transition: 'color 0.15s', display: 'inline-flex', alignItems: 'center', gap: 4,
          }}
          onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = T.fg; }}
          onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = T.fgSec; }}>
            {Icon && <Icon size={11} />}{label}
          </button>
        );
      })}
    </header>
  );
}

function LazyNavDropdown({ label, icon: Icon, items, onOpen, emptyMsg, onSelect, renderItem }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = () => {
    if (!open) onOpen?.();
    setOpen(v => !v);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={toggle} style={{
        background: open ? T.accentDim : 'none',
        border: open ? `1px solid rgba(249,115,22,0.22)` : 'none',
        borderRadius: 6, cursor: 'pointer',
        fontFamily: T.sans, fontSize: '0.78rem', fontWeight: 500,
        color: open ? T.accent : T.fgSec,
        letterSpacing: '0.01em', padding: '4px 8px',
        display: 'inline-flex', alignItems: 'center', gap: 4, transition: 'color 0.15s',
      }}
      onMouseEnter={e => { if (!open) e.currentTarget.style.color = T.fg; }}
      onMouseLeave={e => { if (!open) e.currentTarget.style.color = T.fgSec; }}>
        {Icon && <Icon size={11} />}
        {label}
        <ChevronDown size={10} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0,
          minWidth: 260, maxWidth: 340, maxHeight: 340, overflowY: 'auto',
          background: 'rgba(26,22,20,0.97)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          border: `1px solid rgba(255,255,255,0.08)`,
          boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
          borderRadius: 12, zIndex: 200,
        }}>
          {items.length === 0
            ? <div style={{ padding: '20px 18px', fontFamily: T.sans, fontSize: '0.78rem',
                color: T.fgDim, textAlign: 'center' }}>{emptyMsg}</div>
            : items.map((item, i) => (
              <div key={i} onClick={() => { onSelect(item); setOpen(false); }}
                style={{
                  padding: '11px 16px',
                  borderBottom: i < items.length - 1 ? `1px solid ${T.border}` : 'none',
                  cursor: 'pointer', transition: 'background 0.12s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(249,115,22,0.07)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                {renderItem(item)}
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
}



function SearchSurface({ query, setQuery, isDeep, setIsDeep, onSubmit }) {
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
      borderRadius: 18,
      padding: '32px 36px',
      width: '100%',
      maxWidth: 820,
      margin: '0 auto',
    }}>
      {/* Input row */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center',
          background: 'var(--gbtn-bg)',
          border: `1px solid ${T.border}`,
          borderRadius: 12, padding: '0 18px', gap: 12,
        }}>
          <Search size={17} color={T.fgDim} />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder={'Investigate a crisis, claim, or source…'}
            style={{
              flex: 1, border: 'none', background: 'transparent', outline: 'none',
              fontFamily: T.sans, fontSize: '1.05rem', fontWeight: 400,
              color: T.fg, padding: '14px 0',
            }}
          />
        </div>

        <button
          onClick={() => query.trim() && onSubmit()}
          disabled={!query.trim()}
          style={{
            background: query.trim() ? T.accent : 'rgba(249,115,22,0.30)',
            color: '#fff',
            border: 'none', borderRadius: 12, cursor: query.trim() ? 'pointer' : 'not-allowed',
            padding: '14px 28px',
            fontFamily: T.sans, fontSize: '0.96rem', fontWeight: 500,
            boxShadow: query.trim() ? '0 2px 12px rgba(249,115,22,0.28)' : 'none',
            transition: 'background 0.15s, transform 0.15s',
            display: 'flex', alignItems: 'center', gap: 8,
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => { if (query.trim()) e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          <Search size={16} />
          Investigate
        </button>

        <button
          onClick={() => setIsDeep(!isDeep)}
          style={{
            background: isDeep ? 'rgba(249,115,22,0.12)' : 'rgba(255,255,255,0.03)',
            border: isDeep ? '1px solid rgba(249,115,22,0.5)' : `1px solid ${T.border}`,
            color: isDeep ? T.accent : T.fgSec,
            borderRadius: 12, cursor: 'pointer',
            padding: '14px 18px',
            fontFamily: T.sans, fontSize: '0.96rem', fontWeight: 500,
            transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          <Zap size={16} fill={isDeep ? T.accent : 'none'} />
          Deep
        </button>
      </div>
    </div>
  );
}

/* ── Image with error fallback ───────────────────────────────────────────── */
function NewsImage({ src, height = 116, borderRadius = 0 }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div style={{ width: '100%', height, background: 'rgba(175,150,105,0.09)', borderRadius,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem' }}>
        📰
      </div>
    );
  }
  const proxied = `${API}/explore/img-proxy?url=${encodeURIComponent(src)}`;
  return (
    <img src={proxied} alt=""
      style={{ width: '100%', height, objectFit: 'cover', display: 'block', borderRadius }}
      onError={() => setFailed(true)} />
  );
}

/* ── Recently Contested feed ─────────────────────────────────────────────── */
function RecentlyContestedSection({ onChip }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    setItems(loadContestedClaims().slice(0, 3));
  }, []);

  const PLACEHOLDER = [
    { claim: 'Gaza ceasefire deal rejected by one faction, accepted by another', query: 'Gaza ceasefire negotiations', sourceCount: 4 },
    { claim: 'Death toll figures differ between government and NGO reports', query: 'Sudan conflict casualties', sourceCount: 3 },
    { claim: 'Reconstruction costs estimated at $40bn vs $80bn depending on source', query: 'Gaza reconstruction funding', sourceCount: 2 },
  ];

  const display = items.length > 0 ? items : PLACEHOLDER;
  const isLive  = items.length > 0;

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', marginTop: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <AlertTriangle size={13} color="#ef4444" />
        <span style={{
          fontFamily: T.mono, fontSize: '0.70rem', fontWeight: 600,
          color: 'var(--fg-dim)', letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          Recently Contested
        </span>
        {!isLive && (
          <span style={{
            fontFamily: T.mono, fontSize: '0.60rem', color: 'var(--fg-dim)',
            background: 'var(--gbtn-bg)', border: '1px solid var(--border)',
            borderRadius: 99, padding: '1px 7px',
          }}>
            example
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {display.map((item, i) => (
          <div
            key={i}
            onClick={() => item.query && onChip(item.query)}
            style={{
              background: 'var(--glass-bg)',
              backdropFilter: 'var(--glass-blur)',
              WebkitBackdropFilter: 'var(--glass-blur)',
              border: '1px solid rgba(239,68,68,0.18)',
              borderRadius: 12,
              padding: '12px 16px',
              cursor: item.query ? 'pointer' : 'default',
              transition: 'transform 0.15s, box-shadow 0.15s',
              display: 'flex', alignItems: 'flex-start', gap: 12,
            }}
            onMouseEnter={e => { if (item.query) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.10)'; } }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', flexShrink: 0, marginTop: 5 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: T.sans, fontSize: '0.85rem', fontWeight: 500,
                color: T.fg, lineHeight: 1.45,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {item.claim}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5 }}>
                {item.query && (
                  <span style={{ fontFamily: T.mono, fontSize: '0.62rem', color: T.fgDim }}>
                    from: {item.query.slice(0, 42)}{item.query.length > 42 ? '…' : ''}
                  </span>
                )}
                {item.sourceCount > 0 && (
                  <span style={{
                    fontFamily: T.mono, fontSize: '0.60rem',
                    color: '#ef4444',
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.20)',
                    borderRadius: 99, padding: '1px 7px',
                  }}>
                    {item.sourceCount} source{item.sourceCount !== 1 ? 's' : ''} disagreed
                  </span>
                )}
              </div>
            </div>
            {item.query && (
              <ExternalLink size={13} color="var(--fg-dim)" style={{ flexShrink: 0, marginTop: 3 }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Regular news card ────────────────────────────────────────────────────── */
function NewsCard({ article, onChip }) {
  const handleClick = () => {
    if (article.url) window.open(article.url, '_blank', 'noopener,noreferrer');
    else onChip(article.title);
  };
  return (
    <div
      onClick={handleClick}
      style={{
        width: 248, flexShrink: 0,
        background: T.glass, border: T.glassBorder, boxShadow: T.glassShadow,
        borderRadius: 16, overflow: 'hidden',
        cursor: 'pointer', transition: 'transform 0.15s',
        display: 'flex', flexDirection: 'column',
      }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
    >
      {/* Image */}
      <NewsImage src={article.image || article.urlToImage} height={136} />
      {/* Text */}
      <div style={{ padding: '14px 16px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={{ fontFamily: T.sans, fontSize: '0.87rem', fontWeight: 500, color: T.fg, lineHeight: 1.4,
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {article.title}
        </div>
        {article.source?.name && (
          <div style={{ fontFamily: T.mono, fontSize: '0.66rem', color: T.accent, letterSpacing: '0.07em' }}>
            {article.source.name}
          </div>
        )}
        {article.description && (
          <div style={{ fontFamily: T.sans, fontSize: '0.76rem', fontWeight: 300, color: T.fgSec, lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {article.description}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── News cards strip with topic filter ──────────────────────────────────── */
function NewsCardsStrip({ onChip, defaultArticles }) {
  const [activeTopic, setActiveTopic] = useState('world');
  const { articles: topicArticles, loading } = useTopicNews(activeTopic);

  // Deduplicate by URL
  const dedup = (arr) => {
    const seen = new Set();
    return arr.filter(a => { if (seen.has(a.url)) return false; seen.add(a.url); return true; });
  };

  const displayArticles = activeTopic === 'world'
    ? dedup(defaultArticles.length >= 3 ? defaultArticles : [])
    : dedup(topicArticles);

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <style>{`
        .news-scroll::-webkit-scrollbar { display: none; }
        @keyframes shimmer { 0%,100%{opacity:0.5} 50%{opacity:1} }
      `}</style>

      {/* Topic pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {TOPICS.map(t => {
          const active = activeTopic === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTopic(t.id)}
              style={{
                padding: '7px 18px', borderRadius: 20,
                border: active ? `1px solid ${T.accent}` : `1px solid ${T.border}`,
                background: active ? T.accentDim : 'var(--gbtn-bg)',
                color: active ? T.accent : T.fgSec,
                fontFamily: T.sans, fontSize: '0.86rem', fontWeight: 500,
                cursor: 'pointer', transition: 'all 0.14s', letterSpacing: '0.01em',
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.color = T.fg; } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.color = T.fgSec; } }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Horizontal scroll strip */}
      <div className="news-scroll" style={{
        display: 'flex', gap: 14,
        overflowX: 'auto', paddingBottom: 8,
        scrollbarWidth: 'none', msOverflowStyle: 'none',
      }}>
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{
              width: 248, height: 320, flexShrink: 0,
              background: 'rgba(175,150,105,0.09)', borderRadius: 16,
              animation: 'shimmer 1.4s ease-in-out infinite',
            }} />
          ))
        ) : displayArticles.length > 0 ? (
          displayArticles.map((a, i) => (
            <NewsCard key={i} article={a} onChip={onChip} />
          ))
        ) : (
          FALLBACK_SUGGESTIONS.map((s, i) => (
            <div
              key={i}
              onClick={() => onChip(s)}
              style={{
                width: 248, flexShrink: 0, minHeight: 130,
                background: T.glass, border: T.glassBorder, borderRadius: 16,
                padding: '22px 18px', cursor: 'pointer',
                display: 'flex', alignItems: 'center',
                fontFamily: T.sans, fontSize: '0.88rem', color: T.fg, lineHeight: 1.45,
              }}
            >
              {s}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ── Main export ─────────────────────────────────────────────────────────── */

export default function HomePage({ onSearch }) {
  const [query, setQuery] = useState('');
  const [isDeep, setIsDeep] = useState(false);
  const { articles: trendingArticles } = useTrendingNews();

  const handleSubmit = useCallback(() => {
    if (!query.trim()) return;
    if (onSearch) onSearch(query.trim(), isDeep);
  }, [query, isDeep, onSearch]);

  const handleChip = useCallback((text) => {
    setQuery(text);
    if (onSearch) onSearch(text, isDeep);
  }, [isDeep, onSearch]);

  return (
    <div style={{ minHeight: '100vh', fontFamily: T.sans, background: T.bg }}>
      <TopbarWithData />

      {/* Hero + search */}
      <section style={{ padding: '80px 32px 60px', maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <div style={{
            fontFamily: T.mono, fontSize: '0.78rem', fontWeight: 600,
            letterSpacing: '0.16em', color: T.accent,
            textTransform: 'uppercase', marginBottom: 20,
          }}>
            AI Research Engine
          </div>
          <h1 style={{
            fontFamily: T.serif, fontSize: 'clamp(2.8rem, 6vw, 4rem)',
            fontWeight: 400, color: T.accent, lineHeight: 1.12,
            letterSpacing: '-0.025em', marginBottom: 24,
          }}>
            Research. Verify.<br/>Write with confidence.
          </h1>
          <p style={{
            fontFamily: T.sans, fontSize: '1.15rem', fontWeight: 300,
            color: T.fgSec, lineHeight: 1.7, maxWidth: 540, margin: '0 auto 48px',
          }}>
            Search the web, see where sources contradict
            each other, and write your story — all in one place.
          </p>
        </div>

        <SearchSurface
          query={query}
          setQuery={setQuery}
          isDeep={isDeep}
          setIsDeep={setIsDeep}
          onSubmit={handleSubmit}
        />

        <div style={{ marginTop: 32 }}>
          <NewsCardsStrip onChip={handleChip} defaultArticles={trendingArticles} />
        </div>

        <RecentlyContestedSection onChip={handleChip} />
      </section>

    </div>
  );
}
