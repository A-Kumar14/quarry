import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { X, Zap, RefreshCw, ChevronRight, ArrowRight, Bookmark, Search, Edit3, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getBeats, saveBeat } from '../utils/beats';
import { useDarkMode } from '../DarkModeContext';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const URGENCY_CONFIG = {
  Breaking:   { color: '#ef4444', bg: 'rgba(239,68,68,0.10)',   border: 'rgba(239,68,68,0.28)',   label: '● Breaking'   },
  Developing: { color: '#f97316', bg: 'rgba(249,115,22,0.10)',  border: 'rgba(249,115,22,0.28)',  label: '◎ Developing' },
  Analysis:   { color: '#3b82f6', bg: 'rgba(59,130,246,0.10)',  border: 'rgba(59,130,246,0.28)',  label: '◈ Analysis'   },
  Feature:    { color: '#8b5cf6', bg: 'rgba(139,92,246,0.10)',  border: 'rgba(139,92,246,0.28)',  label: '◇ Feature'    },
};

const RELEVANCE_DOT = {
  High:   '#22c55e',
  Medium: '#f59e0b',
  Low:    'var(--fg-dim)',
};

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{
      borderRadius: 14, padding: '16px 18px', minHeight: 160,
      background: 'var(--bg-secondary)', border: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {[35, 80, 60, 90, 55].map((w, i) => (
        <div key={i} style={{
          height: i === 0 ? 8 : i === 1 ? 14 : 10,
          width: `${w}%`,
          borderRadius: 4,
          background: 'var(--bg-tertiary)',
          animation: 'dailyShimmer 1.4s ease-in-out infinite',
          animationDelay: `${i * 0.08}s`,
        }} />
      ))}
    </div>
  );
}

