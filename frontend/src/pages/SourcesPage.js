import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, BookMarked, Network, Search, X, Copy, Check, ExternalLink, SlidersHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ForceGraph2D from 'react-force-graph-2d';
import { useDarkMode } from '../DarkModeContext';
import { getSourceLibrary, removeSourceFromLibrary } from '../utils/sourceLibrary';
import { getSourceQuality, QUALITY_COLOR } from '../utils/sourceQuality';
import GlassCard, { glassCardStyle } from '../components/GlassCard';
import NavControls from '../components/NavControls';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const DOCUMENTS_KEY = 'quarry_documents';
const STORY_DATA_KEY = 'quarry_story_data';

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function getDomain(url) {
  try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
}

function loadStories() {
  try { return JSON.parse(localStorage.getItem(DOCUMENTS_KEY) || '[]'); } catch { return []; }
}

// Build a map of docId → Set<url> from quarry_story_data research sources
function loadStorySourceMap() {
  try {
    const data = JSON.parse(localStorage.getItem(STORY_DATA_KEY) || '{}');
    const map = {};
    for (const [docId, val] of Object.entries(data)) {
      const urls = new Set();
      for (const src of [...(val.researchSources || []), ...(val.selectedResearchSources || [])]) {
        if (src.url) urls.add(src.url);
        if (src.link) urls.add(src.link);
      }
      map[docId] = urls;
    }
    return map;
  } catch { return {}; }
}

// Find which story documents reference a given URL (content + research sources)
function getStoriesForSource(url, stories, storySourceMap) {
  const domain = getDomain(url);
  return stories.filter(s => {
    if ((s.content || '').includes(url) || (s.content || '').includes(domain)) return true;
    const urls = storySourceMap[s.id];
    if (urls && (urls.has(url) || [...urls].some(u => getDomain(u) === domain))) return true;
    return false;
  });
}

/* ── Small components ────────────────────────────────────────────────────── */
function QualityBadge({ url }) {
  const q = getSourceQuality(url);
  const c = QUALITY_COLOR[q];
  return (
    <span style={{
      padding: '1px 7px', borderRadius: 99, fontSize: '0.60rem', fontWeight: 600,
      fontFamily: 'var(--font-family)', letterSpacing: '0.06em', textTransform: 'uppercase',
      background: `${c}18`, border: `1px solid ${c}44`, color: c,
    }}>
      {q}
    </span>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }); }}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 5, color: copied ? '#16a34a' : 'var(--fg-dim)', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', fontFamily: 'var(--font-family)' }}
    >
      {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy URL</>}
    </button>
  );
}

