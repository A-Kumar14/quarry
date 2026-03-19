import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import { ArrowLeft, Send, History } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNavigate, useSearchParams } from 'react-router-dom';
import GlassCard from '../components/GlassCard';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const PHASES = [
  { n: 1, label: 'Onboarding' },
  { n: 2, label: 'Scope'      },
  { n: 3, label: 'Research'   },
  { n: 4, label: 'Synthesis'  },
  { n: 5, label: 'Wrap-up'    },
];

const GLASS_BTN_ACCENT = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
  padding: '7px 16px', borderRadius: 999, cursor: 'pointer',
  background: 'linear-gradient(158deg, rgba(249,115,22,0.90) 0%, rgba(217,79,10,0.96) 100%)',
  borderTop: '1px solid rgba(255,185,115,0.75)',
  borderLeft: '1px solid rgba(255,165,100,0.52)',
  borderRight: '1px solid rgba(152,50,0,0.22)',
  borderBottom: '1px solid rgba(152,50,0,0.28)',
  boxShadow: '0 4px 16px rgba(249,115,22,0.32), 0 1.5px 0 rgba(255,205,148,0.68) inset, 0 -1px 0 rgba(130,40,0,0.18) inset',
  color: '#fff', fontFamily: 'var(--font-family)', fontSize: 13, fontWeight: 500,
  letterSpacing: '0.02em', whiteSpace: 'nowrap', transition: 'all 0.14s ease',
};

const MD_STYLES = {
  '& p':              { fontFamily: 'var(--font-family)', fontWeight: 300, fontSize: '0.93rem', lineHeight: 1.80, color: 'var(--fg-primary)', my: 0.5 },
  '& h1,& h2,& h3':  { fontFamily: 'var(--font-serif)', fontWeight: 600, color: 'var(--fg-primary)', mt: 1.5, mb: 0.5 },
  '& h2':             { fontSize: '0.97rem' },
  '& h3':             { fontSize: '0.88rem' },
  '& ul,& ol':        { pl: 2.5, my: 0.5 },
  '& li':             { fontSize: '0.93rem', fontWeight: 300, lineHeight: 1.80, mb: 0.25, color: 'var(--fg-primary)' },
  '& strong':         { fontWeight: 600, color: 'var(--fg-primary)' },
  '& code':           { fontFamily: 'var(--font-mono)', fontSize: '0.82rem', bgcolor: 'var(--bg-tertiary)', px: '5px', py: '1px', borderRadius: '4px' },
  '& pre':            { bgcolor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', p: 1.5, overflowX: 'auto', '& code': { bgcolor: 'transparent' } },
  '& blockquote':     { borderLeft: '3px solid var(--accent)', pl: 1.5, ml: 0, color: 'var(--fg-secondary)', fontStyle: 'italic' },
  '& hr':             { border: 'none', borderTop: '1px solid var(--border)', my: 1.5 },
};

/* ── Session persistence helpers ─────────────────────────────────────────── */

function genUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxx-xxxx-4xxx-yxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : ((r & 0x3) | 0x8)).toString(16);
  });
}

function saveSession(id, messages, phase, topic) {
  const data = {
    id, messages, phase,
    topic: topic || 'Untitled session',
    updatedAt: Date.now(),
    createdAt: JSON.parse(localStorage.getItem(`quarry_session_${id}`) || '{}').createdAt || Date.now(),
  };
  localStorage.setItem(`quarry_session_${id}`, JSON.stringify(data));

  // Maintain index
  const index = JSON.parse(localStorage.getItem('quarry_sessions_index') || '[]');
  if (!index.includes(id)) {
    localStorage.setItem('quarry_sessions_index', JSON.stringify([id, ...index]));
  }
}

function loadSession(id) {
  try { return JSON.parse(localStorage.getItem(`quarry_session_${id}`)); }
  catch { return null; }
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function parseSessionState(text) {
  const m = text.match(/<!--\s*SESSION_STATE\s*([\s\S]*?)-->/);
  if (!m) return null;
  const state = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^\s*([\w_]+)\s*:\s*(.+?)\s*$/);
    if (kv) state[kv[1]] = kv[2];
  }
  return state;
}

function stripSessionState(text) {
  return text.replace(/<!--\s*SESSION_STATE[\s\S]*?-->/g, '').trimEnd();
}

function extractTopic(messages) {
  // Look for SESSION_STATE topic in assistant messages
  for (const m of [...messages].reverse()) {
    if (m.role === 'assistant') {
      const state = parseSessionState(m.content);
      if (state?.topic && state.topic !== '[topic]') return state.topic;
    }
  }
  // Fallback: use second user message (first real answer after phase 1 q1)
  const userMsgs = messages.filter(m => m.role === 'user' && m.content.trim());
  if (userMsgs.length >= 2) return userMsgs[1].content.slice(0, 60);
  return null;
}

/* ── Phase tracker ───────────────────────────────────────────────────────── */

