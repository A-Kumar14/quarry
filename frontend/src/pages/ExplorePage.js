import React, { useState, useRef, useCallback, useMemo, useEffect, lazy, Suspense } from 'react';
import { Box, Typography, Skeleton, Tooltip, CircularProgress } from '@mui/material';
import { Search, BookmarkPlus, RotateCcw, ExternalLink, RefreshCw, CornerDownRight, Link, Zap, ChevronDown, FlaskConical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import GlassCard from '../components/GlassCard';
import NewsTab from '../components/NewsTab';
import ImagesTab from '../components/ImagesTab';
import PerspectivesTab from '../components/PerspectivesTab';
import { getSourceQuality, QUALITY_COLOR } from '../utils/sourceQuality';
import Toast from '../components/Toast';
import { ScoutFigurine, ArchivistFigurine, WandererFigurine, PixelWordmark, floatIdleCSS } from '../components/PixelFigurines';

const KnowledgeGraph = lazy(() => import('../components/KnowledgeGraph'));

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const MAX_FOLLOW_UPS = 5;

const ANSWER_STYLES = {
  '& p':           { fontFamily: 'var(--font-family)', fontSize: '0.9rem', lineHeight: 1.72, color: 'var(--fg-primary)', my: 0.75 },
  '& h1, & h2, & h3': { fontFamily: 'var(--font-family)', fontWeight: 700, color: 'var(--fg-primary)', mt: 2, mb: 0.5 },
  '& h1':          { fontSize: '1.1rem' },
  '& h2':          { fontSize: '0.95rem' },
  '& h3':          { fontSize: '0.85rem' },
  '& code':        { fontFamily: 'var(--font-mono)', fontSize: '0.82rem', bgcolor: 'var(--bg-tertiary)', px: '5px', py: '1px', borderRadius: '4px', border: '1px solid var(--border)' },
  '& pre':         { bgcolor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', p: 1.5, overflowX: 'auto', '& code': { border: 'none', bgcolor: 'transparent' } },
  '& ul, & ol':    { pl: 2.5, my: 0.5 },
  '& li':          { color: 'var(--fg-primary)', fontSize: '0.9rem', lineHeight: 1.65, mb: 0.25 },
  '& strong':      { color: 'var(--fg-primary)', fontWeight: 700 },
  '& em':          { color: 'var(--fg-secondary)' },
  '& blockquote':  { borderLeft: '3px solid var(--accent)', pl: 1.5, ml: 0, color: 'var(--fg-secondary)', fontStyle: 'italic' },
  '& a':           { color: 'var(--accent)', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } },
  '& table':       { borderCollapse: 'collapse', width: '100%', my: 1 },
  '& th, & td':    { border: '1px solid var(--border)', p: '6px 12px', fontSize: '0.83rem', color: 'var(--fg-primary)' },
  '& th':          { bgcolor: 'var(--bg-secondary)', fontWeight: 700 },
  '& hr':          { border: 'none', borderTop: '1px solid var(--border)', my: 1.5 },
};

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
            width: 18, height: 18, fontSize: '0.6rem', fontWeight: 700,
            fontFamily: 'var(--font-family)', color: '#FFF',
            background: 'var(--accent)', borderRadius: '50%',
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

function SourceChip({ src, index }) {
  const quality    = getSourceQuality(src.url);
  const dotColor   = QUALITY_COLOR[quality];

  return (
    <a href={src.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 0.75,
        px: 1.25, py: 0.6,
        border: '1px solid var(--border)',
        borderRadius: '8px',
        bgcolor: 'rgba(255,255,255,0.5)',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
        '&:hover': { borderColor: 'var(--accent)' },
      }}>
        {src.favicon && (
          <img src={src.favicon} alt="" width={13} height={13}
            style={{ flexShrink: 0 }}
            onError={e => { e.target.style.display = 'none'; }}
          />
        )}
        
        <Box sx={{
          width: 6, height: 6, borderRadius: '50%',
          bgcolor: dotColor, flexShrink: 0,
        }} />
        <Typography noWrap sx={{ fontFamily: 'var(--font-family)', fontSize: '0.72rem', fontWeight: 500, color: 'var(--fg-secondary)', maxWidth: 160 }}>
          [{index + 1}] {src.title || src.url}
        </Typography>
        <ExternalLink size={10} color="var(--fg-dim)" />
      </Box>
    </a>
  );
}

const FALLBACK_SUGGESTIONS = [
  { title: 'Latest breakthroughs in quantum computing' },
  { title: 'How does RAG work in AI systems?' },
  { title: 'Best open source LLMs in 2026' },
  { title: 'Explain transformer attention mechanisms' },
  { title: 'FastAPI vs Flask for production APIs' },
  { title: 'Top AI coding assistants compared' },
];

