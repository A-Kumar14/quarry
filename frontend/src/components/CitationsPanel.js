import React, { useState, useEffect, useCallback } from 'react';
import { Copy, Check, BookMarked, ChevronDown, Bookmark, BookmarkCheck, ClipboardList } from 'lucide-react';
import { addSourcesToLibrary, getSourceLibrary } from '../utils/sourceLibrary';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const STYLES = [
  { id: 'apa',     label: 'APA 7th',  desc: 'Author-Date' },
  { id: 'mla',     label: 'MLA 9th',  desc: 'Author-Page' },
  { id: 'chicago', label: 'Chicago',  desc: 'Notes-Bibliography' },
  { id: 'bibtex',  label: 'BibTeX',   desc: 'LaTeX' },
];

/* ── Format helpers (client-side, no backend needed for in-text) ─────────── */

function extractDomain(url) {
  try { return new URL(url).hostname.replace('www.', ''); }
  catch { return url; }
}

/**
 * Build a short in-text citation string from citation metadata.
 * The backend /explore/cite returns { citation, meta } where meta has
 * { author, year, title, publisher, url, accessed }.
 */
function buildInText(meta, style) {
  const author = meta?.author || extractDomain(meta?.url || '');
  const year   = meta?.year   || new Date().getFullYear();
  const page   = meta?.page;

  if (style === 'apa') {
    // (Author Last Name, Year) or (Author Last Name, Year, p. X)
    const lastName = author.split(',')[0].split(' ').at(-1);
    return page ? `(${lastName}, ${year}, p. ${page})` : `(${lastName}, ${year})`;
  }
  if (style === 'mla') {
    // (Author Last Name Page) or (Author Last Name)
    const lastName = author.split(',')[0].split(' ').at(-1);
    return page ? `(${lastName} ${page})` : `(${lastName})`;
  }
  if (style === 'chicago') {
    // Footnote: Author Last Name, "Title," Publisher, Year, URL.
    const lastName = author.split(',')[0].split(' ').at(-1);
    const title = meta?.title ? `"${meta.title},"` : '';
    const pub   = meta?.publisher || '';
    return `${lastName}, ${title} ${pub}${pub ? ',' : ''} ${year}.`;
  }
  return '';
}

/* ── Copy button ─────────────────────────────────────────────────────────── */
function CopyButton({ text, label = 'Copy' }) {
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
      {copied ? 'Copied' : label}
    </button>
  );
}

