import React, { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { ArrowLeft, Settings, Eye, EyeOff, Trash2, RotateCcw, Calendar, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import GlassCard from '../components/GlassCard';
import { useSettings, useTopOffset } from '../SettingsContext';
import { useDarkMode } from '../DarkModeContext';
import { clearSourceLibrary } from '../utils/sourceLibrary';

/* ── Toggle row ─────────────────────────────────────────────────────────── */
function Toggle({ checked, onChange }) {
  return (
    <Box
      onClick={() => onChange(!checked)}
      sx={{
        width: 40, height: 22, borderRadius: 999, cursor: 'pointer', flexShrink: 0,
        background: checked ? 'var(--accent)' : 'rgba(175,150,105,0.25)',
        border: `1px solid ${checked ? 'rgba(249,115,22,0.4)' : 'rgba(175,150,105,0.30)'}`,
        position: 'relative', transition: 'background 0.2s, border-color 0.2s',
      }}
    >
      <Box sx={{
        position: 'absolute', top: 2, left: checked ? 20 : 2,
        width: 16, height: 16, borderRadius: '50%',
        background: checked ? '#fff' : 'rgba(100,80,50,0.45)',
        transition: 'left 0.18s ease',
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
      }} />
    </Box>
  );
}

function SettingRow({ icon, label, description, checked, onChange }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.1 }}>
      <Box sx={{ flexShrink: 0, color: 'var(--fg-dim)' }}>{icon}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.84rem', fontWeight: 500, color: 'var(--fg-primary)', lineHeight: 1.3 }}>
          {label}
        </Typography>
        {description && (
          <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.68rem', color: 'var(--fg-dim)', mt: 0.2, lineHeight: 1.4 }}>
            {description}
          </Typography>
        )}
      </Box>
      <Toggle checked={checked} onChange={onChange} />
    </Box>
  );
}

function SectionHeader({ title }) {
  return (
    <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.55rem', fontWeight: 600, color: 'var(--fg-dim)', letterSpacing: '0.13em', textTransform: 'uppercase', mb: 0.5, mt: 0.5 }}>
      {title}
    </Typography>
  );
}

