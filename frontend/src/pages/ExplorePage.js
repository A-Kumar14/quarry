import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Box, Typography, Skeleton, Tooltip, CircularProgress } from '@mui/material';
import { Search, BookmarkPlus, ExternalLink, Zap, CornerDownRight, ArrowUpRight, TrendingUp, RefreshCw, Copy, Check, Edit3 } from 'lucide-react';
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { motion, AnimatePresence } from 'framer-motion';
import { RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';
import GlassCard from '../components/GlassCard';
import { saveContestedClaims } from './HomePage';
import PerspectivesTab from '../components/PerspectivesTab';
import ContradictionsTab from '../components/ContradictionsTab';
import CitationsPanel from '../components/CitationsPanel';
import GapsTab from '../components/GapsTab';
import QuoteBankTab from '../components/QuoteBankTab';
import { getSourceQuality, QUALITY_COLOR } from '../utils/sourceQuality';
import { TIER_COLOR } from '../utils/sourceProfile';
import Toast from '../components/Toast';
import FinanceCard from '../components/FinanceCard';
import { useSettings, useTopOffset } from '../SettingsContext';
import { useDarkMode } from '../DarkModeContext';
import NavControls from '../components/NavControls';
import KnowledgeGraph from '../components/KnowledgeGraph';
import DiagramCard from '../components/DiagramCard';

// ── Saved searches ────────────────────────────────────────────────────────────
function getSaved() {
  try { return JSON.parse(localStorage.getItem('quarry_saved') || '[]'); }
  catch { return []; }
}
function addSaved(query, excerpt, fullAnswer) {
  const items = getSaved();
  const entry = {
    id: Date.now().toString(),
    query,
    excerpt: excerpt.slice(0, 200),
    answer: (fullAnswer || '').slice(0, 8000),
    savedAt: Date.now(),
  };
  localStorage.setItem('quarry_saved', JSON.stringify([...items.filter(i => i.query !== query), entry]));
}

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const MAX_FOLLOW_UPS = 5;

// ── Source database hook ───────────────────────────────────────────────────────
function useSources() {
  const [sourceMap, setSourceMap] = useState({});
  useEffect(() => {
    fetch(`${API}/api/sources`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        const list = data.sources || data || [];
        const map = {};
        list.forEach(s => { if (s.domain) map[s.domain] = s; });
        setSourceMap(map);
      })
      .catch(() => {});
  }, []);
  return sourceMap;
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const ANSWER_BODY_STYLES = {
  '& p':              { fontFamily: 'var(--font-family)', fontWeight: 300, fontSize: '0.93rem', lineHeight: 1.85, color: 'var(--fg-primary)', my: 0.75 },
  '& h1, & h2, & h3': { fontFamily: 'var(--font-serif)', fontWeight: 600, color: 'var(--fg-primary)', mt: 2, mb: 0.5 },
  '& h1':             { fontSize: '1.05rem' },
  '& h2':             { fontSize: '1.05rem', mt: 3, mb: 1, pb: 0.5, borderBottom: '1px solid var(--border)' },
  '& h3':             { fontSize: '0.88rem' },
  '& code':           { fontFamily: 'var(--font-mono)', fontSize: '0.82rem', bgcolor: 'rgba(221,213,192,0.5)', px: '5px', py: '1px', borderRadius: '4px', border: '1px solid var(--border)' },
  '& pre':            { bgcolor: 'rgba(229,221,208,0.6)', border: '1px solid var(--border)', borderRadius: '8px', p: 1.5, overflowX: 'auto', '& code': { border: 'none', bgcolor: 'transparent' } },
  '& ul, & ol':       { pl: 2.5, my: 0.5 },
  '& li':             { color: 'var(--fg-primary)', fontWeight: 300, fontSize: '0.93rem', lineHeight: 1.80, mb: 0.25 },
  '& strong':         { color: 'var(--fg-primary)', fontWeight: 600 },
  '& em':             { color: 'var(--fg-secondary)' },
  '& blockquote':     { borderLeft: '3px solid var(--accent)', pl: 1.5, ml: 0, color: 'var(--fg-secondary)', fontStyle: 'italic' },
  '& a':              { color: 'var(--accent)', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } },
  '& table':          { borderCollapse: 'collapse', width: '100%', my: 1 },
  '& th, & td':       { border: '1px solid var(--border)', p: '6px 12px', fontSize: '0.83rem', color: 'var(--fg-primary)' },
  '& th':             { bgcolor: 'rgba(229,221,208,0.5)', fontWeight: 500 },
  '& hr':             { border: 'none', borderTop: '1px solid var(--border)', my: 1.5 },
};


const GLASS_BTN = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
  background: 'rgba(255,250,232,0.50)',
  border: '1px solid var(--border)',
  fontFamily: 'var(--font-family)', fontSize: 13, fontWeight: 500,
  letterSpacing: '0.01em', color: 'var(--fg-secondary)', whiteSpace: 'nowrap',
  transition: 'background 0.15s ease, color 0.15s ease', outline: 'none',
  boxShadow: 'none',
};

const GLASS_BTN_ACCENT = {
  ...GLASS_BTN,
  background: 'var(--accent)',
  borderColor: 'var(--accent)',
  color: '#fff',
  boxShadow: '0 2px 8px rgba(249,115,22,0.25)',
};

const PAGE_BG = {
  background: 'transparent',
  minHeight: '100vh',
};

// ── Research completeness score ───────────────────────────────────────────────

function calcCompletenessScore(sources, claims, contradictions) {
  // Source diversity (0–30 pts)
  const srcScore = Math.min(sources.length / 5, 1) * 30;

  // Verification rate (0–35 pts)
  const verified = claims.filter(c => ['verified', 'corroborated'].includes(c.status)).length;
  const verifyRate = claims.length > 0 ? verified / claims.length : 0;
  const verifyScore = verifyRate * 35;

  // Claim extraction (0–20 pts)
  const claimScore = Math.min(claims.length / 8, 1) * 20;

  // Contradiction penalty (up to –15 pts)
  const contested = claims.filter(c => c.status === 'contested').length;
  const contradictionPenalty = Math.min(contested * 5, 15);

  return Math.round(Math.max(0, Math.min(100, srcScore + verifyScore + claimScore - contradictionPenalty)));
}

// ── Completeness radial gauge ─────────────────────────────────────────────────

function CompletenessGauge({ score }) {
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444';
  const data = [{ value: score, fill: color }];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, marginTop: 8 }}>
      <div style={{ position: 'relative', width: 64, height: 64 }}>
        <RadialBarChart
          width={64} height={64}
          cx={32} cy={32}
          innerRadius={22} outerRadius={30}
          startAngle={210} endAngle={-30}
          data={data}
          style={{ pointerEvents: 'none' }}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar
            dataKey="value"
            cornerRadius={4}
            background={{ fill: 'var(--border)' }}
          />
        </RadialBarChart>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-mono)', fontSize: '0.70rem', fontWeight: 700,
          color,
        }}>
          {score}
        </div>
      </div>
      <div style={{
        fontFamily: 'var(--font-family)', fontSize: '0.58rem',
        color: 'var(--fg-dim)', textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>
        completeness
      </div>
    </div>
  );
}

// ── Confidence-gated chip gain estimator ──────────────────────────────────────

function estimateClaimGain(suggestion, claims) {
  if (!claims || claims.length === 0) return 0;
  const weakClaims = claims.filter(c =>
    c.status === 'contested' || c.status === 'single_source' || c.status === 'uncertain'
  );
  if (weakClaims.length === 0) return 0;

  const suggWords = new Set(
    suggestion.toLowerCase().split(/\W+/).filter(w => w.length > 3)
  );
  let matches = 0;
  for (const claim of weakClaims) {
    const claimWords = (claim.claim_text || '').toLowerCase().split(/\W+/);
    if (claimWords.some(w => suggWords.has(w))) matches++;
  }
  return matches;
}

// ── Utility helpers ───────────────────────────────────────────────────────────

function CitationLink({ href, children, sources }) {
  const text = React.Children.toArray(children)
    .map(c => (typeof c === 'string' ? c : ''))
    .join('');
  const isCitation = /^\[?\d+\]?$/.test(text.trim());
  if (isCitation) {
    const num = parseInt(text.replace(/\D/g, ''), 10);
    const src = sources[num - 1];
    return (
      <Tooltip title={src?.url || href || ''} placement="top">
        <Box
          component="a"
          href={src?.url || href || '#'}
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            px: '5px', height: 16, fontSize: '0.65rem', fontWeight: 600,
            fontFamily: 'var(--font-family)', color: 'var(--blue)',
            background: 'rgba(30,58,138,0.06)', borderRadius: '4px', border: '1px solid rgba(30,58,138,0.12)',
            textDecoration: 'none', verticalAlign: 'super',
            lineHeight: 1, mx: '3px',
            transition: 'all 0.15s ease',
            '&:hover': { background: 'rgba(30,58,138,0.12)', transform: 'translateY(-1px)' }
          }}
        >
          {num}
        </Box>
      </Tooltip>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
      {children}
    </a>
  );
}

function extractKeywordChips(answer) {
  const boldTerms = [...new Set(
    [...answer.matchAll(/\*\*([^*]{3,35})\*\*/g)]
      .map(m => m[1].trim())
      .filter(t => !t.includes('\n'))
  )];
  return boldTerms.slice(0, 6);
}

function linkifyCitations(text, sources) {
  return text.replace(/\[(\d+)\]/g, (match, num) => {
    const src = sources[parseInt(num, 10) - 1];
    return src?.url ? `[[${num}]](${src.url})` : match;
  });
}

const QUESTION_STRIP = /^(what (?:is|are|was|were)|who (?:is|are|was|were)|how (?:does|do|is|are|to|can)|why (?:is|are|does|do|did)|when (?:is|are|did|was)|where (?:is|are|was)|which (?:is|are)|tell me (?:about|of)?|explain|describe|find|give me|show me|list (?:(?:the|of) )?)\s+(?:(?:the|a|an) )?/i;

function deriveImageQuery(query, context = '') {
  const stripped = query.trim().replace(QUESTION_STRIP, '').trim();
  if (context) {
    const contextCore = context.replace(QUESTION_STRIP, '').trim().split(' ').slice(0, 4).join(' ');
    return `${contextCore} ${stripped}`.trim().slice(0, 80);
  }
  return stripped.slice(0, 80) || query.trim().slice(0, 80);
}

// ── Inline confidence badge injection ─────────────────────────────────────────

function injectConfidenceBadges(text, claims) {
  if (!claims || claims.length === 0) return text;

  let result = text;

  claims.forEach(claim => {
    if (!claim.claim_text || claim.claim_text.length < 10) return;

    const words = claim.claim_text
      .split(' ')
      .slice(0, 5)
      .join(' ')
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const regex = new RegExp(`(${words}[^.!?]*[.!?])`, 'i');

    const statusMap = {
      verified:     '<span class="conf-v">● verified</span>',
      corroborated: '<span class="conf-c">● corroborated</span>',
      single_source:'<span class="conf-s">● single source</span>',
      uncertain:    '<span class="conf-s">● single source</span>',
      contested:    '<span class="conf-x">● contested</span>',
    };

    const badge = statusMap[claim.status];
    if (!badge) return;

    result = result.replace(regex, `$1 ${badge}`);
  });

  return result;
}

// ── Source card ───────────────────────────────────────────────────────────────

// ── Tier badge helper ──────────────────────────────────────────────────────────
function TierBadge({ tier, stateAffiliated }) {
  if (stateAffiliated) {
    return (
      <span style={{
        fontSize: '0.64rem', fontWeight: 600, padding: '2px 7px', borderRadius: 5,
        background: 'rgba(239,68,68,0.15)', color: '#991B1B',
        border: '0.5px solid rgba(239,68,68,0.3)',
      }}>State-backed</span>
    );
  }
  const styles = {
    1: { bg: 'rgba(16,185,129,0.18)', color: '#065F46', border: 'rgba(16,185,129,0.3)', label: 'Tier 1' },
    2: { bg: 'rgba(245,158,11,0.15)',  color: '#92400E', border: 'rgba(245,158,11,0.3)',  label: 'Tier 2' },
    3: { bg: 'rgba(0,0,0,0.08)',       color: 'var(--fg-secondary)', border: 'var(--glass-border)', label: 'Tier 3' },
  };
  const s = styles[tier];
  if (!s) return null;
  return (
    <span style={{
      fontSize: '0.64rem', fontWeight: 600, padding: '2px 7px', borderRadius: 5,
      background: s.bg, color: s.color,
      border: `0.5px solid ${s.border}`,
    }}>{s.label}</span>
  );
}