function useTrendingChips() {
  const [articles,  setArticles]  = useState(FALLBACK_SUGGESTIONS);
  const [trending,  setTrending]  = useState(false);
  const [spinning,  setSpinning]  = useState(false);

  const fetchTrending = useCallback(async () => {
    setSpinning(true);
    try {
      const res  = await fetch(`${API}/explore/trending-news?max=6`);
      if (!res.ok) throw new Error('trending error');
      const data = await res.json();
      const arts = (data.articles || []).filter(a => a.title).slice(0, 6);
      if (arts.length >= 3) {
        setArticles(arts);
        setTrending(true);
      }
    } catch {
      // silent fallback — keep existing articles
    } finally {
      setSpinning(false);
    }
  }, []);

  useEffect(() => { fetchTrending(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { articles, trending, spinning, refetch: fetchTrending };
}

function extractGraphData(answer, sources) {
  const nodes = [], links = [];
  const seen  = new Set();

  const addNode = (id, name, type, url) => {
    if (!seen.has(id)) { seen.add(id); nodes.push({ id, name, type, url }); }
  };

  addNode('__query__', 'Query', 'query');

  sources.forEach((src, i) => {
    const id    = `src_${i}`;
    const label = src.title ? src.title.slice(0, 32) + (src.title.length > 32 ? '…' : '') : `Source ${i + 1}`;
    addNode(id, label, 'source', src.url);
    links.push({ source: '__query__', target: id });
  });

  const headers = [...answer.matchAll(/^#{2,3}\s+(.+)$/gm)].map(m => m[1].trim());
  headers.forEach((h, i) => {
    const id = `topic_${i}`;
    addNode(id, h.slice(0, 40), 'topic');
    links.push({ source: '__query__', target: id });
  });

  const bold = [...new Set([...answer.matchAll(/\*\*([^*]{3,40})\*\*/g)].map(m => m[1].trim()))];
  bold.slice(0, 12).forEach((b, i) => {
    const id     = `concept_${i}`;
    const target = headers.length > 0 ? `topic_${Math.min(i, headers.length - 1)}` : '__query__';
    addNode(id, b, 'concept');
    links.push({ source: target, target: id });
  });

  return { nodes, links };
}

function extractQuickSummary(answer) {
  const listItems = [];
  for (const line of answer.split('\n')) {
    const m = line.match(/^[-*+]\s+(.{15,})/);
    if (m) listItems.push(m[1].trim());
    if (listItems.length >= 3) break;
  }
  if (listItems.length >= 2) return listItems.slice(0, 3);

  // Fallback: first sentences from prose
  const text = answer
    .replace(/^#+\s+.+$/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\[(\d+)\]/g, '')
    .replace(/\n+/g, ' ')
    .trim();
  const sentences = (text.match(/[^.!?]+[.!?]+/g) || [])
    .map(s => s.trim())
    .filter(s => s.length > 40);
  return sentences.slice(0, 3);
}


// ── Citation linkifier ────────────────────────────────────────────────────────
// The LLM outputs [1], [2] as plain text. Convert them to markdown links so
// CitationLink receives an <a> element it can render as a numbered badge.
function linkifyCitations(text, sources) {
  return text.replace(/\[(\d+)\]/g, (match, num) => {
    const src = sources[parseInt(num, 10) - 1];
    return src?.url ? `[[${num}]](${src.url})` : match;
  });
}

// ── Visual query derivation ───────────────────────────────────────────────────
// Strip question words so images are about the *subject*, not the question form.
const QUESTION_STRIP = /^(what (?:is|are|was|were)|who (?:is|are|was|were)|how (?:does|do|is|are|to|can)|why (?:is|are|does|do|did)|when (?:is|are|did|was)|where (?:is|are|was)|which (?:is|are)|tell me (?:about|of)?|explain|describe|find|give me|show me|list (?:(?:the|of) )?)\s+(?:(?:the|a|an) )?/i;

function deriveImageQuery(query, context = '') {
  const stripped = query.trim().replace(QUESTION_STRIP, '').trim();
  if (context) {
    const contextCore = context.replace(QUESTION_STRIP, '').trim().split(' ').slice(0, 4).join(' ');
    return `${contextCore} ${stripped}`.trim().slice(0, 80);
  }
  return stripped.slice(0, 80) || query.trim().slice(0, 80);
}

// ── Inline image strip (3 photos in the Result tab) ──────────────────────────
function InlineImages({ visualQuery }) {
  const [photos, setPhotos] = useState([]);

  useEffect(() => {
    if (!visualQuery) return;
    let cancelled = false;
    fetch(`${API}/explore/images?q=${encodeURIComponent(visualQuery)}&page=0`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!cancelled && data?.images?.length) setPhotos(data.images.slice(0, 3));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [visualQuery]);

  if (!photos.length) return null;

  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
      {photos.map((photo, i) => (
        <a
          key={i}
          href={photo.source || '#'}
          target="_blank"
          rel="noopener noreferrer"
          style={{ flex: 1, borderRadius: 10, overflow: 'hidden', display: 'block', textDecoration: 'none', flexShrink: 0 }}
        >
          <img
            src={photo.image}
            alt={photo.title || visualQuery}
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

function QuickSummary({ answer, isDeepSearch }) {
  const [open, setOpen] = useState(false);

  const bullets = extractQuickSummary(answer);
  if (!bullets.length || answer.length < 300) return null;

  return (
    <div style={{ marginBottom: 14 }}>
      {/* Collapsed trigger pill */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display:        'inline-flex',
          alignItems:     'center',
          gap:            6,
          cursor:         'pointer',
          padding:        '4px 10px 4px 8px',
          borderRadius:   20,
          border:         '1px solid var(--border)',
          background:     'rgba(255,255,255,0.55)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          userSelect:     'none',
          marginBottom:   open ? 10 : 0,
        }}
      >
        <span style={{
          fontFamily: 'var(--font-family)', fontSize: '0.6rem', fontWeight: 700,
          color: 'var(--accent)', letterSpacing: '0.09em', textTransform: 'uppercase',
        }}>
          Quick Summary
        </span>
        {isDeepSearch && (
          <span style={{
            display: 'flex', alignItems: 'center', gap: 2,
            padding: '1px 6px', borderRadius: 20, fontSize: 9,
            fontFamily: 'var(--font-family)', fontWeight: 700,
            color: '#b45309', background: 'rgba(249,115,22,0.12)',
            border: '1px solid rgba(249,115,22,0.35)',
          }}>
            <Zap size={8} fill="#b45309" color="#b45309" /> Deep
          </span>
        )}
        <ChevronDown
          size={13}
          color="var(--fg-dim)"
          style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </div>

      {/* Expanded content */}
      {open && (
        <GlassCard style={{
          borderLeft: '3px solid var(--accent)',
          padding: '14px 18px',
          background: 'rgba(255, 255, 255, 0.70)',
        }}>
          <ul style={{ paddingLeft: 18, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {bullets.map((b, i) => (
              <li key={i} style={{
                fontFamily: 'var(--font-family)', fontSize: '0.85rem',
                color: 'var(--fg-primary)', lineHeight: 1.55,
              }}>
                {b}
              </li>
            ))}
          </ul>
        </GlassCard>
      )}
    </div>
  );
}

function CollapsibleAnswer({ answer, streaming, sources }) {
  const linked = useMemo(() => linkifyCitations(answer, sources), [answer, sources]);
  return (
    <Box sx={ANSWER_STYLES}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{ a: ({ href, children }) => <CitationLink href={href} sources={sources}>{children}</CitationLink> }}
      >
        {linked}
      </ReactMarkdown>
      {streaming && (
        <Box component="span" sx={{
          display: 'inline-block', width: 7, height: 15,
          bgcolor: 'var(--accent)', borderRadius: '2px',
          animation: 'blinkPulse 1s step-end infinite',
          verticalAlign: 'text-bottom', ml: 0.5,
        }} />
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

  const submit = () => {
    const t = text.trim();
    if (t) { onSubmit(t); setText(''); }
  };

  if (atMax) {
    return (
      <Box sx={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        py: 1.5, borderRadius: '14px',
        border: '1px dashed var(--border)',
        fontFamily: 'var(--font-family)', fontSize: '0.8rem', color: 'var(--fg-dim)',
      }}>
        Start a new search to continue
      </Box>
    );
  }

  return (
    <Box
      component="form"
      onSubmit={e => { e.preventDefault(); submit(); }}
      sx={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 1.5,
        borderRadius: '14px', px: 2, py: 1.25,
        background:           'rgba(255, 255, 255, 0.15)',
        backdropFilter:       'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border:               '1px solid rgba(255, 255, 255, 0.30)',
        boxShadow:            '0 4px 24px rgba(0, 0, 0, 0.06)',
        transition:           'box-shadow 0.2s',
        '&:focus-within': {
          boxShadow:   '0 4px 24px rgba(0,0,0,0.06), 0 0 0 3px var(--accent-dim)',
          borderColor: 'rgba(249,115,22,0.35)',
        },
      }}
    >
      <CornerDownRight size={15} color="var(--fg-dim)" strokeWidth={2} style={{ flexShrink: 0 }} />
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
        placeholder="Ask a follow-up..."
        autoComplete="off"
        style={{
          flex: 1, border: 'none', outline: 'none',
          background: 'transparent',
          fontSize: '0.9rem',
          fontFamily: 'var(--font-family)',
          color: 'var(--fg-primary)',
          padding: '4px 0',
        }}
      />
      {text.trim() && (
        <Box
          component="button"
          type="submit"
          sx={{
            border: 'none', bgcolor: 'var(--accent)', color: '#FFF',
            fontFamily: 'var(--font-family)', fontSize: '0.72rem', fontWeight: 600,
            px: 1.5, py: 0.5, borderRadius: '8px', cursor: 'pointer',
            flexShrink: 0, transition: 'opacity 0.12s',
            '&:hover': { opacity: 0.88 },
          }}
        >
          Ask
        </Box>
      )}
    </Box>
  );
}

function ResultBlock({ question, sources, answer, streaming, errorMsg, isFollowUp, onNewSearch, isDeepSearch, deepLabel, relatedSearches = [], loadingRelated = false, visualQuery = '' }) {
  const [activeTab, setActiveTab] = useState('answer');

  const graphData = useMemo(
    () => answer ? extractGraphData(answer, sources) : { nodes: [], links: [] },
    [answer, sources]
  );

  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      
      {isFollowUp && (
        <Box sx={{
          display: 'inline-flex', alignItems: 'center', gap: 0.75,
          px: 1.25, py: 0.4, borderRadius: '20px',
          background: 'rgba(0,0,0,0.05)',
          border: '1px solid rgba(0,0,0,0.08)',
          alignSelf: 'flex-start',
        }}>
          <Typography sx={{
            fontFamily: 'var(--font-family)', fontSize: '0.75rem',
            color: 'var(--fg-dim)', fontWeight: 500,
          }}>
            ↩ You asked: <span style={{ color: 'var(--fg-secondary)', fontWeight: 600 }}>{question}</span>
          </Typography>
        </Box>
      )}

      
      {errorMsg && (
        <Box sx={{ border: '1px solid var(--error)', bgcolor: 'rgba(220,38,38,0.06)', borderRadius: '10px', p: 1.5 }}>
          <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.8rem', color: 'var(--error)' }}>
            {errorMsg}
          </Typography>
        </Box>
      )}

      
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, alignItems: 'flex-start' }}>


        <Box sx={{ width: { xs: '100%', md: '35%' }, flexShrink: 0, display: activeTab === 'news' ? 'none' : 'flex', flexDirection: 'column', gap: 1.5 }}>
          {sources.length > 0 && (
            <GlassCard style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.55)' }}>
              <div style={{
                fontFamily: 'var(--font-family)', fontSize: '0.62rem', fontWeight: 700,
                color: 'var(--fg-dim)', letterSpacing: '0.07em', textTransform: 'uppercase',
                marginBottom: 10,
              }}>
                Sources · {sources.length}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {sources.map((src, i) => <SourceChip key={i} src={src} index={i} />)}
              </div>
            </GlassCard>
          )}

          {(answer || loadingRelated) && (relatedSearches.length > 0 || loadingRelated) && (
            <GlassCard style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.45)' }}>
              <div style={{
                fontFamily: 'var(--font-family)', fontSize: '0.62rem', fontWeight: 700,
                color: 'var(--fg-dim)', letterSpacing: '0.07em', textTransform: 'uppercase',
                marginBottom: 8,
              }}>
                Related searches
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {loadingRelated
                  ? [0, 1, 2].map(i => (
                      <Skeleton key={i} variant="rectangular" height={30} sx={{ borderRadius: '10px', bgcolor: 'var(--bg-tertiary)', width: `${75 + i * 8}%` }} />
                    ))
                  : relatedSearches.map(s => (
                      <div
                        key={s}
                        onClick={() => onNewSearch(s)}
                        style={{
                          fontFamily: 'var(--font-family)', fontSize: '0.76rem',
                          color: 'var(--fg-secondary)', padding: '5px 10px',
                          borderRadius: 10, cursor: 'pointer',
                          background: 'rgba(255,255,255,0.35)',
                          backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
                          border: '1px solid rgba(255,255,255,0.4)', transition: 'all 0.12s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'rgba(249,115,22,0.3)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--fg-secondary)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'; }}
                      >
                        {s}
                      </div>
                    ))
                }
              </div>
            </GlassCard>
          )}
        </Box>

        
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {answer ? (
            <GlassCard style={{
              padding: activeTab === 'news' ? '14px 16px 16px' : '20px 22px',
              background: 'rgba(255,255,255,0.80)',
            }}>
              <TabStrip active={activeTab} onChange={setActiveTab} />

              {activeTab === 'answer' && (
                <>
                  {deepLabel === '2/2' && streaming && (
                    <Box sx={{
                      display: 'flex', alignItems: 'center', gap: 1, mb: 1.5,
                      px: 1.25, py: 0.75, borderRadius: '10px',
                      background: 'rgba(249,115,22,0.08)',
                      border: '1px solid rgba(249,115,22,0.20)',
                    }}>
                      <CircularProgress size={11} sx={{ color: 'var(--accent)' }} />
                      <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.75rem', color: '#b45309', fontWeight: 500 }}>
                        Running deep analysis…
                      </Typography>
                    </Box>
                  )}
                  {visualQuery && <InlineImages visualQuery={visualQuery} />}
                  <QuickSummary answer={answer} isDeepSearch={isDeepSearch} />
                  <CollapsibleAnswer answer={answer} streaming={streaming} sources={sources} />
                </>
              )}

              {activeTab === 'graph' && (
                <Suspense fallback={
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress size={20} sx={{ color: 'var(--accent)' }} />
                  </Box>
                }>
                  <KnowledgeGraph nodes={graphData.nodes} links={graphData.links} />
                </Suspense>
              )}

              {activeTab === 'news' && (
                <NewsTab query={question} />
              )}

              {activeTab === 'images' && (
                <ImagesTab query={visualQuery || question} />
              )}

              {activeTab === 'perspectives' && (
                <PerspectivesTab query={question} />
              )}
            </GlassCard>
          ) : (
            <GlassCard style={{ padding: '20px 22px', background: 'rgba(255,255,255,0.80)' }}>
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} variant="text" width={`${65 + (i % 4) * 8}%`} sx={{ bgcolor: 'var(--bg-secondary)', height: 22, mb: 0.5 }} />
              ))}
            </GlassCard>
          )}
        </Box>
      </Box>
    </Box>
  );
}

function SearchBar({ query, setQuery, onSubmit, deepMode, onToggleDeep }) {
  const inputRef = useRef(null);
  const handleKey = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(); } };

  return (
    <Box
      component="form"
      onSubmit={e => { e.preventDefault(); onSubmit(); }}
      sx={{
        width: '100%', maxWidth: 680,
        display: 'flex', alignItems: 'center', gap: 1.5,
        borderRadius: '16px',
        px: 2, py: 1.25,
        transition: 'box-shadow 0.2s',
        background:           'rgba(255, 255, 255, 0.15)',
        backdropFilter:       'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border:               '1px solid rgba(255, 255, 255, 0.30)',
        boxShadow:            '0 4px 24px rgba(0, 0, 0, 0.06)',
        '&:focus-within': {
          boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 0 0 3px var(--accent-dim)',
          borderColor: 'rgba(249,115,22,0.35)',
        },
      }}
    >
      <Search size={17} color="var(--fg-dim)" strokeWidth={2} style={{ flexShrink: 0 }} />
      <input
        ref={inputRef}
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={handleKey}
        placeholder="Search the web..."
        autoComplete="off"
        style={{
          flex: 1, border: 'none', outline: 'none',
          background: 'transparent',
          fontSize: '0.92rem',
          fontFamily: 'var(--font-family)',
          color: 'var(--fg-primary)',
          padding: '4px 0',
        }}
      />
      
      <Box
        onClick={e => { e.preventDefault(); onToggleDeep?.(); }}
        sx={{
          display: 'flex', alignItems: 'center', gap: '3px',
          px: 1, py: 0.4, borderRadius: '8px', cursor: 'pointer', flexShrink: 0,
          border: deepMode ? '1px solid rgba(249,115,22,0.50)' : '1px solid var(--border)',
          bgcolor: deepMode ? 'rgba(249,115,22,0.10)' : 'transparent',
          color: deepMode ? 'var(--accent)' : 'var(--fg-dim)',
          fontFamily: 'var(--font-family)', fontSize: '0.72rem', fontWeight: 600,
          transition: 'all 0.15s',
          '&:hover': { borderColor: 'var(--accent)', color: 'var(--accent)' },
        }}
      >
        <Zap size={11} fill={deepMode ? 'var(--accent)' : 'none'} color={deepMode ? 'var(--accent)' : 'currentColor'} />
        Deep
      </Box>
      {query && (
        <Box
          component="button"
          type="submit"
          sx={{
            border: 'none', bgcolor: 'var(--accent)', color: '#FFF',
            fontFamily: 'var(--font-family)', fontSize: '0.72rem', fontWeight: 600,
            px: 1.5, py: 0.5, borderRadius: '8px', cursor: 'pointer',
            flexShrink: 0, transition: 'opacity 0.12s',
            '&:hover': { opacity: 0.88 },
          }}
        >
          Search
        </Box>
      )}
    </Box>
  );
}

function TabStrip({ active, onChange }) {
  const tab = (key, label) => (
    <Box
      onClick={() => onChange(key)}
      sx={{
        px: 1.5, py: 0.6,
        fontSize: '0.78rem',
        fontWeight: active === key ? 600 : 500,
        fontFamily: 'var(--font-family)',
        color: active === key ? 'var(--accent)' : 'var(--fg-secondary)',
        borderBottom: active === key ? '2px solid var(--accent)' : '2px solid transparent',
        cursor: 'pointer',
        transition: 'all 0.15s',
        display: 'flex', alignItems: 'center', gap: '3px',
        '&:hover': { color: 'var(--fg-primary)' },
      }}
    >
      {label}
    </Box>
  );
  return (
    <Box sx={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', mb: 1.5 }}>
      {tab('answer', 'Result')}
      {tab('news', 'News')}
      {tab('images', 'Images')}
      {tab('perspectives', 'Perspectives')}
      {tab('graph', 'Knowledge Graph')}
    </Box>
  );
}

export default function ExplorePage() {
  const navigate = useNavigate();
  const { articles: trendingArticles, trending, spinning, refetch } = useTrendingChips();

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

  const [followUpBlocks,  setFollowUpBlocks]  = useState([]);
  const [relatedSearches, setRelatedSearches] = useState([]);
  const [loadingRelated,  setLoadingRelated]  = useState(false);
  const [visualQuery,     setVisualQuery]     = useState('');
  const followUpAbortRef = useRef(null);
  const lastBlockRef     = useRef(null);
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
    setSources([]);
    setAnswer('');
    setSaved(false);
    setErrorMsg('');
    setStreaming(true);
    setFollowUpBlocks([]);
    setRelatedSearches([]);
    setLoadingRelated(false);
    setIsDeepSearch(false);
    setDeepLabel(isDeep ? '1/2' : '');
    setVisualQuery(deriveImageQuery(q.trim()));
    submittedQueryRef.current = q.trim();
    if (followUpAbortRef.current) followUpAbortRef.current.abort();

    let accumulatedAnswer = '';

    const readStream = async (queryStr, skipSources = false) => {
      const res = await fetch(`${API}/explore/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryStr }),
        signal,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const reader  = res.body.getReader();
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
          if (raw === '[DONE]') return;
          try {
            const evt = JSON.parse(raw);
            if      (evt.type === 'sources' && !skipSources) setSources(evt.sources || []);
            else if (evt.type === 'chunk')                   { accumulatedAnswer += evt.text; setAnswer(prev => prev + evt.text); }
            else if (evt.type === 'error')                   setErrorMsg(evt.text);
          } catch { /* ignore malformed sse */ }
        }
      }
    };

    let searchSuccess = false;
    try {
      setPhase('results');
      await readStream(q.trim());
      if (isDeep) {
        setDeepLabel('2/2');
        setStreaming(true);
        setAnswer(prev => prev + '\n\n## Additional context\n\n');
        await readStream(`${q.trim()} detailed analysis`, true);
        setIsDeepSearch(true);
      }
      searchSuccess = true;
    } catch (err) {
      if (err.name !== 'AbortError') {
        setErrorMsg(err.message);
        setPhase('error');
      }
    } finally {
      setStreaming(false);
      setDeepLabel('');
      setDeepMode(false);
      if (searchSuccess && accumulatedAnswer) {
        setLoadingRelated(true);
        fetch(`${API}/explore/related`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q.trim(), answer_snippet: accumulatedAnswer.slice(0, 500) }),
        })
          .then(r => r.json())
          .then(data => setRelatedSearches(data.related || []))
          .catch(() => {})
          .finally(() => setLoadingRelated(false));
      }
    }
  }, []);

  const handleSubmit = () => { if (query.trim()) runSearch(query, deepMode); };

  const handleSave = useCallback(() => {
    if (!answer) return;
    const filename = `ask-${query.slice(0, 40).replace(/\s+/g, '-')}-${Date.now()}.md`;
    const content  = `# ${query}\n\n${answer}\n\n---\n*Saved from Ask*`;
    const blob     = new Blob([content], { type: 'text/markdown' });
    const url      = URL.createObjectURL(blob);
    const a        = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
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
    setFollowUpBlocks(prev => [
      ...prev,
      { id: blockId, question: followUpText, sources: [], answer: '', streaming: true, errorMsg: '', relatedSearches: [], loadingRelated: false, visualQuery: followUpVisualQuery },
    ]);

    let blockAnswer = '';

    try {
      const res = await fetch(`${API}/explore/search`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ query: followUpText, context: submittedQueryRef.current }),
        signal:  followUpAbortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      const update = updater =>
        setFollowUpBlocks(prev => prev.map(b => b.id === blockId ? updater(b) : b));

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
          if (raw === '[DONE]') { update(b => ({ ...b, streaming: false })); break; }
          try {
            const evt = JSON.parse(raw);
            if      (evt.type === 'sources') update(b => ({ ...b, sources: evt.sources || [] }));
            else if (evt.type === 'chunk')   { blockAnswer += evt.text; update(b => ({ ...b, answer: b.answer + evt.text })); }
            else if (evt.type === 'error')   update(b => ({ ...b, errorMsg: evt.text }));
          } catch { /* ignore malformed sse */ }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setFollowUpBlocks(prev =>
          prev.map(b => b.id === blockId ? { ...b, streaming: false, errorMsg: err.message } : b)
        );
      }
    } finally {
      setFollowUpBlocks(prev => prev.map(b => b.id === blockId ? { ...b, streaming: false, loadingRelated: !!blockAnswer, visualQuery: followUpVisualQuery } : b));
      if (blockAnswer) {
        fetch(`${API}/explore/related`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: followUpText, answer_snippet: blockAnswer.slice(0, 500) }),
        })
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
    setIsDeepSearch(false); setDeepLabel('');
  };

  const Controls = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
      {(phase === 'results' || phase === 'error') && (
        <>
          <Box onClick={resetSearch} sx={{
            display: 'flex', alignItems: 'center', gap: 0.5,
            cursor: 'pointer', color: 'var(--fg-dim)',
            fontFamily: 'var(--font-family)', fontSize: '0.75rem',
            '&:hover': { color: 'var(--fg-primary)' },
          }}>
            <RotateCcw size={11} /> New search
          </Box>
          {answer && (
            <Box onClick={handleSave} sx={{
              display: 'flex', alignItems: 'center', gap: 0.5,
              cursor: 'pointer', color: saved ? 'var(--accent)' : 'var(--fg-secondary)',
              fontFamily: 'var(--font-family)', fontSize: '0.75rem',
              border: '1px solid var(--border)', px: 1, py: 0.35,
              borderRadius: '8px', transition: 'all 0.15s',
              '&:hover': { borderColor: 'var(--accent)', color: 'var(--accent)' },
            }}>
              <BookmarkPlus size={11} /> {saved ? 'Saved' : 'Save'}
            </Box>
          )}
          <Box onClick={handleShare} sx={{
            display: 'flex', alignItems: 'center', gap: 0.5,
            cursor: 'pointer', color: 'var(--fg-secondary)',
            fontFamily: 'var(--font-family)', fontSize: '0.75rem',
            border: '1px solid var(--border)', px: 1, py: 0.35,
            borderRadius: '8px', transition: 'all 0.15s',
            '&:hover': { borderColor: 'var(--accent)', color: 'var(--accent)' },
          }}>
            <Link size={11} /> Share
          </Box>
        </>
      )}
    </Box>
  );

  if (phase === 'idle') {
    return (
      <>
      <Box
        className="home-radial-bg"
        sx={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100%', gap: 2.5, px: 3, pb: 8,
          bgcolor: 'var(--bg-primary)',
        }}
      >
        
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
          <PixelWordmark pixelSize={10} gap={14} />
          <Typography sx={{
            fontFamily: 'var(--font-family)', fontSize: '0.75rem',
            color: 'var(--fg-dim)', letterSpacing: '0.12em', textTransform: 'uppercase',
          }}>
            Web search · AI reasoning · Inline citations
          </Typography>
        </Box>

        <SearchBar query={query} setQuery={setQuery} onSubmit={handleSubmit} deepMode={deepMode} onToggleDeep={() => setDeepMode(d => !d)} />
        {Controls}

        {/* Research entry point */}
        <Box
          onClick={() => navigate('/research')}
          sx={{
            display: 'flex', alignItems: 'center', gap: 0.75,
            px: 1.5, py: 0.7,
            borderRadius: '10px',
            background: 'rgba(249,115,22,0.07)',
            border: '1px solid rgba(249,115,22,0.2)',
            cursor: 'pointer',
            transition: 'background 0.15s, border-color 0.15s',
            '&:hover': { background: 'rgba(249,115,22,0.13)', borderColor: 'rgba(249,115,22,0.4)' },
          }}
        >
          <FlaskConical size={13} color="var(--accent)" />
          <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.04em' }}>
            Quarry Research
          </Typography>
          <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.68rem', color: 'var(--fg-dim)', ml: 0.25 }}>
            — structured multi-phase deep dive
          </Typography>
        </Box>

        {/* Section header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
          {trending && (
            <Box sx={{
              width: 6, height: 6, borderRadius: '50%',
              bgcolor: 'var(--accent)', flexShrink: 0,
              animation: 'trendingPulse 1.8s ease-in-out infinite',
            }} />
          )}
          <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.67rem', fontWeight: 600, color: 'var(--fg-dim)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
            {trending ? 'Trending' : 'Suggested'}
          </Typography>
          <Box
            onClick={refetch}
            sx={{ cursor: 'pointer', color: 'var(--fg-dim)', display: 'flex', alignItems: 'center', transition: 'color 0.15s', '&:hover': { color: 'var(--accent)' } }}
          >
            <RefreshCw size={11} style={{ animation: spinning ? 'spin 0.7s linear infinite' : 'none' }} />
          </Box>
        </Box>

        {/* News panels grid */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 1,
          width: '100%',
          maxWidth: 680,
        }}>
          {trendingArticles.map((art, i) => (
            <Box
              key={i}
              onClick={() => { setQuery(art.title); runSearch(art.title); }}
              sx={{
                display: 'flex', flexDirection: 'column', gap: 0.4,
                px: 1.25, py: 1,
                borderRadius: '10px',
                background: 'rgba(255,255,255,0.45)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.5)',
                cursor: 'pointer',
                transition: 'border-color 0.15s, background 0.15s',
                '&:hover': {
                  background: 'rgba(255,255,255,0.65)',
                  borderColor: 'rgba(249,115,22,0.3)',
                },
              }}
            >
              <Typography sx={{
                fontFamily: 'var(--font-family)', fontSize: '0.75rem', fontWeight: 600,
                color: 'var(--fg-primary)', lineHeight: 1.4,
                display: '-webkit-box', WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {art.title}
              </Typography>
              {(art.source?.name || art.publishedAt) && (
                <Typography sx={{
                  fontFamily: 'var(--font-family)', fontSize: '0.65rem',
                  color: 'var(--fg-dim)', mt: 'auto', pt: 0.5,
                }}>
                  {art.source?.name}
                  {art.source?.name && art.publishedAt ? ' · ' : ''}
                  {art.publishedAt ? new Date(art.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                </Typography>
              )}
            </Box>
          ))}
        </Box>

        <style>{`
          @keyframes trendingPulse {
            0%, 100% { opacity: 1;   transform: scale(1);    }
            50%       { opacity: 0.4; transform: scale(0.75); }
          }
          @keyframes spin {
            from { transform: rotate(0deg);   }
            to   { transform: rotate(360deg); }
          }
          ${floatIdleCSS}
        `}</style>

        {/* Pixel art figurines — corners only, pointer-events off, inside positioned home box */}
        <div className="fig-wrapper">
          {/* Bottom-left: Archivist + Scout */}
          <div className="fig-left" style={{ position: 'absolute', bottom: 0, left: 24, display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <ArchivistFigurine />
            <div style={{ transform: 'scale(0.85)', transformOrigin: 'bottom center' }}>
              <ScoutFigurine />
            </div>
          </div>
          {/* Bottom-right: Wanderer + Scout (mirrored) */}
          <div className="fig-right" style={{ position: 'absolute', bottom: 0, right: 24, display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <div style={{ transform: 'scale(0.85)', transformOrigin: 'bottom center' }}>
              <WandererFigurine />
            </div>
            <div style={{ transform: 'scaleX(-1)', transformOrigin: 'center' }}>
              <ScoutFigurine />
            </div>
          </div>
        </div>
      </Box>

      <Toast show={toast.show} message={toast.message} />
    </>
    );
  }

  if (phase === 'searching') {
    return (
      <Box sx={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        px: 3, pt: 4, pb: 8, maxWidth: 900, mx: 'auto', width: '100%',
        bgcolor: 'var(--bg-primary)', height: '100%',
      }}>
        <SearchBar query={query} setQuery={setQuery} onSubmit={handleSubmit} deepMode={deepMode} onToggleDeep={() => setDeepMode(d => !d)} />
        {Controls}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1 }}>
          <CircularProgress size={14} sx={{ color: 'var(--accent)' }} />
          <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.8rem', color: 'var(--fg-secondary)' }}>
            {deepLabel === '1/2' ? '⚡ Deep Search 1/2: Searching the web…' :
             deepLabel === '2/2' ? '⚡ Deep Search 2/2: Running deep analysis…' :
             'Searching the web and reasoning…'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', width: '100%' }}>
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} variant="rectangular" width={130} height={30} sx={{ borderRadius: '8px', bgcolor: 'var(--bg-secondary)' }} />
          ))}
        </Box>
        <Box sx={{ width: '100%' }}>
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} variant="text" width={`${70 + (i % 3) * 10}%`} sx={{ bgcolor: 'var(--bg-secondary)', height: 22, mb: 0.5 }} />
          ))}
        </Box>
        <Toast show={toast.show} message={toast.message} />
      </Box>
    );
  }

  const lastFollowUp  = followUpBlocks.length > 0 ? followUpBlocks[followUpBlocks.length - 1] : null;
  const canFollowUp   = phase === 'results' && (lastFollowUp ? !lastFollowUp.streaming : (!streaming && answer.length > 0));
  const newSearch     = q => { setQuery(q); runSearch(q); };

  return (
    <Box sx={{ height: '100vh', overflowY: 'auto', bgcolor: 'var(--bg-primary)' }}>

      {/* ── Sticky search bar ── */}
      <Box sx={{
        position: 'sticky', top: 0, zIndex: 20,
        bgcolor: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border)',
        py: 1.5, px: 3,
      }}>
        <Box sx={{ maxWidth: 1100, mx: 'auto', display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <SearchBar query={query} setQuery={setQuery} onSubmit={handleSubmit} deepMode={deepMode} onToggleDeep={() => setDeepMode(d => !d)} />
          {Controls}
        </Box>
      </Box>

      {/* ── Scrollable thread ── */}
      <Box sx={{ maxWidth: 1100, mx: 'auto', px: 3, pt: 3, pb: 14, display: 'flex', flexDirection: 'column' }}>

        
        <ResultBlock
          key={query}
          question={query}
          sources={sources}
          answer={answer}
          streaming={streaming}
          errorMsg={errorMsg}
          isFollowUp={false}
          onNewSearch={newSearch}
          isDeepSearch={isDeepSearch}
          deepLabel={deepLabel}
          relatedSearches={relatedSearches}
          loadingRelated={loadingRelated}
          visualQuery={visualQuery}
        />

        
        {followUpBlocks.map((block, i) => (
          <Box key={block.id} ref={i === followUpBlocks.length - 1 ? lastBlockRef : null}>
            <ThreadDivider />
            <ResultBlock
              question={block.question}
              sources={block.sources}
              answer={block.answer}
              streaming={block.streaming}
              errorMsg={block.errorMsg}
              isFollowUp={true}
              onNewSearch={newSearch}
              relatedSearches={block.relatedSearches || []}
              loadingRelated={block.loadingRelated || false}
              visualQuery={block.visualQuery || ''}
            />
          </Box>
        ))}

        
        {canFollowUp && (
          <>
            <ThreadDivider />
            <FollowUpBar
              onSubmit={runFollowUp}
              atMax={followUpBlocks.length >= MAX_FOLLOW_UPS}
            />
          </>
        )}
      </Box>

      <style>{`@keyframes blinkPulse { 50% { opacity: 0; } }`}</style>
      <Toast show={toast.show} message={toast.message} />
    </Box>
  );
}
