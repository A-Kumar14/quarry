import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Box, Typography, Skeleton, Tooltip, CircularProgress } from '@mui/material';
import { Search, BookmarkPlus, ExternalLink, Zap, FlaskConical, CornerDownRight, MoreHorizontal, ArrowUpRight, TrendingUp, RefreshCw, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import GlassCard from '../components/GlassCard';
import PerspectivesTab from '../components/PerspectivesTab';
import ContradictionsTab from '../components/ContradictionsTab';
import CitationsPanel from '../components/CitationsPanel';
import { getSourceQuality, QUALITY_COLOR } from '../utils/sourceQuality';
import Toast from '../components/Toast';
import MonthlyFiguresMarquee from '../components/MonthlyFiguresMarquee';
import FinanceCard from '../components/FinanceCard';
import { useSettings, useTopOffset } from '../SettingsContext';
import { addSourcesToLibrary } from '../utils/sourceLibrary';

// ── Saved searches ────────────────────────────────────────────────────────────
function getSaved() {
  try { return JSON.parse(localStorage.getItem('quarry_saved') || '[]'); }
  catch { return []; }
}
function addSaved(query, excerpt) {
  const items = getSaved();
  const entry = { id: Date.now().toString(), query, excerpt: excerpt.slice(0, 200), savedAt: Date.now() };
  localStorage.setItem('quarry_saved', JSON.stringify([...items.filter(i => i.query !== query), entry]));
}

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const MAX_FOLLOW_UPS = 5;

// ── Design tokens ─────────────────────────────────────────────────────────────

const ANSWER_BODY_STYLES = {
  '& p':              { fontFamily: 'var(--font-family)', fontWeight: 300, fontSize: '0.93rem', lineHeight: 1.85, color: 'var(--fg-primary)', my: 0.75 },
  '& h1, & h2, & h3': { fontFamily: 'var(--font-serif)', fontWeight: 600, color: 'var(--fg-primary)', mt: 2, mb: 0.5 },
  '& h1':             { fontSize: '1.05rem' },
  '& h2':             { fontSize: '0.97rem' },
  '& h3':             { fontSize: '0.88rem' },
  '& code':           { fontFamily: 'var(--font-mono)', fontSize: '0.82rem', bgcolor: 'rgba(221,213,192,0.5)', px: '5px', py: '1px', borderRadius: '4px', border: '1px solid var(--border)' },
  '& pre':            { bgcolor: 'rgba(229,221,208,0.6)', border: '1px solid var(--border)', borderRadius: '8px', p: 1.5, overflowX: 'auto', '& code': { border: 'none', bgcolor: 'transparent' } },
  '& ul, & ol':       { pl: 2.5, my: 0.5 },
  '& li':             { color: 'var(--fg-primary)', fontWeight: 300, fontSize: '0.93rem', lineHeight: 1.80, mb: 0.25 },
  '& strong':         { color: 'var(--fg-primary)', fontWeight: 600 },
  '& em':             { color: 'var(--fg-secondary)' },
  '& blockquote':     { borderLeft: '3px solid var(--accent)', pl: 1.5, ml: 0, color: 'var(--fg-secondary)', fontStyle: 'italic' },
  '& a':              { color: 'var(--accent)', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } },
  '& table':          { borderCollapse: 'collapse', width: '100%', my: 1 },
  '& th, & td':       { border: '1px solid var(--border)', p: '6px 12px', fontSize: '0.83rem', color: 'var(--fg-primary)' },
  '& th':             { bgcolor: 'rgba(229,221,208,0.5)', fontWeight: 500 },
  '& hr':             { border: 'none', borderTop: '1px solid var(--border)', my: 1.5 },
};


const GLASS_BTN = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
  padding: '7px 14px', borderRadius: 999, cursor: 'pointer',
  background: 'var(--gbtn-bg)',
  backdropFilter: 'blur(24px) saturate(190%) brightness(1.10)',
  WebkitBackdropFilter: 'blur(24px) saturate(190%) brightness(1.10)',
  borderTop: '1px solid var(--gbtn-border-t)',
  borderLeft: '1px solid var(--gbtn-border-l)',
  borderRight: '1px solid var(--gbtn-border-r)',
  borderBottom: '1px solid var(--gbtn-border-b)',
  boxShadow: 'var(--gbtn-shadow)',
  fontFamily: 'var(--font-family)', fontSize: 12, fontWeight: 400,
  letterSpacing: '0.02em', color: 'var(--gbtn-color)', whiteSpace: 'nowrap',
  transition: 'all 0.14s ease', border: 'none',
};

const GLASS_BTN_ACCENT = {
  ...GLASS_BTN,
  background: 'linear-gradient(158deg, rgba(249,115,22,0.90) 0%, rgba(217,79,10,0.96) 100%)',
  borderTop: '1px solid rgba(255,185,115,0.75)',
  borderLeft: '1px solid rgba(255,165,100,0.52)',
  borderRight: '1px solid rgba(152,50,0,0.22)',
  borderBottom: '1px solid rgba(152,50,0,0.28)',
  boxShadow: '0 4px 16px rgba(249,115,22,0.32), 0 1.5px 0 rgba(255,205,148,0.68) inset, 0 -1px 0 rgba(130,40,0,0.18) inset',
  color: '#fff', fontWeight: 500,
  backdropFilter: 'none', WebkitBackdropFilter: 'none',
};

const PAGE_BG = {
  background: 'linear-gradient(158deg, #EDE8DF 0%, #E5DDD0 40%, #DDD5C0 75%, #E8E2D5 100%)',
  minHeight: '100vh',
};

// ── Utility helpers ───────────────────────────────────────────────────────────

function CitationLink({ href, children, sources }) {
  const text = React.Children.toArray(children)
    .map(c => (typeof c === 'string' ? c : ''))
    .join('');
  const isCitation = /^\[?\d+\]?$/.test(text.trim());
  if (isCitation) {
    const num = parseInt(text.replace(/\D/g, ''), 10);
    const src = sources[num - 1];
    return (
      <Tooltip title={src?.url || href || ''} placement="top">
        <a
          href={src?.url || href || '#'}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 18, height: 16, fontSize: '0.6rem', fontWeight: 600,
            fontFamily: 'var(--font-family)', color: 'var(--blue)',
            background: 'rgba(30,58,138,0.12)', borderRadius: 5,
            textDecoration: 'none', verticalAlign: 'super',
            lineHeight: 1, marginLeft: 2,
          }}
        >
          {num}
        </a>
      </Tooltip>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
      {children}
    </a>
  );
}