// ── Source Intelligence Modal ──────────────────────────────────────────────────
function SaveToProjectDropdown({ source, onClose }) {
  const [docs, setDocs] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [savedStatus, setSavedStatus] = useState(null); // null, 'success', 'exists'

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('quarry_documents') || '[]');
      setDocs(stored);
    } catch { setDocs([]); }
  }, []);

  const handleSave = (doc) => {
    try {
      const allDocs = JSON.parse(localStorage.getItem('quarry_documents') || '[]');
      const idx = allDocs.findIndex(d => d.id === doc.id);
      if (idx > -1) {
        if (!allDocs[idx].preloadedSources) allDocs[idx].preloadedSources = [];
        const exists = allDocs[idx].preloadedSources.find(s => s.url === source.url);
        if (exists) {
          setSavedStatus('exists');
        } else {
          allDocs[idx].preloadedSources.push({
            title: source.title || 'Source article',
            url: source.url,
            outlet_name: source.outlet_name || '',
            snippet: source.snippet || '',
            credibility_tier: source.credibility_tier,
          });
          localStorage.setItem('quarry_documents', JSON.stringify(allDocs));
          setSavedStatus('success');
        }
      }
      setTimeout(() => { setIsOpen(false); setSavedStatus(null); }, 2000);
    } catch (err) {
      console.error("Save to project failed", err);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          fontSize: '0.69rem', fontWeight: 600, color: '#fff',
          background: 'var(--accent)', border: 'none', borderRadius: 7,
          padding: '5px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
        }}
      >
        <BookmarkPlus size={13} /> Add to Project
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0, marginBottom: 8,
          width: 220, background: 'var(--bg-primary)', border: '1px solid var(--border)',
          borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          zIndex: 1100, overflow: 'hidden', padding: 4,
          animation: 'fadeInUp 0.2s ease-out'
        }}>
          {savedStatus === 'success' ? (
            <div style={{ padding: '12px', textAlign: 'center', color: '#10B981', fontSize: '0.78rem' }}>
              Saved to project!
            </div>
          ) : savedStatus === 'exists' ? (
            <div style={{ padding: '12px', textAlign: 'center', color: 'var(--fg-dim)', fontSize: '0.78rem' }}>
              Already in project
            </div>
          ) : (
            <>
              <div style={{ padding: '8px 10px', fontSize: '0.65rem', fontWeight: 700, color: 'var(--fg-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Choose Project
              </div>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {docs.length === 0 ? (
                  <div style={{ padding: '10px', fontSize: '0.75rem', color: 'var(--fg-dim)', fontStyle: 'italic' }}>No projects found</div>
                ) : (
                  docs.map(doc => (
                    <button
                      key={doc.id}
                      onClick={() => handleSave(doc)}
                      style={{
                        width: '100%', textAlign: 'left', padding: '8px 10px',
                        background: 'transparent', border: 'none', borderRadius: 6,
                        color: 'var(--fg-primary)', cursor: 'pointer', fontSize: '0.78rem',
                        transition: 'background 0.1s', display: 'flex', alignItems: 'center', gap: 8
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <Edit3 size={12} color="var(--accent)" />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SourceModal({ source, sourceProfile, claims, onClose, onInsert }) {
  const domain = (() => {
    try { return new URL(source.url).hostname.replace('www.', ''); }
    catch { return source.url || ''; }
  })();

  const outletName = sourceProfile?.outlet_name || source.outlet_name || domain;
  const firstLetter = outletName.charAt(0).toUpperCase();

  // Filter claims attributed to this source
  const matchedClaims = (claims || []).filter(c => {
    const outlets = c.source_outlets || [];
    const domainLower = domain.toLowerCase();
    const nameLower = outletName.toLowerCase();
    return outlets.some(o =>
      o.toLowerCase().includes(domainLower) ||
      domainLower.includes(o.toLowerCase()) ||
      o.toLowerCase().includes(nameLower) ||
      nameLower.includes(o.toLowerCase())
    );
  });

  const corroboratedCount = matchedClaims.filter(c =>
    c.status === 'verified' || c.status === 'corroborated'
  ).length;

  const STATUS_DOT = {
    verified:      '#10B981',
    corroborated:  '#F59E0B',
    single_source: '#9CA3AF',
    contested:     '#EF4444',
  };
  const STATUS_NOTE = {
    verified:      'Corroborated by 3+ sources',
    corroborated:  'Corroborated by 2 sources',
    single_source: 'Single source',
    contested:     'Contested',
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.35)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 480,
          maxWidth: '90vw',
          maxHeight: '80vh',
          overflowY: 'auto',
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
          borderRadius: 16,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          zIndex: 1001,
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 20px 0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
            {/* Outlet icon */}
            <div style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: 'rgba(30,20,10,0.82)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-serif)', fontSize: '1.1rem', fontWeight: 700,
              color: '#fff',
            }}>
              {firstLetter}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 3 }}>
                <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.94rem', fontWeight: 500, color: 'var(--fg-primary)' }}>
                  {outletName}
                </span>
                <TierBadge
                  tier={sourceProfile?.credibility_tier}
                  stateAffiliated={sourceProfile?.state_affiliation && sourceProfile.state_affiliation !== false && sourceProfile.state_affiliation !== null}
                />
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--fg-dim)' }}>
                {domain}
              </div>
            </div>
            {/* Close button */}
            <button
              onClick={onClose}
              style={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(0,0,0,0.10)', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: '1rem', color: 'var(--fg-secondary)',
                lineHeight: 1,
              }}
            >×</button>
          </div>

          {/* Profile grid or unavailable */}
          {sourceProfile ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
              {[
                { label: 'Country',    value: sourceProfile.country || '—' },
                { label: 'Funding',    value: sourceProfile.funding_type || '—' },
                { label: 'Editorial lean', value: sourceProfile.editorial_lean || '—' },
                { label: 'State affiliation', value: (sourceProfile.state_affiliation && sourceProfile.state_affiliation !== false) ? (typeof sourceProfile.state_affiliation === 'string' ? sourceProfile.state_affiliation : 'Yes') : 'None' },
              ].map(({ label, value }) => (
                <div key={label} style={{
                  background: 'var(--glass-bg)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '8px 10px',
                }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', fontWeight: 600, color: 'var(--fg-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
                    {label}
                  </div>
                  <div style={{ fontFamily: 'var(--font-family)', fontSize: '0.78rem', color: 'var(--fg-primary)', fontWeight: 400, textTransform: 'capitalize' }}>
                    {value.replace(/_/g, ' ')}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              padding: '10px 12px', marginBottom: 20,
              background: 'rgba(0,0,0,0.06)', borderRadius: 8,
              fontSize: '0.75rem', color: 'var(--fg-dim)', fontStyle: 'italic',
            }}>
              Source profile unavailable — not in database.
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.25)', margin: '0 20px' }} />

        {/* Claims section */}
        <div style={{ padding: '16px 20px' }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: '0.62rem', fontWeight: 600,
            color: 'var(--fg-dim)', textTransform: 'uppercase', letterSpacing: '0.10em',
            marginBottom: 12,
          }}>
            Claims from this source
          </div>

          {matchedClaims.length === 0 ? (
            <div style={{ fontSize: '0.8rem', color: 'var(--fg-dim)', fontStyle: 'italic', padding: '12px 0' }}>
              No claims attributed to this source.
            </div>
          ) : (
            matchedClaims.map((claim, i) => {
              const status = claim.status || 'single_source';
              const dotColor = STATUS_DOT[status] || '#9CA3AF';
              const noteText = status === 'contested' && claim.note
                ? `Contested — ${claim.note}`
                : STATUS_NOTE[status] || 'Unknown';
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '10px 0',
                    borderBottom: i < matchedClaims.length - 1 ? '0.5px solid rgba(255,255,255,0.25)' : 'none',
                  }}
                >
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: dotColor, flexShrink: 0, marginTop: 5,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-family)', fontSize: '0.78rem', color: 'var(--fg-primary)', lineHeight: 1.45, marginBottom: 3 }}>
                      {claim.claim_text || claim.claim}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--fg-dim)' }}>
                      {noteText}
                    </div>
                  </div>
                  <button
                    onClick={() => onInsert(claim)}
                    style={{
                      flexShrink: 0, fontSize: '0.69rem', fontWeight: 500,
                      color: '#F97316',
                      background: 'rgba(249,115,22,0.12)',
                      border: '0.5px solid rgba(249,115,22,0.45)',
                      borderRadius: 7, padding: '4px 10px',
                      cursor: 'pointer', fontFamily: 'var(--font-family)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Insert
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px',
          borderTop: '0.5px solid rgba(255,255,255,0.25)',
        }}>
          <div style={{ fontFamily: 'var(--font-family)', fontSize: '0.75rem', color: 'var(--fg-secondary)' }}>
            <span style={{ color: '#0A6E3F', fontWeight: 500 }}>{corroboratedCount}</span>
            {' of '}{matchedClaims.length} claims corroborated by other sources
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <SaveToProjectDropdown source={{ ...source, ...sourceProfile }} />
            {source.url && (
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontFamily: 'var(--font-family)', fontSize: '0.75rem',
                  color: 'var(--fg-secondary)', textDecoration: 'none',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                View source
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SourceIntelligencePopup({
  sources,
  claims,
  pipelineTrace,
  isDeepSearch,
  selectedSource,
  onSelectSource,
  onClose,
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 560,
          maxWidth: '92vw',
          maxHeight: '84vh',
          overflowY: 'auto',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          zIndex: 1001,
        }}
      >
        {/* Header */}
        <div style={{ padding: '18px 18px 0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-family)', fontSize: '0.70rem', fontWeight: 700, color: 'var(--fg-dim)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>
                Source Intelligence
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', padding: '6px 10px', borderRadius: 10 }}>
                  <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.82rem', fontWeight: 800, color: 'var(--fg-primary)' }}>{sources.length}</span>
                  <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.62rem', color: 'var(--fg-dim)', marginLeft: 6 }}>sources</span>
                </div>
                <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.25)', padding: '6px 10px', borderRadius: 10 }}>
                  <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.82rem', fontWeight: 800, color: '#22c55e' }}>
                    {pipelineTrace?.claims_verified ?? claims.filter(c => ['verified', 'corroborated'].includes(c.status)).length}
                  </span>
                  <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.62rem', color: 'var(--fg-dim)', marginLeft: 6 }}>verified</span>
                </div>
                <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)', padding: '6px 10px', borderRadius: 10 }}>
                  <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.82rem', fontWeight: 800, color: '#ef4444' }}>
                    {pipelineTrace?.claims_contested ?? claims.filter(c => c.status === 'contested').length}
                  </span>
                  <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.62rem', color: 'var(--fg-dim)', marginLeft: 6 }}>contested</span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                flexShrink: 0,
                background: 'rgba(0,0,0,0.10)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '1rem',
                color: 'var(--fg-secondary)',
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        </div>

        <div style={{ padding: '0 18px 18px' }}>
          {/* Pipeline stats card */}
          {pipelineTrace && (
            <Box
              sx={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '16px 18px',
                mb: 14 / 6, // slightly less spacing than default
              }}
            >
              <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.70rem', fontWeight: 600, color: 'var(--fg-secondary)', mb: 1.25, display: 'block', letterSpacing: '0.04em' }}>
                Research pipeline
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                {[
                  { label: 'sources', value: sources.length, color: null },
                  { label: 'claims', value: pipelineTrace.claims_extracted ?? claims.length, color: null },
                  { label: 'verified', value: pipelineTrace.claims_verified, color: '#22c55e' },
                  { label: 'contested', value: pipelineTrace.claims_contested, color: '#ef4444' },
                ].map(({ label, value, color }) => (
                  <Box key={label}>
                    <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '1.5rem', fontWeight: 700, color: color ?? 'var(--fg-primary)', lineHeight: 1 }}>
                      {value}
                    </Typography>
                    <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.68rem', color: 'var(--fg-dim)', mt: 0.4 }}>
                      {label}
                    </Typography>
                  </Box>
                ))}
              </Box>

              {/* Pass-through mode indicator */}
              {(pipelineTrace.pipeline_mode ?? 'epistemic') === 'pass_through' && (
                <div style={{
                  marginTop: 12,
                  padding: '7px 10px',
                  background: 'rgba(249,115,22,0.08)',
                  borderRadius: 8,
                  fontSize: '0.72rem',
                  color: 'var(--fg-secondary)',
                  lineHeight: 1.45,
                }}>
                  <span style={{ fontWeight: 600, color: 'var(--accent)' }}>Live query</span> — source verification not run.
                </div>
              )}
            </Box>
          )}

          {/* Deep-mode transparency: show which sub-queries were executed */}
          {pipelineTrace?.sub_queries && isDeepSearch && Array.isArray(pipelineTrace.sub_queries) && (
            <div style={{
              marginTop: 10,
              marginBottom: 14,
              padding: '10px 12px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
            }}>
              <div style={{
                fontSize: '0.65rem',
                fontWeight: 500,
                color: 'var(--fg-dim)',
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                marginBottom: 7,
              }}>
                Sub-queries run
              </div>
              {pipelineTrace.sub_queries.map((q, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: '0.72rem',
                    color: 'var(--fg-secondary)',
                    lineHeight: 1.5,
                    paddingLeft: 8,
                    borderLeft: '2px solid rgba(249,115,22,0.3)',
                    marginBottom: 5,
                  }}
                >
                  {q}
                </div>
              ))}
            </div>
          )}

          {/* Sources list */}
          {sources.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {sources.map((src, i) => (
                <SourceCard
                  key={i}
                  src={src}
                  index={i}
                  isSelected={selectedSource === src}
                  onClick={() => onSelectSource(src)}
                />
              ))}
            </Box>
          )}

          {sources.length === 0 && (
            <div style={{ padding: '14px 0', fontSize: '0.8rem', color: 'var(--fg-dim)', fontStyle: 'italic' }}>
              No sources retrieved yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Claim group section ─────────────────────────────────────────────────── */
const CLAIM_GROUPS = [
  { key: 'contested',     label: 'Contested',     dotColor: '#ef4444', bg: 'rgba(239,68,68,0.06)',  border: 'rgba(239,68,68,0.18)'  },
  { key: 'verified',      label: 'Verified',      dotColor: '#22c55e', bg: 'rgba(34,197,94,0.06)',  border: 'rgba(34,197,94,0.18)'  },
  { key: 'corroborated',  label: 'Corroborated',  dotColor: '#eab308', bg: 'rgba(234,179,8,0.06)',  border: 'rgba(234,179,8,0.18)'  },
  { key: 'single_source', label: 'Single Source', dotColor: '#9ca3af', bg: 'rgba(156,163,175,0.06)', border: 'rgba(156,163,175,0.18)' },
];

function ClaimCard({ c, group, onInsertClaim, onClose }) {
  const srcCount = c.source_outlets?.length || (c.source_outlet ? 1 : 0);
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '10px 12px', marginBottom: 7,
      background: group.bg,
      border: `1px solid ${group.border}`,
      borderRadius: 10,
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: group.dotColor, flexShrink: 0, marginTop: 5,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-family)', fontSize: '0.8rem',
          color: 'var(--fg-primary)', lineHeight: 1.45, marginBottom: srcCount ? 4 : 0,
        }}>
          {c.claim_text || c.claim}
        </div>
        {srcCount > 0 && (
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: '0.60rem',
            color: 'var(--fg-dim)',
          }}>
            {srcCount} source{srcCount !== 1 ? 's' : ''}
          </div>
        )}
        {c.note && (
          <div style={{
            fontFamily: 'var(--font-family)', fontSize: '0.72rem',
            color: 'var(--fg-secondary)', fontStyle: 'italic', marginTop: 3,
          }}>
            {c.note}
          </div>
        )}
      </div>
      {onInsertClaim && (
        <button
          onClick={e => { e.stopPropagation(); onInsertClaim(c); onClose(); }}
          style={{
            flexShrink: 0, padding: '3px 10px', borderRadius: 6,
            border: '1px solid rgba(249,115,22,0.35)',
            background: 'rgba(249,115,22,0.08)',
            cursor: 'pointer', fontFamily: 'var(--font-family)',
            fontSize: '0.65rem', color: 'var(--accent)', whiteSpace: 'nowrap',
          }}
        >
          Insert
        </button>
      )}
    </div>
  );
}

