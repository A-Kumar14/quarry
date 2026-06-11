import React, { useState, useRef, useEffect } from 'react';
import {
  Sun, Moon, Trash2, Key, Eye, EyeOff,
  BookOpen, Search, FlaskConical, Cpu, History,
} from 'lucide-react';
import { useSettings } from '../SettingsContext';
import { useDarkMode } from '../DarkModeContext';
import { clearSourceLibrary } from '../utils/sourceLibrary';
import PageShell from '../components/PageShell';
import { glassCardStyle } from '../components/GlassCard';

const DOCUMENTS_KEY = 'quarry_documents';

const MODELS = [
  { id: 'openai/gpt-4o',               label: 'GPT-4o',           note: 'Balanced — default' },
  { id: 'openai/gpt-4o-mini',           label: 'GPT-4o mini',      note: 'Fast & cheap' },
  { id: 'anthropic/claude-3.5-sonnet',  label: 'Claude 3.5 Sonnet', note: 'Best reasoning' },
];

const DEPTH_OPTIONS = [
  { id: 'quick',     label: 'Quick',     note: '3 sub-questions' },
  { id: 'standard',  label: 'Standard',  note: '5 sub-questions' },
  { id: 'thorough',  label: 'Thorough',  note: '8 sub-questions' },
];

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
      ...glassCardStyle,
      borderRadius: 12,
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

