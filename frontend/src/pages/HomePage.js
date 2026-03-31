import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, ChevronDown, Zap, FileText, PenLine, AlertTriangle, ExternalLink, Plus, X } from 'lucide-react';
import { getBeats, saveBeat, deleteBeat, incrementBeatActivity } from '../utils/beats';
import { useDarkMode } from '../DarkModeContext';
import DailyTopicsModal from '../components/DailyTopicsModal';
import { useAuth } from '../contexts/AuthContext';
import OnboardingModal from '../components/OnboardingModal';
import GlassCard from '../components/GlassCard';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';

/* ── Design tokens ───────────────────────────────────────────────────────── */
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

/* ── Investigation history helpers ──────────────────────────────────────── */
const INVESTIGATION_HISTORY_KEY = 'quarry_investigation_history';

export function saveInvestigationHistory(query, contradictions) {
  if (!query) return;
  try {
    const existing = JSON.parse(localStorage.getItem(INVESTIGATION_HISTORY_KEY) || '[]');
    const entry = { query, timestamp: Date.now(), contradictions: contradictions || [] };
    localStorage.setItem(INVESTIGATION_HISTORY_KEY, JSON.stringify([entry, ...existing].slice(0, 50)));
  } catch {}
}

/* ── Recently Contested helpers ──────────────────────────────────────────── */
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
    } catch {}
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
    if (topic === 'world') return;
    setLoading(true);
    const gnews = TOPICS.find(t => t.id === topic)?.gnews || '';
    const param  = gnews ? `&topic=${gnews}` : '';
    fetch(`${API}/explore/trending-news?max=10${param}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        const raw = (data.articles || []).filter(a => a.title);
        const seen = new Set();
        const deduped = raw.filter(a => { if (seen.has(a.url)) return false; seen.add(a.url); return true; });
        setArticles(deduped.slice(0, 8));
      })
      .catch(() => setArticles([]))
      .finally(() => setLoading(false));
  }, [topic]);

  return { articles, loading };
}

/* ── Story leads hook ────────────────────────────────────────────────────── */
function useStoryLeads() {
  const [leads, setLeads]   = useState([]);
  const [noKey, setNoKey]   = useState(false);

  useEffect(() => {
    const NEWSAPI_KEY = process.env.REACT_APP_NEWSAPI_KEY;

    // Source A: derived from past investigations that produced contradictions
    let derived = [];
    try {
      const history = JSON.parse(localStorage.getItem(INVESTIGATION_HISTORY_KEY) || '[]');
      derived = history
        .filter(h => h.contradictions?.length > 0)
        .slice(0, 2)
        .map(h => ({
          type: 'derived',
          title: `You investigated "${h.query}" — ${h.contradictions.length} source conflict${h.contradictions.length !== 1 ? 's' : ''} found`,
          query: h.query,
          sources: h.contradictions.length,
          sessionRef: h.timestamp,
        }));
    } catch {}

    setLeads(derived);

    // Source B: live NewsAPI leads from active beats
    if (!NEWSAPI_KEY) { setNoKey(true); return; }

    const beats = getBeats().filter(b => b.keywords?.length > 0);
    if (!beats.length) return;

    let apiBuffer = [];
    let pending = beats.length;

    beats.forEach(beat => {
      const q = beat.keywords.join(' OR ');
      fetch(`https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&sortBy=publishedAt&pageSize=2&apiKey=${NEWSAPI_KEY}`)
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(data => {
          (data.articles || [])
            .filter(a => a.title)
            .forEach(a => apiBuffer.push({ type: 'api', title: a.title, beatName: beat.name, sourceCount: 1, url: a.url }));
        })
        .catch(() => {})
        .finally(() => {
          pending--;
          if (pending === 0) setLeads(prev => [...prev, ...apiBuffer.slice(0, 3)]);
        });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { leads, noKey };
}

/* ── Globe pins hook — live GDELT data, falls back to WORLD_PINS ─────────── */
function useGlobePins() {
  const [pins, setPins] = useState(WORLD_PINS);

  useEffect(() => {
    fetch(`${API}/explore/globe-pins`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        const live = (data.pins || []).filter(p => p.lat != null && p.lng != null);
        if (live.length >= 3) setPins(live);
      })
      .catch(() => {}); // keep WORLD_PINS on any error
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return pins;
}

/* ── localStorage helpers ────────────────────────────────────────────────── */
function loadArtifacts() {
  try {
    const docs = JSON.parse(localStorage.getItem('quarry_documents') || '[]');
    const seen = new Map();
    for (const doc of docs) {
      const key = (doc.title || doc.query || 'Untitled').trim().toLowerCase();
      if (!seen.has(key) || (doc.updatedAt || 0) > (seen.get(key).updatedAt || 0)) {
        seen.set(key, doc);
      }
    }
    return [...seen.values()].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } catch { return []; }
}

function ago(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)    return 'just now';
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/* ── Time-of-day greeting ────────────────────────────────────────────────── */
function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  return 'Good evening';
}

/* ── Topbar ──────────────────────────────────────────────────────────────── */
function TopbarWithData() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const [dark]    = useDarkMode();
  const [artifacts, setArtifacts] = useState([]);
  const artifactsLoaded = useRef(false);
  const { user }  = useAuth();

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

  const initial  = user?.username?.[0]?.toUpperCase() || '?';
  const onProfile = location.pathname === '/profile';

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

      <button
        onClick={() => navigate('/profile')}
        title={user?.username || 'My Profile'}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          background: onProfile ? T.accentDim : dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
          border: onProfile ? `1px solid rgba(249,115,22,0.35)` : '1px solid transparent',
          borderRadius: 20, cursor: 'pointer', padding: '3px 10px 3px 4px',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(249,115,22,0.35)'; }}
        onMouseLeave={e => { if (!onProfile) e.currentTarget.style.borderColor = 'transparent'; }}
      >
        <div style={{
          width: 24, height: 24, borderRadius: '50%',
          background: onProfile ? T.accent : dark ? 'rgba(249,115,22,0.5)' : 'rgba(249,115,22,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: T.sans, fontSize: '0.68rem', fontWeight: 700, color: '#fff',
          flexShrink: 0,
        }}>
          {initial}
        </div>
        <span style={{
          fontFamily: T.sans, fontSize: '0.75rem', fontWeight: 500,
          color: onProfile ? T.accent : T.fgSec,
          maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {user?.username || 'Profile'}
        </span>
      </button>
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

  const toggle = () => { if (!open) onOpen?.(); setOpen(v => !v); };

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

/* ── SearchSurface (shared between logged-in and logged-out) ─────────────── */
function SearchSurface({ query, setQuery, isDeep, setIsDeep, onSubmit, onDailyTopics, flat = false }) {
  const handleKey = useCallback((e) => {
    if (e.key === 'Enter' && query.trim()) onSubmit();
  }, [query, onSubmit]);

  const inner = (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center',
        background: 'var(--gbtn-bg)', border: `1px solid ${T.border}`,
        borderRadius: 12, padding: '0 18px', gap: 12,
      }}>
        <Search size={17} color={T.fgDim} />
        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Investigate a crisis, claim, or source…"
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
          background: query.trim() ? T.accent : 'rgba(249,115,22,0.30)', color: '#fff',
          border: 'none', borderRadius: 12, cursor: query.trim() ? 'pointer' : 'not-allowed',
          padding: '14px 28px', fontFamily: T.sans, fontSize: '0.96rem', fontWeight: 500,
          boxShadow: query.trim() ? '0 2px 12px rgba(249,115,22,0.28)' : 'none',
          transition: 'background 0.15s, transform 0.15s',
          display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => { if (query.trim()) e.currentTarget.style.transform = 'translateY(-1px)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
      >
        <Search size={16} /> Investigate
      </button>
      <button
        onClick={() => setIsDeep(!isDeep)}
        style={{
          background: isDeep ? 'rgba(249,115,22,0.12)' : 'rgba(255,255,255,0.03)',
          border: isDeep ? '1px solid rgba(249,115,22,0.5)' : `1px solid ${T.border}`,
          color: isDeep ? T.accent : T.fgSec,
          borderRadius: 12, cursor: 'pointer', padding: '14px 18px',
          fontFamily: T.sans, fontSize: '0.96rem', fontWeight: 500,
          transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 8,
        }}
      >
        <Zap size={16} fill={isDeep ? T.accent : 'none'} /> Deep
      </button>
      {onDailyTopics && (
        <button
          onClick={onDailyTopics}
          style={{
            background: 'rgba(249,115,22,0.08)',
            border: '1px solid rgba(249,115,22,0.30)',
            color: T.accent,
            borderRadius: 12, cursor: 'pointer', padding: '14px 18px',
            fontFamily: T.sans, fontSize: '0.96rem', fontWeight: 500,
            transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 8,
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(249,115,22,0.15)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(249,115,22,0.08)'; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          <Zap size={15} fill={T.accent} /> Find Daily Topics
        </button>
      )}
    </div>
  );

  if (flat) return <div style={{ width: '100%' }}>{inner}</div>;

  return (
    <GlassCard variant="surface" style={{
      borderRadius: 18, padding: '32px 36px',
      width: '100%', maxWidth: 820, margin: '0 auto',
    }}>
      {inner}
    </GlassCard>
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

  useEffect(() => { setItems(loadContestedClaims().slice(0, 3)); }, []);

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
        <span style={{ fontFamily: T.mono, fontSize: '0.70rem', fontWeight: 600,
          color: 'var(--fg-dim)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Recently Contested
        </span>
        {!isLive && (
          <span style={{ fontFamily: T.mono, fontSize: '0.60rem', color: 'var(--fg-dim)',
            background: 'var(--gbtn-bg)', border: '1px solid var(--border)',
            borderRadius: 99, padding: '1px 7px' }}>
            example
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {display.map((item, i) => (
          <div key={i} onClick={() => item.query && onChip(item.query)}
            style={{
              background: 'var(--glass-bg)', backdropFilter: 'var(--glass-blur)',
              WebkitBackdropFilter: 'var(--glass-blur)',
              border: '1px solid rgba(239,68,68,0.18)', borderRadius: 12,
              padding: '12px 16px', cursor: item.query ? 'pointer' : 'default',
              transition: 'transform 0.15s, box-shadow 0.15s',
              display: 'flex', alignItems: 'flex-start', gap: 12,
            }}
            onMouseEnter={e => { if (item.query) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.10)'; } }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', flexShrink: 0, marginTop: 5 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: T.sans, fontSize: '0.85rem', fontWeight: 500, color: T.fg, lineHeight: 1.45,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {item.claim}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5 }}>
                {item.query && (
                  <span style={{ fontFamily: T.mono, fontSize: '0.62rem', color: T.fgDim }}>
                    from: {item.query.slice(0, 42)}{item.query.length > 42 ? '…' : ''}
                  </span>
                )}
                {item.sourceCount > 0 && (
                  <span style={{ fontFamily: T.mono, fontSize: '0.60rem', color: '#ef4444',
                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)',
                    borderRadius: 99, padding: '1px 7px' }}>
                    {item.sourceCount} source{item.sourceCount !== 1 ? 's' : ''} disagreed
                  </span>
                )}
              </div>
            </div>
            {item.query && <ExternalLink size={13} color="var(--fg-dim)" style={{ flexShrink: 0, marginTop: 3 }} />}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── News card ───────────────────────────────────────────────────────────── */
function NewsCard({ article, onChip }) {
  const handleClick = () => {
    if (article.url) window.open(article.url, '_blank', 'noopener,noreferrer');
    else onChip(article.title);
  };
  return (
    <GlassCard onClick={handleClick}
      style={{
        width: 248, flexShrink: 0, borderRadius: 16, overflow: 'hidden',
        cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s',
        display: 'flex', flexDirection: 'column',
      }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
    >
      <NewsImage src={article.image || article.urlToImage} height={136} />
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
    </GlassCard>
  );
}

/* ── News cards strip ────────────────────────────────────────────────────── */
function NewsCardsStrip({ onChip, defaultArticles }) {
  const [activeTopic, setActiveTopic] = useState('world');
  const { articles: topicArticles, loading } = useTopicNews(activeTopic);

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
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {TOPICS.map(t => {
          const active = activeTopic === t.id;
          return (
            <button key={t.id} onClick={() => setActiveTopic(t.id)} style={{
              padding: '7px 18px', borderRadius: 20,
              border: active ? `1px solid ${T.accent}` : `1px solid ${T.border}`,
              background: active ? T.accentDim : 'var(--gbtn-bg)',
              color: active ? T.accent : T.fgSec,
              fontFamily: T.sans, fontSize: '0.86rem', fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.14s', letterSpacing: '0.01em',
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.color = T.fg; }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.color = T.fgSec; }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {/* Carousel wrapper with right-edge fade */}
      <div style={{ position: 'relative' }}>
        <div className="news-scroll" style={{
          display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8,
          scrollbarWidth: 'none', msOverflowStyle: 'none',
        }}>
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ width: 248, height: 320, flexShrink: 0,
              background: 'rgba(175,150,105,0.09)', borderRadius: 16,
              animation: 'shimmer 1.4s ease-in-out infinite' }} />
          ))
        ) : displayArticles.length > 0 ? (
          displayArticles.map((a, i) => <NewsCard key={i} article={a} onChip={onChip} />)
        ) : (
          FALLBACK_SUGGESTIONS.map((s, i) => (
            <div key={i} onClick={() => onChip(s)} style={{
              width: 248, flexShrink: 0, minHeight: 130,
              background: T.glass, border: T.glassBorder, borderRadius: 16,
              padding: '22px 18px', cursor: 'pointer',
              display: 'flex', alignItems: 'center',
              fontFamily: T.sans, fontSize: '0.88rem', color: T.fg, lineHeight: 1.45,
            }}>
              {s}
            </div>
          ))
        )}
        </div>
        {/* Right-edge fade gradient scroll affordance */}
        <div style={{
          position: 'absolute', top: 0, right: 0, bottom: 8,
          width: 64, pointerEvents: 'none',
          background: 'linear-gradient(to right, transparent, var(--bg-primary))',
          borderRadius: '0 16px 16px 0',
        }} />
      </div>
    </div>
  );
}

/* ── Global Incident Heatmap (visual placeholder) ────────────────────────── */
const HEATMAP_FILTERS = ['All', 'Conflict', 'Famine', 'Politics'];
const HEATMAP_PINS = [
  { label: 'Gaza',    top: '40%', left: '58%', type: 'breaking',   color: '#e24b4a' },
  { label: 'Sudan',   top: '55%', left: '42%', type: 'developing', color: '#F97316' },
  { label: 'Myanmar', top: '45%', left: '68%', type: 'breaking',   color: '#e24b4a' },
  { label: 'Ukraine', top: '20%', left: '52%', type: 'developing', color: '#F97316' },
];

// Extended pin set — lat/lng for globe, top/left for mini flat map
const WORLD_PINS = [
  { label: 'Gaza',           desc: 'Ongoing airstrikes; humanitarian crisis escalating',     lat:  31.5, lng:  34.5, top: '41%', left: '57.5%', color: '#e24b4a', type: 'Conflict'  },
  { label: 'Sudan / Darfur', desc: 'RSF offensive; UN reports mass displacement',             lat:  13.0, lng:  22.0, top: '50%', left: '54%',   color: '#e24b4a', type: 'Conflict'  },
  { label: 'Ukraine',        desc: 'Front-line shelling continues in Donetsk region',         lat:  49.0, lng:  31.0, top: '28%', left: '54%',   color: '#F97316', type: 'Conflict'  },
  { label: 'Myanmar',        desc: 'Junta airstrikes on civilian areas; internet blackout',   lat:  17.0, lng:  96.0, top: '47%', left: '72%',   color: '#e24b4a', type: 'Conflict'  },
  { label: 'Haiti',          desc: 'Gang violence; government collapse imminent',             lat:  19.0, lng: -72.0, top: '46%', left: '27%',   color: '#e24b4a', type: 'Conflict'  },
  { label: 'Sahel',          desc: 'Drought + armed groups driving food insecurity',          lat:  14.0, lng:   2.0, top: '50%', left: '47%',   color: '#facc15', type: 'Famine'    },
  { label: 'Ethiopia',       desc: 'Tigray ceasefire fragile; aid access blocked',            lat:   9.0, lng:  38.0, top: '50%', left: '57%',   color: '#F97316', type: 'Famine'    },
  { label: 'Venezuela',      desc: 'Opposition crackdown; election fraud allegations',        lat:   8.0, lng: -66.0, top: '52%', left: '28%',   color: '#7f77dd', type: 'Politics'  },
  { label: 'Georgia',        desc: 'Anti-govt protests after disputed election result',       lat:  41.5, lng:  44.5, top: '31%', left: '58%',   color: '#7f77dd', type: 'Politics'  },
  { label: 'Bangladesh',     desc: 'Monsoon flooding displaced 4M; aid insufficient',         lat:  23.0, lng:  90.0, top: '46%', left: '70%',   color: '#facc15', type: 'Famine'    },
  { label: 'Somalia',        desc: 'Al-Shabaab advance; famine risk elevated',                lat:   6.0, lng:  46.0, top: '52%', left: '58%',   color: '#e24b4a', type: 'Conflict'  },
];

const TYPE_COLORS = { Conflict: '#e24b4a', Famine: '#facc15', Politics: '#7f77dd', All: '#F97316' };

/* ── miniature.earth shared script URL ──────────────────────────────────── */
const EARTH_SCRIPT_URL = 'https://miniature.earth/miniature.earth.js';

/* ── Mini Globe preview (non-interactive, auto-rotating) ────────────────── */
function MiniGlobe({ height = 120, label = 'Filtered to your beats', pins = WORLD_PINS }) {
  const [dark] = useDarkMode();
  const containerRef = useRef(null);
  const earthRef     = useRef(null);
  const pinsRef      = useRef(pins);
  const [ready, setReady] = useState(false);

  // Keep ref current so the ready handler always uses latest pins
  pinsRef.current = pins;

  useEffect(() => {
    setReady(false);
    const seaColor    = dark ? 'rgba(8,14,24,0)' : 'rgba(190,210,228,0)';
    const landColor   = dark ? '#1e2a38' : '#c4aa84';
    const borderColor = dark ? '#3a4a58' : '#9a8060';

    const initGlobe = () => {
      if (!containerRef.current || !window.Earth) return;
      if (earthRef.current) { try { earthRef.current.destroy(); } catch {} }

      let earth;
      try {
        earth = new window.Earth(containerRef.current, {
          location: { lat: 18, lng: 18 },
          zoom: 0.92,
          light: 'none',
          transparent: true,
          mapSeaColor: seaColor,
          mapLandColor: landColor,
          mapBorderColor: borderColor,
          mapBorderWidth: 0.25,
          autoRotate: true,
          autoRotateSpeed: 0.8,
          autoRotateDelay: 0,
        });
      } catch { return; }

      earthRef.current = earth;

      earth.addEventListener('ready', function () {
        try { this.startAutoRotate(); } catch {}
        setReady(true);
        pinsRef.current.forEach(pin => {
          try {
            this.addMarker({
              location: { lat: pin.lat, lng: pin.lng },
              mesh: 'Pin3',
              color: pin.color,
              scale: 0.4,
              hotspot: false,
            });
          } catch {}
        });
      });
    };

    if (window.Earth) {
      initGlobe();
    } else {
      const existing = document.querySelector(`script[src="${EARTH_SCRIPT_URL}"]`);
      if (!existing) {
        const script = document.createElement('script');
        script.src = EARTH_SCRIPT_URL;
        document.head.appendChild(script);
      }
      const handler = () => initGlobe();
      window.addEventListener('earthjsload', handler, { once: true });
      return () => window.removeEventListener('earthjsload', handler);
    }

    return () => {
      if (earthRef.current) { try { earthRef.current.destroy(); } catch {} earthRef.current = null; }
    };
  }, [dark, pins]); // re-init when dark mode or live pins change

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
      {/* Globe container */}
      <div
        ref={containerRef}
        style={{
          width: '100%', height,
          borderRadius: 12,
          background: dark ? 'rgba(8,12,20,0.85)' : 'rgba(190,210,228,0.25)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
          pointerEvents: 'none',
          opacity: ready ? 1 : 0,
          transition: 'opacity 0.4s ease',
        }}
      />
      {/* Loading skeleton */}
      {!ready && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 12,
          background: dark ? 'rgba(8,12,20,0.85)' : 'rgba(190,210,228,0.25)',
          border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: Math.round(height * 0.55), height: Math.round(height * 0.55),
            borderRadius: '50%',
            background: dark ? 'rgba(30,42,56,0.6)' : 'rgba(196,170,132,0.3)',
            border: `1px solid ${dark ? '#3a4a58' : '#9a8060'}40`,
          }} />
        </div>
      )}
      {/* Label overlay */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '14px 10px 8px',
        background: dark
          ? 'linear-gradient(to top, rgba(8,12,20,0.90) 0%, transparent 100%)'
          : 'linear-gradient(to top, rgba(60,42,18,0.55) 0%, transparent 100%)',
        borderRadius: '0 0 12px 12px',
      }}>
        <div style={{
          fontFamily: T.mono, fontSize: '0.57rem', fontWeight: 600,
          color: dark ? 'rgba(200,195,185,0.80)' : 'rgba(245,238,226,0.90)',
          letterSpacing: '0.12em', textTransform: 'uppercase',
        }}>
          {label}
        </div>
      </div>
    </div>
  );
}

/* ── World Map Modal — miniature.earth globe ────────────────────────────── */

function WorldMapModal({ onClose, pins = WORLD_PINS }) {
  const [dark] = useDarkMode();
  const [filter, setFilter] = useState('All');
  const [activePin, setActivePin] = useState(null); // index into pins array
  const [earthReady, setEarthReady] = useState(false);
  const overlayRef  = useRef(null);
  const containerRef = useRef(null);
  const earthRef    = useRef(null);
  const markersRef  = useRef([]);

  const borderC = dark ? 'rgba(255,255,255,0.10)' : 'rgba(120,100,70,0.20)';
  const fgDim   = dark ? 'rgba(200,195,185,0.55)' : 'rgba(90,70,40,0.55)';
  const bgPage  = dark ? '#0d0f14' : '#EDE8DF';

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Load miniature.earth and initialise the globe
  useEffect(() => {
    const seaColor  = dark ? 'rgba(8,14,24,0)' : 'rgba(190,210,228,0)';
    const landColor = dark ? '#1e2a38' : '#c4aa84';
    const borderColor = dark ? '#3a4a58' : '#9a8060';

    const initGlobe = () => {
      if (!containerRef.current || !window.Earth) return;

      const earth = new window.Earth(containerRef.current, {
        location: { lat: 18, lng: 30 },
        zoom: 1.0,
        light: 'none',
        transparent: true,
        mapSeaColor: seaColor,
        mapLandColor: landColor,
        mapBorderColor: borderColor,
        mapBorderWidth: 0.3,
        autoRotate: true,
        autoRotateSpeed: 0.55,
        autoRotateDelay: 2500,
      });

      earthRef.current = earth;

      earth.addEventListener('ready', function () {
        this.startAutoRotate();
        setEarthReady(true);

        // Add all pins as 3D markers
        pins.forEach((pin, i) => {
          const marker = this.addMarker({
            location: { lat: pin.lat, lng: pin.lng },
            mesh: 'Pin3',
            color: pin.color,
            scale: 0.55,
            hotspot: true,
          });
          markersRef.current[i] = marker;

          // HTML overlay label that floats above the pin
          const overlay = this.addOverlay({
            location: { lat: pin.lat, lng: pin.lng },
            offset: 0.38,
            depthScale: 0.3,
            occlude: false,
          });
          overlay.element.innerHTML = `
            <div style="
              background:${dark ? 'rgba(10,14,22,0.92)' : 'rgba(245,238,226,0.92)'};
              border:1px solid ${pin.color}88;
              border-radius:5px;
              padding:2px 7px;
              font-family:IBM Plex Mono,monospace;
              font-size:9px;
              font-weight:600;
              color:${pin.color};
              white-space:nowrap;
              cursor:pointer;
              pointer-events:auto;
              box-shadow:0 2px 8px rgba(0,0,0,0.35);
            ">${pin.label}</div>`;

          overlay.element.firstChild.addEventListener('click', (e) => {
            e.stopPropagation();
            setActivePin(i);
            earth.goTo({ lat: pin.lat, lng: pin.lng }, { duration: 300, relativeDuration: 60 });
            earth.stopAutoRotate();
            setTimeout(() => earth.startAutoRotate(), 4000);
          });
        });
      });
    };

    if (window.Earth) {
      initGlobe();
    } else {
      const existing = document.querySelector(`script[src="${EARTH_SCRIPT_URL}"]`);
      if (!existing) {
        const script = document.createElement('script');
        script.src = EARTH_SCRIPT_URL;
        document.head.appendChild(script);
      }
      const handler = () => initGlobe();
      window.addEventListener('earthjsload', handler, { once: true });
      return () => window.removeEventListener('earthjsload', handler);
    }

    return () => {
      if (earthRef.current) {
        try { earthRef.current.destroy(); } catch {}
        earthRef.current = null;
      }
      markersRef.current = [];
      setActivePin(null);
    };
  }, [dark, pins]); // re-init when dark mode or live pins change

  const visiblePins = filter === 'All' ? pins : pins.filter(p => p.type === filter);
  const selected = activePin !== null ? pins[activePin] : null;

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: dark ? 'rgba(0,0,0,0.82)' : 'rgba(60,40,20,0.50)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{
        width: '100%', maxWidth: 1040, borderRadius: 18,
        background: bgPage,
        border: `1px solid ${borderC}`,
        boxShadow: dark ? '0 40px 100px rgba(0,0,0,0.85)' : '0 24px 60px rgba(60,40,20,0.28)',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        maxHeight: '92vh',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '13px 20px', borderBottom: `1px solid ${borderC}`,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontFamily: T.serif, fontSize: '1.05rem', fontWeight: 400, color: T.accent, letterSpacing: '0.06em' }}>
              Global Incident Map
            </span>
            <span style={{ fontFamily: T.mono, fontSize: '0.63rem', color: fgDim }}>
              {visiblePins.length} active incidents
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {['All', 'Conflict', 'Famine', 'Politics'].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '3px 11px', borderRadius: 99, cursor: 'pointer',
                fontFamily: T.sans, fontSize: '0.70rem', fontWeight: 500,
                border: filter === f ? `1px solid ${TYPE_COLORS[f] || T.accent}` : `1px solid ${borderC}`,
                background: filter === f ? `${TYPE_COLORS[f] || T.accent}18` : 'transparent',
                color: filter === f ? (TYPE_COLORS[f] || T.accent) : fgDim,
                transition: 'all 0.13s',
              }}>{f}</button>
            ))}
            <button onClick={onClose} style={{
              width: 28, height: 28, borderRadius: 8,
              border: `1px solid ${borderC}`, background: 'transparent',
              color: fgDim, cursor: 'pointer', fontFamily: T.sans,
              fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>×</button>
          </div>
        </div>

        {/* Body: globe (left) + incident list (right) */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 440 }}>

          {/* Globe */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            {/* Loading state */}
            {!earthReady && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex',
                alignItems: 'center', justifyContent: 'center', zIndex: 2,
              }}>
                <div style={{
                  fontFamily: T.mono, fontSize: '0.70rem', color: fgDim,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: T.accent, animation: 'pinPulse 1.2s ease-in-out infinite' }} />
                  Loading globe…
                </div>
              </div>
            )}

            {/* miniature.earth container */}
            <div
              ref={containerRef}
              style={{ width: '100%', height: '100%', minHeight: 440 }}
            />

            {/* Legend */}
            <div style={{
              position: 'absolute', bottom: 10, left: 12,
              display: 'flex', gap: 10, alignItems: 'center',
              background: dark ? 'rgba(0,0,0,0.60)' : 'rgba(255,252,242,0.80)',
              backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
              border: `1px solid ${borderC}`, borderRadius: 8,
              padding: '4px 10px',
            }}>
              {Object.entries(TYPE_COLORS).filter(([k]) => k !== 'All').map(([type, color]) => (
                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                  <span style={{ fontFamily: T.mono, fontSize: '0.58rem', color: fgDim }}>{type}</span>
                </div>
              ))}
            </div>

            <style>{`
              .earth-overlay { pointer-events: none; }
              .earth-overlay > * { pointer-events: auto; }
            `}</style>
          </div>

          {/* Incident list sidebar */}
          <div style={{
            width: 280, flexShrink: 0,
            borderLeft: `1px solid ${borderC}`,
            overflowY: 'auto',
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Selected pin detail */}
            {selected && (
              <div style={{
                padding: '12px 14px',
                borderBottom: `1px solid ${borderC}`,
                background: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: selected.color, flexShrink: 0, display: 'inline-block' }} />
                  <span style={{ fontFamily: T.sans, fontSize: '0.82rem', fontWeight: 600, color: dark ? '#e8e2d8' : '#2a1a08' }}>
                    {selected.label}
                  </span>
                  <span style={{
                    marginLeft: 'auto', fontFamily: T.mono, fontSize: '0.58rem',
                    color: selected.color, background: `${selected.color}18`,
                    padding: '1px 6px', borderRadius: 4,
                  }}>{selected.type}</span>
                </div>
                <div style={{ fontFamily: T.sans, fontSize: '0.75rem', fontWeight: 300, color: fgDim, lineHeight: 1.5 }}>
                  {selected.desc}
                </div>
                <button
                  onClick={() => setActivePin(null)}
                  style={{
                    marginTop: 8, padding: '2px 8px', borderRadius: 5,
                    border: `1px solid ${borderC}`, background: 'transparent',
                    fontFamily: T.mono, fontSize: '0.58rem', color: fgDim,
                    cursor: 'pointer',
                  }}
                >
                  clear ×
                </button>
              </div>
            )}

            {/* All incidents list */}
            <div style={{ padding: '8px 0', flex: 1 }}>
              <div style={{ padding: '4px 14px 8px', fontFamily: T.mono, fontSize: '0.58rem', fontWeight: 600, color: fgDim, letterSpacing: '0.10em', textTransform: 'uppercase' }}>
                {filter === 'All' ? 'All incidents' : filter}
              </div>
              {visiblePins.map((pin, i) => {
                const globalIdx = pins.indexOf(pin);
                const isActive = activePin === globalIdx;
                return (
                  <div
                    key={i}
                    onClick={() => {
                      setActivePin(globalIdx);
                      if (earthRef.current) {
                        earthRef.current.goTo({ lat: pin.lat, lng: pin.lng }, { duration: 300, relativeDuration: 60 });
                        earthRef.current.stopAutoRotate();
                        setTimeout(() => earthRef.current?.startAutoRotate(), 4000);
                      }
                    }}
                    style={{
                      padding: '9px 14px',
                      borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'}`,
                      cursor: 'pointer',
                      background: isActive ? (dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)') : 'transparent',
                      transition: 'background 0.12s',
                      borderLeft: isActive ? `2px solid ${pin.color}` : '2px solid transparent',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: pin.color, flexShrink: 0, display: 'inline-block' }} />
                      <span style={{ fontFamily: T.sans, fontSize: '0.77rem', fontWeight: 500, color: dark ? '#e0d8ce' : '#2a1a08', flex: 1 }}>
                        {pin.label}
                      </span>
                      <span style={{
                        fontFamily: T.mono, fontSize: '0.55rem',
                        color: pin.color, background: `${pin.color}18`,
                        padding: '1px 5px', borderRadius: 4, flexShrink: 0,
                      }}>{pin.type}</span>
                    </div>
                    <div style={{ fontFamily: T.sans, fontSize: '0.70rem', fontWeight: 300, color: fgDim, lineHeight: 1.45, paddingLeft: 13,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {pin.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '8px 20px', borderTop: `1px solid ${borderC}`,
          display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0,
        }}>
          {[['Conflict','#e24b4a','active conflicts'],['Famine','#facc15','famine/food crises'],['Politics','#7f77dd','political crises']].map(([type, color, label]) => {
            const count = pins.filter(p => p.type === type).length;
            return count > 0 ? (
              <span key={type} style={{ fontFamily: T.mono, fontSize: '0.63rem', color: fgDim }}>
                <span style={{ color, fontWeight: 600 }}>{count}</span> {label}
              </span>
            ) : null;
          })}
          <span style={{ marginLeft: 'auto', fontFamily: T.mono, fontSize: '0.58rem', color: fgDim }}>
            Click a label or list item to navigate · Esc to close
          </span>
        </div>
      </div>
    </div>
  );
}

function GlobalIncidentHeatmap({ height = 220, label = 'Global Incident Overview', labelSize = 11 }) {
  const mini = labelSize <= 9;
  const [activeFilter, setActiveFilter] = useState('All');

  return (
    <GlassCard style={{
      position: 'relative', height, width: '100%',
      borderRadius: 12, overflow: 'hidden',
    }}>
      {/* Subtle grid lines for map feel */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.15 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={`${(i + 1) * (100 / 7)}%`} x2="100%" y2={`${(i + 1) * (100 / 7)}%`}
            stroke="var(--fg-dim)" strokeWidth="0.5" />
        ))}
        {Array.from({ length: 9 }).map((_, i) => (
          <line key={`v${i}`} x1={`${(i + 1) * (100 / 10)}%`} y1="0" x2={`${(i + 1) * (100 / 10)}%`} y2="100%"
            stroke="var(--fg-dim)" strokeWidth="0.5" />
        ))}
      </svg>

      {/* Label */}
      <div style={mini ? {
        position: 'absolute', bottom: 4, left: 6,
        fontFamily: "'IBM Plex Mono',monospace", fontSize: 9,
        fontWeight: 600, color: 'var(--fg-dim)', letterSpacing: '0.10em',
        textTransform: 'uppercase', zIndex: 2,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '90%',
      } : {
        position: 'absolute', top: 10, left: 12,
        fontFamily: "'IBM Plex Mono',monospace", fontSize: labelSize,
        fontWeight: 600, color: 'var(--fg-dim)', letterSpacing: '0.10em',
        textTransform: 'uppercase', zIndex: 2,
      }}>
        {label}
      </div>

      {/* Filter chips — hidden in mini mode */}
      {!mini && <div style={{ position: 'absolute', top: 8, right: 10, display: 'flex', gap: 5, zIndex: 2 }}>
        {HEATMAP_FILTERS.map(f => (
          <button key={f} onClick={() => setActiveFilter(f)} style={{
            padding: '2px 9px', borderRadius: 99, cursor: 'pointer',
            fontFamily: "'DM Sans',system-ui,sans-serif", fontSize: '0.62rem', fontWeight: 500,
            border: activeFilter === f ? '1px solid #F97316' : '1px solid var(--border)',
            background: activeFilter === f ? 'rgba(249,115,22,0.15)' : 'var(--gbtn-bg)',
            color: activeFilter === f ? '#F97316' : 'var(--fg-dim)',
            transition: 'all 0.13s',
          }}>
            {f}
          </button>
        ))}
      </div>}

      {/* Incident pins */}
      {HEATMAP_PINS.map((pin, i) => (
        <div key={i} style={{ position: 'absolute', top: pin.top, left: pin.left, zIndex: 3 }}>
          {/* Pulse ring */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            width: 18, height: 18, borderRadius: '50%',
            border: `1.5px solid ${pin.color}`,
            opacity: 0.4,
            animation: 'pinPulse 2s ease-in-out infinite',
            animationDelay: `${i * 0.4}s`,
          }} />
          {/* Dot */}
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: pin.color,
            boxShadow: `0 0 6px ${pin.color}80`,
            cursor: 'default',
          }} />
          {/* Label bubble */}
          <div style={{
            position: 'absolute', top: -22, left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.72)',
            color: '#fff', fontSize: 8,
            fontFamily: "'IBM Plex Mono',monospace",
            padding: '2px 6px', borderRadius: 4,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}>
            {pin.label}
          </div>
        </div>
      ))}

      <style>{`
        @keyframes pinPulse {
          0%,100% { transform: translate(-50%,-50%) scale(1); opacity: 0.4; }
          50%      { transform: translate(-50%,-50%) scale(1.8); opacity: 0; }
        }
      `}</style>
    </GlassCard>
  );
}

