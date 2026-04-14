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
    const authToken = localStorage.getItem('quarry_auth_token') || sessionStorage.getItem('quarry_auth_token') || '';
    fetch(url, {
      headers: {
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
    })
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

    const authToken = localStorage.getItem('quarry_auth_token') || sessionStorage.getItem('quarry_auth_token') || '';
    setLoading(true);
    fetch(`${API}/explore/daily-digest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
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

  const bg        = dark ? 'rgba(20,14,8,0.72)' : 'rgba(255,255,255,0.52)';
  const border    = dark ? 'rgba(249,115,22,0.22)' : 'rgba(249,115,22,0.18)';
  const shimmerBg = dark ? 'rgba(249,115,22,0.07)' : 'rgba(249,115,22,0.05)';
  const topics = (digest?.topics || []).slice(0, 5);
  const fallbackTopics = (profile?.topics_of_focus || []).slice(0, 5).map(label => ({ label, category: 'Focus' }));
  const displayTopics = topics.length > 0
    ? topics.map(t => ({ label: t.headline || t.summary || 'Untitled topic', category: t.beat || t.urgency || 'Topic' }))
    : fallbackTopics;
  const scopedCategory = String(profile?.focus_area || profile?.beat || '').trim().toLowerCase();

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
        <div style={{ fontFamily: T.serif, fontSize: '0.92rem', fontWeight: 600, color: T.fg }}>
          Today's topics
        </div>
        {/* Live chip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{
            width: 4, height: 4, borderRadius: '50%', background: dark ? 'rgba(249,115,22,0.65)' : 'rgba(180,83,9,0.6)',
            display: 'inline-block', flexShrink: 0,
            animation: 'pinPulse 2s ease-in-out infinite',
          }} />
          <span style={{ fontFamily: T.mono, fontSize: '0.52rem', color: T.fgDim, letterSpacing: '0.04em', textTransform: 'uppercase' }}>live</span>
        </div>
      </div>

      {/* Topic list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {displayTopics.length === 0 && !loading && (
          <div style={{ padding: '12px 14px', fontFamily: T.sans, fontSize: '0.76rem', color: T.fgDim }}>
            No personalized topics yet. Add focus areas in your profile to tailor this digest.
          </div>
        )}
        {loading && displayTopics.length === 0 && (
          <div style={{ padding: '12px 14px', fontFamily: T.sans, fontSize: '0.76rem', color: T.fgDim }}>
            Loading your digest...
          </div>
        )}
        {displayTopics.map((topic, i) => {
          const color = CATEGORY_COLOR[topic.category] || T.accent;
          const topicCategory = String(topic.category || '').trim().toLowerCase();
          const showCategoryBadge = topicCategory && topicCategory !== 'focus' && topicCategory !== scopedCategory;
          return (
            <div
              key={i}
              style={{
                padding: '8px 14px',
                borderBottom: i < displayTopics.length - 1
                  ? `1px solid ${dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'}` : 'none',
                display: 'flex', alignItems: 'center', gap: 10,
                transition: 'background 0.12s',
                background: hovered ? (dark ? 'rgba(255,255,255,0.015)' : 'rgba(249,115,22,0.02)') : 'transparent',
              }}
            >
              {/* Category dot */}
              <span style={{
                width: 5, height: 5, borderRadius: '50%',
                background: color, flexShrink: 0,
                opacity: 0.85,
              }} />
              {/* Topic text */}
              <span style={{
                fontFamily: T.sans, fontSize: '0.76rem', fontWeight: 500,
                color: T.fg, lineHeight: 1.35, flex: 1,
              }}>
                {topic.label}
              </span>
              {showCategoryBadge && (
                <span style={{
                  fontFamily: T.mono, fontSize: '0.50rem', fontWeight: 600,
                  color: color, background: `${color}12`,
                  border: `1px solid ${color}24`,
                  padding: '1px 6px', borderRadius: 4, flexShrink: 0,
                }}>
                  {topic.category}
                </span>
              )}
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
      <div style={{ padding: '10px 14px 8px', borderBottom: `1px solid var(--border)`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: T.serif, fontSize: '0.92rem', fontWeight: 600, color: T.fg }}>
          Your notes
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onNewNote?.(); }}
          style={{
            border: 'none', background: 'none', color: T.accent, cursor: 'pointer',
            fontFamily: T.sans, fontSize: '0.72rem', fontWeight: 600, padding: 0,
          }}
        >
          + New note
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
            <div key={note.id} style={{ borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', padding: '8px 10px' }}>
              <div style={{ fontFamily: T.sans, fontSize: '0.76rem', color: T.fg, fontWeight: 600, marginBottom: 4 }}>
                {note.title || 'Untitled note'}
              </div>
              <div style={{ fontFamily: T.mono, fontSize: '0.58rem', color: T.fgDim }}>
                {note.topic?.[0] || 'General'} · updated {formatAgoFromISO(note.updatedAt)}
              </div>
            </div>
          ))}

          <button
            onClick={(e) => { e.stopPropagation(); onOpen?.(); }}
            style={{
              alignSelf: 'flex-start', border: 'none', background: 'none', padding: 0,
              color: T.accent, cursor: 'pointer', fontFamily: T.sans, fontSize: '0.72rem', fontWeight: 600,
            }}
          >
            View all notes →
          </button>
        </div>
      )}
    </GlassCard>
  );
}