function PhaseTracker({ current }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0, py: 1.25, px: 3, borderBottom: '1px solid var(--border)', bgcolor: 'transparent' }}>
      {PHASES.map((p, i) => (
        <React.Fragment key={p.n}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.4 }}>
            <Box sx={{
              width: 26, height: 26,
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.65rem', fontWeight: 700, fontFamily: 'var(--font-family)',
              transition: 'all 0.2s',
              ...(p.n < current
                ? { bgcolor: 'var(--accent)', color: '#fff' }
                : p.n === current
                  ? { bgcolor: 'var(--accent)', color: '#fff', boxShadow: '0 0 0 3px rgba(249,115,22,0.2)' }
                  : { bgcolor: 'var(--bg-tertiary)', color: 'var(--fg-dim)', border: '1px solid var(--border)' }
              ),
            }}>
              {p.n < current ? '✓' : p.n}
            </Box>
            <Typography sx={{
              fontFamily: 'var(--font-family)', fontSize: '0.58rem', fontWeight: 600,
              letterSpacing: '0.05em', textTransform: 'uppercase',
              color: p.n <= current ? 'var(--accent)' : 'var(--fg-dim)',
              transition: 'color 0.2s',
            }}>
              {p.label}
            </Typography>
          </Box>
          {i < PHASES.length - 1 && (
            <Box sx={{
              flex: 1, height: '1px', mx: 0.5, mb: 2,
              bgcolor: p.n < current ? 'var(--accent)' : 'var(--border)',
              transition: 'background-color 0.3s',
            }} />
          )}
        </React.Fragment>
      ))}
    </Box>
  );
}

/* ── Message bubbles ─────────────────────────────────────────────────────── */

function UserBubble({ content }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
      <Box sx={{
        maxWidth: '72%', px: 1.75, py: 1.1,
        bgcolor: 'var(--accent)', color: '#fff',
        borderRadius: '16px 16px 4px 16px',
        fontFamily: 'var(--font-family)', fontSize: '0.875rem', lineHeight: 1.6,
      }}>
        {content}
      </Box>
    </Box>
  );
}

function AssistantBubble({ content, streaming }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 1.5 }}>
      <Box sx={{ maxWidth: '82%' }}>
        <GlassCard style={{ padding: '14px 18px' }}>
          <Box sx={MD_STYLES}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {stripSessionState(content)}
            </ReactMarkdown>
          </Box>
          {streaming && (
            <Box component="span" sx={{
              display: 'inline-block', width: 7, height: 15, mt: 0.5,
              bgcolor: 'var(--accent)', borderRadius: '2px',
              animation: 'blinkPulse 1s step-end infinite',
              verticalAlign: 'text-bottom',
            }} />
          )}
        </GlassCard>
      </Box>
    </Box>
  );
}

/* ── Input bar ───────────────────────────────────────────────────────────── */

function InputBar({ onSubmit, disabled }) {
  const [text, setText] = useState('');
  const ref = useRef(null);

  const submit = () => {
    const t = text.trim();
    if (!t || disabled) return;
    setText('');
    onSubmit(t);
  };

  return (
    <Box sx={{
      borderTop: '1px solid var(--border)',
      bgcolor: 'transparent',
      px: 3, py: 1.5,
    }}>
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1.25,
        borderBottom: '1px solid var(--border)',
        pb: 0.75,
        '&:focus-within': { borderBottomColor: 'var(--accent)' },
      }}>
        <input
          ref={ref}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder={disabled ? 'Waiting for response…' : 'Type your response…'}
          disabled={disabled}
          autoComplete="off"
          style={{
            flex: 1, border: 'none', outline: 'none',
            background: 'transparent',
            fontSize: '0.9rem', fontFamily: 'var(--font-family)', fontWeight: 300,
            color: 'var(--fg-primary)', padding: '4px 0',
            opacity: disabled ? 0.5 : 1,
          }}
        />
        <button
          onClick={submit}
          disabled={disabled || !text.trim()}
          style={{
            ...GLASS_BTN_ACCENT,
            opacity: disabled || !text.trim() ? 0.4 : 1,
            cursor: disabled || !text.trim() ? 'default' : 'pointer',
          }}
        >
          <Send size={13} />
          Send
        </button>
      </Box>
    </Box>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */

