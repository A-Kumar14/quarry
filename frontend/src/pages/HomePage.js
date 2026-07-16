import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Zap, TrendingUp, RefreshCw } from 'lucide-react';
import { incrementBeatActivity } from '../utils/beats';
import { useDarkMode } from '../DarkModeContext';
import { useAuth } from '../contexts/AuthContext';
import OnboardingModal from '../components/OnboardingModal';
import GlassCard from '../components/GlassCard';
import HomeSearchBar from '../components/HomeSearchBar';
import WatchlistGrid from '../components/WatchlistGrid';
import { useTrendingNews, FALLBACK_SUGGESTIONS } from '../hooks/useTrendingNews';
import { getSourceProfile, TIER_COLOR } from '../utils/sourceProfile';
import { Waves } from '../components/ui/wave-background';

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





/* ── Inline globe map (cobe) ────────────────────────────────────────────── */



/* ── Home prompt bar ─────────────────────────────────────────────────────── */

/* ── Logged-in homepage — newspaper desk ─────────────────────────────────── */

function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function trendingDot(profile) {
  if (!profile) return TIER_COLOR[2];
  const stateAffiliated = profile.state_affiliation && profile.state_affiliation !== false && profile.state_affiliation !== null;
  if (stateAffiliated) return TIER_COLOR[3];
  return TIER_COLOR[profile.credibility_tier] ?? TIER_COLOR[2];
}

function TrendingLegend() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '9px 8px 0' }}>
      {[
        [TIER_COLOR[1], 'independent'],
        [TIER_COLOR[2], 'mixed / state-funded'],
        [TIER_COLOR[3], 'state-affiliated'],
      ].map(([color, label]) => (
        <span key={label} style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontFamily: T.mono, fontSize: '0.53rem', color: T.fgSec,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
          {label}
        </span>
      ))}
    </div>
  );
}

