import React, { useEffect, useState } from 'react';
import { ChevronRight, RefreshCw, Star } from 'lucide-react';
import Spinner from './Spinner';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const F   = "'DM Sans', 'Libre Franklin', system-ui, sans-serif";

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function relativeTime(iso) {
  if (!iso) return '';
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (days  > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins  > 0) return `${mins}m ago`;
  return 'just now';
}

function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return ''; }
}

/* ── Favicon with letter fallback ─────────────────────────────────────────── */
function Favicon({ url, name }) {
  const domain  = getDomain(url);
  const initial = (name || '?')[0].toUpperCase();
  const [ok, setOk] = useState(!!domain);

  if (!domain || !ok) {
    return (
      <div style={{
        width: 16, height: 16, borderRadius: 3, flexShrink: 0,
        background: '#e8eaed', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: '0.58rem', fontWeight: 700, color: '#5f6368',
      }}>
        {initial}
      </div>
    );
  }

  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
      alt=""
      width={16}
      height={16}
      onError={() => setOk(false)}
      style={{ borderRadius: 2, flexShrink: 0, display: 'block' }}
    />
  );
}

/* ── News card ────────────────────────────────────────────────────────────── */
function NewsCard({ article, isLeftCol }) {
  const [thumbOk, setThumbOk] = useState(true);
  const [hov,     setHov]     = useState(false);

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: 'none', display: 'block' }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #e8eaed',
        borderRight: isLeftCol ? '1px solid #e8eaed' : 'none',
        display: 'flex', flexDirection: 'column', gap: 8,
        height: '100%', boxSizing: 'border-box',
      }}>

        {/* Source row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Favicon url={article.url} name={article.source?.name} />
          <span style={{ fontFamily: F, fontSize: '0.75rem', color: '#70757a', fontWeight: 400 }}>
            {article.source?.name}
          </span>
        </div>

        {/* Headline + thumbnail */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1 }}>
          <div style={{
            fontFamily: F, fontSize: '0.875rem', fontWeight: 600,
            color: hov ? '#1a73e8' : '#202124',
            lineHeight: 1.45, flex: 1, minWidth: 0,
            display: '-webkit-box', WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
            transition: 'color 0.15s',
          }}>
            {article.title}
          </div>

          {article.image && thumbOk && (
            <img
              src={article.image}
              alt=""
              onError={() => setThumbOk(false)}
              style={{
                width: 80, height: 80, objectFit: 'cover',
                borderRadius: 4, flexShrink: 0, display: 'block',
              }}
            />
          )}
        </div>

        {/* Timestamp */}
        <div style={{ fontFamily: F, fontSize: '0.72rem', color: '#70757a' }}>
          {relativeTime(article.publishedAt)}
          {article.author ? ` · By ${article.author}` : ''}
        </div>

      </div>
    </a>
  );
}

/* ── Save button ──────────────────────────────────────────────────────────── */
function SaveButton() {
  const [saved, setSaved] = useState(false);
  const [hov,   setHov]   = useState(false);
  return (
    <button
      onClick={() => setSaved(s => !s)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '6px 16px', borderRadius: 20,
        border: '1px solid #dadce0',
        background: hov ? '#f8f9fa' : '#fff',
        cursor: 'pointer', fontFamily: F,
        fontSize: '0.875rem', fontWeight: 500, color: '#202124',
        transition: 'background 0.15s',
      }}
    >
      <Star size={15} fill={saved ? '#202124' : 'none'} stroke="#202124" strokeWidth={1.8} />
      {saved ? 'Saved' : 'Save'}
    </button>
  );
}

/* ── Topic chip ───────────────────────────────────────────────────────────── */
function Chip({ label }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '6px 14px', borderRadius: 9999, whiteSpace: 'nowrap',
        border: '1px solid #dadce0',
        background: hov ? '#f1f3f4' : '#fff',
        cursor: 'pointer', fontFamily: F,
        fontSize: '0.8rem', fontWeight: 400, color: '#202124',
        transition: 'background 0.15s',
      }}
    >
      {label}
    </button>
  );
}

