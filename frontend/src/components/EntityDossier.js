import React, { useState, useMemo } from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import { ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

const TIER_META = {
  1: { label: 'Tier 1', color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)' },
  2: { label: 'Tier 2', color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.25)' },
  3: { label: 'Tier 3', color: '#9ca3af', bg: 'rgba(156,163,175,0.08)', border: 'rgba(156,163,175,0.2)' },
};

function normaliseTier(tier) {
  const n = parseInt(tier, 10);
  if (n === 1 || n === 2 || n === 3) return n;
  return null;
}

function SourceCard({ source, claims, onInsert }) {
  const [expanded, setExpanded] = useState(false);

  const domain = useMemo(() => {
    try { return new URL(source.url || '').hostname.replace('www.', ''); }
    catch { return source.domain || source.outlet_name || 'Source'; }
  }, [source]);

  const tier = normaliseTier(source.credibility_tier);
  const tierMeta = tier ? TIER_META[tier] : null;

  // Find claims from this source
  // eslint-disable-next-line no-unused-vars
  const sourceClaims = useMemo(() => {
    if (!claims || !claims.length) return [];
    return claims.filter(c => {
      const idx = (c.source_indices || []);
      // Try to match by source index or URL
      return idx.length > 0;
    }).slice(0, 3);
  }, [claims]);

  const lean = source.editorial_lean || '';
  const leanColor = lean.toLowerCase().includes('left') ? '#3b82f6'
    : lean.toLowerCase().includes('right') ? '#ef4444'
    : 'var(--fg-dim)';

  return (
    <Box sx={{
      border: '1px solid var(--border)',
      borderRadius: '12px',
      overflow: 'hidden',
      transition: 'all 0.15s',
      '&:hover': { borderColor: 'rgba(249,115,22,0.3)' },
    }}>
      {/* Header */}
      <Box sx={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        padding: '12px 14px', gap: 1.5,
        background: expanded ? 'rgba(249,115,22,0.04)' : 'transparent',
        cursor: 'pointer',
      }}
        onClick={() => setExpanded(e => !e)}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
            <Typography sx={{
              fontFamily: 'var(--font-family)', fontSize: '0.84rem',
              fontWeight: 600, color: 'var(--fg-primary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              maxWidth: 220,
            }}>
              {source.outlet_name || domain}
            </Typography>

            {/* Tier badge */}
            {tierMeta && (
              <span style={{
                fontSize: '0.60rem', fontWeight: 600, padding: '2px 6px',
                borderRadius: 4, background: tierMeta.bg, color: tierMeta.color,
                border: `0.5px solid ${tierMeta.border}`,
              }}>
                {tierMeta.label}
              </span>
            )}

            {/* State-backed badge */}
            {source.state_affiliation && (
              <span style={{
                fontSize: '0.60rem', fontWeight: 600, padding: '2px 6px',
                borderRadius: 4, background: 'rgba(239,68,68,0.12)', color: '#dc2626',
                border: '0.5px solid rgba(239,68,68,0.25)',
              }}>
                State-backed
              </span>
            )}

            {/* Editorial lean */}
            {lean && (
              <span style={{
                fontSize: '0.60rem', fontWeight: 500, padding: '2px 6px',
                borderRadius: 4, background: 'rgba(0,0,0,0.04)',
                color: leanColor, border: '0.5px solid var(--border)',
              }}>
                {lean}
              </span>
            )}
          </Box>

          <Typography sx={{
            fontFamily: 'var(--font-mono)', fontSize: '0.64rem',
            color: 'var(--fg-dim)', mb: 0.5,
          }}>
            {domain}
          </Typography>

          {source.snippet && !expanded && (
            <Typography sx={{
              fontFamily: 'var(--font-family)', fontSize: '0.76rem',
              color: 'var(--fg-secondary)', lineHeight: 1.55,
              display: '-webkit-box', WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {source.snippet}
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0, mt: 0.25 }}>
          <Tooltip title="Open source">
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{ color: 'var(--fg-dim)', display: 'flex', alignItems: 'center' }}
            >
              <ExternalLink size={13} />
            </a>
          </Tooltip>
          {expanded ? <ChevronUp size={14} color="var(--fg-dim)" /> : <ChevronDown size={14} color="var(--fg-dim)" />}
        </Box>
      </Box>

      {/* Expanded body */}
      {expanded && (
        <Box sx={{ px: 2, pb: 1.75, pt: 0.5, borderTop: '1px solid var(--border)', background: 'rgba(249,115,22,0.02)' }}>
          {source.snippet && (
            <Typography sx={{
              fontFamily: 'var(--font-family)', fontSize: '0.78rem',
              color: 'var(--fg-secondary)', lineHeight: 1.65, mb: 1.25,
            }}>
              {source.snippet}
            </Typography>
          )}

          {/* Source metadata */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 1 }}>
            {source.funding_type && (
              <Box>
                <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: 'var(--fg-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Funding</Typography>
                <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.72rem', color: 'var(--fg-secondary)', mt: 0.25 }}>{source.funding_type}</Typography>
              </Box>
            )}
            {source.country && (
              <Box>
                <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: 'var(--fg-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Country</Typography>
                <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.72rem', color: 'var(--fg-secondary)', mt: 0.25 }}>{source.country}</Typography>
              </Box>
            )}
          </Box>

          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontFamily: 'var(--font-family)', fontSize: '0.72rem',
              color: 'var(--accent)', textDecoration: 'none', fontWeight: 500,
            }}
          >
            Read source <ExternalLink size={11} />
          </a>
        </Box>
      )}
    </Box>
  );
}

