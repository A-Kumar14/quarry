import React, { useState, useEffect } from 'react';
import { FileText, Trash2, Clock, Search, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDarkMode } from '../DarkModeContext';

const DOCUMENTS_KEY = 'quarry_documents';

const GLASS_BTN = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '5px 11px', borderRadius: 7, cursor: 'pointer', border: 'none',
  background: 'var(--gbtn-bg)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderTop: '1px solid var(--gbtn-border-t)',
  borderLeft: '1px solid var(--gbtn-border-l)',
  borderRight: '1px solid var(--gbtn-border-r)',
  borderBottom: '1px solid var(--gbtn-border-b)',
  boxShadow: 'var(--gbtn-shadow)',
  fontFamily: 'var(--font-family)', fontSize: '0.75rem', fontWeight: 400,
  color: 'inherit', whiteSpace: 'nowrap',
  transition: 'all 0.14s ease',
};

const ORANGE_BTN = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '5px 11px', borderRadius: 7, cursor: 'pointer', border: 'none',
  background: 'var(--accent)', color: '#fff',
  fontFamily: 'var(--font-family)', fontSize: '0.75rem', fontWeight: 500,
  whiteSpace: 'nowrap', transition: 'opacity 0.14s',
};

function ago(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  return Math.floor(diff / 86400000) + 'd ago';
}

export default function ArtifactsPage() {
  const [docs, setDocs] = useState([]);
  const [filter, setFilter] = useState('');
  const navigate = useNavigate();
  useDarkMode();

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(DOCUMENTS_KEY) || '[]');
      setDocs(stored);
    } catch {
      setDocs([]);
    }
  }, []);

  function handleDelete(id) {
    const updated = docs.filter(d => d.id !== id);
    setDocs(updated);
    localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(updated));
  }

  function handleOpen(doc) {
    sessionStorage.setItem('quarry_write_session', JSON.stringify({
      query: doc.title,
      content: doc.content,
      docId: doc.id,
    }));
    navigate('/write');
  }

  const filtered = docs.filter(d =>
    d.title.toLowerCase().includes(filter.toLowerCase()) ||
    (d.content || '').toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', fontFamily: 'var(--font-family)' }}>

      {/* TOPBAR */}
      <div style={{
        height: 44, position: 'sticky', top: 0, zIndex: 30,
        background: '#000',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        padding: '0 20px',
        display: 'flex', alignItems: 'center', gap: 12,
        color: '#fff',
      }}>
        <button onClick={() => navigate('/')} style={{ ...GLASS_BTN, color: '#fff', background: 'rgba(255,255,255,0.05)' }}>
          <ArrowLeft size={14} /> Back
        </button>
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.15)' }} />
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: '0.95rem', color: '#fff', fontWeight: 400 }}>
          Artifacts
        </span>
        <div style={{ marginLeft: 'auto' }}>
          <button onClick={() => navigate('/write')} style={ORANGE_BTN}>
            + New story
          </button>
        </div>
      </div>

      {/* PAGE BODY */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px' }}>

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', color: 'var(--fg-primary)', fontWeight: 400 }}>
            Your stories
          </span>
          <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.75rem', color: 'var(--fg-dim)' }}>
            {docs.length} document{docs.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Search bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--glass-bg)',
          border: '1px solid var(--border)',
          borderRadius: 8, padding: '8px 12px',
          maxWidth: 500, marginBottom: 20,
        }}>
          <Search size={13} color="var(--fg-dim)" style={{ flexShrink: 0 }} />
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Search your stories..."
            style={{
              flex: 1, border: 'none', background: 'transparent', outline: 'none',
              fontFamily: 'var(--font-family)', fontSize: '0.82rem',
              color: 'var(--fg-primary)',
            }}
          />
        </div>

        {/* Empty state */}
        {docs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <FileText size={40} color="var(--fg-dim)" style={{ margin: '0 auto 12px', display: 'block' }} />
            <p style={{ fontFamily: 'var(--font-family)', fontSize: '1rem', color: 'var(--fg-secondary)', marginBottom: 6 }}>
              No stories yet
            </p>
            <p style={{ fontFamily: 'var(--font-family)', fontSize: '0.82rem', color: 'var(--fg-dim)', marginBottom: 16 }}>
              Stories you write in Quarry appear here.
            </p>
            <button
              onClick={() => navigate('/write')}
              style={{
                padding: '6px 16px', borderRadius: 7, cursor: 'pointer',
                border: '1px solid var(--accent)', background: 'transparent',
                fontFamily: 'var(--font-family)', fontSize: '0.78rem',
                color: 'var(--accent)',
              }}
            >
              Write your first story
            </button>
          </div>
        )}

        {/* Document grid */}
        {docs.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 12,
            marginTop: 4,
          }}>
            {filtered.map(doc => {
              const lede = (doc.content || '')
                .replace(/[#*`[\]]/g, '')
                .slice(0, 120);
              return (
                <div
                  key={doc.id}
                  onClick={() => handleOpen(doc)}
                  style={{
                    background: 'var(--glass-bg)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: 10,
                    padding: 16,
                    cursor: 'pointer',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--glass-border)'; }}
                >
                  {/* Card header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 8 }}>
                    <FileText size={14} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{
                      fontFamily: 'var(--font-serif)', fontSize: '0.88rem', fontWeight: 500,
                      color: 'var(--fg-primary)', flex: 1,
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {doc.title}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(doc.id); }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: 2, flexShrink: 0, color: 'var(--fg-dim)',
                        display: 'flex', transition: 'color 0.14s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--fg-dim)'; }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* Lede */}
                  {lede && (
                    <p style={{
                      fontFamily: 'var(--font-family)', fontSize: '0.75rem',
                      color: 'var(--fg-secondary)', lineHeight: 1.5,
                      margin: '0 0 12px',
                      display: '-webkit-box', WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {lede}
                    </p>
                  )}

                  {/* Card footer */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: lede ? 0 : 12 }}>
                    <Clock size={11} color="var(--fg-dim)" />
                    <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.62rem', color: 'var(--fg-dim)' }}>
                      {ago(doc.updatedAt)}
                    </span>
                    <div style={{ flex: 1 }} />
                    <span style={{ fontFamily: 'var(--font-family)', fontSize: '0.62rem', color: 'var(--fg-dim)' }}>
                      {doc.wordCount || 0} words
                    </span>
                    {doc.sourceCount > 0 && (
                      <span style={{
                        fontFamily: 'var(--font-family)', fontSize: '0.60rem',
                        background: 'rgba(249,115,22,0.1)',
                        color: 'var(--accent)',
                        border: '1px solid rgba(249,115,22,0.2)',
                        borderRadius: 4, padding: '1px 6px',
                      }}>
                        {doc.sourceCount} sources
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