/* ── Error state ──────────────────────────────────────────────────────────── */
function ErrorState({ onRetry }) {
  return (
    <div style={{ padding: '48px 0', textAlign: 'center' }}>
      <div style={{ fontFamily: F, fontSize: '0.875rem', color: '#70757a', marginBottom: 16 }}>
        Could not load news
      </div>
      <button
        onClick={onRetry}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '7px 18px', borderRadius: 9999,
          border: '1px solid #dadce0', background: '#fff',
          cursor: 'pointer', fontFamily: F, fontSize: '0.8rem',
          fontWeight: 600, color: '#202124',
        }}
      >
        <RefreshCw size={13} /> Retry
      </button>
    </div>
  );
}

/* ── Main component ───────────────────────────────────────────────────────── */
export default function NewsTab({ query }) {
  const [articles,     setArticles]     = useState([]);
  const [status,       setStatus]       = useState('loading');
  const [visibleCount, setVisibleCount] = useState(8);
  const [retry,        setRetry]        = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setArticles([]);
    setVisibleCount(8);
    fetch(`${API}/explore/news?q=${encodeURIComponent(query)}&max=10`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => {
        if (cancelled) return;
        const arts = data.articles || [];
        setArticles(arts);
        setStatus(arts.length ? 'done' : 'empty');
      })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, [query, retry]);

  if (status === 'loading') return <div style={{ padding: '40px 0' }}><Spinner /></div>;
  if (status === 'error')   return <ErrorState onRetry={() => setRetry(r => r + 1)} />;
  if (status === 'empty' || articles.length === 0) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', fontFamily: F, fontSize: '0.875rem', color: '#70757a' }}>
        No news found for this query
      </div>
    );
  }

  const visible   = articles.slice(0, visibleCount);
  const remaining = articles.length - visibleCount;

  // Derive Topics from unique source names
  const topics = [...new Set(articles.map(a => a.source?.name).filter(Boolean))];

  // Section header title from top article
  const sectionTitle = articles[0]?.title || query;

  return (
    <>
      <style>{`
        .news-layout {
          display: flex;
          gap: 24px;
          align-items: flex-start;
        }
        .news-main { flex: 1; min-width: 0; }
        .news-sidebar { width: 240px; flex-shrink: 0; }
        .news-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
        }
        @media (max-width: 1024px) {
          .news-layout { flex-direction: column; }
          .news-sidebar { width: 100%; }
        }
        @media (max-width: 640px) {
          .news-grid { grid-template-columns: 1fr; }
        }
        .news-header-link:hover .news-header-title { text-decoration: underline; }
      `}</style>

      <div className="news-layout">

        {/* ── Main panel ── */}
        <div className="news-main" style={{
          background: '#fff', borderRadius: 10, border: '1px solid #e8eaed',
        }}>
          {/* Section header */}
          <a
            href={`https://news.google.com/search?q=${encodeURIComponent(query)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="news-header-link"
            style={{ textDecoration: 'none', display: 'block' }}
          >
            <div style={{
              padding: '14px 16px',
              borderBottom: '1px solid #e8eaed',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <h2
                className="news-header-title"
                style={{
                  fontFamily: F, fontSize: '1rem', fontWeight: 600,
                  color: '#202124', margin: 0, flex: 1,
                  display: '-webkit-box', WebkitLineClamp: 1,
                  WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}
              >
                {sectionTitle}
              </h2>
              <ChevronRight size={18} color="#70757a" style={{ flexShrink: 0 }} />
            </div>
          </a>

          {/* 2-column card grid */}
          <div className="news-grid">
            {visible.map((article, i) => (
              <NewsCard key={i} article={article} isLeftCol={i % 2 === 0} />
            ))}
          </div>

          {/* Show more */}
          {remaining > 0 && (
            <div style={{ padding: '11px 16px', borderTop: '1px solid #e8eaed' }}>
              <button
                onClick={() => setVisibleCount(c => c + 6)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: F, fontSize: '0.8rem', fontWeight: 600,
                  color: '#1a73e8', padding: 0,
                }}
              >
                Show {remaining} more article{remaining !== 1 ? 's' : ''}
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className="news-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SaveButton />

          {topics.length > 0 && (
            <div style={{
              background: '#fff', borderRadius: 10,
              border: '1px solid #e8eaed', padding: '16px',
            }}>
              <div style={{
                fontFamily: F, fontSize: '0.875rem', fontWeight: 600,
                color: '#202124', marginBottom: 12,
              }}>
                Topics
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {topics.map((t, i) => <Chip key={i} label={t} />)}
              </div>
            </div>
          )}
        </div>

      </div>
    </>
  );
}
