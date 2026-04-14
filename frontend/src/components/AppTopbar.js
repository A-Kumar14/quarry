import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, BookOpen, FileText, Archive, Settings, User } from 'lucide-react';
import { useDarkMode } from '../DarkModeContext';
import { useAuth } from '../contexts/AuthContext';
import { LimelightNav } from './ui/limelight-nav';

const T = {
  accent: '#F97316',
  accentDim: 'rgba(249,115,22,0.12)',
  accentBorder: 'rgba(249,115,22,0.40)',
  fgSec: 'var(--fg-secondary)',
  fgDim: 'var(--fg-dim)',
  border: 'var(--border)',
  serif: "'IBM Plex Serif',Georgia,serif",
  sans: "'IBM Plex Sans',system-ui,sans-serif",
  mono: "'IBM Plex Mono',monospace",
};

export default function AppTopbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [dark] = useDarkMode();
  const { user } = useAuth();

  const navItems = [
    { id: 'home', icon: <Home size={20} />, label: 'Home', onClick: () => navigate('/') },
    { id: 'notes', icon: <BookOpen size={20} />, label: 'Notes', onClick: () => navigate('/notes') },
    { id: 'sources', icon: <FileText size={20} />, label: 'Sources', onClick: () => navigate('/sources') },
    { id: 'artifacts', icon: <Archive size={20} />, label: 'Artifacts', onClick: () => navigate('/artifacts') },
    { id: 'settings', icon: <Settings size={20} />, label: 'Settings', onClick: () => navigate('/settings') },
  ];

  const activeNavIndex = (() => {
    if (location.pathname === '/') return 0;
    if (location.pathname === '/notes' || location.pathname.startsWith('/notes/')) return 1;
    if (location.pathname === '/sources') return 2;
    if (location.pathname === '/artifacts') return 3;
    if (location.pathname === '/settings') return 4;
    return 0;
  })();

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        height: 56,
        background: dark ? 'rgba(26,22,20,0.88)' : 'rgba(237,232,223,0.88)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${T.border}`,
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        gap: 12,
      }}
    >
      <span
        style={{
          fontFamily: T.serif,
          fontSize: '1rem',
          fontWeight: 400,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: T.accent,
          flex: '0 0 auto',
          cursor: 'pointer',
        }}
        onClick={() => navigate('/')}
      >
        Quarry
      </span>
      <span
        style={{
          fontFamily: T.mono,
          fontSize: '0.56rem',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: T.fgDim,
          paddingTop: 1,
        }}
      >
        Live brief
      </span>

      <div style={{ flex: 1 }} />

      <LimelightNav
        key={activeNavIndex}
        items={navItems}
        defaultActiveIndex={activeNavIndex}
        className={`h-9 rounded-xl px-1 border-[var(--border)] ${dark ? 'bg-[rgba(255,255,255,0.06)]' : 'bg-[rgba(0,0,0,0.04)]'}`}
        iconContainerClassName="p-3"
        iconClassName="text-[var(--fg-primary)]"
        limelightClassName="w-8"
      />

      <button
        type="button"
        title={user?.username ? `Profile: ${user.username}` : 'Open profile'}
        onClick={() => navigate('/profile')}
        style={{
          height: 30,
          borderRadius: 999,
          border: `1px solid ${T.border}`,
          background: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)',
          color: T.fgSec,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '0 9px',
          cursor: 'pointer',
          flexShrink: 0,
          fontFamily: T.sans,
          fontSize: '0.69rem',
          fontWeight: 600,
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = T.accentBorder;
          e.currentTarget.style.color = T.accent;
          e.currentTarget.style.background = T.accentDim;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = T.border;
          e.currentTarget.style.color = T.fgSec;
          e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
        }}
      >
        <User size={13} />
        <span style={{ fontFamily: T.mono, fontSize: '0.58rem', letterSpacing: '0.05em', textTransform: 'uppercase', opacity: 0.8 }}>
          Account
        </span>
      </button>
    </header>
  );
}
