import React, { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import GlassCard from './GlassCard';

const GNEWS_KEY = process.env.REACT_APP_GNEWS_API_KEY;

function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (days > 0)  return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0)  return `${mins}m ago`;
  return 'just now';
}

function buildSummary(articles) {
  const sentences = articles
    .slice(0, 3)
    .map(a => (a.description || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (!sentences.length) return '';
  const joined = sentences.join(' ');
  const all = joined.match(/[^.!?]+[.!?]+/g) || [];
  return all.slice(0, 2).join(' ').trim() || sentences[0].slice(0, 200);
}

function Spinner() {
  return (
    <>
      <div style={{
        width: 20, height: 20, borderRadius: '50%',
        border: '2px solid var(--border)',
        borderTopColor: 'var(--accent)',
        animation: 'newsSpin 0.7s linear infinite',
        margin: '0 auto',
      }} />
      <style>{`@keyframes newsSpin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

function NewsCard({ article }) {
  const [imgOk, setImgOk] = useState(true);

  return (
    <a href={article.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
      <GlassCard style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.62)', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>

          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{
              fontFamily: 'var(--font-family)', fontSize: '0.875rem', fontWeight: 600,
              color: 'var(--fg-primary)', lineHeight: 1.4,
              display: '-webkit-box', WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {article.title}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{
                fontFamily: 'var(--font-family)', fontSize: '0.7rem',
                fontWeight: 600, color: 'var(--accent)',
              }}>
                {article.source?.name}
              </span>
              <span style={{
                fontFamily: 'var(--font-family)', fontSize: '0.7rem', color: 'var(--fg-dim)',
              }}>
                {relativeTime(article.publishedAt)}
              </span>
              <ExternalLink size={10} color="var(--fg-dim)" style={{ marginLeft: 'auto' }} />
            </div>
          </div>

          {article.image && imgOk && (
            <img
              src={article.image}
              alt=""
              onError={() => setImgOk(false)}
              style={{
                width: 80, height: 60, objectFit: 'cover',
                borderRadius: 8, flexShrink: 0,
              }}
            />
          )}
        </div>
      </GlassCard>
    </a>
  );
}

export default function NewsTab({ query }) {
  const [articles, setArticles] = useState([]);
  const [summary,  setSummary]  = useState('');
  const [status,   setStatus]   = useState('loading');

  useEffect(() => {
    if (!GNEWS_KEY) { setStatus('error'); return; }
    let cancelled = false;
    setStatus('loading');

    fetch(
      `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&max=6&apikey=${GNEWS_KEY}`,
      { headers: { Accept: 'application/json' } }
    )
      .then(r => { if (!r.ok) throw new Error(`gnews HTTP ${r.status}`); return r.json(); })
      .then(data => {
        if (cancelled) return;
        const arts = data.articles || [];
        setArticles(arts);
        setSummary(buildSummary(arts));
        setStatus('done');
      })
      .catch(() => { if (!cancelled) setStatus('error'); });

    return () => { cancelled = true; };
  }, [query]);

  if (status === 'loading') {
    return <div style={{ padding: '32px 0' }}><Spinner /></div>;
  }

  if (status === 'error' || articles.length === 0) {
    return (
      <GlassCard style={{ padding: '28px 24px', background: 'rgba(255,255,255,0.50)', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-family)', fontSize: '0.85rem', color: 'var(--fg-dim)' }}>
          No news found for this query
        </div>
      </GlassCard>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {summary && (
        <GlassCard style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.55)', borderLeft: '3px solid var(--accent)' }}>
          <div style={{
            fontFamily: 'var(--font-family)', fontSize: '0.6rem', fontWeight: 700,
            color: 'var(--accent)', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 6,
          }}>
            News Summary
          </div>
          <div style={{ fontFamily: 'var(--font-family)', fontSize: '0.83rem', color: 'var(--fg-secondary)', lineHeight: 1.6 }}>
            {summary}
          </div>
        </GlassCard>
      )}
      {articles.map((a, i) => <NewsCard key={i} article={a} />)}
    </div>
  );
}