// ── Topic card ────────────────────────────────────────────────────────────────
function TopicCard({ topic, onSelect, onTrack, isTracked }) {
  const [dark] = useDarkMode();
  const urgency = URGENCY_CONFIG[topic.urgency] || URGENCY_CONFIG.Analysis;

  return (
    <div
      style={{
        borderRadius: 14, padding: '16px 18px',
        background: dark ? 'var(--bg-secondary)' : 'rgba(255,252,244,0.82)',
        border: `1px solid ${dark ? 'var(--border)' : 'rgba(175,150,105,0.18)'}`,
        display: 'flex', flexDirection: 'column', gap: 10,
        transition: 'transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease',
        cursor: 'default',
        position: 'relative',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = dark
          ? '0 8px 24px rgba(0,0,0,0.35)'
          : '0 8px 24px rgba(140,110,60,0.12)';
        e.currentTarget.style.borderColor = 'rgba(249,115,22,0.4)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.borderColor = dark ? 'var(--border)' : 'rgba(175,150,105,0.18)';
      }}
    >
      {/* Top row: urgency + relevance dot + track button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: '0.58rem', fontWeight: 600, fontFamily: 'var(--font-family)',
            color: urgency.color, background: urgency.bg,
            border: `1px solid ${urgency.border}`,
            borderRadius: 4, padding: '2px 7px', letterSpacing: '0.04em',
          }}>
            {urgency.label}
          </span>
          {topic.relevance && (
            <span title={`${topic.relevance} relevance to your beat`} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: '0.58rem', color: 'var(--fg-dim)', fontFamily: 'var(--font-family)',
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: RELEVANCE_DOT[topic.relevance] || 'var(--fg-dim)',
                display: 'inline-block',
              }} />
              {topic.relevance}
            </span>
          )}
          {topic.contradiction_potential === 'High' && (
            <span title="Sources likely to contradict each other on this story" style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontSize: '0.58rem', color: '#f97316', fontFamily: 'var(--font-family)',
            }}>
              <AlertTriangle size={9} color="#f97316" />
              Contested
            </span>
          )}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onTrack(topic); }}
          title={isTracked ? 'Already tracking' : 'Track this beat'}
          style={{
            background: isTracked ? 'rgba(34,197,94,0.10)' : 'transparent',
            border: isTracked ? '1px solid rgba(34,197,94,0.30)' : '1px solid var(--border)',
            borderRadius: 6, padding: '3px 7px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
            transition: 'all 0.14s',
          }}
        >
          <Bookmark size={10} color={isTracked ? '#22c55e' : 'var(--fg-dim)'} />
          <span style={{ fontSize: '0.58rem', fontFamily: 'var(--font-family)', color: isTracked ? '#22c55e' : 'var(--fg-dim)' }}>
            {isTracked ? 'Tracked' : 'Track'}
          </span>
        </button>
      </div>

      {/* Headline */}
      <div style={{
        fontFamily: 'var(--font-serif)', fontSize: '0.92rem', fontWeight: 600,
        color: 'var(--fg-primary)', lineHeight: 1.35,
      }}>
        {topic.headline}
      </div>

      {/* Summary */}
      <div style={{
        fontFamily: 'var(--font-family)', fontSize: '0.76rem', fontWeight: 300,
        color: 'var(--fg-secondary)', lineHeight: 1.55,
        display: '-webkit-box', WebkitLineClamp: 3,
        WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {topic.summary}
      </div>

      {/* Hook */}
      {topic.hook && (
        <div style={{
          borderLeft: '2px solid var(--accent)', paddingLeft: 8,
          fontFamily: 'var(--font-family)', fontSize: '0.70rem', fontWeight: 400,
          color: 'var(--accent)', fontStyle: 'italic', lineHeight: 1.4,
        }}>
          {topic.hook}
        </div>
      )}

      {/* Footer: source + cover button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
        {topic.source && (
          <span style={{
            fontSize: '0.60rem', fontFamily: 'var(--font-mono)',
            color: 'var(--fg-dim)', letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}>
            {topic.source}
          </span>
        )}
        <button
          onClick={() => onSelect(topic)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'var(--accent)', color: '#fff',
            border: 'none', borderRadius: 8, padding: '5px 12px',
            fontFamily: 'var(--font-family)', fontSize: '0.72rem', fontWeight: 500,
            cursor: 'pointer', transition: 'opacity 0.14s',
            marginLeft: 'auto',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
        >
          Cover This <ChevronRight size={11} />
        </button>
      </div>
    </div>
  );
}

// ── Story plan panel ──────────────────────────────────────────────────────────
function StoryPlanPanel({ topic, profile, onBack, onNavigate }) {
  const [plan, setPlan]         = useState('');
  const [streaming, setStreaming] = useState(true);
  const abortRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!topic) return;
    setPlan('');
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const authToken = localStorage.getItem('quarry_auth_token') || sessionStorage.getItem('quarry_auth_token') || '';

    fetch(`${API}/explore/story-plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({
        headline: topic.headline,
        summary: topic.summary,
        hook: topic.hook || '',
        beat: topic.beat || profile?.beat || '',
        profile: profile || {},
      }),
      signal: controller.signal,
    })
      .then(async res => {
        if (!res.ok) throw new Error('story plan failed');
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop();
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (raw === '[DONE]') { setStreaming(false); return; }
            try {
              const parsed = JSON.parse(raw);
              if (parsed.text) setPlan(p => p + parsed.text);
            } catch {}
          }
        }
        setStreaming(false);
      })
      .catch(err => {
        if (err.name !== 'AbortError') setStreaming(false);
      });

    return () => controller.abort();
  }, [topic, profile]);

  // Extract search queries suggested by AI at the end of the plan
  const handleResearch = useCallback(() => {
    navigate(`/search?q=${encodeURIComponent(topic.headline)}`);
    if (onNavigate) onNavigate();
  }, [navigate, topic, onNavigate]);

  const handleDraft = useCallback(() => {
    // Pre-load story plan into WritePage
    sessionStorage.setItem('quarry_write_session', JSON.stringify({
      query: topic.headline,
      content: `# ${topic.headline}\n\n${plan}`,
      sources: [],
    }));
    navigate('/write');
    if (onNavigate) onNavigate();
  }, [navigate, topic, plan, onNavigate]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Panel header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 20px', borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'none', border: '1px solid var(--border)',
            borderRadius: 7, padding: '4px 10px', cursor: 'pointer',
            fontFamily: 'var(--font-family)', fontSize: '0.72rem', color: 'var(--fg-dim)',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          ← Back
        </button>
        <div style={{
          fontFamily: 'var(--font-serif)', fontSize: '0.88rem', fontWeight: 600,
          color: 'var(--fg-primary)', flex: 1, overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {topic.headline}
        </div>
        {streaming && (
          <span style={{
            fontSize: '0.62rem', fontFamily: 'var(--font-family)',
            color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', animation: 'dailyPulse 1s ease-in-out infinite' }} />
            Drafting plan…
          </span>
        )}
      </div>

      {/* Plan content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        <div style={{
          fontFamily: 'var(--font-family)', fontSize: '0.83rem',
          lineHeight: 1.7, color: 'var(--fg-primary)',
        }}>
          <div className="daily-plan-markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {plan || ' '}
            </ReactMarkdown>
            {streaming && (
              <span style={{
                display: 'inline-block', width: 7, height: 14,
                background: 'var(--accent)', borderRadius: 2,
                animation: 'blinkPulse 1s step-end infinite',
                verticalAlign: 'text-bottom', marginLeft: 3,
              }} />
            )}
          </div>
        </div>
      </div>

      {/* Action bar */}
      {!streaming && plan && (
        <div style={{
          padding: '12px 20px', borderTop: '1px solid var(--border)',
          display: 'flex', gap: 10, flexShrink: 0,
          background: 'var(--bg-secondary)',
        }}>
          <button
            onClick={handleResearch}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: 'var(--accent)', color: '#fff', border: 'none',
              borderRadius: 10, padding: '10px 0',
              fontFamily: 'var(--font-family)', fontSize: '0.82rem', fontWeight: 500,
              cursor: 'pointer', transition: 'opacity 0.14s',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
          >
            <Search size={14} /> Start Researching
          </button>
          <button
            onClick={handleDraft}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: 'transparent', color: 'var(--fg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 10, padding: '10px 0',
              fontFamily: 'var(--font-family)', fontSize: '0.82rem', fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.14s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(249,115,22,0.4)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            <Edit3 size={14} /> Draft This Story
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function DailyTopicsModal({ onClose }) {
  const { user }   = useAuth();
  const [dark]     = useDarkMode();
  // eslint-disable-next-line no-unused-vars
  const navigate   = useNavigate();

  const [phase, setPhase]           = useState('loading');   // loading | ready | error
  const [brief, setBrief]           = useState(null);        // { summary, topics[], generated_at }
  const [selectedTopic, setSelectedTopic] = useState(null);  // topic object for plan view
  const [chatInput, setChatInput]   = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [trackedIds, setTrackedIds]  = useState(() => {
    return new Set(getBeats().map(b => b.name));
  });
  const inputRef = useRef(null);

  const profile = useMemo(() => user?.profile || {}, [user]);

  // ── Fetch brief ─────────────────────────────────────────────────────────────
  const fetchBrief = useCallback(async (extra = '') => {
    setPhase('loading');
    setSelectedTopic(null);
    const authToken = localStorage.getItem('quarry_auth_token') || sessionStorage.getItem('quarry_auth_token') || '';
    const beats = getBeats().map(b => b.name);

    try {
      const profileToSend = { ...profile };
      if (extra) {
        profileToSend.topics_of_focus = [
          ...(profileToSend.topics_of_focus || []),
          extra,
        ];
      }
      const res = await fetch(`${API}/explore/daily-brief`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ beats, profile: profileToSend }),
      });
      if (!res.ok) throw new Error('brief fetch failed');
      const data = await res.json();
      setBrief(data);
      setPhase('ready');
    } catch (err) {
      setPhase('error');
    }
  }, [profile]);

  useEffect(() => { fetchBrief(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on Escape
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // ── Track beat ──────────────────────────────────────────────────────────────
  const handleTrack = useCallback((topic) => {
    if (trackedIds.has(topic.headline)) return;
    saveBeat({
      id: `beat_${Date.now()}`,
      name: topic.headline,
      keywords: [topic.beat, topic.headline].filter(Boolean),
      createdAt: Date.now(),
    });
    setTrackedIds(prev => new Set([...prev, topic.headline]));
  }, [trackedIds]);

  // ── Chat refinement ──────────────────────────────────────────────────────────
  const handleChat = useCallback(async () => {
    if (!chatInput.trim()) return;
    const term = chatInput.trim();
    setChatInput('');
    setChatLoading(true);
    await fetchBrief(term);
    setChatLoading(false);
  }, [chatInput, fetchBrief]);

  const firstName = user?.username?.split(' ')[0] || '';

  return (
    <>
      <style>{`
        @keyframes dailyShimmer {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 0.9; }
        }
        @keyframes dailyPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(0.75); }
        }
        @keyframes dailyFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .daily-plan-markdown h2 {
          font-family: var(--font-serif);
          font-size: 0.92rem;
          font-weight: 600;
          color: var(--fg-primary);
          margin: 1.2rem 0 0.4rem;
          padding-bottom: 4px;
          border-bottom: 1px solid var(--border);
        }
        .daily-plan-markdown h3 {
          font-family: var(--font-serif);
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--fg-secondary);
          margin: 0.9rem 0 0.3rem;
        }
        .daily-plan-markdown p {
          margin: 0 0 0.6rem;
          font-size: 0.82rem;
          line-height: 1.7;
        }
        .daily-plan-markdown ul, .daily-plan-markdown ol {
          padding-left: 1.2rem;
          margin: 0.3rem 0 0.6rem;
        }
        .daily-plan-markdown li {
          font-size: 0.80rem;
          line-height: 1.65;
          color: var(--fg-primary);
          margin-bottom: 2px;
        }
        .daily-plan-markdown strong {
          font-weight: 600;
          color: var(--fg-primary);
        }
        .daily-plan-markdown em {
          color: var(--fg-secondary);
        }
      `}</style>

      {/* Overlay */}
      <div
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        style={{
          position: 'fixed', inset: 0, zIndex: 'var(--z-modal)',
          background: dark ? 'rgba(0,0,0,0.75)' : 'rgba(60,40,20,0.45)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }}
      >
        {/* Modal card */}
        <div style={{
          width: '100%', maxWidth: 1040,
          height: '88vh', maxHeight: 780,
          borderRadius: 18,
          background: dark ? 'var(--bg-primary)' : '#FAF7F2',
          border: dark ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(175,150,105,0.22)',
          boxShadow: dark
            ? '0 32px 80px rgba(0,0,0,0.70)'
            : '0 24px 60px rgba(60,40,20,0.22)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          animation: 'dailyFadeIn 0.22s ease',
        }}>

          {/* ── Header ── */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: 'rgba(249,115,22,0.12)',
                border: '1px solid rgba(249,115,22,0.28)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Zap size={15} color="var(--accent)" fill="var(--accent)" />
              </div>
              <div>
                <div style={{
                  fontFamily: 'var(--font-serif)', fontSize: '1rem', fontWeight: 600,
                  color: 'var(--fg-primary)', lineHeight: 1.1,
                }}>
                  Daily Briefing
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: '0.60rem',
                  color: 'var(--fg-dim)', marginTop: 2,
                }}>
                  {brief?.generated_at || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  {profile?.beat ? ` · ${profile.beat}` : ''}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {phase === 'ready' && (
                <button
                  onClick={() => fetchBrief()}
                  title="Refresh brief"
                  style={{
                    background: 'none', border: '1px solid var(--border)',
                    borderRadius: 8, padding: '5px 9px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 5,
                    fontFamily: 'var(--font-family)', fontSize: '0.70rem', color: 'var(--fg-dim)',
                    transition: 'all 0.14s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--fg-dim)'; }}
                >
                  <RefreshCw size={11} /> Refresh
                </button>
              )}
              <button
                onClick={onClose}
                style={{
                  background: 'none', border: '1px solid var(--border)',
                  borderRadius: 8, width: 30, height: 30, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--fg-dim)', transition: 'all 0.14s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--error)'; e.currentTarget.style.color = 'var(--error)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--fg-dim)'; }}
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* ── Body: split view ── */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

            {/* Left: brief + cards */}
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
              borderRight: selectedTopic ? '1px solid var(--border)' : 'none',
              minWidth: 0,
            }}>

              {/* Loading */}
              {phase === 'loading' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', animation: 'dailyPulse 1s ease-in-out infinite' }} />
                    <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.78rem', color: 'var(--fg-dim)' }}>
                      Scanning today's news{firstName ? `, ${firstName}` : ''}…
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
                    {[0,1,2,3,4,5].map(i => <SkeletonCard key={i} />)}
                  </div>
                </div>
              )}

              {/* Error */}
              {phase === 'error' && (
                <div style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32,
                }}>
                  <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.88rem', color: 'var(--error)' }}>
                    Couldn't fetch today's brief. Check your connection.
                  </span>
                  <button
                    onClick={() => fetchBrief()}
                    style={{
                      background: 'var(--accent)', color: '#fff', border: 'none',
                      borderRadius: 9, padding: '8px 20px', cursor: 'pointer',
                      fontFamily: 'var(--font-family)', fontSize: '0.80rem',
                    }}
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Ready */}
              {phase === 'ready' && brief && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px 0' }}>

                  {/* Summary */}
                  <div style={{
                    marginBottom: 18,
                    borderLeft: '3px solid var(--accent)',
                    paddingLeft: 14, paddingTop: 2, paddingBottom: 2,
                    animation: 'dailyFadeIn 0.25s ease',
                  }}>
                    <div style={{
                      fontFamily: 'var(--font-family)', fontSize: '0.58rem', fontWeight: 600,
                      color: 'var(--fg-dim)', letterSpacing: '0.14em', textTransform: 'uppercase',
                      marginBottom: 6,
                    }}>
                      Here's what's going on in the world
                    </div>
                    <p style={{
                      fontFamily: 'var(--font-family)', fontSize: '0.85rem', fontWeight: 300,
                      color: 'var(--fg-primary)', lineHeight: 1.7, margin: 0,
                    }}>
                      {brief.summary}
                    </p>
                    {brief.articles_count > 0 && (
                      <div style={{
                        marginTop: 6,
                        fontFamily: 'var(--font-mono)', fontSize: '0.58rem',
                        color: 'var(--fg-dim)',
                      }}>
                        Based on {brief.articles_count} live sources · refreshes every 5 min
                      </div>
                    )}
                  </div>

                  {/* Topic cards grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: selectedTopic
                      ? 'repeat(auto-fill, minmax(220px, 1fr))'
                      : 'repeat(auto-fill, minmax(260px, 1fr))',
                    gap: 12,
                    paddingBottom: 80,
                    animation: 'dailyFadeIn 0.30s ease',
                  }}>
                    {(brief.topics || []).map((topic, i) => (
                      <TopicCard
                        key={i}
                        topic={topic}
                        onSelect={setSelectedTopic}
                        onTrack={handleTrack}
                        isTracked={trackedIds.has(topic.headline)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* ── Chat bar ── */}
              <div style={{
                padding: '10px 16px',
                borderTop: '1px solid var(--border)',
                background: dark ? 'rgba(255,255,255,0.02)' : 'rgba(255,252,244,0.60)',
                backdropFilter: 'blur(12px)',
                flexShrink: 0,
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  borderRadius: 10,
                  background: 'var(--gbtn-bg)',
                  border: '1px solid var(--border)',
                  padding: '6px 12px',
                }}>
                  <input
                    ref={inputRef}
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChat(); } }}
                    placeholder='Refine: "show me more defence stories" or "anything on climate?"'
                    disabled={chatLoading || phase === 'loading'}
                    style={{
                      flex: 1, border: 'none', background: 'transparent', outline: 'none',
                      fontFamily: 'var(--font-family)', fontSize: '0.78rem', color: 'var(--fg-primary)',
                      padding: '3px 0',
                    }}
                  />
                  <button
                    onClick={handleChat}
                    disabled={!chatInput.trim() || chatLoading || phase === 'loading'}
                    style={{
                      background: chatInput.trim() ? 'var(--accent)' : 'transparent',
                      border: chatInput.trim() ? 'none' : '1px solid var(--border)',
                      borderRadius: 7, padding: '4px 10px', cursor: chatInput.trim() ? 'pointer' : 'not-allowed',
                      display: 'flex', alignItems: 'center', gap: 4,
                      transition: 'all 0.14s',
                    }}
                  >
                    {chatLoading
                      ? <RefreshCw size={11} color="var(--fg-dim)" style={{ animation: 'spin 0.9s linear infinite' }} />
                      : <ArrowRight size={11} color={chatInput.trim() ? '#fff' : 'var(--fg-dim)'} />
                    }
                  </button>
                </div>
              </div>
            </div>

            {/* Right: story plan panel */}
            {selectedTopic && (
              <div style={{
                width: 420, flexShrink: 0,
                display: 'flex', flexDirection: 'column',
                animation: 'dailyFadeIn 0.20s ease',
              }}>
                <StoryPlanPanel
                  topic={selectedTopic}
                  profile={profile}
                  onBack={() => setSelectedTopic(null)}
                  onNavigate={onClose}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
