import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDarkMode } from '../DarkModeContext';

function ago(iso) {
  const ts = Date.parse(iso || '');
  if (!ts) return 'just now';
  const diff = Date.now() - ts;
  if (diff < 60_000)     return 'just now';
  if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function lineSnippet(body) {
  const plain = String(body || '').replace(/\s+/g, ' ').trim();
  if (!plain) return 'No content yet.';
  return plain.slice(0, 120) + (plain.length > 120 ? '...' : '');
}

export default function NotesModal({
  open,
  onClose,
  notes = [],
  workspaceLabel = '',
  onCreateNote,
  onAskSuggestions,
}) {
  const navigate = useNavigate();
  const [dark] = useDarkMode();
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestions, setSuggestions]   = useState([]);

  const hasNotes = notes.length > 0;
  const sorted = useMemo(
    () => [...notes].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    [notes]
  );

  const handleOpenNote = (noteId) => {
    onClose?.();
    navigate(`/notes/${noteId}`);
  };

  const handleCreate = async () => {
    const note = await onCreateNote?.();
    if (!note?.id) return;
    onClose?.();
    navigate(`/notes/${note.id}`);
  };

  const handleAskAI = async () => {
    setIsSuggesting(true);
    try {
      const result = await onAskSuggestions?.();
      setSuggestions(Array.isArray(result) ? result : []);
    } catch {
      setSuggestions([]);
    } finally {
      setIsSuggesting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <style>{`
            @keyframes notesFadeIn {
              from { opacity: 0; transform: translateY(10px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>

          {/* Overlay */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Your notes"
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0, zIndex: 1200,
              background: dark ? 'rgba(0,0,0,0.75)' : 'rgba(60,40,20,0.45)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 24,
            }}
          >
            {/* Modal card */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.20, ease: 'easeOut' }}
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%', maxWidth: 860,
                borderRadius: 18,
                background: dark ? 'var(--bg-primary)' : '#FAF7F2',
                border: dark
                  ? '1px solid rgba(255,255,255,0.09)'
                  : '1px solid rgba(175,150,105,0.22)',
                boxShadow: dark
                  ? '0 32px 80px rgba(0,0,0,0.70)'
                  : '0 24px 60px rgba(60,40,20,0.22)',
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden',
                animation: 'notesFadeIn 0.22s ease',
                maxHeight: '88vh',
              }}
            >
              {/* ── Header ── */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 20px',
                borderBottom: '1px solid var(--border)',
                flexShrink: 0,
              }}>
                {/* Left: icon + title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 10,
                    background: 'rgba(249,115,22,0.12)',
                    border: '1px solid rgba(249,115,22,0.28)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <FileText size={15} color="var(--accent)" />
                  </div>
                  <div>
                    <div style={{
                      fontFamily: 'var(--font-serif)', fontSize: '1rem', fontWeight: 600,
                      color: 'var(--fg-primary)', lineHeight: 1.1,
                    }}>
                      Your notes
                    </div>
                    {workspaceLabel && (
                      <div style={{
                        fontFamily: 'var(--font-mono)', fontSize: '0.60rem',
                        color: 'var(--fg-dim)', marginTop: 2,
                        textTransform: 'uppercase', letterSpacing: '0.08em',
                      }}>
                        Workspace: {workspaceLabel}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: new note + close */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={handleCreate}
                    style={{
                      background: 'rgba(249,115,22,0.12)',
                      border: '1px solid rgba(249,115,22,0.35)',
                      borderRadius: 8, padding: '5px 12px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 5,
                      fontFamily: 'var(--font-family)', fontSize: '0.72rem',
                      fontWeight: 500, color: 'var(--accent)',
                      transition: 'all 0.14s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(249,115,22,0.20)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(249,115,22,0.12)'; }}
                  >
                    + New note
                  </button>
                  <button
                    onClick={onClose}
                    aria-label="Close notes modal"
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

              {/* ── Body ── */}
              <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

                {/* Notes grid */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px 20px' }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: 12,
                    alignContent: 'start',
                  }}>
                    {!hasNotes && (
                      <div style={{
                        borderRadius: 12,
                        border: `1px dashed ${dark ? 'rgba(255,255,255,0.12)' : 'rgba(175,150,105,0.30)'}`,
                        padding: 18,
                        color: 'var(--fg-secondary)',
                        fontFamily: 'var(--font-family)', fontSize: '0.82rem',
                        minHeight: 130, lineHeight: 1.5,
                      }}>
                        Start a note. We&apos;ll keep it close to your reporting.
                      </div>
                    )}

                    {sorted.map((note, idx) => (
                      <motion.button
                        key={note.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18, delay: idx * 0.03 }}
                        whileHover={{ y: -2 }}
                        onClick={() => handleOpenNote(note.id)}
                        style={{
                          textAlign: 'left', borderRadius: 14,
                          border: `1px solid ${dark ? 'var(--border)' : 'rgba(175,150,105,0.18)'}`,
                          background: dark ? 'var(--bg-secondary)' : 'rgba(255,252,244,0.82)',
                          padding: '14px 14px 12px',
                          cursor: 'pointer', color: 'inherit',
                          transition: 'border-color 0.16s, box-shadow 0.16s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = 'rgba(249,115,22,0.40)';
                          e.currentTarget.style.boxShadow = dark
                            ? '0 6px 18px rgba(0,0,0,0.30)'
                            : '0 6px 18px rgba(140,110,60,0.10)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = dark ? 'var(--border)' : 'rgba(175,150,105,0.18)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <div style={{
                          fontFamily: 'var(--font-serif)', fontSize: '0.96rem', fontWeight: 600,
                          color: 'var(--fg-primary)', marginBottom: 6,
                          display: '-webkit-box', WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical', overflow: 'hidden',
                          lineHeight: 1.35,
                        }}>
                          {note.title || 'Untitled note'}
                        </div>
                        <div style={{
                          fontFamily: 'var(--font-family)', fontSize: '0.76rem',
                          fontWeight: 300, lineHeight: 1.5,
                          color: 'var(--fg-secondary)', marginBottom: 10,
                          display: '-webkit-box', WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        }}>
                          {lineSnippet(note.body)}
                        </div>
                        <div style={{
                          fontFamily: 'var(--font-mono)', fontSize: '0.60rem',
                          textTransform: 'uppercase', letterSpacing: '0.06em',
                          color: 'var(--fg-dim)',
                        }}>
                          Topic: {note.topic?.[0] || 'General'} · updated {ago(note.updatedAt)}
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* AI suggestions panel */}
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.20 }}
                  style={{
                    width: 240, flexShrink: 0,
                    borderLeft: '1px solid var(--border)',
                    display: 'flex', flexDirection: 'column',
                    background: dark ? 'rgba(255,255,255,0.02)' : 'rgba(255,252,244,0.50)',
                    padding: '18px 16px',
                    gap: 10,
                  }}
                >
                  {/* Panel header */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontFamily: 'var(--font-mono)', fontSize: '0.60rem',
                    letterSpacing: '0.10em', textTransform: 'uppercase',
                    color: 'var(--fg-dim)',
                    paddingBottom: 10,
                    borderBottom: '1px solid var(--border)',
                  }}>
                    <Sparkles size={11} />
                    AI Suggestions
                  </div>

                  <p style={{
                    fontFamily: 'var(--font-family)', fontSize: '0.78rem', fontWeight: 300,
                    lineHeight: 1.55, color: 'var(--fg-secondary)', margin: 0,
                  }}>
                    Review all notes and suggest next reporting steps.
                  </p>

                  <button
                    onClick={handleAskAI}
                    disabled={isSuggesting || !hasNotes}
                    style={{
                      width: '100%', borderRadius: 9, padding: '8px 10px',
                      border: `1px solid ${hasNotes ? 'rgba(249,115,22,0.35)' : 'var(--border)'}`,
                      background: hasNotes ? 'rgba(249,115,22,0.10)' : 'transparent',
                      color: hasNotes ? 'var(--accent)' : 'var(--fg-dim)',
                      cursor: hasNotes ? 'pointer' : 'not-allowed',
                      fontFamily: 'var(--font-family)', fontSize: '0.74rem', fontWeight: 500,
                      transition: 'all 0.14s',
                    }}
                    onMouseEnter={e => {
                      if (hasNotes) e.currentTarget.style.background = 'rgba(249,115,22,0.18)';
                    }}
                    onMouseLeave={e => {
                      if (hasNotes) e.currentTarget.style.background = 'rgba(249,115,22,0.10)';
                    }}
                  >
                    {isSuggesting ? 'Thinking…' : 'Ask AI for next steps'}
                  </button>

                  {suggestions.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.20 }}
                      style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}
                    >
                      {suggestions.map((s, i) => (
                        <div
                          key={`${s.title}-${i}`}
                          style={{
                            borderRadius: 10, padding: '9px 10px',
                            background: dark ? 'var(--bg-secondary)' : 'rgba(255,252,244,0.82)',
                            border: `1px solid ${dark ? 'var(--border)' : 'rgba(175,150,105,0.18)'}`,
                          }}
                        >
                          <div style={{
                            fontFamily: 'var(--font-family)', fontSize: '0.74rem', fontWeight: 600,
                            color: 'var(--fg-primary)', marginBottom: 4,
                          }}>
                            {s.title}
                          </div>
                          <div style={{
                            fontFamily: 'var(--font-family)', fontSize: '0.72rem', fontWeight: 300,
                            color: 'var(--fg-secondary)', lineHeight: 1.5,
                          }}>
                            {s.description}
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </motion.div>
              </div>

              {/* ── Footer ── */}
              <div style={{
                padding: '9px 20px',
                borderTop: '1px solid var(--border)',
                background: dark ? 'rgba(255,255,255,0.02)' : 'rgba(255,252,244,0.60)',
                backdropFilter: 'blur(12px)',
                display: 'flex', alignItems: 'center', gap: 7,
                color: 'var(--fg-dim)',
                fontFamily: 'var(--font-mono)', fontSize: '0.60rem',
                textTransform: 'uppercase', letterSpacing: '0.08em',
                flexShrink: 0,
              }}>
                <FileText size={11} />
                {notes.length} note{notes.length !== 1 ? 's' : ''} in workspace
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
