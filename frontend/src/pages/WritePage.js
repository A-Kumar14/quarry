import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
  ArrowLeft, Upload, PanelRight, Download,
  Copy, Check, X, Search, FileText, Maximize2,
  ChevronLeft, ChevronRight, FilePlus, Loader2, Sparkles
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDarkMode } from '../DarkModeContext';
import { TIER_COLOR, LEAN_LABEL } from '../utils/sourceProfile';
import NavControls from '../components/NavControls';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const DOCUMENTS_KEY = 'quarry_documents';
const STORY_DATA_KEY = 'quarry_story_data'; // per-doc sources + summaries

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

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function applyInlineMarkdown(str) {
  return escapeHtml(str)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

function contentToHtml(text) {
  if (!text) return '';
  const lines = text.split('\n');
  let html = '';
  let inUl = false;
  let inOl = false;
  for (const line of lines) {
    if (line.startsWith('### ')) {
      if (inUl) { html += '</ul>'; inUl = false; }
      if (inOl) { html += '</ol>'; inOl = false; }
      html += `<h3>${escapeHtml(line.slice(4))}</h3>`;
    } else if (line.startsWith('## ')) {
      if (inUl) { html += '</ul>'; inUl = false; }
      if (inOl) { html += '</ol>'; inOl = false; }
      html += `<h2>${escapeHtml(line.slice(3))}</h2>`;
    } else if (line.startsWith('# ')) {
      if (inUl) { html += '</ul>'; inUl = false; }
      if (inOl) { html += '</ol>'; inOl = false; }
      html += `<h1>${escapeHtml(line.slice(2))}</h1>`;
    } else if (line.startsWith('> ')) {
      if (inUl) { html += '</ul>'; inUl = false; }
      if (inOl) { html += '</ol>'; inOl = false; }
      html += `<blockquote>${escapeHtml(line.slice(2))}</blockquote>`;
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      if (inOl) { html += '</ol>'; inOl = false; }
      if (!inUl) { html += '<ul>'; inUl = true; }
      html += `<li>${applyInlineMarkdown(line.slice(2))}</li>`;
    } else if (/^\d+\.\s/.test(line)) {
      if (inUl) { html += '</ul>'; inUl = false; }
      if (!inOl) { html += '<ol>'; inOl = true; }
      html += `<li>${applyInlineMarkdown(line.replace(/^\d+\.\s/, ''))}</li>`;
    } else if (line.trim() === '') {
      if (inUl) { html += '</ul>'; inUl = false; }
      if (inOl) { html += '</ol>'; inOl = false; }
      html += '<p><br></p>';
    } else {
      if (inUl) { html += '</ul>'; inUl = false; }
      if (inOl) { html += '</ol>'; inOl = false; }
      html += `<p>${applyInlineMarkdown(line)}</p>`;
    }
  }
  if (inUl) html += '</ul>';
  if (inOl) html += '</ol>';
  return html;
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


const FORMATS = [
  {
    id: 'analytical',
    name: 'The Academic/Analytical',
    alias: 'The "Exegesis"',
    description: 'Best for deep-dive research papers or theological/philosophical analysis.',
    components: ['Introduction', 'Thesis Statement', 'Exegesis (Critical Interpretation)', 'Synthesis', 'Conclusion'],
    useCase: 'When you need to break down a specific text, law, or complex data set line-by-line.'
  },
  {
    id: 'investigative',
    name: 'The Investigative Feature',
    alias: 'The "Nut Graph"',
    description: 'The gold standard for high-end journalism like The New Yorker or The Atlantic.',
    components: ['Anecdotal Lead (The "Hook")', 'Nut Graph (The "Why this matters" core)', 'Contextual Background', 'Evidence/Data', 'The Turn (Counter-arguments)', 'Resolution'],
    useCase: 'Long-form stories where you need to balance human interest with hard data.'
  },
  {
    id: 'oped',
    name: 'The Op-Ed',
    alias: 'The "Persuasion"',
    description: 'Designed for opinion pieces or policy recommendations.',
    components: ['Lede (The Problem)', 'The Thesis (The Argument)', 'Supporting Evidence (Point 1, 2, 3)', 'The Rebuttal (Addressing critics)', 'Call to Action'],
    useCase: 'When you are taking a stand on the research you\'ve gathered.'
  },
  {
    id: 'intelligence',
    name: 'The Intelligence Brief',
    alias: 'The "BLUF"',
    description: 'Military and corporate style for rapid decision-making.',
    components: ['BLUF (Bottom Line Up Front)', 'Key Findings', 'Supporting Analysis', 'Strategic Implications', 'Next Steps'],
    useCase: 'When the reader is an executive who needs the answer in the first 5 seconds.'
  },
  {
    id: 'scientific',
    name: 'The Scientific IMRAD',
    alias: 'The universal standard',
    description: 'The universal standard for technical and medical research.',
    components: ['Introduction', 'Methods (How it was researched)', 'Results (What was found)', 'And', 'Discussion (What it means)'],
    useCase: 'When the credibility of the research process is just as important as the conclusion.'
  }
];

/* ── Domain helper ─────────────────────────────────────────────────────────── */
function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return url; }
}


/* ── Confidence tier label ────────────────────────────────────────────────── */
const TIER_LABEL = { 1: 'High', 2: 'Medium', 3: 'Low' };

