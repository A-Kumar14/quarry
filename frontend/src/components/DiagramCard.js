/**
 * DiagramCard.js — Renders a Mermaid.js flowchart from a code string.
 *
 * Loads mermaid v10 lazily from CDN (no new npm package required).
 * Styled to match Quarry's sepia / "Modern Newspaper" design system.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';

// ── Singleton CDN loader ──────────────────────────────────────────────────────
// Only one <script> tag is ever added regardless of how many DiagramCards mount.

let _mermaidPromise = null;

const MERMAID_THEME = {
  startOnLoad: false,
  securityLevel: 'loose',
  theme: 'base',
  themeVariables: {
    fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
    fontSize: '13px',
    // Sepia palette
    background:          '#EDE8DF',
    mainBkg:             '#f5ede0',
    nodeBorder:          '#c8b89a',
    clusterBkg:          '#ede8df',
    edgeLabelBackground: '#f5ede0',
    primaryColor:        '#f5ede0',
    primaryBorderColor:  '#c8b89a',
    primaryTextColor:    '#26180a',
    lineColor:           '#8a6d47',
    secondaryColor:      '#ede4d5',
    tertiaryColor:       '#e8dfd0',
    // Text
    nodeTextColor:       '#26180a',
    titleColor:          '#26180a',
  },
  flowchart: { curve: 'basis', htmlLabels: true, padding: 12 },
};

function loadMermaid() {
  if (_mermaidPromise) return _mermaidPromise;

  _mermaidPromise = new Promise((resolve, reject) => {
    // Reuse if already present (e.g. hot-reload)
    if (window.mermaid) {
      window.mermaid.initialize(MERMAID_THEME);
      resolve(window.mermaid);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js';
    script.async = true;
    script.onload = () => {
      window.mermaid.initialize(MERMAID_THEME);
      resolve(window.mermaid);
    };
    script.onerror = () => {
      _mermaidPromise = null; // allow retry on next mount
      reject(new Error('Mermaid CDN failed to load'));
    };
    document.head.appendChild(script);
  });

  return _mermaidPromise;
}

let _idCounter = 0;

// ── Component ─────────────────────────────────────────────────────────────────

export default function DiagramCard({ chartCode }) {
  const containerRef = useRef(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'done' | 'error'

  useEffect(() => {
    const code = chartCode?.trim();
    if (!code || !containerRef.current) return;

    let cancelled = false;
    const id = `quarry-diagram-${Date.now()}-${++_idCounter}`;
    setStatus('loading');

    loadMermaid()
      .then((mermaid) => mermaid.render(id, code))
      .then(({ svg }) => {
        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = svg;
        // Make SVG responsive
        const svgEl = containerRef.current.querySelector('svg');
        if (svgEl) {
          svgEl.removeAttribute('width');
          svgEl.removeAttribute('height');
          svgEl.setAttribute('width', '100%');
          svgEl.style.maxWidth = '100%';
          svgEl.style.height = 'auto';
          svgEl.style.display = 'block';
          svgEl.style.margin = '0 auto';
        }
        setStatus('done');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => { cancelled = true; };
  }, [chartCode]);

  return (
    <Box sx={{
      border: '1px solid var(--border)',
      borderRadius: '12px',
      overflow: 'hidden',
      background: 'rgba(255,255,255,0.45)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      my: 2,
    }}>
      {/* ── Header bar ── */}
      <Box sx={{
        px: 1.75, py: 0.85,
        borderBottom: '1px solid var(--border)',
        background: 'rgba(249,115,22,0.06)',
        display: 'flex', alignItems: 'center', gap: 0.75,
      }}>
        <Box sx={{
          width: 6, height: 6, borderRadius: '50%',
          bgcolor: 'var(--accent)', flexShrink: 0,
        }} />
        <Typography sx={{
          fontFamily: 'var(--font-family)', fontSize: '0.58rem',
          fontWeight: 600, color: 'var(--fg-dim)',
          letterSpacing: '0.10em', textTransform: 'uppercase',
        }}>
          Flowchart
        </Typography>
      </Box>

      {/* ── Diagram / error / loading ── */}
      {status === 'error' ? (
        <Box sx={{ p: '16px 20px' }}>
          <Typography sx={{
            fontFamily: 'var(--font-family)', fontSize: '0.72rem',
            color: 'var(--fg-dim)', fontStyle: 'italic', mb: 1.25,
          }}>
            Diagram could not be rendered.
          </Typography>
          <Box
            component="pre"
            sx={{
              fontFamily: 'var(--font-mono)', fontSize: '0.72rem', lineHeight: 1.6,
              color: 'var(--fg-secondary)', bgcolor: 'rgba(221,213,192,0.4)',
              border: '1px solid var(--border)',
              borderRadius: '8px', p: 1.5, m: 0,
              overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}
          >
            {chartCode}
          </Box>
        </Box>
      ) : (
        <Box sx={{
          p: '16px 20px',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          minHeight: status === 'loading' ? 72 : 0,
        }}>
          {status === 'loading' && (
            <Typography sx={{
              fontFamily: 'var(--font-family)', fontSize: '0.72rem',
              color: 'var(--fg-dim)', fontStyle: 'italic',
            }}>
              Rendering diagram…
            </Typography>
          )}
          <div
            ref={containerRef}
            style={{
              display: status === 'done' ? 'block' : 'none',
              width: '100%',
            }}
          />
        </Box>
      )}
    </Box>
  );
}
