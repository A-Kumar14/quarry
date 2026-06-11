import React, { useState, useCallback, useEffect, useRef } from 'react';
import createGlobe from 'cobe';
import { useNavigate } from 'react-router-dom';
import { Search, Zap } from 'lucide-react';
import { getBeats, incrementBeatActivity } from '../utils/beats';
import { useDarkMode } from '../DarkModeContext';
import DailyTopicsModal from '../components/DailyTopicsModal';
import NotesModal from '../components/NotesModal';
import { useAuth } from '../contexts/AuthContext';
import OnboardingModal from '../components/OnboardingModal';
import GlassCard from '../components/GlassCard';
import { useNotes } from '../hooks/useNotes';
import { buildDailyDigestSignature, getCachedDailyDigest, setCachedDailyDigest } from '../utils/dailyDigestCache';
import { PromptInputBox } from '../components/ui/ai-prompt-box';
import BorderGlow from '../components/ui/BorderGlow';
import { Waves } from '../components/ui/wave-background';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';

/* ── Design tokens ───────────────────────────────────────────────────────── */
const T = {
  bg:          'var(--bg-primary)',
  glass:       'var(--glass-bg)',
  glassBorder: '1px solid var(--glass-border)',
  glassShadow: 'var(--glass-shadow)',
  accent:      '#F97316',
  accentDim:   'rgba(249,115,22,0.12)',
  accentBorder: 'rgba(249,115,22,0.40)',
  accentGlow:  'rgba(249,115,22,0.25)',
  fg:          'var(--fg-primary)',
  fgSec:       'var(--fg-secondary)',
  fgDim:       'var(--fg-dim)',
  border:      'var(--border)',
  serif:       "'IBM Plex Serif',Georgia,serif",
  sans:        "'IBM Plex Sans',system-ui,sans-serif",
  mono:        "'IBM Plex Mono',monospace",
};

const ANALYSIS_PROFILES = [
  {
    id: 'fast_scan',
    label: 'Fast scan',
    description: 'Quick pass across the web',
    model: 'openai/gpt-4o-mini',
    modelHint: 'GPT-4o mini',
  },
  {
    id: 'careful_analysis',
    label: 'Careful analysis',
    description: 'Balanced depth and speed',
    model: 'openai/gpt-4o',
    modelHint: 'GPT-4o',
  },
  {
    id: 'deep_mapping',
    label: 'Deep mapping',
    description: 'Thorough structure and cross-checks',
    model: 'anthropic/claude-3.5-sonnet',
    modelHint: 'Claude 3.5 Sonnet',
  },
];

function profileIdFromModel(modelId = '') {
  const found = ANALYSIS_PROFILES.find((p) => p.model === modelId);
  return found ? found.id : 'careful_analysis';
}

/* ── Investigation history helpers ──────────────────────────────────────── */
const RESEARCH_HISTORY_KEY = 'quarry_research_history';
const LEGACY_INVESTIGATION_HISTORY_KEY = 'quarry_investigation_history';

export function saveInvestigationHistory(query, contradictions) {
  if (!query) return;
  try {
    const existingPrimary = JSON.parse(localStorage.getItem(RESEARCH_HISTORY_KEY) || '[]');
    const existingLegacy = JSON.parse(localStorage.getItem(LEGACY_INVESTIGATION_HISTORY_KEY) || '[]');
    const existing = existingPrimary.length > 0 ? existingPrimary : existingLegacy;
    const entry = { query, timestamp: Date.now(), contradictions: contradictions || [] };
    const payload = JSON.stringify([entry, ...existing].slice(0, 50));
    localStorage.setItem(RESEARCH_HISTORY_KEY, payload);
    localStorage.setItem(LEGACY_INVESTIGATION_HISTORY_KEY, payload);
  } catch {}
}

/* ── Recently Contested helpers ──────────────────────────────────────────── */
const CONTESTED_KEY = 'quarry_contested_claims';

export function saveContestedClaims(query, claims) {
  if (!claims?.length) return;
  const contested = claims.filter(c => c.status === 'contested');
  if (!contested.length) return;
  try {
    const existing = JSON.parse(localStorage.getItem(CONTESTED_KEY) || '[]');
    const entries = contested.map(c => ({
      claim: c.claim_text || c.claim || '',
      query,
      sourceCount: c.source_outlets?.length || 0,
      savedAt: Date.now(),
    }));
    const merged = [...entries, ...existing].slice(0, 20);
    localStorage.setItem(CONTESTED_KEY, JSON.stringify(merged));
  } catch {}
}

function ago(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/* ── Globe pins hook — live GDELT data, falls back to WORLD_PINS ─────────── */
function useGlobePins(topicHint = '') {
  const [pins, setPins] = useState(WORLD_PINS);

  useEffect(() => {
    const q = (topicHint || '').trim();
    const url = q
      ? `${API}/explore/globe-pins?topic=${encodeURIComponent(q)}`
      : `${API}/explore/globe-pins`;
    fetch(url)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        const live = (data.pins || []).filter(p => p.lat != null && p.lng != null);
        if (live.length > 0) setPins(live);
      })
      .catch(() => {}); // keep WORLD_PINS on any error
  }, [topicHint]); // eslint-disable-line react-hooks/exhaustive-deps

  return pins;
}

