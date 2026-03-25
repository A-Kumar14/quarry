import React, { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import ForceGraph2D from 'react-force-graph-2d';

// Node color / radius by type
const NODE_COLOR = {
  query:   '#F97316',
  topic:   '#7C3AED',
  concept: '#0EA5E9',
  source:  '#059669',
};

const NODE_RADIUS = {
  query:   10,
  topic:   7,
  concept: 5,
  source:  6,
};

const LEGEND = [
  { type: 'query',   label: 'Query'   },
  { type: 'topic',   label: 'Topic'   },
  { type: 'concept', label: 'Concept' },
  { type: 'source',  label: 'Source'  },
];

// Claim Landscape — colour by verification status
const CLAIM_COLOR = {
  verified:     '#22c55e',
  corroborated: '#eab308',
  single_source:'#f97316',
  contested:    '#ef4444',
  uncertain:    '#f97316', // alias — backend may use this instead of single_source
};

// X-axis position (0–1) by editorial lean
const LEAN_X = {
  state_aligned: 0.08,
  left:          0.28,
  right:         0.28,
  center:        0.50,
  independent:   0.55,
  unknown:       0.75,
};

// Y-axis position (0–1) by status — top = verified, bottom = contested
const STATUS_Y = {
  verified:     0.10,
  corroborated: 0.32,
  single_source:0.56,
  uncertain:    0.56, // alias
  contested:    0.82,
};

function MinimapCanvas({ simNodes }) {
  const canvasRef = useRef(null);
  const W = 110, H = 72;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !simNodes.length) return;
    const ctx = canvas.getContext('2d');

    const xs = simNodes.map(n => n.x).filter(v => v != null);
    const ys = simNodes.map(n => n.y).filter(v => v != null);
    if (!xs.length) return;

    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const pad = 8;

    ctx.clearRect(0, 0, W, H);

    simNodes.forEach(n => {
      if (n.x == null || n.y == null) return;
      const sx = pad + ((n.x - minX) / rangeX) * (W - 2 * pad);
      const sy = pad + ((n.y - minY) / rangeY) * (H - 2 * pad);
      ctx.beginPath();
      ctx.arc(sx, sy, n.type === 'query' ? 3.5 : 2, 0, 2 * Math.PI);
      ctx.fillStyle = NODE_COLOR[n.type] || '#888';
      ctx.fill();
    });
  }, [simNodes]);

  return <canvas ref={canvasRef} width={W} height={H} style={{ display: 'block' }} />;
}

