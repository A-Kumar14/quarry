import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft, Upload, PanelRight, Download,
  Copy, Check, X, Search, FileText,
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
      {/* Row 1: tier dot + outlet name + country */}
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

      {/* Row 2: title */}
      <div style={{
        fontFamily: 'var(--font-family)', fontSize: '0.60rem', color: 'var(--fg-secondary)',
        lineHeight: 1.35, marginBottom: 5,
        overflow: 'hidden', display: '-webkit-box',
        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
      }}>
        {(src.title || src.url).slice(0, 55)}
      </div>

      {/* Row 3: badges */}
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
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px 8px', borderBottom: '1px solid var(--border)' }}>
        <FileText size={13} color="var(--accent)" />
        <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.75rem', fontWeight: 500, color: 'var(--fg-primary)', flex: 1 }}>
          Insert citation
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--fg-dim)', display: 'flex' }}>
          <X size={13} />
        </button>
      </div>

      {/* Filter input */}
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

      {/* Claims list */}
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

/* ── Main page ────────────────────────────────────────────────────────────── */
export default function WritePage() {
  const [title,               setTitle]               = useState('');
  const [content,             setContent]             = useState('');
  const [drawerOpen,          setDrawerOpen]          = useState(true);
  const [sessionSources,      setSessionSources]      = useState([]);
  const [sessionClaims,       setSessionClaims]       = useState([]);
  const [pipelineTrace,       setPipelineTrace]       = useState(null);
  const [citationPickerOpen,  setCitationPickerOpen]  = useState(false);
  const [citationFilter,      setCitationFilter]      = useState('');
  const [copied,              setCopied]              = useState(false);
  const [unsourcedCount,      setUnsourcedCount]      = useState(0);

  const editorRef   = useRef(null);
  const fileInputRef = useRef(null);
  const navigate    = useNavigate();
  const docIdRef = useRef(
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
  }, [title, content]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Handlers ── */
  const detectUnsourced = useCallback((text) => {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 60);
    const unsourced = sentences.filter(s =>
      !s.includes('[') && !s.includes('http') && !s.includes('(Source')
    );
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

  /* ── Sorted claims for drawer ── */
  const sortedClaims = [...sessionClaims].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 2) - (STATUS_ORDER[b.status] ?? 2)
  ).slice(0, 8);

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
        <button
          onClick={() => navigate('/')}
          style={{ ...GLASS_BTN, gap: 5 }}
        >
          <ArrowLeft size={14} /> Back
        </button>

        {/* Separator */}
        <div style={{ width: 1, height: 16, background: 'var(--border)' }} />

        {/* Artifacts link */}
        <button
          title="Your stories"
          onClick={() => navigate('/artifacts')}
          style={{ ...GLASS_BTN, padding: '5px 8px' }}
        >
          <FileText size={14} />
        </button>

        {/* Title input */}
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
          {/* Import */}
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

          {/* Sources toggle */}
          <button
            style={drawerOpen ? GLASS_BTN_ACTIVE : GLASS_BTN}
            onClick={() => setDrawerOpen(o => !o)}
          >
            <PanelRight size={13} /> Sources
          </button>

          {/* Export */}
          <button style={ORANGE_BTN} onClick={handleExportMarkdown}>
            <Download size={13} /> Export
          </button>

          <NavControls />
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: drawerOpen ? '1fr 300px' : '1fr 0px',
        transition: 'grid-template-columns 0.2s ease',
        overflow: 'hidden',
      }}>

        {/* ── LEFT: editor ── */}
        <div style={{
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          borderRight: drawerOpen ? '1px solid var(--border)' : 'none',
        }}>

          {/* Editor toolbar */}
          <div style={{
            height: 38, flexShrink: 0,
            background: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border)',
            padding: '0 20px',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            {/* Format buttons — visual only in V1 */}
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

            {/* Separator */}
            <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 4px' }} />

            {/* ⌘K Cite */}
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

            {/* ⌘S Sources */}
            <button
              style={{ ...GLASS_BTN, padding: '3px 8px', fontSize: '0.70rem' }}
              onClick={() => setDrawerOpen(o => !o)}
            >
              ⌘S Sources
            </button>

            {/* Separator */}
            <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 4px' }} />

            {/* APA / MLA */}
            {['APA', 'MLA'].map(fmt => (
              <button
                key={fmt}
                style={{ ...GLASS_BTN, padding: '3px 8px', fontSize: '0.70rem' }}
                onClick={() => handleCopyWithCitations(fmt.toLowerCase())}
              >
                {fmt}
              </button>
            ))}

            {/* Unsourced warning */}
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

          {/* Editor area */}
          <div style={{ flex: 1, overflowY: 'auto', position: 'relative', padding: '40px 60px' }}>
            <textarea
              ref={editorRef}
              value={content}
              onChange={e => { setContent(e.target.value); detectUnsourced(e.target.value); }}
              onKeyDown={handleEditorKeyDown}
              placeholder={'Start writing your story...\n\nPress ⌘K to insert a citation from your verified sources.'}
              style={{
                width: '100%',
                minHeight: 'calc(100vh - 160px)',
                background: 'transparent', border: 'none', outline: 'none', resize: 'none',
                fontFamily: 'var(--font-serif)', fontSize: '1rem',
                color: 'var(--fg-primary)', lineHeight: 1.85,
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

        {/* ── RIGHT: source drawer ── */}
        <div style={{
          display: drawerOpen ? 'flex' : 'none',
          flexDirection: 'column',
          overflowY: 'auto',
          padding: '14px 12px',
          background: 'var(--bg-secondary)',
          width: 300,
        }}>

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
              {/* TODO: proper docx export */}
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
  );
}