/* ── Logged-out homepage ─────────────────────────────────────────────────── */
function LoggedOutHome({ query, setQuery, isDeep, setIsDeep, onSubmit }) {
  const navigate = useNavigate();

  return (
    <section style={{ padding: '80px 32px 60px', maxWidth: 1000, margin: '0 auto' }}>
      {/* Hero */}
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
          Research. Verify.<br />Write with confidence.
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
        query={query} setQuery={setQuery}
        isDeep={isDeep} setIsDeep={setIsDeep}
        onSubmit={onSubmit}
      />

      {/* Heatmap */}
      <div style={{ maxWidth: 820, margin: '36px auto 0' }}>
        <GlobalIncidentHeatmap height={220} label="Global Incident Overview" labelSize={11} />
      </div>

      {/* CTA row */}
      <div style={{
        maxWidth: 820, margin: '28px auto 0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 16,
        padding: '18px 22px',
        background: 'var(--glass-bg)', backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        border: '1px solid var(--border)', borderRadius: 14,
      }}>
        <span style={{ fontFamily: T.sans, fontSize: '0.88rem', color: T.fgDim, lineHeight: 1.5 }}>
          Sign up to track your beats and get story leads
        </span>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => navigate('/signup')} style={{
            padding: '9px 22px', borderRadius: 10, cursor: 'pointer',
            background: T.accent, border: 'none', color: '#fff',
            fontFamily: T.sans, fontSize: '0.86rem', fontWeight: 600,
            boxShadow: '0 2px 10px rgba(249,115,22,0.25)',
            transition: 'transform 0.14s',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            Create free account
          </button>
          <button onClick={() => navigate('/login')} style={{
            padding: '9px 22px', borderRadius: 10, cursor: 'pointer',
            background: 'transparent', border: '1px solid var(--border)',
            color: T.fgSec, fontFamily: T.sans, fontSize: '0.86rem', fontWeight: 500,
            transition: 'border-color 0.14s, color 0.14s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.color = T.accent; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = T.fgSec; }}
          >
            Sign in
          </button>
        </div>
      </div>
    </section>
  );
}

function IntelligenceGrid({ onChip }) {
  const navigate = useNavigate();
  const [mapOpen, setMapOpen] = useState(false);
  const [beats, setBeats] = useState([]);
  const { leads: storyLeads, noKey: newsNoKey } = useStoryLeads();
  const globePins = useGlobePins();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newKeywords, setNewKeywords] = useState('');

  useEffect(() => { setBeats(getBeats()); }, []);

  const handleSaveBeat = () => {
    const name = newName.trim();
    if (!name) return;
    const keywords = newKeywords.split(',').map(k => k.trim()).filter(Boolean);
    saveBeat({ id: Date.now().toString(), name, keywords, createdAt: Date.now(), investigationCount: 0, lastActiveAt: null });
    setBeats(getBeats());
    setNewName('');
    setNewKeywords('');
    setShowAddForm(false);
  };

  const handleDeleteBeat = (id) => { deleteBeat(id); setBeats(getBeats()); };

  const SECTION_LABEL = (text) => (
    <div style={{
      fontFamily: T.mono, fontSize: '0.62rem', fontWeight: 600,
      color: T.fgDim, letterSpacing: '0.12em',
      textTransform: 'uppercase', marginBottom: 10,
    }}>
      {text}
    </div>
  );

  // Pre-compute whether right column has data
  const hasCollisions = loadContestedClaims().length > 0;

  // Pre-compute narrative velocity rows
  const velocityRows = (() => {
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    try {
      const history = JSON.parse(localStorage.getItem('quarry_investigation_history') || '[]');
      const recent  = history.filter(h => (Date.now() - h.timestamp) <= SEVEN_DAYS);
      const bs = getBeats().filter(b => b.keywords?.length > 0);
      return bs
        .map(beat => ({
          name: beat.name,
          count: recent.filter(h =>
            beat.keywords.some(kw => h.query?.toLowerCase().includes(kw.toLowerCase()))
          ).length,
        }))
        .filter(r => r.count > 0)
        .sort((a, b) => b.count - a.count);
    } catch { return []; }
  })();

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: hasCollisions ? '180px 1fr 1fr' : '180px 1fr',
      gap: 16,
      padding: '20px 24px',
      maxWidth: 1100,
      margin: '0 auto',
      alignItems: 'flex-start',
    }}>

      {/* ── Left: Your beats ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontFamily: T.mono, fontSize: '0.62rem', fontWeight: 600,
            color: T.fgDim, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Your beats
          </div>
          <button
            onClick={() => setShowAddForm(f => !f)}
            title="Add a beat"
            style={{
              display: 'flex', alignItems: 'center', gap: 3,
              background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
              fontFamily: T.mono, fontSize: '0.60rem', color: T.accent,
              transition: 'opacity 0.13s',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            <Plus size={11} /> Add
          </button>
        </div>

        {/* Inline add form */}
        {showAddForm && (
          <GlassCard style={{ padding: '10px 12px', marginBottom: 8, borderRadius: 10 }}>
            <input
              autoFocus
              placeholder="Beat name (e.g. Sudan Crisis)"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveBeat()}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'transparent', border: 'none', outline: 'none',
                borderBottom: '1px solid var(--border)',
                fontFamily: T.sans, fontSize: '0.78rem', color: T.fg,
                paddingBottom: 5, marginBottom: 7,
              }}
            />
            <input
              placeholder="Keywords, comma-separated"
              value={newKeywords}
              onChange={e => setNewKeywords(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveBeat()}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'transparent', border: 'none', outline: 'none',
                borderBottom: '1px solid var(--border)',
                fontFamily: T.mono, fontSize: '0.70rem', color: T.fgSec,
                paddingBottom: 5, marginBottom: 9,
              }}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={handleSaveBeat}
                style={{
                  flex: 1, padding: '5px 0', borderRadius: 7, cursor: 'pointer',
                  background: T.accent, border: 'none', color: '#fff',
                  fontFamily: T.sans, fontSize: '0.74rem', fontWeight: 600,
                }}
              >
                Save
              </button>
              <button
                onClick={() => { setShowAddForm(false); setNewName(''); setNewKeywords(''); }}
                style={{
                  padding: '5px 10px', borderRadius: 7, cursor: 'pointer',
                  background: 'none', border: '1px solid var(--border)',
                  color: T.fgDim, fontFamily: T.sans, fontSize: '0.74rem',
                }}
              >
                Cancel
              </button>
            </div>
          </GlassCard>
        )}

        {/* Beat cards */}
        {beats.length === 0 && !showAddForm && (
          <div style={{
            border: '1.5px dashed var(--border)', borderRadius: 10,
            padding: '16px 12px', textAlign: 'center', marginBottom: 8,
          }}>
            <div style={{ fontFamily: T.sans, fontSize: '0.74rem', color: T.fgDim, lineHeight: 1.5 }}>
              No beats yet.<br />Add topics you cover regularly.
            </div>
          </div>
        )}

        {beats.map(beat => {
          const isLive = beat.lastActiveAt && (Date.now() - beat.lastActiveAt) < 86400000;
          const daysSince = beat.lastActiveAt
            ? Math.max(0, Math.floor((Date.now() - beat.lastActiveAt) / 86400000))
            : null;
          return (
            <GlassCard key={beat.id} style={{
              padding: '8px 10px', marginBottom: 6, borderRadius: 10,
              transition: 'transform 0.13s',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4 }}>
                <span
                  onClick={() => onChip(beat.name)}
                  style={{ fontFamily: T.sans, fontSize: '0.76rem', fontWeight: 500, color: T.fg,
                    cursor: 'pointer', flex: 1, lineHeight: 1.3 }}
                >
                  {beat.name}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {isLive && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3,
                      fontFamily: T.mono, fontSize: '0.56rem', color: T.accent }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: T.accent, display: 'inline-block' }} />
                      Live
                    </span>
                  )}
                  <button
                    onClick={() => handleDeleteBeat(beat.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      color: 'var(--fg-dim)', display: 'flex', alignItems: 'center', opacity: 0.5,
                      transition: 'opacity 0.13s' }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}
                  >
                    <X size={11} />
                  </button>
                </div>
              </div>

              {/* Keywords as pills */}
              {beat.keywords?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                  {beat.keywords.map((kw, i) => (
                    <span key={i} style={{
                      fontFamily: T.mono, fontSize: '0.58rem', color: T.fgDim,
                      background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                      padding: '1px 6px', borderRadius: 999,
                    }}>
                      {kw}
                    </span>
                  ))}
                </div>
              )}

              {/* Activity line */}
              <div style={{ fontFamily: T.mono, fontSize: '0.58rem', color: T.fgDim, marginTop: 5 }}>
                {beat.investigationCount > 0
                  ? `${beat.investigationCount} investigation${beat.investigationCount !== 1 ? 's' : ''} · last ${daysSince === 0 ? 'today' : `${daysSince}d ago`}`
                  : 'No investigations yet'}
              </div>
            </GlassCard>
          );
        })}

        <div
          style={{ marginTop: 14, cursor: 'pointer', borderRadius: 12,
            outline: 'none', transition: 'transform 0.15s, box-shadow 0.15s' }}
          onClick={() => setMapOpen(true)}
          title="Click to open full world map"
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(249,115,22,0.15)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
        >
          {!mapOpen && <MiniGlobe height={120} label="Filtered to your beats" pins={globePins} />}
          <div style={{
            textAlign: 'center', marginTop: 4,
            fontFamily: T.mono, fontSize: '0.60rem', color: T.fgDim,
            letterSpacing: '0.06em',
          }}>
            click to expand →
          </div>
        </div>
      </div>

      {mapOpen && <WorldMapModal onClose={() => setMapOpen(false)} pins={globePins} />}

      {/* ── Centre: Story leads + Narrative velocity ── */}
      <div>
        {SECTION_LABEL('Story leads')}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {storyLeads.length === 0 && !newsNoKey && (
            <div style={{
              border: '1.5px dashed var(--border)', borderRadius: 10,
              padding: '16px 12px', textAlign: 'center',
            }}>
              <div style={{ fontFamily: T.sans, fontSize: '0.74rem', color: T.fgDim, lineHeight: 1.5 }}>
                Run an investigation to generate your first lead.
              </div>
            </div>
          )}

          {storyLeads.length === 0 && newsNoKey && (
            <div style={{
              border: '1.5px dashed var(--border)', borderRadius: 10,
              padding: '14px 12px',
            }}>
              <div style={{ fontFamily: T.sans, fontSize: '0.74rem', color: T.fgDim, lineHeight: 1.5 }}>
                Run an investigation to generate your first lead.
              </div>
              <div style={{
                fontFamily: T.mono, fontSize: '0.64rem', color: T.fgDim,
                marginTop: 8, opacity: 0.7,
              }}>
                Connect a news source in Settings to see live leads.
              </div>
            </div>
          )}

          {storyLeads.map((lead, i) => {
            const isDerived = lead.type === 'derived';
            const tagLabel  = isDerived ? 'From your investigations' : `NewsAPI · ${lead.beatName}`;
            const tagColor  = isDerived ? '#f59e0b' : '#3b82f6';
            const tagBg     = isDerived ? 'rgba(245,158,11,0.10)' : 'rgba(59,130,246,0.10)';
            const action    = isDerived
              ? () => navigate(`/search?q=${encodeURIComponent(lead.query)}`)
              : lead.url
                ? () => window.open(lead.url, '_blank', 'noopener,noreferrer')
                : () => navigate(`/search?q=${encodeURIComponent(lead.title)}`);

            return (
              <GlassCard key={i} style={{ padding: '12px 14px', borderRadius: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    display: 'inline-block', marginBottom: 6,
                    fontSize: '0.60rem', fontWeight: 700, fontFamily: T.mono,
                    color: tagColor, background: tagBg,
                    padding: '2px 7px', borderRadius: 4,
                    border: `0.5px solid ${tagColor}40`,
                  }}>
                    {tagLabel}
                  </span>
                  <div style={{ fontFamily: T.sans, fontSize: '0.82rem', fontWeight: 500,
                    color: T.fg, lineHeight: 1.4, marginBottom: 8 }}>
                    {lead.title}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: T.mono, fontSize: '0.60rem', color: T.fgDim }}>
                      {isDerived ? `${lead.sources} conflict${lead.sources !== 1 ? 's' : ''}` : '1 source'}
                    </span>
                    <button
                      onClick={action}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontFamily: T.sans, fontSize: '0.72rem', fontWeight: 600,
                        color: T.accent, padding: 0, transition: 'opacity 0.13s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    >
                      {isDerived ? 'Research this →' : 'Read →'}
                    </button>
                  </div>
                </div>
              </GlassCard>
            );
          })}

          {storyLeads.length > 0 && newsNoKey && (
            <div style={{
              fontFamily: T.mono, fontSize: '0.62rem', color: T.fgDim,
              padding: '6px 10px', opacity: 0.7,
            }}>
              Connect a news source in Settings to see live leads.
            </div>
          )}
        </div>

        {/* Narrative velocity — only shown when there is actual data */}
        {velocityRows.length > 0 && (() => {
          const maxCount = velocityRows[0].count || 1;
          return (
            <>
              <div style={{ marginBottom: 4, marginTop: 20 }}>
                <div style={{ fontFamily: T.mono, fontSize: '0.62rem', fontWeight: 600,
                  color: T.fgDim, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 3 }}>
                  Narrative velocity
                </div>
                <div style={{ fontFamily: T.mono, fontSize: '0.60rem', color: T.fgDim, opacity: 0.7, marginBottom: 10 }}>
                  Based on your investigations this week
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {velocityRows.map((row, i) => {
                  const color = row.count >= 7 ? '#e24b4a' : row.count >= 3 ? '#f59e0b' : '#22c55e';
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
                      <span style={{ fontFamily: T.mono, fontSize: '0.68rem', color: T.fgSec,
                        width: 110, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.name}
                      </span>
                      <div style={{ flex: 1, height: 4, background: 'var(--bg-tertiary)', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 999, background: color,
                          width: `${Math.round((row.count / maxCount) * 100)}%`,
                          transition: 'width 0.6s ease',
                        }} />
                      </div>
                      <span style={{ fontFamily: T.mono, fontSize: '0.64rem', color: T.fgDim,
                        flexShrink: 0, width: 52, textAlign: 'right' }}>
                        {row.count} search{row.count !== 1 ? 'es' : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          );
        })()}
      </div>

      {/* ── Right: Narrative collisions — only rendered when data exists ── */}
      {hasCollisions && <div>
        {SECTION_LABEL('Narrative collisions detected')}

        {(() => {
          // Group raw entries by query, sort groups by most recent savedAt, take top 3
          const raw = loadContestedClaims();
          const groupMap = new Map();
          for (const entry of raw) {
            const key = entry.query || '';
            if (!groupMap.has(key)) groupMap.set(key, []);
            groupMap.get(key).push(entry);
          }
          const groups = [...groupMap.entries()]
            .map(([query, entries]) => ({
              query,
              claims: entries,
              maxSourceCount: Math.max(...entries.map(e => e.sourceCount || 0)),
              latestAt: Math.max(...entries.map(e => e.savedAt || 0)),
            }))
            .sort((a, b) => b.latestAt - a.latestAt)
            .slice(0, 3);

          if (groups.length === 0) {
            return (
              <div style={{
                border: '1.5px dashed var(--border)', borderRadius: 10,
                padding: '16px 12px',
              }}>
                <div style={{ fontFamily: T.sans, fontSize: '0.74rem', color: T.fgDim, lineHeight: 1.55 }}>
                  No collisions yet. Run an investigation — Quarry flags source contradictions automatically.
                </div>
              </div>
            );
          }

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {groups.map((col, i) => (
                <GlassCard key={i} style={{ padding: '8px 10px', borderRadius: 12 }}>
                  <div style={{ fontFamily: T.sans, fontSize: '0.75rem', fontWeight: 700,
                    color: T.fg, marginBottom: 6, lineHeight: 1.35,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {col.query}
                  </div>

                  {col.claims.slice(0, 2).map((c, j) => (
                    <React.Fragment key={j}>
                      <div style={{ padding: '3px 0' }}>
                        <div style={{ fontFamily: T.mono, fontSize: '0.60rem', color: T.fgDim, marginBottom: 2 }}>
                          Contested claim
                        </div>
                        <div style={{ fontFamily: T.sans, fontSize: '0.72rem', color: T.fgSec,
                          lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          "{c.claim}"
                        </div>
                      </div>
                      {j === 0 && col.claims.length > 1 && (
                        <div style={{ textAlign: 'center', margin: '2px 0' }}>
                          <span style={{
                            fontFamily: T.mono, fontSize: '0.60rem', fontWeight: 700,
                            color: 'var(--error)', background: 'rgba(220,38,38,0.10)',
                            padding: '2px 8px', borderRadius: 4,
                          }}>
                            contested
                          </span>
                        </div>
                      )}
                    </React.Fragment>
                  ))}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                    <span style={{ fontFamily: T.mono, fontSize: '0.60rem', color: T.fgDim }}>
                      Found in your session · {col.maxSourceCount > 0 ? `${col.maxSourceCount} source${col.maxSourceCount !== 1 ? 's' : ''} disagree` : 'sources disagree'}
                    </span>
                    <button
                      onClick={() => onChip(col.query)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontFamily: T.sans, fontSize: '0.70rem', fontWeight: 600,
                        color: T.accent, padding: 0, transition: 'opacity 0.13s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    >
                      Investigate →
                    </button>
                  </div>
                </GlassCard>
              ))}
            </div>
          );
        })()}
      </div>}

    </div>
  );
}

/* ── Logged-in homepage ──────────────────────────────────────────────────── */
function LoggedInHome({ user, query, setQuery, isDeep, setIsDeep, onSubmit, onChip, trendingArticles }) {
  const firstName = user?.username?.split(' ')[0] || user?.username || 'there';
  const [showDailyTopics, setShowDailyTopics] = useState(false);

  return (
    <>
      {showDailyTopics && (
        <DailyTopicsModal onClose={() => setShowDailyTopics(false)} />
      )}

      {/* Greeting + centered search bar */}
      <div style={{
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border)',
        padding: '18px 24px 16px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
      }}>
        <span style={{
          fontFamily: T.sans, fontSize: '0.96rem', fontWeight: 400,
          color: T.fgSec, alignSelf: 'center',
        }}>
          {getGreeting()}, <strong style={{ fontWeight: 600, color: T.fg }}>{firstName}</strong>
          {user?.profile?.beat ? (
            <span style={{ marginLeft: 8, fontFamily: T.mono, fontSize: '0.72rem', color: T.accent, opacity: 0.85 }}>
              · {user.profile.beat}
            </span>
          ) : null}
        </span>
        <div style={{ width: '100%', maxWidth: 820 }}>
          <SearchSurface
            flat
            query={query} setQuery={setQuery}
            isDeep={isDeep} setIsDeep={setIsDeep}
            onSubmit={onSubmit}
            onDailyTopics={() => setShowDailyTopics(true)}
          />
        </div>
      </div>

      {/* Intelligence grid */}
      <IntelligenceGrid onChip={onChip} />

      {/* News strip */}
      <div style={{ padding: '0 24px 12px', maxWidth: 1100, margin: '0 auto' }}>
        <NewsCardsStrip onChip={onChip} defaultArticles={trendingArticles} />
        <RecentlyContestedSection onChip={onChip} />
      </div>
    </>
  );
}

/* ── Main export ─────────────────────────────────────────────────────────── */
export default function HomePage({ onSearch }) {
  const [query,  setQuery]  = useState('');
  const [isDeep, setIsDeep] = useState(false);
  const { articles: trendingArticles } = useTrendingNews();
  const { user, loading } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (user && user.profile && user.profile.onboarded === false) {
      setShowOnboarding(true);
    }
  }, [user]);

  const handleSubmit = useCallback(() => {
    if (!query.trim()) return;
    incrementBeatActivity(query.trim());
    if (onSearch) onSearch(query.trim(), isDeep);
  }, [query, isDeep, onSearch]);

  const handleChip = useCallback((text) => {
    setQuery(text);
    incrementBeatActivity(text);
    if (onSearch) onSearch(text, isDeep);
  }, [isDeep, onSearch]);

  // While auth is resolving, show nothing to avoid flash
  if (loading) return <div style={{ minHeight: '100vh', background: T.bg }} />;

  return (
    <div style={{ minHeight: '100vh', fontFamily: T.sans, background: T.bg }}>
      {showOnboarding && <OnboardingModal onDone={() => setShowOnboarding(false)} />}
      <TopbarWithData />

      {user ? (
        <LoggedInHome
          user={user}
          query={query} setQuery={setQuery}
          isDeep={isDeep} setIsDeep={setIsDeep}
          onSubmit={handleSubmit}
          onChip={handleChip}
          trendingArticles={trendingArticles}
        />
      ) : (
        <LoggedOutHome
          query={query} setQuery={setQuery}
          isDeep={isDeep} setIsDeep={setIsDeep}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