function ClaimLandscapeModal({ graphData, claims, onInsertClaim, onClose }) {
  const allClaims = claims || [];
  const hasAnyClaims = allClaims.length > 0;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 620, maxWidth: '95vw', maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          borderRadius: 18, zIndex: 1001,
          boxShadow: '0 24px 60px rgba(0,0,0,0.28)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 22px', borderBottom: '1px solid var(--border)',
          position: 'sticky', top: 0, background: 'var(--bg-primary)', zIndex: 2,
        }}>
          <div style={{ fontFamily: 'var(--font-family)', fontSize: '0.92rem', fontWeight: 600, color: 'var(--fg-primary)' }}>
            Claim Landscape
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {hasAnyClaims && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--fg-dim)',
              }}>
                {allClaims.length} claim{allClaims.length !== 1 ? 's' : ''}
              </span>
            )}
            <button
              onClick={onClose}
              style={{
                width: 26, height: 26, borderRadius: '50%',
                background: 'rgba(0,0,0,0.08)', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: '1rem', color: 'var(--fg-secondary)',
              }}
            >×</button>
          </div>
        </div>

        <div style={{ padding: '18px 22px' }}>
          {/* KnowledgeGraph */}
          <Box sx={{ height: 240, overflow: 'hidden', borderRadius: '10px', border: '1px solid var(--border)', mb: 3 }}>
            <KnowledgeGraph nodes={graphData.nodes} links={graphData.links} claimsData={allClaims} />
          </Box>

          {/* Empty state */}
          {!hasAnyClaims && (
            <div style={{
              textAlign: 'center', padding: '24px 0',
              fontFamily: 'var(--font-family)', fontSize: '0.85rem', color: 'var(--fg-dim)',
            }}>
              No claims extracted yet. Run a search to populate the landscape.
            </div>
          )}

          {/* Four sections */}
          {CLAIM_GROUPS.map(group => {
            const groupClaims = allClaims.filter(c => {
              const s = c.status || 'single_source';
              return s === group.key || (group.key === 'single_source' && s === 'uncertain');
            });
            if (groupClaims.length === 0) return null;
            return (
              <div key={group.key} style={{ marginBottom: 20 }}>
                {/* Section label */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
                }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: group.dotColor }} />
                  <span style={{
                    fontFamily: 'var(--font-family)', fontSize: '0.60rem',
                    fontWeight: 700, color: 'var(--fg-dim)',
                    letterSpacing: '0.10em', textTransform: 'uppercase',
                  }}>
                    {group.label}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '0.60rem',
                    color: 'var(--fg-dim)',
                  }}>
                    ({groupClaims.length})
                  </span>
                </div>
                {groupClaims.map((c, i) => (
                  <ClaimCard
                    key={i} c={c} group={group}
                    onInsertClaim={group.key !== 'contested' ? onInsertClaim : null}
                    onClose={onClose}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SourceCard({ src, index, onClick, isSelected }) {
  const dotColor = src.credibility_tier
    ? TIER_COLOR[src.credibility_tier] ?? QUALITY_COLOR['medium']
    : QUALITY_COLOR[getSourceQuality(src.url)];
  const domain   = (() => {
    try { return new URL(src.url).hostname.replace('www.', ''); }
    catch { return src.url; }
  })().toUpperCase();

  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex', alignItems: 'flex-start', gap: 1.5,
        px: 1.5, py: 1.25, borderRadius: '12px',
        background: isSelected ? 'rgba(255,255,255,0.42)' : 'var(--gbtn-bg)',
        border: isSelected ? '1px solid rgba(249,115,22,0.7)' : '1px solid var(--border)',
        transition: 'all 0.16s ease',
        cursor: 'pointer',
        '&:hover': {
          background: 'var(--glass-bg)',
          borderColor: 'rgba(249,115,22,0.5)',
          transform: 'translateY(-1px)',
          boxShadow: '0 4px 12px rgba(140,110,60,0.10)',
        },
      }}
    >
      {/* Number badge */}
      <Box sx={{
        width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(249,115,22,0.10)', border: '1px solid rgba(249,115,22,0.20)',
        fontFamily: 'var(--font-family)', fontSize: '0.72rem', fontWeight: 600,
        color: 'var(--accent)',
      }}>
        {index + 1}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* Row 1: dot + favicon + domain */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.4 }}>
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: dotColor, flexShrink: 0 }} />
          {src.favicon && (
            <img src={src.favicon} alt="" width={13} height={13}
              style={{ borderRadius: 2, opacity: 0.8 }}
              onError={e => { e.target.style.display = 'none'; }} />
          )}
          <Typography sx={{
            fontFamily: 'var(--font-family)', fontSize: '0.64rem', fontWeight: 600,
            color: 'var(--blue)', letterSpacing: '0.07em', lineHeight: 1,
          }}>
            {domain}
          </Typography>
        </Box>
        <Typography sx={{
          fontFamily: 'var(--font-family)', fontSize: '0.83rem', fontWeight: 400,
          color: 'var(--fg-primary)', lineHeight: 1.4,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {src.title || src.url}
        </Typography>
      </Box>
      <ExternalLink
        size={13}
        style={{ color: 'var(--fg-dim)', flexShrink: 0, marginTop: 4 }}
        onClick={e => { e.stopPropagation(); window.open(src.url, '_blank', 'noopener,noreferrer'); }}
      />
    </Box>
  );
}

// ── Trending chips ────────────────────────────────────────────────────────────

const FALLBACK_SUGGESTIONS = [
  { title: 'Latest breakthroughs in quantum computing' },
  { title: 'How does RAG work in AI systems?' },
  { title: 'Best open source LLMs in 2026' },
  { title: 'Explain transformer attention mechanisms' },
  { title: 'FastAPI vs Flask for production APIs' },
  { title: 'Top AI coding assistants compared' },
];

function useTrendingChips() {
  const [articles, setArticles] = useState(FALLBACK_SUGGESTIONS);
  const [trending, setTrending] = useState(false);
  const [spinning, setSpinning] = useState(false);

  const fetchTrending = useCallback(async (force = false) => {
    setSpinning(true);
    try {
      const url = force
        ? `${API}/explore/trending-news?max=6&force=true`
        : `${API}/explore/trending-news?max=6`;
      const res  = await fetch(url);
      if (!res.ok) throw new Error('trending error');
      const data = await res.json();
      const arts = (data.articles || []).filter(a => a.title).slice(0, 6);
      if (arts.length >= 3) { setArticles(arts); setTrending(true); }
    } catch { /* silent fallback */ }
    finally { setSpinning(false); }
  }, []);

  useEffect(() => { fetchTrending(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return { articles, trending, spinning, refetch: () => fetchTrending(true) };
}

// ── Bento row helpers ─────────────────────────────────────────────────────────

function BentoImages({ query }) {
  const [photos, setPhotos] = useState([]);
  const [status, setStatus] = useState('loading');
  useEffect(() => {
    if (!query) return;
    let cancelled = false;
    setStatus('loading');
    fetch(`${API}/explore/images?q=${encodeURIComponent(query)}&page=0`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled) return;
        const imgs = data?.images?.slice(0, 6) || [];
        setPhotos(imgs);
        setStatus(imgs.length ? 'done' : 'empty');
      })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, [query]);

  if (status === 'loading') return <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={14} sx={{ color: 'var(--accent)' }} /></Box>;
  if (status !== 'done' || !photos.length) return <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.75rem', color: 'var(--fg-dim)', fontStyle: 'italic' }}>No images found</Typography>;

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
      {photos.map((photo, i) => (
        <a key={i} href={photo.source || photo.image || '#'} target="_blank" rel="noopener noreferrer"
          style={{ borderRadius: 6, overflow: 'hidden', display: 'block', textDecoration: 'none' }}>
          <img src={photo.image} alt={photo.title || ''}
            onError={e => { e.target.parentElement.style.display = 'none'; }}
            style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block', transition: 'transform 0.2s' }}
            onMouseEnter={e => { e.target.style.transform = 'scale(1.04)'; }}
            onMouseLeave={e => { e.target.style.transform = 'scale(1)'; }}
          />
        </a>
      ))}
    </Box>
  );
}

// ── Inline images ─────────────────────────────────────────────────────────────

function InlineImages({ visualQuery }) {
  const [photos, setPhotos] = useState([]);
  useEffect(() => {
    if (!visualQuery) return;
    let cancelled = false;
    fetch(`${API}/explore/images?q=${encodeURIComponent(visualQuery)}&page=0`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (!cancelled && data?.images?.length) setPhotos(data.images.slice(0, 3)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [visualQuery]);
  if (!photos.length) return null;
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
      {photos.map((photo, i) => (
        <a key={i} href={photo.source || '#'} target="_blank" rel="noopener noreferrer"
          style={{ flex: 1, borderRadius: 10, overflow: 'hidden', display: 'block', textDecoration: 'none', aspectRatio: '16/10' }}>
          <img src={photo.image} alt={photo.title || visualQuery}
            onError={e => { e.target.parentElement.style.display = 'none'; }}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.2s', backgroundColor: '#e5ddd0' }}
            onMouseEnter={e => { e.target.style.transform = 'scale(1.03)'; }}
            onMouseLeave={e => { e.target.style.transform = 'scale(1)'; }}
          />
        </a>
      ))}
    </div>
  );
}


// Split an answer string into alternating text / diagram segments.
// During streaming, an unclosed [DIAGRAM] block is hidden to avoid raw
// syntax leaking into the rendered output.
function parseAnswerParts(answer, sources, streaming) {
  const parts = [];
  const regex = /\[DIAGRAM\]([\s\S]*?)\[\/DIAGRAM\]/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(answer)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: linkifyCitations(answer.slice(lastIndex, match.index), sources) });
    }
    parts.push({ type: 'diagram', content: match[1].trim() });
    lastIndex = match.index + match[0].length;
  }

  // Remaining text (may contain a partial [DIAGRAM] block while streaming)
  if (lastIndex < answer.length) {
    let remaining = answer.slice(lastIndex);
    if (streaming) {
      // Hide incomplete diagram so raw syntax never shows to the user
      remaining = remaining.replace(/\[DIAGRAM\][\s\S]*$/, '').trim();
    }
    if (remaining) {
      parts.push({ type: 'text', content: linkifyCitations(remaining, sources) });
    }
  }

  // Fallback: whole answer is plain text (no diagram tags at all)
  if (parts.length === 0 && answer) {
    parts.push({ type: 'text', content: linkifyCitations(answer, sources) });
  }

  return parts;
}

