import React, { useEffect, useState, useCallback } from 'react';
import GlassCard from './GlassCard';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function Spinner({ small }) {
  return (
    <>
      <div style={{
        width: small ? 14 : 20,
        height: small ? 14 : 20,
        borderRadius: '50%',
        border: '2px solid var(--border)',
        borderTopColor: 'var(--accent)',
        animation: 'imgSpin 0.7s linear infinite',
        margin: small ? '0' : '0 auto',
        flexShrink: 0,
      }} />
      <style>{`@keyframes imgSpin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

export default function ImagesTab({ query }) {
  const [photos,      setPhotos]      = useState([]);
  const [status,      setStatus]      = useState('loading');
  const [page,        setPage]        = useState(0);
  const [hasMore,     setHasMore]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPage = useCallback(async (pageNum, append = false) => {
    const url = `${API}/explore/images?q=${encodeURIComponent(query)}&page=${pageNum}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    const imgs = data.images || [];
    if (append) {
      setPhotos(prev => [...prev, ...imgs]);
    } else {
      setPhotos(imgs);
    }
    setHasMore(imgs.length >= 6);
    return imgs;
  }, [query]);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    setPhotos([]);
    setPage(0);
    setHasMore(true);
    setStatus('loading');

    fetchPage(0)
      .then(imgs => { if (!cancelled) setStatus(imgs.length ? 'done' : 'empty'); })
      .catch(() => { if (!cancelled) setStatus('error'); });

    return () => { cancelled = true; };
  }, [query, fetchPage]);

  const handleShowMore = () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPage(nextPage, true)
      .catch(() => setHasMore(false))
      .finally(() => setLoadingMore(false));
  };

  if (status === 'loading') {
    return <div style={{ padding: '32px 0' }}><Spinner /></div>;
  }

  if (status === 'error' || status === 'empty' || photos.length === 0) {
    return (
      <GlassCard style={{ padding: '28px 24px', background: 'rgba(255,255,255,0.50)', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-family)', fontSize: '0.85rem', color: 'var(--fg-dim)' }}>
          {status === 'error'
            ? 'Could not load images — check your ScrapingBee API key'
            : 'No images found for this query'}
        </div>
      </GlassCard>
    );
  }

  return (
    <>
      <style>{`
        .img-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }
        @media (max-width: 768px) {
          .img-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 480px) {
          .img-grid { grid-template-columns: 1fr; }
        }
        .img-cell {
          position: relative;
          overflow: hidden;
          border-radius: 12px;
          display: block;
          text-decoration: none;
        }
        .img-cell img {
          width: 100%;
          height: 180px;
          object-fit: cover;
          display: block;
          transition: transform 0.22s ease;
        }
        .img-cell:hover img { transform: scale(1.02); }
        .img-overlay {
          position: absolute;
          bottom: 0; left: 0; right: 0;
          padding: 20px 10px 8px;
          background: linear-gradient(transparent, rgba(0,0,0,0.52));
          opacity: 0;
          transition: opacity 0.22s ease;
          font-family: var(--font-family);
          font-size: 0.72rem;
          font-weight: 500;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .img-cell:hover .img-overlay { opacity: 1; }
      `}</style>

      <div className="img-grid">
        {photos.map((photo, i) => (
          <a
            key={i}
            href={photo.source || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="img-cell"
          >
            <img
              src={photo.image}
              alt={photo.title || query}
              onError={e => { e.target.style.display = 'none'; }}
            />
            <div className="img-overlay">{photo.title || photo.domain || ''}</div>
          </a>
        ))}
      </div>

      {hasMore && (
        <button
          onClick={handleShowMore}
          disabled={loadingMore}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            width: '100%',
            marginTop: 12,
            padding: '9px 0',
            border: '1px solid var(--border)',
            borderRadius: 12,
            background: 'rgba(255,255,255,0.45)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            cursor: loadingMore ? 'default' : 'pointer',
            fontFamily: 'var(--font-family)',
            fontSize: '0.78rem',
            fontWeight: 600,
            color: loadingMore ? 'var(--fg-dim)' : 'var(--fg-secondary)',
            transition: 'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={e => { if (!loadingMore) { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = loadingMore ? 'var(--fg-dim)' : 'var(--fg-secondary)'; }}
        >
          {loadingMore ? <><Spinner small /> Loading…</> : 'Show more images'}
        </button>
      )}
    </>
  );
}
