import React, { useEffect, useRef, useState, useCallback } from 'react';
import Spinner from './Spinner';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const F   = "'DM Sans', 'Libre Franklin', system-ui, sans-serif";

/* ── Favicon with letter fallback ─────────────────────────────────────────── */
function Favicon({ domain, name, size = 16 }) {
  const [ok, setOk] = useState(!!domain);
  const initial = (name || domain || '?')[0].toUpperCase();

  if (!domain || !ok) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: '#e8eaed', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: size * 0.55, fontWeight: 700, color: '#5f6368',
      }}>
        {initial}
      </div>
    );
  }
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
      alt=""
      width={size}
      height={size}
      onError={() => setOk(false)}
      style={{ borderRadius: '50%', flexShrink: 0, display: 'block' }}
    />
  );
}

/* ── Individual image card ────────────────────────────────────────────────── */
function ImageCard({ photo, onClick }) {
  const [loaded, setLoaded] = useState(false);
  const [error,  setError]  = useState(false);
  const isGif = photo.image?.toLowerCase().endsWith('.gif');

  if (error) return null;

  return (
    <div
      className="img-card"
      onClick={() => onClick(photo)}
      style={{ breakInside: 'avoid', marginBottom: 4, cursor: 'pointer' }}
    >
      {/* Image wrapper */}
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 8 }}>
        {!loaded && (
          <div style={{
            background: '#f1f3f4', borderRadius: 8,
            height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              width: 16, height: 16, borderRadius: '50%',
              border: '2px solid #e8eaed', borderTopColor: '#70757a',
              animation: 'imgSpin 0.7s linear infinite',
            }} />
          </div>
        )}
        <img
          src={photo.image}
          alt={photo.title || ''}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className="img-card-img"
          style={{
            width: '100%', display: loaded ? 'block' : 'none',
            objectFit: 'cover', borderRadius: 8,
          }}
        />
        {isGif && loaded && (
          <span style={{
            position: 'absolute', bottom: 6, left: 6,
            background: 'rgba(0,0,0,0.65)', color: '#fff',
            fontSize: 11, fontWeight: 700, padding: '2px 6px',
            borderRadius: 4, letterSpacing: '0.5px', fontFamily: F,
            pointerEvents: 'none',
          }}>
            GIF
          </span>
        )}
      </div>

      {/* Metadata */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '6px 2px 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Favicon domain={photo.domain} name={photo.domain} size={14} />
          <span style={{ fontFamily: F, fontSize: '0.72rem', color: '#70757a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {photo.domain}
          </span>
        </div>
        {photo.title && (
          <p style={{
            fontFamily: F, fontSize: '0.72rem', color: '#202124',
            margin: 0, overflow: 'hidden', whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}>
            {photo.title}
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Filter chip ──────────────────────────────────────────────────────────── */
function FilterChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        border: `1px solid ${active ? '#1a73e8' : '#dadce0'}`,
        borderRadius: 9999, padding: '6px 14px',
        background: active ? '#e8f0fe' : '#fff',
        fontFamily: F, fontSize: '0.8rem',
        color: active ? '#1a73e8' : '#202124',
        cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
        transition: 'background 0.15s, border-color 0.15s, color 0.15s',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#f1f3f4'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = '#fff'; }}
    >
      {label}
    </button>
  );
}

/* ── Lightbox detail panel ────────────────────────────────────────────────── */
function DetailPanel({ photo, onClose }) {
  if (!photo) return null;
  return (
    <>
      {/* Backdrop (mobile) */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.3)',
        }}
      />
      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 380, maxWidth: '100vw',
        background: '#fff', borderLeft: '1px solid #e8eaed',
        zIndex: 51, overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.08)',
      }}>
        {/* Close */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px' }}>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 20, color: '#70757a', lineHeight: 1, padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        {/* Full image */}
        <div style={{ padding: '0 16px 16px' }}>
          <img
            src={photo.image}
            alt={photo.title || ''}
            style={{
              width: '100%', borderRadius: 8,
              objectFit: 'contain', maxHeight: 300, display: 'block',
              background: '#f1f3f4',
            }}
          />
        </div>

        {/* Title */}
        {photo.title && (
          <div style={{
            padding: '0 16px 12px',
            fontFamily: F, fontSize: '0.9rem', fontWeight: 600, color: '#202124',
            lineHeight: 1.4,
          }}>
            {photo.title}
          </div>
        )}

        {/* Source */}
        <div style={{ padding: '0 16px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Favicon domain={photo.domain} name={photo.domain} size={18} />
          <span style={{ fontFamily: F, fontSize: '0.8rem', color: '#70757a' }}>
            {photo.domain}
          </span>
        </div>

        {/* Buttons */}
        <div style={{ padding: '0 16px', display: 'flex', gap: 10 }}>
          <a
            href={photo.source}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '9px 16px', borderRadius: 6,
              background: '#1a73e8', color: '#fff',
              fontFamily: F, fontSize: '0.85rem', fontWeight: 600,
              textDecoration: 'none', transition: 'background 0.15s',
            }}
          >
            Visit page
          </a>
          <a
            href={photo.image}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '9px 16px', borderRadius: 6,
              border: '1px solid #dadce0', color: '#202124',
              fontFamily: F, fontSize: '0.85rem', fontWeight: 600,
              textDecoration: 'none', transition: 'background 0.15s',
            }}
          >
            View image
          </a>
        </div>
      </div>
    </>
  );
}

