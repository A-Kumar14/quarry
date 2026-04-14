import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDarkMode } from '../DarkModeContext';
import { BottomNavBar } from './ui/bottom-nav-bar';
import { Home, BookOpen, FileText, Archive, Settings, User } from 'lucide-react';

export default function AppTopbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [dark] = useDarkMode();

  const navItems = [
    { label: 'Home', icon: Home, onClick: () => navigate('/') },
    { label: 'Notes', icon: BookOpen, onClick: () => navigate('/notes') },
    { label: 'Sources', icon: FileText, onClick: () => navigate('/sources') },
    { label: 'Artifacts', icon: Archive, onClick: () => navigate('/artifacts') },
    { label: 'Settings', icon: Settings, onClick: () => navigate('/settings') },
    { label: 'Account', icon: User, onClick: () => navigate('/profile') },
  ];

  const activeNavIndex = (() => {
    if (location.pathname === '/') return 0;
    if (location.pathname === '/notes' || location.pathname.startsWith('/notes/')) return 1;
    if (location.pathname === '/sources') return 2;
    if (location.pathname === '/artifacts') return 3;
    if (location.pathname === '/settings') return 4;
    if (location.pathname === '/profile') return 5;
    return 0;
  })();

  return (
    <div
      style={{
        position: 'fixed',
        top: 12,
        left: 18,
        right: 18,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        pointerEvents: 'none',
      }}
    >
      <div style={{ pointerEvents: 'auto' }}>
        <button
          type="button"
          onClick={() => navigate('/')}
          style={{
            border: 'none',
            background: 'transparent',
            padding: 0,
            margin: 0,
            cursor: 'pointer',
            fontFamily: "var(--font-serif)",
            fontSize: '1.12rem',
            fontWeight: 500,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--accent)',
            textShadow: dark ? '0 2px 12px rgba(0,0,0,0.45)' : '0 2px 10px rgba(255,255,255,0.55)',
          }}
        >
          Quarry
        </button>
      </div>

      <div style={{ pointerEvents: 'auto' }}>
        <BottomNavBar
          defaultIndex={activeNavIndex}
          items={navItems}
          className={`min-w-0 max-w-none border border-border backdrop-blur-[14px] shadow-[0_10px_30px_rgba(0,0,0,0.18)] ${
            dark ? 'bg-[rgba(20,16,14,0.42)]' : 'bg-[rgba(255,255,255,0.18)]'
          }`}
        />
      </div>
    </div>
  );
}