function DangerButton({ icon, label, description, onClick, confirm }) {
  const [pending, setPending] = useState(false);

  const handleClick = () => {
    if (confirm && !pending) { setPending(true); setTimeout(() => setPending(false), 3000); return; }
    setPending(false);
    onClick();
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.1 }}>
      <Box sx={{ flexShrink: 0, color: pending ? 'var(--error)' : 'var(--fg-dim)' }}>{icon}</Box>
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.84rem', fontWeight: 500, color: pending ? 'var(--error)' : 'var(--fg-primary)', lineHeight: 1.3 }}>
          {pending ? `Tap again to confirm` : label}
        </Typography>
        {description && !pending && (
          <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.68rem', color: 'var(--fg-dim)', mt: 0.2 }}>
            {description}
          </Typography>
        )}
      </Box>
      <Box
        onClick={handleClick}
        sx={{
          px: 1.25, py: 0.45, borderRadius: 999, cursor: 'pointer', flexShrink: 0,
          border: `1px solid ${pending ? 'rgba(220,38,38,0.4)' : 'var(--border)'}`,
          background: pending ? 'rgba(220,38,38,0.08)' : 'var(--gbtn-bg)',
          fontFamily: 'var(--font-family)', fontSize: '0.72rem',
          color: pending ? 'var(--error)' : 'var(--fg-secondary)',
          transition: 'all 0.15s',
          '&:hover': { borderColor: pending ? 'rgba(220,38,38,0.6)' : 'rgba(249,115,22,0.3)', color: pending ? 'var(--error)' : 'var(--fg-primary)' },
        }}
      >
        {pending ? 'Confirm' : 'Clear'}
      </Box>
    </Box>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function SettingsPage() {
  const navigate     = useNavigate();
  const { settings, set } = useSettings();
  const [dark, setDark]   = useDarkMode();
  const topOffset    = useTopOffset();
  const [cleared, setCleared] = useState('');

  const clearSaved = () => {
    try { localStorage.removeItem('quarry_saved'); } catch {}
    setCleared('Saved searches cleared.'); setTimeout(() => setCleared(''), 3000);
  };

  const clearSessions = () => {
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('quarry_session_'));
      keys.forEach(k => localStorage.removeItem(k));
      localStorage.removeItem('quarry_sessions_index');
    } catch {}
    setCleared('Research sessions cleared.'); setTimeout(() => setCleared(''), 3000);
  };

  const resetWatchlist = () => {
    try { localStorage.removeItem('quarry_watchlist'); } catch {}
    setCleared('Watchlist reset to defaults.'); setTimeout(() => setCleared(''), 3000);
  };

  const clearSources = () => {
    clearSourceLibrary();
    setCleared('Source library cleared.'); setTimeout(() => setCleared(''), 3000);
  };

  return (
    <Box sx={{
      minHeight: '100vh', paddingTop: `${topOffset}px`,
      background: 'linear-gradient(158deg,#EDE8DF 0%,#E5DDD0 40%,#DDD5C0 75%,#E8E2D5 100%)',
    }}>
      {/* Top bar */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1.5,
        px: 2.5, py: 1.1, borderBottom: '1px solid var(--border)',
        background: 'rgba(237,232,223,0.92)', backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}>
        <Box onClick={() => navigate(-1)} sx={{ display: 'flex', alignItems: 'center', gap: 0.6, cursor: 'pointer', opacity: 0.55, '&:hover': { opacity: 1 }, transition: 'opacity 0.14s' }}>
          <ArrowLeft size={13} color="var(--fg-secondary)" />
          <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.70rem', color: 'var(--fg-secondary)' }}>Back</Typography>
        </Box>
        <Box sx={{ width: '1px', height: 14, bgcolor: 'var(--border)' }} />
        <Settings size={14} color="var(--accent)" />
        <Typography sx={{ fontFamily: '"Courier New", monospace', fontSize: '0.82rem', fontWeight: 700, color: 'var(--fg-primary)', letterSpacing: '-0.01em' }}>
          Settings
        </Typography>
      </Box>

      {/* Content */}
      <Box sx={{ maxWidth: 560, mx: 'auto', px: 3, py: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>

        {/* ── Appearance ── */}
        <GlassCard style={{ padding: '16px 20px' }}>
          <SectionHeader title="Appearance" />
          <SettingRow
            icon={dark ? <EyeOff size={15} /> : <Eye size={15} />}
            label="Dark Mode"
            description="Switch between light parchment and dark terminal themes"
            checked={dark}
            onChange={setDark}
          />
        </GlassCard>

        {/* ── Home page ── */}
        <GlassCard style={{ padding: '16px 20px' }}>
          <SectionHeader title="Home Page" />
          <SettingRow
            icon={<Calendar size={15} />}
            label="Monthly Events Calendar"
            description="Scrolling 2026 events strip above the search masthead"
            checked={settings.showCalendar}
            onChange={v => set('showCalendar', v)}
          />
        </GlassCard>

        {/* ── Search behaviour ── */}
        <GlassCard style={{ padding: '16px 20px' }}>
          <SectionHeader title="Search Behaviour" />
          <SettingRow
            icon={<Zap size={15} />}
            label="Finance Auto-Detection"
            description="Automatically show live price card when a stock ticker or company is detected in your query"
            checked={settings.financeAutoDetect}
            onChange={v => set('financeAutoDetect', v)}
          />
        </GlassCard>

        {/* ── Data management ── */}
        <GlassCard style={{ padding: '16px 20px' }}>
          <SectionHeader title="Data Management" />
          <DangerButton
            icon={<Trash2 size={15} />}
            label="Clear Saved Searches"
            description="Remove all bookmarked search results"
            onClick={clearSaved}
            confirm
          />
          <Box sx={{ height: '1px', bgcolor: 'var(--border)', my: 0.25 }} />
          <DangerButton
            icon={<Trash2 size={15} />}
            label="Clear Research Sessions"
            description="Delete all saved multi-phase research sessions"
            onClick={clearSessions}
            confirm
          />
          <Box sx={{ height: '1px', bgcolor: 'var(--border)', my: 0.25 }} />
          <DangerButton
            icon={<Trash2 size={15} />}
            label="Clear Source Library"
            description="Delete all sources auto-saved from your searches"
            onClick={clearSources}
            confirm
          />
          <Box sx={{ height: '1px', bgcolor: 'var(--border)', my: 0.25 }} />
          <DangerButton
            icon={<RotateCcw size={15} />}
            label="Reset Finance Watchlist"
            description="Restore the default ticker watchlist (AAPL, NVDA, MSFT, TSLA, META)"
            onClick={resetWatchlist}
            confirm
          />
        </GlassCard>

        {/* Confirmation toast */}
        {cleared && (
          <Box sx={{ px: 1.5, py: 0.9, borderRadius: '8px', background: 'rgba(22,163,74,0.10)', border: '1px solid rgba(22,163,74,0.25)', textAlign: 'center' }}>
            <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.76rem', color: '#16a34a' }}>
              {cleared}
            </Typography>
          </Box>
        )}

        {/* About */}
        <Box sx={{ textAlign: 'center', pb: 2 }}>
          <Typography sx={{ fontFamily: '"Courier New", monospace', fontSize: '0.60rem', color: 'var(--fg-dim)', letterSpacing: '0.06em' }}>
            Quarry · AI Research Engine · v2.0
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
