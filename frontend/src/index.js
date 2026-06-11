import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// ── Global fetch interceptor ──────────────────────────────────────────────────
// Attaches the Bearer token to every fetch call targeting the Quarry API,
// so individual hooks and components don't need to handle auth headers.
const _API = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const _origFetch = window.fetch.bind(window);
window.fetch = function (input, init = {}) {
  const url = typeof input === 'string' ? input : (input?.url || '');
  if (url.startsWith(_API)) {
    const token =
      localStorage.getItem('quarry_token') ||
      process.env.REACT_APP_DEV_TOKEN ||
      '';
    // Apply caller headers first so the Bearer from `quarry_token` wins (no stale overrides).
    if (token) {
      init = {
        ...init,
        headers: {
          ...(init.headers || {}),
          Authorization: `Bearer ${token}`,
        },
      };
    }
  }
  return _origFetch(input, init);
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
