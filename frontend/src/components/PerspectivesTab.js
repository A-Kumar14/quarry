import React, { useEffect, useState } from 'react';
import { ExternalLink, Search, Layers } from 'lucide-react';
import GlassCard from './GlassCard';
import Spinner from './Spinner';
import { getSourceQuality, QUALITY_COLOR } from '../utils/sourceQuality';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';

/* ── Number formatter ─────────────────────────────────────────────────────── */
function fmt(n) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

/* ── Reddit URL helper ───────────────────────────────────────────────────── */
function buildRedditThreadUrl(permalink) {
  const raw = typeof permalink === 'string' ? permalink.trim() : '';
  if (!raw) return 'https://www.reddit.com';
  if (/^https?:\/\//i.test(raw)) return raw;
  const safePermalink = raw.startsWith('/') ? raw : `/${raw}`;
  try {
    return new URL(safePermalink, 'https://www.reddit.com').toString();
  } catch {
    return 'https://www.reddit.com';
  }
}

/* ── Credibility tier breakdown from sources list ────────────────────────── */
function credibilityBreakdown(subQ, allSources) {
  if (!allSources?.length) return null;
  const counts = { high: 0, medium: 0, unknown: 0 };
  for (const src of allSources) {
    const q = getSourceQuality(src.url);
    counts[q] = (counts[q] || 0) + 1;
  }
  return counts;
}

/* ── Deep mode: sub-query mini-report card ───────────────────────────────── */
function SubQueryCard({ query, index, allSources }) {
  const breakdown = credibilityBreakdown(query, allSources);
  const totalSources = allSources?.length || 0;

  return (
    <GlassCard style={{ padding: '14px 16px', marginBottom: 10 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Header: angle number + question */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
            background: 'rgba(249,115,22,0.12)',
            border: '1px solid rgba(249,115,22,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-mono)', fontSize: '0.68rem', fontWeight: 700,
            color: 'var(--accent)',
          }}>
            {index + 1}
          </div>
          <div style={{
            fontFamily: 'var(--font-family)', fontSize: '0.86rem',
            fontWeight: 600, color: 'var(--fg-primary)', lineHeight: 1.4, flex: 1,
          }}>
            {query}
          </div>
        </div>

        {/* Source count + credibility tier breakdown */}
        {totalSources > 0 && breakdown && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingLeft: 34 }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--fg-dim)',
            }}>
              {totalSources} source{totalSources !== 1 ? 's' : ''}
            </span>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              {Object.entries(breakdown).filter(([, v]) => v > 0).map(([tier, count]) => (
                <span key={tier} style={{
                  fontFamily: 'var(--font-family)', fontSize: '0.60rem', fontWeight: 600,
                  color: QUALITY_COLOR[tier],
                  background: `${QUALITY_COLOR[tier]}15`,
                  border: `1px solid ${QUALITY_COLOR[tier]}30`,
                  borderRadius: 99, padding: '1px 7px',
                }}>
                  {count} {tier}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Empty sources hint */}
        {totalSources === 0 && (
          <div style={{
            paddingLeft: 34,
            fontFamily: 'var(--font-family)', fontSize: '0.77rem',
            color: 'var(--fg-dim)', fontStyle: 'italic',
          }}>
            Sources loaded during search — run a query to populate.
          </div>
        )}
      </div>
    </GlassCard>
  );
}

