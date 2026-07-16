import React, { useState, useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { Search, Zap } from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';

/** Glass search pill with Deep chip and /explore/suggest dropdown. */
export default function HomeSearchBar({ query, setQuery, onSubmit, deepMode, onToggleDeep }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showSugg, setShowSugg] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  const handleKey = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); setShowSugg(false); onSubmit(); }
    if (e.key === 'Escape') setShowSugg(false);
  };

  const fetchSuggestions = (val) => {
    clearTimeout(debounceRef.current);
    if (!val.trim() || val.length < 2) { setSuggestions([]); setShowSugg(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`${API}/explore/suggest?q=${encodeURIComponent(val)}`);
        const data = await r.json();
        const suggs = (data.suggestions || []).filter(s => s.toLowerCase() !== val.toLowerCase());
        setSuggestions(suggs.slice(0, 6));
        setShowSugg(suggs.length > 0);
      } catch { setSuggestions([]); setShowSugg(false); }
    }, 280);
  };

  useEffect(() => {
    if (!showSugg) return;
    const handler = e => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setShowSugg(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSugg]);

  return (
    <Box ref={wrapperRef} sx={{ width: '100%', maxWidth: 660, position: 'relative' }}>
      <Box
        component="form"
        onSubmit={e => { e.preventDefault(); setShowSugg(false); onSubmit(); }}
        sx={{
          width: '100%',
          display: 'flex', alignItems: 'center', gap: 1.25,
          borderRadius: '12px', px: 2.25, py: 1.35,
          background: 'var(--gbtn-bg)',
          backdropFilter: 'blur(28px) saturate(180%) brightness(1.06)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%) brightness(1.06)',
          borderTop: '1px solid var(--gbtn-border-t)',
          borderLeft: '1px solid var(--gbtn-border-l)',
          borderRight: '1px solid rgba(140,110,60,0.22)',
          borderBottom: '1px solid rgba(140,110,60,0.28)',
          boxShadow: '0 3px 14px rgba(140,110,60,0.13), 0 1px 4px rgba(0,0,0,0.06), 0 2px 0 rgba(255,254,218,0.72) inset',
          transition: 'box-shadow 0.2s',
          '&:focus-within': { boxShadow: '0 6px 28px rgba(140,110,60,0.16), 0 2px 0 rgba(255,254,218,0.80) inset, 0 0 0 3px var(--accent-dim)' },
        }}
      >
        <Search size={17} style={{ color: 'var(--fg-dim)', flexShrink: 0 }} strokeWidth={2} />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); fetchSuggestions(e.target.value); }}
          onKeyDown={handleKey}
          onFocus={() => { if (suggestions.length) setShowSugg(true); }}
          placeholder="Search the web…" autoComplete="off"
          style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '0.95rem', fontFamily: 'var(--font-family)', fontWeight: 400, color: 'var(--fg-primary)', padding: '4px 0' }}
        />
        <Box onClick={e => { e.preventDefault(); onToggleDeep?.(); }} sx={{
          display: 'flex', alignItems: 'center', gap: '3px', px: 1, py: 0.4, borderRadius: '6px', cursor: 'pointer', flexShrink: 0,
          border: deepMode ? '1px solid rgba(249,115,22,0.5)' : '1px solid var(--glass-border)',
          bgcolor: deepMode ? 'rgba(249,115,22,0.12)' : 'var(--glass-bg)',
          boxShadow: deepMode ? 'inset 0 2px 5px rgba(0,0,0,0.13), inset 0 1px 2px rgba(0,0,0,0.08)' : 'none',
          color: deepMode ? '#F97316' : 'var(--fg-secondary)',
          fontFamily: 'var(--font-family)', fontSize: '0.72rem', fontWeight: 400, transition: 'all 0.15s',
          '&:hover': { borderColor: 'var(--accent)', color: 'var(--accent)' },
        }}>
          <Zap size={11} fill={deepMode ? 'var(--accent)' : 'none'} color={deepMode ? 'var(--accent)' : 'currentColor'} />
          Deep
        </Box>
        {query && (
          <Box component="button" type="submit" sx={{ border: 'none', bgcolor: 'var(--accent)', color: '#FFF', fontFamily: 'var(--font-family)', fontSize: '0.8rem', fontWeight: 500, px: 1.75, py: 0.6, borderRadius: '8px', cursor: 'pointer', flexShrink: 0, transition: 'opacity 0.12s', '&:hover': { opacity: 0.88 } }}>
            Search
          </Box>
        )}
      </Box>

      {/* Suggestions dropdown */}
      {showSugg && suggestions.length > 0 && (
        <Box sx={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          background: 'rgba(250,246,238,0.97)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          borderRadius: '12px',
          borderTop: '1px solid rgba(255,255,235,0.90)',
          borderLeft: '1px solid rgba(255,252,225,0.70)',
          borderRight: '1px solid rgba(185,165,128,0.18)',
          borderBottom: '1px solid rgba(178,158,120,0.18)',
          boxShadow: '0 8px 32px rgba(140,110,60,0.12)',
          overflow: 'hidden', zIndex: 'var(--z-popup)',
        }}>
          {suggestions.map((s, i) => (
            <Box
              key={i}
              onMouseDown={e => { e.preventDefault(); setQuery(s); setShowSugg(false); onSubmit(); }}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                px: 2, py: 1,
                fontFamily: 'var(--font-family)', fontSize: '0.88rem', fontWeight: 400,
                color: 'var(--fg-primary)', cursor: 'pointer',
                borderBottom: i < suggestions.length - 1 ? '1px solid var(--border)' : 'none',
                transition: 'background 0.12s',
                '&:hover': { background: 'rgba(249,115,22,0.07)' },
              }}
            >
              <Search size={13} style={{ color: 'var(--fg-dim)', flexShrink: 0 }} />
              {s}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