function CollapsibleAnswer({ answer, streaming, sources }) {
  const isEmpty = !streaming && (
    !answer ||
    /i couldn.{0,10}t find relevant results/i.test(answer) ||
    /no (relevant |search )?results/i.test(answer)
  );

  const parts = useMemo(
    () => parseAnswerParts(answer, sources, streaming),
    [answer, sources, streaming],
  );

  if (isEmpty) {
    return (
      <div style={{ padding: '24px 0', color: 'var(--fg-dim)', fontSize: '0.85rem', fontStyle: 'italic' }}>
        No summary could be generated for this query.
        Try rephrasing or searching a more specific claim.
      </div>
    );
  }

  return (
    <Box sx={ANSWER_BODY_STYLES}>
      {parts.map((part, index) => {
        if (part.type === 'diagram') {
          return (
            <Box key={`diagram-${index}`} sx={{ my: 2 }}>
              <DiagramCard chartCode={part.content} />
            </Box>
          );
        }
        return (
          <ReactMarkdown
            key={`text-${index}`}
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={{ a: ({ href, children }) => <CitationLink href={href} sources={sources}>{children}</CitationLink> }}
          >
            {part.content}
          </ReactMarkdown>
        );
      })}
      {streaming && (
        <Box component="span" sx={{ display: 'inline-block', width: 7, height: 15, bgcolor: 'var(--accent)', borderRadius: '2px', animation: 'blinkPulse 1s step-end infinite', verticalAlign: 'text-bottom', ml: 0.5 }} />
      )}
    </Box>
  );
}

function ThreadDivider() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 0.5 }}>
      <Box sx={{ width: '1px', height: 28, bgcolor: 'var(--border)' }} />
    </Box>
  );
}

