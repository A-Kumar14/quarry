import React, { useState } from 'react';
import { Copy, Check, BookMarked, ChevronDown } from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const STYLES = [
  { id: 'apa',     label: 'APA 7th' },
  { id: 'mla',     label: 'MLA 9th' },
  { id: 'chicago', label: 'Chicago' },
  { id: 'bibtex',  label: 'BibTeX'  },
];

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <button
      onClick={copy}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        background: 'none', border: '1px solid var(--border)',
        borderRadius: 7, padding: '3px 8px', cursor: 'pointer',
        fontFamily: 'var(--font-family)', fontSize: '0.68rem',
        fontWeight: 600, color: copied ? '#16a34a' : 'var(--fg-dim)',
        transition: 'all 0.15s', whiteSpace: 'nowrap',
      }}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function CitationCard({ source, style }) {
  const [citation, setCitation]   = useState(null);
  const [loading,  setLoading]    = useState(false);
  const [error,    setError]      = useState(null);
  const [expanded, setExpanded]   = useState(false);

  const generate = async () => {
    if (citation) { setExpanded(e => !e); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/explore/cite`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ url: source.url, style }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCitation(data.citation);
      setExpanded(true);
    } catch (e) {
      setError('Failed to fetch citation.');
    } finally {
      setLoading(false);
    }
  };

  // Reset citation when style changes
  React.useEffect(() => { setCitation(null); setExpanded(false); }, [style]);

  const domain = (() => {
    try { return new URL(source.url).hostname.replace('www.', ''); }
    catch { return source.url; }
  })();

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        background: 'rgba(255,255,255,0.6)',
        border: '1px solid rgba(255,255,255,0.4)',
        borderRadius: 10, padding: '10px 12px',
      }}>
        {source.favicon && (
          <img src={source.favicon} alt="" width={14} height={14}
            style={{ borderRadius: 3, flexShrink: 0, marginTop: 2, opacity: 0.8 }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-family)', fontSize: '0.82rem',
            fontWeight: 600, color: 'var(--fg-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            marginBottom: 2,
          }}>
            {source.title || domain}
          </div>
          <div style={{ fontFamily: 'var(--font-family)', fontSize: '0.7rem', color: 'var(--fg-dim)' }}>
            {domain}
          </div>

          {expanded && citation && (
            <div style={{
              marginTop: 8, padding: '8px 10px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 7,
              fontFamily: style === 'bibtex' ? 'var(--font-mono)' : 'var(--font-family)',
              fontSize: style === 'bibtex' ? '0.72rem' : '0.78rem',
              color: 'var(--fg-secondary)',
              lineHeight: 1.6,
              whiteSpace: style === 'bibtex' ? 'pre' : 'normal',
              wordBreak: 'break-word',
            }}>
              {citation}
            </div>
          )}

          {error && (
            <div style={{ marginTop: 6, fontSize: '0.72rem', color: 'var(--error)', fontFamily: 'var(--font-family)' }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          {expanded && citation && <CopyButton text={citation} />}
          <button
            onClick={generate}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: citation ? 'transparent' : 'var(--accent)',
              border: citation ? '1px solid var(--border)' : 'none',
              borderRadius: 7, padding: '4px 9px', cursor: loading ? 'default' : 'pointer',
              fontFamily: 'var(--font-family)', fontSize: '0.68rem',
              fontWeight: 700,
              color: citation ? 'var(--fg-dim)' : '#fff',
              opacity: loading ? 0.6 : 1, transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {loading ? (
              'Fetching…'
            ) : citation ? (
              <><ChevronDown size={11} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: '0.15s' }} /> {expanded ? 'Hide' : 'Show'}</>
            ) : (
              'Cite'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CitationsPanel({ sources }) {
  const [style, setStyle] = useState('apa');

  if (!sources || sources.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0', fontFamily: 'var(--font-family)', fontSize: '0.82rem', color: 'var(--fg-dim)' }}>
        No sources available to cite.
      </div>
    );
  }

  return (
    <div>
      {/* Style selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
        <BookMarked size={13} style={{ color: 'var(--fg-dim)', flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.72rem', color: 'var(--fg-dim)', fontWeight: 600 }}>
          Format:
        </span>
        {STYLES.map(s => (
          <button
            key={s.id}
            onClick={() => setStyle(s.id)}
            style={{
              padding: '3px 9px', borderRadius: 6, cursor: 'pointer',
              fontFamily: 'var(--font-family)', fontSize: '0.7rem', fontWeight: 600,
              border: '1px solid',
              borderColor: style === s.id ? 'var(--accent)' : 'var(--border)',
              background: style === s.id ? 'rgba(249,115,22,0.1)' : 'transparent',
              color: style === s.id ? 'var(--accent)' : 'var(--fg-dim)',
              transition: 'all 0.15s',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Source list */}
      {sources.map((src, i) => (
        <CitationCard key={i} source={src} style={style} />
      ))}

      {/* Copy all footer */}
      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
        <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.68rem', color: 'var(--fg-dim)' }}>
          Click "Cite" on each source to generate a formatted citation.
        </span>
      </div>
    </div>
  );
}
