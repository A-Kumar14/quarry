import React, { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import GlassCard from './GlassCard';
import Spinner from './Spinner';

// Format large numbers: 12400 → "12.4k"
function fmt(n) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function EmptyState() {
  return (
    <GlassCard style={{ padding: '28px 24px', background: 'rgba(255,255,255,0.50)', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-family)', fontSize: '0.85rem', color: 'var(--fg-dim)' }}>
        No community perspectives found for this query
      </div>
    </GlassCard>
  );
}

function RedditCard({ post }) {
  const threadUrl = `https://www.reddit.com${post.permalink}`;

  return (
    <GlassCard style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.62)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>

        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <a
            href={threadUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: 1,
              fontFamily: 'var(--font-family)',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--fg-primary)',
              textDecoration: 'none',
              lineHeight: 1.4,
              // 2-line truncation
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {post.title}
          </a>
          <a
            href={threadUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--fg-dim)', flexShrink: 0, marginTop: 2, lineHeight: 1 }}
          >
            <ExternalLink size={13} />
          </a>
        </div>

        {/* Meta row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Subreddit pill */}
          <span style={{
            fontFamily:    'var(--font-family)',
            fontSize:      '0.67rem',
            fontWeight:    600,
            color:         'var(--accent)',
            background:    'rgba(249,115,22,0.10)',
            border:        '1px solid rgba(249,115,22,0.25)',
            borderRadius:  20,
            padding:       '1px 8px',
            whiteSpace:    'nowrap',
          }}>
            {post.subreddit_name_prefixed}
          </span>

          {/* Score */}
          <span style={{
            fontFamily:  'var(--font-family)',
            fontSize:    '0.7rem',
            color:       'var(--fg-dim)',
          }}>
            ↑ {fmt(post.score)}
          </span>

          {/* Comment count */}
          <span style={{
            fontFamily:  'var(--font-family)',
            fontSize:    '0.7rem',
            color:       'var(--fg-dim)',
          }}>
            💬 {fmt(post.num_comments)}
          </span>
        </div>
      </div>
    </GlassCard>
  );
}

export default function PerspectivesTab({ query }) {
  const [posts,  setPosts]  = useState([]);
  const [status, setStatus] = useState('loading'); // 'loading' | 'done' | 'error'

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');

    fetch(
      `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=relevance&limit=5&t=year`,
      { headers: { Accept: 'application/json' } }
    )
      .then(r => { if (!r.ok) throw new Error('non-2xx'); return r.json(); })
      .then(data => {
        if (cancelled) return;
        setPosts((data?.data?.children || []).map(c => c.data));
        setStatus('done');
      })
      .catch(() => { if (!cancelled) setStatus('error'); });

    return () => { cancelled = true; };
  }, [query]);

  if (status === 'loading') {
    return <div style={{ padding: '32px 0' }}><Spinner /></div>;
  }

  if (status === 'error' || posts.length === 0) {
    return <EmptyState />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {posts.map(post => <RedditCard key={post.id} post={post} />)}
    </div>
  );
}
