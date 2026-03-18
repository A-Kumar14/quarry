import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ExplorePage from './pages/ExplorePage';
import ResearchPage from './pages/ResearchPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ExplorePage />} />
        <Route path="/research" element={<ResearchPage />} />
      </Routes>
    </BrowserRouter>
  );
}