/* Pill selector — single frosted rail + list rows (reads as settings, not pricing tiers) */
function PillSelect({ options, value, onChange, hint }) {
  const [dark] = useDarkMode();
  const shellBg = dark ? 'rgba(0,0,0,0.28)' : 'rgba(255,252,242,0.55)';
  const shellBorder = dark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,248,0.85)';

  return (
    <div style={{ paddingBottom: 12 }}>
      {hint && (
        <div style={{
          fontFamily: 'var(--font-family)', fontSize: '0.62rem', fontWeight: 500,
          color: 'var(--fg-dim)', letterSpacing: '0.04em', marginBottom: 8, lineHeight: 1.35,
        }}>
          {hint}
        </div>
      )}
      <div
        role="radiogroup"
        style={{
          borderRadius: 10,
          border: `1px solid ${shellBorder}`,
          background: shellBg,
          backdropFilter: 'var(--glass-blur)',
          WebkitBackdropFilter: 'var(--glass-blur)',
          overflow: 'hidden',
          boxShadow: dark
            ? 'inset 0 1px 0 rgba(255,255,255,0.04)'
            : 'inset 0 1px 0 rgba(255,255,255,0.65)',
        }}
      >
        {options.map((opt, i) => {
          const active = value === opt.id;
          const last = i === options.length - 1;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.id)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                width: '100%', textAlign: 'left', cursor: 'pointer', border: 'none',
                padding: '10px 12px 10px 14px',
                borderBottom: last ? 'none' : '1px solid var(--border)',
                background: active
                  ? (dark ? 'rgba(249,115,22,0.14)' : 'rgba(249,115,22,0.10)')
                  : 'transparent',
                borderLeft: active ? '3px solid var(--accent)' : '3px solid transparent',
                transition: 'background 0.15s ease, border-left-color 0.15s ease',
              }}
            >
              <span style={{
                fontFamily: 'var(--font-family)', fontSize: '0.77rem', fontWeight: active ? 600 : 500,
                color: 'var(--fg-primary)',
                lineHeight: 1.25,
              }}>{opt.label}</span>
              {opt.note && (
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: '0.58rem', flexShrink: 0,
                  color: active ? 'rgba(249,115,22,0.85)' : 'var(--fg-dim)',
                }}>{opt.note}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
const ROW_ICON_SLOT = 15 + 14; /* icon width + Row gap — aligns stacked controls with row labels */

export default function SettingsPage() {
  const { settings, set } = useSettings();
  const [dark, setDark] = useDarkMode();
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimers = useRef({ dismiss: null, remove: null });
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('quarry_openrouter_key') || '');

  useEffect(() => () => {
    if (toastTimers.current.dismiss) clearTimeout(toastTimers.current.dismiss);
    if (toastTimers.current.remove) clearTimeout(toastTimers.current.remove);
  }, []);

  useEffect(() => {
    if (!toastMsg) {
      setToastVisible(false);
      return undefined;
    }
    setToastVisible(false);
    let innerRaf = 0;
    const outerRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(() => setToastVisible(true));
    });
    return () => {
      cancelAnimationFrame(outerRaf);
      if (innerRaf) cancelAnimationFrame(innerRaf);
    };
  }, [toastMsg]);

  const notify = (msg) => {
    if (toastTimers.current.dismiss) clearTimeout(toastTimers.current.dismiss);
    if (toastTimers.current.remove) clearTimeout(toastTimers.current.remove);
    setToastMsg(msg);
    toastTimers.current.dismiss = setTimeout(() => {
      setToastVisible(false);
      toastTimers.current.remove = setTimeout(() => {
        setToastMsg('');
        toastTimers.current.remove = null;
      }, 240);
      toastTimers.current.dismiss = null;
    }, 3000);
  };

  const saveApiKey = () => {
    localStorage.setItem('quarry_openrouter_key', apiKey.trim());
    notify('API key saved.');
  };

  const clearNotes = () => {
    try {
      localStorage.removeItem(DOCUMENTS_KEY);
      localStorage.removeItem('quarry_notes_data');
      localStorage.removeItem('quarry_story_data');
    } catch {}
    notify('All notes cleared.');
  };

  const clearSessions = () => {
    try {
      Object.keys(localStorage).filter(k => k.startsWith('quarry_session_')).forEach(k => localStorage.removeItem(k));
      localStorage.removeItem('quarry_sessions_index');
    } catch {}
    notify('Research sessions cleared.');
  };

  const clearHistory = () => {
    try { localStorage.removeItem('quarry_search_history'); } catch {}
    notify('Search history cleared.');
  };

  const clearSources = () => {
    clearSourceLibrary();
    notify('Source library cleared.');
  };


  return (
    <div style={{
      minHeight: '100vh',
      background: dark
        ? 'linear-gradient(158deg, #0d1117 0%, #131920 50%, #1c2333 100%)'
        : 'linear-gradient(158deg, #EDE8DF 0%, #E5DDD0 40%, #DDD5C0 75%, #E8E2D5 100%)',
      backgroundAttachment: 'fixed',
    }}>
      <PageShell maxWidth={560} paddingTop={112} paddingBottom={64} paddingX={24} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

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
              icon={<Search size={15} />}
              label="Deep Mode by Default"
              description="Always use multi-pass retrieval and sub-query decomposition"
              right={<Toggle checked={settings.deepModeDefault || false} onChange={v => set('deepModeDefault', v)} />}
            />
          </Card>
        </div>

        {/* ── Deep Research ── */}
        <div>
          <SectionLabel>Deep Research</SectionLabel>
          <Card>
            <Row
              icon={<FlaskConical size={15} style={{ opacity: 0 }} />}
              label="Research Depth"
              description="Number of sub-questions the agent explores per research run"
              right={null}
            />
            <PillSelect
              hint="One option per run — choose how many sub-questions Deep Research explores."
              options={DEPTH_OPTIONS}
              value={settings.deepResearchDepth || 'standard'}
              onChange={v => set('deepResearchDepth', v)}
            />
          </Card>
        </div>

        {/* ── AI Model ── */}
        <div>
          <SectionLabel>AI Model</SectionLabel>
          <Card>
            <Row
              icon={<Cpu size={15} />}
              label="Default Model"
              description="Used for all standard searches — Deep Research always uses GPT-4o"
              right={null}
            />
            <PillSelect
              hint="One default for standard searches — Deep Research still uses GPT-4o."
              options={MODELS}
              value={settings.defaultModel || 'openai/gpt-4o'}
              onChange={v => {
                set('defaultModel', v);
                localStorage.setItem('quarry_selected_model', v);
              }}
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
            <div style={{ paddingBottom: 12, paddingLeft: ROW_ICON_SLOT, boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', alignItems: 'stretch', gap: 8, flexWrap: 'wrap' }}>
                <input
                  type={apiKeyVisible ? 'text' : 'password'}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="sk-or-v1-..."
                  style={{
                    flex: '1 1 160px',
                    minWidth: 0,
                    alignSelf: 'center',
                    background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                    border: '1px solid var(--border)',
                    borderRadius: 8, padding: '8px 12px',
                    fontFamily: 'var(--font-mono)', fontSize: '0.74rem',
                    color: 'var(--fg-primary)',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={saveApiKey}
                  style={{
                    padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
                    background: 'var(--accent)', border: 'none',
                    fontFamily: 'var(--font-family)', fontSize: '0.76rem',
                    fontWeight: 600, color: '#fff',
                    transition: 'opacity 0.15s',
                    flexShrink: 0,
                    alignSelf: 'center',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
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
              label="Open last note on startup"
              description="Resume where you left off when navigating to Notes"
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
              label="Clear All Notes"
              description="Permanently delete all saved documents"
              onConfirm={clearNotes}
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
              icon={<History size={15} />}
              label="Clear Search History"
              description="Remove all locally stored past search queries"
              onConfirm={clearHistory}
            />
            <Divider />
            <DangerRow
              icon={<Trash2 size={15} />}
              label="Clear Source Library"
              description="Remove all sources saved from your searches"
              onConfirm={clearSources}
            />
          </Card>
        </div>

        {/* Toast */}
        {toastMsg && (
          <div
            style={{
              position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
              padding: '9px 20px', borderRadius: 99,
              background: dark ? 'rgba(22,163,74,0.18)' : 'rgba(22,163,74,0.12)',
              border: '1px solid rgba(22,163,74,0.30)',
              fontFamily: 'var(--font-family)', fontSize: '0.78rem',
              color: '#16a34a', whiteSpace: 'nowrap',
              boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
              zIndex: 9999,
              opacity: toastVisible ? 1 : 0,
              transition: 'opacity 0.22s ease',
              pointerEvents: 'none',
            }}
          >
            {toastMsg}
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
      </PageShell>
    </div>
  );
}
