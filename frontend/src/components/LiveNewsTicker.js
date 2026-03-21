import React, { useEffect, useState, useCallback } from 'react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const TICKER_H = 26;
export { TICKER_H };

export default function LiveNewsTicker() {
  const [headlines, setHeadlines] = useState([]);
  const [status,    setStatus]    = useState('loading');

  const load = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/explore/trending-news?max=10`);
      if (!res.ok) throw new Error('non-2xx');
      const data = await res.json();
      const arts = (data.articles || []).filter(a => a.title).slice(0, 10);
      if (arts.length) { setHeadlines(arts); setStatus('live'); }
      else              setStatus('error');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  // Build segments and duplicate for seamless loop
  const segments = headlines.map(h => {
    const src = h.source?.name || '';
    return src ? `${h.title}  ·  ${src}` : h.title;
  });
  const allItems = [...segments, ...segments];

  return (
    <>
      <div style={{
        position:             'fixed',
        top:                  0,
        left:                 0,
        right:                0,
        height:               TICKER_H,
        zIndex:               9999,
        display:              'flex',
        alignItems:           'center',
        background:           'rgba(24, 18, 10, 0.93)',
        backdropFilter:       'blur(12px) saturate(160%)',
        WebkitBackdropFilter: 'blur(12px) saturate(160%)',
        borderBottom:         '1px solid rgba(249,115,22,0.18)',
        overflow:             'hidden',
      }}>

        {/* LIVE badge */}
        <div style={{
          flexShrink:  0,
          display:     'flex',
          alignItems:  'center',
          gap:         6,
          padding:     '0 12px',
          height:      '100%',
          borderRight: '1px solid rgba(249,115,22,0.20)',
          background:  'rgba(249,115,22,0.10)',
        }}>
          <span style={{
            width:        6,
            height:       6,
            borderRadius: '50%',
            background:   status === 'live' ? '#f97316' : '#555',
            flexShrink:   0,
            animation:    status === 'live' ? 'tickerDot 1.4s ease-in-out infinite' : 'none',
          }} />
          <span style={{
            fontFamily:    '"Courier New", monospace',
            fontSize:      '0.52rem',
            fontWeight:    700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color:         status === 'live' ? '#f97316' : '#555',
            whiteSpace:    'nowrap',
          }}>
            Live News
          </span>
        </div>

        {/* Scrolling track */}
        <div style={{
          flex:                1,
          overflow:            'hidden',
          height:              '100%',
          display:             'flex',
          alignItems:          'center',
          maskImage:           'linear-gradient(to right, transparent 0%, black 3%, black 97%, transparent 100%)',
          WebkitMaskImage:     'linear-gradient(to right, transparent 0%, black 3%, black 97%, transparent 100%)',
        }}>

          {status === 'loading' && (
            <span style={{
              fontFamily: '"Courier New", monospace',
              fontSize:   '0.58rem',
              color:      'rgba(255,255,255,0.30)',
              paddingLeft: 16,
              animation:  'tickerBlink 1s step-end infinite',
            }}>
              Fetching headlines…
            </span>
          )}

          {status === 'error' && (
            <span style={{
              fontFamily:  '"Courier New", monospace',
              fontSize:    '0.58rem',
              color:       'rgba(255,255,255,0.22)',
              paddingLeft: 16,
            }}>
              No live headlines available
            </span>
          )}

          {status === 'live' && (
            <div
              style={{
                display:    'flex',
                alignItems: 'center',
                whiteSpace: 'nowrap',
                animation:  'tickerScroll 120s linear infinite',
                willChange: 'transform',
              }}
              onMouseEnter={e => { e.currentTarget.style.animationPlayState = 'paused'; }}
              onMouseLeave={e => { e.currentTarget.style.animationPlayState = 'running'; }}
            >
              {allItems.map((item, i) => (
                <React.Fragment key={i}>
                  <span style={{
                    fontFamily:    '"Courier New", monospace',
                    fontSize:      '0.6rem',
                    color:         'rgba(237,232,223,0.82)',
                    letterSpacing: '0.01em',
                    padding:       '0 8px',
                  }}>
                    {item}
                  </span>
                  <span style={{
                    color:      'rgba(249,115,22,0.50)',
                    fontSize:   '0.6rem',
                    flexShrink: 0,
                    padding:    '0 4px',
                    userSelect: 'none',
                  }}>{'//'}</span>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes tickerScroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes tickerDot {
          0%   { box-shadow: 0 0 0 0   rgba(249,115,22,0.7); }
          50%  { box-shadow: 0 0 0 5px rgba(249,115,22,0);   }
          100% { box-shadow: 0 0 0 0   rgba(249,115,22,0);   }
        }
        @keyframes tickerBlink {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0; }
        }
      `}</style>
    </>
  );
}
