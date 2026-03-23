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
import { DarkModeProvider } from './DarkModeContext';

function AppContent() {
  return (
    <>
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
