import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import { ArrowLeft, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNavigate } from 'react-router-dom';
import GlassCard from '../components/GlassCard';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const PHASES = [
  { n: 1, label: 'Onboarding' },
  { n: 2, label: 'Scope'      },
  { n: 3, label: 'Research'   },
  { n: 4, label: 'Synthesis'  },
  { n: 5, label: 'Wrap-up'    },
];

const MD_STYLES = {
  '& p':              { fontFamily: 'var(--font-family)', fontSize: '0.9rem', lineHeight: 1.72, color: 'var(--fg-primary)', my: 0.5 },
  '& h1,& h2,& h3':  { fontFamily: 'var(--font-family)', fontWeight: 700, color: 'var(--fg-primary)', mt: 1.5, mb: 0.5 },
  '& h2':             { fontSize: '0.95rem' },
  '& h3':             { fontSize: '0.85rem' },
  '& ul,& ol':        { pl: 2.5, my: 0.5 },
  '& li':             { fontSize: '0.9rem', lineHeight: 1.65, mb: 0.25, color: 'var(--fg-primary)' },
  '& strong':         { fontWeight: 700, color: 'var(--fg-primary)' },
  '& code':           { fontFamily: 'var(--font-mono)', fontSize: '0.82rem', bgcolor: 'var(--bg-tertiary)', px: '5px', py: '1px', borderRadius: '4px' },
  '& pre':            { bgcolor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', p: 1.5, overflowX: 'auto', '& code': { bgcolor: 'transparent' } },
  '& blockquote':     { borderLeft: '3px solid var(--accent)', pl: 1.5, ml: 0, color: 'var(--fg-secondary)', fontStyle: 'italic' },
  '& hr':             { border: 'none', borderTop: '1px solid var(--border)', my: 1.5 },
};

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

/* ── Phase tracker ───────────────────────────────────────────────────────── */

function PhaseTracker({ current }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0, py: 1.25, px: 3, borderBottom: '1px solid var(--border)', bgcolor: 'var(--bg-primary)' }}>
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
        <GlassCard style={{ padding: '14px 18px', background: 'rgba(255,255,255,0.75)' }}>
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
      bgcolor: 'var(--bg-primary)',
      px: 3, py: 1.5,
    }}>
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1.25,
        px: 2, py: 1.1,
        borderRadius: '14px',
        background: 'rgba(255,255,255,0.15)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.30)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        '&:focus-within': {
          boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 0 0 3px var(--accent-dim)',
          borderColor: 'rgba(249,115,22,0.35)',
        },
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
            fontSize: '0.9rem', fontFamily: 'var(--font-family)',
            color: 'var(--fg-primary)', padding: '4px 0',
            opacity: disabled ? 0.5 : 1,
          }}
        />
        <Box
          onClick={submit}
          sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 30, height: 30, borderRadius: '8px', flexShrink: 0,
            bgcolor: disabled || !text.trim() ? 'var(--bg-tertiary)' : 'var(--accent)',
            color: disabled || !text.trim() ? 'var(--fg-dim)' : '#fff',
            cursor: disabled || !text.trim() ? 'default' : 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <Send size={14} />
        </Box>
      </Box>
    </Box>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */

export default function ResearchPage() {
  const navigate = useNavigate();
  const [messages,     setMessages]     = useState([]);   // { id, role, content, streaming }
  const [streaming,    setStreaming]     = useState(false);
  const [currentPhase, setCurrentPhase] = useState(1);
  const abortRef  = useRef(null);
  const bottomRef = useRef(null);
  const initiated = useRef(false);

  // Auto-scroll on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (userText, isInit = false) => {
    // Add user bubble (skip for auto-init)
    if (!isInit) {
      setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: userText }]);
    }

    // Build history from settled messages (strip state comments, skip streaming placeholders)
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
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: accumulated } : m
              ));
            }
          } catch { /* ignore parse errors */ }
        }
      }

      // Parse phase from SESSION_STATE
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

  // Auto-start Phase 1 on mount
  useEffect(() => {
    if (!initiated.current) {
      initiated.current = true;
      sendMessage('', true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'var(--bg-primary)' }}>

      {/* Header */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1.5,
        px: 3, py: 1.25,
        bgcolor: 'var(--bg-primary)',
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
          fontFamily: 'var(--font-family)', fontSize: '0.82rem', fontWeight: 700,
          color: 'var(--fg-primary)', letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>
          Quarry Research
        </Typography>
        <Box sx={{
          ml: 'auto', px: 1, py: 0.25, borderRadius: '6px',
          bgcolor: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)',
          fontFamily: 'var(--font-family)', fontSize: '0.62rem', fontWeight: 700,
          color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          Phase {currentPhase} · {PHASES[currentPhase - 1]?.label}
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