function IntelligenceGrid({ onOpenDailyTopics, onOpenNotes, onCreateNote, notes, profile, userId, onSearch }) {
  const [beats, setBeats] = useState([]);
  const [showGlobeModal, setShowGlobeModal] = useState(false);
  const [globeCardHeight, setGlobeCardHeight] = useState(332);
  const globeCardRef = useRef(null);
  const globeTopicHint = profile?.focus_area || profile?.beat || profile?.topics_of_focus?.[0] || beats[0]?.name || '';
  const globePins = useGlobePins(globeTopicHint);

  useEffect(() => { setBeats(getBeats()); }, []);
  useEffect(() => {
    if (!globeCardRef.current) return;
    const updateHeight = () => {
      const h = globeCardRef.current?.offsetHeight || 332;
      if (h > 0) setGlobeCardHeight(h);
    };
    updateHeight();
    const ro = new ResizeObserver(() => updateHeight());
    ro.observe(globeCardRef.current);
    window.addEventListener('resize', updateHeight, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, [globePins.length]);

  return (
    <div style={{
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 'calc(100vh - 56px)',
      padding: '12px 24px',
      boxSizing: 'border-box',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 1120,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        margin: '0 auto',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: 12,
          alignItems: 'stretch',
          width: '100%',
        }}>
          <div ref={globeCardRef} style={{ minWidth: 0 }}>
            <InlineGlobeMap pins={globePins} onOpenMap={() => setShowGlobeModal(true)} />
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateRows: `${Math.floor((globeCardHeight - 12) / 2)}px ${Math.ceil((globeCardHeight - 12) / 2)}px`,
              gap: 12,
              minHeight: 0,
              height: globeCardHeight,
            }}
          >
            <div style={{ minHeight: 0 }}>
              <DailyTopicsCard onOpen={onOpenDailyTopics} profile={profile} userId={userId} />
            </div>
            <div style={{ minHeight: 0 }}>
              <HomeNotesCard
                notes={notes}
                onOpen={onOpenNotes}
                onNewNote={onCreateNote}
              />
            </div>
          </div>
        </div>

        <div style={{ paddingTop: 4, width: '100%' }}>
          <HomePromptBar onSearch={onSearch} />
        </div>
      </div>
      <GlobeMapModal open={showGlobeModal} onClose={() => setShowGlobeModal(false)} pins={globePins} />
    </div>
  );
}

/* ── Inline globe map (cobe) ────────────────────────────────────────────── */
function InlineGlobeMap({ pins = WORLD_PINS, onOpenMap, showSignalsList = false }) {
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
  const activePin = pins[Math.max(0, Math.min(activePinIndex, pins.length - 1))];

  return (
    <GlassCard
      onClick={onOpenMap}
      style={{
        borderRadius: 14,
        overflow: 'hidden',
        display: 'flex',
        minHeight: showSignalsList ? 520 : 332,
        cursor: onOpenMap ? 'pointer' : 'default',
      }}
    >

      {/* Globe */}
      <div style={{ flex: showSignalsList ? 0.95 : 1, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: showSignalsList ? '14px 12px' : '10px 8px' }}>
        <div style={{ width: '100%', maxWidth: showSignalsList ? 560 : 360, aspectRatio: '1 / 1', position: 'relative' }}>
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
        {!showSignalsList && (
          <div style={{
            position: 'absolute',
            left: 12,
            right: 12,
            bottom: 10,
            borderRadius: 9,
            border: `1px solid ${dark ? 'rgba(249,115,22,0.28)' : 'rgba(249,115,22,0.24)'}`,
            background: dark ? 'rgba(12,12,14,0.72)' : 'rgba(255,255,255,0.80)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            padding: '8px 10px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontFamily: T.serif, fontSize: '0.86rem', fontWeight: 600, color: 'var(--fg-primary)' }}>
                {activePin?.label || 'Global signal'}
              </span>
              <span style={{ fontFamily: T.mono, fontSize: '0.56rem', color: 'var(--fg-dim)', textTransform: 'uppercase' }}>
                {activePin?.type || 'Signal'}
              </span>
            </div>
            <div style={{
              marginTop: 3,
              fontFamily: T.sans,
              fontSize: '0.67rem',
              color: fgDim,
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 1,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>
              {activePin?.desc || 'Click to open full globe map'}
            </div>
          </div>
        )}
      </div>

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

function GlobeMapModal({ open, onClose, pins }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        background: 'rgba(0,0,0,0.62)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(1080px, 96vw)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button
            onClick={onClose}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 999,
              background: 'var(--bg-secondary)',
              color: 'var(--fg-secondary)',
              fontFamily: T.sans,
              fontSize: '0.72rem',
              padding: '5px 11px',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
        <InlineGlobeMap pins={pins} showSignalsList />
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
      navigate(`/search?${nextParams.toString()}`);
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
      navigate(`/search?${nextParams.toString()}`);
    }
  };

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, padding: '0 2px' }}>
        <span style={{ fontFamily: T.mono, fontSize: '0.58rem', color: T.fgDim, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
          Investigation prompt
        </span>
        <span style={{ fontFamily: T.sans, fontSize: '0.66rem', color: T.fgDim }}>
          Search updates, deep dive, or open notes
        </span>
      </div>
      <PromptInputBox
        onSend={handleSend}
        placeholder="Ask to drill into a signal or start a new investigation…"
      />
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
    navigate(`/search?${params.toString()}`);
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
      />
    </>
  );
}

/* ── Main export ─────────────────────────────────────────────────────────── */
export default function HomePage({ onSearch }) {
  const [query,  setQuery]  = useState('');
  const [isDeep, setIsDeep] = useState(false);
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
    }}>
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
  );
}