/* ── Source card (inside library modal) ──────────────────────────────────── */
function SourceCard({ src, stories, storySourceMap, onRemove, onOpenDoc }) {
  const linked = useMemo(
    () => getStoriesForSource(src.url, stories, storySourceMap),
    [src.url, stories, storySourceMap]
  );

  return (
    <div style={{
      background: 'var(--glass-bg)',
      border: '1px solid var(--border)',
      borderRadius: 12, padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <img
          src={`https://www.google.com/s2/favicons?domain=${src.domain}&sz=32`}
          alt="" width={16} height={16}
          style={{ borderRadius: 4, marginTop: 2, flexShrink: 0 }}
          onError={e => { e.target.style.display = 'none'; }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <a href={src.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <div style={{
              fontFamily: 'var(--font-family)', fontSize: '0.86rem', fontWeight: 600,
              color: 'var(--fg-primary)', lineHeight: 1.35,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--fg-primary)'}
            >
              {src.title || src.domain}
            </div>
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--fg-dim)' }}>{src.domain}</span>
            <QualityBadge url={src.url} />
          </div>
        </div>
        <button
          onClick={() => onRemove(src.url)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, color: 'var(--fg-dim)', flexShrink: 0 }}
          onMouseEnter={e => e.currentTarget.style.color = '#dc2626'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--fg-dim)'}
        >
          <X size={13} />
        </button>
      </div>

      {/* Query tags */}
      {src.queries?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {src.queries.map((q, i) => (
            <span key={i} style={{
              padding: '2px 8px', borderRadius: 99, fontSize: '0.60rem',
              fontFamily: 'var(--font-family)', background: 'rgba(249,115,22,0.08)',
              border: '1px solid rgba(249,115,22,0.18)', color: 'var(--accent)',
              maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {q}
            </span>
          ))}
        </div>
      )}

      {/* Linked stories */}
      {linked.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {linked.map((story, i) => (
            <span key={i}
              onClick={() => onOpenDoc && onOpenDoc(story)}
              title="Open in Write"
              style={{
                padding: '2px 8px', borderRadius: 99, fontSize: '0.60rem',
                fontFamily: 'var(--font-family)', background: 'rgba(30,58,138,0.08)',
                border: '1px solid rgba(30,58,138,0.20)', color: 'var(--blue)',
                cursor: onOpenDoc ? 'pointer' : 'default',
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => { if (onOpenDoc) e.currentTarget.style.background = 'rgba(30,58,138,0.18)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(30,58,138,0.08)'; }}
            >
              ✍️ {(story.title || 'Untitled').slice(0, 32)}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <CopyButton text={src.url} />
        <a href={src.url} target="_blank" rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px', borderRadius: 5, color: 'var(--fg-dim)', fontSize: '0.68rem', fontFamily: 'var(--font-family)', textDecoration: 'none' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--fg-primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--fg-dim)'}
        >
          <ExternalLink size={11} /> Open
        </a>
      </div>
    </div>
  );
}

/* ── Library modal ───────────────────────────────────────────────────────── */
function LibraryModal({ onClose }) {
  const [dark] = useDarkMode();
  const navigate = useNavigate();
  const [sources, setSources] = useState(() => getSourceLibrary());
  const [stories] = useState(() => loadStories());
  const [storySourceMap] = useState(() => loadStorySourceMap());
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent'); // recent | quality | alpha
  const [filter, setFilter] = useState('all'); // all | high | medium | unknown

  const openDoc = useCallback((doc) => {
    sessionStorage.setItem('quarry_write_session', JSON.stringify({
      query: doc.title || doc.query || '',
      content: doc.content || '',
      docId: doc.id,
    }));
    onClose();
    navigate('/write');
  }, [navigate, onClose]);

  const remove = (url) => {
    removeSourceFromLibrary(url);
    setSources(prev => prev.filter(s => s.url !== url));
  };

  const displayed = useMemo(() => {
    let list = [...sources];
    // filter
    if (filter !== 'all') list = list.filter(s => getSourceQuality(s.url) === filter);
    // search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        (s.title || '').toLowerCase().includes(q) ||
        (s.domain || '').toLowerCase().includes(q) ||
        (s.queries || []).some(qr => qr.toLowerCase().includes(q))
      );
    }
    // sort
    if (sort === 'recent') list.sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
    else if (sort === 'quality') list.sort((a, b) => {
      const order = { high: 0, medium: 1, unknown: 2 };
      return (order[getSourceQuality(a.url)] ?? 2) - (order[getSourceQuality(b.url)] ?? 2);
    });
    else if (sort === 'alpha') list.sort((a, b) => (a.domain || '').localeCompare(b.domain || ''));
    return list;
  }, [sources, search, sort, filter]);

  // Close on Escape
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 720, maxHeight: '88vh',
          background: dark ? '#0d1117' : '#FAFAF7',
          border: '1px solid var(--border)',
          borderRadius: 18, display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 22px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
        }}>
          <BookMarked size={16} color="var(--accent)" />
          <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.96rem', fontWeight: 600, color: 'var(--fg-primary)', flex: 1 }}>
            Source Library
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--fg-dim)' }}>
            {sources.length} source{sources.length !== 1 ? 's' : ''}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-dim)', display: 'flex', padding: 4, borderRadius: 6 }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--fg-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--fg-dim)'}
          >
            <X size={16} />
          </button>
        </div>

        {/* Controls */}
        <div style={{
          padding: '12px 22px', borderBottom: '1px solid var(--border)',
          display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0,
        }}>
          {/* Search */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 180,
            padding: '7px 12px', borderRadius: 9,
            border: '1px solid var(--border)',
            background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
          }}>
            <Search size={13} style={{ color: 'var(--fg-dim)', flexShrink: 0 }} />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search sources…"
              style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-family)', fontSize: '0.82rem', color: 'var(--fg-primary)', width: '100%' }}
            />
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-dim)', display: 'flex', padding: 0 }}><X size={12} /></button>}
          </div>

          {/* Sort */}
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <SlidersHorizontal size={12} style={{ color: 'var(--fg-dim)' }} />
            {[['recent', 'Recent'], ['quality', 'Quality'], ['alpha', 'A–Z']].map(([id, label]) => (
              <button key={id} onClick={() => setSort(id)} style={{
                padding: '4px 10px', borderRadius: 99, cursor: 'pointer',
                fontFamily: 'var(--font-family)', fontSize: '0.70rem', fontWeight: 500,
                border: `1px solid ${sort === id ? 'var(--accent)' : 'var(--border)'}`,
                background: sort === id ? 'rgba(249,115,22,0.10)' : 'transparent',
                color: sort === id ? 'var(--accent)' : 'var(--fg-dim)',
                transition: 'all 0.13s',
              }}>{label}</button>
            ))}
          </div>

          {/* Filter */}
          <div style={{ display: 'flex', gap: 5 }}>
            {[['all', 'All'], ['high', 'High'], ['medium', 'Medium'], ['unknown', '?']].map(([id, label]) => (
              <button key={id} onClick={() => setFilter(id)} style={{
                padding: '4px 10px', borderRadius: 99, cursor: 'pointer',
                fontFamily: 'var(--font-family)', fontSize: '0.70rem', fontWeight: 500,
                border: `1px solid ${filter === id ? 'var(--accent)' : 'var(--border)'}`,
                background: filter === id ? 'rgba(249,115,22,0.10)' : 'transparent',
                color: filter === id ? 'var(--accent)' : 'var(--fg-dim)',
                transition: 'all 0.13s',
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {displayed.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg-dim)', fontFamily: 'var(--font-family)', fontSize: '0.85rem' }}>
              {sources.length === 0 ? 'No sources saved yet. Run a search to populate your library.' : `No sources match "${search}"`}
            </div>
          ) : (
            displayed.map(src => (
              <SourceCard key={src.url} src={src} stories={stories} storySourceMap={storySourceMap} onRemove={remove} onOpenDoc={openDoc} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Topic map modal ─────────────────────────────────────────────────────── */
const NODE_COLORS = ['#F97316', '#7C3AED', '#0EA5E9', '#059669', '#DC2626', '#D97706', '#0891B2', '#7C3AED', '#BE185D'];

function TopicMapModal({ onClose }) {
  const [dark] = useDarkMode();
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [hoveredLink, setHoveredLink] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState(null); // link-label keyword chip
  const [focusInput, setFocusInput] = useState('');
  const [isRefetching, setIsRefetching] = useState(false);
  const graphRef = useRef(null);
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ w: 800, h: 560 });

  // ── Derived: which node IDs match the search term ─────────────────────────
  const matchedNodeIds = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q || !graphData) return null; // null = no filter active
    return new Set(
      graphData.nodes
        .filter(n =>
          (n.label || '').toLowerCase().includes(q) ||
          (n.description || '').toLowerCase().includes(q) ||
          (n.id || '').toLowerCase().includes(q)
        )
        .map(n => n.id)
    );
  }, [searchTerm, graphData]);

  // ── Derived: unique link-label chips ─────────────────────────────────────
  const linkChips = useMemo(() => {
    if (!graphData) return [];
    const seen = new Set();
    return (graphData.links || [])
      .map(l => l.label)
      .filter(lbl => { if (!lbl || seen.has(lbl)) return false; seen.add(lbl); return true; })
      .slice(0, 12);
  }, [graphData]);

  // ── Helper: is a link visible under current filters ────────────────────────
  const isLinkVisible = useCallback((link) => {
    if (matchedNodeIds) {
      const s = typeof link.source === 'object' ? link.source.id : link.source;
      const t = typeof link.target === 'object' ? link.target.id : link.target;
      if (!matchedNodeIds.has(s) && !matchedNodeIds.has(t)) return false;
    }
    if (activeFilter) {
      if (!(link.label || '').toLowerCase().includes(activeFilter.toLowerCase())) return false;
    }
    return true;
  }, [matchedNodeIds, activeFilter]);

  // ── Helper: is a node visible under current filters ───────────────────────
  const isNodeVisible = useCallback((node) => {
    if (matchedNodeIds && !matchedNodeIds.has(node.id)) return false;
    if (activeFilter && graphData) {
      const connected = (graphData.links || []).some(l => {
        if (!(l.label || '').toLowerCase().includes(activeFilter.toLowerCase())) return false;
        const s = typeof l.source === 'object' ? l.source.id : l.source;
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        return s === node.id || t === node.id;
      });
      if (!connected) return false;
    }
    return true;
  }, [matchedNodeIds, activeFilter, graphData]);

  // Measure container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDims({ w: Math.floor(width), h: Math.floor(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fetch topic map from AI
  useEffect(() => {
    const sources = getSourceLibrary();
    if (!sources.length) { setLoading(false); setError('No sources in your library yet.'); return; }
    fetch(`${API}/explore/topic-map`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sources }),
    })
      .then(r => r.ok ? r.json() : Promise.reject('API error'))
      .then(data => {
        if (!data.nodes?.length) { setError('AI could not build a topic map from your current sources.'); return; }
        setError(''); // clear any stale error
        const colored = {
          nodes: data.nodes.map((n, i) => ({ ...n, color: NODE_COLORS[i % NODE_COLORS.length] })),
          links: data.links || [],
        };
        setGraphData(colored);
      })
      .catch(() => setError('Failed to generate topic map. Check your API connection.'))
      .finally(() => setLoading(false));
  }, []);

  // Configure forces + zoom to fit once data loads
  useEffect(() => {
    if (!graphData || !graphRef.current) return;
    const fg = graphRef.current;
    // Stronger repulsion so nodes spread well across the canvas
    setTimeout(() => {
      try {
        const charge = fg.d3Force('charge');
        if (charge) charge.strength(-380);
        const link = fg.d3Force('link');
        if (link) link.distance(140).strength(0.4);
        const center = fg.d3Force('center');
        if (center) center.strength(0.04);
        fg.d3ReheatSimulation();
      } catch {}
      // Zoom to fit after simulation has settled
      setTimeout(() => { try { fg.zoomToFit(700, 80); } catch {} }, 2200);
    }, 100);
  }, [graphData]);

  // Close on Escape
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
    const label = node.label || node.id;
    const isSelected = selected?.id === node.id;
    const visible = isNodeVisible(node);
    const baseR = Math.max(9, Math.min(20, 8 + (node.urls?.length || 1) * 1.2));
    const r = isSelected ? baseR + 4 : baseR;

    ctx.globalAlpha = visible ? (isSelected ? 1 : 0.88) : 0.08;

    // Glow for selected
    if (isSelected && visible) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 6, 0, 2 * Math.PI);
      ctx.fillStyle = node.color ? node.color + '30' : 'rgba(249,115,22,0.18)';
      ctx.fill();
    }

    // Circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = node.color || '#F97316';
    ctx.fill();
    if (isSelected && visible) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // Source count badge
    if (node.urls?.length > 1) {
      const badge = String(node.urls.length);
      const bFont = Math.min(8, 7 / Math.max(globalScale, 0.5));
      ctx.font = `700 ${bFont}px DM Sans, system-ui, sans-serif`;
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badge, node.x, node.y);
    }

    // Label
    const fontSize = Math.min(13, Math.max(8, 11 / Math.max(globalScale, 0.6)));
    ctx.font = `600 ${fontSize}px DM Sans, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = dark ? 'rgba(230,237,243,0.94)' : 'rgba(26,24,20,0.90)';
    ctx.fillText(label, node.x, node.y + r + 3);

    ctx.globalAlpha = 1;
  }, [selected, dark, isNodeVisible]);

  const linkCanvasObject = useCallback((link, ctx, globalScale) => {
    if (!link.label) return;
    if (!isLinkVisible(link)) return;
    const start = link.source, end = link.target;
    if (typeof start !== 'object' || typeof end !== 'object') return;
    const mx = (start.x + end.x) / 2, my = (start.y + end.y) / 2;
    const isHovered = link === hoveredLink;

    if (isHovered) {
      // Full tooltip on hover
      const fontSize = Math.min(12, Math.max(8, 10 / Math.max(globalScale, 0.5)));
      ctx.font = `600 ${fontSize}px DM Sans, system-ui, sans-serif`;
      const w = ctx.measureText(link.label).width + 16, h = fontSize + 10;
      ctx.fillStyle = dark ? 'rgba(15,18,28,0.96)' : 'rgba(255,252,242,0.97)';
      ctx.beginPath();
      ctx.roundRect(mx - w / 2, my - h / 2, w, h, 5);
      ctx.fill();
      ctx.strokeStyle = 'rgba(249,115,22,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = dark ? 'rgba(230,237,243,0.95)' : 'rgba(26,24,20,0.92)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(link.label, mx, my);
    } else {
      // Always-visible dim inline label
      const fontSize = Math.min(9, Math.max(6, 8 / Math.max(globalScale, 0.7)));
      ctx.font = `400 ${fontSize}px DM Sans, system-ui, sans-serif`;
      ctx.fillStyle = dark ? 'rgba(180,190,210,0.45)' : 'rgba(60,50,40,0.38)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(link.label, mx, my);
    }
  }, [hoveredLink, dark, isLinkVisible]);

  const sources = useMemo(() => getSourceLibrary(), []);
  const selectedSources = useMemo(() => {
    if (!selected?.urls?.length) return [];
    return sources.filter(s => selected.urls.includes(s.url));
  }, [selected, sources]);

  // Links that involve the selected node
  const selectedLinks = useMemo(() => {
    if (!selected || !graphData) return [];
    return (graphData.links || []).filter(l => {
      const sid = typeof l.source === 'object' ? l.source.id : l.source;
      const tid = typeof l.target === 'object' ? l.target.id : l.target;
      return sid === selected.id || tid === selected.id;
    });
  }, [selected, graphData]);

  const getNodeById = useCallback((id) => {
    if (!graphData) return null;
    return graphData.nodes.find(n => n.id === id) || null;
  }, [graphData]);

  // ── Re-run the map with a focus query ────────────────────────────────────
  const runFocus = useCallback(() => {
    const q = focusInput.trim();
    if (!q) return;
    setIsRefetching(true);
    setSelected(null);
    setSearchTerm('');
    setActiveFilter(null);
    const srcs = getSourceLibrary();
    fetch(`${API}/explore/topic-map`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sources: srcs, focus_query: q }),
    })
      .then(r => r.ok ? r.json() : Promise.reject('API error'))
      .then(data => {
        if (!data.nodes?.length) { setError('AI could not build a map for that query.'); return; }
        setError('');
        const colored = {
          nodes: data.nodes.map((n, i) => ({ ...n, color: NODE_COLORS[i % NODE_COLORS.length] })),
          links: data.links || [],
        };
        setGraphData(colored);
      })
      .catch(() => setError('Failed to generate topic map.'))
      .finally(() => setIsRefetching(false));
  }, [focusInput]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 1000, height: '88vh',
          background: dark ? '#0d1117' : '#FAFAF7',
          border: '1px solid var(--border)',
          borderRadius: 18, display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(0,0,0,0.40)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0,
        }}>
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Network size={15} color="var(--accent)" />
            <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.94rem', fontWeight: 600, color: 'var(--fg-primary)', flex: 1 }}>
              Topic Connection Map
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.64rem', color: 'var(--fg-dim)' }}>
              {isRefetching ? 'Regenerating…' : 'AI-generated · click a node'}
            </span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-dim)', display: 'flex', padding: 4, borderRadius: 6 }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--fg-primary)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--fg-dim)'}
            >
              <X size={15} />
            </button>
          </div>

          {/* Search + Focus row */}
          <div style={{ display: 'flex', gap: 8 }}>
            {/* Highlight search — filters visible nodes in current graph */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7, flex: 1,
              padding: '6px 11px', borderRadius: 8,
              border: `1px solid ${searchTerm ? 'rgba(249,115,22,0.45)' : 'var(--border)'}`,
              background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
            }}>
              <Search size={13} style={{ color: 'var(--fg-dim)', flexShrink: 0 }} />
              <input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Highlight topics…"
                style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-family)', fontSize: '0.80rem', color: 'var(--fg-primary)', width: '100%' }}
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-dim)', display: 'flex', padding: 0 }}>
                  <X size={11} />
                </button>
              )}
            </div>

            {/* Focus query — re-runs the AI map with a theme */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7, flex: 1,
              padding: '6px 11px', borderRadius: 8,
              border: `1px solid ${focusInput ? 'rgba(249,115,22,0.45)' : 'var(--border)'}`,
              background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
            }}>
              <Network size={12} style={{ color: 'var(--fg-dim)', flexShrink: 0 }} />
              <input
                value={focusInput}
                onChange={e => setFocusInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runFocus()}
                placeholder="Focus map on… (e.g. climate finance)"
                style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-family)', fontSize: '0.80rem', color: 'var(--fg-primary)', width: '100%' }}
              />
              {focusInput && (
                <button onClick={() => setFocusInput('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-dim)', display: 'flex', padding: 0 }}>
                  <X size={11} />
                </button>
              )}
            </div>

            <button
              onClick={runFocus}
              disabled={!focusInput.trim() || isRefetching}
              style={{
                padding: '6px 14px', borderRadius: 8, border: 'none', cursor: focusInput.trim() && !isRefetching ? 'pointer' : 'not-allowed',
                background: focusInput.trim() ? 'var(--accent)' : (dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'),
                color: focusInput.trim() ? '#fff' : 'var(--fg-dim)',
                fontFamily: 'var(--font-family)', fontSize: '0.78rem', fontWeight: 500,
                flexShrink: 0, transition: 'all 0.13s',
              }}
            >
              {isRefetching ? '…' : 'Run'}
            </button>
          </div>

          {/* Link-type filter chips */}
          {linkChips.length > 0 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {linkChips.map(chip => {
                const active = activeFilter === chip;
                return (
                  <button key={chip} onClick={() => setActiveFilter(active ? null : chip)} style={{
                    padding: '3px 10px', borderRadius: 99, cursor: 'pointer',
                    fontFamily: 'var(--font-family)', fontSize: '0.68rem', fontWeight: 500,
                    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                    background: active ? 'rgba(249,115,22,0.12)' : 'transparent',
                    color: active ? 'var(--accent)' : 'var(--fg-dim)',
                    transition: 'all 0.12s',
                  }}>
                    {chip}
                  </button>
                );
              })}
              {activeFilter && (
                <button onClick={() => setActiveFilter(null)} style={{
                  padding: '3px 10px', borderRadius: 99, cursor: 'pointer',
                  fontFamily: 'var(--font-family)', fontSize: '0.68rem',
                  border: '1px solid var(--border)', background: 'transparent',
                  color: 'var(--fg-dim)',
                }}>
                  Clear filter ×
                </button>
              )}
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Graph area */}
          <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            {loading && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
                <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.82rem', color: 'var(--fg-dim)' }}>
                  AI is mapping your topics…
                </span>
              </div>
            )}
            {error && !graphData && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.84rem', color: 'var(--fg-dim)', textAlign: 'center', maxWidth: 320 }}>{error}</span>
              </div>
            )}
            {graphData && (
              <ForceGraph2D
                ref={graphRef}
                graphData={graphData}
                width={dims.w}
                height={dims.h}
                backgroundColor="transparent"
                nodeCanvasObject={nodeCanvasObject}
                nodePointerAreaPaint={(node, color, ctx) => {
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, 18, 0, 2 * Math.PI);
                  ctx.fillStyle = color;
                  ctx.fill();
                }}
                linkColor={link => {
                  if (!isLinkVisible(link)) return dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
                  if (link === hoveredLink) return 'rgba(249,115,22,0.70)';
                  const base = 0.06 + (link.strength || 1) * 0.06;
                  return dark ? `rgba(255,255,255,${base})` : `rgba(0,0,0,${base})`;
                }}
                linkWidth={link => {
                  if (!isLinkVisible(link)) return 0.5;
                  return link === hoveredLink ? 3 : 0.8 + (link.strength || 1) * 0.5;
                }}
                linkCanvasObjectMode={() => 'after'}
                linkCanvasObject={linkCanvasObject}
                linkDirectionalParticles={link => isLinkVisible(link) ? 2 : 0}
                linkDirectionalParticleWidth={1.5}
                linkDirectionalParticleColor={() => '#F97316'}
                onLinkHover={link => setHoveredLink(link)}
                onNodeClick={node => setSelected(prev => prev?.id === node.id ? null : node)}
                warmupTicks={60}
                cooldownTicks={120}
                d3AlphaDecay={0.015}
                d3VelocityDecay={0.25}
                enableZoomInteraction
                enablePanInteraction
              />
            )}
          </div>

          {/* Node detail panel */}
          {selected && (
            <div style={{
              width: 260, borderLeft: '1px solid var(--border)',
              padding: '18px 16px', overflowY: 'auto', flexShrink: 0,
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: selected.color, flexShrink: 0 }} />
                <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.90rem', fontWeight: 700, color: 'var(--fg-primary)' }}>
                  {selected.label}
                </span>
                <button onClick={() => setSelected(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-dim)', display: 'flex', padding: 2 }}>
                  <X size={13} />
                </button>
              </div>

              {/* Description */}
              {selected.description && (
                <div style={{ fontFamily: 'var(--font-family)', fontSize: '0.78rem', color: 'var(--fg-secondary)', lineHeight: 1.55, padding: '8px 10px', borderRadius: 8, background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}>
                  {selected.description}
                </div>
              )}

              {/* Connected topics */}
              {selectedLinks.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontFamily: 'var(--font-family)', fontSize: '0.68rem', color: 'var(--fg-dim)', letterSpacing: '0.10em', textTransform: 'uppercase' }}>
                    {selectedLinks.length} connection{selectedLinks.length !== 1 ? 's' : ''}
                  </div>
                  {selectedLinks.map((l, i) => {
                    const sid = typeof l.source === 'object' ? l.source.id : l.source;
                    const tid = typeof l.target === 'object' ? l.target.id : l.target;
                    const otherId = sid === selected.id ? tid : sid;
                    const other = getNodeById(otherId);
                    return (
                      <div key={i} style={{
                        display: 'flex', flexDirection: 'column', gap: 3,
                        padding: '7px 10px', borderRadius: 8,
                        border: '1px solid var(--border)',
                        background: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {other && <div style={{ width: 8, height: 8, borderRadius: '50%', background: other.color, flexShrink: 0 }} />}
                          <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--fg-primary)' }}>
                            {other?.label || otherId}
                          </span>
                        </div>
                        {l.label && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 14 }}>
                            <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.68rem', color: 'var(--accent)' }}>
                              {l.label}
                            </span>
                            {l.strength && (
                              <span style={{ display: 'flex', gap: 2 }}>
                                {[1,2,3].map(d => (
                                  <span key={d} style={{
                                    width: 5, height: 5, borderRadius: '50%',
                                    background: d <= l.strength ? 'var(--accent)' : (dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'),
                                  }} />
                                ))}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Linked sources */}
              <div style={{ fontFamily: 'var(--font-family)', fontSize: '0.68rem', color: 'var(--fg-dim)', letterSpacing: '0.10em', textTransform: 'uppercase' }}>
                {selectedSources.length} linked source{selectedSources.length !== 1 ? 's' : ''}
              </div>

              {selectedSources.length === 0 && (
                <div style={{ fontFamily: 'var(--font-family)', fontSize: '0.78rem', color: 'var(--fg-dim)' }}>
                  No sources from your library directly matched to this topic.
                </div>
              )}

              {selectedSources.map(src => (
                <a key={src.url} href={src.url} target="_blank" rel="noopener noreferrer" style={{
                  textDecoration: 'none',
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  padding: '8px 10px', borderRadius: 9, border: '1px solid var(--border)',
                  background: 'var(--glass-bg)', transition: 'border-color 0.13s',
                }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(249,115,22,0.3)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <img src={`https://www.google.com/s2/favicons?domain=${src.domain}&sz=32`} alt="" width={14} height={14}
                    style={{ borderRadius: 3, marginTop: 1, flexShrink: 0 }}
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-family)', fontSize: '0.76rem', fontWeight: 600, color: 'var(--fg-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {src.title || src.domain}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.60rem', color: 'var(--fg-dim)', marginTop: 2 }}>
                      {src.domain}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Inline SVG illustrations ────────────────────────────────────────────── */
const LibrarySVG = () => (
  <svg width="72" height="56" viewBox="0 0 72 56" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.18 }}>
    <rect x="4"  y="10" width="10" height="38" rx="2" fill="currentColor"/>
    <rect x="18" y="6"  width="10" height="42" rx="2" fill="currentColor"/>
    <rect x="32" y="14" width="10" height="34" rx="2" fill="currentColor"/>
    <rect x="46" y="8"  width="10" height="40" rx="2" fill="currentColor"/>
    <rect x="60" y="18" width="10" height="30" rx="2" fill="currentColor"/>
    <line x1="2" y1="50" x2="70" y2="50" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const NetworkSVG = () => (
  <svg width="72" height="56" viewBox="0 0 72 56" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.18 }}>
    <circle cx="36" cy="28" r="7" fill="currentColor"/>
    <circle cx="12" cy="14" r="5" fill="currentColor"/>
    <circle cx="60" cy="14" r="5" fill="currentColor"/>
    <circle cx="10" cy="44" r="5" fill="currentColor"/>
    <circle cx="62" cy="44" r="5" fill="currentColor"/>
    <circle cx="36" cy="50" r="4" fill="currentColor"/>
    <line x1="29" y1="24" x2="17" y2="18" stroke="currentColor" strokeWidth="1.5"/>
    <line x1="43" y1="24" x2="55" y2="18" stroke="currentColor" strokeWidth="1.5"/>
    <line x1="29" y1="33" x2="15" y2="40" stroke="currentColor" strokeWidth="1.5"/>
    <line x1="43" y1="33" x2="57" y2="40" stroke="currentColor" strokeWidth="1.5"/>
    <line x1="36" y1="35" x2="36" y2="46" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

