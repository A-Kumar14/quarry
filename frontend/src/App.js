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
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ProfilePage from './pages/ProfilePage';
import { Toaster } from 'sonner';

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
      <Toaster position="top-center" richColors />
      <Routes>
        <Route path="/login"              element={<LoginPage />} />
        <Route path="/signup"             element={<SignupPage />} />
        
        {/* Protected Routes */}
        <Route path="/"                   element={<ProtectedRoute><HomePage onSearch={handleHomeSearch} /></ProtectedRoute>} />
        <Route path="/search"             element={<ProtectedRoute><ExplorePage /></ProtectedRoute>} />
        <Route path="/write"              element={<ProtectedRoute><WritePage /></ProtectedRoute>} />
        <Route path="/settings"           element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/sources"            element={<ProtectedRoute><SourcesPage /></ProtectedRoute>} />
        <Route path="/artifacts"          element={<ProtectedRoute><ArtifactsPage /></ProtectedRoute>} />
        <Route path="/profile"            element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        
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
    <AuthProvider>
      <SettingsProvider>
        <DarkModeProvider>
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </DarkModeProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}
