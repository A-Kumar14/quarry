import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ExplorePage from './pages/ExplorePage';
import ResearchPage from './pages/ResearchPage';
import ResearchSessionsPage from './pages/ResearchSessionsPage';
import SavedPage from './pages/SavedPage';
import FinancePage from './pages/FinancePage';
import SettingsPage from './pages/SettingsPage';
import SourcesPage from './pages/SourcesPage';
import { SettingsProvider } from './SettingsContext';
import { DarkModeProvider, useDarkMode } from './DarkModeContext';

/* ── Floating dark-mode toggle — fixed top-right, always visible ── */
function DarkToggle() {
  const [dark, setDark] = useDarkMode();
  return (
    <button
      onClick={() => setDark(d => !d)}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        position:        'fixed',
        top:             14,
        right:           16,
        zIndex:          999,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        width:           32,
        height:          32,
        borderRadius:    '8px',
        border:          dark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.10)',
        background:      dark ? 'rgba(255,255,255,0.07)' : 'rgba(255,252,242,0.75)',
        backdropFilter:  'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow:       dark
          ? '0 2px 8px rgba(0,0,0,0.35)'
          : '0 2px 8px rgba(140,110,60,0.10)',
        cursor:          'pointer',
        transition:      'all 0.18s ease',
        flexShrink:      0,
      }}
    >
      {dark ? (
        /* Sun icon */
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      ) : (
        /* Moon icon */
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5a4222" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )}
    </button>
  );
}

function AppContent() {
  return (
    <>
      <DarkToggle />
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
