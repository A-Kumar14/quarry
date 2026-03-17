import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ExplorePage from './pages/ExplorePage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ExplorePage />} />
      </Routes>
    </BrowserRouter>
  );
}