/* ── Research source pill ─────────────────────────────────────────────────── */
function ResearchSourcePill({ src }) {
  const [imgError, setImgError] = React.useState(false);

  const onDragStart = (e) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'source', data: src }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const domain = getDomain(src.url);
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  const tierColor = TIER_COLOR[src.credibility_tier] || '#94a3b8';
  const tierLabel = TIER_LABEL[src.credibility_tier] || '?';
  const isState = src.editorial_lean === 'state_aligned' || src.funding_type === 'state';
  const leanLabel = LEAN_LABEL[src.editorial_lean];

  const badgeStyle = isState
    ? { bg: 'rgba(239,68,68,0.10)', color: '#dc2626', border: 'rgba(239,68,68,0.25)' }
    : src.editorial_lean === 'left'
    ? { bg: 'rgba(59,130,246,0.10)', color: '#2563eb', border: 'rgba(59,130,246,0.25)' }
    : src.editorial_lean === 'right'
    ? { bg: 'rgba(249,115,22,0.10)', color: '#c2540a', border: 'rgba(249,115,22,0.25)' }
    : src.editorial_lean === 'center' || src.editorial_lean === 'independent'
    ? { bg: 'rgba(34,197,94,0.10)', color: '#15803d', border: 'rgba(34,197,94,0.25)' }
    : null;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      title={`${src.title || domain}\nDrag to document → inserts citation\nDrag to tray below → generates AI summary`}
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '8px 10px', borderRadius: 9,
        background: 'var(--bg-primary)', border: `1px solid ${tierColor}45`,
        cursor: 'grab', marginBottom: 6, width: '100%',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        transition: 'border-color 0.14s, box-shadow 0.14s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = tierColor; e.currentTarget.style.boxShadow = `0 2px 10px ${tierColor}25`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = `${tierColor}45`; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; }}
    >
      {/* Favicon / domain image */}
      <div style={{
        width: 28, height: 28, borderRadius: 6, flexShrink: 0,
        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {!imgError ? (
          <img
            src={faviconUrl}
            alt={domain}
            onError={() => setImgError(true)}
            style={{ width: 20, height: 20, objectFit: 'contain' }}
          />
        ) : (
          <span style={{ fontSize: '0.60rem', color: 'var(--fg-dim)', fontWeight: 600 }}>
            {domain.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>

      {/* Text content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--fg-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500, lineHeight: 1.3 }}>
          {src.outlet_name || domain}
        </div>
        <div style={{ fontSize: '0.60rem', color: 'var(--fg-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2, lineHeight: 1.3 }}>
          {src.title || src.snippet?.slice(0, 60) || src.url}
        </div>
      </div>

      {/* Right column: confidence + lean */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
        {/* Confidence tier */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: tierColor }} />
          <span style={{ fontSize: '0.55rem', color: tierColor, fontWeight: 600 }}>{tierLabel}</span>
        </div>
        {/* Lean badge */}
        {badgeStyle && leanLabel && (
          <span style={{
            fontSize: '0.50rem', padding: '1px 4px', borderRadius: 3,
            background: badgeStyle.bg, color: badgeStyle.color,
            border: `1px solid ${badgeStyle.border}`, whiteSpace: 'nowrap', lineHeight: 1.4,
          }}>
            {leanLabel}
          </span>
        )}
      </div>
    </div>
  );
}

function AIParagraphCard({ url, summaryObj, onUpdate, onRemove }) {
  const isLoading = summaryObj?.loading;
  const text = summaryObj?.text || '';

  const onDragStart = (e) => {
    if (isLoading) { e.preventDefault(); return; }
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'summary', text }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div
      draggable={!isLoading}
      onDragStart={onDragStart}
      style={{
        background: 'var(--bg-primary)', border: '1px solid var(--border)',
        borderRadius: 8, padding: 12, marginBottom: 10,
        cursor: isLoading ? 'default' : 'grab',
        boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {isLoading && (
            <Loader2 size={10} color="var(--accent)" className="spin" />
          )}
          <span style={{ fontSize: '0.6rem', color: 'var(--fg-dim)', fontWeight: 600, textTransform: 'uppercase' }}>
            {isLoading ? 'Summarizing…' : 'AI Summary'}
          </span>
        </div>
        <button onClick={() => onRemove(url)} style={{ background: 'none', border: 'none', color: 'var(--fg-dim)', cursor: 'pointer', padding: 0 }}>
          <X size={12} />
        </button>
      </div>
      {isLoading ? (
        <div style={{ height: 48, background: 'var(--bg-secondary)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} />
      ) : (
        <textarea
          value={text}
          onChange={(e) => onUpdate(url, e.target.value)}
          style={{
            width: '100%', minHeight: 60, background: 'transparent',
            border: 'none', outline: 'none', resize: 'none',
            fontFamily: 'var(--font-family)', fontSize: '0.75rem',
            lineHeight: 1.5, color: 'var(--fg-secondary)',
            padding: 0,
          }}
        />
      )}
      {!isLoading && (
        <div style={{ marginTop: 4, textAlign: 'right', fontSize: '0.6rem', color: 'var(--fg-dim)' }}>
          ↕ drag to document
        </div>
      )}
    </div>
  );
}

function DrawerClaimRow({ claim, onInsert }) {
  const [dark] = useDarkMode();
  const color = STATUS_COLOR[claim.status] ?? '#9CA3AF';
  const outlets = (claim.source_outlets || []).slice(0, 2).join(' · ');
  return (
    <div
      onClick={() => onInsert(claim)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 7,
        padding: '7px 8px', borderRadius: 7, marginBottom: 5,
        border: '1px solid var(--border)',
        background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.40)',
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
  const [dark] = useDarkMode();
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,252,240,0.70)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px' }}>
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

/* ── AI Formatter popup ──────────────────────────────────────────────────── */
function AIFormatterPopup({ onApply, onClose }) {
  return (
    <div style={{
      position: 'fixed', right: 310, bottom: 120, width: 440, zIndex: 100,
      background: 'var(--glass-bg)',
      backdropFilter: 'blur(30px) saturate(160%)',
      WebkitBackdropFilter: 'blur(30px) saturate(160%)',
      border: '1px solid var(--glass-border-t)',
      borderRadius: 12,
      boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
      animation: 'fadeInUp 0.25s ease-out',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <Sparkles size={14} color="var(--accent)" />
        <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.8rem', fontWeight: 600, color: 'var(--fg-primary)', flex: 1 }}>
          AI Formatter
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--fg-dim)' }}>
          <X size={14} />
        </button>
      </div>

      <div style={{ padding: '16px 0', background: 'rgba(255,255,255,0.02)' }}>
        <div style={{
          display: 'flex', overflowX: 'auto', gap: 14, padding: '0 16px 12px',
          scrollbarWidth: 'none', msOverflowStyle: 'none',
        }}>
          {FORMATS.map(f => (
            <div
              key={f.id}
              onClick={() => onApply(f)}
              style={{
                flexShrink: 0, width: 240, padding: 16, borderRadius: 10,
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                cursor: 'pointer', transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <div style={{ fontFamily: 'var(--font-family)', fontSize: '0.85rem', fontWeight: 600, color: 'var(--fg-primary)', marginBottom: 2 }}>
                {f.alias}
              </div>
              <div style={{ fontFamily: 'var(--font-family)', fontSize: '0.65rem', color: 'var(--accent)', fontWeight: 500, textTransform: 'uppercase', marginBottom: 10 }}>
                {f.name}
              </div>
              <p style={{ fontFamily: 'var(--font-family)', fontSize: '0.70rem', color: 'var(--fg-secondary)', lineHeight: 1.4, marginBottom: 12, height: 40, overflow: 'hidden' }}>
                {f.description}
              </p>
              
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: '0.55rem', color: 'var(--fg-dim)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>STRUCTURE:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {f.components.slice(0, 3).map((comp, idx) => (
                    <span key={idx} style={{ fontSize: '0.58rem', color: 'var(--fg-secondary)', background: 'var(--bg-primary)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)' }}>
                      {comp.split(' ')[0]}
                    </span>
                  ))}
                  {f.components.length > 3 && <span style={{ fontSize: '0.58rem', color: 'var(--fg-dim)' }}>+ {f.components.length - 3} more</span>}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 8, padding: '6px', background: 'var(--accent)', color: '#fff', borderRadius: 6, fontSize: '0.7rem', fontWeight: 600 }}>
                Apply Template
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div style={{ padding: '8px 16px', background: 'var(--bg-primary)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {FORMATS.map(f => <div key={f.id} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--border)' }} />)}
        </div>
      </div>
    </div>
  );
}

/* ── Story sidebar ────────────────────────────────────────────────────────── */
function StorySidebar({ open, onToggle, stories, currentDocId, onOpenStory, onNewStory, onDeleteStory }) {
  const [dark] = useDarkMode();
  const [ctxMenu, setCtxMenu] = React.useState(null); // { x, y, story }

  React.useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    return () => { window.removeEventListener('click', close); window.removeEventListener('contextmenu', close); };
  }, [ctxMenu]);
  const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(midnight); yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  // Deduplicate by title — keep the most-recently-updated entry per title
  const seen = new Set();
  const deduped = stories.filter(s => {
    const key = (s.title || 'Untitled story').trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const todayStories     = deduped.filter(s => s.updatedAt >= midnight.getTime());
  const yesterdayStories = deduped.filter(s => s.updatedAt >= yesterdayStart.getTime() && s.updatedAt < midnight.getTime());
  const earlierStories   = deduped.filter(s => s.updatedAt < yesterdayStart.getTime());

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
      background: dark ? 'rgba(26,22,20,0.6)' : 'rgba(237,232,223,0.6)',
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
                  onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ x: e.clientX, y: e.clientY, story }); }}
                  style={{
                    padding: '5px 7px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    marginBottom: 2,
                    border: isActive ? '1px solid rgba(249,115,22,0.2)' : '1px solid transparent',
                    background: isActive ? 'rgba(249,115,22,0.08)' : 'transparent',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{
                    fontFamily: 'var(--font-family)', fontSize: '0.72rem',
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

      {/* Context menu — portalled to body to escape overflow:hidden */}
      {ctxMenu && ReactDOM.createPortal(
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed', top: ctxMenu.y, left: ctxMenu.x, zIndex: 9999,
            background: dark ? '#1c2333' : 'rgba(250,246,238,0.97)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
            overflow: 'hidden',
            minWidth: 140,
          }}
        >
          <div
            onClick={() => { onDeleteStory(ctxMenu.story); setCtxMenu(null); }}
            style={{
              padding: '8px 14px',
              fontFamily: 'var(--font-family)', fontSize: '0.78rem',
              color: 'var(--error)', cursor: 'pointer',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            Delete story
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────────────────────── */
export default function WritePage() {
  const [dark] = useDarkMode();
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

  // Integrated Research States
  const [researchSources, setResearchSources] = useState([]);
  const [isSearchingSources, setIsSearchingSources] = useState(false);
  const [selectedResearchSources, setSelectedResearchSources] = useState([]);
  const [aiSummaries, setAiSummaries] = useState({}); // { url: { text: "...", loading: false } }
  const [trayHover, setTrayHover] = useState(false);

  const [toolbar,             setToolbar]             = useState({ visible: false, x: 0, y: 0 });
  const [focusMode,           setFocusMode]           = useState(false);
  const [focusHint,           setFocusHint]           = useState(false);
  const [selectedWords,       setSelectedWords]       = useState(0);
  const [citationStyle,       setCitationStyle]       = useState('apa'); // 'apa' | 'mla' | 'chicago'
  const [copiedCitation,      setCopiedCitation]      = useState(null); // url of copied citation
  const [aiFormatterOpen,     setAiFormatterOpen]     = useState(false);

  const editorRef      = useRef(null);
  const titleRef       = useRef(null);
  const fileInputRef   = useRef(null);
  const imageInputRef  = useRef(null);
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
        if (session.insertedClaim)    setContent(session.insertedClaim);
        else if (session.content)     setContent(session.content);
        if (session.docId)            docIdRef.current = session.docId;

        // Restore saved research sources + AI summaries for this doc
        const docId = session.docId || docIdRef.current;
        try {
          const allData = JSON.parse(localStorage.getItem(STORY_DATA_KEY) || '{}');
          const saved = allData[docId];
          if (saved) {
            if (saved.researchSources?.length)         setResearchSources(saved.researchSources);
            if (saved.selectedResearchSources?.length) setSelectedResearchSources(saved.selectedResearchSources);
            if (saved.aiSummaries) setAiSummaries(saved.aiSummaries);
          }
        } catch {}
      }
    } catch {}
  }, []);

  /* ── Auto-resize document title ── */
  useEffect(() => {
    const el = titleRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
  }, [title]);

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
    setAllStories(loadDocuments());
    // Write docId back to session storage so page reloads reuse the same document
    try {
      const raw = sessionStorage.getItem('quarry_write_session');
      const sess = raw ? JSON.parse(raw) : {};
      if (!sess.docId) {
        sessionStorage.setItem('quarry_write_session', JSON.stringify({ ...sess, docId: docIdRef.current }));
      }
    } catch {}
  }, [title, content]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Stats ── */
  const stats = useMemo(() => {
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    const chars = content.length;
    const readTime = Math.max(1, Math.round(words / 200));
    return { words, chars, readTime };
  }, [content]);

  /* ── Handlers ── */
  const detectUnsourced = useCallback((text) => {
    if (!text) return;
    const plainText = text.replace(/<[^>]*>?/gm, '');
    const sentences = plainText
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

  const applyFormat = useCallback((cmd) => {
    switch (cmd) {
      case 'bold':      document.execCommand('bold');  break;
      case 'italic':    document.execCommand('italic'); break;
      case 'underline': document.execCommand('underline'); break;
      case 'h1': case 'h2': case 'h3':
        document.execCommand('formatBlock', false, cmd); break;
      case 'blockquote':
        document.execCommand('formatBlock', false, 'blockquote'); break;
      default: break;
    }
    setToolbar({ visible: false, x: 0, y: 0 });
  }, []);

  const handleSelectionChange = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.toString().length > 0) {
      try {
        const range = sel.getRangeAt(0);
        const rect  = range.getBoundingClientRect();
        setToolbar({
          visible: true,
          x: rect.left + rect.width / 2,
          y: rect.top - 48,
        });
        const words = sel.toString().trim().split(/\s+/).filter(Boolean).length;
        setSelectedWords(words);
      } catch {}
    } else {
      setToolbar({ visible: false, x: 0, y: 0 });
      setSelectedWords(0);
    }
  }, []);

  const handleEditorInput = useCallback(() => {
    const text = editorRef.current?.innerText || '';
    setContent(text);
    detectUnsourced(text);
  }, [detectUnsourced]);

  const handleKeyDown = useCallback((e) => {
    const meta = e.metaKey || e.ctrlKey;

    /* Focus mode */
    if (meta && e.shiftKey && e.key === 'f') {
      e.preventDefault();
      setFocusMode(f => {
        const next = !f;
        if (next) { setFocusHint(true); setTimeout(() => setFocusHint(false), 2000); }
        return next;
      });
      return;
    }

    /* Formatting shortcuts */
    if (meta && !e.shiftKey && e.key === 'b') { e.preventDefault(); applyFormat('bold'); return; }
    if (meta && !e.shiftKey && e.key === 'i') { e.preventDefault(); applyFormat('italic'); return; }
    if (meta && !e.shiftKey && e.key === 'u') { e.preventDefault(); applyFormat('underline'); return; }
    if (meta && e.key === '1') { e.preventDefault(); applyFormat('h1'); return; }
    if (meta && e.key === '2') { e.preventDefault(); applyFormat('h2'); return; }
    if (meta && e.key === '3') { e.preventDefault(); applyFormat('h3'); return; }
    if (meta && e.shiftKey && e.key === 'b') { e.preventDefault(); applyFormat('blockquote'); return; }

    /* Existing shortcuts */
    if (meta && e.key === 'k') { e.preventDefault(); setCitationPickerOpen(true); return; }
    if (meta && e.key === 's') { e.preventDefault(); setDrawerOpen(o => !o); return; }

    /* Live markdown shortcuts */
    if (e.key === ' ' || e.key === 'Enter') {
      const sel = window.getSelection();
      if (!sel?.rangeCount) return;
      const range = sel.getRangeAt(0);
      const node  = range.startContainer;
      if (!editorRef.current?.contains(node)) return;
      const text     = node.textContent || '';
      const offset   = range.startOffset;
      const lineText = text.slice(0, offset);

      if (lineText === '#') {
        e.preventDefault(); node.textContent = '';
        document.execCommand('formatBlock', false, 'h1'); return;
      }
      if (lineText === '##') {
        e.preventDefault(); node.textContent = '';
        document.execCommand('formatBlock', false, 'h2'); return;
      }
      if (lineText === '###') {
        e.preventDefault(); node.textContent = '';
        document.execCommand('formatBlock', false, 'h3'); return;
      }
      if (lineText === '>') {
        e.preventDefault(); node.textContent = '';
        document.execCommand('formatBlock', false, 'blockquote'); return;
      }
      if (lineText === '-' || lineText === '*') {
        e.preventDefault(); node.textContent = '';
        document.execCommand('insertUnorderedList'); return;
      }
      if (lineText === '1.') {
        e.preventDefault(); node.textContent = '';
        document.execCommand('insertOrderedList'); return;
      }
    }
  }, [applyFormat]);

  const handleInsertCitation = useCallback((claim) => {
    const text = claim.claim_text || claim.claim || '';
    const outlet = claim.source_outlets?.[0] || 'Source';
    const citation = ` [${outlet}] ${text} `;
    
    const editor = editorRef.current;
    if (editor) {
      editor.focus();
      document.execCommand('insertText', false, citation);
      handleEditorInput();
    }
    setCitationPickerOpen(false);
    setCitationFilter('');
  }, [handleEditorInput]);

  const insertImageDataUrl = useCallback((dataUrl, alt = '') => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand('insertHTML', false,
      `<img src="${dataUrl}" alt="${alt}" class="quarry-img" />`
    );
  }, []);

  const handleImageFiles = useCallback((files) => {
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = e => insertImageDataUrl(e.target.result, file.name);
      reader.readAsDataURL(file);
    });
  }, [insertImageDataUrl]);

  const handleImageInputChange = useCallback((e) => {
    handleImageFiles(e.target.files);
    e.target.value = '';
  }, [handleImageFiles]);

  const handleEditorPaste = useCallback((e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageItems = Array.from(items).filter(i => i.type.startsWith('image/'));
    if (imageItems.length === 0) return;
    e.preventDefault();
    imageItems.forEach(item => {
      const file = item.getAsFile();
      if (file) {
        const reader = new FileReader();
        reader.onload = ev => insertImageDataUrl(ev.target.result);
        reader.readAsDataURL(file);
      }
    });
  }, [insertImageDataUrl]);

  const handleEditorDrop = useCallback((e) => {
    // 1. Check for files (images)
    const files = e.dataTransfer?.files;
    if (files?.length) {
      const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
      if (imageFiles.length > 0) {
        e.preventDefault();
        handleImageFiles(imageFiles);
        return;
      }
    }

    // 2. Check for application/json payloads (Source/Summary)
    const rawData = e.dataTransfer.getData('application/json');
    if (rawData) {
      try {
        const payload = JSON.parse(rawData);
        if (payload.type === 'source') {
          e.preventDefault();
          const outlet = payload.data.outlet_name || payload.data.title || 'Source';
          const html = ` <a href="${payload.data.url}" target="_blank" class="citation-link" style="color:var(--accent); text-decoration:none; font-weight:500;">[${outlet}]</a> `;
          
          editorRef.current?.focus();
          document.execCommand('insertHTML', false, html);
          handleEditorInput();
        } else if (payload.type === 'summary') {
          e.preventDefault();
          const text = payload.text ? `\n\n${payload.text}\n\n` : '';
          
          editorRef.current?.focus();
          document.execCommand('insertText', false, text);
          handleEditorInput();
        }
      } catch (err) {
        console.error("Drop parsing failed", err);
      }
    }
  }, [handleImageFiles, handleEditorInput]);

  const handleSearchSources = useCallback(async () => {
    if (!title.trim()) return;
    setIsSearchingSources(true);
    setResearchSources([]);
    try {
      const resp = await fetch(`${API}/explore/search-sources?query=${encodeURIComponent(title)}`);
      if (!resp.ok) throw new Error("Search failed");
      const data = await resp.json();
      setResearchSources(data.sources || []);
    } catch (err) {
      console.error("Research search failed", err);
    } finally {
      setIsSearchingSources(false);
    }
  }, [title]);

  const handleSummarizeSource = useCallback(async (source) => {
    if (!source?.url) return;
    // Use functional check to avoid stale-closure false-positive guard
    setAiSummaries(prev => {
      if (prev[source.url]) return prev;
      return { ...prev, [source.url]: { text: 'Summarizing…', loading: true } };
    });
    // Re-check after the state update — if already present, bail
    // (belt-and-suspenders; the functional setter handles duplicates)
    try {
      const resp = await fetch(`${API}/explore/summarize-source`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: source.url, snippet: source.snippet || '' }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setAiSummaries(prev => ({
        ...prev,
        [source.url]: { text: data.summary, loading: false },
      }));
    } catch (err) {
      setAiSummaries(prev => ({
        ...prev,
        [source.url]: { text: 'Could not summarize this source.', loading: false },
      }));
    }
  }, []);

  /* ── Init editor HTML on mount (run once after session load) ── */
  useEffect(() => {
    if (editorRef.current) {
      const raw = sessionStorage.getItem('quarry_write_session');
      let initialContent = '';
      try {
        const session = JSON.parse(raw || '{}');
        initialContent = session.insertedClaim || session.content || '';
        if (session.preloadedSources && Array.isArray(session.preloadedSources)) {
          setSelectedResearchSources(prev => {
            const urls = new Set(prev.map(s => s.url));
            const unique = session.preloadedSources.filter(s => !urls.has(s.url));
            return [...prev, ...unique];
          });
          // Also trigger summarization for new ones
          session.preloadedSources.forEach(s => handleSummarizeSource(s));
        }
      } catch {}
      if (initialContent) {
        editorRef.current.innerHTML = contentToHtml(initialContent);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTrayDrop = useCallback((e) => {
    e.preventDefault();
    setTrayHover(false);
    const rawData = e.dataTransfer.getData('application/json');
    if (!rawData) return;
    try {
      const payload = JSON.parse(rawData);
      if (payload.type === 'source') {
        const source = payload.data;
        if (!selectedResearchSources.find(s => s.url === source.url)) {
          setSelectedResearchSources(prev => [...prev, source]);
          handleSummarizeSource(source);
        }
      }
    } catch (err) {
      console.error("Tray drop failed", err);
    }
  }, [selectedResearchSources, handleSummarizeSource]);

  const handleApplyFormat = useCallback((format) => {
    const editor = editorRef.current;
    if (!editor) return;

    const template = format.components.map(comp => `<h3>${comp}</h3><p><br></p>`).join('');
    
    editor.focus();
    // Move cursor to end before inserting template
    const sel = window.getSelection();
    if (sel) {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    
    document.execCommand('insertHTML', false, `<div style="margin-top:20px; border-top:1px solid var(--border); padding-top:20px;"><strong>Format Template: ${format.name}</strong></div>` + template);
    handleEditorInput();
    setAiFormatterOpen(false);
  }, [handleEditorInput]);

  const handleFileImport = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''));
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      setContent(text);
      detectUnsourced(text);
      if (editorRef.current) {
        editorRef.current.innerHTML = contentToHtml(text);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [title, detectUnsourced]);

  const handleExportMarkdown = useCallback(() => {
    const filename = (title || 'quarry-story').replace(/\s+/g, '-').toLowerCase();
    const plainText = content.replace(/<[^>]*>?/gm, '');
    const blob = new Blob(
      ['# ' + (title || 'Untitled') + '\n\n' + plainText],
      { type: 'text/markdown' }
    );
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
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
      query:   story.title,
      content: story.content,
      docId:   story.id,
    }));
    window.location.reload();
  }, []);

  const handleNewStory = useCallback(() => {
    sessionStorage.removeItem('quarry_write_session');
    window.location.reload();
  }, []);

  const [saveIndicator, setSaveIndicator] = useState(false);

  const handleSave = useCallback(() => {
    // Save doc content
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
    setAllStories(loadDocuments());

    // Persist docId to session so reload reopens same doc
    try {
      const raw = sessionStorage.getItem('quarry_write_session');
      const sess = raw ? JSON.parse(raw) : {};
      sessionStorage.setItem('quarry_write_session', JSON.stringify({
        ...sess,
        docId: docIdRef.current,
        query: title,
        content,
      }));
    } catch {}

    // Save research sources + AI summaries keyed by docId
    try {
      const allData = JSON.parse(localStorage.getItem(STORY_DATA_KEY) || '{}');
      allData[docIdRef.current] = {
        researchSources,
        selectedResearchSources,
        aiSummaries,
      };
      localStorage.setItem(STORY_DATA_KEY, JSON.stringify(allData));
    } catch {}

    setSaveIndicator(true);
    setTimeout(() => setSaveIndicator(false), 2000);
  }, [title, content, sessionSources, researchSources, selectedResearchSources, aiSummaries]);

  const handleDeleteStory = useCallback((story) => {
    try {
      const docs = JSON.parse(localStorage.getItem(DOCUMENTS_KEY) || '[]');
      const updated = docs.filter(d => d.id !== story.id);
      localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(updated));
      setAllStories(updated);
      // If deleting the currently open story, start fresh
      if (story.id === docIdRef.current) {
        sessionStorage.removeItem('quarry_write_session');
        window.location.reload();
      }
    } catch {}
  }, []);


  /* ── Confidence score ── */
  const citedCount      = (content.match(/\[/g) || []).length;
  const plainText       = content.replace(/<[^>]*>?/gm, '');
  const totalSentences  = plainText.split(/[.!?]+/).filter(s => s.trim().length > 40).length || 1;
  const confidenceScore = Math.min(100, Math.round((citedCount / totalSentences) * 100));

  /* ── Date string ── */
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  /* ── Render ── */
  return (
    <div className={focusMode ? 'focus-active' : ''} style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', overflow: 'hidden' }}>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .spin { animation: spin 1s linear infinite; }
      `}</style>

      {/* ── TOPBAR ── */}
      <div style={{
        height: 44, flexShrink: 0,
        background: dark ? 'rgba(26,22,20,0.88)' : 'rgba(237,232,223,0.88)',
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

        {!focusMode && (
          <>
            <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
            <button title="Your stories" onClick={() => navigate('/artifacts')} style={{ ...GLASS_BTN, padding: '5px 8px' }}>
              <FileText size={14} />
            </button>
          </>
        )}

        {/* Title */}
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Untitled story"
          style={{
            background: 'transparent', border: 'none', outline: 'none',
            fontFamily: 'var(--font-family)', fontSize: '0.95rem',
            color: 'var(--fg-primary)', minWidth: 200, maxWidth: 400,
          }}
        />

        {/* Right group */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 7 }}>
          {!focusMode && (
            <>
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
              <button style={drawerOpen ? GLASS_BTN_ACTIVE : GLASS_BTN} onClick={() => setDrawerOpen(o => !o)}>
                <PanelRight size={13} /> Sources
              </button>
              <button style={ORANGE_BTN} onClick={handleSave}>
                {saveIndicator ? <><Check size={13} /> Saved</> : <><FilePlus size={13} /> Save</>}
              </button>
              <button style={GLASS_BTN} onClick={handleExportMarkdown}>
                <Download size={13} /> Export
              </button>
            </>
          )}

          {/* Focus mode toggle */}
          <button
            style={{
              ...(focusMode ? GLASS_BTN_ACTIVE : GLASS_BTN),
              transition: 'all 0.3s ease',
            }}
            onClick={() => {
              const next = !focusMode;
              setFocusMode(next);
              if (next) { setFocusHint(true); setTimeout(() => setFocusHint(false), 2000); }
            }}
            title="Focus mode (⌘⇧F)"
          >
            <Maximize2 size={14} />
          </button>

          <NavControls />
        </div>
      </div>

      {/* ── BODY: sidebar | editor | drawer ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>

        {/* ── LEFT: story sidebar ── */}
        {!focusMode && (
          <StorySidebar
            open={sidebarOpen}
            onToggle={() => setSidebarOpen(o => !o)}
            stories={allStories}
            currentDocId={docIdRef.current}
            onOpenStory={handleOpenStory}
            onNewStory={handleNewStory}
            onDeleteStory={handleDeleteStory}
          />
        )}

        {/* ── CENTER: editor ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', borderRight: (!focusMode && drawerOpen) ? '1px solid var(--border)' : 'none' }}>

          {/* ── Slim format toolbar (hidden in focus mode) ── */}
          {!focusMode && (
            <div style={{
              flexShrink: 0,
              background: 'var(--bg-secondary)',
              borderBottom: '0.5px solid var(--border)',
              padding: '5px 16px',
              display: 'flex', alignItems: 'center', gap: 2,
            }}>
              {[
                { label: 'B',  cmd: 'bold',      style: { fontWeight: 700 } },
                { label: 'I',  cmd: 'italic',     style: { fontStyle: 'italic' } },
                { label: 'U',  cmd: 'underline',  style: { textDecoration: 'underline' } },
                { label: 'H1', cmd: 'h1',         style: {} },
                { label: 'H2', cmd: 'h2',         style: {} },
                { label: 'H3', cmd: 'h3',         style: {} },
                { label: '❝',  cmd: 'blockquote', style: {} },
              ].map(btn => (
                <button
                  key={btn.cmd}
                  onMouseDown={e => { e.preventDefault(); editorRef.current?.focus(); applyFormat(btn.cmd); }}
                  style={{
                    fontSize: '12px', fontWeight: 500, lineHeight: 1.6,
                    padding: '3px 8px', border: 'none', borderRadius: 5,
                    background: 'transparent', color: 'var(--fg-secondary)',
                    cursor: 'pointer', ...btn.style,
                  }}
                >
                  {btn.label}
                </button>
              ))}

              <div style={{ width: '0.5px', height: 16, background: 'var(--border)', margin: '0 6px' }} />

              {/* Image button */}
              <button
                onMouseDown={e => { e.preventDefault(); imageInputRef.current?.click(); }}
                style={{
                  fontSize: '12px', padding: '3px 8px', border: 'none', borderRadius: 5,
                  background: 'transparent', color: 'var(--fg-secondary)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.2"/>
                  <circle cx="5.5" cy="6.5" r="1.2" fill="currentColor"/>
                  <path d="M1 11l3.5-3.5L7 10l3-3 5 4" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                </svg>
                Image
              </button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={handleImageInputChange}
              />

              {/* Word count right-aligned */}
              <div style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--fg-dim)', display: 'flex', gap: 12 }}>
                {selectedWords > 0
                  ? <span>{selectedWords} words selected</span>
                  : (
                    <>
                      <span>{stats.words} words</span>
                      <span>{stats.readTime} min read</span>
                    </>
                  )
                }
                {unsourcedCount > 0 && (
                  <span style={{ color: '#a16207' }}>⚠ {unsourcedCount} unsourced</span>
                )}
              </div>
            </div>
          )}

          {/* Editor scroll area */}
          <div style={{ flex: 1, overflowY: 'auto', background: dark ? '#131313' : '#f5f5f5', position: 'relative', transition: 'background 0.3s ease' }}>
            <div style={{
              maxWidth: focusMode ? 680 : 820,
              margin: '40px auto',
              padding: '72px 80px',
              background: 'var(--doc-surface)',
              color: 'var(--doc-fg)',
              boxShadow: focusMode
                ? 'var(--doc-shadow), inset 0 0 60px rgba(0,0,0,0.04), inset 0 2px 8px rgba(0,0,0,0.03)'
                : 'var(--doc-shadow)',
              borderRadius: 2,
              minHeight: '1056px',
              transition: 'max-width 0.3s ease, box-shadow 0.3s ease',
            }}>

              {/* Document title */}
              <textarea
                ref={titleRef}
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Untitled document"
                rows={1}
                style={{
                  display: 'block', width: '100%',
                  background: 'transparent', border: 'none', outline: 'none',
                  fontFamily: 'var(--font-family)', fontSize: '2.4rem', fontWeight: 600,
                  color: 'var(--doc-fg)', letterSpacing: '-0.01em',
                  lineHeight: 1.2, marginBottom: 8, padding: 0,
                  resize: 'none', overflow: 'hidden',
                }}
              />

              {/* Subtitle: source count + date */}
              {sessionSources.length > 0 && (
                <div style={{
                  fontFamily: 'var(--font-family)', fontSize: '0.82rem',
                  fontStyle: 'italic', color: 'var(--doc-fg-dim)',
                  marginBottom: 20,
                }}>
                  {sessionSources.length} source{sessionSources.length !== 1 ? 's' : ''} · {dateStr}
                </div>
              )}

              {/* Confidence bar */}
              {sessionClaims.length > 0 && (
                <div style={{
                  display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10,
                  background: dark ? 'rgba(255,255,255,0.04)' : '#f8f8f8',
                  border: '1px solid var(--border)',
                  borderRadius: 7, padding: '6px 10px',
                  marginBottom: 24,
                }}>
                  <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.57rem', color: 'var(--doc-fg-dim)', fontWeight: 600 }}>
                    CONFIDENCE:
                  </span>
                  {[
                    { label: 'Verified',      color: '#22c55e' },
                    { label: 'Corroborated',  color: '#eab308' },
                    { label: 'Single source', color: '#f97316' },
                    { label: 'Contested',     color: '#ef4444' },
                  ].map(({ label, color }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                      <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.62rem', color: 'var(--doc-fg)' }}>
                        {label}
                      </span>
                    </div>
                  ))}
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 60, height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                      <div style={{ width: `${confidenceScore}%`, height: '100%', background: '#22c55e', borderRadius: 2, transition: 'width 0.3s ease' }} />
                    </div>
                    <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.62rem', color: 'var(--doc-fg-dim)' }}>
                      {confidenceScore}% sourced
                    </span>
                  </div>
                </div>
              )}

              {/* Rich editor */}
              <div className="quarry-editor" style={{ position: 'relative' }}>
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={handleEditorInput}
                  onKeyDown={handleKeyDown}
                  onMouseUp={handleSelectionChange}
                  onKeyUp={handleSelectionChange}
                  onPaste={handleEditorPaste}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleEditorDrop}
                  style={{
                    outline: 'none',
                    minHeight: '60vh',
                    fontFamily: 'var(--font-serif)',
                    fontSize: '1rem',
                    lineHeight: '1.85',
                    color: 'var(--doc-fg)',
                    caretColor: 'var(--accent)',
                    wordBreak: 'break-word',
                  }}
                  data-placeholder="Start writing your story..."
                />
              </div>

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

          {/* Floating formatting toolbar (fixed position) */}
          {toolbar.visible && (
            <div
              className="floating-toolbar"
              style={{
                position: 'fixed',
                left: toolbar.x,
                top: toolbar.y,
                transform: 'translateX(-50%)',
                display: 'flex', alignItems: 'center', gap: 1,
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: 9,
                padding: '3px 5px',
                backdropFilter: 'var(--glass-blur)',
                WebkitBackdropFilter: 'var(--glass-blur)',
                zIndex: 300,
                boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
                pointerEvents: 'auto',
              }}
            >
              {[
                { label: 'B',  cmd: 'bold',      style: { fontWeight: 700 } },
                { label: 'I',  cmd: 'italic',     style: { fontStyle: 'italic' } },
                { label: 'U',  cmd: 'underline',  style: { textDecoration: 'underline' } },
                { label: 'H1', cmd: 'h1',         style: {} },
                { label: 'H2', cmd: 'h2',         style: {} },
                { label: 'H3', cmd: 'h3',         style: {} },
                { label: '❝',  cmd: 'blockquote', style: {} },
              ].map(btn => (
                <button
                  key={btn.cmd}
                  onMouseDown={e => { e.preventDefault(); applyFormat(btn.cmd); }}
                  style={{
                    fontSize: '12px', fontWeight: 500,
                    padding: '3px 7px', border: 'none', borderRadius: 5,
                    background: 'transparent', color: 'var(--fg-primary)',
                    cursor: 'pointer', ...btn.style,
                  }}
                >
                  {btn.label}
                </button>
              ))}

              <div style={{ width: '0.5px', height: 14, background: 'var(--border)', margin: '0 3px' }} />

              {/* Link — placeholder */}
              <button
                onMouseDown={e => e.preventDefault()}
                title="Link (coming soon)"
                style={{
                  fontSize: '12px', padding: '3px 7px', border: 'none', borderRadius: 5,
                  background: 'transparent', color: 'var(--fg-primary)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path d="M6.5 9.5a4 4 0 005.657 0l1.5-1.5a4 4 0 00-5.657-5.657L7 3.84" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  <path d="M9.5 6.5a4 4 0 00-5.657 0L2.343 8A4 4 0 008 13.657L9 12.16" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
              </button>

              {/* Highlight */}
              <button
                onMouseDown={e => { e.preventDefault(); document.execCommand('hiliteColor', false, '#FEF08A'); setToolbar({ visible: false, x: 0, y: 0 }); }}
                title="Highlight"
                style={{
                  fontSize: '12px', padding: '3px 7px', border: 'none', borderRadius: 5,
                  background: 'transparent', color: 'var(--fg-primary)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="10" width="12" height="3" rx="1" fill="#FEF08A" stroke="currentColor" strokeWidth="0.8"/>
                  <path d="M5 9.5L8 3l3 6.5H5z" fill="currentColor" opacity="0.7"/>
                </svg>
              </button>
            </div>
          )}

          {/* Focus mode hint */}
          {focusHint && (
            <div style={{
              position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(0,0,0,0.72)', color: '#fff',
              padding: '6px 16px', borderRadius: 6,
              fontFamily: 'var(--font-family)', fontSize: '0.72rem',
              zIndex: 400, pointerEvents: 'none',
              opacity: 1, transition: 'opacity 0.5s ease',
            }}>
              Press ⌘⇧F to exit focus mode
            </div>
          )}

          {/* Focus mode: word count + read time overlay (bottom-right) */}
          {focusMode && (
            <div
              className="focus-word-overlay"
              style={{
                position: 'fixed', bottom: 24, right: 24,
                background: dark ? 'rgba(20,18,14,0.82)' : 'rgba(237,232,223,0.88)',
                backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
                border: '1px solid var(--border)',
                borderRadius: 8, padding: '6px 14px',
                display: 'flex', alignItems: 'center', gap: 10,
                fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--fg-dim)',
                zIndex: 350, pointerEvents: 'none',
                opacity: 0, transition: 'opacity 0.25s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
            >
              <style>{`
                .focus-word-overlay { opacity: 0; }
                .focus-word-overlay:hover { opacity: 1 !important; }
                /* Fade in on page hover for discoverability */
                body:has(.focus-word-overlay):hover .focus-word-overlay { opacity: 0.7; }
              `}</style>
              <span>{stats.words} words</span>
              <span style={{ width: 1, height: 10, background: 'var(--border)', display: 'block' }} />
              <span>{stats.readTime} min read</span>
            </div>
          )}

          {/* Floating drawer toggle — shown when drawer is closed */}
          {!drawerOpen && !focusMode && (
            <button
              onClick={() => setDrawerOpen(true)}
              style={{
                position: 'fixed', right: 16, top: '50%',
                transform: 'translateY(-50%)',
                width: 32, height: 64,
                background: 'var(--bg-secondary)',
                border: '0.5px solid var(--border)',
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
        {!focusMode && (
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

              {/* Section 2: Sources & Proactive Research */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={SECTION_LABEL}>Research Sources</span>
                  <button
                    onClick={handleSearchSources}
                    disabled={isSearchingSources || !title.trim()}
                    style={{
                      padding: '4px 8px', borderRadius: 4,
                      background: 'var(--accent)', color: '#fff',
                      border: 'none', cursor: 'pointer',
                      fontSize: '0.65rem', fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: 4,
                      opacity: (isSearchingSources || !title.trim()) ? 0.6 : 1,
                    }}
                  >
                    {isSearchingSources ? <Loader2 size={10} className="spin" /> : <Search size={10} />}
                    {researchSources.length > 0 ? 'Refresh' : 'Search for your story'}
                  </button>
                </div>

                {researchSources.length > 0 ? (
                  <div style={{ marginBottom: 16 }}>
                    {researchSources.map((src, i) => (
                      <ResearchSourcePill key={i} src={src} />
                    ))}
                  </div>
                ) : !isSearchingSources && (
                  <div style={{
                    padding: '24px 12px', textAlign: 'center',
                    background: 'var(--bg-primary)', border: '1px dashed var(--border)',
                    borderRadius: 8, marginBottom: 16,
                  }}>
                    <p style={{ fontSize: '0.68rem', color: 'var(--fg-dim)', lineHeight: 1.4 }}>
                      Drag verified pills to document for citations, or to selected tray for AI summaries.
                    </p>
                  </div>
                )}

                {/* Selected Sources Tray */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, marginTop: 4 }}>
                  <span style={{ ...SECTION_LABEL, marginBottom: 0 }}>Selected Sources Tray</span>
                  <span style={{ fontSize: '0.58rem', color: 'var(--fg-dim)', fontStyle: 'italic' }}>drop pills here</span>
                </div>
                <div
                  onDragOver={(e) => { e.preventDefault(); setTrayHover(true); }}
                  onDragLeave={() => setTrayHover(false)}
                  onDrop={handleTrayDrop}
                  style={{
                    minHeight: 100, padding: 14,
                    background: trayHover ? 'rgba(249,115,22,0.06)' : 'var(--bg-primary)',
                    border: trayHover ? '2px dashed var(--accent)' : '1px dashed var(--border)',
                    borderRadius: 10, transition: 'all 0.2s ease',
                    display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'flex-start',
                    boxShadow: trayHover ? '0 0 15px rgba(249,115,22,0.1)' : 'none',
                  }}
                >
                  {selectedResearchSources.length === 0 ? (
                    <div style={{ width: '100%', textAlign: 'center', marginTop: 18 }}>
                      <FilePlus size={20} color="var(--fg-dim)" style={{ marginBottom: 10, opacity: 0.5 }} />
                      <p style={{ fontSize: '0.65rem', color: 'var(--fg-dim)', fontWeight: 500 }}>Drop source pills here</p>
                    </div>
                  ) : (
                    selectedResearchSources.map((src, i) => (
                      <div key={i} style={{ 
                        padding: '4px 10px', borderRadius: 6, background: 'var(--bg-secondary)',
                        border: '1px solid var(--border)', fontSize: '0.65rem', color: 'var(--fg-primary)',
                        display: 'flex', alignItems: 'center', gap: 6,
                        animation: 'fadeIn 0.2s ease',
                      }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: TIER_COLOR[src.credibility_tier] || 'var(--accent)' }} />
                        {src.outlet_name || src.title}
                        <button onClick={() => setSelectedResearchSources(prev => prev.filter(s => s.url !== src.url))} style={{ background: 'none', border: 'none', color: 'var(--fg-dim)', cursor: 'pointer', padding: 2, display: 'flex' }}>
                          <X size={10} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Section 3: AI Summaries */}
              {selectedResearchSources.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <span style={SECTION_LABEL}>AI Summary Cards</span>
                  {selectedResearchSources.map((src, i) => (
                    <AIParagraphCard
                      key={src.url || i}
                      url={src.url}
                      summaryObj={aiSummaries[src.url] || { text: '', loading: true }}
                      onUpdate={(url, txt) => setAiSummaries(prev => ({ ...prev, [url]: { ...prev[url], text: txt } }))}
                      onRemove={(url) => {
                        setSelectedResearchSources(prev => prev.filter(s => s.url !== url));
                        setAiSummaries(prev => { const n = { ...prev }; delete n[url]; return n; });
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Section 4: Citations */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={SECTION_LABEL}>Citations</span>
                  <div style={{ display: 'flex', gap: 2 }}>
                    {['apa', 'mla', 'chicago'].map(style => (
                      <button
                        key={style}
                        onClick={() => setCitationStyle(style)}
                        style={{
                          padding: '2px 7px', borderRadius: 4, border: 'none', cursor: 'pointer',
                          fontSize: '0.58rem', fontWeight: 600, textTransform: 'uppercase',
                          background: citationStyle === style ? 'var(--accent)' : 'var(--bg-tertiary)',
                          color: citationStyle === style ? '#fff' : 'var(--fg-dim)',
                          transition: 'all 0.12s',
                        }}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>

                {sessionSources.length === 0 ? (
                  <p style={{ fontFamily: 'var(--font-family)', fontSize: '0.70rem', color: 'var(--fg-dim)', padding: '8px 0', lineHeight: 1.5 }}>
                    Citations appear after searching a topic on the Explore page.
                  </p>
                ) : (
                  sessionSources.map((src, i) => {
                    const year = new Date().getFullYear();
                    const outlet = src.outlet_name || getDomain(src.url);
                    const title = src.title || src.url;
                    const url = src.url;

                    const formatted =
                      citationStyle === 'apa'
                        ? `${outlet}. (${year}). ${title}. Retrieved from ${url}`
                        : citationStyle === 'mla'
                        ? `"${title}." ${outlet}, ${year}, ${url}.`
                        : `${outlet}. "${title}." ${url}.`;

                    const isCopied = copiedCitation === url;

                    return (
                      <div
                        key={i}
                        style={{
                          padding: '8px 10px', borderRadius: 7, marginBottom: 5,
                          border: '1px solid var(--border)',
                          background: dark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.45)',
                        }}
                      >
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: 'var(--fg-secondary)', lineHeight: 1.5, marginBottom: 6 }}>
                          {formatted}
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(formatted);
                              setCopiedCitation(url);
                              setTimeout(() => setCopiedCitation(null), 2000);
                            }}
                            style={{ ...GLASS_BTN, fontSize: '0.58rem', padding: '2px 8px', gap: 3 }}
                          >
                            {isCopied ? <Check size={9} color="#22c55e" /> : <Copy size={9} />}
                            {isCopied ? 'Copied' : 'Copy'}
                          </button>
                          <button
                            onClick={() => {
                              editorRef.current?.focus();
                              document.execCommand('insertText', false, `\n\n${formatted}\n`);
                              handleEditorInput();
                            }}
                            style={{ ...GLASS_BTN, fontSize: '0.58rem', padding: '2px 8px' }}
                          >
                            Insert
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Section 5: AI Formatter */}
              <div style={{ marginBottom: 20 }}>
                <span style={SECTION_LABEL}>AI Formatter</span>
                <button
                  onClick={() => setAiFormatterOpen(true)}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    background: 'linear-gradient(135deg, var(--accent) 0%, #f59e0b 100%)',
                    color: '#fff', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    fontFamily: 'var(--font-family)', fontSize: '0.8rem', fontWeight: 600,
                    boxShadow: '0 4px 12px rgba(249,115,22,0.2)',
                    transition: 'transform 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <Sparkles size={14} />
                  Choose Format Template
                </button>
              </div>

              {/* Section 6: Export */}
              <div>
                <span style={SECTION_LABEL}>Export</span>
                <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
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
              </div>

            </div>
          </div>
        )}
      </div>

      {/* AI Formatter Popup */}
      {aiFormatterOpen && (
        <AIFormatterPopup 
          onApply={handleApplyFormat} 
          onClose={() => setAiFormatterOpen(false)} 
        />
      )}
    </div>
  );
}
