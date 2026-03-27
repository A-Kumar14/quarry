import React, { useState } from 'react';
import { ArrowLeft, Sun, Moon, Zap, Trash2, RotateCcw, Key, Eye, EyeOff, BookOpen, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../SettingsContext';
import { useDarkMode } from '../DarkModeContext';
import { clearSourceLibrary } from '../utils/sourceLibrary';

const DOCUMENTS_KEY = 'quarry_documents';

/* ── Primitives ─────────────────────────────────────────────────────────── */
function Toggle({ checked, onChange }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        width: 42, height: 24, borderRadius: 999, cursor: 'pointer', flexShrink: 0,
        background: checked ? 'var(--accent)' : 'var(--border)',
        border: `1px solid ${checked ? 'rgba(249,115,22,0.4)' : 'transparent'}`,
        position: 'relative', transition: 'background 0.2s',
      }}
    >
      <div style={{
        position: 'absolute', top: 3, left: checked ? 21 : 3,
        width: 16, height: 16, borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.18s ease',
        boxShadow: '0 1px 4px rgba(0,0,0,0.20)',
      }} />
    </div>
  );
}

function Row({ icon, label, description, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0' }}>
      <div style={{ flexShrink: 0, color: 'var(--fg-dim)', display: 'flex' }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-family)', fontSize: '0.86rem', fontWeight: 500, color: 'var(--fg-primary)', lineHeight: 1.3 }}>
          {label}
        </div>
        {description && (
          <div style={{ fontFamily: 'var(--font-family)', fontSize: '0.70rem', color: 'var(--fg-dim)', marginTop: 2, lineHeight: 1.4 }}>
            {description}
          </div>
        )}
      </div>
      {right}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--border)', margin: '0 0' }} />;
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontFamily: 'var(--font-family)', fontSize: '0.58rem', fontWeight: 600,
      color: 'var(--fg-dim)', letterSpacing: '0.12em', textTransform: 'uppercase',
      marginBottom: 4,
    }}>
      {children}
    </div>
  );
}

function Card({ children, style }) {
  return (
    <div style={{
      background: 'var(--glass-bg)',
      backdropFilter: 'var(--glass-blur)',
      WebkitBackdropFilter: 'var(--glass-blur)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: '8px 20px',
      ...style,
    }}>
      {children}
    </div>
  );
}