/* ── Main component ───────────────────────────────────────────────────────── */
export default function ImagesTab({ query }) {
  const [photos,      setPhotos]      = useState([]);
  const [status,      setStatus]      = useState('loading');
  const [page,        setPage]        = useState(0);
  const [hasMore,     setHasMore]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeChip,  setActiveChip]  = useState('All');
  const [selected,    setSelected]    = useState(null);
  const sentinelRef = useRef(null);

  const fetchPage = useCallback(async (pageNum, append = false) => {
    const r    = await fetch(`${API}/explore/images?q=${encodeURIComponent(query)}&page=${pageNum}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    const imgs = data.images || [];
    setPhotos(prev => append ? [...prev, ...imgs] : imgs);
    setHasMore(imgs.length >= 6);
    return imgs;
  }, [query]);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    setPhotos([]); setPage(0); setHasMore(true);
    setActiveChip('All'); setSelected(null);
    setStatus('loading');

    fetchPage(0)
      .then(imgs => { if (!cancelled) setStatus(imgs.length ? 'done' : 'empty'); })
      .catch(()   => { if (!cancelled) setStatus('error'); });

    return () => { cancelled = true; };
  }, [query, fetchPage]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loadingMore || status !== 'done') return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setLoadingMore(true);
          const next = page + 1;
          setPage(next);
          fetchPage(next, true)
            .catch(() => setHasMore(false))
            .finally(() => setLoadingMore(false));
        }
      },
      { rootMargin: '300px' }
    );
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, status, page, fetchPage]);

  // Close detail panel on Escape
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') setSelected(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  if (status === 'loading') return <div style={{ padding: '40px 0' }}><Spinner /></div>;

  if (status === 'error' || status === 'empty' || photos.length === 0) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', fontFamily: F, fontSize: '0.875rem', color: '#70757a' }}>
        {status === 'error' ? 'Could not load images' : 'No images found for this query'}
      </div>
    );
  }

  // Derive unique domains for filter chips
  const domains  = [...new Set(photos.map(p => p.domain).filter(Boolean))];
  const chips    = ['All', ...domains];
  const filtered = activeChip === 'All' ? photos : photos.filter(p => p.domain === activeChip);

  return (
    <>
      <style>{`
        @keyframes imgSpin { to { transform: rotate(360deg); } }
        .img-card-img { transition: opacity 0.2s ease; }
        .img-card:hover .img-card-img { opacity: 0.88; }
        .img-masonry {
          columns: 4;
          column-gap: 4px;
        }
        @media (max-width: 1024px) { .img-masonry { columns: 3; } }
        @media (max-width: 768px)  { .img-masonry { columns: 2; } }
        @media (max-width: 480px)  { .img-masonry { columns: 1; } }
        .chips-row {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 4px;
          scrollbar-width: none;
        }
        .chips-row::-webkit-scrollbar { display: none; }
      `}</style>

      {/* ── Filter chips ── */}
      <div className="chips-row" style={{ marginBottom: 14 }}>
        {chips.map(chip => (
          <FilterChip
            key={chip}
            label={chip}
            active={activeChip === chip}
            onClick={() => setActiveChip(chip)}
          />
        ))}
      </div>

      {/* ── Masonry grid ── */}
      <div className="img-masonry">
        {filtered.map((photo, i) => (
          <ImageCard key={`${photo.image}-${i}`} photo={photo} onClick={setSelected} />
        ))}
      </div>

      {/* ── Infinite scroll sentinel ── */}
      {hasMore && (
        <div ref={sentinelRef} style={{ paddingTop: 24, display: 'flex', justifyContent: 'center' }}>
          {loadingMore && <Spinner />}
        </div>
      )}

      {/* ── Detail panel ── */}
      {selected && <DetailPanel photo={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