export default function ResearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Session ID — from URL or newly generated
  const sessionIdRef = useRef(null);
  if (!sessionIdRef.current) {
    const fromUrl = searchParams.get('session');
    sessionIdRef.current = fromUrl || genUUID();
  }

  const [messages,     setMessages]     = useState([]);
  const [streaming,    setStreaming]     = useState(false);
  const [currentPhase, setCurrentPhase] = useState(1);
  const abortRef  = useRef(null);
  const bottomRef = useRef(null);
  const initiated = useRef(false);

  // On mount: restore from localStorage if session exists, or start fresh
  useEffect(() => {
    const id = sessionIdRef.current;
    // Put session ID in URL without triggering navigation
    setSearchParams({ session: id }, { replace: true });

    const saved = loadSession(id);
    if (saved && saved.messages?.length > 0) {
      setMessages(saved.messages);
      setCurrentPhase(saved.phase || 1);
      // Session already has content — don't auto-init
      initiated.current = true;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist on every messages/phase change (skip empty initial state)
  useEffect(() => {
    if (messages.length === 0) return;
    const id = sessionIdRef.current;
    const topic = extractTopic(messages);
    saveSession(id, messages, currentPhase, topic);
  }, [messages, currentPhase]);

  // Auto-scroll on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (userText, isInit = false) => {
    if (!isInit) {
      setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: userText }]);
    }

    // Build history from settled messages
    const history = messages
      .filter(m => !m.streaming)
      .map(m => ({ role: m.role, content: stripSessionState(m.content) }));

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    const assistantId = Date.now() + 1;
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', streaming: true }]);
    setStreaming(true);

    let accumulated = '';

    try {
      const res = await fetch(`${API}/explore/research`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: history, message: isInit ? '' : userText }),
        signal:  abortRef.current.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

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
          if (raw === '[DONE]') break;
          try {
            const evt = JSON.parse(raw);
            if (evt.type === 'chunk') {
              accumulated += evt.text;
              const snap = accumulated;
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: snap } : m
              ));
            }
          } catch { /* ignore parse errors */ }
        }
      }

      const state = parseSessionState(accumulated);
      if (state?.phase) setCurrentPhase(parseInt(state.phase, 10));

    } catch (err) {
      if (err.name !== 'AbortError') {
        accumulated = 'Something went wrong. Please try again.';
      }
    } finally {
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, content: accumulated, streaming: false } : m
      ));
      setStreaming(false);
    }
  }, [messages]);

  // Auto-start Phase 1 on mount (only for new sessions)
  useEffect(() => {
    if (!initiated.current) {
      initiated.current = true;
      sendMessage('', true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'transparent' }}>

      {/* Header */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1.5,
        px: 3, py: 1.25,
        background: 'rgba(237,232,223,0.72)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 0, zIndex: 20,
      }}>
        <Box
          onClick={() => navigate('/')}
          sx={{
            display: 'flex', alignItems: 'center', gap: 0.5,
            cursor: 'pointer', color: 'var(--fg-dim)',
            fontFamily: 'var(--font-family)', fontSize: '0.78rem',
            transition: 'color 0.15s',
            '&:hover': { color: 'var(--fg-primary)' },
          }}
        >
          <ArrowLeft size={15} /> Back
        </Box>
        <Box sx={{ width: '1px', height: 16, bgcolor: 'var(--border)' }} />
        <Typography sx={{
          fontFamily: 'var(--font-serif)', fontSize: '1.05rem', fontWeight: 600,
          color: 'var(--fg-primary)', letterSpacing: '-0.01em',
        }}>
          Quarry Research
        </Typography>
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            onClick={() => navigate('/research/sessions')}
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.5,
              px: 1, py: 0.4, borderRadius: '7px', cursor: 'pointer',
              color: 'var(--fg-dim)', fontFamily: 'var(--font-family)',
              fontSize: '0.72rem', fontWeight: 500,
              transition: 'all 0.15s',
              '&:hover': { color: 'var(--fg-primary)', bgcolor: 'var(--bg-tertiary)' },
            }}
          >
            <History size={13} /> Sessions
          </Box>
          <Box sx={{
            px: 1, py: 0.25, borderRadius: '6px',
            bgcolor: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)',
            fontFamily: 'var(--font-family)', fontSize: '0.62rem', fontWeight: 700,
            color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            Phase {currentPhase} · {PHASES[currentPhase - 1]?.label}
          </Box>
        </Box>
      </Box>

      {/* Phase tracker */}
      <PhaseTracker current={currentPhase} />

      {/* Message thread */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 2.5 }}>
        <Box sx={{ maxWidth: 760, mx: 'auto', display: 'flex', flexDirection: 'column' }}>

          {messages.length === 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <Box sx={{
                width: 20, height: 20, borderRadius: '50%',
                border: '2px solid var(--border)', borderTopColor: 'var(--accent)',
                animation: 'researchSpin 0.7s linear infinite',
              }} />
            </Box>
          )}

          {messages.map(msg =>
            msg.role === 'user'
              ? <UserBubble key={msg.id} content={msg.content} />
              : <AssistantBubble key={msg.id} content={msg.content} streaming={msg.streaming} />
          )}

          <div ref={bottomRef} />
        </Box>
      </Box>

      {/* Input */}
      <InputBar onSubmit={text => sendMessage(text)} disabled={streaming} />

      <style>{`
        @keyframes blinkPulse  { 50% { opacity: 0; } }
        @keyframes researchSpin { to { transform: rotate(360deg); } }
      `}</style>
    </Box>
  );
}