function DangerRow({ icon, label, description, onConfirm }) {
  const [pending, setPending] = useState(false);

  const handle = () => {
    if (!pending) { setPending(true); setTimeout(() => setPending(false), 3000); return; }
    setPending(false);
    onConfirm();
  };

  return (
    <Row
      icon={<span style={{ color: pending ? 'var(--error)' : 'var(--fg-dim)', display: 'flex' }}>{icon}</span>}
      label={<span style={{ color: pending ? 'var(--error)' : 'var(--fg-primary)' }}>{pending ? 'Tap again to confirm' : label}</span>}
      description={!pending ? description : null}
      right={
        <button
          onClick={handle}
          style={{
            padding: '4px 12px', borderRadius: 999, cursor: 'pointer', flexShrink: 0,
            border: `1px solid ${pending ? 'rgba(220,38,38,0.4)' : 'var(--border)'}`,
            background: pending ? 'rgba(220,38,38,0.08)' : 'transparent',
            fontFamily: 'var(--font-family)', fontSize: '0.72rem',
            color: pending ? 'var(--error)' : 'var(--fg-secondary)',
            transition: 'all 0.15s',
          }}
        >
          {pending ? 'Confirm' : 'Clear'}
        </button>
      }
    />
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function SettingsPage() {
  const navigate = useNavigate();
  const { settings, set } = useSettings();
  const [dark, setDark] = useDarkMode();
  const [toast, setToast] = useState('');
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('quarry_openrouter_key') || '');

  const notify = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const saveApiKey = () => {
    localStorage.setItem('quarry_openrouter_key', apiKey.trim());
    notify('API key saved.');
  };

  const clearStories = () => {
    try { localStorage.removeItem(DOCUMENTS_KEY); localStorage.removeItem('quarry_story_data'); } catch {}
    notify('All stories cleared.');
  };

  const clearSessions = () => {
    try {
      Object.keys(localStorage).filter(k => k.startsWith('quarry_session_')).forEach(k => localStorage.removeItem(k));
      localStorage.removeItem('quarry_sessions_index');
    } catch {}
    notify('Research sessions cleared.');
  };

  const clearSources = () => {
    clearSourceLibrary();
    notify('Source library cleared.');
  };

  const resetWatchlist = () => {
    try { localStorage.removeItem('quarry_watchlist'); } catch {}
    notify('Watchlist reset to defaults.');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: dark
        ? 'linear-gradient(158deg, #0d1117 0%, #131920 50%, #1c2333 100%)'
        : 'linear-gradient(158deg, #EDE8DF 0%, #E5DDD0 40%, #DDD5C0 75%, #E8E2D5 100%)',
      backgroundAttachment: 'fixed',
    }}>
      {/* Top bar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 24px', height: 48,
        background: dark ? 'rgba(13,17,23,0.88)' : 'rgba(237,232,223,0.88)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, background: 'none',
            border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 8,
            color: 'var(--fg-secondary)', fontFamily: 'var(--font-family)',
            fontSize: '0.78rem', transition: 'color 0.14s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--fg-primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--fg-secondary)'}
        >
          <ArrowLeft size={14} /> Back
        </button>
        <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
        <span style={{
          fontFamily: 'var(--font-family)', fontSize: '0.88rem',
          fontWeight: 600, color: 'var(--fg-primary)',
        }}>
          Settings
        </span>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 24px 64px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── Appearance ── */}
        <div>
          <SectionLabel>Appearance</SectionLabel>
          <Card>
            <Row
              icon={dark ? <Moon size={15} /> : <Sun size={15} />}
              label="Dark Mode"
              description="Switch between light parchment and dark terminal themes"
              right={<Toggle checked={dark} onChange={setDark} />}
            />
          </Card>
        </div>

        {/* ── Search ── */}
        <div>
          <SectionLabel>Search</SectionLabel>
          <Card>
            <Row
              icon={<Zap size={15} />}
              label="Finance Auto-Detection"
              description="Show live price card when a stock ticker or company is detected in your query"
              right={<Toggle checked={settings.financeAutoDetect} onChange={v => set('financeAutoDetect', v)} />}
            />
            <Divider />
            <Row
              icon={<Search size={15} />}
              label="Deep Mode by Default"
              description="Always use multi-pass retrieval and sub-query decomposition"
              right={<Toggle checked={settings.deepModeDefault || false} onChange={v => set('deepModeDefault', v)} />}
            />
          </Card>
        </div>

        {/* ── API Configuration ── */}
        <div>
          <SectionLabel>API Configuration</SectionLabel>
          <Card>
            <Row
              icon={<Key size={15} />}
              label="OpenRouter API Key"
              description="Used for all AI features — sourced from your .env if not set here"
              right={
                <button
                  onClick={() => setApiKeyVisible(v => !v)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-dim)', display: 'flex', padding: 4 }}
                >
                  {apiKeyVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              }
            />
            <div style={{ paddingBottom: 12 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type={apiKeyVisible ? 'text' : 'password'}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="sk-or-v1-..."
                  style={{
                    flex: 1,
                    background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                    border: '1px solid var(--border)',
                    borderRadius: 8, padding: '7px 12px',
                    fontFamily: 'var(--font-mono)', fontSize: '0.74rem',
                    color: 'var(--fg-primary)',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={saveApiKey}
                  style={{
                    padding: '7px 16px', borderRadius: 8, cursor: 'pointer',
                    background: 'var(--accent)', border: 'none',
                    fontFamily: 'var(--font-family)', fontSize: '0.76rem',
                    fontWeight: 600, color: '#fff',
                    transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  Save
                </button>
              </div>
            </div>
          </Card>
        </div>

        {/* ── Writing ── */}
        <div>
          <SectionLabel>Writing</SectionLabel>
          <Card>
            <Row
              icon={<BookOpen size={15} />}
              label="Open last story on startup"
              description="Resume where you left off when navigating to Write"
              right={<Toggle checked={settings.resumeLastStory || false} onChange={v => set('resumeLastStory', v)} />}
            />
          </Card>
        </div>

        {/* ── Data Management ── */}
        <div>
          <SectionLabel>Data Management</SectionLabel>
          <Card>
            <DangerRow
              icon={<Trash2 size={15} />}
              label="Clear All Stories"
              description="Permanently delete all saved documents"
              onConfirm={clearStories}
            />
            <Divider />
            <DangerRow
              icon={<Trash2 size={15} />}
              label="Clear Research Sessions"
              description="Delete all saved multi-phase research sessions"
              onConfirm={clearSessions}
            />
            <Divider />
            <DangerRow
              icon={<Trash2 size={15} />}
              label="Clear Source Library"
              description="Remove all sources saved from your searches"
              onConfirm={clearSources}
            />
            <Divider />
            <DangerRow
              icon={<RotateCcw size={15} />}
              label="Reset Finance Watchlist"
              description="Restore the default ticker watchlist"
              onConfirm={resetWatchlist}
            />
          </Card>
        </div>

        {/* Toast */}
        {toast && (
          <div style={{
            position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
            padding: '9px 20px', borderRadius: 99,
            background: dark ? 'rgba(22,163,74,0.18)' : 'rgba(22,163,74,0.12)',
            border: '1px solid rgba(22,163,74,0.30)',
            fontFamily: 'var(--font-family)', fontSize: '0.78rem',
            color: '#16a34a', whiteSpace: 'nowrap',
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            zIndex: 9999,
          }}>
            {toast}
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', paddingTop: 8 }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '0.60rem',
            color: 'var(--fg-dim)', letterSpacing: '0.08em',
          }}>
            Quarry · AI Research Engine · v2.0
          </span>
        </div>
      </div>
    </div>
  );
}