export default function EntityDossier({ sources = [], claims = [], loading = false, onInsert }) {
  const [filter, setFilter] = useState('all'); // 'all' | '1' | '2' | 'state'

  const filtered = useMemo(() => {
    if (filter === 'all') return sources;
    if (filter === 'state') return sources.filter(s => s.state_affiliation);
    const tier = parseInt(filter, 10);
    return sources.filter(s => parseInt(s.credibility_tier, 10) === tier);
  }, [sources, filter]);

  const stateBacked = sources.filter(s => s.state_affiliation).length;
  const tier1 = sources.filter(s => parseInt(s.credibility_tier, 10) === 1).length;

  if (loading) {
    return (
      <Box sx={{ py: 3, textAlign: 'center' }}>
        <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.78rem', color: 'var(--fg-dim)', fontStyle: 'italic' }}>
          Loading source profiles…
        </Typography>
      </Box>
    );
  }

  if (!sources.length) {
    return (
      <Box sx={{ py: 3, textAlign: 'center' }}>
        <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.82rem', color: 'var(--fg-dim)' }}>
          No source profiles available.
        </Typography>
      </Box>
    );
  }

  const CHIP = (val, label) => (
    <Box
      key={val}
      onClick={() => setFilter(val)}
      sx={{
        px: 1.25, py: 0.4, borderRadius: 999, cursor: 'pointer', flexShrink: 0,
        fontFamily: 'var(--font-family)', fontSize: '0.71rem',
        fontWeight: filter === val ? 500 : 400,
        color: filter === val ? '#fff' : 'var(--fg-secondary)',
        background: filter === val ? 'var(--accent)' : 'var(--gbtn-bg)',
        border: '1px solid',
        borderColor: filter === val ? 'transparent' : 'var(--border)',
        transition: 'all 0.12s',
        '&:hover': { borderColor: 'rgba(249,115,22,0.4)' },
      }}
    >
      {label}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Summary row */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
        <Typography sx={{
          fontFamily: 'var(--font-family)', fontSize: '0.75rem',
          color: 'var(--fg-dim)',
        }}>
          {sources.length} source{sources.length !== 1 ? 's' : ''} analysed
          {tier1 > 0 && <> · <span style={{ color: '#10b981' }}>{tier1} Tier 1</span></>}
          {stateBacked > 0 && <> · <span style={{ color: '#ef4444' }}>{stateBacked} state-backed</span></>}
        </Typography>
      </Box>

      {/* Filter chips */}
      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
        {CHIP('all', 'All')}
        {tier1 > 0 && CHIP('1', `Tier 1 (${tier1})`)}
        {sources.filter(s => parseInt(s.credibility_tier, 10) === 2).length > 0 && CHIP('2', `Tier 2`)}
        {stateBacked > 0 && CHIP('state', `State-backed (${stateBacked})`)}
      </Box>

      {/* Source cards */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {filtered.map((src, i) => (
          <SourceCard key={src.url || i} source={src} claims={claims} onInsert={onInsert} />
        ))}
      </Box>
    </Box>
  );
}
