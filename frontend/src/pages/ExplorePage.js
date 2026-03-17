import React, { useState, useRef, useCallback, useMemo, useEffect, lazy, Suspense } from 'react';
import { Box, Typography, Skeleton, Tooltip, CircularProgress } from '@mui/material';
import { Search, Globe, BookmarkPlus, RotateCcw, ExternalLink, RefreshCw, CornerDownRight, Link, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import GlassCard from '../components/GlassCard';
import ComparisonView from '../components/ComparisonView';
import PerspectivesTab from '../components/PerspectivesTab';
import { getSourceQuality, QUALITY_COLOR } from '../utils/sourceQuality';
import Toast from '../components/Toast';

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
  'Latest breakthroughs in quantum computing',
  'How does RAG work in AI systems?',
  'Best open source LLMs in 2026',
  'Explain transformer attention mechanisms',
  'FastAPI vs Flask for production APIs',
  'Top AI coding assistants compared',
];

const GNEWS_KEY = process.env.REACT_APP_GNEWS_API_KEY;

function useTrendingChips() {
  const [chips,     setChips]     = useState(FALLBACK_SUGGESTIONS);
  const [trending,  setTrending]  = useState(false);
  const [spinning,  setSpinning]  = useState(false);

  const fetchTrending = useCallback(async () => {
    if (!GNEWS_KEY) return;
    setSpinning(true);
    try {
      const res  = await fetch(
        `https://gnews.io/api/v4/top-headlines?lang=en&max=6&apikey=${GNEWS_KEY}`
      );
      if (!res.ok) throw new Error('gnews error');
      const data = await res.json();
      const titles = (data.articles || [])
        .map(a => a.title?.slice(0, 60) || '')
        .filter(Boolean)
        .slice(0, 6);
      if (titles.length >= 3) {
        setChips(titles);
        setTrending(true);
      }
    } catch {
      // silent fallback — keep existing chips
    } finally {
      setSpinning(false);
    }
  }, []);

  useEffect(() => { fetchTrending(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { chips, trending, spinning, refetch: fetchTrending };
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

function isVsQuery(query) {
  return /\bvs\.?\b|\bversus\b/i.test(query);
}

function getFollowUps(query) {
  const q = query.trim();
  return [
    `Latest news on ${q}`,
    `${q} explained simply`,
    `Best resources for ${q}`,
  ];
}

function confidenceLevel(sourceCount) {
  if (sourceCount >= 6) return { label: 'High confidence', bg: 'rgba(34,197,94,0.15)',  border: 'rgba(34,197,94,0.35)',  color: '#15803d' };
  if (sourceCount >= 3) return { label: 'Moderate',        bg: 'rgba(234,179,8,0.15)',  border: 'rgba(234,179,8,0.35)',  color: '#92400e' };
  return                       { label: 'Limited sources', bg: 'rgba(249,115,22,0.13)', border: 'rgba(249,115,22,0.35)', color: '#9a3412' };
}

function QuickSummary({ answer, sources, isDeepSearch }) {
  const bullets = extractQuickSummary(answer);
  if (!bullets.length || answer.length < 300) return null;

  const { label, bg, border, color } = confidenceLevel(sources.length);

  return (
    <GlassCard style={{
      borderLeft: '3px solid var(--accent)',
      padding: '14px 18px',
      marginBottom: 16,
      background: 'rgba(255, 255, 255, 0.70)',
      position: 'relative',
    }}>
      
      <div style={{ position: 'absolute', top: 10, right: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        {isDeepSearch && (
          <div style={{
            padding:              '2px 8px',
            borderRadius:         20,
            fontSize:             10,
            fontFamily:           'var(--font-family)',
            fontWeight:           700,
            letterSpacing:        '0.04em',
            color:                '#b45309',
            background:           'rgba(249,115,22,0.12)',
            border:               '1px solid rgba(249,115,22,0.35)',
            display:              'flex',
            alignItems:           'center',
            gap:                  3,
          }}>
            <Zap size={9} fill="#b45309" color="#b45309" /> Deep
          </div>
        )}
        <div style={{
          padding:              '2px 8px',
          borderRadius:         20,
          fontSize:             10,
          fontFamily:           'var(--font-family)',
          fontWeight:           600,
          letterSpacing:        '0.04em',
          color,
          background:           bg,
          backdropFilter:       'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border:               `1px solid ${border}`,
        }}>
          {label}
        </div>
      </div>

      <div style={{
        fontFamily: 'var(--font-family)', fontSize: '0.6rem', fontWeight: 700,
        color: 'var(--accent)', letterSpacing: '0.09em', textTransform: 'uppercase',
        marginBottom: 10,
      }}>
        Quick Summary
      </div>
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
  );
}

function CollapsibleAnswer({ answer, streaming, sources }) {
  const [expanded, setExpanded] = useState(false);

  const paragraphs  = answer.split(/\n\n+/);
  const isLong      = paragraphs.length > 4;
  const displayText = !expanded && isLong ? paragraphs.slice(0, 4).join('\n\n') : answer;

  return (
    <Box>
      <Box sx={ANSWER_STYLES}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{ a: ({ href, children }) => <CitationLink href={href} sources={sources}>{children}</CitationLink> }}
        >
          {displayText}
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

      {isLong && (
        <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'center' }}>
          <Box
            onClick={() => setExpanded(e => !e)}
            sx={{
              fontFamily: 'var(--font-family)', fontSize: '0.78rem',
              color: 'var(--fg-secondary)', cursor: 'pointer',
              border: '1px solid var(--border)', px: 2.5, py: 0.6,
              borderRadius: '20px', transition: 'all 0.15s',
              '&:hover': { borderColor: 'var(--accent)', color: 'var(--accent)' },
            }}
          >
            {expanded ? '↑ Show less' : '↓ Show more'}
          </Box>
        </Box>
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

function ResultBlock({ question, sources, answer, streaming, errorMsg, isFollowUp, onNewSearch, isDeepSearch, deepLabel }) {
  const [activeTab, setActiveTab] = useState('answer');

  const graphData = useMemo(
    () => answer ? extractGraphData(answer, sources) : { nodes: [], links: [] },
    [answer, sources]
  );

  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      
      {isFollowUp && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: '2px', height: 20, bgcolor: 'var(--accent)', borderRadius: 1, flexShrink: 0 }} />
          <Typography sx={{
            fontFamily: 'var(--font-family)', fontSize: '0.85rem',
            fontWeight: 600, color: 'var(--fg-secondary)',
          }}>
            {question}
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

        
        <Box sx={{ width: { xs: '100%', md: '35%' }, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
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

          {answer && (
            <GlassCard style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.45)' }}>
              <div style={{
                fontFamily: 'var(--font-family)', fontSize: '0.62rem', fontWeight: 700,
                color: 'var(--fg-dim)', letterSpacing: '0.07em', textTransform: 'uppercase',
                marginBottom: 8,
              }}>
                Related searches
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {getFollowUps(question).map(s => (
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
                ))}
              </div>
            </GlassCard>
          )}
        </Box>

        
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {answer ? (
            <GlassCard style={{ padding: '20px 22px', background: 'rgba(255,255,255,0.80)' }}>
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
                  {isVsQuery(question) && <ComparisonView query={question} />}
                  <QuickSummary answer={answer} sources={sources} isDeepSearch={isDeepSearch} />
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
      {tab('answer', 'Answer')}
      {tab('graph', 'Knowledge Graph')}
      {tab('perspectives', (
        <>
          <span style={{ fontWeight: 800, fontSize: '0.72rem', color: '#ff4500', lineHeight: 1 }}>r/</span>
          Perspectives
        </>
      ))}
    </Box>
  );
}

export default function ExplorePage() {
  const { chips, trending, spinning, refetch } = useTrendingChips();

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
    setIsDeepSearch(false);
    setDeepLabel(isDeep ? '1/2' : '');
    submittedQueryRef.current = q.trim();
    if (followUpAbortRef.current) followUpAbortRef.current.abort();

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
            else if (evt.type === 'chunk')                   setAnswer(prev => prev + evt.text);
            else if (evt.type === 'error')                   setErrorMsg(evt.text);
          } catch { /* ignore malformed sse */ }
        }
      }
    };

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
    } catch (err) {
      if (err.name !== 'AbortError') {
        setErrorMsg(err.message);
        setPhase('error');
      }
    } finally {
      setStreaming(false);
      setDeepLabel('');
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
    setFollowUpBlocks(prev => [
      ...prev,
      { id: blockId, question: followUpText, sources: [], answer: '', streaming: true, errorMsg: '' },
    ]);

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
            else if (evt.type === 'chunk')   update(b => ({ ...b, answer: b.answer + evt.text }));
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
      setFollowUpBlocks(prev => prev.map(b => b.id === blockId ? { ...b, streaming: false } : b));
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
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Box sx={{
            width: 36, height: 36, borderRadius: '10px',
            bgcolor: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Globe size={18} color="#FFF" strokeWidth={2} />
          </Box>
          <Box>
            <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '1.2rem', fontWeight: 700, color: 'var(--fg-primary)', lineHeight: 1.1 }}>
              Ask
            </Typography>
            <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.72rem', color: 'var(--fg-dim)' }}>
              Web search · AI reasoning · Inline citations
            </Typography>
          </Box>
        </Box>

        <SearchBar query={query} setQuery={setQuery} onSubmit={handleSubmit} deepMode={deepMode} onToggleDeep={() => setDeepMode(d => !d)} />
        {Controls}

        
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

        
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, maxWidth: 680, justifyContent: 'center' }}>
          {chips.map(s => (
            <Box
              key={s}
              onClick={() => { setQuery(s); runSearch(s); }}
              sx={{
                fontFamily: 'var(--font-family)', fontSize: '0.75rem',
                color: 'var(--fg-secondary)',
                background:           'rgba(255, 255, 255, 0.35)',
                backdropFilter:       'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border:               '1px solid rgba(255, 255, 255, 0.45)',
                borderRadius:         '12px',
                px: 1.5, py: 0.5, cursor: 'pointer',
                transition: 'all 0.12s',
                '&:hover': { background: 'rgba(255,255,255,0.55)', color: 'var(--fg-primary)', borderColor: 'rgba(249,115,22,0.3)' },
              }}
            >
              {s}
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
        `}</style>
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
