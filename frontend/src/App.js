import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ExplorePage from './pages/ExplorePage';
import ResearchPage from './pages/ResearchPage';
import ResearchSessionsPage from './pages/ResearchSessionsPage';
import SavedPage from './pages/SavedPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ExplorePage />} />
        <Route path="/research" element={<ResearchPage />} />
        <Route path="/research/sessions" element={<ResearchSessionsPage />} />
        <Route path="/saved" element={<SavedPage />} />
      </Routes>
    </BrowserRouter>
  );
}