/* ── Deep mode panel ─────────────────────────────────────────────────────── */
function DeepModePerspectives({ subQueries, sources }) {
  if (!subQueries?.length) {
    return (
      <GlassCard style={{ padding: '24px', textAlign: 'center' }}>
        <Layers size={20} style={{ color: 'var(--fg-dim)', display: 'block', margin: '0 auto 10px' }} />
        <div style={{ fontFamily: 'var(--font-family)', fontSize: '0.85rem', color: 'var(--fg-dim)' }}>
          Deep mode sub-queries will appear here after search completes.
        </div>
      </GlassCard>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
        <Search size={12} color="var(--accent)" />
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: '0.65rem', fontWeight: 600,
          color: 'var(--fg-dim)', letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          {subQueries.length} angle{subQueries.length !== 1 ? 's' : ''} investigated
        </span>
      </div>

      {subQueries.map((q, i) => (
        <SubQueryCard key={i} query={q} index={i} allSources={sources} />
      ))}
    </div>
  );
}

/* ── Reddit card ─────────────────────────────────────────────────────────── */
function RedditCard({ post }) {
  const threadUrl = buildRedditThreadUrl(post?.permalink);
  return (
    <GlassCard style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>

        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <a
            href={threadUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: 1,
              fontFamily: 'var(--font-family)', fontSize: '0.875rem', fontWeight: 600,
              color: 'var(--fg-primary)', textDecoration: 'none', lineHeight: 1.4,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}
          >
            {post.title}
          </a>
          <a href={threadUrl} target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--fg-dim)', flexShrink: 0, marginTop: 2 }}>
            <ExternalLink size={13} />
          </a>
        </div>

        {/* Meta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            fontFamily: 'var(--font-family)', fontSize: '0.67rem', fontWeight: 600,
            color: 'var(--accent)', background: 'rgba(249,115,22,0.10)',
            border: '1px solid rgba(249,115,22,0.25)', borderRadius: 20, padding: '1px 8px',
          }}>
            {post.subreddit_name_prefixed}
          </span>
          <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.7rem', color: 'var(--fg-dim)' }}>
            ↑ {fmt(post.score)}
          </span>
          <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.7rem', color: 'var(--fg-dim)' }}>
            💬 {fmt(post.num_comments)}
          </span>
        </div>
      </div>
    </GlassCard>
  );
}

function EmptyState() {
  return (
    <GlassCard style={{ padding: '28px 24px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-family)', fontSize: '0.85rem', color: 'var(--fg-dim)' }}>
        No community perspectives found for this query
      </div>
    </GlassCard>
  );
}

/* ── Main export ──────────────────────────────────────────────────────────── */
export default function PerspectivesTab({ query, isDeepMode = false, subQueries = [], sources = [], prefetchedData = null }) {
  const [posts,  setPosts]  = useState([]);
  const [opinionSummary, setOpinionSummary] = useState('');
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    if (isDeepMode) return; // deep mode doesn't fetch Reddit
    if (prefetchedData && typeof prefetchedData === 'object') {
      setPosts(prefetchedData.posts || []);
      setOpinionSummary(typeof prefetchedData.opinionSummary === 'string' ? prefetchedData.opinionSummary : '');
      setStatus(prefetchedData.status || 'idle');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    fetch(`${API}/explore/perspectives?q=${encodeURIComponent(query)}&limit=5`)
      .then(r => { if (!r.ok) throw new Error('non-2xx'); return r.json(); })
      .then(data => {
        if (cancelled) return;
        setPosts(data?.posts || []);
        setOpinionSummary(typeof data?.opinion_summary === 'string' ? data.opinion_summary : '');
        setStatus('done');
      })
      .catch(() => { if (!cancelled) { setOpinionSummary(''); setStatus('error'); } });
    return () => { cancelled = true; };
  }, [query, isDeepMode, prefetchedData]);

  /* Deep mode: show sub-query angle cards */
  if (isDeepMode) {
    return <DeepModePerspectives subQueries={subQueries} sources={sources} />;
  }

  /* Standard mode: Reddit posts */
  if (status === 'loading') {
    return <div style={{ padding: '32px 0' }}><Spinner /></div>;
  }

  if (status === 'error' || posts.length === 0) return <EmptyState />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {opinionSummary && (
        <GlassCard style={{ padding: '12px 14px' }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.62rem',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--fg-dim)',
            marginBottom: 6,
          }}>
            Reddit pulse
          </div>
          <div style={{
            fontFamily: 'var(--font-family)',
            fontSize: '0.82rem',
            lineHeight: 1.5,
            color: 'var(--fg-secondary)',
          }}>
            {opinionSummary}
          </div>
        </GlassCard>
      )}
      {posts.map(post => <RedditCard key={post.id} post={post} />)}
    </div>
  );
}
