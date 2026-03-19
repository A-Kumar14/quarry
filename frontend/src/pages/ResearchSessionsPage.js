import React, { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { ArrowLeft, BookOpen, Trash2, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import GlassCard from '../components/GlassCard';

const PHASES = ['', 'Onboarding', 'Scope', 'Research', 'Synthesis', 'Wrap-up'];

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  <  1) return 'just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function loadAllSessions() {
  const index = JSON.parse(localStorage.getItem('quarry_sessions_index') || '[]');
  return index
    .map(id => {
      try { return JSON.parse(localStorage.getItem(`quarry_session_${id}`)); }
      catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export default function ResearchSessionsPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);

  useEffect(() => { setSessions(loadAllSessions()); }, []);

  const deleteSession = (id) => {
    localStorage.removeItem(`quarry_session_${id}`);
    const index = JSON.parse(localStorage.getItem('quarry_sessions_index') || '[]');
    localStorage.setItem('quarry_sessions_index', JSON.stringify(index.filter(i => i !== id)));
    setSessions(prev => prev.filter(s => s.id !== id));
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'var(--bg-primary)' }}>
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
          Research Sessions
        </Typography>
        <Box
          onClick={() => navigate('/research')}
          sx={{
            ml: 'auto', px: 1.5, py: 0.5, borderRadius: '8px', cursor: 'pointer',
            bgcolor: 'var(--accent)', color: '#fff',
            fontFamily: 'var(--font-family)', fontSize: '0.72rem', fontWeight: 600,
            transition: 'opacity 0.15s',
            '&:hover': { opacity: 0.85 },
          }}
        >
          + New session
        </Box>
      </Box>

      {/* Content */}
      <Box sx={{ maxWidth: 700, mx: 'auto', px: 3, py: 4 }}>
        {sessions.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 10 }}>
            <BookOpen size={36} style={{ color: 'var(--fg-dim)', marginBottom: 12 }} />
            <Typography sx={{
              fontFamily: 'var(--font-family)', fontSize: '0.9rem', fontWeight: 600,
              color: 'var(--fg-secondary)', mb: 0.5,
            }}>
              No saved sessions yet
            </Typography>
            <Typography sx={{
              fontFamily: 'var(--font-family)', fontSize: '0.8rem',
              color: 'var(--fg-dim)',
            }}>
              Start a new research session and it will be saved here automatically.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {sessions.map(s => (
              <GlassCard key={s.id} style={{ padding: '16px 18px', cursor: 'pointer', background: 'rgba(255,255,255,0.65)' }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                  <Box
                    sx={{ flex: 1 }}
                    onClick={() => navigate(`/research?session=${s.id}`)}
                  >
                    <Typography sx={{
                      fontFamily: 'var(--font-family)', fontSize: '0.92rem', fontWeight: 600,
                      color: 'var(--fg-primary)', mb: 0.5, lineHeight: 1.4,
                    }}>
                      {s.topic || 'Untitled session'}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box sx={{
                        px: 0.75, py: 0.15, borderRadius: '5px',
                        bgcolor: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)',
                        fontFamily: 'var(--font-family)', fontSize: '0.62rem', fontWeight: 700,
                        color: 'var(--accent)', letterSpacing: '0.06em', textTransform: 'uppercase',
                      }}>
                        Phase {s.phase} · {PHASES[s.phase] || 'Onboarding'}
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'var(--fg-dim)' }}>
                        <Clock size={11} />
                        <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.72rem', color: 'var(--fg-dim)' }}>
                          {timeAgo(s.updatedAt)}
                        </Typography>
                      </Box>
                      <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.72rem', color: 'var(--fg-dim)' }}>
                        {s.messages?.length || 0} messages
                      </Typography>
                    </Box>
                  </Box>
                  <Box
                    onClick={e => { e.stopPropagation(); deleteSession(s.id); }}
                    sx={{
                      p: 0.75, borderRadius: '7px', cursor: 'pointer',
                      color: 'var(--fg-dim)', transition: 'all 0.15s',
                      '&:hover': { color: '#dc2626', bgcolor: 'rgba(220,38,38,0.08)' },
                    }}
                  >
                    <Trash2 size={15} />
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