function extractAnswerTitle(answer, query) {
  const h1 = answer.match(/^#\s+(.+?)$/m);
  if (h1) return h1[1].replace(/\*\*/g, '').trim();
  const h2 = answer.match(/^##\s+(.+?)$/m);
  if (h2) return h2[1].replace(/\*\*/g, '').trim();
  return query.charAt(0).toUpperCase() + query.slice(1);
}

function extractLede(answer) {
  const paragraphs = answer.split('\n\n');
  for (const para of paragraphs) {
    const clean = para
      .replace(/^#+\s+.+/gm, '')
      .replace(/\*\*/g, '')
      .replace(/\[(\d+)\]/g, '')
      .replace(/\[.*?\]\(.*?\)/g, '')
      .trim();
    if (clean.length > 50 && !clean.startsWith('*') && !clean.startsWith('-') && !clean.startsWith('|')) {
      const first = clean.match(/^(.+?[.!?])\s/)?.[1] || clean.slice(0, 160);
      return first.trim().slice(0, 200);
    }
  }
  return '';
}

function extractKeywordChips(answer) {
  const boldTerms = [...new Set(
    [...answer.matchAll(/\*\*([^*]{3,35})\*\*/g)]
      .map(m => m[1].trim())
      .filter(t => !t.includes('\n'))
  )];
  return boldTerms.slice(0, 6);
}

function linkifyCitations(text, sources) {
  return text.replace(/\[(\d+)\]/g, (match, num) => {
    const src = sources[parseInt(num, 10) - 1];
    return src?.url ? `[[${num}]](${src.url})` : match;
  });
}

const QUESTION_STRIP = /^(what (?:is|are|was|were)|who (?:is|are|was|were)|how (?:does|do|is|are|to|can)|why (?:is|are|does|do|did)|when (?:is|are|did|was)|where (?:is|are|was)|which (?:is|are)|tell me (?:about|of)?|explain|describe|find|give me|show me|list (?:(?:the|of) )?)\s+(?:(?:the|a|an) )?/i;

function deriveImageQuery(query, context = '') {
  const stripped = query.trim().replace(QUESTION_STRIP, '').trim();
  if (context) {
    const contextCore = context.replace(QUESTION_STRIP, '').trim().split(' ').slice(0, 4).join(' ');
    return `${contextCore} ${stripped}`.trim().slice(0, 80);
  }
  return stripped.slice(0, 80) || query.trim().slice(0, 80);
}

// ── Source card ───────────────────────────────────────────────────────────────

function SourceCard({ src, index }) {
  const quality  = getSourceQuality(src.url);
  const dotColor = QUALITY_COLOR[quality];
  const domain   = (() => {
    try { return new URL(src.url).hostname.replace('www.', ''); }
    catch { return src.url; }
  })().toUpperCase();

  return (
    <a href={src.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
      <Box sx={{
        display: 'flex', alignItems: 'flex-start', gap: 1.25,
        px: 1.25, py: 1, borderRadius: '12px',
        background: 'var(--gbtn-bg)',
        border: '1px solid var(--border)',
        transition: 'all 0.16s ease',
        '&:hover': { background: 'var(--glass-bg)', borderColor: 'rgba(249,115,22,0.22)', transform: 'translateY(-1px)', boxShadow: '0 4px 12px rgba(140,110,60,0.10)' },
      }}>
        {/* Number badge */}
        <Box sx={{
          width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(249,115,22,0.10)', border: '1px solid rgba(249,115,22,0.20)',
          fontFamily: 'var(--font-family)', fontSize: '0.62rem', fontWeight: 500,
          color: 'var(--accent)',
        }}>
          {index + 1}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.3 }}>
            <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: dotColor, flexShrink: 0 }} />
            {src.favicon && (
              <img src={src.favicon} alt="" width={11} height={11}
                style={{ borderRadius: 2, opacity: 0.7 }}
                onError={e => { e.target.style.display = 'none'; }} />
            )}
            <Typography sx={{
              fontFamily: 'var(--font-family)', fontSize: '0.58rem', fontWeight: 500,
              color: 'var(--blue)', letterSpacing: '0.07em', lineHeight: 1,
            }}>
              {domain}
            </Typography>
          </Box>
          <Typography sx={{
            fontFamily: 'var(--font-family)', fontSize: '0.76rem', fontWeight: 400,
            color: 'var(--fg-primary)', lineHeight: 1.35,
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {src.title || src.url}
          </Typography>
        </Box>
        <ExternalLink size={11} style={{ color: 'var(--fg-dim)', flexShrink: 0, marginTop: 4 }} />
      </Box>
    </a>
  );
}

// ── Trending chips ────────────────────────────────────────────────────────────

const FALLBACK_SUGGESTIONS = [
  { title: 'Latest breakthroughs in quantum computing' },
  { title: 'How does RAG work in AI systems?' },
  { title: 'Best open source LLMs in 2026' },
  { title: 'Explain transformer attention mechanisms' },
  { title: 'FastAPI vs Flask for production APIs' },
  { title: 'Top AI coding assistants compared' },
];

function useTrendingChips() {
  const [articles, setArticles] = useState(FALLBACK_SUGGESTIONS);
  const [trending, setTrending] = useState(false);
  const [spinning, setSpinning] = useState(false);

  const fetchTrending = useCallback(async () => {
    setSpinning(true);
    try {
      const res  = await fetch(`${API}/explore/trending-news?max=6`);
      if (!res.ok) throw new Error('trending error');
      const data = await res.json();
      const arts = (data.articles || []).filter(a => a.title).slice(0, 6);
      if (arts.length >= 3) { setArticles(arts); setTrending(true); }
    } catch { /* silent fallback */ }
    finally { setSpinning(false); }
  }, []);

  useEffect(() => { fetchTrending(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return { articles, trending, spinning, refetch: fetchTrending };
}

// ── Bento row helpers ─────────────────────────────────────────────────────────

function BentoImages({ query }) {
  const [photos, setPhotos] = useState([]);
  const [status, setStatus] = useState('loading');
  useEffect(() => {
    if (!query) return;
    let cancelled = false;
    setStatus('loading');
    fetch(`${API}/explore/images?q=${encodeURIComponent(query)}&page=0`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled) return;
        const imgs = data?.images?.slice(0, 6) || [];
        setPhotos(imgs);
        setStatus(imgs.length ? 'done' : 'empty');
      })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, [query]);

  if (status === 'loading') return <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={14} sx={{ color: 'var(--accent)' }} /></Box>;
  if (status !== 'done' || !photos.length) return <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.75rem', color: 'var(--fg-dim)', fontStyle: 'italic' }}>No images found</Typography>;

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
      {photos.map((photo, i) => (
        <a key={i} href={photo.source || photo.image || '#'} target="_blank" rel="noopener noreferrer"
          style={{ borderRadius: 6, overflow: 'hidden', display: 'block', aspectRatio: '1', textDecoration: 'none' }}>
          <img src={photo.image} alt={photo.title || ''}
            onError={e => { e.target.parentElement.style.display = 'none'; }}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.2s' }}
            onMouseEnter={e => { e.target.style.transform = 'scale(1.04)'; }}
            onMouseLeave={e => { e.target.style.transform = 'scale(1)'; }}
          />
        </a>
      ))}
    </Box>
  );
}

// ── Inline images ─────────────────────────────────────────────────────────────

function InlineImages({ visualQuery }) {
  const [photos, setPhotos] = useState([]);
  useEffect(() => {
    if (!visualQuery) return;
    let cancelled = false;
    fetch(`${API}/explore/images?q=${encodeURIComponent(visualQuery)}&page=0`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (!cancelled && data?.images?.length) setPhotos(data.images.slice(0, 3)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [visualQuery]);
  if (!photos.length) return null;
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
      {photos.map((photo, i) => (
        <a key={i} href={photo.source || '#'} target="_blank" rel="noopener noreferrer"
          style={{ flex: 1, borderRadius: 10, overflow: 'hidden', display: 'block', textDecoration: 'none' }}>
          <img src={photo.image} alt={photo.title || visualQuery}
            onError={e => { e.target.parentElement.style.display = 'none'; }}
            style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block', transition: 'transform 0.2s' }}
            onMouseEnter={e => { e.target.style.transform = 'scale(1.03)'; }}
            onMouseLeave={e => { e.target.style.transform = 'scale(1)'; }}
          />
        </a>
      ))}
    </div>
  );
}


function CollapsibleAnswer({ answer, streaming, sources }) {
  const linked = useMemo(() => linkifyCitations(answer, sources), [answer, sources]);
  return (
    <Box sx={ANSWER_BODY_STYLES}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{ a: ({ href, children }) => <CitationLink href={href} sources={sources}>{children}</CitationLink> }}
      >
        {linked}
      </ReactMarkdown>
      {streaming && (
        <Box component="span" sx={{ display: 'inline-block', width: 7, height: 15, bgcolor: 'var(--accent)', borderRadius: '2px', animation: 'blinkPulse 1s step-end infinite', verticalAlign: 'text-bottom', ml: 0.5 }} />
      )}
    </Box>
  );
}

function ThreadDivider() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 0.5 }}>
      <Box sx={{ width: '1px', height: 28, bgcolor: 'var(--border)' }} />
    </Box>
  );
}

function FollowUpBar({ onSubmit, atMax }) {
  const [text, setText] = useState('');
  const submit = () => { const t = text.trim(); if (t) { onSubmit(t); setText(''); } };

  if (atMax) {
    return (
      <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', py: 1.5, borderRadius: '14px', border: '1px dashed var(--border)', fontFamily: 'var(--font-family)', fontSize: '0.8rem', color: 'var(--fg-dim)' }}>
        Start a new search to continue
      </Box>
    );
  }
  return (
    <Box component="form" onSubmit={e => { e.preventDefault(); submit(); }} sx={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 1.5,
      borderBottom: '1px solid var(--border)', pb: 0.75,
      '&:focus-within': { borderBottomColor: 'var(--accent)' },
    }}>
      <CornerDownRight size={15} color="var(--fg-dim)" strokeWidth={2} style={{ flexShrink: 0 }} />
      <input
        value={text} onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
        placeholder="Ask a follow-up…" autoComplete="off"
        style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '0.9rem', fontFamily: 'var(--font-family)', fontWeight: 300, color: 'var(--fg-primary)', padding: '4px 0' }}
      />
      {text.trim() && (
        <button type="submit" style={{ ...GLASS_BTN_ACCENT, padding: '5px 14px', fontSize: 12 }}>
          Ask
        </button>
      )}
    </Box>
  );
}