// eslint-disable-next-line no-unused-vars
function PipelineTrace({ trace }) {
  const [open, setOpen] = useState(false);
  if (!trace) return null;

  const summary = [
    `${trace.sources_retrieved ?? 0} sources`,
    `${trace.claims_extracted ?? 0} claims`,
    trace.claims_verified   ? `${trace.claims_verified} verified`  : null,
    trace.claims_contested  ? `${trace.claims_contested} contested` : null,
  ].filter(Boolean).join(' · ');

  return (
    <Box sx={{ mt: 1 }}>
      <Box
        onClick={() => setOpen(o => !o)}
        sx={{
          display: 'inline-flex', alignItems: 'center', gap: 0.5,
          cursor: 'pointer', userSelect: 'none',
          px: 1, py: 0.35,
          borderRadius: '6px',
          border: '1px solid var(--border)',
          bgcolor: 'rgba(255,255,255,0.4)',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.65)' },
          transition: 'background 0.15s',
        }}
      >
        <Typography sx={{
          fontFamily: 'var(--font-family)',
          fontSize: '0.65rem',
          color: 'var(--fg-dim)',
          fontWeight: 500,
        }}>
          {open ? '▾' : '▸'} Research pipeline: {summary}
        </Typography>
      </Box>

      {open && (
        <Box sx={{
          mt: 0.75, px: 1.25, py: 0.9,
          borderRadius: '8px',
          border: '1px solid var(--border)',
          bgcolor: 'rgba(255,255,255,0.5)',
          display: 'flex', gap: 2, flexWrap: 'wrap',
        }}>
          {[
            { label: 'Sources retrieved', value: trace.sources_retrieved ?? 0 },
            { label: 'Claims extracted',  value: trace.claims_extracted  ?? 0 },
            { label: 'Verified',          value: trace.claims_verified   ?? 0, color: '#22c55e' },
            { label: 'Contested',         value: trace.claims_contested  ?? 0, color: '#ef4444' },
          ].map(({ label, value, color }) => (
            <Box key={label} sx={{ display: 'flex', flexDirection: 'column', gap: 0.1 }}>
              <Typography sx={{
                fontFamily: 'var(--font-family)',
                fontSize: '0.72rem',
                fontWeight: 700,
                color: color ?? 'var(--fg-primary)',
              }}>
                {value}
              </Typography>
              <Typography sx={{
                fontFamily: 'var(--font-family)',
                fontSize: '0.6rem',
                color: 'var(--fg-dim)',
              }}>
                {label}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

function FollowUpBar({ onSubmit, atMax }) {
  const [text, setText] = useState('');
  const submit = () => { const t = text.trim(); if (t) { onSubmit(t); setText(''); } };

  if (atMax) {
    return (
      <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', py: 1.5, borderRadius: '14px', border: '1px dashed var(--border)', fontFamily: 'var(--font-family)', fontSize: '0.8rem', color: 'var(--fg-dim)' }}>
        Start a new search to continue
      </Box>
    );
  }
  return (
    <Box component="form" onSubmit={e => { e.preventDefault(); submit(); }} sx={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 1.5,
      borderBottom: '1px solid var(--border)', pb: 0.75,
      '&:focus-within': { borderBottomColor: 'var(--accent)' },
    }}>
      <CornerDownRight size={15} color="var(--fg-dim)" strokeWidth={2} style={{ flexShrink: 0 }} />
      <input
        value={text} onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
        placeholder="Ask a follow-up…" autoComplete="off"
        style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '0.9rem', fontFamily: 'var(--font-family)', fontWeight: 300, color: 'var(--fg-primary)', padding: '4px 0' }}
      />
      {text.trim() && (
        <button type="submit" style={{ ...GLASS_BTN_ACCENT, padding: '5px 14px', fontSize: 12 }}>
          Ask
        </button>
      )}
    </Box>
  );
}

// ── Mini tab strip ────────────────────────────────────────────────────────────

function MiniTabStrip({ active, onChange, hasContradictions, contradictionsLoading, hasSources, hasGaps, hasQuotes }) {
  const tabs = [
    { key: 'answer',         label: 'Result' },
    { key: 'perspectives',   label: 'Perspectives' },
    ...(hasSources ? [{ key: 'citations', label: 'Citations' }] : []),
    { key: 'images',         label: 'Images' },
    { key: 'contradictions', label: 'Contradictions', dot: contradictionsLoading ? true : hasContradictions },
    ...(hasGaps   ? [{ key: 'gaps',   label: 'Gaps' }]   : []),
    ...(hasQuotes ? [{ key: 'quotes', label: 'Quotes' }] : []),
  ];

  return (
    <Box sx={{
      display: 'flex', gap: 0.5, flexWrap: 'nowrap',
      overflowX: 'auto', borderTop: '1px solid var(--border)', pt: 1.25, mt: 1.5,
      '&::-webkit-scrollbar': { display: 'none' }, scrollbarWidth: 'none',
    }}>
      {tabs.map(t => (
        <Box
          key={t.key}
          onClick={() => onChange(t.key)}
          sx={{
            px: 1.25, py: 0.45, borderRadius: 999, cursor: 'pointer', flexShrink: 0,
            fontFamily: 'var(--font-family)', fontSize: '0.72rem',
            fontWeight: active === t.key ? 500 : 400,
            color: active === t.key ? '#fff' : 'var(--fg-secondary)',
            background: active === t.key ? 'var(--accent)' : 'var(--gbtn-bg)',
            border: '1px solid',
            borderColor: active === t.key ? 'transparent' : 'var(--border)',
            transition: 'all 0.14s',
            display: 'flex', alignItems: 'center', gap: '4px',
            '&:hover': { color: active === t.key ? '#fff' : 'var(--fg-primary)', borderColor: active === t.key ? 'transparent' : 'rgba(249,115,22,0.3)' },
          }}
        >
          {t.label}
          {t.dot && (
            <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: '#d97706', verticalAlign: 'middle' }} />
          )}
        </Box>
      ))}
    </Box>
  );
}

// ── Result block ──────────────────────────────────────────────────────────────

function ResultBlock({ question, sources, answer, streaming, errorMsg, isFollowUp, onNewSearch, isDeepSearch, deepLabel, relatedSearches = [], loadingRelated = false, visualQuery = '', contradictions = null, stockData = null, claims = [], pipelineTrace = null, onWrite, onInsertClaim, gaps = [], quotes = [] }) {
  const [activeTab,       setActiveTab]       = useState('answer');
  const [copied,          setCopied]          = useState(false);
  const [processedAnswer, setProcessedAnswer] = useState('');
  const [selectedSource,  setSelectedSource]  = useState(null);
  const [showSourceIntelPopup, setShowSourceIntelPopup] = useState(false);
  const [showClaimLandscapePopup, setShowClaimLandscapePopup] = useState(false);
  const sourceMap = useSources();

  useEffect(() => {
    if (!streaming && answer) {
      if (claims && claims.length > 0) {
        setProcessedAnswer(injectConfidenceBadges(answer, claims));
      } else {
        setProcessedAnswer(answer);
      }
    }
  }, [streaming, answer, claims]);

  const handleCopy = useCallback(() => {
    if (!answer) return;
    navigator.clipboard.writeText(answer).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [answer]);

  const contradictionsLoading = contradictions === null;
  const hasContradictions     = contradictions?.contradictions?.length > 0;
  const chips    = answer ? extractKeywordChips(answer) : [];
  const sourcesCount = sources.length;
  const verifiedCount =
    pipelineTrace?.claims_verified ??
    claims.filter(c => ['verified', 'corroborated'].includes(c.status)).length;
  const contestedCount =
    pipelineTrace?.claims_contested ??
    claims.filter(c => c.status === 'contested').length;

  const graphData = useMemo(() => {
    if (!claims.length && !sources.length) return { nodes: [], links: [] };
    const sNodes = sources.slice(0, 5).map((s, i) => ({
      id: `src_${i}`,
      name: s.outlet_name || (s.url || '').replace(/^https?:\/\/(www\.)?/, '').split('/')[0].slice(0, 20),
      type: 'source',
    }));
    const nodes = [
      { id: 'q', name: question.slice(0, 20), type: 'query' },
      ...sNodes,
    ];
    const links = sNodes.map((_, i) => ({ source: 'q', target: `src_${i}` }));
    return { nodes, links };
  }, [claims, sources, question]);

  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {isFollowUp && (
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.4, borderRadius: '20px', background: 'rgba(0,0,0,0.04)', border: '1px solid var(--border)', alignSelf: 'flex-start' }}>
          <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.75rem', fontWeight: 400, color: 'var(--fg-dim)' }}>
            ↩ You asked: <span style={{ color: 'var(--fg-secondary)', fontWeight: 500 }}>{question}</span>
          </Typography>
        </Box>
      )}

      {errorMsg && (
        <Box sx={{ border: '1px solid var(--error)', bgcolor: 'rgba(220,38,38,0.06)', borderRadius: '10px', p: 1.5 }}>
          <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.8rem', color: 'var(--error)' }}>{errorMsg}</Typography>
        </Box>
      )}

      {/* Finance card — shown when a stock/ticker was detected */}
      {stockData && <FinanceCard data={stockData} />}

      {/* Sidebar + Main Content Layout */}
      <Box sx={{ display: 'flex', flexDirection: stockData ? 'column' : { xs: 'column', md: 'row' }, gap: 3, width: '100%', alignItems: 'flex-start' }}>

        {/* ── LEFT SIDEBAR ── */}
        {!stockData && (
          <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            width: { xs: '100%', md: '300px' },
            flexShrink: 0,
            gap: 2,
            mt: '16px'
          }}>
            {/* Source Intelligence Card */}
            <Box
              component="button"
              onClick={() => setShowSourceIntelPopup(true)}
              sx={{
                width: '100%',
                textAlign: 'left',
                borderRadius: '16px',
                padding: '16px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                transition: 'all 0.16s ease',
                '&:hover': {
                  borderColor: 'rgba(249,115,22,0.6)',
                  transform: 'translateY(-1px)',
                },
              }}
            >
              <Typography sx={{
                fontFamily: 'var(--font-family)',
                fontSize: '0.625rem',
                fontWeight: 600,
                color: 'var(--fg-dim)',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                mb: 2,
                opacity: 0.8,
              }}>
                Source Intelligence
              </Typography>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <Box>
                  <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '2.25rem', fontWeight: 500, color: 'var(--fg-primary)', lineHeight: 1 }}>
                    {sourcesCount}
                  </Typography>
                  <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.75rem', color: 'var(--fg-dim)', mt: 0.25, textTransform: 'uppercase', opacity: 0.8 }}>
                    sources
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.85rem', fontWeight: 500, color: '#22c55e', lineHeight: 1.4 }}>
                    {verifiedCount} verified
                  </Typography>
                  <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.85rem', fontWeight: 500, color: '#ef4444', lineHeight: 1.4 }}>
                    {contestedCount} contested
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* Claim Landscape Card */}
            {(claims.length > 0 || sources.length > 0) && (
              <Box
                component="button"
                onClick={() => setShowClaimLandscapePopup(true)}
                sx={{
                  width: '100%',
                  textAlign: 'left',
                  borderRadius: '16px',
                  padding: '16px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  transition: 'all 0.16s ease',
                  '&:hover': {
                    borderColor: 'rgba(249,115,22,0.6)',
                    transform: 'translateY(-1px)',
                  },
                }}
              >
                <Typography sx={{
                  fontFamily: 'var(--font-family)',
                  fontSize: '0.625rem',
                  fontWeight: 600,
                  color: 'var(--fg-dim)',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  mb: 2,
                  opacity: 0.8,
                }}>
                  Claim Landscape
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {/* Mini visual indicator of the landscape */}
                  <Box sx={{ display: 'flex', gap: '4px', mb: 1 }}>
                    {(() => {
                        const verified = claims.filter(c => c.status === 'verified' || c.status === 'corroborated').length;
                        const contested = claims.filter(c => c.status === 'contested').length;
                        const other = claims.length - verified - contested;
                        const total = claims.length || 1;
                        if (total === 1 && claims.length === 0) {
                          return <Box sx={{ height: 4, width: '100%', bgcolor: '#9ca3af', borderRadius: 999 }} />;
                        }
                        const vPct = (verified / total) * 100;
                        const cPct = (contested / total) * 100;
                        const oPct = (other / total) * 100;
                        return (
                          <>
                            {vPct > 0 && <Box sx={{ height: 4, width: `${vPct}%`, bgcolor: '#22c55e', borderRadius: 999 }} />}
                            {oPct > 0 && <Box sx={{ height: 4, width: `${oPct}%`, bgcolor: '#3b82f6', borderRadius: 999 }} />}
                            {cPct > 0 && <Box sx={{ height: 4, width: `${cPct}%`, bgcolor: '#ef4444', borderRadius: 999 }} />}
                          </>
                        );
                    })()}
                  </Box>
                  <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.75rem', color: 'var(--fg-dim)', lineHeight: 1.4, opacity: 0.8, textAlign: 'left' }}>
                    Click to view {claims.length || 0} analyzed claims across the knowledge graph.
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>
        )}

        {showSourceIntelPopup && (
          <SourceIntelligencePopup
            sources={sources}
            claims={claims}
            pipelineTrace={pipelineTrace}
            isDeepSearch={isDeepSearch}
            selectedSource={selectedSource}
            onSelectSource={src => { setSelectedSource(src); setShowSourceIntelPopup(false); }}
            onClose={() => setShowSourceIntelPopup(false)}
          />
        )}

        {showClaimLandscapePopup && (
          <ClaimLandscapeModal
            graphData={graphData}
            claims={claims}
            onInsertClaim={onInsertClaim}
            onClose={() => setShowClaimLandscapePopup(false)}
          />
        )}

        {/* Source Intelligence Modal */}
        {selectedSource && (
          <SourceModal
            source={selectedSource}
            sourceProfile={(() => {
              try {
                const domain = new URL(selectedSource.url).hostname.replace('www.', '');
                return sourceMap[domain] || null;
              } catch { return null; }
            })()}
            claims={claims}
            onClose={() => setSelectedSource(null)}
            onInsert={claim => {
              if (onInsertClaim) onInsertClaim(claim);
              setSelectedSource(null);
            }}
          />
        )}

        {/* ── MAIN CONTENT: AI Response ── */}
        <Box sx={{ flex: 1, minWidth: 0, padding: { xs: '16px 0', md: '16px 0' } }}>
          {answer ? (
            <GlassCard style={{ padding: '24px 28px' }}>

              {/* Images — always shown first when on answer tab */}
              {activeTab === 'answer' && visualQuery && <InlineImages visualQuery={visualQuery} />}

              {/* Copy button — floating top-right */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                <Tooltip title={copied ? 'Copied!' : 'Copy answer'} placement="top">
                  <Box
                    component="button"
                    onClick={handleCopy}
                    sx={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 28, height: 28, borderRadius: '8px', border: '1px solid var(--border)',
                      background: copied ? 'rgba(34,197,94,0.10)' : 'transparent',
                      borderColor: copied ? 'rgba(34,197,94,0.35)' : 'var(--border)',
                      cursor: 'pointer', transition: 'all 0.14s ease', padding: 0,
                      '&:hover': { background: 'rgba(0,0,0,0.05)', borderColor: 'var(--fg-dim)' },
                    }}
                  >
                    {copied ? <Check size={12} color="#22c55e" /> : <Copy size={12} color="var(--fg-dim)" />}
                  </Box>
                </Tooltip>
              </Box>

              {/* Deep search status banner */}
              {deepLabel === '2/2' && streaming && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, px: 1.25, py: 0.75, borderRadius: '10px', background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.20)' }}>
                  <CircularProgress size={11} sx={{ color: 'var(--accent)' }} />
                  <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.75rem', fontWeight: 400, color: '#b45309' }}>
                    Running deep analysis…
                  </Typography>
                </Box>
              )}

              {/* Active tab content */}
              <Box key={activeTab} sx={{ animation: 'tabFadeIn 0.15s ease' }}>
                {activeTab === 'answer' && (
                  <>
                    <CollapsibleAnswer answer={processedAnswer || answer} streaming={streaming} sources={sources} />

                    {/* Contested callout */}
                    {(() => {
                      const topContested = claims.find(c => c.status === 'contested');
                      if (!topContested) return null;
                      return (
                        <Box sx={{
                          borderLeft: '3px solid #ef4444',
                          background: 'rgba(239,68,68,0.05)',
                          borderRadius: '0 6px 6px 0',
                          padding: '10px 14px',
                          mt: 2,
                        }}>
                          <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.65rem', fontWeight: 600, color: '#dc2626', mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            Contested
                          </Typography>
                          <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.78rem', color: 'var(--fg-primary)', lineHeight: 1.5 }}>
                            {topContested.claim_text || topContested.claim}
                          </Typography>
                          {topContested.note && (
                            <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.68rem', color: 'var(--fg-secondary)', mt: 0.5, fontStyle: 'italic' }}>
                              {topContested.note}
                            </Typography>
                          )}
                        </Box>
                      );
                    })()}
                  </>
                )}
                {activeTab === 'perspectives'  && <PerspectivesTab query={question} isDeepMode={isDeepSearch} subQueries={pipelineTrace?.sub_queries || []} sources={sources} />}
                {activeTab === 'citations'     && <CitationsPanel sources={sources} query={question} />}
                {activeTab === 'images'        && <BentoImages query={visualQuery || question} />}
                {activeTab === 'contradictions' && (
                  contradictionsLoading
                    ? <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.78rem', color: 'var(--fg-dim)', fontStyle: 'italic', py: 2 }}>Checking sources for contradictions…</Typography>
                    : <ContradictionsTab data={contradictions} sources={sources} />
                )}
                {activeTab === 'gaps'   && <GapsTab   gaps={gaps}     loading={streaming && gaps.length === 0}   onNewSearch={onNewSearch} />}
                {activeTab === 'quotes' && <QuoteBankTab quotes={quotes} loading={streaming && quotes.length === 0} onInsertClaim={onInsertClaim} />}
              </Box>
              <style>{`@keyframes tabFadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>

              {/* Keyword chips (answer tab only) */}
              {activeTab === 'answer' && chips.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 2 }}>
                  {chips.map((chip, i) => (
                    <Box
                      key={i}
                      onClick={() => onNewSearch(chip)}
                      sx={{
                        px: 1.25, py: 0.4, borderRadius: 999, cursor: 'pointer',
                        background: 'var(--blue-dim)', border: '1px solid rgba(30,58,138,0.15)',
                        fontFamily: 'var(--font-family)', fontSize: '0.72rem', fontWeight: 400,
                        color: 'var(--blue)', transition: 'all 0.14s',
                        '&:hover': { background: 'rgba(30,58,138,0.18)', borderColor: 'rgba(30,58,138,0.3)' },
                      }}
                    >
                      {chip}
                    </Box>
                  ))}
                </Box>
              )}

              {/* Mini tab strip */}
              <MiniTabStrip
                active={activeTab}
                onChange={setActiveTab}
                hasContradictions={hasContradictions}
                contradictionsLoading={contradictionsLoading}
                hasSources={sources.length > 0}
                hasGaps={gaps.length > 0}
                hasQuotes={quotes.length > 0}
              />
            </GlassCard>
          ) : (
            <GlassCard style={{ padding: '22px 26px' }}>
              <Skeleton variant="rectangular" width="40%" height={12} sx={{ borderRadius: 4, bgcolor: 'var(--bg-tertiary)', mb: 2 }} />
              <Skeleton variant="rectangular" width="75%" height={28} sx={{ borderRadius: 6, bgcolor: 'var(--bg-tertiary)', mb: 1 }} />
              <Skeleton variant="rectangular" width="60%" height={28} sx={{ borderRadius: 6, bgcolor: 'var(--bg-tertiary)', mb: 2 }} />
              <Box sx={{ height: '1px', bgcolor: 'var(--border)', mb: 2 }} />
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} variant="text" width={`${65 + (i % 4) * 8}%`} sx={{ bgcolor: 'var(--bg-tertiary)', height: 22, mb: 0.5 }} />
              ))}
            </GlassCard>
          )}

          {/* Related searches — below answer in center column */}
          {(relatedSearches.length > 0 || loadingRelated) && answer && (
            <Box sx={{ mt: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.1, px: 0.5 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'var(--blue)' }} />
                <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.58rem', fontWeight: 500, color: 'var(--fg-dim)', letterSpacing: '0.10em', textTransform: 'uppercase' }}>
                  Related
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {loadingRelated
                  ? [0, 1, 2].map(i => <Skeleton key={i} variant="rectangular" height={28} sx={{ borderRadius: '8px', bgcolor: 'var(--bg-tertiary)', width: 160 }} />)
                  : relatedSearches.map(s => (
                      <Box
                        key={s} onClick={() => onNewSearch(s)}
                        sx={{
                          display: 'flex', alignItems: 'center', gap: 0.75,
                          fontFamily: 'var(--font-family)', fontSize: '0.76rem', fontWeight: 400,
                          color: 'var(--fg-secondary)', padding: '5px 8px', borderRadius: 8,
                          cursor: 'pointer', background: 'var(--gbtn-bg)',
                          border: '1px solid var(--border)', transition: 'all 0.12s',
                          '&:hover': { color: 'var(--accent)', borderColor: 'rgba(249,115,22,0.3)', background: 'rgba(249,115,22,0.05)' },
                        }}
                      >
                        <span style={{ color: 'var(--accent)', fontSize: '0.65rem' }}>→</span>
                        {s}
                      </Box>
                    ))
                }
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      {/* Outline builder removed per user request */}

    </Box>
  );
}

// ── Top bar (results + searching) ─────────────────────────────────────────────

function TopBar({ query, setQuery, onSubmit, deepMode, onToggleDeep, onReset, answer, onSave, onShare, saved, navigate, onWrite }) {
  const handleKey = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(); } };

  return (
    <Box sx={{
      position: 'sticky', top: 0, zIndex: 30,
      background: 'rgba(26,22,20,0.82)',
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      borderBottom: '1px solid var(--border)',
      px: 3, py: 1,
    }}>
      <Box sx={{ maxWidth: 1100, mx: 'auto', display: 'flex', alignItems: 'center', gap: 1.5 }}>

        {/* Quarry wordmark — clicking redirects to home */}
        <Box onClick={() => { onReset(); navigate('/'); }} sx={{ cursor: 'pointer', flexShrink: 0, mr: 0.5, userSelect: 'none' }}>
          <Typography sx={{
            fontFamily: 'var(--font-serif)', fontSize: '1.25rem', fontWeight: 600,
            color: 'var(--fg-primary)', letterSpacing: '-0.02em', lineHeight: 1,
            transition: 'opacity 0.15s',
            '&:hover': { opacity: 0.7 },
          }}>
            Quarry
          </Typography>
        </Box>

        {/* Search input */}
        <Box
          component="form"
          onSubmit={e => { e.preventDefault(); onSubmit(); }}
          sx={{
            flex: 1, maxWidth: 540, display: 'flex', alignItems: 'center', gap: 1,
            borderRadius: 999, px: 1.5, py: 0.6,
            background: 'var(--glass-bg)',
            border: '1px solid var(--border)',
            boxShadow: '0 1px 4px rgba(140,110,60,0.06)',
            transition: 'box-shadow 0.15s, border-color 0.15s',
            '&:focus-within': { boxShadow: '0 1px 4px rgba(140,110,60,0.06), 0 0 0 3px var(--accent-dim)', borderColor: 'rgba(249,115,22,0.35)' },
          }}
        >
          <Search size={14} style={{ color: 'var(--fg-dim)', flexShrink: 0 }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search the web…"
            autoComplete="off"
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: '0.88rem', fontFamily: 'var(--font-family)', fontWeight: 400,
              color: 'var(--fg-primary)', padding: '3px 0',
            }}
          />
        </Box>

        {/* Action buttons */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, ml: 0.25 }}>
          <button style={GLASS_BTN_ACCENT} onClick={onSubmit}>
            Search
          </button>

          <button
            style={{
              ...GLASS_BTN,
              background: deepMode ? 'rgba(249,115,22,0.12)' : 'var(--glass-bg)',
              border: deepMode ? '1px solid rgba(249,115,22,0.5)' : '1px solid var(--glass-border)',
              color: deepMode ? '#F97316' : 'var(--fg-secondary)',
            }}
            onClick={onToggleDeep}
          >
            <Zap size={11} fill={deepMode ? 'var(--accent)' : 'none'} color={deepMode ? 'var(--accent)' : 'var(--fg-secondary)'} />
            Deep
          </button>

          {answer && (
            <>
              <button style={{ ...GLASS_BTN, color: '#000000' }} onClick={onSave}>
                <BookmarkPlus size={11} color={saved ? 'var(--accent)' : '#000000'} />
                {saved ? 'Saved' : 'Save'}
              </button>
              <button style={{ ...GLASS_BTN, color: '#000000' }} onClick={onShare}>
                <ArrowUpRight size={11} color="#000000" />
                Share
              </button>
            </>
          )}

          {onWrite && (
            <Box
              onClick={onWrite}
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.5,
                px: 1.25, py: 0.5,
                background: 'rgba(249,115,22,0.10)',
                border: '1px solid rgba(249,115,22,0.30)',
                borderRadius: '6px',
                cursor: 'pointer',
                '&:hover': { background: 'rgba(249,115,22,0.18)' },
                transition: 'background 0.15s',
              }}
            >
              <Edit3 size={13} color="var(--accent)" />
              <Typography sx={{
                fontFamily: 'var(--font-family)',
                fontSize: '0.72rem',
                fontWeight: 500,
                color: 'var(--accent)',
              }}>
                Write
              </Typography>
            </Box>
          )}

          <NavControls />
        </Box>
      </Box>
    </Box>
  );
}

// ── Watchlist grid ────────────────────────────────────────────────────────────

function WatchlistGrid({ dark }) {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/explore/stocks?symbols=` + encodeURIComponent('^DJI,^GSPC,^IXIC,AAPL,NVDA,MSFT'))
      .then(r => r.json())
      .then(d => { setStocks(d.stocks || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75, height: '100%', gridAutoRows: '1fr' }}>
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} variant="rounded" sx={{ borderRadius: '10px', bgcolor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }} />
        ))}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75, height: '100%', gridAutoRows: '1fr' }}>
      {stocks.slice(0, 6).map((s, i) => {
        const up = s.changePct >= 0;
        const clr = up ? '#22c55e' : '#ef4444';
        const isIndex = s.rawTicker?.startsWith('^');
        const pts = s.sparkline || [];
        let sparkPath = '';
        if (pts.length > 1) {
          const min = Math.min(...pts), max = Math.max(...pts);
          const range = max - min || 1;
          sparkPath = pts.map((v, j) => {
            const x = ((j / (pts.length - 1)) * 54).toFixed(1);
            const y = (18 - ((v - min) / range) * 18).toFixed(1);
            return `${j === 0 ? 'M' : 'L'}${x},${y}`;
          }).join(' ');
        }
        return (
          <Box
            key={i}
            sx={{
              p: '9px 11px',
              borderRadius: '10px',
              border: dark ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(175,150,105,0.26)',
              borderTop: dark ? '1px solid rgba(255,255,255,0.14)' : '1px solid rgba(255,255,248,0.88)',
              background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,252,244,0.75)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              boxShadow: dark
                ? '0 3px 12px rgba(0,0,0,0.30), 0 1px 0 rgba(255,255,255,0.04) inset'
                : '0 3px 12px rgba(140,110,60,0.07), 0 1px 0 rgba(255,254,228,0.80) inset',
              cursor: 'pointer',
              transition: 'all 0.14s ease',
              '&:hover': {
                transform: 'translateY(-1px)',
                boxShadow: dark
                  ? '0 6px 18px rgba(0,0,0,0.40)'
                  : '0 6px 18px rgba(140,110,60,0.12)',
              },
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.75 }}>
              <Box>
                <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.60rem', fontWeight: 700, color: 'var(--fg-primary)', letterSpacing: '0.06em', lineHeight: 1 }}>
                  {s.symbol}
                </Typography>
                <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.54rem', fontWeight: 300, color: 'var(--fg-dim)', mt: 0.25, lineHeight: 1 }}>
                  {(s.name?.length > 12 ? s.name.slice(0, 12) + '…' : s.name) || s.symbol}
                </Typography>
              </Box>
              {sparkPath && (
                <svg width={54} height={18} style={{ display: 'block', opacity: 0.75 }}>
                  <path d={sparkPath} fill="none" stroke={clr} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
              <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 600, color: 'var(--fg-primary)', lineHeight: 1 }}>
                {isIndex ? '' : '$'}{s.price?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Typography>
              <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.60rem', fontWeight: 500, color: clr, lineHeight: 1 }}>
                {up ? '+' : ''}{s.changePct?.toFixed(2)}%
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

// ── Home search bar ───────────────────────────────────────────────────────────

function HomeSearchBar({ query, setQuery, onSubmit, deepMode, onToggleDeep }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showSugg, setShowSugg] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  const handleKey = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); setShowSugg(false); onSubmit(); }
    if (e.key === 'Escape') setShowSugg(false);
  };

  const fetchSuggestions = (val) => {
    clearTimeout(debounceRef.current);
    if (!val.trim() || val.length < 2) { setSuggestions([]); setShowSugg(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`${API}/explore/suggest?q=${encodeURIComponent(val)}`);
        const data = await r.json();
        const suggs = (data.suggestions || []).filter(s => s.toLowerCase() !== val.toLowerCase());
        setSuggestions(suggs.slice(0, 6));
        setShowSugg(suggs.length > 0);
      } catch { setSuggestions([]); setShowSugg(false); }
    }, 280);
  };

  useEffect(() => {
    if (!showSugg) return;
    const handler = e => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setShowSugg(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSugg]);

  return (
    <Box ref={wrapperRef} sx={{ width: '100%', maxWidth: 660, position: 'relative' }}>
      <Box
        component="form"
        onSubmit={e => { e.preventDefault(); setShowSugg(false); onSubmit(); }}
        sx={{
          width: '100%',
          display: 'flex', alignItems: 'center', gap: 1.25,
          borderRadius: '12px', px: 2.25, py: 1.35,
          background: 'var(--gbtn-bg)',
          backdropFilter: 'blur(28px) saturate(180%) brightness(1.06)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%) brightness(1.06)',
          borderTop: '1px solid var(--gbtn-border-t)',
          borderLeft: '1px solid var(--gbtn-border-l)',
          borderRight: '1px solid rgba(140,110,60,0.22)',
          borderBottom: '1px solid rgba(140,110,60,0.28)',
          boxShadow: '0 3px 14px rgba(140,110,60,0.13), 0 1px 4px rgba(0,0,0,0.06), 0 2px 0 rgba(255,254,218,0.72) inset',
          transition: 'box-shadow 0.2s',
          '&:focus-within': { boxShadow: '0 6px 28px rgba(140,110,60,0.16), 0 2px 0 rgba(255,254,218,0.80) inset, 0 0 0 3px var(--accent-dim)' },
        }}
      >
        <Search size={17} style={{ color: 'var(--fg-dim)', flexShrink: 0 }} strokeWidth={2} />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); fetchSuggestions(e.target.value); }}
          onKeyDown={handleKey}
          onFocus={() => { if (suggestions.length) setShowSugg(true); }}
          placeholder="Search the web…" autoComplete="off"
          style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '0.95rem', fontFamily: 'var(--font-family)', fontWeight: 400, color: 'var(--fg-primary)', padding: '4px 0' }}
        />
        <Box onClick={e => { e.preventDefault(); onToggleDeep?.(); }} sx={{
          display: 'flex', alignItems: 'center', gap: '3px', px: 1, py: 0.4, borderRadius: '6px', cursor: 'pointer', flexShrink: 0,
          border: deepMode ? '1px solid rgba(249,115,22,0.5)' : '1px solid var(--glass-border)',
          bgcolor: deepMode ? 'rgba(249,115,22,0.12)' : 'var(--glass-bg)',
          boxShadow: deepMode ? 'inset 0 2px 5px rgba(0,0,0,0.13), inset 0 1px 2px rgba(0,0,0,0.08)' : 'none',
          color: deepMode ? '#F97316' : 'var(--fg-secondary)',
          fontFamily: 'var(--font-family)', fontSize: '0.72rem', fontWeight: 400, transition: 'all 0.15s',
          '&:hover': { borderColor: 'var(--accent)', color: 'var(--accent)' },
        }}>
          <Zap size={11} fill={deepMode ? 'var(--accent)' : 'none'} color={deepMode ? 'var(--accent)' : 'currentColor'} />
          Deep
        </Box>
        {query && (
          <Box component="button" type="submit" sx={{ border: 'none', bgcolor: 'var(--accent)', color: '#FFF', fontFamily: 'var(--font-family)', fontSize: '0.8rem', fontWeight: 500, px: 1.75, py: 0.6, borderRadius: '8px', cursor: 'pointer', flexShrink: 0, transition: 'opacity 0.12s', '&:hover': { opacity: 0.88 } }}>
            Search
          </Box>
        )}
      </Box>

      {/* Suggestions dropdown */}
      {showSugg && suggestions.length > 0 && (
        <Box sx={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          background: 'rgba(250,246,238,0.97)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          borderRadius: '12px',
          borderTop: '1px solid rgba(255,255,235,0.90)',
          borderLeft: '1px solid rgba(255,252,225,0.70)',
          borderRight: '1px solid rgba(185,165,128,0.18)',
          borderBottom: '1px solid rgba(178,158,120,0.18)',
          boxShadow: '0 8px 32px rgba(140,110,60,0.12)',
          overflow: 'hidden', zIndex: 50,
        }}>
          {suggestions.map((s, i) => (
            <Box
              key={i}
              onMouseDown={e => { e.preventDefault(); setQuery(s); setShowSugg(false); onSubmit(); }}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                px: 2, py: 1,
                fontFamily: 'var(--font-family)', fontSize: '0.88rem', fontWeight: 400,
                color: 'var(--fg-primary)', cursor: 'pointer',
                borderBottom: i < suggestions.length - 1 ? '1px solid var(--border)' : 'none',
                transition: 'background 0.12s',
                '&:hover': { background: 'rgba(249,115,22,0.07)' },
              }}
            >
              <Search size={13} style={{ color: 'var(--fg-dim)', flexShrink: 0 }} />
              {s}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ExplorePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [query,        setQuery]        = useState('');
  const [phase,        setPhase]        = useState('idle');
  const [sources,      setSources]      = useState([]);
  const [answer,       setAnswer]       = useState('');
  const [errorMsg,     setErrorMsg]     = useState('');
  const [saved,        setSaved]        = useState(false);
  const [streaming,    setStreaming]    = useState(false);
  const [isDeep,       setIsDeep]       = useState(false);
  const [isDeepSearch, setIsDeepSearch] = useState(false);
  const [deepLabel,    setDeepLabel]    = useState('');
  const [toast,        setToast]        = useState({ show: false, message: '' });
  const abortRef = useRef(null);

  const [contradictions,  setContradictions]  = useState(null);
  const [followUpBlocks,  setFollowUpBlocks]  = useState([]);
  const [relatedSearches, setRelatedSearches] = useState([]);
  const [loadingRelated,  setLoadingRelated]  = useState(false);
  const [visualQuery,     setVisualQuery]     = useState('');
  const [stockData,       setStockData]       = useState(null);
  const [claimsData,      setClaimsData]      = useState([]);
  const [pipelineTrace,   setPipelineTrace]   = useState(null);
  const [gapsData,        setGapsData]        = useState([]);
  const [quotesData,      setQuotesData]      = useState([]);
  const sourcesRef       = useRef([]);
  const claimsDataRef    = useRef([]);
  const pipelineTraceRef = useRef(null);
  const gapsDataRef      = useRef([]);
  const quotesDataRef    = useRef([]);
  const { articles: trendingArticles, trending: isTrending, spinning: trendingSpinning, refetch: refetchTrending } = useTrendingChips();
  const topOffset = useTopOffset();
  const [dark] = useDarkMode();
  const { settings } = useSettings();
  const followUpAbortRef  = useRef(null);
  const lastBlockRef      = useRef(null);
  const submittedQueryRef = useRef('');

  useEffect(() => {
    if (followUpBlocks.length > 0) {
      setTimeout(() => lastBlockRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    }
  }, [followUpBlocks.length]);

  useEffect(() => {
    const q = searchParams.get('q');
    const next = searchParams.get('next');

    if (q && q.trim()) {
      if (next === 'write') {
        sessionStorage.setItem('quarry_next_action', 'write');
      }
      setQuery(q.trim());
      runSearch(decodeURIComponent(q));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const runSearch = useCallback(async (q, deepEnabled = false) => {
    if (!q?.trim()) return;

    // Persist to search history (max 20, deduplicated, most recent first)
    try {
      const HIST_KEY = 'quarry_search_history';
      const prev = JSON.parse(localStorage.getItem(HIST_KEY) || '[]');
      const next = [q.trim(), ...prev.filter(x => x !== q.trim())].slice(0, 20);
      localStorage.setItem(HIST_KEY, JSON.stringify(next));
    } catch (_) {}

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    setPhase('searching');
    setSources([]); sourcesRef.current = [];
    setAnswer(''); setSaved(false); setErrorMsg('');
    setStreaming(true); setContradictions(null); setFollowUpBlocks([]);
    setRelatedSearches([]); setLoadingRelated(false); setIsDeepSearch(deepEnabled);
    setStockData(null);
    setClaimsData([]); claimsDataRef.current = [];
    setPipelineTrace(null); pipelineTraceRef.current = null;
    setGapsData([]); gapsDataRef.current = [];
    setQuotesData([]); quotesDataRef.current = [];
    setDeepLabel(deepEnabled ? '1/2' : '');
    setVisualQuery(deriveImageQuery(q.trim()));
    submittedQueryRef.current = q.trim();
    if (followUpAbortRef.current) followUpAbortRef.current.abort();

    let accumulatedAnswer = '';

    const readStream = async (queryStr, skipSources = false) => {
      const res = await fetch(`${API}/explore/search?deep=${deepEnabled ? 'true' : 'false'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryStr }), signal,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop();
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') { setStreaming(false); continue; }
          try {
            const evt = JSON.parse(raw);
            if      (evt.type === 'sources' && !skipSources) { const _s = evt.sources || []; setSources(_s); sourcesRef.current = _s; if (evt.claims) { const normalised = evt.claims.map(c => ({ ...c, claim_text: c.claim_text ?? c.claim ?? '', status: c.status === 'uncertain' ? 'single_source' : (c.status ?? 'single_source'), source_outlets: c.source_outlets ?? (c.source_outlet ? [c.source_outlet] : []), })); setClaimsData(normalised); claimsDataRef.current = normalised; saveContestedClaims(q.trim(), normalised); } if (evt.pipeline_trace) { setPipelineTrace(evt.pipeline_trace); pipelineTraceRef.current = evt.pipeline_trace; } if (evt.gaps)   { setGapsData(evt.gaps);     gapsDataRef.current   = evt.gaps; } if (evt.quotes) { setQuotesData(evt.quotes); quotesDataRef.current = evt.quotes; } }
            else if (evt.type === 'chunk')                   { accumulatedAnswer += evt.text; setAnswer(prev => prev + evt.text); }
            else if (evt.type === 'error')                   setErrorMsg(evt.text);
            else if (evt.type === 'contradictions')          setContradictions(evt.data === null ? false : evt.data);
            else if (evt.type === 'stock' && !skipSources)   setStockData(evt.data);
          } catch { /* ignore malformed sse */ }
        }
      }
    };

    let searchSuccess = false;
    try {
      setPhase('results');
      await readStream(q.trim());
      searchSuccess = true;
    } catch (err) {
      if (err.name !== 'AbortError') { setErrorMsg(err.message); setPhase('error'); }
    } finally {
      setStreaming(false); setDeepLabel('');
      const nextAction = sessionStorage.getItem('quarry_next_action');
      if (nextAction === 'write') {
        sessionStorage.removeItem('quarry_next_action');
        sessionStorage.setItem('quarry_write_session', JSON.stringify({
          query: q.trim(),
          sources: sourcesRef.current,
          claims: claimsDataRef.current,
          pipelineTrace: pipelineTraceRef.current,
        }));
        navigate('/write');
      }
      if (searchSuccess && accumulatedAnswer) {
        setLoadingRelated(true);
        fetch(`${API}/explore/related`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q.trim(), answer_snippet: accumulatedAnswer.slice(0, 500) }),
        }).then(r => r.json()).then(data => setRelatedSearches(data.related || [])).catch(() => {}).finally(() => setLoadingRelated(false));
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // If the user toggles Deep mid-session, re-run the currently loaded query.
  useEffect(() => {
    const current = submittedQueryRef.current?.trim();
    if (!current) return;
    if (phase === 'idle') return;
    runSearch(current, isDeep);
  }, [isDeep]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = () => { if (query.trim()) runSearch(query, isDeep); };

  const handleSave = useCallback(() => {
    if (!answer) return;
    // Download as markdown
    const filename = `quarry-${query.slice(0, 40).replace(/\s+/g, '-')}-${Date.now()}.md`;
    const content  = `# ${query}\n\n${answer}\n\n---\n*Saved from Quarry*`;
    const blob     = new Blob([content], { type: 'text/markdown' });
    const url      = URL.createObjectURL(blob);
    const a        = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    // Persist to localStorage
    const firstPara = answer.replace(/^#+\s+.+$/gm, '').replace(/\*\*/g, '').replace(/\[(\d+)\]/g, '').replace(/\n+/g, ' ').trim().slice(0, 200);
    addSaved(query, firstPara, answer);
    setSaved(true);
  }, [answer, query]);

  const handleShare = useCallback(() => {
    const q = submittedQueryRef.current || query;
    if (!q) return;
    const url = `${window.location.origin}${window.location.pathname}?q=${encodeURIComponent(q)}`;
    navigator.clipboard.writeText(url).then(() => {
      setToast({ show: true, message: 'Link copied to clipboard' });
      setTimeout(() => setToast(t => ({ ...t, show: false })), 2000);
    });
  }, [query]);

  const handleWrite = useCallback(() => {
    sessionStorage.setItem('quarry_write_session', JSON.stringify({
      query: query,
      sources: sourcesRef.current,
      claims: claimsDataRef.current,
      pipelineTrace: pipelineTraceRef.current,
    }));
    navigate('/write');
  }, [query, navigate]);

  const handleInsertClaim = useCallback((claim) => {
    const claimText =
      '\n' + (claim.claim_text || claim.claim || '') +
      ' [' + (claim.source_outlets?.[0] || 'Source') + ']\n';

    const existing = (() => {
      try {
        const s = sessionStorage.getItem('quarry_write_session');
        return s ? JSON.parse(s) : {};
      } catch { return {}; }
    })();

    sessionStorage.setItem('quarry_write_session', JSON.stringify({
      ...existing,
      query:         existing.query || query,
      sources:       sourcesRef.current,
      claims:        claimsDataRef.current,
      pipelineTrace: pipelineTraceRef.current,
      insertedClaim: claimText,
    }));
    navigate('/write');
  }, [query, navigate]);

  const runFollowUp = useCallback(async followUpText => {
    if (followUpBlocks.length >= MAX_FOLLOW_UPS) return;
    if (followUpAbortRef.current) followUpAbortRef.current.abort();
    followUpAbortRef.current = new AbortController();

    const blockId = `fu_${Date.now()}`;
    const followUpVisualQuery = deriveImageQuery(followUpText, submittedQueryRef.current);
    setFollowUpBlocks(prev => [...prev, { id: blockId, question: followUpText, sources: [], answer: '', streaming: true, errorMsg: '', relatedSearches: [], loadingRelated: false, visualQuery: followUpVisualQuery }]);

    let blockAnswer = '';
    try {
      const res = await fetch(`${API}/explore/search`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: followUpText, context: submittedQueryRef.current }),
        signal: followUpAbortRef.current.signal,
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || `HTTP ${res.status}`); }

      const reader = res.body.getReader(), decoder = new TextDecoder();
      let buf = '';
      const update = updater => setFollowUpBlocks(prev => prev.map(b => b.id === blockId ? updater(b) : b));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n\n'); buf = parts.pop();
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') { update(b => ({ ...b, streaming: false })); break; }
          try {
            const evt = JSON.parse(raw);
            if      (evt.type === 'sources') update(b => ({ ...b, sources: evt.sources || [] }));
            else if (evt.type === 'chunk')   { blockAnswer += evt.text; update(b => ({ ...b, answer: b.answer + evt.text })); }
            else if (evt.type === 'error')   update(b => ({ ...b, errorMsg: evt.text }));
          } catch { /* ignore */ }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') setFollowUpBlocks(prev => prev.map(b => b.id === blockId ? { ...b, streaming: false, errorMsg: err.message } : b));
    } finally {
      setFollowUpBlocks(prev => prev.map(b => b.id === blockId ? { ...b, streaming: false, loadingRelated: !!blockAnswer, visualQuery: followUpVisualQuery } : b));
      if (blockAnswer) {
        fetch(`${API}/explore/related`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: followUpText, answer_snippet: blockAnswer.slice(0, 500) }) })
          .then(r => r.json())
          .then(data => setFollowUpBlocks(prev => prev.map(b => b.id === blockId ? { ...b, relatedSearches: data.related || [], loadingRelated: false } : b)))
          .catch(() => setFollowUpBlocks(prev => prev.map(b => b.id === blockId ? { ...b, loadingRelated: false } : b)));
      }
    }
  }, [followUpBlocks.length]);

  const resetSearch = () => {
    if (followUpAbortRef.current) followUpAbortRef.current.abort();
    setPhase('idle'); setAnswer(''); setSources([]); sourcesRef.current = [];
    setQuery(''); setErrorMsg(''); setFollowUpBlocks([]);
    setIsDeepSearch(false); setDeepLabel(''); setStockData(null);
    setClaimsData([]); claimsDataRef.current = [];
    setPipelineTrace(null); pipelineTraceRef.current = null;
    setGapsData([]); gapsDataRef.current = [];
    setQuotesData([]); quotesDataRef.current = [];
  };

  const newSearch = q => { setQuery(q); runSearch(q); };

  // ── Home (idle) ──
  if (phase === 'idle') {
    if (!searchParams.get('q')) {
      return <Navigate to="/" replace />;
    }
    return (
      <>
        {/* Top-right nav cluster — sits below calendar bar when visible */}
        <div style={{ position: 'fixed', top: topOffset + 12 + (settings.showCalendar ? 36 : 0), right: 16, zIndex: 50, transition: 'top 0.18s ease' }}>
          <NavControls />
        </div>

        <Box sx={{ ...PAGE_BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', minHeight: '100vh', gap: 1.5, px: 3, pb: 8, paddingTop: `${topOffset + 12}px` }}>


          {/* ── Masthead ── */}
          <Box sx={{ textAlign: 'center', mb: 0.5 }}>
            {/* Top rule with label */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
              <Box sx={{ flex: 1, height: '1px', bgcolor: 'var(--fg-primary)', opacity: 0.12 }} />
              <Typography sx={{
                fontFamily: 'var(--font-family)', fontSize: '0.55rem', fontWeight: 500,
                color: 'var(--fg-dim)', letterSpacing: '0.26em', textTransform: 'uppercase',
              }}>
                AI Research Engine
              </Typography>
              <Box sx={{ flex: 1, height: '1px', bgcolor: 'var(--fg-primary)', opacity: 0.12 }} />
            </Box>

            {/* Serif wordmark */}
            <Typography sx={{
              fontFamily: 'var(--font-serif)', fontSize: { xs: '1.5rem', sm: '1.9rem' },
              fontWeight: 600, color: 'var(--fg-primary)', letterSpacing: '-0.02em',
              lineHeight: 1, mb: 0.75,
            }}>
              Quarry
            </Typography>

            {/* Bottom rule */}
            <Box sx={{ height: '1px', bgcolor: 'var(--fg-primary)', opacity: 0.12, mb: 1 }} />

            {/* Tagline */}
            <Typography sx={{
              fontFamily: 'var(--font-family)', fontSize: '0.82rem', fontStyle: 'italic',
              color: 'var(--fg-secondary)', letterSpacing: '0.02em',
            }}>
              Search the web. Synthesise sources. Cite with confidence.
            </Typography>
          </Box>

          <HomeSearchBar query={query} setQuery={setQuery} onSubmit={handleSubmit} deepMode={isDeep} onToggleDeep={() => setIsDeep(d => !d)} />

          {/* ── Two-column body: Watchlist + Trending + CTAs ── */}
          <Box sx={{ width: '100%', maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 1.5 }}>

            {/* Row 1: Watchlist | Trending */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', gap: 0, alignItems: 'stretch' }}>

              {/* Left — Watchlist */}
              <Box sx={{ pr: 1.5, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
                  <TrendingUp size={10} color="var(--accent)" />
                  <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.55rem', fontWeight: 500, color: 'var(--fg-dim)', letterSpacing: '0.10em', textTransform: 'uppercase' }}>
                    Watchlist
                  </Typography>
                </Box>
                <Box sx={{ flex: 1 }}><WatchlistGrid dark={dark} /></Box>
              </Box>

              {/* Divider */}
              <Box sx={{ bgcolor: dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)', mx: 0 }} />

              {/* Right — Trending pills */}
              <Box sx={{ pl: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
                  <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: isTrending ? 'var(--accent)' : 'var(--fg-dim)', flexShrink: 0, animation: isTrending ? 'trendingPulse 1.4s ease-in-out infinite' : 'none' }} />
                  <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.55rem', fontWeight: 500, color: 'var(--fg-dim)', letterSpacing: '0.10em', textTransform: 'uppercase' }}>
                    {isTrending ? 'Trending' : 'Suggested'}
                  </Typography>
                  <Box onClick={refetchTrending} sx={{ cursor: 'pointer', opacity: 0.5, '&:hover': { opacity: 1 }, ml: 0.25 }}>
                    <RefreshCw size={10} color="var(--fg-dim)" style={{ animation: trendingSpinning ? 'spin 1s linear infinite' : 'none' }} />
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  {trendingArticles.slice(0, 6).map((art, i) => (
                    <Box
                      key={i}
                      onClick={() => newSearch(art.title)}
                      sx={{
                        display: 'flex', flexDirection: 'column', gap: 0.25,
                        px: 1, py: '7px',
                        cursor: 'pointer',
                        borderRadius: '8px',
                        transition: 'all 0.14s ease',
                        borderBottom: i < 5 ? (dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)') : 'none',
                        '&:hover': {
                          background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(249,115,22,0.05)',
                          borderColor: 'transparent',
                        },
                      }}
                    >
                      {art.source?.name && (
                        <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.48rem', fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.12em', textTransform: 'uppercase', lineHeight: 1 }}>
                          {art.source.name}
                        </Typography>
                      )}
                      <Typography sx={{
                        fontFamily: 'var(--font-family)', fontSize: '0.70rem', fontWeight: 500,
                        color: 'var(--fg-primary)', lineHeight: 1.3,
                        display: '-webkit-box', WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {art.title}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>

            </Box>

            {/* Row 2: CTAs */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 1, width: '100%' }}>

            {/* Finance Terminal */}
            <Box onClick={() => navigate('/finance')} sx={{
              display: 'flex', flexDirection: 'column', gap: 1,
              px: 2, py: 1.5,
              borderRadius: '12px',
              border: dark ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(0,0,0,0.10)',
              background: dark
                ? 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.04) 100%)'
                : 'linear-gradient(135deg, rgba(255,248,235,0.95) 0%, rgba(254,242,220,0.85) 100%)',
              cursor: 'pointer',
              boxShadow: dark ? '0 1px 4px rgba(0,0,0,0.25)' : '0 1px 4px rgba(0,0,0,0.05)',
              transition: 'all 0.18s ease',
              '&:hover': {
                borderColor: 'rgba(249,115,22,0.40)',
                boxShadow: '0 4px 16px rgba(249,115,22,0.12)',
                transform: 'translateY(-1px)',
              },
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ width: 36, height: 36, borderRadius: '10px', bgcolor: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingUp size={18} color="var(--accent)" />
                </Box>
                <Box sx={{ color: 'var(--fg-dim)', opacity: 0.4, fontSize: '1rem' }}>›</Box>
              </Box>
              <Box>
                <Typography sx={{ fontFamily: 'var(--font-serif)', fontSize: '1.05rem', fontWeight: 700, color: 'var(--fg-primary)', lineHeight: 1.2, letterSpacing: '-0.01em' }}>
                  Finance Terminal
                </Typography>
                <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.66rem', fontWeight: 400, fontStyle: 'italic', color: 'var(--fg-secondary)', mt: 0.35, lineHeight: 1.4 }}>
                  Live prices, charts & market AI with QFL commands
                </Typography>
              </Box>
            </Box>

          </Box>{/* end CTAs row */}
          </Box>{/* end two-column + CTAs wrapper */}

          {/* Saved searches shortcut */}
          {(() => { const savedCount = getSaved().length; return savedCount > 0 && (
            <Box onClick={() => navigate('/saved')} sx={{
              display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.7,
              borderRadius: '8px', border: '1px solid var(--border)',
              background: 'rgba(30,58,138,0.06)', cursor: 'pointer',
              transition: 'all 0.16s ease',
              '&:hover': { background: 'rgba(30,58,138,0.12)', borderColor: 'rgba(30,58,138,0.25)', transform: 'translateY(-1px)', boxShadow: '0 3px 10px rgba(30,58,138,0.08)' },
            }}>
              <BookmarkPlus size={13} color="var(--blue)" />
              <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.76rem', fontWeight: 500, color: 'var(--fg-primary)' }}>
                {savedCount} saved search{savedCount !== 1 ? 'es' : ''}
              </Typography>
            </Box>
          ); })()}


          <style>{`
            @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
          `}</style>
        </Box>
        <Toast show={toast.show} message={toast.message} />
      </>
    );
  }

  // ── Searching ──
  if (phase === 'searching') {
    return (
      <Box sx={{ ...PAGE_BG, height: '100vh', overflowY: 'auto', paddingTop: `${topOffset}px` }}>
        <TopBar
          query={query} setQuery={setQuery} onSubmit={handleSubmit}
          deepMode={isDeep} onToggleDeep={() => setIsDeep(d => !d)}
          onReset={resetSearch} answer={answer} onSave={handleSave} onShare={handleShare}
          saved={saved} navigate={navigate} streaming={streaming}
          onWrite={sources.length > 0 ? handleWrite : undefined}
        />
        <Box sx={{ maxWidth: 1100, mx: 'auto', px: 3, pt: 4, pb: 8 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <CircularProgress size={14} sx={{ color: 'var(--accent)' }} />
            <Typography sx={{ fontFamily: 'var(--font-family)', fontWeight: 400, fontSize: '0.8rem', color: 'var(--fg-secondary)' }}>
              {deepLabel === '1/2' ? '⚡ Deep Search 1/2: Searching the web…' :
               deepLabel === '2/2' ? '⚡ Deep Search 2/2: Running deep analysis…' :
               'Searching the web and reasoning…'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
            <Box sx={{ width: { xs: '100%', md: '300px' }, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <GlassCard style={{ padding: '16px' }}>
                <Skeleton variant="rectangular" width="60%" height={10} sx={{ borderRadius: 4, bgcolor: 'var(--bg-tertiary)', mb: 3 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <Skeleton variant="rectangular" width="30%" height={40} sx={{ borderRadius: 8, bgcolor: 'var(--bg-tertiary)' }} />
                  <Box sx={{ width: '40%' }}>
                    <Skeleton variant="rectangular" width="100%" height={14} sx={{ borderRadius: 4, bgcolor: 'var(--bg-tertiary)', mb: 1 }} />
                    <Skeleton variant="rectangular" width="100%" height={14} sx={{ borderRadius: 4, bgcolor: 'var(--bg-tertiary)' }} />
                  </Box>
                </Box>
              </GlassCard>
              <GlassCard style={{ padding: '16px' }}>
                <Skeleton variant="rectangular" width="60%" height={10} sx={{ borderRadius: 4, bgcolor: 'var(--bg-tertiary)', mb: 3 }} />
                <Skeleton variant="rectangular" width="100%" height={6} sx={{ borderRadius: 4, bgcolor: 'var(--bg-tertiary)', mb: 2 }} />
                <Skeleton variant="rectangular" width="80%" height={10} sx={{ borderRadius: 4, bgcolor: 'var(--bg-tertiary)', mb: 1 }} />
                <Skeleton variant="rectangular" width="90%" height={10} sx={{ borderRadius: 4, bgcolor: 'var(--bg-tertiary)' }} />
              </GlassCard>
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <GlassCard style={{ padding: '24px 28px' }}>
                <Skeleton variant="rectangular" width="35%" height={10} sx={{ borderRadius: 4, bgcolor: 'var(--bg-tertiary)', mb: 2 }} />
                <Skeleton variant="rectangular" width="70%" height={26} sx={{ borderRadius: 6, bgcolor: 'var(--bg-tertiary)', mb: 1 }} />
                <Skeleton variant="rectangular" width="55%" height={26} sx={{ borderRadius: 6, bgcolor: 'var(--bg-tertiary)', mb: 2 }} />
                <Box sx={{ height: '1px', bgcolor: 'var(--border)', mb: 2 }} />
                {[...Array(6)].map((_, i) => <Skeleton key={i} variant="text" width={`${65 + (i % 4) * 8}%`} sx={{ bgcolor: 'var(--bg-tertiary)', height: 22, mb: 0.5 }} />)}
              </GlassCard>
            </Box>
          </Box>
        </Box>
        <Toast show={toast.show} message={toast.message} />
      </Box>
    );
  }

  // ── Results ──
  const lastFollowUp = followUpBlocks.length > 0 ? followUpBlocks[followUpBlocks.length - 1] : null;
  const canFollowUp  = phase === 'results' && (lastFollowUp ? !lastFollowUp.streaming : (!streaming && answer.length > 0));

  return (
    <Box sx={{ ...PAGE_BG, height: '100vh', display: 'flex', flexDirection: 'column', paddingTop: `${topOffset}px` }}>
      <TopBar
        query={query} setQuery={setQuery} onSubmit={handleSubmit}
        deepMode={isDeep} onToggleDeep={() => setIsDeep(d => !d)}
        onReset={resetSearch} answer={answer} onSave={handleSave} onShare={handleShare}
        saved={saved} navigate={navigate} streaming={streaming}
        onWrite={sources.length > 0 ? handleWrite : undefined}
      />

      {/* Scrollable content */}
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        <Box sx={{ maxWidth: 1100, mx: 'auto', px: 3, pt: 3, pb: 4, display: 'flex', flexDirection: 'column' }}>
          <ResultBlock
            key={submittedQueryRef.current}
            question={submittedQueryRef.current || query} sources={sources} answer={answer}
            streaming={streaming} errorMsg={errorMsg}
            isFollowUp={false} onNewSearch={newSearch}
            isDeepSearch={isDeepSearch} deepLabel={deepLabel}
            relatedSearches={relatedSearches} loadingRelated={loadingRelated}
            visualQuery={visualQuery} contradictions={contradictions}
            stockData={stockData}
            claims={claimsData} pipelineTrace={pipelineTrace}
            onWrite={handleWrite}
            onInsertClaim={handleInsertClaim}
            gaps={gapsData} quotes={quotesData}
          />

          {followUpBlocks.map((block, i) => (
            <Box key={block.id} ref={i === followUpBlocks.length - 1 ? lastBlockRef : null}>
              <ThreadDivider />
              <ResultBlock
                question={block.question} sources={block.sources}
                answer={block.answer} streaming={block.streaming}
                errorMsg={block.errorMsg} isFollowUp={true} onNewSearch={newSearch}
                relatedSearches={block.relatedSearches || []}
                loadingRelated={block.loadingRelated || false}
                visualQuery={block.visualQuery || ''}
              />
            </Box>
          ))}
        </Box>
      </Box>

      {/* Sticky follow-up bar */}
      {(canFollowUp || followUpBlocks.length >= MAX_FOLLOW_UPS) && (
        <Box sx={{
          borderTop: '1px solid var(--border)',
          background: 'rgba(26,22,20,0.82)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          px: 3, py: 1.25,
          flexShrink: 0,
        }}>
          <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
            <FollowUpBar onSubmit={runFollowUp} atMax={followUpBlocks.length >= MAX_FOLLOW_UPS} />
          </Box>
        </Box>
      )}

      <style>{`@keyframes blinkPulse { 50% { opacity: 0; } }`}</style>
      <Toast show={toast.show} message={toast.message} />
    </Box>
  );
}
