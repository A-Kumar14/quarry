import React, { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { ArrowLeft, Trash2, Search, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import GlassCard from '../components/GlassCard';
import { useTopOffset } from '../SettingsContext';

function getSavedSearches() {
  try { return JSON.parse(localStorage.getItem('quarry_saved') || '[]'); }
  catch { return []; }
}

const MD = {
  '& p':             { fontFamily: 'var(--font-family)', fontWeight: 300, fontSize: '0.88rem', lineHeight: 1.75, color: 'var(--fg-primary)', my: 0.5 },
  '& h1,& h2,& h3': { fontFamily: 'var(--font-serif)', fontWeight: 600, color: 'var(--fg-primary)', mt: 1.5, mb: 0.5 },
  '& h2':            { fontSize: '0.95rem' },
  '& h3':            { fontSize: '0.86rem' },
  '& ul,& ol':       { pl: 2.5, my: 0.5 },
  '& li':            { fontSize: '0.88rem', fontWeight: 300, lineHeight: 1.75, mb: 0.2, color: 'var(--fg-primary)' },
  '& strong':        { fontWeight: 600 },
  '& code':          { fontFamily: 'var(--font-mono)', fontSize: '0.80rem', bgcolor: 'var(--bg-tertiary)', px: '4px', borderRadius: '4px' },
  '& blockquote':    { borderLeft: '3px solid var(--accent)', pl: 1.5, ml: 0, color: 'var(--fg-secondary)', fontStyle: 'italic' },
  '& hr':            { border: 'none', borderTop: '1px solid var(--border)', my: 1.5 },
};

export default function SavedPage() {
  const navigate  = useNavigate();
  const topOffset = useTopOffset();
  const [items,    setItems]    = useState(getSavedSearches);
  const [expanded, setExpanded] = useState({});

  const remove = (id) => {
    const updated = items.filter(i => i.id !== id);
    try { localStorage.setItem('quarry_saved', JSON.stringify(updated)); } catch {}
    setItems(updated);
  };

  const toggle = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  return (
    <Box sx={{ minHeight: '100vh', background: 'transparent', px: 3, py: 3, paddingTop: `${topOffset + 24}px` }}>
      <Box sx={{ maxWidth: 720, mx: 'auto' }}>

        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <Box
            onClick={() => navigate('/')}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', color: 'var(--fg-dim)', fontFamily: 'var(--font-family)', fontSize: '0.78rem', transition: 'color 0.15s', '&:hover': { color: 'var(--fg-primary)' } }}
          >
            <ArrowLeft size={15} /> Back
          </Box>
          <Box sx={{ width: '1px', height: 16, bgcolor: 'var(--border)' }} />
          <Typography sx={{ fontFamily: 'var(--font-serif)', fontSize: '1.1rem', fontWeight: 600, color: 'var(--fg-primary)', letterSpacing: '-0.01em', flex: 1 }}>
            Saved Searches
          </Typography>
          <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.68rem', color: 'var(--fg-dim)' }}>
            {items.length} item{items.length !== 1 ? 's' : ''}
          </Typography>
        </Box>

        {items.length === 0 ? (
          <GlassCard style={{ padding: '48px 24px', textAlign: 'center' }}>
            <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.88rem', color: 'var(--fg-dim)', fontStyle: 'italic' }}>
              No saved searches yet. Hit Save on any result to bookmark it here.
            </Typography>
          </GlassCard>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {items.slice().reverse().map(item => {
              const isOpen = !!expanded[item.id];
              const hasSnapshot = !!item.answer;
              return (
                <GlassCard key={item.id} style={{ padding: '0' }}>
                  {/* Card header — always visible */}
                  <Box sx={{ p: '16px 20px' }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        {/* Date + source label */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.6 }}>
                          <Clock size={10} style={{ color: 'var(--fg-dim)', flexShrink: 0 }} />
                          <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.58rem', fontWeight: 500, color: 'var(--fg-dim)', letterSpacing: '0.10em', textTransform: 'uppercase' }}>
                            {new Date(item.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            {' · '}
                            {new Date(item.savedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </Typography>
                        </Box>

                        {/* Query headline */}
                        <Typography sx={{ fontFamily: 'var(--font-serif)', fontSize: '1.0rem', fontWeight: 600, color: 'var(--fg-primary)', lineHeight: 1.3, mb: 0.5 }}>
                          {item.query}
                        </Typography>

                        {/* Excerpt — always shown */}
                        {item.excerpt && (
                          <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.78rem', fontWeight: 300, color: 'var(--fg-secondary)', lineHeight: 1.55 }}>
                            {item.excerpt}
                            {item.excerpt.length >= 198 ? '…' : ''}
                          </Typography>
                        )}
                      </Box>

                      {/* Action buttons — right column */}
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, flexShrink: 0 }}>
                        <Box
                          onClick={() => navigate(`/?q=${encodeURIComponent(item.query)}`)}
                          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.25, py: 0.5, borderRadius: '8px', cursor: 'pointer', border: '1px solid var(--border)', background: 'rgba(249,115,22,0.08)', color: 'var(--accent)', fontFamily: 'var(--font-family)', fontSize: '0.72rem', fontWeight: 500, transition: 'all 0.13s', '&:hover': { background: 'rgba(249,115,22,0.15)' } }}
                        >
                          <Search size={11} /> Search
                        </Box>
                        <Box
                          onClick={() => remove(item.id)}
                          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', px: 1.25, py: 0.5, borderRadius: '8px', cursor: 'pointer', border: '1px solid var(--border)', color: 'var(--fg-dim)', fontFamily: 'var(--font-family)', fontSize: '0.72rem', transition: 'all 0.13s', '&:hover': { color: 'var(--error)', borderColor: 'var(--error)' } }}
                        >
                          <Trash2 size={11} />
                        </Box>
                      </Box>
                    </Box>

                    {/* Snapshot toggle button — only if saved with full answer */}
                    {hasSnapshot && (
                      <Box
                        onClick={() => toggle(item.id)}
                        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 1, px: 1, py: 0.35, borderRadius: '6px', cursor: 'pointer', border: '1px solid var(--border)', background: isOpen ? 'rgba(249,115,22,0.06)' : 'transparent', color: isOpen ? 'var(--accent)' : 'var(--fg-dim)', fontFamily: 'var(--font-family)', fontSize: '0.65rem', fontWeight: 500, transition: 'all 0.14s', '&:hover': { borderColor: 'rgba(249,115,22,0.3)', color: 'var(--accent)' } }}
                      >
                        {isOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                        {isOpen ? 'Hide snapshot' : 'View snapshot'}
                      </Box>
                    )}
                  </Box>

                  {/* Expandable snapshot */}
                  {isOpen && item.answer && (
                    <Box sx={{ px: '20px', pb: '18px', pt: 0 }}>
                      <Box sx={{ borderTop: '1px solid var(--border)', pt: 1.5 }}>
                        {/* Snapshot header */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.25 }}>
                          <Box sx={{ height: '1px', flex: 1, bgcolor: 'var(--border)' }} />
                          <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.52rem', fontWeight: 600, color: 'var(--fg-dim)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                            Saved snapshot · {new Date(item.savedAt).toLocaleDateString()}
                          </Typography>
                          <Box sx={{ height: '1px', flex: 1, bgcolor: 'var(--border)' }} />
                        </Box>
                        {/* Rendered markdown */}
                        <Box sx={MD}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.answer}</ReactMarkdown>
                        </Box>
                      </Box>
                    </Box>
                  )}
                </GlassCard>
              );
            })}
          </Box>
        )}
      </Box>
    </Box>
  );
}