/* ── Big entry card ──────────────────────────────────────────────────────── */
function EntryCard({ icon, title, subtitle, stat, onClick, illustration: Illustration }) {
  const [hover, setHover] = useState(false);
  return (
    <GlassCard
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: 1, minWidth: 0,
        borderRadius: 20,
        padding: '36px 32px',
        cursor: 'pointer',
        transition: 'transform 0.16s ease, box-shadow 0.16s ease',
        transform: hover ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: hover
          ? '0 16px 48px rgba(249,115,22,0.14), var(--glass-card-shadow)'
          : 'var(--glass-card-shadow)',
        display: 'flex', flexDirection: 'column', gap: 18,
        position: 'relative', overflow: 'hidden',
        ...(hover ? {
          borderTopColor: 'rgba(249,115,22,0.45)',
          borderLeftColor: 'rgba(249,115,22,0.30)',
        } : {}),
      }}
    >
      {/* Background illustration */}
      <div style={{
        position: 'absolute', bottom: 12, right: 16,
        color: 'var(--accent)', pointerEvents: 'none',
        transition: 'opacity 0.16s, transform 0.16s',
        opacity: hover ? 1 : 0.7,
        transform: hover ? 'scale(1.05) translateY(-2px)' : 'scale(1)',
      }}>
        {Illustration && <Illustration />}
      </div>

      {/* Icon badge */}
      <div style={{
        width: 48, height: 48, borderRadius: 14,
        background: hover ? 'rgba(249,115,22,0.18)' : 'rgba(249,115,22,0.10)',
        border: `1px solid ${hover ? 'rgba(249,115,22,0.35)' : 'rgba(249,115,22,0.18)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.16s, border-color 0.16s', flexShrink: 0,
      }}>
        {React.cloneElement(icon, { size: 22, color: 'var(--accent)' })}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: 'var(--font-serif)', fontSize: '1.22rem', fontWeight: 600,
          color: 'var(--fg-primary)', marginBottom: 8, lineHeight: 1.3,
        }}>
          {title}
        </div>
        <div style={{
          fontFamily: 'var(--font-family)', fontSize: '0.80rem',
          color: 'var(--fg-dim)', lineHeight: 1.6, maxWidth: 260,
        }}>
          {subtitle}
        </div>
      </div>

      {stat && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          paddingTop: 12, borderTop: '1px solid var(--border)',
          marginTop: 'auto',
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '0.65rem',
            color: 'var(--fg-secondary)', letterSpacing: '0.04em',
          }}>
            {stat}
          </span>
        </div>
      )}
    </GlassCard>
  );
}

/* ── Stats bar ───────────────────────────────────────────────────────────── */
function StatsBar({ sources, storyCount }) {
  const topDomains = useMemo(() => {
    const freq = {};
    for (const s of sources) { freq[s.domain] = (freq[s.domain] || 0) + 1; }
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([d]) => d);
  }, [sources]);

  const highCount    = useMemo(() => sources.filter(s => getSourceQuality(s.url) === 'high').length,    [sources]);
  const mediumCount  = useMemo(() => sources.filter(s => getSourceQuality(s.url) === 'medium').length,  [sources]);
  const unknownCount = useMemo(() => sources.filter(s => getSourceQuality(s.url) === 'unknown').length, [sources]);
  const domainCount  = useMemo(() => new Set(sources.map(s => s.domain)).size, [sources]);

  // eslint-disable-next-line no-unused-vars
  const total = sources.length || 1;
  const credDist = [
    { label: 'High',    count: highCount,    color: '#22c55e' },
    { label: 'Medium',  count: mediumCount,  color: '#f59e0b' },
    { label: 'Unknown', count: unknownCount, color: 'var(--border)' },
  ];

  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
      {/* Sources */}
      <GlassCard style={{ flex: '1 1 100px', padding: '16px 20px', borderRadius: 14 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>
          {sources.length}
        </div>
        <div style={{ fontFamily: 'var(--font-family)', fontSize: '0.68rem', color: 'var(--fg-dim)', marginTop: 5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Total Sources
        </div>
      </GlassCard>

      {/* Domains */}
      <GlassCard style={{ flex: '1 1 100px', padding: '16px 20px', borderRadius: 14 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 700, color: 'var(--fg-primary)', lineHeight: 1 }}>
          {domainCount}
        </div>
        <div style={{ fontFamily: 'var(--font-family)', fontSize: '0.68rem', color: 'var(--fg-dim)', marginTop: 5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Unique Domains
        </div>
      </GlassCard>

      {/* Stories */}
      <GlassCard style={{ flex: '1 1 100px', padding: '16px 20px', borderRadius: 14 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 700, color: 'var(--fg-primary)', lineHeight: 1 }}>
          {storyCount}
        </div>
        <div style={{ fontFamily: 'var(--font-family)', fontSize: '0.68rem', color: 'var(--fg-dim)', marginTop: 5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Stories
        </div>
      </GlassCard>

      {/* Credibility distribution */}
      <GlassCard style={{ flex: '2 1 220px', padding: '16px 20px', borderRadius: 14 }}>
        <div style={{ fontFamily: 'var(--font-family)', fontSize: '0.65rem', fontWeight: 600, color: 'var(--fg-dim)', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 10 }}>
          Credibility Mix
        </div>
        {/* Segmented bar */}
        <div style={{ display: 'flex', height: 6, borderRadius: 999, overflow: 'hidden', gap: 1, marginBottom: 10 }}>
          {credDist.map(({ label, count, color }) => (
            count > 0 && <div key={label} style={{ flex: count, background: color, transition: 'flex 0.4s ease' }} />
          ))}
          {sources.length === 0 && <div style={{ flex: 1, background: 'var(--border)' }} />}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {credDist.map(({ label, count, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--fg-secondary)' }}>
                {count} <span style={{ color: 'var(--fg-dim)', fontWeight: 400 }}>{label}</span>
              </span>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Top domains */}
      {topDomains.length > 0 && (
        <GlassCard style={{ flex: '2 1 180px', padding: '16px 20px', borderRadius: 14 }}>
          <div style={{ fontFamily: 'var(--font-family)', fontSize: '0.65rem', fontWeight: 600, color: 'var(--fg-dim)', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 10 }}>
            Top Domains
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {topDomains.map((d, i) => (
              <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: '0.58rem', fontWeight: 700,
                  color: 'var(--fg-dim)', width: 14, textAlign: 'right', flexShrink: 0,
                }}>#{i + 1}</span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: '0.70rem', fontWeight: 500,
                  color: i === 0 ? 'var(--accent)' : 'var(--fg-secondary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{d}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}

/* ── Recent sources inline preview ──────────────────────────────────────── */
function RecentSourcesPreview({ sources, onOpenLibrary }) {
  const recent = useMemo(() => [...sources].sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0)).slice(0, 5), [sources]);
  if (recent.length === 0) return null;
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{
          fontFamily: 'var(--font-family)', fontSize: '0.68rem',
          fontWeight: 700, color: 'var(--fg-dim)',
          letterSpacing: '0.10em', textTransform: 'uppercase',
        }}>
          Recent Sources
        </span>
        <button
          onClick={onOpenLibrary}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-family)', fontSize: '0.72rem',
            color: 'var(--accent)', padding: 0,
          }}
        >
          View all →
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {recent.map(src => {
          const q = getSourceQuality(src.url);
          const qColor = QUALITY_COLOR[q] || 'var(--fg-dim)';
          return (
            <a
              key={src.url}
              href={src.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                textDecoration: 'none',
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 14px',
                ...glassCardStyle,
                borderRadius: 10,
                transition: 'border-color 0.13s, transform 0.13s, box-shadow 0.13s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderTopColor = 'rgba(249,115,22,0.45)';
                e.currentTarget.style.borderLeftColor = 'rgba(249,115,22,0.35)';
                e.currentTarget.style.transform = 'translateX(3px)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(249,115,22,0.10)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderTopColor = 'var(--glass-card-border-t)';
                e.currentTarget.style.borderLeftColor = 'var(--glass-card-border-l)';
                e.currentTarget.style.transform = 'translateX(0)';
                e.currentTarget.style.boxShadow = 'var(--glass-card-shadow)';
              }}
            >
              {/* Credibility dot */}
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: qColor, flexShrink: 0 }} />
              <img
                src={`https://www.google.com/s2/favicons?domain=${src.domain}&sz=32`}
                alt="" width={14} height={14}
                style={{ borderRadius: 3, flexShrink: 0 }}
                onError={e => { e.target.style.display = 'none'; }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: 'var(--font-family)', fontSize: '0.82rem', fontWeight: 500,
                  color: 'var(--fg-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {src.title || src.domain}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.60rem', color: 'var(--fg-dim)' }}>
                  {src.domain}
                </div>
              </div>
              <QualityBadge url={src.url} />
              <ExternalLink size={11} color="var(--fg-dim)" style={{ flexShrink: 0 }} />
            </a>
          );
        })}
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */
export default function SourcesPage() {
  const navigate = useNavigate();
  const [dark] = useDarkMode();
  const [modal, setModal] = useState(null); // 'library' | 'map'
  const sources     = useMemo(() => getSourceLibrary(), []);
  const sourceCount = sources.length;
  const storyCount  = useMemo(() => loadStories().length, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: dark
        ? 'linear-gradient(158deg, #0d1117 0%, #131920 50%, #1c2333 100%)'
        : 'linear-gradient(158deg, #EDE8DF 0%, #E5DDD0 40%, #DDD5C0 75%, #E8E2D5 100%)',
      backgroundAttachment: 'fixed',
    }}>
      {/* Top bar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 24px', height: 48,
        background: dark ? 'rgba(13,17,23,0.88)' : 'rgba(237,232,223,0.88)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '4px 8px', borderRadius: 8,
            color: 'var(--fg-secondary)', fontFamily: 'var(--font-family)', fontSize: '0.78rem',
            transition: 'color 0.14s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--fg-primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--fg-secondary)'}
        >
          <ArrowLeft size={14} /> Back
        </button>
        <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
        <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.88rem', fontWeight: 600, color: 'var(--fg-primary)', flex: 1 }}>
          Sources
        </span>
        <NavControls />
      </div>

      {/* Main content */}
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '48px 24px 80px' }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', fontWeight: 600, color: 'var(--fg-primary)', marginBottom: 8 }}>
            Your Source Intelligence
          </h1>
          <p style={{ fontFamily: 'var(--font-family)', fontSize: '0.88rem', color: 'var(--fg-dim)', lineHeight: 1.6 }}>
            Every source used across your research, organised and mapped by topic.
          </p>
        </div>

        {/* Stats bar */}
        <StatsBar sources={sources} storyCount={storyCount} />

        {/* Recent sources inline preview */}
        <RecentSourcesPreview sources={sources} onOpenLibrary={() => setModal('library')} />

        {/* Feature cards */}
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <EntryCard
            icon={<BookMarked />}
            title="Source Library"
            subtitle="Browse, filter, and manage every source from your searches. Linked to the stories that cite them."
            stat={`${sourceCount} source${sourceCount !== 1 ? 's' : ''} · ${storyCount} stor${storyCount !== 1 ? 'ies' : 'y'}`}
            illustration={LibrarySVG}
            onClick={() => setModal('library')}
          />
          <EntryCard
            icon={<Network />}
            title="Topic Connection Map"
            subtitle="AI-generated graph of how your research topics interconnect. Click any node to see its sources."
            stat={sourceCount > 0 ? `${sourceCount} sources to map` : 'Add sources to generate map'}
            illustration={NetworkSVG}
            onClick={() => setModal('map')}
          />
        </div>
      </div>

      {modal === 'library' && <LibraryModal onClose={() => setModal(null)} />}
      {modal === 'map'     && <TopicMapModal onClose={() => setModal(null)} />}
    </div>
  );
}