/* ── SearchSurface (shared between logged-in and logged-out) ─────────────── */
function SearchSurface({ query, setQuery, isDeep, setIsDeep, selectedProfileId, setSelectedProfileId, onSubmit, flat = false }) {
  const [dark] = useDarkMode();
  const handleKey = useCallback((e) => {
    if (e.key === 'Enter' && query.trim()) onSubmit();
  }, [query, onSubmit]);

  const inner = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* ── Search pill ── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        background: 'var(--gbtn-bg)', border: `1px solid ${T.border}`,
        borderRadius: 14, padding: '0 6px 0 18px', gap: 10,
      }}>
        <Search size={17} color={T.fgDim} style={{ flexShrink: 0 }} />
        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Search news, topic, or source..."
          style={{
            flex: 1, border: 'none', background: 'transparent', outline: 'none',
            fontFamily: T.sans, fontSize: '1rem', fontWeight: 400,
            color: T.fg, padding: '15px 0', minWidth: 0,
          }}
        />
        <button
          onClick={() => query.trim() && onSubmit()}
          disabled={!query.trim()}
          style={{
            flexShrink: 0,
            background: query.trim() ? T.accent : T.accentDim,
            color: '#fff',
            border: 'none', borderRadius: 10,
            cursor: query.trim() ? 'pointer' : 'default',
            padding: '9px 20px',
            fontFamily: T.sans, fontSize: '0.88rem', fontWeight: 600,
            boxShadow: query.trim() ? `0 2px 10px ${T.accentGlow}` : 'none',
            transition: 'background 0.15s, box-shadow 0.15s',
            whiteSpace: 'nowrap',
          }}
        >
          Search
        </button>
      </div>

      {/* ── Mode row ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
      }}>

        {/* Deep toggle */}
        <button
          onClick={() => setIsDeep(!isDeep)}
          title="Deep mode: multi-pass retrieval and claim extraction"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '5px 12px',
            borderRadius: 8,
            border: isDeep ? `1px solid ${T.accentBorder}` : `1px solid ${T.border}`,
            background: isDeep ? T.accentDim : 'transparent',
            color: isDeep ? T.accent : T.fgSec,
            fontFamily: T.sans, fontSize: '0.76rem', fontWeight: isDeep ? 600 : 500,
            cursor: 'pointer', transition: 'all 0.14s', whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => { if (!isDeep) { e.currentTarget.style.borderColor = T.accentBorder; e.currentTarget.style.color = T.fg; } }}
          onMouseLeave={e => { if (!isDeep) { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.fgSec; } }}
        >
          <Zap size={12} fill={isDeep ? T.accent : 'none'} strokeWidth={2} />
          Deep
        </button>

        {/* Divider */}
        <div style={{ width: 1, height: 18, background: T.border, flexShrink: 0 }} />

        {/* Profile chips — inline, no dropdown */}
        {ANALYSIS_PROFILES.map((opt) => {
          const active = opt.id === selectedProfileId;
          return (
            <button
              key={opt.id}
              onClick={() => {
                setSelectedProfileId(opt.id);
                if (opt.id === 'deep_mapping') setIsDeep(true);
              }}
              title={opt.modelHint}
              style={{
                display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start',
                gap: 1,
                padding: '5px 11px',
                borderRadius: 8,
                border: active
                  ? `1px solid ${T.accentBorder}`
                  : `1px solid ${T.border}`,
                background: active ? T.accentDim : 'transparent',
                cursor: 'pointer', transition: 'all 0.14s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = T.accentBorder; e.currentTarget.style.background = dark ? 'rgba(249,115,22,0.06)' : 'rgba(249,115,22,0.05)'; } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = 'transparent'; } }}
            >
              <span style={{
                fontFamily: T.sans, fontSize: '0.75rem',
                fontWeight: active ? 600 : 500,
                color: active ? T.accent : T.fgSec,
                lineHeight: 1,
              }}>
                {opt.label}
              </span>
              <span style={{
                fontFamily: T.mono, fontSize: '0.55rem',
                color: active ? T.accent : T.fgDim,
                opacity: active ? 0.8 : 0.7,
                lineHeight: 1,
              }}>
                {opt.modelHint}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  if (flat) return <div style={{ width: '100%' }}>{inner}</div>;

  return (
    <GlassCard variant="surface" style={{
      borderRadius: 18, padding: '32px 36px',
      width: '100%', maxWidth: 820, margin: '0 auto',
    }}>
      {inner}
    </GlassCard>
  );
}


/* ── Global Incident Heatmap (visual placeholder) ────────────────────────── */
const HEATMAP_FILTERS = ['All', 'Conflict', 'Famine', 'Politics'];
const HEATMAP_PINS = [
  { label: 'Gaza',    top: '40%', left: '58%', type: 'breaking',   color: '#e24b4a' },
  { label: 'Sudan',   top: '55%', left: '42%', type: 'developing', color: '#F97316' },
  { label: 'Myanmar', top: '45%', left: '68%', type: 'breaking',   color: '#e24b4a' },
  { label: 'Ukraine', top: '20%', left: '52%', type: 'developing', color: '#F97316' },
];

// Extended pin set — lat/lng for globe, top/left for mini flat map
const WORLD_PINS = [
  { label: 'Gaza',           desc: 'Ongoing airstrikes; humanitarian crisis escalating',     lat:  31.5, lng:  34.5, top: '41%', left: '57.5%', color: '#e24b4a', type: 'Conflict'  },
  { label: 'Sudan / Darfur', desc: 'RSF offensive; UN reports mass displacement',             lat:  13.0, lng:  22.0, top: '50%', left: '54%',   color: '#e24b4a', type: 'Conflict'  },
  { label: 'Ukraine',        desc: 'Front-line shelling continues in Donetsk region',         lat:  49.0, lng:  31.0, top: '28%', left: '54%',   color: '#F97316', type: 'Conflict'  },
  { label: 'Myanmar',        desc: 'Junta airstrikes on civilian areas; internet blackout',   lat:  17.0, lng:  96.0, top: '47%', left: '72%',   color: '#e24b4a', type: 'Conflict'  },
  { label: 'Haiti',          desc: 'Gang violence; government collapse imminent',             lat:  19.0, lng: -72.0, top: '46%', left: '27%',   color: '#e24b4a', type: 'Conflict'  },
  { label: 'Sahel',          desc: 'Drought + armed groups driving food insecurity',          lat:  14.0, lng:   2.0, top: '50%', left: '47%',   color: '#facc15', type: 'Famine'    },
  { label: 'Ethiopia',       desc: 'Tigray ceasefire fragile; aid access blocked',            lat:   9.0, lng:  38.0, top: '50%', left: '57%',   color: '#F97316', type: 'Famine'    },
  { label: 'Venezuela',      desc: 'Opposition crackdown; election fraud allegations',        lat:   8.0, lng: -66.0, top: '52%', left: '28%',   color: '#7f77dd', type: 'Politics'  },
  { label: 'Georgia',        desc: 'Anti-govt protests after disputed election result',       lat:  41.5, lng:  44.5, top: '31%', left: '58%',   color: '#7f77dd', type: 'Politics'  },
  { label: 'Bangladesh',     desc: 'Monsoon flooding displaced 4M; aid insufficient',         lat:  23.0, lng:  90.0, top: '46%', left: '70%',   color: '#facc15', type: 'Famine'    },
  { label: 'Somalia',        desc: 'Al-Shabaab advance; famine risk elevated',                lat:   6.0, lng:  46.0, top: '52%', left: '58%',   color: '#e24b4a', type: 'Conflict'  },
];

// eslint-disable-next-line no-unused-vars
const TYPE_COLORS = { Conflict: '#e24b4a', Famine: '#facc15', Politics: '#7f77dd', Sports: '#22c55e', All: '#F97316' };

const INCIDENT_REGION_MAP = {
  Gaza: { city: 'Gaza', country: 'Palestine' },
  'Sudan / Darfur': { city: 'Darfur', country: 'Sudan' },
  Ukraine: { city: 'Donetsk', country: 'Ukraine' },
  Myanmar: { city: 'Yangon', country: 'Myanmar' },
  Haiti: { city: 'Port-au-Prince', country: 'Haiti' },
  Sahel: { city: 'Sahel', country: 'West Africa' },
  Ethiopia: { city: 'Mekelle', country: 'Ethiopia' },
  Venezuela: { city: 'Caracas', country: 'Venezuela' },
  Georgia: { city: 'Tbilisi', country: 'Georgia' },
  Bangladesh: { city: 'Dhaka', country: 'Bangladesh' },
  Somalia: { city: 'Mogadishu', country: 'Somalia' },
};

function toLiveMarkers(pins = WORLD_PINS) {
  return pins
    .filter(p => p.lat != null && p.lng != null)
    .map((pin, i) => {
      const mapped = INCIDENT_REGION_MAP[pin.label];
      const [countryFromLabel, cityFromLabel] = pin.label.includes('/') ? pin.label.split('/').map(v => v.trim()) : [pin.label, pin.label];
      return {
        id: pin.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `marker-${i}`,
        location: [pin.lat, pin.lng],
        city: mapped?.city || cityFromLabel || pin.label,
        country: mapped?.country || countryFromLabel || pin.type || 'Global',
        headline: pin.desc || `Top live development in ${pin.label}.`,
      };
    });
}

function normalizeTopicTokens(raw = '') {
  return String(raw)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map(t => t.trim())
    .filter(t => t.length >= 3);
}

// eslint-disable-next-line no-unused-vars
function pickActiveIncident({ pins = WORLD_PINS, profile = {}, trackedTopics = [] }) {
  const markers = toLiveMarkers(pins);
  if (!markers.length) return { marker: null, matched: false, score: 0 };

  const preferenceTerms = [
    profile?.focus_area,
    profile?.beat,
    ...(profile?.topics_of_focus || []),
    ...(trackedTopics || []),
  ]
    .filter(Boolean)
    .flatMap(normalizeTopicTokens);

  if (!preferenceTerms.length) {
    return { marker: markers[0], matched: false, score: 0 };
  }

  const scored = markers.map((marker, idx) => {
    const haystack = `${marker.city} ${marker.country} ${marker.headline}`.toLowerCase();
    const score = preferenceTerms.reduce((sum, term) => {
      if (!term) return sum;
      // Headline/topic term matches matter most, then city/country.
      if (haystack.includes(term)) return sum + (marker.headline.toLowerCase().includes(term) ? 3 : 1);
      return sum;
    }, 0);
    return { marker, idx, score };
  });

  scored.sort((a, b) => b.score - a.score || a.idx - b.idx);
  const best = scored[0];
  const minConfidence = 2;
  if (!best) return { marker: markers[0], matched: false, score: 0 };
  return {
    marker: best.marker,
    matched: best.score >= minConfidence,
    score: best.score,
  };
}




function GlobalIncidentHeatmap({ height = 220, label = 'Global Incident Overview', labelSize = 11 }) {
  const mini = labelSize <= 9;
  const [activeFilter, setActiveFilter] = useState('All');

  return (
    <GlassCard style={{
      position: 'relative', height, width: '100%',
      borderRadius: 12, overflow: 'hidden',
    }}>
      {/* Subtle grid lines for map feel */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.15 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={`${(i + 1) * (100 / 7)}%`} x2="100%" y2={`${(i + 1) * (100 / 7)}%`}
            stroke="var(--fg-dim)" strokeWidth="0.5" />
        ))}
        {Array.from({ length: 9 }).map((_, i) => (
          <line key={`v${i}`} x1={`${(i + 1) * (100 / 10)}%`} y1="0" x2={`${(i + 1) * (100 / 10)}%`} y2="100%"
            stroke="var(--fg-dim)" strokeWidth="0.5" />
        ))}
      </svg>

      {/* Label */}
      <div style={mini ? {
        position: 'absolute', bottom: 4, left: 6,
        fontFamily: "'IBM Plex Mono',monospace", fontSize: 9,
        fontWeight: 600, color: 'var(--fg-dim)', letterSpacing: '0.10em',
        textTransform: 'uppercase', zIndex: 2,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '90%',
      } : {
        position: 'absolute', top: 10, left: 12,
        fontFamily: "'IBM Plex Mono',monospace", fontSize: labelSize,
        fontWeight: 600, color: 'var(--fg-dim)', letterSpacing: '0.10em',
        textTransform: 'uppercase', zIndex: 2,
      }}>
        {label}
      </div>

      {/* Filter chips — hidden in mini mode */}
      {!mini && <div style={{ position: 'absolute', top: 8, right: 10, display: 'flex', gap: 5, zIndex: 2 }}>
        {HEATMAP_FILTERS.map(f => (
          <button key={f} onClick={() => setActiveFilter(f)} style={{
            padding: '2px 9px', borderRadius: 99, cursor: 'pointer',
            fontFamily: "'IBM Plex Sans',system-ui,sans-serif", fontSize: '0.62rem', fontWeight: 500,
            border: activeFilter === f ? `1px solid ${T.accentBorder}` : '1px solid var(--border)',
            background: activeFilter === f ? T.accentDim : 'var(--gbtn-bg)',
            color: activeFilter === f ? T.accent : 'var(--fg-dim)',
            transition: 'all 0.13s',
          }}>
            {f}
          </button>
        ))}
      </div>}

      {/* Incident pins */}
      {HEATMAP_PINS.map((pin, i) => (
        <div key={i} style={{ position: 'absolute', top: pin.top, left: pin.left, zIndex: 3 }}>
          {/* Pulse ring */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            width: 18, height: 18, borderRadius: '50%',
            border: `1.5px solid ${pin.color}`,
            opacity: 0.4,
            animation: 'pinPulse 2s ease-in-out infinite',
            animationDelay: `${i * 0.4}s`,
          }} />
          {/* Dot */}
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: pin.color,
            boxShadow: `0 0 6px ${pin.color}80`,
            cursor: 'default',
          }} />
          {/* Label bubble */}
          <div style={{
            position: 'absolute', top: -22, left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.72)',
            color: '#fff', fontSize: 8,
            fontFamily: "'IBM Plex Mono',monospace",
            padding: '2px 6px', borderRadius: 4,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}>
            {pin.label}
          </div>
        </div>
      ))}

      <style>{`
        @keyframes pinPulse {
          0%,100% { transform: translate(-50%,-50%) scale(1); opacity: 0.4; }
          50%      { transform: translate(-50%,-50%) scale(1.8); opacity: 0; }
        }
      `}</style>
    </GlassCard>
  );
}

