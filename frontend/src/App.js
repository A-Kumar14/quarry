import React, { useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import ExplorePage from './pages/ExplorePage';
import HomePage from './pages/HomePage';
import SettingsPage from './pages/SettingsPage';
import SourcesPage from './pages/SourcesPage';
import WritePage from './pages/WritePage';
import ArtifactsPage from './pages/ArtifactsPage';
import { SettingsProvider } from './SettingsContext';
import { DarkModeProvider } from './DarkModeContext';

function AppContent() {
  const navigate = useNavigate();

  const handleHomeSearch = useCallback((query, modeOrDeep) => {
    const q = query ? encodeURIComponent(query.trim()) : '';
    if (modeOrDeep === 'write') {
      if (q) {
        navigate('/search?q=' + q + '&next=write');
      } else {
        navigate('/write');
      }
      return;
    }
    if (modeOrDeep === 'finance') {
      navigate('/search?q=' + q + '&mode=finance');
      return;
    }
    if (q) {
      if (modeOrDeep === true) {
        navigate('/search?q=' + q + '&d=true');
      } else {
        navigate('/search?q=' + q);
      }
    }
  }, [navigate]);

  return (
    <>
      <Routes>
        <Route path="/"                   element={<HomePage onSearch={handleHomeSearch} />} />
        <Route path="/search"             element={<ExplorePage />} />
        <Route path="/write"              element={<WritePage />} />
        <Route path="/settings"           element={<SettingsPage />} />
        <Route path="/sources"            element={<SourcesPage />} />
        <Route path="/artifacts"          element={<ArtifactsPage />} />
        <Route path="/finance"            element={<Navigate to="/" replace />} />
        <Route path="*"                   element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

// One-time cleanup: purge research session data left in localStorage
try {
  Object.keys(localStorage)
    .filter(k => k.startsWith('quarry_session_'))
    .forEach(k => localStorage.removeItem(k));
  localStorage.removeItem('quarry_sessions_index');
} catch {}

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
