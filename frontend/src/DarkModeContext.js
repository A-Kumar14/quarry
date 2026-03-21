import { createContext, useContext, useState, useEffect } from 'react';

const DarkModeContext = createContext([false, () => {}]);

const LIGHT_BG = 'linear-gradient(158deg, #EDE8DF 0%, #E5DDD0 40%, #DDD5C0 75%, #E8E2D5 100%)';
const DARK_BG  = 'linear-gradient(158deg, #1c1814 0%, #221d17 40%, #2a2318 75%, #1f1b14 100%)';

export function DarkModeProvider({ children }) {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('quarry_dark') === '1'; } catch { return false; }
  });

  useEffect(() => {
    // Sync CSS variable classes so var(--fg-primary) etc update
    document.body.classList.toggle('dark', dark);
    document.documentElement.classList.toggle('dark', dark);
    try { localStorage.setItem('quarry_dark', dark ? '1' : '0'); } catch { /* private mode */ }
  }, [dark]);

  return (
    <DarkModeContext.Provider value={[dark, setDark]}>
      {/*
        Wrapper div IS the background — no z-index tricks, no fixed positioning.
        background-attachment: fixed makes the gradient stay put while content scrolls.
      */}
      <div style={{
        minHeight: '100%',
        background: dark ? DARK_BG : LIGHT_BG,
        backgroundAttachment: 'fixed',
        backgroundSize: 'cover',
        transition: 'background 0.4s ease',
      }}>
        {children}
      </div>
    </DarkModeContext.Provider>
  );
}

export function useDarkMode() {
  return useContext(DarkModeContext);
}
