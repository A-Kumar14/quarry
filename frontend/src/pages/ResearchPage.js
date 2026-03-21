import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import { ArrowLeft, Send, History, Settings, Download, Paperclip, X, FileText, Layers } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNavigate, useSearchParams } from 'react-router-dom';
import GlassCard from '../components/GlassCard';
import { useTopOffset } from '../SettingsContext';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';

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

/* ── Suggestion chips shown on the welcome screen ──────────────────────────── */

const SUGGESTIONS = [
  'Outline a research paper on machine learning fairness',
  'What are the key arguments for and against universal basic income?',
  'Summarize the current state of research on CRISPR gene editing',
  'Compare qualitative and quantitative research methods',
  'Help me write a literature review section',
  'What citation style should I use for a psychology paper?',
];

/* ── Session persistence helpers ─────────────────────────────────────────── */

function genUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxx-xxxx-4xxx-yxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : ((r & 0x3) | 0x8)).toString(16);
  });
}

function saveSession(id, messages, topic) {
  const data = {
    id, messages,
    topic: topic || 'Untitled session',
    updatedAt: Date.now(),
    createdAt: JSON.parse(localStorage.getItem(`quarry_session_${id}`) || '{}').createdAt || Date.now(),
  };
  localStorage.setItem(`quarry_session_${id}`, JSON.stringify(data));

  const index = JSON.parse(localStorage.getItem('quarry_sessions_index') || '[]');
  if (!index.includes(id)) {
    localStorage.setItem('quarry_sessions_index', JSON.stringify([id, ...index]));
  }
}

function loadSession(id) {
  try { return JSON.parse(localStorage.getItem(`quarry_session_${id}`)); }
  catch { return null; }
}

function extractTopic(messages) {
  const first = messages.find(m => m.role === 'user' && m.content?.trim());
  return first ? first.content.slice(0, 60) : null;
}

/* ── Message bubbles ─────────────────────────────────────────────────────── */