// ── Mini tab strip ────────────────────────────────────────────────────────────

function MiniTabStrip({ active, onChange, hasContradictions, contradictionsLoading, hasSources }) {
  const tabs = [
    { key: 'answer',        label: 'Result' },
    { key: 'perspectives',  label: 'Perspectives' },
    ...(hasSources ? [{ key: 'citations', label: 'Citations' }] : []),
    { key: 'images',        label: 'Images' },
    { key: 'contradictions', label: 'Contradictions', dot: contradictionsLoading ? true : hasContradictions },
  ];

  return (
    <Box sx={{
      display: 'flex', gap: 0.5, flexWrap: 'nowrap',
      overflowX: 'auto', borderTop: '1px solid var(--border)', pt: 1.25, mt: 1.5,
      '&::-webkit-scrollbar': { display: 'none' }, scrollbarWidth: 'none',
    }}>
      {tabs.map(t => (
        <Box
          key={t.key}
          onClick={() => onChange(t.key)}
          sx={{
            px: 1.25, py: 0.45, borderRadius: 999, cursor: 'pointer', flexShrink: 0,
            fontFamily: 'var(--font-family)', fontSize: '0.72rem',
            fontWeight: active === t.key ? 500 : 400,
            color: active === t.key ? '#fff' : 'var(--fg-secondary)',
            background: active === t.key ? 'var(--accent)' : 'var(--gbtn-bg)',
            border: '1px solid',
            borderColor: active === t.key ? 'transparent' : 'var(--border)',
            transition: 'all 0.14s',
            display: 'flex', alignItems: 'center', gap: '4px',
            '&:hover': { color: active === t.key ? '#fff' : 'var(--fg-primary)', borderColor: active === t.key ? 'transparent' : 'rgba(249,115,22,0.3)' },
          }}
        >
          {t.label}
          {t.dot && (
            <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: '#d97706', verticalAlign: 'middle' }} />
          )}
        </Box>
      ))}
    </Box>
  );
}

// ── Outline panel ─────────────────────────────────────────────────────────────

