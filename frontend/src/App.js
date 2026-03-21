import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import ExplorePage from './pages/ExplorePage';
import ResearchPage from './pages/ResearchPage';
import ResearchSessionsPage from './pages/ResearchSessionsPage';
import SavedPage from './pages/SavedPage';
import FinancePage from './pages/FinancePage';
import SettingsPage from './pages/SettingsPage';
import SourcesPage from './pages/SourcesPage';
import { SettingsProvider, useSettings } from './SettingsContext';
import { DarkModeProvider, useDarkMode } from './DarkModeContext';

/* ── Shared icon-button style ─────────────────────────────────────────────── */
function iconBtn(dark) {
  return {
    display:              'flex',
    alignItems:           'center',
    justifyContent:       'center',
    width:                32,
    height:               32,
    borderRadius:         '8px',
    border:               'none',
    background:           dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,252,242,0.80)',
    backdropFilter:       'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    boxShadow:            dark ? '0 2px 10px rgba(0,0,0,0.40)' : '0 2px 10px rgba(140,110,60,0.12)',
    cursor:               'pointer',
    transition:           'all 0.18s ease',
    flexShrink:           0,
    outline:              'none',
  };
}

/* ── Dark-mode toggle ─────────────────────────────────────────────────────── */
function DarkToggle({ dark, setDark }) {
  return (
    <button onClick={() => setDark(d => !d)} title={dark ? 'Light mode' : 'Dark mode'} style={iconBtn(dark)}>
      {dark ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5a4222" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )}
    </button>
  );
}

/* ── Quick-settings popover ───────────────────────────────────────────────── */
function SettingsPopover({ dark, setDark, onClose }) {
  const { settings, set } = useSettings();
  const navigate          = useNavigate();

  const rowStyle = {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 14px', cursor: 'pointer', borderRadius: 8,
    transition: 'background 0.13s',
  };

  function Toggle({ on, onToggle }) {
    return (
      <div onClick={onToggle} style={{ width: 34, height: 18, borderRadius: 9, flexShrink: 0, cursor: 'pointer', background: on ? 'var(--accent)' : 'rgba(150,130,100,0.30)', position: 'relative', transition: 'background 0.18s' }}>
        <div style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left 0.18s' }} />
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', bottom: 88, left: 16, zIndex: 1000, width: 228,
      background: dark ? 'rgba(20,22,30,0.97)' : 'rgba(252,248,240,0.98)',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      border: dark ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(0,0,0,0.10)',
      borderRadius: 12,
      boxShadow: dark ? '0 12px 40px rgba(0,0,0,0.55)' : '0 12px 40px rgba(140,110,60,0.16)',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '10px 14px 6px', borderBottom: dark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.07)' }}>
        <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.6rem', fontWeight: 600, color: 'var(--fg-dim)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Quick Settings</span>
      </div>

      <div style={rowStyle} onClick={() => setDark(d => !d)}>
        <div style={{ flexShrink: 0, opacity: 0.7 }}>
          {dark
            ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--fg-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          }
        </div>
        <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.76rem', fontWeight: 500, color: 'var(--fg-primary)', flex: 1 }}>{dark ? 'Light Mode' : 'Dark Mode'}</span>
        <Toggle on={dark} onToggle={() => setDark(d => !d)} />
      </div>

      <div style={rowStyle} onClick={() => set('showCalendar', !settings.showCalendar)}>
        <div style={{ flexShrink: 0, opacity: 0.6 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--fg-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-family)', fontSize: '0.76rem', fontWeight: 500, color: 'var(--fg-primary)' }}>Event Ticker</div>
          <div style={{ fontFamily: 'var(--font-family)', fontSize: '0.65rem', fontWeight: 300, color: 'var(--fg-dim)', marginTop: 1 }}>Calendar bar at top of page</div>
        </div>
        <Toggle on={settings.showCalendar} onToggle={() => set('showCalendar', !settings.showCalendar)} />
      </div>

      <div style={{ height: 1, background: dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)', margin: '4px 0' }} />

      <div style={{ ...rowStyle, justifyContent: 'space-between' }} onClick={() => { onClose(); navigate('/settings'); }}>
        <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.76rem', fontWeight: 500, color: 'var(--fg-secondary)' }}>All Settings</span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--fg-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
    </div>
  );
}

/* ── Account circle ───────────────────────────────────────────────────────── */
function AccountCircle({ dark }) {
  return (
    <button
      title="Account (coming soon)"
      style={{
        display:              'flex',
        alignItems:           'center',
        justifyContent:       'center',
        width:                36,
        height:               36,
        borderRadius:         '50%',
        border:               dark ? '1px solid rgba(255,255,255,0.14)' : '1px solid rgba(0,0,0,0.12)',
        background:           dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,252,242,0.85)',
        backdropFilter:       'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        boxShadow:            dark ? '0 2px 10px rgba(0,0,0,0.45)' : '0 2px 10px rgba(140,110,60,0.13)',
        cursor:               'pointer',
        outline:              'none',
        transition:           'all 0.18s ease',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke={dark ? 'rgba(230,237,243,0.65)' : 'rgba(90,66,34,0.60)'}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    </button>
  );
}

/* ── Bottom-left control cluster ──────────────────────────────────────────── */
function FloatingControls() {
  const [dark, setDark] = useDarkMode();
  const [open, setOpen] = useState(false);
  const wrapperRef      = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = e => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={wrapperRef} style={{ position: 'fixed', bottom: 20, left: 16, zIndex: 999, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
      {/* Gear + Dark toggle row */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => setOpen(o => !o)}
          title="Quick settings"
          style={{ ...iconBtn(dark), opacity: open ? 1 : 0.82 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke={dark ? 'rgba(230,237,243,0.80)' : '#5a4222'} strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
        <DarkToggle dark={dark} setDark={setDark} />
      </div>

      {/* Account circle */}
      <AccountCircle dark={dark} />

      {/* Popover */}
      {open && <SettingsPopover dark={dark} setDark={setDark} onClose={() => setOpen(false)} />}
    </div>
  );
}

function AppContent() {
  return (
    <>
      <FloatingControls />
      <Routes>
        <Route path="/"                   element={<ExplorePage />} />
        <Route path="/research"           element={<ResearchPage />} />
        <Route path="/research/sessions"  element={<ResearchSessionsPage />} />
        <Route path="/saved"              element={<SavedPage />} />
        <Route path="/finance"            element={<FinancePage />} />
        <Route path="/settings"           element={<SettingsPage />} />
        <Route path="/sources"            element={<SourcesPage />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <DarkModeProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </DarkModeProvider>
    </SettingsProvider>
  );
}
