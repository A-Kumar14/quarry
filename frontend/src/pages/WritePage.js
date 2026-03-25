import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft, Upload, PanelRight, Download,
  Copy, Check, X, Search, FileText,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TIER_COLOR, LEAN_LABEL } from '../utils/sourceProfile';
import NavControls from '../components/NavControls';

const DOCUMENTS_KEY = 'quarry_documents';

function loadDocuments() {
  try {
    return JSON.parse(localStorage.getItem(DOCUMENTS_KEY) || '[]');
  } catch { return []; }
}

function saveDocument(doc) {
  try {
    const docs = loadDocuments();
    const idx = docs.findIndex(d => d.id === doc.id);
    if (idx >= 0) {
      docs[idx] = doc;
    } else {
      docs.unshift(doc);
    }
    localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(docs.slice(0, 50)));
  } catch {}
}

/* ── Shared button styles ─────────────────────────────────────────────────── */
const GLASS_BTN = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '5px 11px', borderRadius: 7, cursor: 'pointer', border: 'none',
  background: 'var(--gbtn-bg)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderTop: '1px solid var(--gbtn-border-t)',
  borderLeft: '1px solid var(--gbtn-border-l)',
  borderRight: '1px solid var(--gbtn-border-r)',
  borderBottom: '1px solid var(--gbtn-border-b)',
  boxShadow: 'var(--gbtn-shadow)',
  fontFamily: 'var(--font-family)', fontSize: '0.75rem', fontWeight: 400,
  color: 'var(--gbtn-color)', whiteSpace: 'nowrap',
  transition: 'all 0.14s ease',
};

const GLASS_BTN_ACTIVE = {
  ...GLASS_BTN,
  background: 'rgba(249,115,22,0.10)',
  borderTop: '1px solid rgba(249,115,22,0.35)',
  borderLeft: '1px solid rgba(249,115,22,0.25)',
  borderRight: '1px solid rgba(249,115,22,0.15)',
  borderBottom: '1px solid rgba(249,115,22,0.20)',
  color: 'var(--accent)',
};

const ORANGE_BTN = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '5px 11px', borderRadius: 7, cursor: 'pointer', border: 'none',
  background: 'var(--accent)', color: '#fff',
  fontFamily: 'var(--font-family)', fontSize: '0.75rem', fontWeight: 500,
  whiteSpace: 'nowrap', transition: 'opacity 0.14s',
};

const SECTION_LABEL = {
  fontFamily: 'var(--font-family)', fontSize: '0.58rem', fontWeight: 600,
  color: 'var(--fg-dim)', letterSpacing: '0.12em', textTransform: 'uppercase',
  marginBottom: 8, display: 'block',
};

/* ── Claim status → colour ────────────────────────────────────────────────── */
const STATUS_COLOR = {
  verified:      '#22c55e',
  corroborated:  '#eab308',
  single_source: '#f97316',
  uncertain:     '#f97316',
  contested:     '#ef4444',
};

const STATUS_ORDER = { verified: 0, corroborated: 1, single_source: 2, uncertain: 2, contested: 3 };

/* ── Domain helper ─────────────────────────────────────────────────────────── */
function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return url; }
}