function OutlinePanel({ question, answerContext, onClose }) {
  const [outline, setOutline] = useState('');
  const [streaming, setStreaming] = useState(true);
  const [copied, setCopied]   = useState(false);
  const abortRef = useRef(null);

  useEffect(() => {
    abortRef.current = new AbortController();
    let buf = '', accumulated = '';
    (async () => {
      try {
        const res = await fetch(`${API}/explore/outline`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: question, context: answerContext.slice(0, 2000) }),
          signal: abortRef.current.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split('\n\n');
          buf = parts.pop();
          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (raw === '[DONE]') { setStreaming(false); continue; }
            try {
              const evt = JSON.parse(raw);
              if (evt.type === 'chunk') { accumulated += evt.text; setOutline(accumulated); }
            } catch { /* ignore */ }
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') setOutline('Failed to generate outline. Please try again.');
      } finally {
        setStreaming(false);
      }
    })();
    return () => abortRef.current.abort();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const copyOutline = () => {
    navigator.clipboard.writeText(outline).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  const downloadOutline = () => {
    const blob = new Blob([outline], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `outline-${question.slice(0, 40).replace(/[^a-z0-9]/gi, '-').toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <GlassCard style={{ padding: '20px 24px', marginTop: 8 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'var(--accent)', flexShrink: 0 }} />
        <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.58rem', fontWeight: 600, color: 'var(--fg-dim)', letterSpacing: '0.10em', textTransform: 'uppercase', flex: 1 }}>
          Paper Outline
        </Typography>
        {!streaming && outline && (
          <>
            <Box onClick={copyOutline} sx={{ px: 1, py: 0.3, borderRadius: '6px', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'var(--font-family)', fontSize: '0.65rem', color: copied ? '#16a34a' : 'var(--fg-dim)', transition: 'color 0.15s', '&:hover': { color: 'var(--fg-primary)' } }}>
              {copied ? '✓ Copied' : 'Copy'}
            </Box>
            <Box onClick={downloadOutline} sx={{ px: 1, py: 0.3, borderRadius: '6px', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'var(--font-family)', fontSize: '0.65rem', color: 'var(--fg-dim)', '&:hover': { color: 'var(--fg-primary)' } }}>
              .md
            </Box>
          </>
        )}
        <Box onClick={onClose} sx={{ px: 1, py: 0.3, borderRadius: '6px', cursor: 'pointer', fontFamily: 'var(--font-family)', fontSize: '0.65rem', color: 'var(--fg-dim)', '&:hover': { color: 'var(--fg-primary)' } }}>
          ✕
        </Box>
      </Box>
      <Box sx={{
        '& p':        { fontFamily: 'var(--font-family)', fontSize: '0.84rem', lineHeight: 1.7, color: 'var(--fg-primary)', my: 0.4 },
        '& h1':       { fontFamily: 'var(--font-family)', fontSize: '0.92rem', fontWeight: 700, color: 'var(--fg-primary)', mt: 0, mb: 1 },
        '& h2':       { fontFamily: 'var(--font-family)', fontSize: '0.82rem', fontWeight: 600, color: 'var(--fg-primary)', mt: 1.5, mb: 0.4, borderBottom: '1px solid var(--border)', pb: 0.3 },
        '& ul, & ol': { pl: 2.5, my: 0.3 },
        '& li':       { fontFamily: 'var(--font-family)', fontSize: '0.80rem', lineHeight: 1.65, color: 'var(--fg-secondary)', mb: 0.15 },
        '& strong':   { fontWeight: 600, color: 'var(--fg-primary)' },
      }}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{outline}</ReactMarkdown>
      </Box>
      {streaming && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1 }}>
          <CircularProgress size={10} sx={{ color: 'var(--accent)' }} />
          <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.65rem', color: 'var(--fg-dim)' }}>Generating outline…</Typography>
        </Box>
      )}
    </GlassCard>
  );
}

// ── Result block ──────────────────────────────────────────────────────────────

function ResultBlock({ question, sources, answer, streaming, errorMsg, isFollowUp, onNewSearch, isDeepSearch, deepLabel, relatedSearches = [], loadingRelated = false, visualQuery = '', contradictions = null, stockData = null }) {
  const [activeTab,    setActiveTab]    = useState('answer');
  const [showOutline,  setShowOutline]  = useState(false);

  const contradictionsLoading = contradictions === null;
  const hasContradictions     = contradictions?.contradictions?.length > 0;

  const title    = answer ? extractAnswerTitle(answer, question) : '';
  const lede     = answer ? extractLede(answer) : '';
  const chips    = answer ? extractKeywordChips(answer) : [];

  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();

  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {isFollowUp && (
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.4, borderRadius: '20px', background: 'rgba(0,0,0,0.04)', border: '1px solid var(--border)', alignSelf: 'flex-start' }}>
          <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.75rem', fontWeight: 400, color: 'var(--fg-dim)' }}>
            ↩ You asked: <span style={{ color: 'var(--fg-secondary)', fontWeight: 500 }}>{question}</span>
          </Typography>
        </Box>
      )}

      {errorMsg && (
        <Box sx={{ border: '1px solid var(--error)', bgcolor: 'rgba(220,38,38,0.06)', borderRadius: '10px', p: 1.5 }}>
          <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.8rem', color: 'var(--error)' }}>{errorMsg}</Typography>
        </Box>
      )}

      {/* Finance card — shown when a stock/ticker was detected */}
      {stockData && <FinanceCard data={stockData} />}

      {/* Two-column layout */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, alignItems: 'flex-start' }}>

        {/* ── Left: main answer card ── */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {answer ? (
            <GlassCard style={{ padding: '22px 26px' }}>

              {/* Metadata line */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'var(--accent)', flexShrink: 0 }} />
                <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.58rem', fontWeight: 500, color: 'var(--fg-dim)', letterSpacing: '0.10em', textTransform: 'uppercase' }}>
                  Result
                  {sources.length > 0 && ` · ${sources.length} Sources`}
                  {` · ${today}`}
                  {isDeepSearch && ' · Deep'}
                </Typography>
              </Box>

              {/* Serif title */}
              <Typography sx={{ fontFamily: 'var(--font-serif)', fontSize: { xs: '1.35rem', md: '1.6rem' }, fontWeight: 600, color: 'var(--fg-primary)', lineHeight: 1.22, mb: 0.75 }}>
                {title}
              </Typography>

              {/* Italic lede */}
              {lede && (
                <Typography sx={{ fontFamily: 'var(--font-serif)', fontSize: '0.88rem', fontStyle: 'italic', fontWeight: 400, color: 'var(--fg-secondary)', lineHeight: 1.6, mb: 1.5 }}>
                  {lede}
                </Typography>
              )}

              {/* Divider */}
              <Box sx={{ height: '1px', bgcolor: 'var(--border)', mb: 1.75 }} />

              {/* Deep search status banner */}
              {deepLabel === '2/2' && streaming && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, px: 1.25, py: 0.75, borderRadius: '10px', background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.20)' }}>
                  <CircularProgress size={11} sx={{ color: 'var(--accent)' }} />
                  <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.75rem', fontWeight: 400, color: '#b45309' }}>
                    Running deep analysis…
                  </Typography>
                </Box>
              )}

              {/* Active tab content — fade in on switch */}
              <Box key={activeTab} sx={{ animation: 'tabFadeIn 0.15s ease' }}>
                {activeTab === 'answer' && (
                  <>
                    {visualQuery && <InlineImages visualQuery={visualQuery} />}
                    <CollapsibleAnswer answer={answer} streaming={streaming} sources={sources} />
                  </>
                )}
                {activeTab === 'perspectives'  && <PerspectivesTab query={question} />}
                {activeTab === 'citations'     && <CitationsPanel sources={sources} />}
                {activeTab === 'images'        && <BentoImages query={visualQuery || question} />}
                {activeTab === 'contradictions' && (
                  contradictionsLoading
                    ? <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.78rem', color: 'var(--fg-dim)', fontStyle: 'italic', py: 2 }}>Checking sources for contradictions…</Typography>
                    : <ContradictionsTab data={contradictions} sources={sources} />
                )}
              </Box>
              <style>{`@keyframes tabFadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>

              {/* Keyword chips (answer tab only) */}
              {activeTab === 'answer' && chips.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 2 }}>
                  {chips.map((chip, i) => (
                    <Box
                      key={i}
                      onClick={() => onNewSearch(chip)}
                      sx={{
                        px: 1.25, py: 0.4, borderRadius: 999, cursor: 'pointer',
                        background: 'var(--blue-dim)', border: '1px solid rgba(30,58,138,0.15)',
                        fontFamily: 'var(--font-family)', fontSize: '0.72rem', fontWeight: 400,
                        color: 'var(--blue)', transition: 'all 0.14s',
                        '&:hover': { background: 'rgba(30,58,138,0.18)', borderColor: 'rgba(30,58,138,0.3)' },
                      }}
                    >
                      {chip}
                    </Box>
                  ))}
                </Box>
              )}

              {/* Mini tab strip */}
              <MiniTabStrip
                active={activeTab}
                onChange={setActiveTab}
                hasContradictions={hasContradictions}
                contradictionsLoading={contradictionsLoading}
                hasSources={sources.length > 0}
              />
            </GlassCard>
          ) : (
            <GlassCard style={{ padding: '22px 26px' }}>
              <Skeleton variant="rectangular" width="40%" height={12} sx={{ borderRadius: 4, bgcolor: 'var(--bg-tertiary)', mb: 2 }} />
              <Skeleton variant="rectangular" width="75%" height={28} sx={{ borderRadius: 6, bgcolor: 'var(--bg-tertiary)', mb: 1 }} />
              <Skeleton variant="rectangular" width="60%" height={28} sx={{ borderRadius: 6, bgcolor: 'var(--bg-tertiary)', mb: 2 }} />
              <Box sx={{ height: '1px', bgcolor: 'var(--border)', mb: 2 }} />
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} variant="text" width={`${65 + (i % 4) * 8}%`} sx={{ bgcolor: 'var(--bg-tertiary)', height: 22, mb: 0.5 }} />
              ))}
            </GlassCard>
          )}
        </Box>

        {/* ── Right: sources + related ── */}
        <Box sx={{ width: { xs: '100%', md: '300px' }, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {/* Sources */}
          {sources.length > 0 && (
            <GlassCard style={{ padding: '16px 16px' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.25 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'var(--accent)' }} />
                <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.58rem', fontWeight: 500, color: 'var(--fg-dim)', letterSpacing: '0.10em', textTransform: 'uppercase' }}>
                  Sources
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                {sources.map((src, i) => <SourceCard key={i} src={src} index={i} />)}
              </Box>
            </GlassCard>
          )}

          {/* Related searches */}
          {(relatedSearches.length > 0 || loadingRelated) && answer && (
            <GlassCard style={{ padding: '14px 16px' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.1 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'var(--blue)' }} />
                <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.58rem', fontWeight: 500, color: 'var(--fg-dim)', letterSpacing: '0.10em', textTransform: 'uppercase' }}>
                  Related
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {loadingRelated
                  ? [0, 1, 2].map(i => <Skeleton key={i} variant="rectangular" height={28} sx={{ borderRadius: '8px', bgcolor: 'var(--bg-tertiary)', width: `${78 + i * 6}%` }} />)
                  : relatedSearches.map(s => (
                      <Box
                        key={s} onClick={() => onNewSearch(s)}
                        sx={{
                          display: 'flex', alignItems: 'center', gap: 0.75,
                          fontFamily: 'var(--font-family)', fontSize: '0.76rem', fontWeight: 400,
                          color: 'var(--fg-secondary)', padding: '5px 8px', borderRadius: 8,
                          cursor: 'pointer', background: 'var(--gbtn-bg)',
                          border: '1px solid var(--border)', transition: 'all 0.12s',
                          '&:hover': { color: 'var(--accent)', borderColor: 'rgba(249,115,22,0.3)', background: 'rgba(249,115,22,0.05)' },
                        }}
                      >
                        <span style={{ color: 'var(--accent)', fontSize: '0.65rem' }}>→</span>
                        {s}
                      </Box>
                    ))
                }
              </Box>
            </GlassCard>
          )}
        </Box>
      </Box>

      {/* ── Outline builder ── */}
      {!streaming && answer && (
        <Box sx={{ mt: 1 }}>
          {!showOutline ? (
            <Box
              onClick={() => setShowOutline(true)}
              sx={{
                display: 'inline-flex', alignItems: 'center', gap: 0.75,
                px: 1.25, py: 0.5, borderRadius: 999, cursor: 'pointer',
                border: '1px solid var(--border)', background: 'var(--gbtn-bg)',
                fontFamily: 'var(--font-family)', fontSize: '0.72rem', color: 'var(--fg-secondary)',
                transition: 'all 0.13s',
                '&:hover': { borderColor: 'rgba(249,115,22,0.3)', color: 'var(--fg-primary)', background: 'rgba(249,115,22,0.05)' },
              }}
            >
              <span style={{ fontSize: '0.7rem' }}>📄</span> Build paper outline
            </Box>
          ) : (
            <OutlinePanel
              question={question}
              answerContext={answer}
              onClose={() => setShowOutline(false)}
            />
          )}
        </Box>
      )}

    </Box>
  );
}

// ── Top bar (results + searching) ─────────────────────────────────────────────

