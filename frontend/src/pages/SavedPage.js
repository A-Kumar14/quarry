import React, { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { ArrowLeft, Trash2, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import GlassCard from '../components/GlassCard';
import { useTopOffset } from '../SettingsContext';

function getSavedSearches() {
  try { return JSON.parse(localStorage.getItem('quarry_saved') || '[]'); }
  catch { return []; }
}

export default function SavedPage() {
  const navigate  = useNavigate();
  const topOffset = useTopOffset();
  const [items, setItems] = useState(getSavedSearches);

  const remove = (id) => {
    const updated = items.filter(i => i.id !== id);
    try { localStorage.setItem('quarry_saved', JSON.stringify(updated)); } catch { /* private mode */ }
    setItems(updated);
  };

  return (
    <Box sx={{ minHeight: '100vh', px: 3, py: 3, paddingTop: `${topOffset}px` }}>
      <Box sx={{ maxWidth: 720, mx: 'auto' }}>

        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <Box
            onClick={() => navigate('/')}
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.5,
              cursor: 'pointer', color: 'var(--fg-dim)',
              fontFamily: 'var(--font-family)', fontSize: '0.78rem',
              transition: 'color 0.15s', '&:hover': { color: 'var(--fg-primary)' },
            }}
          >
            <ArrowLeft size={15} /> Back
          </Box>
          <Box sx={{ width: '1px', height: 16, bgcolor: 'var(--border)' }} />
          <Typography sx={{
            fontFamily: 'var(--font-serif)', fontSize: '1.1rem', fontWeight: 600,
            color: 'var(--fg-primary)', letterSpacing: '-0.01em',
          }}>
            Saved Searches
          </Typography>
        </Box>

        {items.length === 0 ? (
          <GlassCard style={{ padding: '48px 24px', textAlign: 'center' }}>
            <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.88rem', color: 'var(--fg-dim)', fontStyle: 'italic' }}>
              No saved searches yet. Hit Save on any result to bookmark it here.
            </Typography>
          </GlassCard>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {items.slice().reverse().map(item => (
              <GlassCard key={item.id} style={{ padding: '16px 20px' }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                      <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: 'var(--accent)', flexShrink: 0 }} />
                      <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.58rem', fontWeight: 500, color: 'var(--fg-dim)', letterSpacing: '0.10em', textTransform: 'uppercase' }}>
                        {new Date(item.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Typography>
                    </Box>
                    <Typography sx={{
                      fontFamily: 'var(--font-serif)', fontSize: '1rem', fontWeight: 600,
                      color: 'var(--fg-primary)', lineHeight: 1.3, mb: 0.5,
                    }}>
                      {item.query}
                    </Typography>
                    {item.excerpt && (
                      <Typography sx={{
                        fontFamily: 'var(--font-family)', fontSize: '0.78rem', fontWeight: 300,
                        color: 'var(--fg-secondary)', lineHeight: 1.55,
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {item.excerpt}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, flexShrink: 0 }}>
                    <Box
                      onClick={() => navigate(`/?q=${encodeURIComponent(item.query)}`)}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 0.5,
                        px: 1.25, py: 0.5, borderRadius: '8px', cursor: 'pointer',
                        border: '1px solid var(--border)', background: 'rgba(249,115,22,0.08)',
                        color: 'var(--accent)', fontFamily: 'var(--font-family)',
                        fontSize: '0.72rem', fontWeight: 500, transition: 'all 0.13s',
                        '&:hover': { background: 'rgba(249,115,22,0.15)' },
                      }}
                    >
                      <Search size={11} /> Search
                    </Box>
                    <Box
                      onClick={() => remove(item.id)}
                      sx={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        px: 1.25, py: 0.5, borderRadius: '8px', cursor: 'pointer',
                        border: '1px solid var(--border)', color: 'var(--fg-dim)',
                        fontFamily: 'var(--font-family)', fontSize: '0.72rem',
                        transition: 'all 0.13s',
                        '&:hover': { color: 'var(--error)', borderColor: 'var(--error)' },
                      }}
                    >
                      <Trash2 size={11} />
                    </Box>
                  </Box>
                </Box>
              </GlassCard>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
