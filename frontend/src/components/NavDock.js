import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { Settings, Clock, User, Sun, Moon, CalendarDays, ChevronRight } from 'lucide-react';
import { useDarkMode } from '../DarkModeContext';
import { useSettings } from '../SettingsContext';

/* ─────────────────────────────────────────────────────────────────────────
   Constants — all geometry lives here so the sliding highlighter math is exact
───────────────────────────────────────────────────────────────────────── */
const SLOT   = 44;  // px — height of every icon cell
const PAD    = 8;   // px — top/bottom inner padding (matches py-2)
const BTN    = 36;  // px — the highlight square size
const INSET  = 4;   // px — horizontal inset of highlight inside dock

const SPRING = { type: 'spring', stiffness: 260, damping: 20 };

/* Highlight top offset for a given slot index — centres BTN in SLOT */
const highlightTop = (i) => PAD + i * SLOT + (SLOT - BTN) / 2;

/* ─────────────────────────────────────────────────────────────────────────
   Toggle switch (used inside the popover)
───────────────────────────────────────────────────────────────────────── */
function Toggle({ on, onToggle }) {
  return (
    <div
      onClick={onToggle}
      style={{
        width: 30, height: 16, borderRadius: 8, flexShrink: 0, cursor: 'pointer',
        background: on ? 'var(--accent)' : 'rgba(150,130,100,0.28)',
        position: 'relative', transition: 'background 0.18s',
      }}
    >
      <div style={{
        position: 'absolute', top: 1.5, left: on ? 15 : 1.5,
        width: 13, height: 13, borderRadius: '50%', background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.22)', transition: 'left 0.18s',
      }} />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Quick-settings popover — slides in from the right of the dock
───────────────────────────────────────────────────────────────────────── */
function SettingsPopover({ dark, setDark, onClose }) {
  const { settings, set } = useSettings();
  const navigate = useNavigate();

  const surface = dark
    ? {
        background: 'rgba(16, 18, 26, 0.97)',
        border: '1px solid rgba(255,255,255,0.09)',
        boxShadow: '0 16px 48px rgba(0,0,0,0.65)',
      }
    : {
        background: 'rgba(253, 250, 243, 0.98)',
        border: '1px solid rgba(185,165,128,0.22)',
        boxShadow: '0 16px 48px rgba(140,110,60,0.14)',
      };

  const row = {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '7px 12px', cursor: 'pointer', borderRadius: 8,
    transition: 'background 0.12s',
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -8, scale: 0.97 }}
      animate={{ opacity: 1, x: 0,  scale: 1, transition: SPRING }}
      exit={{    opacity: 0, x: -6, scale: 0.97, transition: { duration: 0.13 } }}
      style={{
        position: 'absolute',
        /* align bottom of popover with bottom of dock */
        bottom: 0,
        left: 'calc(100% + 10px)',
        zIndex: 1001, width: 220, borderRadius: 12,
        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        overflow: 'hidden',
        ...surface,
      }}
    >
      {/* Section label */}
      <div style={{
        padding: '9px 12px 5px',
        borderBottom: dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
      }}>
        <span style={{
          fontFamily: 'var(--font-family)', fontSize: '0.57rem', fontWeight: 600,
          color: 'var(--fg-dim)', letterSpacing: '0.14em', textTransform: 'uppercase',
        }}>
          Quick Settings
        </span>
      </div>

      {/* Dark / Light row */}
      <div style={row} onClick={() => setDark(d => !d)}>
        <div style={{ flexShrink: 0, opacity: 0.7, display: 'flex' }}>
          {dark
            ? <Sun  size={13} style={{ color: 'var(--accent)' }} />
            : <Moon size={13} style={{ color: 'var(--fg-secondary)' }} />}
        </div>
        <span style={{
          fontFamily: 'var(--font-family)', fontSize: '0.74rem', fontWeight: 500,
          color: 'var(--fg-primary)', flex: 1,
        }}>
          {dark ? 'Light Mode' : 'Dark Mode'}
        </span>
        <Toggle on={dark} onToggle={() => setDark(d => !d)} />
      </div>

      {/* Event ticker row */}
      <div style={row} onClick={() => set('showCalendar', !settings.showCalendar)}>
        <div style={{ flexShrink: 0, opacity: 0.6, display: 'flex' }}>
          <CalendarDays size={13} style={{ color: 'var(--fg-secondary)' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-family)', fontSize: '0.74rem', fontWeight: 500, color: 'var(--fg-primary)' }}>
            Event Ticker
          </div>
          <div style={{ fontFamily: 'var(--font-family)', fontSize: '0.62rem', fontWeight: 300, color: 'var(--fg-dim)', marginTop: 1 }}>
            Calendar bar at top
          </div>
        </div>
        <Toggle on={settings.showCalendar} onToggle={() => set('showCalendar', !settings.showCalendar)} />
      </div>

      {/* Divider */}
      <div style={{
        height: 1, margin: '3px 0',
        background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      }} />

      {/* All settings */}
      <div
        style={{ ...row, justifyContent: 'space-between' }}
        onClick={() => { onClose(); navigate('/settings'); }}
      >
        <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.74rem', fontWeight: 500, color: 'var(--fg-secondary)' }}>
          All Settings
        </span>
        <ChevronRight size={12} style={{ color: 'var(--fg-dim)' }} />
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   NavDock — the unified pill
───────────────────────────────────────────────────────────────────────── */
export default function NavDock() {
  const [dark, setDark]       = useDarkMode();
  const [hoveredIdx, setHovered] = useState(null);   // 0 | 1 | 2 | null
  const [popoverOpen, setPopover] = useState(false);
  const location  = useLocation();
  const navigate  = useNavigate();
  const ref       = useRef(null);

  /* Close popover on outside click */
  useEffect(() => {
    if (!popoverOpen) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setPopover(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [popoverOpen]);

  /* ── Tooltip label to show to the right of the highlight ── */
  const tooltipLabel = hoveredIdx === 0 ? 'Settings'
                     : hoveredIdx === 1 ? 'Saved'
                     : hoveredIdx === 2 ? 'Account'
                     : null;

  /* ── Glass pill surface ── */
  const glass = dark
    ? {
        background:  'rgba(18, 20, 28, 0.68)',
        border:      '1px solid rgba(255,255,255,0.08)',
        boxShadow:   '0 8px 30px rgba(0,0,0,0.48), 0 1px 0 rgba(255,255,255,0.04) inset',
      }
    : {
        background:  'rgba(255, 252, 244, 0.70)',
        border:      '1px solid rgba(185,165,128,0.26)',
        boxShadow:   '0 8px 30px rgba(140,110,60,0.11), 0 1.5px 0 rgba(255,254,228,0.80) inset',
      };

  /* ── Sliding highlight colour ── */
  const hlBg = dark
    ? 'rgba(251,146,60,0.11)'
    : 'rgba(249,115,22,0.07)';

  /* ── Icon colour helper ── */
  const iconColor = (idx) => {
    const isActive = (idx === 0 && location.pathname === '/settings')
                  || (idx === 1 && location.pathname === '/saved');
    if (isActive)       return 'var(--accent)';
    if (hoveredIdx === idx) return dark ? 'rgba(230,237,243,0.92)' : 'rgba(38,24,10,0.88)';
    return dark ? 'rgba(230,237,243,0.42)' : 'rgba(90,66,34,0.42)';
  };

  const ICONS = [Settings, Clock, User];

  return (
    <div ref={ref} style={{ position: 'fixed', bottom: 24, left: 24, zIndex: 999 }}>
      {/*
        Dock entrance: the whole pill slides up + fades in once on mount.
        No stagger — a single unified motion.
      */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0  }}
        transition={{ ...SPRING, delay: 0.1 }}
        /* Pill geometry — no gap, fixed slot heights keep highlighter math exact */
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: 44,
          paddingTop:    PAD,
          paddingBottom: PAD,
          borderRadius: 22,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          ...glass,
        }}
      >
        {/* ── Sliding highlight — single div that moves between slots ── */}
        <motion.div
          aria-hidden
          animate={{
            opacity: hoveredIdx !== null ? 1 : 0,
            top: highlightTop(hoveredIdx ?? 0),
          }}
          transition={SPRING}
          style={{
            position: 'absolute',
            left: INSET,
            width: BTN,
            height: BTN,
            borderRadius: 10,
            background: hlBg,
            pointerEvents: 'none',
          }}
        />

        {/* ── Active-route pip (shared layoutId so it slides between routes) ── */}
        {(location.pathname === '/settings' || location.pathname === '/saved') && (
          <motion.div
            layoutId="active-pip"
            transition={SPRING}
            style={{
              position: 'absolute',
              right: 3,
              top: location.pathname === '/settings'
                ? highlightTop(0) + (BTN - 16) / 2
                : highlightTop(1) + (BTN - 16) / 2,
              width: 3,
              height: 16,
              borderRadius: 2,
              background: 'var(--accent)',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* ── Icon slots ── */}
        {ICONS.map((Icon, idx) => {
          const isActive = (idx === 0 && location.pathname === '/settings')
                        || (idx === 1 && location.pathname === '/saved');
          return (
            <motion.button
              key={idx}
              onClick={() => {
                if (idx === 0) { setPopover(o => !o); }
                if (idx === 1) { navigate('/saved'); }
                /* idx === 2 — account: no-op for now */
              }}
              onHoverStart={() => setHovered(idx)}
              onHoverEnd={() => setHovered(null)}
              whileHover={{ scale: 1.12 }}
              transition={SPRING}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: SLOT,
                height: SLOT,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                cursor: idx === 2 ? 'default' : 'pointer',
                zIndex: 1,
              }}
              title={idx === 2 ? 'Account (coming soon)' : undefined}
            >
              <Icon
                size={20}
                strokeWidth={isActive ? 2.2 : 1.7}
                style={{
                  color: iconColor(idx),
                  transition: 'color 0.14s ease',
                }}
              />
            </motion.button>
          );
        })}

        {/* ── Tooltip that appears to the right ── */}
        <AnimatePresence>
          {hoveredIdx !== null && !(hoveredIdx === 0 && popoverOpen) && (
            <motion.span
              key={tooltipLabel}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{    opacity: 0, x: -4 }}
              transition={{ duration: 0.13 }}
              style={{
                position: 'absolute',
                left: 'calc(100% + 10px)',
                top: highlightTop(hoveredIdx) + BTN / 2,
                transform: 'translateY(-50%)',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                userSelect: 'none',
                fontFamily: 'var(--font-family)',
                fontSize: '0.72rem',
                fontWeight: 500,
                padding: '4px 10px',
                borderRadius: 8,
                background: dark ? 'rgba(18,20,28,0.92)' : 'rgba(253,250,243,0.96)',
                border: dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(185,165,128,0.20)',
                color: dark ? 'rgba(230,237,243,0.85)' : 'rgba(38,24,10,0.78)',
                boxShadow: dark
                  ? '0 4px 14px rgba(0,0,0,0.40)'
                  : '0 4px 14px rgba(140,110,60,0.10)',
                backdropFilter: 'blur(14px)',
              }}
            >
              {tooltipLabel}
            </motion.span>
          )}
        </AnimatePresence>

        {/* ── Settings popover ── */}
        <AnimatePresence>
          {popoverOpen && (
            <SettingsPopover
              key="settings-popover"
              dark={dark}
              setDark={setDark}
              onClose={() => setPopover(false)}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