function OptionsMenu({ onReset, navigate }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const items = [
    { label: 'New search',           action: () => { onReset(); setOpen(false); } },
    { label: 'Saved searches',       action: () => { navigate('/saved'); setOpen(false); } },
    { label: 'Source library',       action: () => { navigate('/sources'); setOpen(false); } },
    { label: 'Research mode',        action: () => { navigate('/research'); setOpen(false); } },
    { label: 'Session history',      action: () => { navigate('/research/sessions'); setOpen(false); } },
  ];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        style={{ ...GLASS_BTN, padding: '7px 9px', ...(open ? { background: 'rgba(249,115,22,0.10)', borderColor: 'rgba(249,115,22,0.3)' } : {}) }}
        onClick={() => setOpen(o => !o)}
      >
        <MoreHorizontal size={13} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          background: 'rgba(250,246,238,0.95)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          borderRadius: 12,
          borderTop: '1px solid rgba(255,255,235,0.90)',
          borderLeft: '1px solid rgba(255,252,225,0.70)',
          borderRight: '1px solid rgba(185,165,128,0.18)',
          borderBottom: '1px solid rgba(178,158,120,0.18)',
          boxShadow: '0 8px 32px rgba(140,110,60,0.14)',
          minWidth: 180, zIndex: 100, overflow: 'hidden',
        }}>
          {items.map((item, i) => (
            <div
              key={i}
              onClick={item.action}
              style={{
                padding: '9px 16px',
                fontFamily: 'var(--font-family)', fontSize: '0.82rem', fontWeight: 400,
                color: 'var(--fg-primary)', cursor: 'pointer',
                borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(249,115,22,0.07)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              {item.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TopBar({ query, setQuery, onSubmit, deepMode, onToggleDeep, onReset, answer, onSave, onShare, saved, navigate }) {
  const handleKey = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(); } };

  return (
    <Box sx={{
      position: 'sticky', top: 0, zIndex: 30,
      background: 'rgba(237,232,223,0.82)',
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      borderBottom: '1px solid var(--border)',
      px: 3, py: 1,
    }}>
      <Box sx={{ maxWidth: 1100, mx: 'auto', display: 'flex', alignItems: 'center', gap: 1.5 }}>

        {/* Quarry wordmark — clicking resets to home */}
        <Box onClick={onReset} sx={{ cursor: 'pointer', flexShrink: 0, mr: 0.5, userSelect: 'none' }}>
          <Typography sx={{
            fontFamily: 'var(--font-serif)', fontSize: '1.25rem', fontWeight: 600,
            color: 'var(--fg-primary)', letterSpacing: '-0.02em', lineHeight: 1,
            transition: 'opacity 0.15s',
            '&:hover': { opacity: 0.7 },
          }}>
            Quarry
          </Typography>
        </Box>

        {/* Search input */}
        <Box
          component="form"
          onSubmit={e => { e.preventDefault(); onSubmit(); }}
          sx={{
            flex: 1, maxWidth: 540, display: 'flex', alignItems: 'center', gap: 1,
            borderRadius: 999, px: 1.5, py: 0.6,
            background: 'var(--glass-bg)',
            border: '1px solid var(--border)',
            boxShadow: '0 1px 4px rgba(140,110,60,0.06)',
            transition: 'box-shadow 0.15s, border-color 0.15s',
            '&:focus-within': { boxShadow: '0 1px 4px rgba(140,110,60,0.06), 0 0 0 3px var(--accent-dim)', borderColor: 'rgba(249,115,22,0.35)' },
          }}
        >
          <Search size={14} style={{ color: 'var(--fg-dim)', flexShrink: 0 }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search the web…"
            autoComplete="off"
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: '0.88rem', fontFamily: 'var(--font-family)', fontWeight: 400,
              color: 'var(--fg-primary)', padding: '3px 0',
            }}
          />
        </Box>

        {/* Action buttons */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, ml: 0.25 }}>
          <button style={GLASS_BTN_ACCENT} onClick={onSubmit}>
            Search
          </button>

          <button
            style={{
              ...GLASS_BTN,
              ...(deepMode ? { background: 'rgba(249,115,22,0.15)', borderTop: '1px solid rgba(249,115,22,0.35)', color: 'var(--accent)' } : {}),
            }}
            onClick={onToggleDeep}
          >
            <Zap size={11} fill={deepMode ? 'var(--accent)' : 'none'} color={deepMode ? 'var(--accent)' : '#3a2c18'} />
            Deep
          </button>

          <button style={GLASS_BTN} onClick={() => navigate('/research')}>
            <FlaskConical size={11} />
            Research
          </button>

          {answer && (
            <>
              <button style={GLASS_BTN} onClick={onSave}>
                <BookmarkPlus size={11} color={saved ? 'var(--accent)' : '#3a2c18'} />
                {saved ? 'Saved' : 'Save'}
              </button>
              <button style={GLASS_BTN} onClick={onShare}>
                <ArrowUpRight size={11} />
                Share
              </button>
            </>
          )}

          <OptionsMenu onReset={onReset} navigate={navigate} />
        </Box>
      </Box>
    </Box>
  );
}

// ── Home search bar ───────────────────────────────────────────────────────────

function HomeSearchBar({ query, setQuery, onSubmit, deepMode, onToggleDeep }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showSugg, setShowSugg] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  const handleKey = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); setShowSugg(false); onSubmit(); }
    if (e.key === 'Escape') setShowSugg(false);
  };

  const fetchSuggestions = (val) => {
    clearTimeout(debounceRef.current);
    if (!val.trim() || val.length < 2) { setSuggestions([]); setShowSugg(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`${API}/explore/suggest?q=${encodeURIComponent(val)}`);
        const data = await r.json();
        const suggs = (data.suggestions || []).filter(s => s.toLowerCase() !== val.toLowerCase());
        setSuggestions(suggs.slice(0, 6));
        setShowSugg(suggs.length > 0);
      } catch { setSuggestions([]); setShowSugg(false); }
    }, 280);
  };

  useEffect(() => {
    if (!showSugg) return;
    const handler = e => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setShowSugg(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSugg]);

  return (
    <Box ref={wrapperRef} sx={{ width: '100%', maxWidth: 660, position: 'relative' }}>
      <Box
        component="form"
        onSubmit={e => { e.preventDefault(); setShowSugg(false); onSubmit(); }}
        sx={{
          width: '100%',
          display: 'flex', alignItems: 'center', gap: 1.25,
          borderRadius: '12px', px: 2.25, py: 1.35,
          background: 'var(--gbtn-bg)',
          backdropFilter: 'blur(28px) saturate(180%) brightness(1.06)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%) brightness(1.06)',
          borderTop: '1px solid var(--gbtn-border-t)',
          borderLeft: '1px solid var(--gbtn-border-l)',
          borderRight: '1px solid rgba(140,110,60,0.22)',
          borderBottom: '1px solid rgba(140,110,60,0.28)',
          boxShadow: '0 3px 14px rgba(140,110,60,0.13), 0 1px 4px rgba(0,0,0,0.06), 0 2px 0 rgba(255,254,218,0.72) inset',
          transition: 'box-shadow 0.2s',
          '&:focus-within': { boxShadow: '0 6px 28px rgba(140,110,60,0.16), 0 2px 0 rgba(255,254,218,0.80) inset, 0 0 0 3px var(--accent-dim)' },
        }}
      >
        <Search size={17} style={{ color: 'var(--fg-dim)', flexShrink: 0 }} strokeWidth={2} />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); fetchSuggestions(e.target.value); }}
          onKeyDown={handleKey}
          onFocus={() => { if (suggestions.length) setShowSugg(true); }}
          placeholder="Search the web…" autoComplete="off"
          style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '0.95rem', fontFamily: 'var(--font-family)', fontWeight: 400, color: 'var(--fg-primary)', padding: '4px 0' }}
        />
        <Box onClick={e => { e.preventDefault(); onToggleDeep?.(); }} sx={{
          display: 'flex', alignItems: 'center', gap: '3px', px: 1, py: 0.4, borderRadius: '6px', cursor: 'pointer', flexShrink: 0,
          border: deepMode ? '1px solid rgba(249,115,22,0.40)' : '1px solid var(--border)',
          bgcolor: deepMode ? 'rgba(249,115,22,0.08)' : 'transparent',
          boxShadow: deepMode ? 'inset 0 2px 5px rgba(0,0,0,0.13), inset 0 1px 2px rgba(0,0,0,0.08)' : 'none',
          color: deepMode ? 'var(--accent)' : 'var(--fg-dim)',
          fontFamily: 'var(--font-family)', fontSize: '0.72rem', fontWeight: 400, transition: 'all 0.15s',
          '&:hover': { borderColor: 'var(--accent)', color: 'var(--accent)' },
        }}>
          <Zap size={11} fill={deepMode ? 'var(--accent)' : 'none'} color={deepMode ? 'var(--accent)' : 'currentColor'} />
          Deep
        </Box>
        {query && (
          <Box component="button" type="submit" sx={{ border: 'none', bgcolor: 'var(--accent)', color: '#FFF', fontFamily: 'var(--font-family)', fontSize: '0.8rem', fontWeight: 500, px: 1.75, py: 0.6, borderRadius: '8px', cursor: 'pointer', flexShrink: 0, transition: 'opacity 0.12s', '&:hover': { opacity: 0.88 } }}>
            Search
          </Box>
        )}
      </Box>

      {/* Suggestions dropdown */}
      {showSugg && suggestions.length > 0 && (
        <Box sx={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          background: 'rgba(250,246,238,0.97)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          borderRadius: '12px',
          borderTop: '1px solid rgba(255,255,235,0.90)',
          borderLeft: '1px solid rgba(255,252,225,0.70)',
          borderRight: '1px solid rgba(185,165,128,0.18)',
          borderBottom: '1px solid rgba(178,158,120,0.18)',
          boxShadow: '0 8px 32px rgba(140,110,60,0.12)',
          overflow: 'hidden', zIndex: 50,
        }}>
          {suggestions.map((s, i) => (
            <Box
              key={i}
              onMouseDown={e => { e.preventDefault(); setQuery(s); setShowSugg(false); onSubmit(); }}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                px: 2, py: 1,
                fontFamily: 'var(--font-family)', fontSize: '0.88rem', fontWeight: 400,
                color: 'var(--fg-primary)', cursor: 'pointer',
                borderBottom: i < suggestions.length - 1 ? '1px solid var(--border)' : 'none',
                transition: 'background 0.12s',
                '&:hover': { background: 'rgba(249,115,22,0.07)' },
              }}
            >
              <Search size={13} style={{ color: 'var(--fg-dim)', flexShrink: 0 }} />
              {s}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ExplorePage() {
  const navigate = useNavigate();

  const [query,        setQuery]        = useState('');
  const [phase,        setPhase]        = useState('idle');
  const [sources,      setSources]      = useState([]);
  const [answer,       setAnswer]       = useState('');
  const [errorMsg,     setErrorMsg]     = useState('');
  const [saved,        setSaved]        = useState(false);
  const [streaming,    setStreaming]    = useState(false);
  const [deepMode,     setDeepMode]     = useState(false);
  const [isDeepSearch, setIsDeepSearch] = useState(false);
  const [deepLabel,    setDeepLabel]    = useState('');
  const [toast,        setToast]        = useState({ show: false, message: '' });
  const abortRef = useRef(null);

  const [contradictions,  setContradictions]  = useState(null);
  const [followUpBlocks,  setFollowUpBlocks]  = useState([]);
  const [relatedSearches, setRelatedSearches] = useState([]);
  const [loadingRelated,  setLoadingRelated]  = useState(false);
  const [visualQuery,     setVisualQuery]     = useState('');
  const [stockData,       setStockData]       = useState(null);
  const { articles: trendingArticles, trending: isTrending, spinning: trendingSpinning, refetch: refetchTrending } = useTrendingChips();
  const topOffset = useTopOffset();
  const { settings } = useSettings();
  const followUpAbortRef  = useRef(null);
  const lastBlockRef      = useRef(null);
  const submittedQueryRef = useRef('');

  useEffect(() => {
    if (followUpBlocks.length > 0) {
      setTimeout(() => lastBlockRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    }
  }, [followUpBlocks.length]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qParam = params.get('q');
    if (qParam?.trim()) {
      setQuery(qParam.trim());
      runSearch(qParam.trim(), false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const runSearch = useCallback(async (q, isDeep = false) => {
    if (!q?.trim()) return;
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    setPhase('searching');
    setSources([]); setAnswer(''); setSaved(false); setErrorMsg('');
    setStreaming(true); setContradictions(null); setFollowUpBlocks([]);
    setRelatedSearches([]); setLoadingRelated(false); setIsDeepSearch(false);
    setStockData(null);
    setDeepLabel(isDeep ? '1/2' : '');
    setVisualQuery(deriveImageQuery(q.trim()));
    submittedQueryRef.current = q.trim();
    if (followUpAbortRef.current) followUpAbortRef.current.abort();

    let accumulatedAnswer = '';

    const readStream = async (queryStr, skipSources = false) => {
      const res = await fetch(`${API}/explore/search`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryStr }), signal,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop();
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') { setStreaming(false); continue; }
          try {
            const evt = JSON.parse(raw);
            if      (evt.type === 'sources' && !skipSources) { setSources(evt.sources || []); addSourcesToLibrary(evt.sources || [], submittedQueryRef.current); }
            else if (evt.type === 'chunk')                   { accumulatedAnswer += evt.text; setAnswer(prev => prev + evt.text); }
            else if (evt.type === 'error')                   setErrorMsg(evt.text);
            else if (evt.type === 'contradictions')          setContradictions(evt.data === null ? false : evt.data);
            else if (evt.type === 'stock' && !skipSources)   setStockData(evt.data);
          } catch { /* ignore malformed sse */ }
        }
      }
    };

    let searchSuccess = false;
    try {
      setPhase('results');
      await readStream(q.trim());
      if (isDeep) {
        setDeepLabel('2/2'); setStreaming(true);
        setAnswer(prev => prev + '\n\n## Additional context\n\n');
        await readStream(`${q.trim()} detailed analysis`, true);
        setIsDeepSearch(true);
      }
      searchSuccess = true;
    } catch (err) {
      if (err.name !== 'AbortError') { setErrorMsg(err.message); setPhase('error'); }
    } finally {
      setStreaming(false); setDeepLabel(''); setDeepMode(false);
      if (searchSuccess && accumulatedAnswer) {
        setLoadingRelated(true);
        fetch(`${API}/explore/related`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q.trim(), answer_snippet: accumulatedAnswer.slice(0, 500) }),
        }).then(r => r.json()).then(data => setRelatedSearches(data.related || [])).catch(() => {}).finally(() => setLoadingRelated(false));
      }
    }
  }, []);

  const handleSubmit = () => { if (query.trim()) runSearch(query, deepMode); };

  const handleSave = useCallback(() => {
    if (!answer) return;
    // Download as markdown
    const filename = `quarry-${query.slice(0, 40).replace(/\s+/g, '-')}-${Date.now()}.md`;
    const content  = `# ${query}\n\n${answer}\n\n---\n*Saved from Quarry*`;
    const blob     = new Blob([content], { type: 'text/markdown' });
    const url      = URL.createObjectURL(blob);
    const a        = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    // Persist to localStorage
    const firstPara = answer.replace(/^#+\s+.+$/gm, '').replace(/\*\*/g, '').replace(/\[(\d+)\]/g, '').replace(/\n+/g, ' ').trim().slice(0, 200);
    addSaved(query, firstPara);
    setSaved(true);
  }, [answer, query]);

  const handleShare = useCallback(() => {
    const q = submittedQueryRef.current || query;
    if (!q) return;
    const url = `${window.location.origin}${window.location.pathname}?q=${encodeURIComponent(q)}`;
    navigator.clipboard.writeText(url).then(() => {
      setToast({ show: true, message: 'Link copied to clipboard' });
      setTimeout(() => setToast(t => ({ ...t, show: false })), 2000);
    });
  }, [query]);

  const runFollowUp = useCallback(async followUpText => {
    if (followUpBlocks.length >= MAX_FOLLOW_UPS) return;
    if (followUpAbortRef.current) followUpAbortRef.current.abort();
    followUpAbortRef.current = new AbortController();

    const blockId = `fu_${Date.now()}`;
    const followUpVisualQuery = deriveImageQuery(followUpText, submittedQueryRef.current);
    setFollowUpBlocks(prev => [...prev, { id: blockId, question: followUpText, sources: [], answer: '', streaming: true, errorMsg: '', relatedSearches: [], loadingRelated: false, visualQuery: followUpVisualQuery }]);

    let blockAnswer = '';
    try {
      const res = await fetch(`${API}/explore/search`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: followUpText, context: submittedQueryRef.current }),
        signal: followUpAbortRef.current.signal,
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || `HTTP ${res.status}`); }

      const reader = res.body.getReader(), decoder = new TextDecoder();
      let buf = '';
      const update = updater => setFollowUpBlocks(prev => prev.map(b => b.id === blockId ? updater(b) : b));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n\n'); buf = parts.pop();
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') { update(b => ({ ...b, streaming: false })); break; }
          try {
            const evt = JSON.parse(raw);
            if      (evt.type === 'sources') update(b => ({ ...b, sources: evt.sources || [] }));
            else if (evt.type === 'chunk')   { blockAnswer += evt.text; update(b => ({ ...b, answer: b.answer + evt.text })); }
            else if (evt.type === 'error')   update(b => ({ ...b, errorMsg: evt.text }));
          } catch { /* ignore */ }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') setFollowUpBlocks(prev => prev.map(b => b.id === blockId ? { ...b, streaming: false, errorMsg: err.message } : b));
    } finally {
      setFollowUpBlocks(prev => prev.map(b => b.id === blockId ? { ...b, streaming: false, loadingRelated: !!blockAnswer, visualQuery: followUpVisualQuery } : b));
      if (blockAnswer) {
        fetch(`${API}/explore/related`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: followUpText, answer_snippet: blockAnswer.slice(0, 500) }) })
          .then(r => r.json())
          .then(data => setFollowUpBlocks(prev => prev.map(b => b.id === blockId ? { ...b, relatedSearches: data.related || [], loadingRelated: false } : b)))
          .catch(() => setFollowUpBlocks(prev => prev.map(b => b.id === blockId ? { ...b, loadingRelated: false } : b)));
      }
    }
  }, [followUpBlocks.length]);

  const resetSearch = () => {
    if (followUpAbortRef.current) followUpAbortRef.current.abort();
    setPhase('idle'); setAnswer(''); setSources([]);
    setQuery(''); setErrorMsg(''); setFollowUpBlocks([]);
    setIsDeepSearch(false); setDeepLabel(''); setStockData(null);
  };

  const newSearch = q => { setQuery(q); runSearch(q); };

  // ── Home (idle) ──
  if (phase === 'idle') {
    return (
      <>
        <Box sx={{ ...PAGE_BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', minHeight: '100vh', gap: 2, px: 3, pb: 6, paddingTop: `${topOffset + 16}px` }}>

          {/* ── Calendar marquee ── */}
          {settings.showCalendar && (
            <Box sx={{
              width: '100vw', maxWidth: '100vw', mx: 'auto',
              py: 0.85,
              background: 'rgba(210,200,185,0.28)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              borderBottom: '1px solid rgba(0,0,0,0.07)',
              borderTop: '1px solid rgba(255,255,255,0.35)',
            }}>
              <MonthlyFiguresMarquee />
            </Box>
          )}

          {/* ── Masthead ── */}
          <Box sx={{ textAlign: 'center', mb: 0.5 }}>
            {/* Top rule with label */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
              <Box sx={{ flex: 1, height: '1px', bgcolor: 'var(--fg-primary)', opacity: 0.12 }} />
              <Typography sx={{
                fontFamily: 'var(--font-family)', fontSize: '0.55rem', fontWeight: 500,
                color: 'var(--fg-dim)', letterSpacing: '0.26em', textTransform: 'uppercase',
              }}>
                AI Research Engine
              </Typography>
              <Box sx={{ flex: 1, height: '1px', bgcolor: 'var(--fg-primary)', opacity: 0.12 }} />
            </Box>

            {/* Serif wordmark */}
            <Typography sx={{
              fontFamily: 'var(--font-serif)', fontSize: { xs: '3rem', sm: '3.8rem' },
              fontWeight: 600, color: 'var(--fg-primary)', letterSpacing: '-0.02em',
              lineHeight: 1, mb: 0.75,
            }}>
              Quarry
            </Typography>

            {/* Bottom rule */}
            <Box sx={{ height: '1px', bgcolor: 'var(--fg-primary)', opacity: 0.12, mb: 1 }} />

            {/* Tagline */}
            <Typography sx={{
              fontFamily: 'var(--font-family)', fontSize: '0.82rem', fontStyle: 'italic',
              color: 'var(--fg-secondary)', letterSpacing: '0.02em',
            }}>
              Search the web. Synthesise sources. Cite with confidence.
            </Typography>
          </Box>

          <HomeSearchBar query={query} setQuery={setQuery} onSubmit={handleSubmit} deepMode={deepMode} onToggleDeep={() => setDeepMode(d => !d)} />

          {/* Trending news cards */}
          <Box sx={{ width: '100%', maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: isTrending ? 'var(--accent)' : 'var(--fg-dim)', flexShrink: 0, animation: isTrending ? 'trendingPulse 1.4s ease-in-out infinite' : 'none' }} />
              <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.55rem', fontWeight: 500, color: 'var(--fg-dim)', letterSpacing: '0.10em', textTransform: 'uppercase' }}>
                {isTrending ? 'Trending' : 'Suggested'}
              </Typography>
              <Box onClick={refetchTrending} sx={{ cursor: 'pointer', opacity: 0.5, '&:hover': { opacity: 1 }, ml: 0.25 }}>
                <RefreshCw size={10} color="var(--fg-dim)" style={{ animation: trendingSpinning ? 'spin 1s linear infinite' : 'none' }} />
              </Box>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, width: '100%' }}>
              {trendingArticles.slice(0, 6).map((art, i) => (
                <Box
                  key={i}
                  onClick={() => newSearch(art.title)}
                  sx={{
                    borderRadius: '12px', overflow: 'hidden', cursor: 'pointer',
                    border: '1px solid var(--border)',
                    background: 'var(--gbtn-bg)',
                    backdropFilter: 'blur(12px)',
                    transition: 'all 0.16s',
                    display: 'flex', flexDirection: 'column',
                    '&:hover': {
                      borderColor: 'rgba(249,115,22,0.35)',
                      transform: 'translateY(-1px)',
                      boxShadow: '0 4px 16px rgba(140,110,60,0.12)',
                    },
                  }}
                >
                  {/* Image — 16:9 aspect ratio */}
                  {art.image ? (
                    <Box sx={{ width: '100%', aspectRatio: '16/9', flexShrink: 0, overflow: 'hidden', borderRadius: '12px 12px 0 0' }}>
                      <Box
                        component="img"
                        src={art.image}
                        alt=""
                        onError={e => { e.target.parentElement.style.display = 'none'; }}
                        sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    </Box>
                  ) : (
                    <Box sx={{ width: '100%', aspectRatio: '16/9', flexShrink: 0, borderRadius: '12px 12px 0 0', background: 'linear-gradient(135deg, rgba(249,115,22,0.08) 0%, rgba(175,150,105,0.12) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography sx={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', opacity: 0.18 }}>Q</Typography>
                    </Box>
                  )}

                  {/* Text */}
                  <Box sx={{ p: '8px 10px 10px', flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {art.source?.name && (
                      <Typography sx={{
                        fontFamily: 'var(--font-family)', fontSize: '0.5rem', fontWeight: 600,
                        color: 'var(--fg-dim)', letterSpacing: '0.12em', textTransform: 'uppercase',
                      }}>
                        {art.source.name}
                      </Typography>
                    )}
                    <Typography sx={{
                      fontFamily: 'var(--font-family)', fontSize: '0.72rem', fontWeight: 500,
                      color: 'var(--fg-primary)', lineHeight: 1.3,
                      display: '-webkit-box', WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {art.title}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>

          {/* Primary CTAs — 2-column side by side, aligned with news grid */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mt: 0.5, width: '100%', maxWidth: 640 }}>

            {/* Quarry Research */}
            <Box onClick={() => navigate('/research')} sx={{
              display: 'flex', flexDirection: 'column', gap: 1,
              px: 2, py: 1.5,
              borderRadius: '12px',
              border: '1px solid rgba(0,0,0,0.10)',
              background: 'linear-gradient(135deg, rgba(255,252,245,0.9) 0%, rgba(248,243,232,0.8) 100%)',
              cursor: 'pointer',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              transition: 'all 0.18s ease',
              '&:hover': {
                borderColor: 'rgba(249,115,22,0.35)',
                boxShadow: '0 4px 16px rgba(249,115,22,0.10)',
                transform: 'translateY(-1px)',
              },
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ width: 36, height: 36, borderRadius: '10px', bgcolor: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FlaskConical size={18} color="var(--accent)" />
                </Box>
                <Box sx={{ color: 'var(--fg-dim)', opacity: 0.4, fontSize: '1rem' }}>›</Box>
              </Box>
              <Box>
                <Typography sx={{ fontFamily: 'var(--font-serif)', fontSize: '0.92rem', fontWeight: 600, color: 'var(--fg-primary)', lineHeight: 1.2 }}>
                  Quarry Research
                </Typography>
                <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.68rem', fontWeight: 300, color: 'var(--fg-secondary)', mt: 0.3, lineHeight: 1.4 }}>
                  AI research assistant for papers, topics & citations
                </Typography>
              </Box>
            </Box>

            {/* Finance Terminal */}
            <Box onClick={() => navigate('/finance')} sx={{
              display: 'flex', flexDirection: 'column', gap: 1,
              px: 2, py: 1.5,
              borderRadius: '12px',
              border: '1px solid rgba(0,0,0,0.10)',
              background: 'linear-gradient(135deg, rgba(255,248,235,0.95) 0%, rgba(254,242,220,0.85) 100%)',
              cursor: 'pointer',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              transition: 'all 0.18s ease',
              '&:hover': {
                borderColor: 'rgba(249,115,22,0.40)',
                boxShadow: '0 4px 16px rgba(249,115,22,0.12)',
                transform: 'translateY(-1px)',
              },
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ width: 36, height: 36, borderRadius: '10px', bgcolor: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingUp size={18} color="var(--accent)" />
                </Box>
                <Box sx={{ color: 'var(--fg-dim)', opacity: 0.4, fontSize: '1rem' }}>›</Box>
              </Box>
              <Box>
                <Typography sx={{ fontFamily: 'var(--font-serif)', fontSize: '0.92rem', fontWeight: 600, color: 'var(--fg-primary)', lineHeight: 1.2 }}>
                  Finance Terminal
                </Typography>
                <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.68rem', fontWeight: 300, color: 'var(--fg-secondary)', mt: 0.3, lineHeight: 1.4 }}>
                  Live prices, charts & market AI with QFL commands
                </Typography>
              </Box>
            </Box>

          </Box>

          {/* Saved searches shortcut */}
          {(() => { const savedCount = getSaved().length; return savedCount > 0 && (
            <Box onClick={() => navigate('/saved')} sx={{
              display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.7,
              borderRadius: '8px', border: '1px solid var(--border)',
              background: 'rgba(30,58,138,0.06)', cursor: 'pointer',
              transition: 'all 0.16s ease',
              '&:hover': { background: 'rgba(30,58,138,0.12)', borderColor: 'rgba(30,58,138,0.25)', transform: 'translateY(-1px)', boxShadow: '0 3px 10px rgba(30,58,138,0.08)' },
            }}>
              <BookmarkPlus size={13} color="var(--blue)" />
              <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.76rem', fontWeight: 500, color: 'var(--fg-primary)' }}>
                {savedCount} saved search{savedCount !== 1 ? 'es' : ''}
              </Typography>
            </Box>
          ); })()}

          {/* Settings link */}
          <Box onClick={() => navigate('/settings')} sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mt: 0.5, cursor: 'pointer', opacity: 0.38, '&:hover': { opacity: 0.75 }, transition: 'opacity 0.15s' }}>
            <Settings size={11} color="var(--fg-dim)" />
            <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.65rem', color: 'var(--fg-dim)' }}>Settings</Typography>
          </Box>

          <style>{`
            @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
          `}</style>
        </Box>
        <Toast show={toast.show} message={toast.message} />
      </>
    );
  }

  // ── Searching ──
  if (phase === 'searching') {
    return (
      <Box sx={{ ...PAGE_BG, height: '100vh', overflowY: 'auto', paddingTop: `${topOffset}px` }}>
        <TopBar
          query={query} setQuery={setQuery} onSubmit={handleSubmit}
          deepMode={deepMode} onToggleDeep={() => setDeepMode(d => !d)}
          onReset={resetSearch} answer={answer} onSave={handleSave} onShare={handleShare}
          saved={saved} navigate={navigate} streaming={streaming}
        />
        <Box sx={{ maxWidth: 1100, mx: 'auto', px: 3, pt: 4, pb: 8 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <CircularProgress size={14} sx={{ color: 'var(--accent)' }} />
            <Typography sx={{ fontFamily: 'var(--font-family)', fontWeight: 400, fontSize: '0.8rem', color: 'var(--fg-secondary)' }}>
              {deepLabel === '1/2' ? '⚡ Deep Search 1/2: Searching the web…' :
               deepLabel === '2/2' ? '⚡ Deep Search 2/2: Running deep analysis…' :
               'Searching the web and reasoning…'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <GlassCard style={{ padding: '22px 26px' }}>
                <Skeleton variant="rectangular" width="35%" height={10} sx={{ borderRadius: 4, bgcolor: 'var(--bg-tertiary)', mb: 2 }} />
                <Skeleton variant="rectangular" width="70%" height={26} sx={{ borderRadius: 6, bgcolor: 'var(--bg-tertiary)', mb: 1 }} />
                <Skeleton variant="rectangular" width="55%" height={26} sx={{ borderRadius: 6, bgcolor: 'var(--bg-tertiary)', mb: 2 }} />
                <Box sx={{ height: '1px', bgcolor: 'var(--border)', mb: 2 }} />
                {[...Array(6)].map((_, i) => <Skeleton key={i} variant="text" width={`${65 + (i % 4) * 8}%`} sx={{ bgcolor: 'var(--bg-tertiary)', height: 22, mb: 0.5 }} />)}
              </GlassCard>
            </Box>
            <Box sx={{ width: { xs: '100%', md: '300px' }, flexShrink: 0 }}>
              <GlassCard style={{ padding: '16px' }}>
                <Skeleton variant="rectangular" width="40%" height={10} sx={{ borderRadius: 4, bgcolor: 'var(--bg-tertiary)', mb: 1.5 }} />
                {[...Array(5)].map((_, i) => <Skeleton key={i} variant="rectangular" height={44} sx={{ borderRadius: '10px', bgcolor: 'var(--bg-tertiary)', mb: 0.75 }} />)}
              </GlassCard>
            </Box>
          </Box>
        </Box>
        <Toast show={toast.show} message={toast.message} />
      </Box>
    );
  }

  // ── Results ──
  const lastFollowUp = followUpBlocks.length > 0 ? followUpBlocks[followUpBlocks.length - 1] : null;
  const canFollowUp  = phase === 'results' && (lastFollowUp ? !lastFollowUp.streaming : (!streaming && answer.length > 0));

  return (
    <Box sx={{ ...PAGE_BG, height: '100vh', display: 'flex', flexDirection: 'column', paddingTop: `${topOffset}px` }}>
      <TopBar
        query={query} setQuery={setQuery} onSubmit={handleSubmit}
        deepMode={deepMode} onToggleDeep={() => setDeepMode(d => !d)}
        onReset={resetSearch} answer={answer} onSave={handleSave} onShare={handleShare}
        saved={saved} navigate={navigate} streaming={streaming}
      />

      {/* Scrollable content */}
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        <Box sx={{ maxWidth: 1100, mx: 'auto', px: 3, pt: 3, pb: 4, display: 'flex', flexDirection: 'column' }}>
          <ResultBlock
            key={submittedQueryRef.current}
            question={submittedQueryRef.current || query} sources={sources} answer={answer}
            streaming={streaming} errorMsg={errorMsg}
            isFollowUp={false} onNewSearch={newSearch}
            isDeepSearch={isDeepSearch} deepLabel={deepLabel}
            relatedSearches={relatedSearches} loadingRelated={loadingRelated}
            visualQuery={visualQuery} contradictions={contradictions}
            stockData={stockData}
          />

          {followUpBlocks.map((block, i) => (
            <Box key={block.id} ref={i === followUpBlocks.length - 1 ? lastBlockRef : null}>
              <ThreadDivider />
              <ResultBlock
                question={block.question} sources={block.sources}
                answer={block.answer} streaming={block.streaming}
                errorMsg={block.errorMsg} isFollowUp={true} onNewSearch={newSearch}
                relatedSearches={block.relatedSearches || []}
                loadingRelated={block.loadingRelated || false}
                visualQuery={block.visualQuery || ''}
              />
            </Box>
          ))}
        </Box>
      </Box>

      {/* Sticky follow-up bar */}
      {(canFollowUp || followUpBlocks.length >= MAX_FOLLOW_UPS) && (
        <Box sx={{
          borderTop: '1px solid var(--border)',
          background: 'rgba(237,232,223,0.82)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          px: 3, py: 1.25,
          flexShrink: 0,
        }}>
          <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
            <FollowUpBar onSubmit={runFollowUp} atMax={followUpBlocks.length >= MAX_FOLLOW_UPS} />
          </Box>
        </Box>
      )}

      <style>{`@keyframes blinkPulse { 50% { opacity: 0; } }`}</style>
      <Toast show={toast.show} message={toast.message} />
    </Box>
  );
}
