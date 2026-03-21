import React, { useState, useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { ArrowLeft, BookMarked, X, Search, Copy, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import GlassCard from '../components/GlassCard';
import { useTopOffset } from '../SettingsContext';
import { getSourceLibrary, removeSourceFromLibrary } from '../utils/sourceLibrary';
import { getSourceQuality, QUALITY_COLOR } from '../utils/sourceQuality';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const CITE_STYLES = [
  { id: 'apa',     label: 'APA' },
  { id: 'mla',     label: 'MLA' },
  { id: 'chicago', label: 'Chicago' },
  { id: 'bibtex',  label: 'BibTeX' },
];

function CiteInline({ url, style }) {
  const [citation, setCitation] = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [copied,   setCopied]   = useState(false);

  const generate = async () => {
    if (citation) { copy(); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/explore/cite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, style }),
      });
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setCitation(data.citation || '');
    } catch { setCitation('Failed to generate citation.'); }
    finally   { setLoading(false); }
  };

  // Reset when style changes
  React.useEffect(() => { setCitation(null); }, [style, url]);

  const copy = () => {
    if (!citation) return;
    navigator.clipboard.writeText(citation).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <Box>
      <Box
        onClick={generate}
        sx={{
          display: 'inline-flex', alignItems: 'center', gap: 0.5,
          px: 0.9, py: 0.25, borderRadius: '5px', cursor: loading ? 'default' : 'pointer',
          border: '1px solid var(--border)', background: 'var(--gbtn-bg)',
          fontFamily: 'var(--font-family)', fontSize: '0.63rem', color: 'var(--fg-dim)',
          transition: 'all 0.13s', opacity: loading ? 0.6 : 1,
          '&:hover': { color: 'var(--fg-primary)', borderColor: 'rgba(249,115,22,0.3)' },
        }}
      >
        {loading ? 'Loading…' : citation ? (copied ? <><Check size={9} /> Copied</> : <><Copy size={9} /> Copy cite</>) : 'Cite'}
      </Box>
      {citation && !copied && (
        <Box sx={{
          mt: 0.75, p: '7px 10px', borderRadius: '7px',
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          fontFamily: style === 'bibtex' ? 'var(--font-mono)' : 'var(--font-family)',
          fontSize: '0.72rem', color: 'var(--fg-secondary)', lineHeight: 1.55,
          whiteSpace: style === 'bibtex' ? 'pre' : 'normal', wordBreak: 'break-word',
        }}>
          {citation}
        </Box>
      )}
    </Box>
  );
}

function SourceCard({ src, citeStyle, onRemove }) {
  const quality = getSourceQuality(src.url);
  const color   = QUALITY_COLOR[quality];

  return (
    <GlassCard style={{ padding: '14px 16px' }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
        {/* Favicon */}
        {src.favicon ? (
          <img src={src.favicon} alt="" width={14} height={14}
            onError={e => { e.target.style.display = 'none'; }}
            style={{ borderRadius: 3, marginTop: 3, flexShrink: 0, opacity: 0.85 }} />
        ) : (
          <Box sx={{ width: 14, height: 14, borderRadius: '3px', bgcolor: 'var(--bg-tertiary)', flexShrink: 0, mt: '3px' }} />
        )}

        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Title + domain */}
          <Box
            component="a" href={src.url} target="_blank" rel="noopener noreferrer"
            sx={{ textDecoration: 'none', display: 'block', mb: 0.3 }}
          >
            <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.84rem', fontWeight: 600, color: 'var(--fg-primary)', lineHeight: 1.35, '&:hover': { color: 'var(--accent)' } }}>
              {src.title || src.domain}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75, flexWrap: 'wrap' }}>
            <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.63rem', color: 'var(--fg-dim)' }}>
              {src.domain}
            </Typography>
            <Box sx={{ px: 0.6, py: 0.1, borderRadius: '4px', background: `${color}22`, border: `1px solid ${color}55`, fontFamily: 'var(--font-family)', fontSize: '0.58rem', fontWeight: 600, color, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              {quality}
            </Box>
          </Box>

          {/* Query tags */}
          {src.queries?.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 0.75 }}>
              {src.queries.map((q, i) => (
                <Box key={i} sx={{ px: 0.75, py: 0.15, borderRadius: '4px', background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.15)', fontFamily: 'var(--font-family)', fontSize: '0.58rem', color: 'var(--accent)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {q}
                </Box>
              ))}
            </Box>
          )}

          {/* Citation inline */}
          <CiteInline url={src.url} style={citeStyle} />
        </Box>

        {/* Remove */}
        <Box
          onClick={() => onRemove(src.url)}
          sx={{ p: 0.5, borderRadius: '6px', cursor: 'pointer', color: 'var(--fg-dim)', flexShrink: 0, transition: 'all 0.13s', '&:hover': { color: '#dc2626', bgcolor: 'rgba(220,38,38,0.08)' } }}
        >
          <X size={12} />
        </Box>
      </Box>
    </GlassCard>
  );
}