/* ── Logged-out homepage ─────────────────────────────────────────────────── */
function LoggedOutHome({ query, setQuery, isDeep, setIsDeep, selectedProfileId, setSelectedProfileId, onSubmit }) {
  const navigate = useNavigate();

  return (
    <section style={{ padding: '80px 32px 60px', maxWidth: 1000, margin: '0 auto' }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 52 }}>
        <div style={{
          fontFamily: T.mono, fontSize: '0.78rem', fontWeight: 600,
          letterSpacing: '0.16em', color: T.accent,
          textTransform: 'uppercase', marginBottom: 20,
        }}>
          AI Research Engine
        </div>
        <h1 style={{
          fontFamily: T.serif, fontSize: 'clamp(2.8rem, 6vw, 4rem)',
          fontWeight: 400, color: T.accent, lineHeight: 1.12,
          letterSpacing: '-0.025em', marginBottom: 24,
        }}>
          Research. Verify.<br />Understand with confidence.
        </h1>
        <p style={{
          fontFamily: T.sans, fontSize: '1.15rem', fontWeight: 300,
          color: T.fgSec, lineHeight: 1.7, maxWidth: 540, margin: '0 auto 48px',
        }}>
          Search the web, see where sources contradict
          each other, and build clear, source-grounded analysis in one place.
        </p>
      </div>

      <SearchSurface
        query={query} setQuery={setQuery}
        isDeep={isDeep} setIsDeep={setIsDeep}
        selectedProfileId={selectedProfileId} setSelectedProfileId={setSelectedProfileId}
        onSubmit={onSubmit}
      />

      {/* Heatmap */}
      <div style={{ maxWidth: 820, margin: '36px auto 0' }}>
        <GlobalIncidentHeatmap height={220} label="Global Incident Overview" labelSize={11} />
      </div>

      {/* CTA row */}
      <div style={{
        maxWidth: 820, margin: '28px auto 0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 16,
        padding: '18px 22px',
        background: 'var(--glass-bg)', backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        border: '1px solid var(--border)', borderRadius: 14,
      }}>
        <span style={{ fontFamily: T.sans, fontSize: '0.88rem', color: T.fgDim, lineHeight: 1.5 }}>
          Sign up to track topics and surface relevant updates
        </span>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => navigate('/signup')} style={{
            padding: '9px 22px', borderRadius: 10, cursor: 'pointer',
            background: T.accent, border: 'none', color: '#fff',
            fontFamily: T.sans, fontSize: '0.86rem', fontWeight: 600,
            boxShadow: `0 2px 10px ${T.accentGlow}`,
            transition: 'transform 0.14s',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            Create free account
          </button>
          <button onClick={() => navigate('/login')} style={{
            padding: '9px 22px', borderRadius: 10, cursor: 'pointer',
            background: 'transparent', border: '1px solid var(--border)',
            color: T.fgSec, fontFamily: T.sans, fontSize: '0.86rem', fontWeight: 500,
            transition: 'border-color 0.14s, color 0.14s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.color = T.accent; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = T.fgSec; }}
          >
            Sign in
          </button>
        </div>
      </div>
    </section>
  );
}

/* ── Daily Topics Card ───────────────────────────────────────────────────── */
const CATEGORY_COLOR = {
  Conflict:     '#e24b4a',
  Humanitarian: '#f59e0b',
  Economics:    '#7f77dd',
  Politics:     '#3b82f6',
  Climate:      '#22c55e',
  Focus:        '#22c55e',
};

function DailyTopicsCard({ onOpen, profile, userId }) {
  const [dark] = useDarkMode();
  const [hovered, setHovered] = useState(false);
  const [digest, setDigest] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const beatNames = getBeats().map(b => b.name);
    const signature = buildDailyDigestSignature(profile || {}, beatNames);
    const cached = getCachedDailyDigest(userId, signature);
    if (cached) {
      setDigest(cached);
      return;
    }

    setLoading(true);
    fetch(`${API}/explore/daily-digest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ beats: beatNames, profile: profile || {} }),
    })
      .then(r => { if (!r.ok) throw new Error('daily brief failed'); return r.json(); })
      .then(data => {
        if (cancelled) return;
        setDigest(data);
        setCachedDailyDigest(userId, signature, data);
      })
      .catch(() => {
        // Keep card quiet if fetch fails; modal can still retry.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [profile, userId]);

  const bg        = 'rgba(20,14,8,0.92)';
  const border    = dark ? 'rgba(249,115,22,0.22)' : 'rgba(249,115,22,0.18)';
  const shimmerBg = dark ? 'rgba(249,115,22,0.07)' : 'rgba(249,115,22,0.05)';
  const topics = (digest?.topics || []).slice(0, 5);
  const fallbackTopics = (profile?.topics_of_focus || []).slice(0, 5).map(label => ({ label, category: 'Focus' }));
  const hasRealTopics = topics.length > 0;

  const URGENCY_BADGE = (raw = '') => {
    const u = raw.toLowerCase();
    if (u.includes('break')) return { label: 'Breaking',   bg: 'rgba(239,68,68,0.18)',  color: '#fca5a5', border: 'rgba(239,68,68,0.28)'  };
    if (u.includes('develop'))return { label: 'Developing', bg: 'rgba(245,158,11,0.18)', color: '#fcd34d', border: 'rgba(245,158,11,0.28)' };
    if (u.includes('analy'))  return { label: 'Analysis',   bg: 'rgba(59,130,246,0.18)', color: '#93c5fd', border: 'rgba(59,130,246,0.28)' };
    return null;
  };

  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 14, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        cursor: 'pointer',
        background: bg,
        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        border: `1px solid ${hovered ? 'rgba(249,115,22,0.45)' : border}`,
        boxShadow: hovered
          ? '0 8px 32px rgba(249,115,22,0.14), 0 2px 8px rgba(0,0,0,0.08)'
          : '0 2px 8px rgba(0,0,0,0.05)',
        transition: 'box-shadow 0.22s ease, border-color 0.22s ease, transform 0.22s ease',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
      }}
    >
      {/* Header — accent-tinted stripe */}
      <div style={{
        padding: '10px 14px 9px',
        borderBottom: `1px solid ${border}`,
        background: shimmerBg,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ fontFamily: T.sans, fontSize: '0.92rem', fontWeight: 600, color: 'rgba(240,230,216,0.90)' }}>
          Today's topics
        </div>
      </div>

      {/* Topic list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {loading && topics.length === 0 && (
          <div style={{ padding: '12px 14px', fontFamily: T.sans, fontSize: '0.76rem', color: 'rgba(200,190,175,0.45)' }}>
            Loading your digest…
          </div>
        )}
        {!loading && topics.length === 0 && fallbackTopics.length === 0 && (
          <div style={{ padding: '12px 14px', fontFamily: T.sans, fontSize: '0.76rem', color: 'rgba(200,190,175,0.45)' }}>
            Add focus areas in your profile to personalise this digest.
          </div>
        )}
        {(hasRealTopics ? topics : fallbackTopics.map(f => ({ headline: f.label, urgency: f.category }))).map((topic, i, arr) => {
          const badge = URGENCY_BADGE(topic.urgency || topic.beat || '');
          const catColor = CATEGORY_COLOR[topic.beat] || T.accent;
          const headline = topic.headline || topic.label || 'Untitled topic';
          const summary = topic.summary && topic.summary !== headline ? topic.summary : null;
          return (
            <div
              key={i}
              style={{
                padding: '10px 14px',
                borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                transition: 'background 0.12s',
                cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(249,115,22,0.04)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              {/* Badges row */}
              <div style={{ display: 'flex', gap: 5, marginBottom: 6, flexWrap: 'wrap' }}>
                {badge ? (
                  <span style={{
                    fontFamily: T.mono, fontSize: '0.58rem', fontWeight: 500,
                    textTransform: 'uppercase', letterSpacing: '0.03em',
                    padding: '2px 7px', borderRadius: 9999,
                    background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`,
                  }}>{badge.label}</span>
                ) : (
                  <span style={{
                    fontFamily: T.mono, fontSize: '0.58rem', fontWeight: 500,
                    textTransform: 'uppercase', letterSpacing: '0.03em',
                    padding: '2px 7px', borderRadius: 9999,
                    background: `${catColor}18`, color: catColor, border: `1px solid ${catColor}28`,
                  }}>{topic.beat || 'Topic'}</span>
                )}
              </div>
              {/* Headline */}
              <div style={{
                fontFamily: T.sans, fontSize: '0.80rem', fontWeight: 600,
                color: 'rgba(240,230,216,0.88)', lineHeight: 1.35, marginBottom: summary ? 5 : 8,
              }}>
                {headline}
              </div>
              {/* Summary */}
              {summary && (
                <div style={{
                  fontFamily: T.sans, fontSize: '0.70rem', fontWeight: 300,
                  color: 'rgba(200,190,175,0.50)', lineHeight: 1.55, marginBottom: 8,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {summary}
                </div>
              )}
              {/* Footer */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: T.mono, fontSize: '0.60rem', color: 'rgba(200,190,175,0.30)' }}>
                  {(topic.sources || []).slice(0, 2).join(' · ')}
                </span>
                <button
                  onClick={e => { e.stopPropagation(); onOpen?.(); }}
                  style={{
                    background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.28)',
                    borderRadius: 6, padding: '3px 9px',
                    fontFamily: T.sans, fontSize: '0.68rem', fontWeight: 600,
                    color: '#F97316', cursor: 'pointer',
                  }}
                >
                  Explore ›
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer CTA */}
      <div style={{
        padding: '10px 14px',
        borderTop: `1px solid ${border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: shimmerBg,
      }}>
        <span style={{ fontFamily: T.mono, fontSize: '0.57rem', color: T.fgDim }}>
          Personalized to your tracked topics
        </span>
        <span style={{
          fontFamily: T.sans, fontSize: '0.72rem', fontWeight: 600,
          color: T.accent,
          display: 'flex', alignItems: 'center', gap: 4,
          opacity: hovered ? 1 : 0.75,
          transition: 'opacity 0.15s',
        }}>
          Open full brief →
        </span>
      </div>
    </div>
  );
}

function formatAgoFromISO(iso) {
  const ts = Date.parse(iso || '');
  if (!ts) return 'just now';
  return ago(ts);
}

function HomeNotesCard({ notes = [], onOpen, onNewNote }) {
  const [hovered, setHovered] = useState(false);
  const sorted = [...notes].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const recent = sorted.slice(0, 2);
  const lastUpdated = sorted[0]?.updatedAt ? formatAgoFromISO(sorted[0].updatedAt) : 'just now';

  return (
    <GlassCard
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 14,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        cursor: 'pointer',
        border: `1px solid ${hovered ? 'rgba(249,115,22,0.45)' : 'var(--glass-border)'}`,
        boxShadow: hovered
          ? '0 8px 32px rgba(249,115,22,0.14), 0 2px 8px rgba(0,0,0,0.08)'
          : '0 2px 8px rgba(0,0,0,0.05)',
        transition: 'box-shadow 0.22s ease, border-color 0.22s ease, transform 0.22s ease',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
      }}
    >
      <div style={{ padding: '10px 14px 8px', borderBottom: `1px solid var(--border)`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7, flexShrink: 0,
          background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.20)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
        </div>
        <div style={{ fontFamily: T.sans, fontSize: '0.92rem', fontWeight: 600, color: T.fg, flex: 1 }}>
          Notes
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onOpen?.(); }}
          style={{
            border: 'none', background: 'none', color: T.accent, cursor: 'pointer',
            fontFamily: T.sans, fontSize: '0.72rem', fontWeight: 500, padding: 0,
          }}
        >
          View all →
        </button>
      </div>

      {recent.length === 0 ? (
        <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <div style={{ fontFamily: T.serif, fontSize: '0.94rem', color: T.fg, lineHeight: 1.4 }}>
            Start a note. We&apos;ll keep it close to your research.
          </div>
          <div style={{ fontFamily: T.sans, fontSize: '0.74rem', color: T.fgDim, lineHeight: 1.55 }}>
            Draft outlines, timelines, and leads — Quarry keeps them tied to your topics.
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onNewNote?.(); }}
            style={{
              marginTop: 4, alignSelf: 'flex-start', border: 'none', borderRadius: 8,
              background: T.accent, color: '#fff', fontFamily: T.sans, fontSize: '0.70rem',
              fontWeight: 600, padding: '7px 12px', cursor: 'pointer',
            }}
          >
            New note
          </button>
        </div>
      ) : (
        <div style={{ padding: '10px 14px 12px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <div style={{ fontFamily: T.mono, fontSize: '0.59rem', color: T.fgDim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {notes.length} notes · last updated {lastUpdated}
          </div>

          {recent.map((note) => (
            <div key={note.id} style={{ borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', padding: '9px 11px' }}>
              <div style={{ fontFamily: T.sans, fontSize: '0.76rem', color: T.fg, fontWeight: 600, marginBottom: 4 }}>
                {note.title || 'Untitled note'}
              </div>
              {note.body && (() => {
                // Strip YAML frontmatter, markdown syntax, blank lines → clean preview
                const clean = note.body
                  .replace(/^---[\s\S]*?---\n?/, '')        // YAML frontmatter
                  .split('\n')
                  .filter(l => !/^\s*[\w\s]{1,20}:\s+\S/.test(l)) // skip "Key: value" metadata lines
                  .join('\n')
                  .replace(/^#{1,6}\s+/gm, '')              // headings
                  .replace(/\*\*|__|~~|`{1,3}/g, '')        // bold/italic/code
                  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // links → label
                  .replace(/^[-*>]\s+/gm, '')               // list/quote markers
                  .replace(/\n{2,}/g, ' ')
                  .trim();
                if (!clean) return null;
                return (
                  <div style={{
                    fontFamily: T.sans, fontSize: '0.70rem', color: T.fgSec,
                    lineHeight: 1.5, marginBottom: 5,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {clean}
                  </div>
                );
              })()}
              <div style={{ fontFamily: T.mono, fontSize: '0.57rem', color: T.fgDim }}>
                {formatAgoFromISO(note.updatedAt)}
              </div>
            </div>
          ))}

          <button
            onClick={(e) => { e.stopPropagation(); onNewNote?.(); }}
            style={{
              alignSelf: 'flex-start', border: 'none', borderRadius: 8,
              background: T.accent, color: '#fff',
              fontFamily: T.sans, fontSize: '0.70rem', fontWeight: 600,
              padding: '6px 12px', cursor: 'pointer',
            }}
          >
            + New note
          </button>
        </div>
      )}
    </GlassCard>
  );
}

