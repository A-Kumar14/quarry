/**
 * NavControls — compact 3-icon header cluster
 * Renders: Settings (⚙ → quick popover), Saved (🕐 → /saved), Account (👤 placeholder)
 * Drop this into any page's top-bar as a self-contained unit.
 */
import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Settings, Clock, User, Sun, Moon, ChevronRight } from 'lucide-react';
import { useDarkMode } from '../DarkModeContext';

/* ── Tiny toggle switch ─────────────────────────────────────────────────── */
function Toggle({ on, onToggle }) {
  return (
    <div
      onClick={e => { e.stopPropagation(); onToggle(); }}
      style={{
        width: 28, height: 15, borderRadius: 8, flexShrink: 0, cursor: 'pointer',
        background: on ? 'var(--accent)' : 'rgba(150,130,100,0.28)',
        position: 'relative', transition: 'background 0.18s',
      }}
    >
      <div style={{
        position: 'absolute', top: 1.5, left: on ? 14 : 1.5,
        width: 12, height: 12, borderRadius: '50%', background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.22)', transition: 'left 0.18s',
      }} />
    </div>
  );
}

/* ── Quick-settings popover ─────────────────────────────────────────────── */
function SettingsPopover({ dark, setDark, onClose }) {
  const navigate = useNavigate();

  const surface = dark
    ? { background: 'rgba(16,18,26,0.97)', border: '1px solid rgba(255,255,255,0.09)', boxShadow: '0 16px 48px rgba(0,0,0,0.65)' }
    : { background: 'rgba(253,250,243,0.98)', border: '1px solid rgba(185,165,128,0.22)', boxShadow: '0 12px 36px rgba(140,110,60,0.14)' };

  const row = {
    display: 'flex', alignItems: 'center', gap: 9,
    padding: '6px 12px', cursor: 'pointer', borderRadius: 8,
    transition: 'background 0.12s',
  };

  return (
    <div style={{
      position: 'absolute', top: 'calc(100% + 8px)', right: 0,
      zIndex: 200, width: 216, borderRadius: 12,
      backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
      overflow: 'hidden', animation: 'navPopIn 0.14s ease',
      ...surface,
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 12px 5px',
        borderBottom: dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
      }}>
        <span style={{
          fontFamily: 'var(--font-family)', fontSize: '0.57rem', fontWeight: 600,
          color: 'var(--fg-dim)', letterSpacing: '0.14em', textTransform: 'uppercase',
        }}>Quick Settings</span>
      </div>

      {/* Dark mode */}
      <div style={row} onClick={() => setDark(d => !d)}>
        <div style={{ flexShrink: 0, opacity: 0.7, display: 'flex' }}>
          {dark ? <Sun size={12} style={{ color: 'var(--accent)' }} /> : <Moon size={12} style={{ color: 'var(--fg-secondary)' }} />}
        </div>
        <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.73rem', fontWeight: 500, color: 'var(--fg-primary)', flex: 1 }}>
          {dark ? 'Light Mode' : 'Dark Mode'}
        </span>
        <Toggle on={dark} onToggle={() => setDark(d => !d)} />
      </div>

      <div style={{ height: 1, background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', margin: '3px 0' }} />

      {/* All settings */}
      <div style={{ ...row, justifyContent: 'space-between' }} onClick={() => { onClose(); navigate('/settings'); }}>
        <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.73rem', fontWeight: 500, color: 'var(--fg-secondary)' }}>All Settings</span>
        <ChevronRight size={12} style={{ color: 'var(--fg-dim)' }} />
      </div>

      <style>{`
        @keyframes navPopIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)     scale(1);    }
        }
      `}</style>
    </div>
  );
}

/* ── Shared icon button style ───────────────────────────────────────────── */
function IconBtn({ children, onClick, title, active, dark, compact = false }) {
  const [hov, setHov] = useState(false);
  const btnSize = compact ? 29 : 31;
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: btnSize, height: btnSize, borderRadius: 9, border: '1px solid transparent', outline: 'none',
        cursor: 'pointer',
        background: active
          ? 'rgba(249,115,22,0.14)'
          : hov
            ? dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)'
            : 'transparent',
        transition: 'background 0.14s',
        color: active
          ? 'var(--accent)'
          : hov
            ? dark ? 'rgba(230,237,243,0.96)' : 'rgba(38,24,10,0.92)'
            : dark ? 'rgba(230,237,243,0.72)' : 'rgba(60,42,18,0.72)',
        borderColor: active ? 'rgba(249,115,22,0.28)' : hov ? 'rgba(175,150,105,0.25)' : 'transparent',
      }}
    >
      {children}
    </button>
  );
}

/* ── The exported component ─────────────────────────────────────────────── */
export default function NavControls({ compact = false }) {
  const [dark, setDark] = useDarkMode();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const wrapRef  = useRef(null);

  /* Close on outside click */
  useEffect(() => {
    if (!open) return;
    const handler = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const navigate = useNavigate();
  const onSaved     = location.pathname === '/saved';
  const onSettings  = location.pathname === '/settings';
  const onProfile   = location.pathname === '/profile';

  /* Pill container surface */
  const pill = dark
    ? { background: 'rgba(28,31,40,0.76)', border: '1px solid rgba(255,255,255,0.11)', boxShadow: '0 2px 12px rgba(0,0,0,0.35)' }
    : { background: 'var(--glass-bg)', border: '1px solid var(--border)', boxShadow: '0 1px 6px rgba(140,110,60,0.10)' };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
    <div style={{
      display: 'flex', alignItems: 'center', gap: 1,
      padding: compact ? '2px 4px' : '3px 5px',
      borderRadius: 12,
      backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
      ...pill,
    }}>

      {/* Settings */}
      <IconBtn
        dark={dark}
        compact={compact}
        active={onSettings || open}
        onClick={() => setOpen(o => !o)}
        title="Settings"
      >
        <Settings size={13.5} strokeWidth={1.8} />
      </IconBtn>

      {/* Saved */}
      <IconBtn
        dark={dark}
        compact={compact}
        active={onSaved}
        onClick={() => navigate('/saved')}
        title="Saved searches"
      >
        <Clock size={13.5} strokeWidth={1.8} />
      </IconBtn>

      {/* Account */}
      <IconBtn
        dark={dark}
        compact={compact}
        active={onProfile}
        onClick={() => navigate('/profile')}
        title="My Profile"
      >
        <User size={13.5} strokeWidth={1.8} />
      </IconBtn>

    </div>

      {/* Popover */}
      {open && (
        <SettingsPopover
          dark={dark}
          setDark={setDark}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