/* ── Individual citation card ────────────────────────────────────────────── */
// eslint-disable-next-line no-unused-vars
function _CitationCard({ source, style, query, onSaved }) {
  const [citation,  setCitation]  = useState(null);
  const [meta,      setMeta]      = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [expanded,  setExpanded]  = useState(false);
  const [saved,     setSaved]     = useState(false);

  // Reset when style or source changes
  useEffect(() => { setCitation(null); setMeta(null); setExpanded(false); setError(null); }, [style, source.url]);

  // Check if already saved in library
  useEffect(() => {
    const lib = getSourceLibrary();
    setSaved(lib.some(s => s.url === source.url));
  }, [source.url]);

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
      setCitation(data.citation || '');
      setMeta(data.meta || null);
      setExpanded(true);
    } catch {
      setError('Could not fetch citation metadata.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    addSourcesToLibrary([source], query || '');
    setSaved(true);
    onSaved?.();
  };

  const inText = meta ? buildInText(meta, style) : null;
  const domain = extractDomain(source.url);

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        background: 'rgba(255,255,255,0.55)',
        border: '1px solid var(--border)',
        borderRadius: 10, padding: '10px 12px',
      }}>
        {/* Source header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
          {source.favicon && (
            <img src={source.favicon} alt="" width={14} height={14}
              style={{ borderRadius: 3, flexShrink: 0, marginTop: 2, opacity: 0.8 }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--font-family)', fontSize: '0.82rem', fontWeight: 600,
              color: 'var(--fg-primary)', overflow: 'hidden', textOverflow: 'ellipsis',
              whiteSpace: 'nowrap', marginBottom: 1,
            }}>
              {source.title || domain}
            </div>
            <div style={{ fontFamily: 'var(--font-family)', fontSize: '0.68rem', color: 'var(--fg-dim)' }}>
              {domain}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            {/* Save to library */}
            <button
              onClick={handleSave}
              disabled={saved}
              title={saved ? 'Saved to library' : 'Save to source library'}
              style={{
                display: 'flex', alignItems: 'center', gap: 3,
                background: saved ? 'rgba(22,163,74,0.08)' : 'none',
                border: `1px solid ${saved ? 'rgba(22,163,74,0.3)' : 'var(--border)'}`,
                borderRadius: 7, padding: '3px 8px', cursor: saved ? 'default' : 'pointer',
                fontFamily: 'var(--font-family)', fontSize: '0.68rem', fontWeight: 600,
                color: saved ? '#16a34a' : 'var(--fg-dim)',
                transition: 'all 0.15s', whiteSpace: 'nowrap',
              }}
            >
              {saved ? <BookmarkCheck size={11} /> : <Bookmark size={11} />}
              {saved ? 'Saved' : 'Save'}
            </button>

            {/* Cite button */}
            <button
              onClick={generate}
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: citation ? 'transparent' : 'var(--accent)',
                border: citation ? '1px solid var(--border)' : 'none',
                borderRadius: 7, padding: '4px 9px', cursor: loading ? 'default' : 'pointer',
                fontFamily: 'var(--font-family)', fontSize: '0.68rem', fontWeight: 700,
                color: citation ? 'var(--fg-dim)' : '#fff',
                opacity: loading ? 0.6 : 1, transition: 'all 0.15s', whiteSpace: 'nowrap',
              }}
            >
              {loading ? 'Fetching…' : citation ? (
                <><ChevronDown size={11} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: '0.15s' }} /> {expanded ? 'Hide' : 'Show'}</>
              ) : 'Cite'}
            </button>
          </div>
        </div>

        {/* Citation output */}
        {expanded && citation && (
          <div style={{ marginTop: 10 }}>
            {/* In-text citation */}
            {inText && style !== 'bibtex' && (
              <div style={{
                marginBottom: 8, padding: '6px 10px',
                background: 'rgba(249,115,22,0.06)',
                border: '1px solid rgba(249,115,22,0.18)',
                borderRadius: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.63rem', color: 'var(--fg-dim)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    In-text citation
                  </div>
                  <div style={{ fontFamily: 'var(--font-family)', fontSize: '0.80rem', color: 'var(--fg-primary)', fontStyle: style === 'mla' ? 'normal' : 'normal' }}>
                    {inText}
                  </div>
                </div>
                <CopyButton text={inText} />
              </div>
            )}

            {/* Full bibliography entry */}
            <div style={{
              padding: '8px 10px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 7,
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.63rem', color: 'var(--fg-dim)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {style === 'mla' ? 'Works Cited entry' : style === 'chicago' ? 'Bibliography entry' : style === 'bibtex' ? 'BibTeX entry' : 'Reference list entry'}
                </div>
                <div style={{
                  fontFamily: style === 'bibtex' ? 'var(--font-mono)' : 'var(--font-family)',
                  fontSize: style === 'bibtex' ? '0.72rem' : '0.78rem',
                  color: 'var(--fg-secondary)', lineHeight: 1.65,
                  whiteSpace: style === 'bibtex' ? 'pre' : 'normal',
                  wordBreak: 'break-word',
                  /* Hanging indent for MLA/APA/Chicago */
                  paddingLeft: style !== 'bibtex' ? '1.4em' : 0,
                  textIndent: style !== 'bibtex' ? '-1.4em' : 0,
                }}>
                  {citation}
                </div>
              </div>
              <CopyButton text={citation} />
            </div>

            {/* Style guidance note */}
            {style !== 'bibtex' && (
              <div style={{ marginTop: 6, fontFamily: 'var(--font-family)', fontSize: '0.65rem', color: 'var(--fg-dim)', lineHeight: 1.5 }}>
                {style === 'apa' && <>Place <strong>{inText}</strong> directly after any quote or paraphrase. Add a "References" list at the end, alphabetised by author.</>}
                {style === 'mla' && <>Place <strong>{inText}</strong> in parentheses after any quote or paraphrase. Add a "Works Cited" list at the end, hanging-indented, alphabetised by author.</>}
                {style === 'chicago' && <>Use as a footnote or endnote. Add a full "Bibliography" entry at the end of the paper.</>}
              </div>
            )}
          </div>
        )}

        {error && (
          <div style={{ marginTop: 6, fontSize: '0.72rem', color: 'var(--error)', fontFamily: 'var(--font-family)' }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Bibliography export panel ───────────────────────────────────────────── */
function BibliographyExport({ citations, style }) {
  if (!citations.length) return null;

  const label = style === 'mla' ? 'Works Cited' : style === 'chicago' ? 'Bibliography' : style === 'bibtex' ? 'BibTeX' : 'References';
  const combined = style === 'bibtex'
    ? citations.join('\n\n')
    : citations.map((c, i) => `${i + 1}. ${c}`).join('\n');

  return (
    <div style={{
      marginTop: 18, padding: '14px 16px',
      background: 'rgba(255,255,255,0.55)',
      border: '1px solid var(--border)',
      borderRadius: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <ClipboardList size={13} style={{ color: 'var(--accent)' }} />
          <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.78rem', fontWeight: 700, color: 'var(--fg-primary)' }}>
            {label}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.63rem', color: 'var(--fg-dim)' }}>
            {citations.length} {citations.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>
        <CopyButton text={combined} label="Copy all" />
      </div>
      <div style={{
        fontFamily: style === 'bibtex' ? 'var(--font-mono)' : 'var(--font-family)',
        fontSize: style === 'bibtex' ? '0.72rem' : '0.78rem',
        color: 'var(--fg-secondary)', lineHeight: 1.8,
        whiteSpace: style === 'bibtex' ? 'pre' : 'normal',
        wordBreak: 'break-word',
      }}>
        {style === 'bibtex' ? combined : citations.map((c, i) => (
          <div key={i} style={{ marginBottom: 8, paddingLeft: '1.4em', textIndent: '-1.4em' }}>
            {c}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main export ─────────────────────────────────────────────────────────── */
export default function CitationsPanel({ sources, query }) {
  const [style,      setStyle]      = useState('apa');
  // Track generated citations for bibliography export
  const [generated,  setGenerated]  = useState({}); // { url → citation_string }

  const handleCiteGenerated = useCallback((url, citation) => {
    setGenerated(prev => ({ ...prev, [url]: citation }));
  }, []);

  const compiledCitations = Object.values(generated).filter(Boolean);

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <BookMarked size={13} style={{ color: 'var(--fg-dim)', flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.72rem', color: 'var(--fg-dim)', fontWeight: 600 }}>
          Citation style:
        </span>
        {STYLES.map(s => (
          <button
            key={s.id}
            onClick={() => { setStyle(s.id); setGenerated({}); }}
            style={{
              padding: '4px 11px', borderRadius: 7, cursor: 'pointer',
              fontFamily: 'var(--font-family)', fontSize: '0.70rem', fontWeight: 600,
              border: '1px solid',
              borderColor: style === s.id ? 'var(--accent)' : 'var(--border)',
              background: style === s.id ? 'rgba(249,115,22,0.10)' : 'transparent',
              color: style === s.id ? 'var(--accent)' : 'var(--fg-dim)',
              transition: 'all 0.14s',
            }}
            title={s.desc}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Style guide blurb */}
      <div style={{
        marginBottom: 14, padding: '8px 12px',
        background: 'rgba(249,115,22,0.05)',
        border: '1px solid rgba(249,115,22,0.14)',
        borderRadius: 8,
        fontFamily: 'var(--font-family)', fontSize: '0.71rem',
        color: 'var(--fg-secondary)', lineHeight: 1.55,
      }}>
        {style === 'apa' && <>
          <strong>APA 7th</strong> — Use (Author, Year) in-text. Every in-text citation must match a Reference list entry at the end, sorted alphabetically by author's last name.
        </>}
        {style === 'mla' && <>
          <strong>MLA 9th</strong> — Use (Author Last Name Page) in-text. Compile a Works Cited list at the end, hanging-indented, sorted alphabetically by author's last name.
        </>}
        {style === 'chicago' && <>
          <strong>Chicago Notes-Bibliography</strong> — Use numbered footnotes or endnotes in-text. Include a full Bibliography at the end with complete source details.
        </>}
        {style === 'bibtex' && <>
          <strong>BibTeX</strong> — Paste each entry into your <code>.bib</code> file. Use the cite key in your LaTeX document with <code>\cite{"{key}"}</code>.
        </>}
      </div>

      {/* Source cards */}
      {sources.map((src, i) => (
        <CitationCardTracked
          key={src.url || i}
          source={src}
          style={style}
          query={query}
          onGenerated={handleCiteGenerated}
        />
      ))}

      {/* Works Cited / Bibliography export */}
      <BibliographyExport citations={compiledCitations} style={style} />

      <div style={{ marginTop: 10, fontFamily: 'var(--font-family)', fontSize: '0.65rem', color: 'var(--fg-dim)', textAlign: 'right' }}>
        Click "Cite" on each source, then copy the full {style === 'mla' ? 'Works Cited' : style === 'chicago' ? 'Bibliography' : 'References'} list above.
      </div>
    </div>
  );
}

/* Wrapper that propagates generated citation to parent */
function CitationCardTracked({ source, style, query, onGenerated }) {
  const [citation,  setCitation]  = useState(null);
  const [meta,      setMeta]      = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [expanded,  setExpanded]  = useState(false);
  const [saved,     setSaved]     = useState(false);

  useEffect(() => { setCitation(null); setMeta(null); setExpanded(false); setError(null); }, [style, source.url]);
  useEffect(() => {
    const lib = getSourceLibrary();
    setSaved(lib.some(s => s.url === source.url));
  }, [source.url]);

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
      const cit = data.citation || '';
      setCitation(cit);
      setMeta(data.meta || null);
      setExpanded(true);
      onGenerated(source.url, cit);
    } catch {
      setError('Could not fetch citation metadata.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    addSourcesToLibrary([source], query || '');
    setSaved(true);
  };

  const inText = meta ? buildInText(meta, style) : null;
  const domain = extractDomain(source.url);

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ background: 'rgba(255,255,255,0.55)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
          {source.favicon && (
            <img src={source.favicon} alt="" width={14} height={14}
              style={{ borderRadius: 3, flexShrink: 0, marginTop: 2, opacity: 0.8 }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-family)', fontSize: '0.82rem', fontWeight: 600, color: 'var(--fg-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 1 }}>
              {source.title || domain}
            </div>
            <div style={{ fontFamily: 'var(--font-family)', fontSize: '0.68rem', color: 'var(--fg-dim)' }}>{domain}</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            {/* Save */}
            <button
              onClick={handleSave}
              disabled={saved}
              title={saved ? 'Saved to library' : 'Save to source library'}
              style={{
                display: 'flex', alignItems: 'center', gap: 3,
                background: saved ? 'rgba(22,163,74,0.08)' : 'none',
                border: `1px solid ${saved ? 'rgba(22,163,74,0.3)' : 'var(--border)'}`,
                borderRadius: 7, padding: '3px 8px', cursor: saved ? 'default' : 'pointer',
                fontFamily: 'var(--font-family)', fontSize: '0.68rem', fontWeight: 600,
                color: saved ? '#16a34a' : 'var(--fg-dim)', transition: 'all 0.15s',
              }}
            >
              {saved ? <BookmarkCheck size={11} /> : <Bookmark size={11} />}
              {saved ? 'Saved' : 'Save'}
            </button>

            {/* Cite */}
            <button
              onClick={generate}
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: citation ? 'transparent' : 'var(--accent)',
                border: citation ? '1px solid var(--border)' : 'none',
                borderRadius: 7, padding: '4px 9px', cursor: loading ? 'default' : 'pointer',
                fontFamily: 'var(--font-family)', fontSize: '0.68rem', fontWeight: 700,
                color: citation ? 'var(--fg-dim)' : '#fff',
                opacity: loading ? 0.6 : 1, transition: 'all 0.15s', whiteSpace: 'nowrap',
              }}
            >
              {loading ? 'Fetching…' : citation
                ? <><ChevronDown size={11} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: '0.15s' }} /> {expanded ? 'Hide' : 'Show'}</>
                : 'Cite'}
            </button>
          </div>
        </div>

        {/* Citation output */}
        {expanded && citation && (
          <div style={{ marginTop: 10 }}>
            {/* In-text */}
            {inText && style !== 'bibtex' && (
              <div style={{
                marginBottom: 8, padding: '7px 10px',
                background: 'rgba(249,115,22,0.06)',
                border: '1px solid rgba(249,115,22,0.18)',
                borderRadius: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.60rem', color: 'var(--fg-dim)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    In-text
                  </div>
                  <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--fg-primary)' }}>
                    {inText}
                  </code>
                </div>
                <CopyButton text={inText} />
              </div>
            )}

            {/* Full entry */}
            <div style={{
              padding: '8px 10px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 7,
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.60rem', color: 'var(--fg-dim)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {style === 'mla' ? 'Works Cited' : style === 'chicago' ? 'Bibliography' : style === 'bibtex' ? 'BibTeX' : 'References'}
                </div>
                <div style={{
                  fontFamily: style === 'bibtex' ? 'var(--font-mono)' : 'var(--font-family)',
                  fontSize: style === 'bibtex' ? '0.72rem' : '0.78rem',
                  color: 'var(--fg-secondary)', lineHeight: 1.65,
                  whiteSpace: style === 'bibtex' ? 'pre' : 'normal',
                  wordBreak: 'break-word',
                  paddingLeft: style !== 'bibtex' ? '1.4em' : 0,
                  textIndent: style !== 'bibtex' ? '-1.4em' : 0,
                }}>
                  {citation}
                </div>
              </div>
              <CopyButton text={citation} />
            </div>

            {/* Guidance */}
            {style !== 'bibtex' && inText && (
              <div style={{ marginTop: 6, fontFamily: 'var(--font-family)', fontSize: '0.65rem', color: 'var(--fg-dim)', lineHeight: 1.5 }}>
                {style === 'apa' && <>Insert <code style={{ fontFamily: 'var(--font-mono)' }}>{inText}</code> after any paraphrase or quote. Match to this References entry.</>}
                {style === 'mla' && <>Insert <code style={{ fontFamily: 'var(--font-mono)' }}>{inText}</code> after any paraphrase or quote. Match to this Works Cited entry.</>}
                {style === 'chicago' && <>Use as footnote/endnote. Match to this Bibliography entry.</>}
              </div>
            )}
          </div>
        )}

        {error && (
          <div style={{ marginTop: 6, fontSize: '0.72rem', color: 'var(--error)', fontFamily: 'var(--font-family)' }}>{error}</div>
        )}
      </div>
    </div>
  );
}