function UserBubble({ content, attachments }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', mb: 1.5, gap: 0.5 }}>
      {attachments?.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 0.5, maxWidth: '72%' }}>
          {attachments.map((a, i) => (
            <Box key={i} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.35, borderRadius: '8px', border: '1px solid rgba(249,115,22,0.3)', background: 'rgba(249,115,22,0.08)' }}>
              <FileText size={10} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.63rem', color: 'var(--accent)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {a.filename}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
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
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
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

const ALLOWED_EXTS = ['.pdf', '.docx', '.txt', '.md', '.csv'];

/* ── Artifacts panel ─────────────────────────────────────────────────────── */

function ArtifactsPanel({ artifacts, onRemove, onClose }) {
  return (
    <Box sx={{
      position: 'absolute', bottom: '100%', left: 0, right: 0,
      background: 'rgba(237,232,223,0.97)', backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderTop: '1px solid var(--border)', zIndex: 10,
      maxHeight: 280, overflowY: 'auto',
      '&::-webkit-scrollbar': { width: 3 },
      '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(175,150,105,0.28)', borderRadius: 2 },
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 3, py: 1, borderBottom: '1px solid var(--border)' }}>
        <Layers size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.62rem', fontWeight: 600, color: 'var(--fg-dim)', letterSpacing: '0.10em', textTransform: 'uppercase', flex: 1 }}>
          Attached Files ({artifacts.length})
        </Typography>
        <Box onClick={onClose} sx={{ cursor: 'pointer', opacity: 0.5, '&:hover': { opacity: 1 }, lineHeight: 1 }}>
          <X size={13} color="var(--fg-secondary)" />
        </Box>
      </Box>
      <Box sx={{ px: 3, py: 1.25, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {artifacts.length === 0 ? (
          <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.78rem', color: 'var(--fg-dim)', fontStyle: 'italic', py: 1 }}>
            No files attached yet. Use the paperclip button to attach a file.
          </Typography>
        ) : artifacts.map((art, i) => (
          <Box key={i} sx={{
            display: 'flex', alignItems: 'flex-start', gap: 1.25,
            p: '10px 12px', borderRadius: '10px',
            border: '1px solid var(--border)', background: 'rgba(255,252,242,0.6)',
          }}>
            <FileText size={14} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.82rem', fontWeight: 600, color: 'var(--fg-primary)', mb: 0.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {art.filename}
              </Typography>
              <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.65rem', color: 'var(--fg-dim)' }}>
                {art.chars.toLocaleString()} chars extracted{art.truncated ? ' (truncated to 12,000)' : ''}
              </Typography>
              <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.68rem', color: 'var(--fg-secondary)', mt: 0.5, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {art.text.slice(0, 120)}…
              </Typography>
            </Box>
            <Box onClick={() => onRemove(i)} sx={{ p: 0.4, cursor: 'pointer', borderRadius: '5px', color: 'var(--fg-dim)', flexShrink: 0, transition: 'all 0.12s', '&:hover': { color: '#dc2626', bgcolor: 'rgba(220,38,38,0.08)' } }}>
              <X size={11} />
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/* ── Input bar ───────────────────────────────────────────────────────────── */

function InputBar({ onSubmit, disabled, artifacts, onAttach, onRemoveArtifact, placeholder }) {
  const [text,          setText]         = useState('');
  const [uploading,     setUploading]     = useState(false);
  const [uploadErr,     setUploadErr]     = useState('');
  const [showArtifacts, setShowArtifacts] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (artifacts.length === 0) setShowArtifacts(false);
  }, [artifacts.length]);

  const submit = () => {
    const t = text.trim();
    if (!t || disabled) return;
    setText('');
    onSubmit(t, artifacts);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!fileInputRef.current) return;
    fileInputRef.current.value = '';
    if (!file) return;

    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      setUploadErr(`Unsupported type. Use: ${ALLOWED_EXTS.join(', ')}`);
      setTimeout(() => setUploadErr(''), 3500);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadErr('File too large. Max 10 MB.');
      setTimeout(() => setUploadErr(''), 3500);
      return;
    }

    setUploading(true);
    setUploadErr('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API}/explore/parse-file`, { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      onAttach(data);
      setShowArtifacts(true);
    } catch (err) {
      setUploadErr(err.message || 'Upload failed.');
      setTimeout(() => setUploadErr(''), 3500);
    } finally {
      setUploading(false);
    }
  };

  const canSend = !disabled && text.trim().length > 0;

  return (
    <Box sx={{
      position: 'relative',
      background: 'rgba(237,232,223,0.92)',
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      borderTop: '1px solid var(--border)',
      boxShadow: '0 -6px 24px rgba(140,110,60,0.08)',
      px: 3, py: 1.5,
    }}>

      {showArtifacts && (
        <ArtifactsPanel
          artifacts={artifacts}
          onRemove={onRemoveArtifact}
          onClose={() => setShowArtifacts(false)}
        />
      )}

      {/* Centred inner wrapper to align with message thread */}
      <Box sx={{ maxWidth: 760, mx: 'auto' }}>

        {/* Attached file pills */}
        {artifacts.length > 0 && !showArtifacts && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 0.75 }}>
            {artifacts.map((art, i) => (
              <Box key={i} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.3, borderRadius: 999, border: '1px solid rgba(249,115,22,0.3)', background: 'rgba(249,115,22,0.07)', cursor: 'pointer' }} onClick={() => setShowArtifacts(true)}>
                <FileText size={10} style={{ color: 'var(--accent)' }} />
                <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.63rem', color: 'var(--accent)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {art.filename}
                </Typography>
                <Box onClick={e => { e.stopPropagation(); onRemoveArtifact(i); }} sx={{ display: 'flex', cursor: 'pointer' }}>
                  <X size={9} style={{ color: 'var(--accent)' }} />
                </Box>
              </Box>
            ))}
          </Box>
        )}

        {/* Pill input container */}
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          borderRadius: '12px',
          border: '1px solid var(--border)',
          background: 'rgba(255,252,245,0.70)',
          px: 1.25, py: 0.75,
          boxShadow: '0 1px 4px rgba(140,110,60,0.06)',
          transition: 'box-shadow 0.18s, border-color 0.18s',
          '&:focus-within': {
            borderColor: 'rgba(249,115,22,0.35)',
            boxShadow: '0 2px 10px rgba(249,115,22,0.08), 0 0 0 3px var(--accent-dim)',
          },
        }}>
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_EXTS.join(',')}
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          {/* Paperclip — visually balanced */}
          <Box
            onClick={() => !disabled && !uploading && fileInputRef.current?.click()}
            sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 30, height: 30, borderRadius: '8px', flexShrink: 0,
              cursor: disabled || uploading ? 'default' : 'pointer',
              color: artifacts.length > 0 ? 'var(--accent)' : 'var(--fg-dim)',
              opacity: disabled || uploading ? 0.35 : artifacts.length > 0 ? 1 : 0.60,
              transition: 'all 0.13s',
              '&:hover': { opacity: disabled || uploading ? 0.35 : 1, bgcolor: 'rgba(0,0,0,0.04)', borderRadius: '8px' },
            }}
          >
            {uploading
              ? <Box sx={{ width: 13, height: 13, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'researchSpin 0.7s linear infinite' }} />
              : <Paperclip size={14} />
            }
          </Box>

          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder={placeholder || (disabled ? 'Waiting for response…' : 'Ask anything about your research…')}
            disabled={disabled}
            autoComplete="off"
            style={{
              flex: 1, border: 'none', outline: 'none',
              background: 'transparent',
              fontSize: '0.9rem', fontFamily: 'var(--font-family)', fontWeight: 300,
              color: 'var(--fg-primary)', padding: '5px 4px',
              opacity: disabled ? 0.5 : 1,
            }}
          />

          {artifacts.length > 0 && (
            <Box
              onClick={() => setShowArtifacts(v => !v)}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.4, px: 0.9, py: 0.3, borderRadius: 999, cursor: 'pointer', border: '1px solid rgba(249,115,22,0.3)', background: 'rgba(249,115,22,0.08)', flexShrink: 0 }}
            >
              <Layers size={10} style={{ color: 'var(--accent)' }} />
              <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.60rem', fontWeight: 700, color: 'var(--accent)' }}>
                {artifacts.length}
              </Typography>
            </Box>
          )}

          {/* Send button — pressed inset look when active */}
          <button
            onClick={submit}
            disabled={!canSend}
            style={{
              ...GLASS_BTN_ACCENT,
              padding: '6px 14px',
              opacity: canSend ? 1 : 0.35,
              cursor: canSend ? 'pointer' : 'default',
              flexShrink: 0,
            }}
            onMouseDown={e => {
              if (!canSend) return;
              e.currentTarget.style.boxShadow = 'inset 0 2px 6px rgba(0,0,0,0.22), 0 1px 0 rgba(255,205,148,0.30) inset';
              e.currentTarget.style.transform = 'translateY(1px)';
            }}
            onMouseUp={e => {
              e.currentTarget.style.boxShadow = GLASS_BTN_ACCENT.boxShadow;
              e.currentTarget.style.transform = 'none';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.boxShadow = GLASS_BTN_ACCENT.boxShadow;
              e.currentTarget.style.transform = 'none';
            }}
          >
            <Send size={12} />
            Send
          </button>
        </Box>

        {uploadErr && (
          <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.68rem', color: 'var(--error)', mt: 0.5, pl: 0.5 }}>
            {uploadErr}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

/* ── Welcome screen ──────────────────────────────────────────────────────── */

function WelcomeScreen({ onSuggestion }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, px: 3, pt: 7, pb: 5 }}>

      {/* Hero — generous vertical breathing room */}
      <Box sx={{ textAlign: 'center', mb: 5 }}>
        {/* Tiny rule above */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, justifyContent: 'center' }}>
          <Box sx={{ width: 32, height: '1px', bgcolor: 'var(--fg-primary)', opacity: 0.10 }} />
          <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.5rem', fontWeight: 600, color: 'var(--fg-dim)', letterSpacing: '0.22em', textTransform: 'uppercase' }}>
            Research Assistant
          </Typography>
          <Box sx={{ width: 32, height: '1px', bgcolor: 'var(--fg-primary)', opacity: 0.10 }} />
        </Box>

        <Typography sx={{
          fontFamily: 'var(--font-serif)', fontSize: { xs: '2rem', sm: '2.4rem' }, fontWeight: 600,
          color: 'var(--fg-primary)', letterSpacing: '-0.02em', lineHeight: 1.15, mb: 1.5,
        }}>
          Quarry Research
        </Typography>

        {/* Rule below title */}
        <Box sx={{ height: '1px', bgcolor: 'var(--fg-primary)', opacity: 0.08, maxWidth: 200, mx: 'auto', mb: 1.75 }} />

        <Typography sx={{
          fontFamily: 'var(--font-family)', fontSize: '0.9rem', fontWeight: 300,
          color: 'rgba(61,47,30,0.60)',
          maxWidth: 400, mx: 'auto', lineHeight: 1.65,
          fontStyle: 'italic',
        }}>
          Outline a paper, explore a topic, compare sources, or get writing help — one conversation at a time.
        </Typography>
      </Box>

      {/* Staggered 2-column suggestion cards */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
        gap: 1,
        width: '100%',
        maxWidth: 600,
        alignItems: 'start',
      }}>
        {SUGGESTIONS.map((s, i) => (
          <Box
            key={i}
            onClick={() => onSuggestion(s)}
            sx={{
              px: 1.75, py: 1.25,
              borderRadius: '10px',
              border: '1px solid rgba(0,0,0,0.05)',
              background: 'rgba(255,252,242,0.60)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              '&:hover': {
                background: 'rgba(0,0,0,0.04)',
                borderColor: 'rgba(249,115,22,0.25)',
                transform: 'translateY(-1px)',
                boxShadow: '0 3px 10px rgba(140,110,60,0.08)',
              },
            }}
          >
            <Typography sx={{
              fontFamily: 'var(--font-family)', fontSize: '0.78rem', fontWeight: 400,
              color: 'var(--fg-secondary)', lineHeight: 1.45, textAlign: 'left',
            }}>
              {s}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */

export default function ResearchPage() {
  const navigate  = useNavigate();
  const topOffset = useTopOffset();
  const [searchParams, setSearchParams] = useSearchParams();

  const sessionIdRef = useRef(null);
  if (!sessionIdRef.current) {
    const fromUrl = searchParams.get('session');
    sessionIdRef.current = fromUrl || genUUID();
  }

  const [messages,  setMessages]  = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [exported,  setExported]  = useState(false);
  const [artifacts, setArtifacts] = useState([]);
  const abortRef    = useRef(null);
  const bottomRef   = useRef(null);
  const messagesRef = useRef([]);

  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => {
    const id = sessionIdRef.current;
    setSearchParams({ session: id }, { replace: true });

    const saved = loadSession(id);
    if (saved && saved.messages?.length > 0) {
      setMessages(saved.messages);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (messages.length === 0) return;
    const id = sessionIdRef.current;
    saveSession(id, messages, extractTopic(messages));
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (userText, fileArtifacts = []) => {
    const attachments = fileArtifacts.map(a => ({ filename: a.filename }));
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: userText, attachments }]);

    const history = messagesRef.current
      .filter(m => !m.streaming)
      .map(m => ({ role: m.role, content: m.content }));

    const fileContext = fileArtifacts.length > 0
      ? fileArtifacts.map(a => `[File: ${a.filename}]\n${a.text}`).join('\n\n---\n\n')
      : null;

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
        body:    JSON.stringify({ messages: history, message: userText, file_context: fileContext }),
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const exportSession = () => {
    const topic = extractTopic(messages) || 'Research Session';
    const date  = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const lines = [`# ${topic}`, `*Quarry Research — Exported ${date}*`, ''];

    for (const msg of messages) {
      if (msg.role === 'user') {
        lines.push(`**You:** ${msg.content}`, '');
      } else if (msg.role === 'assistant' && msg.content?.trim()) {
        lines.push(msg.content.trim(), '');
      }
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${topic.slice(0, 50).replace(/[^a-z0-9]/gi, '-').toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
    setExported(true);
    setTimeout(() => setExported(false), 2500);
  };

  const isEmpty = messages.length === 0;

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'transparent', paddingTop: `${topOffset}px` }}>

      {/* Header */}
      <Box sx={{
        background: 'rgba(237,232,223,0.82)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 0, zIndex: 20,
        px: 3, py: 1.25,
      }}>
        {/* Inner container aligned with card content */}
        <Box sx={{ maxWidth: 760, mx: 'auto', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            onClick={() => navigate('/')}
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.5,
              cursor: 'pointer', color: 'var(--fg-dim)',
              fontFamily: 'var(--font-family)', fontSize: '0.78rem',
              transition: 'color 0.15s', flexShrink: 0,
              '&:hover': { color: 'var(--fg-primary)' },
            }}
          >
            <ArrowLeft size={15} /> Back
          </Box>
          <Box sx={{ width: '1px', height: 16, bgcolor: 'var(--border)', flexShrink: 0 }} />
          <Typography sx={{
            fontFamily: 'var(--font-serif)', fontSize: '1.05rem', fontWeight: 600,
            color: 'var(--fg-primary)', letterSpacing: '-0.01em', flex: 1,
          }}>
            Quarry Research
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {messages.length > 2 && (
              <Box
                onClick={exportSession}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.5,
                  px: 1, py: 0.4, borderRadius: '7px', cursor: 'pointer',
                  color: exported ? '#16a34a' : 'var(--fg-dim)', fontFamily: 'var(--font-family)',
                  fontSize: '0.72rem', fontWeight: 500,
                  transition: 'all 0.15s',
                  '&:hover': { color: 'var(--fg-primary)', bgcolor: 'var(--bg-tertiary)' },
                }}
              >
                <Download size={13} /> {exported ? 'Exported!' : 'Export'}
              </Box>
            )}
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
            <Box onClick={() => navigate('/settings')} sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', opacity: 0.4, '&:hover': { opacity: 0.85 }, transition: 'opacity 0.14s' }}>
              <Settings size={14} color="var(--fg-dim)" />
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Message thread or welcome screen */}
      <Box sx={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {isEmpty ? (
          <WelcomeScreen onSuggestion={s => sendMessage(s, [])} />
        ) : (
          <Box sx={{ px: 3, py: 2.5 }}>
            <Box sx={{ maxWidth: 760, mx: 'auto', display: 'flex', flexDirection: 'column' }}>
              {messages.map(msg =>
                msg.role === 'user'
                  ? <UserBubble key={msg.id} content={msg.content} attachments={msg.attachments} />
                  : <AssistantBubble key={msg.id} content={msg.content} streaming={msg.streaming} />
              )}
              <div ref={bottomRef} />
            </Box>
          </Box>
        )}
      </Box>

      {/* Input */}
      <InputBar
        onSubmit={(text, arts) => { sendMessage(text, arts); setArtifacts([]); }}
        disabled={streaming}
        artifacts={artifacts}
        onAttach={art => setArtifacts(prev => [...prev, art])}
        onRemoveArtifact={idx => setArtifacts(prev => prev.filter((_, i) => i !== idx))}
      />

      <style>{`
        @keyframes blinkPulse  { 50% { opacity: 0; } }
        @keyframes researchSpin { to { transform: rotate(360deg); } }
      `}</style>
    </Box>
  );
}