function FeaturedCard({ article, profile, onResearch }) {
  const dot = trendingDot(profile);
  const outlet = article.source?.name || domainOf(article.url) || 'Source';
  const tier = profile?.credibility_tier;
  const age = article.publishedAt ? ago(Date.parse(article.publishedAt)) : '';
  const stripe = 'repeating-linear-gradient(45deg, rgba(175,150,105,0.10), rgba(175,150,105,0.10) 8px, rgba(175,150,105,0.18) 8px, rgba(175,150,105,0.18) 16px)';

  return (
    <GlassCard
      onClick={onResearch}
      style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
    >
      {/* Lead image — og:image with striped placeholder */}
      <div style={{ height: 150, background: stripe, position: 'relative', overflow: 'hidden' }}>
        {article.image && (
          <img
            src={article.image}
            alt=""
            onError={e => { e.target.style.display = 'none'; }}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}
      </div>

      <div style={{ padding: '14px 18px 16px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flexShrink: 0 }} />
          <span style={{
            fontFamily: T.mono, fontSize: '0.59rem', fontWeight: 600, color: T.accent,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {outlet}{tier ? ` · Tier ${tier}` : ''}
          </span>
          {age && (
            <span style={{ fontFamily: T.mono, fontSize: '0.59rem', color: T.fgDim, marginLeft: 'auto', flexShrink: 0 }}>
              {age}
            </span>
          )}
        </div>

        <div style={{
          fontFamily: T.serif, fontSize: '1.19rem', fontWeight: 600,
          color: T.fg, lineHeight: 1.3, letterSpacing: '-0.01em',
        }}>
          {article.title}
        </div>

        {article.description && (
          <div style={{
            fontFamily: T.sans, fontSize: '0.78rem', fontWeight: 300,
            color: T.fgSec, lineHeight: 1.6,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {article.description}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
          <span style={{ fontFamily: T.sans, fontSize: '0.72rem', fontWeight: 600, color: T.accent }}>
            Research this →
          </span>
        </div>
      </div>
    </GlassCard>
  );
}

function LoggedInHome({ user }) {
  const navigate = useNavigate();
  const [dark] = useDarkMode();
  const [query, setQuery] = useState('');
  const [isDeep, setIsDeep] = useState(false);
  const { articles, trending, spinning, refetch } = useTrendingNews();
  const [profiles, setProfiles] = useState({});

  // Hydrate source profiles for provenance dots as articles arrive
  useEffect(() => {
    let cancelled = false;
    (articles || []).forEach(a => {
      const link = a.url || a.source?.url;
      const domain = domainOf(link || '');
      if (!domain) return;
      getSourceProfile(link).then(p => {
        if (cancelled || !p) return;
        setProfiles(prev => (prev[domain] ? prev : { ...prev, [domain]: p }));
      });
    });
    return () => { cancelled = true; };
  }, [articles]);

  const runSearch = useCallback((text, deep = isDeep) => {
    const t = (text || '').trim();
    if (!t) return;
    incrementBeatActivity(t);
    let profile = ANALYSIS_PROFILES[1];
    try {
      const id = localStorage.getItem('quarry_analysis_profile') || 'careful_analysis';
      profile = ANALYSIS_PROFILES.find(p => p.id === id) || ANALYSIS_PROFILES[1];
    } catch {}
    const params = new URLSearchParams({ q: t, model: profile.model, ap: profile.id });
    if (deep) params.set('d', 'true');
    navigate(`/explore?${params.toString()}`);
  }, [isDeep, navigate]);

  const featured = articles[0] || null;
  const rows = articles.slice(0, 6);
  const chips = (trending ? articles : FALLBACK_SUGGESTIONS).slice(trending ? 1 : 0, trending ? 5 : 4);
  const monoLabel = {
    fontFamily: T.sans, fontSize: '0.56rem', fontWeight: 500,
    color: T.fgDim, letterSpacing: '0.10em', textTransform: 'uppercase',
  };

  return (
    <div style={{
      maxWidth: 1120, margin: '0 auto', padding: '96px 24px 64px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22,
      boxSizing: 'border-box',
    }}>

      {/* ── Masthead ── */}
      <div style={{ width: '100%', maxWidth: 660, textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--fg-primary)', opacity: 0.12 }} />
          <span style={monoLabel}>AI Research Engine</span>
          <div style={{ flex: 1, height: 1, background: 'var(--fg-primary)', opacity: 0.12 }} />
        </div>
        <div style={{
          fontFamily: T.serif, fontSize: '2.125rem', fontWeight: 600,
          color: T.fg, letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 9,
        }}>
          Quarry
        </div>
        <div style={{ height: 1, background: 'var(--fg-primary)', opacity: 0.12, marginBottom: 9 }} />
        <div style={{ fontFamily: T.sans, fontSize: '0.82rem', fontStyle: 'italic', color: T.fgSec, letterSpacing: '0.02em' }}>
          Search the web. Synthesise sources. Cite with confidence.
        </div>
      </div>

      {/* ── Search surface + suggestion chips ── */}
      <div style={{ width: '100%', maxWidth: 660, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <HomeSearchBar
          query={query} setQuery={setQuery}
          onSubmit={() => runSearch(query)}
          deepMode={isDeep} onToggleDeep={() => setIsDeep(d => !d)}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 7, marginTop: 12 }}>
          {chips.map((c, i) => (
            <button
              key={i}
              onClick={() => runSearch(c.title)}
              style={{
                fontFamily: T.sans, fontSize: '0.72rem', color: T.fgSec,
                padding: '4px 11px', borderRadius: 999,
                background: 'var(--gbtn-bg)', border: '1px solid var(--border)',
                cursor: 'pointer', transition: 'all 0.14s',
                maxWidth: 280, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = T.accent; e.currentTarget.style.borderColor = 'rgba(249,115,22,0.3)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = ''; e.currentTarget.style.borderColor = ''; }}
            >
              {c.title}
            </button>
          ))}
        </div>
      </div>

      {/* ── Featured | Trending ── */}
      <div style={{
        width: '100%', maxWidth: 960,
        display: 'grid', gridTemplateColumns: 'minmax(0,1.15fr) 1px minmax(0,1fr)',
        gap: 0, alignItems: 'stretch',
      }}>

        {/* Featured story */}
        <div style={{ paddingRight: 20, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: T.accent }} />
            <span style={monoLabel}>Featured story</span>
          </div>
          {featured ? (
            <FeaturedCard
              article={featured}
              profile={profiles[domainOf(featured.url || '')]}
              onResearch={() => runSearch(featured.title)}
            />
          ) : (
            <GlassCard style={{ flex: 1, minHeight: 260 }} />
          )}
        </div>

        <div style={{ background: dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)' }} />

        {/* Trending panel */}
        <div style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{
              width: 5, height: 5, borderRadius: '50%', background: T.accent,
              animation: trending ? 'trendingPulse 1.4s ease-in-out infinite' : 'none',
            }} />
            <span style={monoLabel}>{trending ? 'Trending' : 'Suggested'}</span>
            <span onClick={refetch} style={{ cursor: 'pointer', opacity: 0.5, display: 'inline-flex', marginLeft: 2 }}>
              <RefreshCw size={10} color="var(--fg-dim)" style={{ animation: spinning ? 'spin 1s linear infinite' : 'none' }} />
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {rows.map((art, i) => {
              const age = art.publishedAt ? ago(Date.parse(art.publishedAt)) : '';
              return (
                <div
                  key={i}
                  onClick={() => runSearch(art.title)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                    padding: '7px 8px', cursor: 'pointer', borderRadius: 8,
                    borderBottom: i < rows.length - 1 ? (dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)') : 'none',
                    transition: 'background 0.14s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.05)' : 'rgba(249,115,22,0.05)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%', flexShrink: 0, marginTop: 3,
                    background: trendingDot(profiles[domainOf(art.url || '')]),
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {art.source?.name && (
                      <div style={{
                        fontFamily: T.sans, fontSize: '0.53rem', fontWeight: 600, color: T.accent,
                        letterSpacing: '0.12em', textTransform: 'uppercase', lineHeight: 1, marginBottom: 3,
                      }}>
                        {art.source.name}
                      </div>
                    )}
                    <div style={{
                      fontFamily: T.sans, fontSize: '0.75rem', fontWeight: 500, color: T.fg, lineHeight: 1.35,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {art.title}
                    </div>
                  </div>
                  {age && (
                    <span style={{ fontFamily: T.mono, fontSize: '0.56rem', color: T.fgDim, flexShrink: 0 }}>
                      {age}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <TrendingLegend />
        </div>
      </div>

      {/* ── Watchlist ── */}
      <div style={{ width: '100%', maxWidth: 960 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <TrendingUp size={11} color={T.accent} strokeWidth={2.4} />
          <span style={monoLabel}>Watchlist</span>
        </div>
        <WatchlistGrid dark={dark} columns={{ xs: 'repeat(3, 1fr)', lg: 'repeat(6, 1fr)' }} />
      </div>

      <style>{`
        @keyframes trendingPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.75)} }
        @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
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