function ClaimLandscapeCanvas({ claims, width, height, onNodeClick }) {
  const canvasRef = useRef(null);
  const [tooltip, setTooltip]   = useState(null); // {x, y, claim}
  const [selected, setSelected] = useState(null);

  // Compute stable node positions (deterministic jitter so nodes
  // don't overlap perfectly but position is stable across re-renders)
  const nodes = useMemo(() => {
    if (!claims || claims.length === 0) return [];
    return claims.map((claim, i) => {
      const lean = (claim.source_outlets || []).length > 0
        ? 'unknown'   // fallback — backend doesn't send lean per claim yet
        : 'unknown';
      // Use first source_outlet to guess lean if possible
      const status = claim.status || 'single_source';
      const baseX  = (LEAN_X[lean] ?? 0.75) * width;
      const baseY  = (STATUS_Y[status] ?? 0.56) * height;
      // Deterministic jitter from claim_text length + index
      const jitter = ((claim.claim_text || '').length % 20) - 10;
      return {
        x:      baseX + jitter + (i % 5) * 6,
        y:      baseY + jitter * 0.5 + (i % 3) * 5,
        color:  CLAIM_COLOR[status] ?? '#f97316',
        claim,
        index:  i,
      };
    });
  }, [claims, width, height]);

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = 'transparent';
    ctx.fillRect(0, 0, width, height);

    // Axis guide lines (subtle)
    ctx.strokeStyle = 'rgba(156,163,175,0.18)';
    ctx.lineWidth = 1;
    // Horizontal thirds
    [0.33, 0.66].forEach(f => {
      ctx.beginPath();
      ctx.moveTo(0, f * height);
      ctx.lineTo(width, f * height);
      ctx.stroke();
    });

    // Axis labels
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#9CA3AF';
    ctx.textAlign = 'left';
    ctx.fillText('Verified', 8, 16);
    ctx.fillText('Contested', 8, height - 8);
    ctx.textAlign = 'center';
    ctx.fillText('← State / Official          Independent          Unverified →', width / 2, height - 8);

    // Edges — connect claims that share a source outlet
    ctx.strokeStyle = 'rgba(156,163,175,0.25)';
    ctx.lineWidth = 1;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i].claim.source_outlets || [];
        const b = nodes[j].claim.source_outlets || [];
        const shared = a.some(o => b.includes(o));
        if (shared) {
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }
    }

    // Nodes
    nodes.forEach(n => {
      const r = 7;
      const isHovered = tooltip?.claim === n.claim;
      ctx.beginPath();
      ctx.arc(n.x, n.y, isHovered ? 10 : r, 0, 2 * Math.PI);
      ctx.fillStyle = n.color;
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  }, [nodes, tooltip, width, height]);

  // Hover detection
  const handleMouseMove = useCallback(e => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const hit = nodes.find(n => {
      const dx = n.x - mx;
      const dy = n.y - my;
      return Math.sqrt(dx * dx + dy * dy) <= 10;
    });
    setTooltip(hit ? { x: mx, y: my, claim: hit.claim } : null);
  }, [nodes]);

  const handleClick = useCallback(e => {
    if (tooltip?.claim) {
      setSelected(tooltip.claim);
      if (onNodeClick) onNodeClick(tooltip.claim);
    }
  }, [tooltip, onNodeClick]);

  if (!claims || claims.length === 0) {
    return (
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: 300, border: '1px solid var(--border)',
        borderRadius: '12px', bgcolor: 'var(--bg-secondary)',
      }}>
        <Typography sx={{
          fontFamily: 'var(--font-family)', fontSize: '0.8rem',
          color: 'var(--fg-dim)',
        }}>
          Run a search to see the claim landscape
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
      {/* Canvas */}
      <Box sx={{
        flex: 1, position: 'relative',
        border: '1px solid var(--border)', borderRadius: '12px',
        overflow: 'hidden', bgcolor: 'var(--bg-secondary)',
        cursor: tooltip ? 'pointer' : 'default',
      }}>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setTooltip(null)}
          onClick={handleClick}
          style={{ display: 'block' }}
        />

        {/* Hover tooltip */}
        {tooltip && (
          <Box sx={{
            position: 'absolute',
            left: Math.min(tooltip.x + 12, width - 220),
            top:  Math.max(tooltip.y - 60, 4),
            width: 210,
            bgcolor: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            p: '8px 10px',
            pointerEvents: 'none',
            zIndex: 10,
            boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
          }}>
            <Typography sx={{
              fontFamily: 'var(--font-family)', fontSize: '0.72rem',
              color: 'var(--fg-primary)', lineHeight: 1.4,
              display: '-webkit-box', WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {tooltip.claim.claim_text}
            </Typography>
            {tooltip.claim.source_outlets?.length > 0 && (
              <Typography sx={{
                fontFamily: 'var(--font-family)', fontSize: '0.62rem',
                color: 'var(--fg-dim)', mt: 0.5,
              }}>
                {tooltip.claim.source_outlets.slice(0, 2).join(', ')}
              </Typography>
            )}
            <Box sx={{
              display: 'inline-block', mt: 0.5,
              px: '5px', py: '1px', borderRadius: '4px',
              bgcolor: CLAIM_COLOR[tooltip.claim.status] + '22',
              border: `1px solid ${CLAIM_COLOR[tooltip.claim.status]}44`,
            }}>
              <Typography sx={{
                fontFamily: 'var(--font-family)', fontSize: '0.58rem',
                fontWeight: 700,
                color: CLAIM_COLOR[tooltip.claim.status],
                textTransform: 'capitalize',
              }}>
                {(tooltip.claim.status || 'unknown').replace('_', ' ')}
              </Typography>
            </Box>
          </Box>
        )}
      </Box>

      {/* Selected claim detail panel */}
      {selected && (
        <Box sx={{
          width: 220, flexShrink: 0,
          bgcolor: 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.35)',
          borderRadius: '12px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
          p: 2,
          display: 'flex', flexDirection: 'column', gap: 1.5,
          alignSelf: 'flex-start',
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Box sx={{
              px: '6px', py: '2px', borderRadius: '4px',
              bgcolor: CLAIM_COLOR[selected.status] + '22',
              border: `1px solid ${CLAIM_COLOR[selected.status]}44`,
            }}>
              <Typography sx={{
                fontFamily: 'var(--font-family)', fontSize: '0.6rem',
                fontWeight: 700, color: CLAIM_COLOR[selected.status],
                textTransform: 'capitalize',
              }}>
                {(selected.status || 'unknown').replace('_', ' ')}
              </Typography>
            </Box>
            <Typography
              onClick={() => setSelected(null)}
              sx={{
                fontFamily: 'var(--font-family)', fontSize: '0.7rem',
                color: 'var(--fg-dim)', cursor: 'pointer',
                '&:hover': { color: 'var(--fg-primary)' },
              }}
            >
              ✕
            </Typography>
          </Box>

          <Typography sx={{
            fontFamily: 'var(--font-family)', fontSize: '0.78rem',
            color: 'var(--fg-primary)', lineHeight: 1.5,
          }}>
            {selected.claim_text}
          </Typography>

          {selected.source_outlets?.length > 0 && (
            <Typography sx={{
              fontFamily: 'var(--font-family)', fontSize: '0.65rem',
              color: 'var(--fg-dim)',
            }}>
              {selected.source_outlets.join(', ')}
            </Typography>
          )}

          {selected.contradiction_note && (
            <Box sx={{
              p: '8px 10px', borderRadius: '6px',
              bgcolor: 'rgba(239,68,68,0.06)',
              border: '1px solid rgba(239,68,68,0.18)',
            }}>
              <Typography sx={{
                fontFamily: 'var(--font-family)', fontSize: '0.68rem',
                color: '#dc2626', lineHeight: 1.4,
              }}>
                ⚠ {selected.contradiction_note}
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

export default function KnowledgeGraph({ nodes = [], links = [], onNodeClick, claimsData = [] }) {
  const containerRef = useRef(null);
  const graphRef     = useRef(null);

  const [dimensions,   setDimensions]   = useState({ width: 240, height: 200 });
  const [hovered,      setHovered]      = useState(null);
  const [mousePos,     setMousePos]     = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState(null);
  const [simNodes,     setSimNodes]     = useState([]);

  // Mode: 'graph' = existing force graph, 'landscape' = claim landscape
  const [mode, setMode] = useState('graph');

  // Auto-switch to landscape when claims arrive, back to graph when they leave
  useEffect(() => {
    if (claimsData && claimsData.length > 0) {
      setMode('landscape');
    } else {
      setMode('graph');
    }
  }, [claimsData]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width: width || 680, height: height || 420 });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = e => {
      const rect = el.getBoundingClientRect();
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };
    el.addEventListener('mousemove', handler);
    return () => el.removeEventListener('mousemove', handler);
  }, []);

  useEffect(() => {
    if (graphRef.current && nodes.length > 0) {
      setTimeout(() => graphRef.current?.zoomToFit(400, 40), 300);
    }
  }, [nodes]);

  // Capture node positions when simulation cools (feeds minimap).
  // The force simulation mutates the nodes prop in-place with x/y coords.
  const handleEngineStop = useCallback(() => {
    setSimNodes(nodes.map(n => ({ id: n.id, x: n.x, y: n.y, type: n.type })));
  }, [nodes]);

  const handleNodeClick = useCallback(node => {
    setSelectedNode(node);
    if (onNodeClick) onNodeClick(node);
  }, [onNodeClick]);

  const drawNode = useCallback((node, ctx, globalScale) => {
    const r     = NODE_RADIUS[node.type] || 5;
    const color = NODE_COLOR[node.type]  || '#888';

    if (hovered?.id === node.id) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 4, 0, 2 * Math.PI);
      ctx.fillStyle = color + '33';
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();

    // Canvas label truncated; full title in DOM tooltip
    const fontSize = Math.min(12 / globalScale, 5);
    if (globalScale > 0.5 || node.type === 'query') {
      ctx.font         = `600 ${fontSize}px 'DM Sans', system-ui, sans-serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle    = '#111827';
      const label = node.name.length > 20 ? node.name.slice(0, 18) + '…' : node.name;
      ctx.fillText(label, node.x, node.y + r + fontSize * 1.2);
    }
  }, [hovered]);

  if (nodes.length === 0 && (!claimsData || claimsData.length === 0)) {
    return (
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: 300, border: '1px solid var(--border)',
        borderRadius: '12px', bgcolor: 'var(--bg-secondary)',
      }}>
        <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.8rem', color: 'var(--fg-dim)' }}>
          Graph will appear once the answer loads
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>

      {/* Mode toggle — only show when claims are available */}
      {claimsData && claimsData.length > 0 && (
        <Box sx={{
          display: 'flex', gap: 0.5, mb: 1,
          p: '3px', borderRadius: '8px',
          bgcolor: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          width: 'fit-content',
        }}>
          {[
            { key: 'landscape', label: 'Claim Landscape' },
            { key: 'graph',     label: 'Concept Graph'   },
          ].map(({ key, label }) => (
            <Box
              key={key}
              onClick={() => setMode(key)}
              sx={{
                px: 1.25, py: 0.4, borderRadius: '6px', cursor: 'pointer',
                bgcolor: mode === key ? 'var(--accent)' : 'transparent',
                transition: 'background 0.15s',
                '&:hover': { bgcolor: mode === key ? 'var(--accent)' : 'rgba(0,0,0,0.04)' },
              }}
            >
              <Typography sx={{
                fontFamily: 'var(--font-family)', fontSize: '0.68rem',
                fontWeight: 500,
                color: mode === key ? '#fff' : 'var(--fg-secondary)',
              }}>
                {label}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {mode === 'landscape' ? (
        <>
          {/* Claim Landscape legend */}
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', px: 0.5, mb: 1 }}>
            {[
              { status: 'verified',     label: 'Verified'      },
              { status: 'corroborated', label: 'Corroborated'  },
              { status: 'single_source',label: 'Single source' },
              { status: 'contested',    label: 'Contested'     },
            ].map(({ status, label }) => (
              <Box key={status} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{
                  width: 8, height: 8, borderRadius: '50%',
                  bgcolor: CLAIM_COLOR[status], flexShrink: 0,
                }} />
                <Typography sx={{
                  fontFamily: 'var(--font-family)', fontSize: '0.65rem',
                  color: 'var(--fg-secondary)',
                }}>
                  {label}
                </Typography>
              </Box>
            ))}
          </Box>
          <ClaimLandscapeCanvas
            claims={claimsData}
            width={dimensions.width}
            height={420}
            onNodeClick={onNodeClick}
          />
        </>
      ) : (
        <>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', px: 0.5 }}>
            {LEGEND.map(({ type, label }) => (
              <Box key={type} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: NODE_COLOR[type], flexShrink: 0 }} />
                <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.65rem', color: 'var(--fg-secondary)' }}>
                  {label}
                </Typography>
              </Box>
            ))}
            <Typography sx={{ fontFamily: 'var(--font-family)', fontSize: '0.65rem', color: 'var(--fg-dim)', ml: 'auto' }}>
              Click a node for details · Scroll to zoom
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>

            <Box
              ref={containerRef}
              sx={{
                flex: 1,
                height: 420,
                border: '1px solid var(--border)',
                borderRadius: '12px',
                overflow: 'hidden',
                bgcolor: 'var(--bg-secondary)',
                cursor: 'grab',
                position: 'relative',
                '&:active': { cursor: 'grabbing' },
              }}
            >
              <ForceGraph2D
                ref={graphRef}
                graphData={{ nodes, links }}
                width={dimensions.width}
                height={dimensions.height}
                backgroundColor="transparent"
                nodeCanvasObject={drawNode}
                nodeCanvasObjectMode={() => 'replace'}
                nodeVal={node => (NODE_RADIUS[node.type] || 5) * 2}
                linkColor={() => 'rgba(0,0,0,0.12)'}
                linkWidth={1}
                linkDirectionalParticles={1}
                linkDirectionalParticleWidth={1.5}
                linkDirectionalParticleColor={() => 'rgba(249,115,22,0.6)'}
                onNodeClick={handleNodeClick}
                onNodeHover={node => setHovered(node || null)}
                onEngineStop={handleEngineStop}
                cooldownTicks={80}
                d3AlphaDecay={0.03}
                d3VelocityDecay={0.3}
                enableZoomInteraction
                enablePanInteraction
              />

              {hovered && (
                <div style={{
                  position:             'absolute',
                  left:                 Math.min(mousePos.x + 14, dimensions.width - 195),
                  top:                  Math.max(mousePos.y - 42, 4),
                  background:           'rgba(17, 24, 39, 0.88)',
                  backdropFilter:       'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  color:                '#fff',
                  padding:              '5px 10px',
                  borderRadius:         8,
                  fontSize:             '0.75rem',
                  fontFamily:           'var(--font-family)',
                  fontWeight:           500,
                  pointerEvents:        'none',
                  zIndex:               20,
                  maxWidth:             195,
                  whiteSpace:           'pre-wrap',
                  wordBreak:            'break-word',
                  boxShadow:            '0 2px 8px rgba(0,0,0,0.22)',
                }}>
                  {hovered.name}
                  <div style={{ fontSize: '0.62rem', opacity: 0.65, marginTop: 2, textTransform: 'capitalize' }}>
                    {hovered.type}
                  </div>
                </div>
              )}

              {simNodes.length > 0 && (
                <div style={{
                  position:             'absolute',
                  bottom:               10,
                  right:                10,
                  background:           'rgba(255,250,235,0.75)',
                  backdropFilter:       'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border:               '1px solid rgba(255,252,225,0.60)',
                  borderRadius:         8,
                  padding:              '4px 5px 5px',
                  zIndex:               10,
                  boxShadow:            '0 2px 8px rgba(0,0,0,0.09)',
                }}>
                  <div style={{
                    fontFamily:    'var(--font-family)',
                    fontSize:      '0.52rem',
                    color:         'var(--fg-dim)',
                    marginBottom:  3,
                    paddingLeft:   2,
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                  }}>
                    Overview
                  </div>
                  <MinimapCanvas simNodes={simNodes} />
                </div>
              )}
            </Box>

            {selectedNode && (
              <div style={{
                width:                220,
                flexShrink:           0,
                background:           'rgba(255,250,235,0.88)',
                backdropFilter:       'blur(24px) saturate(180%)',
                WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                borderTop:            '1px solid rgba(255,255,235,0.90)',
                borderLeft:           '1px solid rgba(255,252,225,0.70)',
                borderRight:          '1px solid rgba(185,165,128,0.18)',
                borderBottom:         '1px solid rgba(178,158,120,0.18)',
                borderRadius:         12,
                boxShadow:            '0 4px 24px rgba(0, 0, 0, 0.07)',
                padding:              16,
                display:              'flex',
                flexDirection:        'column',
                gap:                  12,
                animation:            'slideInRight 0.22s ease',
                alignSelf:            'flex-start',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{
                    fontFamily:    'var(--font-family)',
                    fontSize:      '0.58rem',
                    fontWeight:    700,
                    color:         'var(--fg-dim)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}>
                    Node Info
                  </div>
                  <button
                    onClick={() => setSelectedNode(null)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--fg-dim)', fontSize: '1.1rem',
                      lineHeight: 1, padding: '1px 5px', borderRadius: 4,
                    }}
                  >
                    ×
                  </button>
                </div>

                <div style={{
                  display:       'inline-block',
                  padding:       '3px 10px',
                  borderRadius:  20,
                  fontSize:      '0.65rem',
                  fontFamily:    'var(--font-family)',
                  fontWeight:    600,
                  textTransform: 'capitalize',
                  color:         '#fff',
                  background:    NODE_COLOR[selectedNode.type] || '#888',
                  alignSelf:     'flex-start',
                }}>
                  {selectedNode.type}
                </div>

                <div style={{
                  fontFamily: 'var(--font-family)',
                  fontSize:   '0.9rem',
                  fontWeight: 700,
                  color:      'var(--fg-primary)',
                  lineHeight: 1.4,
                }}>
                  {selectedNode.name}
                </div>

                {selectedNode.url && (
                  <a
                    href={selectedNode.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontFamily:  'var(--font-family)',
                      fontSize:    '0.72rem',
                      color:       'var(--accent)',
                      textDecoration: 'none',
                      wordBreak:   'break-all',
                      borderTop:   '1px solid rgba(0,0,0,0.07)',
                      paddingTop:  10,
                      display:     'block',
                    }}
                  >
                    Visit source →
                  </a>
                )}
              </div>
            )}
          </Box>
        </>
      )}
    </Box>
  );
}
