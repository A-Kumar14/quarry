import React, { useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import ExplorePage from './pages/ExplorePage';
import HomePage from './pages/HomePage';
import ResearchPage from './pages/ResearchPage';
import ResearchSessionsPage from './pages/ResearchSessionsPage';
import SettingsPage from './pages/SettingsPage';
import SourcesPage from './pages/SourcesPage';
import WritePage from './pages/WritePage';
import ArtifactsPage from './pages/ArtifactsPage';
import { SettingsProvider } from './SettingsContext';
import { DarkModeProvider } from './DarkModeContext';

function AppContent() {
  const navigate = useNavigate();

  const handleHomeSearch = useCallback((query, mode) => {
    const q = query ? encodeURIComponent(query.trim()) : '';
    if (mode === 'research') {
      navigate('/research');
      return;
    }
    if (mode === 'write') {
      if (q) {
        navigate('/search?q=' + q + '&next=write');
      } else {
        navigate('/write');
      }
      return;
    }
    if (mode === 'finance') {
      navigate('/search?q=' + q + '&mode=finance');
      return;
    }
    if (q) {
      navigate('/search?q=' + q);
    }
  }, [navigate]);

  return (
    <>
      <Routes>
        <Route path="/"                   element={<HomePage onSearch={handleHomeSearch} />} />
        <Route path="/search"             element={<ExplorePage />} />
        <Route path="/write"              element={<WritePage />} />
        <Route path="/research"           element={<ResearchPage />} />
        <Route path="/research/sessions"  element={<ResearchSessionsPage />} />
        <Route path="/settings"           element={<SettingsPage />} />
        <Route path="/sources"            element={<SourcesPage />} />
        <Route path="/artifacts"          element={<ArtifactsPage />} />
        <Route path="/finance"            element={<Navigate to="/" replace />} />
        <Route path="*"                   element={<Navigate to="/" replace />} />
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