/* ── Source drawer card ────────────────────────────────────────────────────── */
function DrawerSourceCard({ src }) {
  const tierColor = TIER_COLOR[src.credibility_tier] ?? '#9CA3AF';
  const displayName = src.outlet_name || getDomain(src.url);
  const isState =
    src.editorial_lean === 'state_aligned' || src.funding_type === 'state';
  const isIndependent =
    src.editorial_lean === 'independent' || src.editorial_lean === 'center';

  return (
    <div style={{
      background: 'var(--glass-bg)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '9px 10px',
      marginBottom: 5,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: tierColor, flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.67rem', fontWeight: 600, color: 'var(--fg-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayName}
        </span>
        {src.country && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: 'var(--fg-dim)', flexShrink: 0 }}>
            {src.country}
          </span>
        )}
      </div>

      <div style={{
        fontFamily: 'var(--font-family)', fontSize: '0.60rem', color: 'var(--fg-secondary)',
        lineHeight: 1.35, marginBottom: 5,
        overflow: 'hidden', display: '-webkit-box',
        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
      }}>
        {(src.title || src.url).slice(0, 55)}
      </div>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {isState ? (
          <span style={{ padding: '1px 6px', borderRadius: 3, background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)', fontFamily: 'var(--font-family)', fontSize: '0.55rem', color: '#dc2626' }}>
            ⚠ State-backed
          </span>
        ) : isIndependent ? (
          <span style={{ padding: '1px 6px', borderRadius: 3, background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.25)', fontFamily: 'var(--font-family)', fontSize: '0.55rem', color: '#16a34a' }}>
            ✓ Independent
          </span>
        ) : (
          <span style={{ padding: '1px 6px', borderRadius: 3, background: 'rgba(249,115,22,0.10)', border: '1px solid rgba(249,115,22,0.22)', fontFamily: 'var(--font-family)', fontSize: '0.55rem', color: 'var(--accent)' }}>
            {LEAN_LABEL[src.editorial_lean] || 'Unknown'}
          </span>
        )}
        {src.credibility_tier && (
          <span style={{ padding: '1px 6px', borderRadius: 3, background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: 'var(--fg-dim)' }}>
            Tier {src.credibility_tier}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Drawer claim row ─────────────────────────────────────────────────────── */
function DrawerClaimRow({ claim, onInsert }) {
  const color = STATUS_COLOR[claim.status] ?? '#9CA3AF';
  const outlets = (claim.source_outlets || []).slice(0, 2).join(' · ');
  return (
    <div
      onClick={() => onInsert(claim)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 7,
        padding: '7px 8px', borderRadius: 7, marginBottom: 5,
        border: '1px solid var(--border)',
        background: 'rgba(255,255,255,0.40)',
        cursor: 'pointer', transition: 'border-color 0.14s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
    >
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 3 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-family)', fontSize: '0.67rem', color: 'var(--fg-primary)',
          lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {claim.claim_text}
        </div>
        {outlets && (
          <div style={{ fontFamily: 'var(--font-family)', fontSize: '0.58rem', color: 'var(--fg-dim)', marginTop: 2 }}>
            {outlets}
          </div>
        )}
      </div>
      <button
        onClick={e => { e.stopPropagation(); onInsert(claim); }}
        style={{
          flexShrink: 0, padding: '2px 7px', borderRadius: 4,
          border: '1px solid rgba(249,115,22,0.35)',
          background: 'rgba(249,115,22,0.08)', cursor: 'pointer',
          fontFamily: 'var(--font-family)', fontSize: '0.60rem',
          color: 'var(--accent)', whiteSpace: 'nowrap',
        }}
      >
        Insert
      </button>
    </div>
  );
}

/* ── Citation picker overlay ─────────────────────────────────────────────── */
function CitationPicker({ claims, filter, setFilter, onInsert, onClose }) {
  const navigate = useNavigate();
  const filtered = claims.filter(c =>
    c.claim_text.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div style={{
      position: 'absolute', left: 60, top: 8, width: 420, zIndex: 100,
      background: 'var(--glass-bg)',
      backdropFilter: 'blur(28px) saturate(180%)',
      WebkitBackdropFilter: 'blur(28px) saturate(180%)',
      border: '1px solid var(--glass-border-t)',
      borderRadius: 10,
      boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px 8px', borderBottom: '1px solid var(--border)' }}>
        <FileText size={13} color="var(--accent)" />
        <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.75rem', fontWeight: 500, color: 'var(--fg-primary)', flex: 1 }}>
          Insert citation
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--fg-dim)', display: 'flex' }}>
          <X size={13} />
        </button>
      </div>

      <div style={{ padding: '8px 12px 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,252,240,0.70)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px' }}>
          <Search size={12} color="var(--fg-dim)" />
          <input
            autoFocus
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter claims..."
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-family)', fontSize: '0.80rem', color: 'var(--fg-primary)' }}
          />
        </div>
      </div>

      <div style={{ maxHeight: 280, overflowY: 'auto', padding: '4px 12px 10px' }}>
        {claims.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <p style={{ fontFamily: 'var(--font-family)', fontSize: '0.75rem', color: 'var(--fg-secondary)', marginBottom: 10 }}>
              No verified claims loaded.<br />Search for your story first.
            </p>
            <button
              onClick={() => navigate('/search')}
              style={{ ...GLASS_BTN, fontSize: '0.72rem' }}
            >
              <Search size={11} /> Search now →
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <p style={{ fontFamily: 'var(--font-family)', fontSize: '0.75rem', color: 'var(--fg-dim)', padding: '12px 0', textAlign: 'center' }}>
            No claims match your filter.
          </p>
        ) : (
          filtered.slice(0, 20).map((claim, i) => (
            <DrawerClaimRow key={i} claim={claim} onInsert={onInsert} />
          ))
        )}
      </div>
    </div>
  );
}

/* ── Story sidebar ────────────────────────────────────────────────────────── */
function StorySidebar({ open, onToggle, stories, currentDocId, onOpenStory, onNewStory }) {
  const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(midnight); yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const todayStories     = stories.filter(s => s.updatedAt >= midnight.getTime());
  const yesterdayStories = stories.filter(s => s.updatedAt >= yesterdayStart.getTime() && s.updatedAt < midnight.getTime());
  const earlierStories   = stories.filter(s => s.updatedAt < yesterdayStart.getTime());

  const groups = [
    { label: 'Today',     items: todayStories },
    { label: 'Yesterday', items: yesterdayStories },
    { label: 'Earlier',   items: earlierStories },
  ].filter(g => g.items.length > 0);

  return (
    <div style={{
      width: open ? 200 : 0,
      flexShrink: 0,
      transition: 'width 0.2s ease',
      overflow: 'hidden',
      position: 'relative',
      borderRight: open ? '1px solid var(--border)' : 'none',
      background: 'rgba(237,232,223,0.6)',
    }}>
      {/* Sidebar content — hidden by overflow when closed */}
      <div style={{ width: 200, height: '100%', display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '12px 10px' }}>

        {/* + New story */}
        <button
          onClick={onNewStory}
          style={{
            ...ORANGE_BTN,
            width: '100%', justifyContent: 'center',
            fontSize: '0.72rem', marginBottom: 14, borderRadius: 7,
          }}
        >
          + New story
        </button>

        {/* Stories list */}
        <span style={{ ...SECTION_LABEL, marginBottom: 10 }}>Stories</span>

        {stories.length === 0 && (
          <p style={{ fontFamily: 'var(--font-family)', fontSize: '0.70rem', color: 'var(--fg-dim)', lineHeight: 1.5 }}>
            No stories yet.<br />Start writing to save one.
          </p>
        )}

        {groups.map(({ label, items }) => (
          <div key={label} style={{ marginBottom: 12 }}>
            <div style={{
              fontFamily: 'var(--font-family)', fontSize: '0.55rem', fontWeight: 600,
              color: 'var(--fg-dim)', letterSpacing: '0.10em', textTransform: 'uppercase',
              marginBottom: 4, paddingLeft: 4,
            }}>
              {label}
            </div>
            {items.map(story => {
              const isActive = story.id === currentDocId;
              return (
                <div
                  key={story.id}
                  onClick={() => onOpenStory(story)}
                  style={{
                    padding: '5px 7px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    marginBottom: 2,
                    border: isActive ? '1px solid rgba(249,115,22,0.2)' : '1px solid transparent',
                    background: isActive ? 'rgba(249,115,22,0.08)' : 'transparent',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{
                    fontFamily: 'var(--font-serif)', fontSize: '0.72rem',
                    color: 'var(--fg-primary)', lineHeight: 1.3,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {story.title || 'Untitled story'}
                  </div>
                  <div style={{ fontFamily: 'var(--font-family)', fontSize: '0.58rem', color: 'var(--fg-dim)', marginTop: 2 }}>
                    {story.wordCount || 0}w
                    {story.sourceCount > 0 ? ` · ${story.sourceCount} src` : ''}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Toggle button — hangs off right edge */}
      <button
        onClick={onToggle}
        style={{
          position: 'absolute', right: -12, top: '50%',
          transform: 'translateY(-50%)',
          width: 24, height: 24, borderRadius: '50%',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10,
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        }}
      >
        {open
          ? <ChevronLeft size={12} color="var(--fg-dim)" />
          : <ChevronRight size={12} color="var(--fg-dim)" />
        }
      </button>
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────────────────────── */
export default function WritePage() {
  const [title,               setTitle]               = useState('');
  const [content,             setContent]             = useState('');
  const [drawerOpen,          setDrawerOpen]          = useState(false);
  const [sidebarOpen,         setSidebarOpen]         = useState(
    typeof window !== 'undefined' && window.innerWidth >= 1024
  );
  const [allStories,          setAllStories]          = useState([]);
  const [sessionSources,      setSessionSources]      = useState([]);
  const [sessionClaims,       setSessionClaims]       = useState([]);
  const [pipelineTrace,       setPipelineTrace]       = useState(null);
  const [citationPickerOpen,  setCitationPickerOpen]  = useState(false);
  const [citationFilter,      setCitationFilter]      = useState('');
  const [copied,              setCopied]              = useState(false);
  const [unsourcedCount,      setUnsourcedCount]      = useState(0);

  const editorRef    = useRef(null);
  const fileInputRef = useRef(null);
  const navigate     = useNavigate();
  const docIdRef     = useRef(
    Date.now().toString(36) + Math.random().toString(36).slice(2)
  );

  /* ── Load session data on mount ── */
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('quarry_write_session');
      if (raw) {
        const session = JSON.parse(raw);
        if (session.sources?.length)  setSessionSources(session.sources);
        if (session.claims?.length)   setSessionClaims(session.claims);
        if (session.pipelineTrace)    setPipelineTrace(session.pipelineTrace);
        if (session.query)            setTitle(session.query);
        if (session.content)          setContent(session.content);
        if (session.docId)            docIdRef.current = session.docId;
      }
    } catch {}
  }, []);

  /* ── Load all stories on mount ── */
  useEffect(() => {
    try {
      const docs = JSON.parse(localStorage.getItem(DOCUMENTS_KEY) || '[]');
      setAllStories(docs);
    } catch { setAllStories([]); }
  }, []);

  /* ── Listen for storage changes (new saves from same session) ── */
  useEffect(() => {
    const handler = () => {
      try {
        const docs = JSON.parse(localStorage.getItem(DOCUMENTS_KEY) || '[]');
        setAllStories(docs);
      } catch {}
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  /* ── Auto-save ── */
  useEffect(() => {
    if (!title && !content) return;
    const doc = {
      id: docIdRef.current,
      title: title || 'Untitled story',
      content,
      updatedAt: Date.now(),
      wordCount: content.split(/\s+/).filter(Boolean).length,
      sourceCount: sessionSources.length,
      query: title,
    };
    saveDocument(doc);
    // Reflect save in sidebar immediately (same tab)
    setAllStories(loadDocuments());
  }, [title, content]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Handlers ── */
  const detectUnsourced = useCallback((text) => {
    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .filter(s => s.trim().length > 50);
    const unsourced = sentences.filter(s => {
      const hasCitation = s.includes('[') ||
        s.includes('(Source') ||
        s.includes('http');
      const isFactual = /\d|said|reported|claimed|according|stated|confirmed|denied|announced/i.test(s);
      return isFactual && !hasCitation;
    });
    setUnsourcedCount(unsourced.length);
  }, []);

  const handleEditorKeyDown = useCallback((e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setCitationPickerOpen(true);
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      setDrawerOpen(o => !o);
    }
  }, []);

  const handleInsertCitation = useCallback((claim) => {
    const citation =
      '\n[' + (claim.source_outlets?.[0] || 'Source') + '] ' + claim.claim_text + '\n';
    setContent(prev => prev + citation);
    setCitationPickerOpen(false);
    setCitationFilter('');
    setTimeout(() => editorRef.current?.focus(), 50);
  }, []);

  const handleFileImport = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''));
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      setContent(text);
      detectUnsourced(text);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [title, detectUnsourced]);

  const handleExportMarkdown = useCallback(() => {
    const filename = (title || 'quarry-story').replace(/\s+/g, '-').toLowerCase();
    const blob = new Blob(
      ['# ' + (title || 'Untitled') + '\n\n' + content],
      { type: 'text/markdown' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename + '.md';
    a.click();
    URL.revokeObjectURL(url);
  }, [title, content]);

  const handleCopyWithCitations = useCallback((_format) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [content]);

  const handleOpenStory = useCallback((story) => {
    sessionStorage.setItem('quarry_write_session', JSON.stringify({
      query: story.title,
      content: story.content,
      docId: story.id,
    }));
    window.location.reload();
  }, []);

  const handleNewStory = useCallback(() => {
    sessionStorage.removeItem('quarry_write_session');
    window.location.reload();
  }, []);

  /* ── Sorted claims for drawer ── */
  const sortedClaims = [...sessionClaims].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 2) - (STATUS_ORDER[b.status] ?? 2)
  ).slice(0, 8);

  /* ── Confidence score ── */
  const citedCount      = (content.match(/\[/g) || []).length;
  const totalSentences  = content.split(/[.!?]+/).filter(s => s.trim().length > 40).length || 1;
  const confidenceScore = Math.min(100, Math.round((citedCount / totalSentences) * 100));

  /* ── Date string ── */
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  /* ── Render ── */
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', overflow: 'hidden' }}>

      {/* ── TOPBAR ── */}
      <div style={{
        height: 44, flexShrink: 0,
        background: 'rgba(237,232,223,0.88)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderBottom: '1px solid var(--border)',
        padding: '0 20px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        {/* Back */}
        <button onClick={() => navigate('/')} style={{ ...GLASS_BTN, gap: 5 }}>
          <ArrowLeft size={14} /> Back
        </button>

        <div style={{ width: 1, height: 16, background: 'var(--border)' }} />

        {/* Artifacts link */}
        <button
          title="Your stories"
          onClick={() => navigate('/artifacts')}
          style={{ ...GLASS_BTN, padding: '5px 8px' }}
        >
          <FileText size={14} />
        </button>

        {/* Title reference */}
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Untitled story"
          style={{
            background: 'transparent', border: 'none', outline: 'none',
            fontFamily: 'var(--font-serif)', fontSize: '0.95rem',
            color: 'var(--fg-primary)', minWidth: 200, maxWidth: 400,
          }}
        />

        {/* Right group */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 7 }}>
          <button style={GLASS_BTN} onClick={() => fileInputRef.current?.click()}>
            <Upload size={13} /> Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.docx"
            style={{ display: 'none' }}
            onChange={handleFileImport}
          />

          <button
            style={drawerOpen ? GLASS_BTN_ACTIVE : GLASS_BTN}
            onClick={() => setDrawerOpen(o => !o)}
          >
            <PanelRight size={13} /> Sources
          </button>

          <button style={ORANGE_BTN} onClick={handleExportMarkdown}>
            <Download size={13} /> Export
          </button>

          <NavControls />
        </div>
      </div>

      {/* ── BODY: sidebar | editor | drawer ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>

        {/* ── LEFT: story sidebar ── */}
        <StorySidebar
          open={sidebarOpen}
          onToggle={() => setSidebarOpen(o => !o)}
          stories={allStories}
          currentDocId={docIdRef.current}
          onOpenStory={handleOpenStory}
          onNewStory={handleNewStory}
        />

        {/* ── CENTER: editor ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', borderRight: drawerOpen ? '1px solid var(--border)' : 'none' }}>

          {/* Editor toolbar */}
          <div style={{
            height: 38, flexShrink: 0,
            background: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border)',
            padding: '0 20px',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            {['B', 'I', 'H1', 'H2'].map(label => (
              <button
                key={label}
                style={{
                  ...GLASS_BTN,
                  padding: '3px 7px', borderRadius: 5,
                  fontSize: '0.70rem',
                  fontWeight: label === 'B' ? 600 : 400,
                  fontStyle: label === 'I' ? 'italic' : 'normal',
                }}
              >
                {label}
              </button>
            ))}

            <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 4px' }} />

            <button
              title="Insert citation from verified sources"
              onClick={() => setCitationPickerOpen(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 10px', borderRadius: 5, cursor: 'pointer',
                border: '1px solid rgba(249,115,22,0.30)',
                background: 'rgba(249,115,22,0.10)',
                color: 'var(--accent)',
                fontFamily: 'var(--font-family)', fontSize: '0.70rem',
              }}
            >
              ⌘K Cite
            </button>

            <button
              style={{ ...GLASS_BTN, padding: '3px 8px', fontSize: '0.70rem' }}
              onClick={() => setDrawerOpen(o => !o)}
            >
              ⌘S Sources
            </button>

            <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 4px' }} />

            {['APA', 'MLA'].map(fmt => (
              <button
                key={fmt}
                style={{ ...GLASS_BTN, padding: '3px 8px', fontSize: '0.70rem' }}
                onClick={() => handleCopyWithCitations(fmt.toLowerCase())}
              >
                {fmt}
              </button>
            ))}

            {unsourcedCount > 0 && (
              <div style={{
                marginLeft: 'auto',
                padding: '2px 8px', borderRadius: 4,
                background: 'rgba(234,179,8,0.10)',
                border: '1px solid rgba(234,179,8,0.30)',
                fontFamily: 'var(--font-family)', fontSize: '0.65rem',
                color: '#a16207',
              }}>
                ⚠ {unsourcedCount} unsourced
              </div>
            )}
          </div>

          {/* Editor area — document container */}
          <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
            <div style={{ maxWidth: 680, margin: '0 auto', padding: '48px 48px' }}>

              {/* Document title */}
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Untitled story"
                style={{
                  display: 'block', width: '100%',
                  background: 'transparent', border: 'none', outline: 'none',
                  fontFamily: 'var(--font-serif)', fontSize: '2.2rem', fontWeight: 400,
                  color: 'var(--fg-primary)', letterSpacing: '-0.01em',
                  lineHeight: 1.2, marginBottom: 8, padding: 0,
                }}
              />

              {/* Subtitle: source count + date */}
              {sessionSources.length > 0 && (
                <div style={{
                  fontFamily: 'var(--font-family)', fontSize: '0.78rem',
                  fontStyle: 'italic', color: 'var(--fg-dim)',
                  marginBottom: 20,
                }}>
                  {sessionSources.length} source{sessionSources.length !== 1 ? 's' : ''} · {dateStr}
                </div>
              )}

              {/* Confidence bar */}
              {sessionClaims.length > 0 && (
                <div style={{
                  display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10,
                  background: 'rgba(255,255,255,0.45)',
                  border: '1px solid var(--border)',
                  borderRadius: 7, padding: '6px 10px',
                  marginBottom: 24,
                }}>
                  <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.57rem', color: 'var(--fg-dim)', fontWeight: 500 }}>
                    Confidence:
                  </span>
                  {[
                    { label: 'Verified',      color: '#22c55e' },
                    { label: 'Corroborated',  color: '#eab308' },
                    { label: 'Single source', color: '#f97316' },
                    { label: 'Contested',     color: '#ef4444' },
                  ].map(({ label, color }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                      <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.62rem', color: 'var(--fg-secondary)' }}>
                        {label}
                      </span>
                    </div>
                  ))}
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 60, height: 4, borderRadius: 2,
                      background: 'rgba(0,0,0,0.08)', overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${confidenceScore}%`, height: '100%',
                        background: '#22c55e', borderRadius: 2,
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                    <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.62rem', color: 'var(--fg-dim)' }}>
                      {confidenceScore}% sourced
                    </span>
                  </div>
                </div>
              )}

              {/* Textarea */}
              <textarea
                ref={editorRef}
                value={content}
                onChange={e => { setContent(e.target.value); detectUnsourced(e.target.value); }}
                onKeyDown={handleEditorKeyDown}
                placeholder={'Start writing your story...\n\nPress ⌘K to insert a verified citation.'}
                style={{
                  display: 'block', width: '100%',
                  minHeight: 'calc(100vh - 280px)',
                  background: 'transparent', border: 'none', outline: 'none', resize: 'none',
                  fontFamily: 'var(--font-serif)', fontSize: '1rem',
                  color: 'var(--fg-primary)', lineHeight: 1.85,
                  padding: 0,
                }}
              />

              {/* Citation picker overlay */}
              {citationPickerOpen && (
                <CitationPicker
                  claims={sessionClaims}
                  filter={citationFilter}
                  setFilter={setCitationFilter}
                  onInsert={handleInsertCitation}
                  onClose={() => { setCitationPickerOpen(false); setCitationFilter(''); }}
                />
              )}
            </div>
          </div>

          {/* Floating drawer toggle — shown when drawer is closed */}
          {!drawerOpen && (
            <button
              onClick={() => setDrawerOpen(true)}
              style={{
                position: 'fixed', right: 16, top: '50%',
                transform: 'translateY(-50%)',
                width: 32, height: 64,
                background: 'rgba(255,255,255,0.7)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 3,
                zIndex: 20,
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}
            >
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--fg-dim)' }} />
              ))}
            </button>
          )}
        </div>

        {/* ── RIGHT: source drawer ── */}
        <div style={{
          width: drawerOpen ? 300 : 0,
          flexShrink: 0,
          transition: 'width 0.2s ease',
          overflow: 'hidden',
          background: 'var(--bg-secondary)',
        }}>
          <div style={{ width: 300, height: '100%', display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '14px 12px' }}>

            {/* Section 1: Pipeline stats */}
            {pipelineTrace && (
              <div style={{ marginBottom: 16 }}>
                <span style={SECTION_LABEL}>Research pipeline</span>
                <div style={{
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 9, padding: '10px 12px',
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
                }}>
                  {[
                    { label: 'sources',   value: pipelineTrace.sources_retrieved ?? 0, color: null },
                    { label: 'claims',    value: pipelineTrace.claims_extracted  ?? 0, color: null },
                    { label: 'verified',  value: pipelineTrace.claims_verified   ?? 0, color: '#22c55e' },
                    { label: 'contested', value: pipelineTrace.claims_contested  ?? 0, color: '#ef4444' },
                  ].map(({ label, value, color }) => (
                    <div key={label}>
                      <div style={{ fontFamily: 'var(--font-family)', fontSize: '1rem', fontWeight: 600, color: color ?? 'var(--fg-primary)', lineHeight: 1 }}>
                        {value}
                      </div>
                      <div style={{ fontFamily: 'var(--font-family)', fontSize: '0.58rem', color: 'var(--fg-dim)', marginTop: 2 }}>
                        {label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section 2: Sources */}
            <div style={{ marginBottom: 16 }}>
              <span style={SECTION_LABEL}>Sources</span>
              {sessionSources.length === 0 ? (
                <div style={{
                  background: 'var(--glass-bg)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: 14, textAlign: 'center',
                }}>
                  <p style={{ fontFamily: 'var(--font-family)', fontSize: '0.75rem', color: 'var(--fg-secondary)', marginBottom: 8 }}>
                    No sources loaded yet.
                  </p>
                  <button
                    onClick={() => navigate('/search')}
                    style={{
                      padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
                      border: '1px solid var(--accent)', background: 'transparent',
                      fontFamily: 'var(--font-family)', fontSize: '0.70rem',
                      color: 'var(--accent)',
                    }}
                  >
                    Search for your story
                  </button>
                </div>
              ) : (
                sessionSources.slice(0, 6).map((src, i) => (
                  <DrawerSourceCard key={i} src={src} />
                ))
              )}
            </div>

            {/* Section 3: Verified claims */}
            <div style={{ marginBottom: 16 }}>
              <span style={SECTION_LABEL}>Verified claims — click to insert</span>
              {sessionClaims.length === 0 ? (
                <p style={{ fontFamily: 'var(--font-family)', fontSize: '0.72rem', color: 'var(--fg-dim)', padding: '8px 0' }}>
                  Claims will appear after searching.
                </p>
              ) : (
                sortedClaims.map((claim, i) => (
                  <DrawerClaimRow key={i} claim={claim} onInsert={handleInsertCitation} />
                ))
              )}
            </div>

            {/* Section 4: Export */}
            <div>
              <span style={SECTION_LABEL}>Export</span>
              <div style={{ display: 'flex', gap: 5, marginBottom: 5 }}>
                <button style={{ ...GLASS_BTN, flex: 1, justifyContent: 'center', fontSize: '0.68rem', borderRadius: 6 }} onClick={handleExportMarkdown}>
                  .docx
                </button>
                <button style={{ ...GLASS_BTN, flex: 1, justifyContent: 'center', fontSize: '0.68rem', borderRadius: 6 }} onClick={handleExportMarkdown}>
                  Markdown
                </button>
                <button
                  style={{ ...GLASS_BTN, flex: 1, justifyContent: 'center', fontSize: '0.68rem', borderRadius: 6 }}
                  onClick={() => handleCopyWithCitations('plain')}
                >
                  {copied ? <Check size={11} color="#22c55e" /> : <Copy size={11} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div style={{ display: 'flex', gap: 5 }}>
                <button style={{ ...GLASS_BTN, flex: 1, justifyContent: 'center', fontSize: '0.68rem', borderRadius: 6 }} onClick={() => handleCopyWithCitations('apa')}>
                  APA
                </button>
                <button style={{ ...GLASS_BTN, flex: 1, justifyContent: 'center', fontSize: '0.68rem', borderRadius: 6 }} onClick={() => handleCopyWithCitations('mla')}>
                  MLA
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