export default function SourcesPage() {
  const navigate  = useNavigate();
  const topOffset = useTopOffset();
  const [sources, setSources]   = useState(() => getSourceLibrary().sort((a, b) => b.lastSeen - a.lastSeen));
  const [search,  setSearch]    = useState('');
  const [style,   setStyle]     = useState('apa');

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return sources;
    return sources.filter(s =>
      s.title?.toLowerCase().includes(q) ||
      s.domain?.toLowerCase().includes(q) ||
      s.queries?.some(qr => qr.toLowerCase().includes(q))
    );
  }, [sources, search]);

  const remove = (url) => {
    removeSourceFromLibrary(url);
    setSources(prev => prev.filter(s => s.url !== url));
  };

  return (
    <Box sx={{ minHeight: '100vh', paddingTop: `${topOffset}px`, background: 'linear-gradient(158deg,#EDE8DF 0%,#E5DDD0 40%,#DDD5C0 75%,#E8E2D5 100%)' }}>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2.5, py: 1.1, borderBottom: '1px solid var(--border)', background: 'rgba(237,232,223,0.92)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', position: 'sticky', top: 0, zIndex: 20 }}>
        <Box onClick={() => navigate(-1)} sx={{ display: 'flex', alignItems: 'center', gap: 0.6, cursor: 'pointer', opacity: 0.55, '&:hover': { opacity: 1 }, transition: 'opacity 0.14s' }}>
          <ArrowLeft size={13} color="var(--fg-secondary)" />
          <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.70rem', color: 'var(--fg-secondary)' }}>Back</Typography>
        </Box>
        <Box sx={{ width: '1px', height: 14, bgcolor: 'var(--border)' }} />
        <BookMarked size={14} color="var(--accent)" />
        <Typography sx={{ fontFamily: '"Courier New", monospace', fontSize: '0.82rem', fontWeight: 700, color: 'var(--fg-primary)', letterSpacing: '-0.01em' }}>
          Source Library
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.65rem', color: 'var(--fg-dim)' }}>
          {sources.length} source{sources.length !== 1 ? 's' : ''}
        </Typography>
      </Box>

      <Box sx={{ maxWidth: 760, mx: 'auto', px: 3, py: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>

        {/* Controls */}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flex: 1, minWidth: 200, px: 1.25, py: 0.65, borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(255,252,242,0.6)', '&:focus-within': { borderColor: 'rgba(249,115,22,0.4)' } }}>
            <Search size={12} style={{ color: 'var(--fg-dim)', flexShrink: 0 }} />
            <Box
              component="input"
              placeholder="Filter by title, domain, or query…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              sx={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-family)', fontSize: '0.80rem', color: 'var(--fg-primary)', '&::placeholder': { color: 'var(--fg-dim)' } }}
            />
          </Box>

          {/* Citation style */}
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {CITE_STYLES.map(s => (
              <Box
                key={s.id} onClick={() => setStyle(s.id)}
                sx={{
                  px: 1, py: 0.4, borderRadius: '7px', cursor: 'pointer',
                  fontFamily: 'var(--font-family)', fontSize: '0.68rem', fontWeight: 600,
                  border: '1px solid',
                  borderColor: style === s.id ? 'var(--accent)' : 'var(--border)',
                  background: style === s.id ? 'rgba(249,115,22,0.10)' : 'transparent',
                  color: style === s.id ? 'var(--accent)' : 'var(--fg-dim)',
                  transition: 'all 0.13s',
                }}
              >
                {s.label}
              </Box>
            ))}
          </Box>
        </Box>

        {/* Empty state */}
        {sources.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 10 }}>
            <BookMarked size={32} style={{ color: 'var(--fg-dim)', marginBottom: 12 }} />
            <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.9rem', fontWeight: 600, color: 'var(--fg-secondary)', mb: 0.5 }}>
              No sources yet
            </Typography>
            <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.80rem', color: 'var(--fg-dim)' }}>
              Sources from your searches are automatically saved here.
            </Typography>
          </Box>
        )}

        {/* Filtered empty */}
        {sources.length > 0 && filtered.length === 0 && (
          <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.82rem', color: 'var(--fg-dim)', textAlign: 'center', py: 4 }}>
            No sources match "{search}"
          </Typography>
        )}

        {/* Source list */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {filtered.map(src => (
            <SourceCard key={src.url} src={src} citeStyle={style} onRemove={remove} />
          ))}
        </Box>

        {/* About */}
        {sources.length > 0 && (
          <Box sx={{ textAlign: 'center', pb: 2 }}>
            <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.60rem', color: 'var(--fg-dim)', letterSpacing: '0.06em' }}>
              Sources are saved locally on this device.
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