function IntelligenceGrid({ onOpenDailyTopics, onOpenNotes, onCreateNote, notes, profile, userId, onSearch, userName }) {
  const [beats, setBeats] = useState([]);
  const [showGlobeModal, setShowGlobeModal] = useState(false);
  const globeTopicHint = profile?.focus_area || profile?.beat || profile?.topics_of_focus?.[0] || beats[0]?.name || '';
  const globePins = useGlobePins(globeTopicHint);

  useEffect(() => { setBeats(getBeats()); }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = userName ? userName.split(/[\s@]/)[0] : '';

  return (
    <div style={{
      width: '100%',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '100px 24px 48px',
      boxSizing: 'border-box',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 1220,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        margin: '0 auto',
      }}>
        {/* Greeting */}
        <div style={{ textAlign: 'center', marginBottom: 4 }}>
          <h1 style={{
            fontFamily: T.serif,
            fontSize: 'clamp(1.5rem, 3vw, 1.9rem)',
            fontWeight: 600,
            color: T.fg,
            letterSpacing: '-0.01em',
          }}>
            {greeting}{firstName ? `, ${firstName}` : ''}.
          </h1>
        </div>

        {/* 3-column grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '260px 1fr 290px',
          gap: 16,
          alignItems: 'start',
          width: '100%',
        }}>
          {/* Left: Notes */}
          <HomeNotesCard notes={notes} onOpen={onOpenNotes} onNewNote={onCreateNote} />

          {/* Centre: Prompt bar + Globe */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <HomePromptBar onSearch={onSearch} />
            <InlineGlobeMap pins={globePins} onOpenMap={() => setShowGlobeModal(true)} />
          </div>

          {/* Right: Today's Topics */}
          <DailyTopicsCard onOpen={onOpenDailyTopics} profile={profile} userId={userId} />
        </div>
      </div>
      <GlobeMapModal open={showGlobeModal} onClose={() => setShowGlobeModal(false)} pins={globePins} />
    </div>
  );
}

/* ── Inline globe map (cobe) ────────────────────────────────────────────── */
function InlineGlobeMap({ pins = WORLD_PINS, onOpenMap, showSignalsList = false, modalLayout = false }) {
  const [dark] = useDarkMode();
  const [activePinIndex, setActivePinIndex] = useState(0);
  const canvasRef = useRef(null);
  const phiRef = useRef(0);
  const pointerRef = useRef(null);
  const phiOffsetRef = useRef(0);
  const dragRef = useRef(0);
  const isPausedRef = useRef(false);

  useEffect(() => {
    const onMove = (e) => {
      if (pointerRef.current !== null)
        dragRef.current = (e.clientX - pointerRef.current) / 300;
    };
    const onUp = () => {
      if (pointerRef.current !== null) {
        phiOffsetRef.current += dragRef.current;
        dragRef.current = 0;
      }
      pointerRef.current = null;
      isPausedRef.current = false;
      if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  useEffect(() => {
    if (!pins.length || showSignalsList) return;
    const t = setInterval(() => setActivePinIndex((i) => (i + 1) % pins.length), 2800);
    return () => clearInterval(t);
  }, [pins, showSignalsList]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    let globe, animId;
    let ro = null;
    let cancelled = false;

    const init = () => {
      if (cancelled) return;
      const w = canvas.offsetWidth;
      if (!w) return;
      globe = createGlobe(canvas, {
        devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        width: w, height: w,
        phi: 0, theta: 0.25,
        dark: dark ? 1 : 0,
        diffuse: dark ? 1.05 : 1.35,
        mapSamples: 16000,
        mapBrightness: dark ? 4 : 6,
        baseColor: dark ? [0.10, 0.12, 0.15] : [0.90, 0.88, 0.84],
        markerColor: [0.98, 0.45, 0.09],
        glowColor: dark ? [0.05, 0.06, 0.09] : [0.88, 0.84, 0.78],
        markers: pins.filter(p => p.lat != null && p.lng != null)
          .map(p => ({ location: [p.lat, p.lng], size: 0.042 })),
      });
      const animate = () => {
        if (!isPausedRef.current) phiRef.current += 0.003;
        globe.update({ phi: phiRef.current + phiOffsetRef.current + dragRef.current, theta: 0.25 });
        animId = requestAnimationFrame(animate);
      };
      animate();
      setTimeout(() => { canvas.style.opacity = '1'; });
    };

    if (canvas.offsetWidth > 0) {
      init();
    } else {
      ro = new ResizeObserver(entries => {
        if (entries[0]?.contentRect.width > 0) { ro.disconnect(); init(); }
      });
      ro.observe(canvas);
    }

    return () => {
      cancelled = true;
      if (ro) ro.disconnect();
      if (animId) cancelAnimationFrame(animId);
      if (globe) globe.destroy();
    };
  }, [dark, pins]); // eslint-disable-line react-hooks/exhaustive-deps

  const borderC = dark ? 'rgba(255,255,255,0.08)' : 'rgba(120,100,70,0.16)';
  const fgDim   = dark ? 'rgba(200,195,185,0.55)' : 'rgba(90,70,40,0.55)';
  return (
    <GlassCard
      onClick={onOpenMap}
      style={{
        borderRadius: 14,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: showSignalsList ? 'row' : 'column',
        minHeight: showSignalsList ? 520 : 0,
        cursor: onOpenMap ? 'pointer' : 'default',
      }}
    >

      {/* Globe */}
      <div style={{
        flex: showSignalsList ? 0.95 : 'none',
        height: showSignalsList ? 'auto' : (modalLayout ? 460 : 300),
        minHeight: modalLayout ? 420 : undefined,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: showSignalsList ? '14px 12px' : (modalLayout ? '18px 14px' : '12px 8px'),
      }}>
        <div style={{
          width: '100%',
          maxWidth: showSignalsList ? 560 : (modalLayout ? 560 : 280),
          aspectRatio: '1 / 1',
          position: 'relative',
        }}>
          <canvas
            ref={canvasRef}
            onPointerDown={e => {
              pointerRef.current = e.clientX;
              isPausedRef.current = true;
              e.currentTarget.style.cursor = 'grabbing';
            }}
            style={{
              width: '100%',
              height: '100%',
              cursor: 'grab',
              opacity: 0,
              transition: 'opacity 1.2s ease',
              filter: dark ? 'saturate(0.86) contrast(0.92)' : 'saturate(0.88) contrast(0.9)',
              touchAction: 'none',
            }}
          />
        </div>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: dark
              ? 'linear-gradient(to right, rgba(18,14,10,0.10) 0%, rgba(18,14,10,0.02) 40%, rgba(18,14,10,0.08) 100%)'
              : 'linear-gradient(to right, rgba(237,232,223,0.20) 0%, rgba(237,232,223,0.04) 38%, rgba(237,232,223,0.16) 100%)',
          }}
        />
      </div>

      {/* Horizontal pin bar (inline mode only) */}
      {!showSignalsList && (
        <div style={{
          background: dark ? 'rgba(10,8,5,0.95)' : 'rgba(250,248,244,0.90)',
          borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(120,100,70,0.12)'}`,
          padding: '6px 10px',
          display: 'flex',
          alignItems: 'center',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          flexShrink: 0,
        }}>
          {pins.map((pin, i) => (
            <React.Fragment key={i}>
              {i > 0 && <div style={{ width: 1, height: 24, background: dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)', flexShrink: 0, margin: '0 2px' }} />}
              <div
                onMouseEnter={e => { e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0, padding: '4px 9px', borderRadius: 7, background: 'transparent', transition: 'background 0.13s' }}
              >
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: pin.color, boxShadow: `0 0 5px ${pin.color}80`, flexShrink: 0 }} />
                <div>
                  <div style={{ fontFamily: T.sans, fontSize: '0.78rem', fontWeight: 600, color: dark ? 'rgba(240,230,216,0.85)' : T.fg, lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                    {pin.label}
                  </div>
                  <div style={{ fontFamily: T.mono, fontSize: '0.56rem', color: fgDim, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {pin.type}
                  </div>
                </div>
              </div>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Signal list (modal-only) */}
      {showSignalsList && (
      <div style={{ width: 286, flexShrink: 0, borderLeft: `1px solid ${borderC}`, overflowY: 'auto' }}>
        <div style={{
          padding: '8px 12px',
          borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: dark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.01)',
        }}>
          <span style={{ fontFamily: T.mono, fontSize: '0.56rem', color: T.fgDim, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            On-globe signals
          </span>
          <span style={{ fontFamily: T.mono, fontSize: '0.53rem', color: T.fgDim }}>
            {pins.length}
          </span>
        </div>
        {pins.map((pin, i) => (
          <div
            key={i}
            onMouseEnter={() => setActivePinIndex(i)}
            onMouseLeave={() => setActivePinIndex(-1)}
            style={{
              padding: '10px 14px',
              borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.045)'}`,
              background: activePinIndex === i
                ? (dark ? 'rgba(249,115,22,0.08)' : 'rgba(249,115,22,0.06)')
                : 'transparent',
              transition: 'background 0.12s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
              <span style={{
                width: 16, height: 16, borderRadius: 999,
                background: activePinIndex === i ? 'rgba(249,115,22,0.22)' : 'rgba(249,115,22,0.14)',
                border: '1px solid rgba(249,115,22,0.35)',
                flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: T.mono, fontSize: '0.52rem', color: dark ? '#f3ded2' : '#9a3412',
              }}>
                {i + 1}
              </span>
              <span style={{ fontFamily: T.sans, fontSize: '0.80rem', fontWeight: 600, color: dark ? '#ece2d6' : '#1f1408', flex: 1 }}>
                {pin.label.replace(new RegExp(`\\s*${pin.type}$`, 'i'), '')}
              </span>
            </div>
            <div style={{
              fontFamily: T.sans, fontSize: '0.68rem', color: fgDim,
              paddingLeft: 23, lineHeight: 1.42,
              display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {pin.desc}
            </div>
          </div>
        ))}
      </div>
      )}

    </GlassCard>
  );
}

function DetailSection({ title, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontFamily: T.mono, fontSize: '0.58rem', color: 'rgba(240,230,216,0.35)',
        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5,
      }}>
        {title}
      </div>
      <div style={{ fontFamily: T.sans, fontSize: '0.74rem', color: 'rgba(200,195,185,0.72)', lineHeight: 1.55 }}>
        {children}
      </div>
    </div>
  );
}

function GlobeMapModal({ open, onClose, pins }) {
  const [activePin, setActivePin] = React.useState(null);
  const [hoveredRow, setHoveredRow] = React.useState(-1);

  React.useEffect(() => {
    if (!open) { setActivePin(null); setHoveredRow(-1); }
  }, [open]);

  if (!open) return null;

  const modalW = activePin ? 'min(1240px,98vw)' : 'min(980px,98vw)';

  const typePillColor = (type = '') => {
    const t = type.toLowerCase();
    if (t.includes('conflict') || t.includes('crisis') || t.includes('war')) return { bg: 'rgba(220,38,38,0.18)', color: '#ef4444', border: 'rgba(220,38,38,0.30)' };
    if (t.includes('famine') || t.includes('food') || t.includes('health')) return { bg: 'rgba(217,119,6,0.18)', color: '#f59e0b', border: 'rgba(217,119,6,0.30)' };
    if (t.includes('politics') || t.includes('election') || t.includes('diplomatic')) return { bg: 'rgba(124,58,237,0.18)', color: '#a78bfa', border: 'rgba(124,58,237,0.30)' };
    return { bg: 'rgba(249,115,22,0.12)', color: '#f97316', border: 'rgba(249,115,22,0.25)' };
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        background: 'rgba(0,0,0,0.68)',
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: modalW,
          background: 'rgba(14,10,6,0.97)',
          border: '1px solid rgba(249,115,22,0.22)',
          borderRadius: 18,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '94vh',
          transition: 'width 0.28s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.60)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 18px 12px',
          borderBottom: '1px solid rgba(249,115,22,0.12)',
          display: 'flex', alignItems: 'center', gap: 8,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: '1.1rem' }}>🌐</span>
          <span style={{ fontFamily: T.sans, fontSize: '0.94rem', fontWeight: 600, color: 'rgba(240,230,216,0.92)', flex: 1 }}>
            World Signals
          </span>
          <span style={{
            fontFamily: T.mono, fontSize: '0.60rem', color: 'rgba(240,230,216,0.38)',
            background: 'rgba(249,115,22,0.10)', border: '1px solid rgba(249,115,22,0.18)',
            borderRadius: 5, padding: '2px 6px',
          }}>
            {pins.length} signals
          </span>
          <button
            onClick={onClose}
            style={{
              border: '1px solid rgba(255,255,255,0.10)', borderRadius: 999,
              background: 'rgba(255,255,255,0.05)', color: 'rgba(240,230,216,0.55)',
              fontFamily: T.sans, fontSize: '0.70rem', padding: '4px 10px', cursor: 'pointer',
              transition: 'all 0.14s',
            }}
          >
            Close
          </button>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Globe pane */}
          <div style={{ flex: 1, minWidth: 0, minHeight: 460 }}>
            <InlineGlobeMap pins={pins} showSignalsList={false} modalLayout />
          </div>

          {/* Signal list */}
          <div style={{
            width: 300, flexShrink: 0,
            borderLeft: '1px solid rgba(255,255,255,0.06)',
            overflowY: 'auto',
          }}>
            {pins.map((pin, i) => {
              const pill = typePillColor(pin.type);
              return (
                <div
                  key={i}
                  onMouseEnter={() => setHoveredRow(i)}
                  onMouseLeave={() => setHoveredRow(-1)}
                  style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    background: hoveredRow === i ? 'rgba(249,115,22,0.07)' : 'transparent',
                    transition: 'background 0.12s',
                    cursor: 'default',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{
                      width: 18, height: 18, borderRadius: 999, flexShrink: 0,
                      background: 'rgba(249,115,22,0.14)', border: '1px solid rgba(249,115,22,0.30)',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: T.mono, fontSize: '0.52rem', color: '#f3ded2', marginTop: 1,
                    }}>
                      {i + 1}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: T.sans, fontSize: '0.78rem', fontWeight: 600, color: 'rgba(240,230,216,0.88)' }}>
                          {pin.label}
                        </span>
                        <span style={{
                          fontFamily: T.mono, fontSize: '0.54rem', textTransform: 'uppercase',
                          background: pill.bg, border: `1px solid ${pill.border}`, color: pill.color,
                          borderRadius: 4, padding: '1px 5px',
                        }}>
                          {pin.type}
                        </span>
                      </div>
                      <div style={{
                        fontFamily: T.sans, fontSize: '0.67rem', color: 'rgba(200,195,185,0.50)',
                        lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box',
                        WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
                      }}>
                        {pin.desc}
                      </div>
                      {hoveredRow === i && (
                        <button
                          onClick={() => setActivePin(pin)}
                          style={{
                            marginTop: 6, background: 'none', border: 'none', padding: 0,
                            fontFamily: T.sans, fontSize: '0.70rem', fontWeight: 600,
                            color: '#F97316', cursor: 'pointer',
                          }}
                        >
                          Explore ›
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detail panel */}
          <div style={{
            width: activePin ? 360 : 0,
            overflow: 'hidden',
            flexShrink: 0,
            borderLeft: activePin ? '1px solid rgba(249,115,22,0.15)' : 'none',
            transition: 'width 0.28s cubic-bezier(0.4,0,0.2,1)',
            display: 'flex', flexDirection: 'column',
          }}>
            {activePin && (
              <div style={{ width: 360, display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Panel header */}
                <div style={{
                  padding: '12px 14px 10px',
                  borderBottom: '1px solid rgba(249,115,22,0.10)',
                  flexShrink: 0,
                }}>
                  <button
                    onClick={() => setActivePin(null)}
                    style={{
                      background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                      fontFamily: T.sans, fontSize: '0.70rem', color: 'rgba(240,230,216,0.45)',
                      display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8,
                    }}
                  >
                    ← Back
                  </button>
                  <div style={{ fontFamily: T.sans, fontSize: '0.88rem', fontWeight: 600, color: 'rgba(240,230,216,0.92)', lineHeight: 1.3 }}>
                    {activePin.label}
                  </div>
                </div>

                {/* Panel body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
                  <DetailSection title="What happened">
                    {activePin.desc}
                  </DetailSection>
                  <DetailSection title="Background">
                    {`${activePin.type} activity in the ${activePin.label} region. This signal is being tracked across multiple international news sources.`}
                  </DetailSection>
                  <DetailSection title="Key facts">
                    <div style={{ fontFamily: T.sans, fontSize: '0.72rem', color: 'rgba(200,195,185,0.70)', lineHeight: 1.5 }}>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                        <span style={{ color: 'rgba(200,195,185,0.40)', minWidth: 70 }}>Region</span>
                        <span>{activePin.label}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <span style={{ color: 'rgba(200,195,185,0.40)', minWidth: 70 }}>Category</span>
                        <span>{activePin.type}</span>
                      </div>
                    </div>
                  </DetailSection>
                  <DetailSection title="Sources reporting">
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {['Reuters', 'AP News', 'BBC', 'Al Jazeera'].map(s => (
                        <span key={s} style={{
                          fontFamily: T.mono, fontSize: '0.62rem', color: 'rgba(200,195,185,0.55)',
                          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 5, padding: '2px 7px',
                        }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </DetailSection>
                </div>

                {/* Panel footer */}
                <div style={{
                  padding: '12px 14px',
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex', gap: 8, flexShrink: 0,
                }}>
                  <button style={{
                    flex: 1, background: '#F97316', border: 'none', borderRadius: 10,
                    color: '#fff', fontFamily: T.sans, fontSize: '0.74rem', fontWeight: 600,
                    padding: '9px 0', cursor: 'pointer',
                  }}>
                    Start Researching
                  </button>
                  <button style={{
                    flex: 1, background: 'none', border: '1px solid rgba(249,115,22,0.35)',
                    borderRadius: 10, color: '#F97316', fontFamily: T.sans, fontSize: '0.74rem',
                    fontWeight: 500, padding: '9px 0', cursor: 'pointer',
                  }}>
                    Open in Notes
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

/* ── Home prompt bar ─────────────────────────────────────────────────────── */
function HomePromptBar({ onSearch }) {
  const navigate = useNavigate();
  const readCurrentAnalysisProfile = () => {
    try {
      const profileId = localStorage.getItem('quarry_analysis_profile') || 'careful_analysis';
      const profile = ANALYSIS_PROFILES.find((p) => p.id === profileId) || ANALYSIS_PROFILES[1];
      return { id: profile.id, model: profile.model };
    } catch {
      return { id: 'careful_analysis', model: 'openai/gpt-4o' };
    }
  };

  const parsePromptIntent = (rawMessage) => {
    const text = (rawMessage || '').trim();
    const searchMatch = text.match(/^\[Search:\s*([\s\S]+)\]$/i);
    if (searchMatch) return { mode: 'search', text: searchMatch[1].trim() };
    const thinkMatch = text.match(/^\[Think:\s*([\s\S]+)\]$/i);
    if (thinkMatch) return { mode: 'think', text: thinkMatch[1].trim() };
    const canvasMatch = text.match(/^\[Canvas:\s*([\s\S]+)\]$/i);
    if (canvasMatch) return { mode: 'canvas', text: canvasMatch[1].trim() };
    return { mode: 'search', text };
  };

  const handleSend = (message, files = []) => {
    const parsed = parsePromptIntent(message);
    const cleaned = parsed.text || '';
    const fallback = files.length > 0 ? `analyze image context: ${files[0]?.name || 'attachment'}` : '';
    const text = (cleaned || fallback).trim();
    if (!text) return;

    const profile = readCurrentAnalysisProfile();
    const nextParams = new URLSearchParams({
      q: text,
      model: profile.model,
      ap: profile.id,
    });

    if (parsed.mode === 'think') {
      nextParams.set('d', 'true');
      navigate(`/explore?${nextParams.toString()}`);
      return;
    }

    if (parsed.mode === 'canvas') {
      sessionStorage.setItem('quarry_write_session', JSON.stringify({
        query: text,
        content: `# ${text}\n\n`,
        mode: 'canvas_prompt',
      }));
      navigate('/notes');
      return;
    }

    if (onSearch) {
      onSearch(text, { deep: false, model: profile.model, profileId: profile.id });
    } else {
      navigate(`/explore?${nextParams.toString()}`);
    }
  };

  return (
    <div style={{ width: '100%' }}>
      <BorderGlow
        className="w-full"
        edgeSensitivity={27}
        glowColor="40 80 80"
        backgroundColor="#120F17"
        borderRadius={28}
        glowRadius={40}
        glowIntensity={1.0}
        coneSpread={25}
        animated={false}
        colors={['#c084fc', '#f472b6', '#38bdf8']}
      >
        <div style={{ padding: '8px 10px', width: '100%', boxSizing: 'border-box' }}>
          <PromptInputBox
            onSend={handleSend}
            placeholder="Ask to drill into a signal or start a new investigation…"
            className="!rounded-[26px] !border-0 !bg-transparent !shadow-none"
          />
        </div>
      </BorderGlow>
    </div>
  );
}

/* ── Logged-in homepage ──────────────────────────────────────────────────── */
function LoggedInHome({ user }) {
  const navigate = useNavigate();
  const [showDailyTopics, setShowDailyTopics] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const { notes, createNote, fetchSuggestions } = useNotes();

  const handleCreateNote = useCallback(async () => {
    return createNote({
      title: 'Untitled note',
      body: '',
      topic: user?.profile?.focus_area || user?.profile?.beat || user?.profile?.topics_of_focus?.[0] || 'General',
    });
  }, [createNote, user]);

  const handleSearch = useCallback((text, opts = {}) => {
    const params = new URLSearchParams();
    params.set('q', text);
    if (opts.model) params.set('model', opts.model);
    if (opts.profileId) params.set('ap', opts.profileId);
    if (opts.deep) params.set('d', 'true');
    navigate(`/explore?${params.toString()}`);
  }, [navigate]);

  return (
    <>
      {showDailyTopics && (
        <DailyTopicsModal onClose={() => setShowDailyTopics(false)} />
      )}
      <NotesModal
        open={showNotesModal}
        onClose={() => setShowNotesModal(false)}
        notes={notes}
        workspaceLabel={user?.profile?.focus_area || user?.profile?.beat || user?.profile?.topics_of_focus?.[0] || ''}
        onCreateNote={handleCreateNote}
        onAskSuggestions={fetchSuggestions}
      />

      {/* Intelligence grid */}
      <IntelligenceGrid
        onOpenDailyTopics={() => setShowDailyTopics(true)}
        onOpenNotes={() => setShowNotesModal(true)}
        onCreateNote={handleCreateNote}
        notes={notes}
        profile={user?.profile || {}}
        userId={user?.id || user?.email || 'anon'}
        onSearch={handleSearch}
        userName={user?.name || user?.email || ''}
      />
    </>
  );
}

/* ── Main export ─────────────────────────────────────────────────────────── */
export default function HomePage({ onSearch }) {
  const [query,  setQuery]  = useState('');
  const [isDeep, setIsDeep] = useState(false);
  const [dark] = useDarkMode();
  const [selectedProfileId, setSelectedProfileId] = useState(() => {
    try {
      const savedProfile = localStorage.getItem('quarry_analysis_profile');
      if (savedProfile) return savedProfile;
      const legacyModel = localStorage.getItem('quarry_selected_model') || 'openai/gpt-4o';
      return profileIdFromModel(legacyModel);
    } catch {
      return 'careful_analysis';
    }
  });
  const { user, loading } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    try {
      const profile = ANALYSIS_PROFILES.find((p) => p.id === selectedProfileId) || ANALYSIS_PROFILES[1];
      localStorage.setItem('quarry_analysis_profile', profile.id);
      localStorage.setItem('quarry_selected_model', profile.model);
    } catch {}
  }, [selectedProfileId]);

  useEffect(() => {
    if (user && user.profile && user.profile.onboarded === false) {
      setShowOnboarding(true);
    }
  }, [user]);

  const handleSubmit = useCallback(() => {
    if (!query.trim()) return;
    incrementBeatActivity(query.trim());
    const profile = ANALYSIS_PROFILES.find((p) => p.id === selectedProfileId) || ANALYSIS_PROFILES[1];
    if (onSearch) onSearch(query.trim(), isDeep, profile.model, profile.id);
  }, [query, isDeep, selectedProfileId, onSearch]);

  // While auth is resolving, show nothing to avoid flash
  if (loading) return <div style={{ minHeight: '100vh', background: T.bg }} />;

  return (
    <div style={{
      minHeight: '100vh', fontFamily: T.sans, background: T.bg,
      backgroundImage: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(249,115,22,0.055) 0%, transparent 70%)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background animation layer */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          opacity: dark ? 0.22 : 0.18,
          mixBlendMode: dark ? 'screen' : 'soft-light',
        }}
      >
        <Waves
          className="h-full w-full"
          backgroundColor="transparent"
          strokeColor={dark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.12)'}
          gradientColors={
            dark
              ? ['rgba(255,255,255,0.14)', 'rgba(249,115,22,0.16)']
              : ['rgba(255,255,255,0.16)', 'rgba(249,115,22,0.14)']
          }
          pointerSize={0.22}
        />
      </div>

      {/* Foreground content */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {showOnboarding && <OnboardingModal onDone={() => setShowOnboarding(false)} />}

        {user ? (
          <LoggedInHome user={user} />
        ) : (
          <LoggedOutHome
            query={query} setQuery={setQuery}
            isDeep={isDeep} setIsDeep={setIsDeep}
            selectedProfileId={selectedProfileId} setSelectedProfileId={setSelectedProfileId}          onSubmit={handleSubmit}
          />
        )}
      </div>
    </div>
  );
}
