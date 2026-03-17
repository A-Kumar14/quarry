import React, { useRef, useCallback, useEffect, useState } from 'react';
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

export default function KnowledgeGraph({ nodes = [], links = [], onNodeClick }) {
  const containerRef = useRef(null);
  const graphRef     = useRef(null);

  const [dimensions,   setDimensions]   = useState({ width: 680, height: 420 });
  const [hovered,      setHovered]      = useState(null);
  const [mousePos,     setMousePos]     = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState(null);
  const [simNodes,     setSimNodes]     = useState([]);

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
      setTimeout(() => graphRef.current.zoomToFit(400, 40), 300);
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
      ctx.font         = `600 ${fontSize}px Inter, sans-serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle    = '#111827';
      const label = node.name.length > 20 ? node.name.slice(0, 18) + '…' : node.name;
      ctx.fillText(label, node.x, node.y + r + fontSize * 1.2);
    }
  }, [hovered]);

  if (nodes.length === 0) {
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
              background:           'rgba(255,255,255,0.62)',
              backdropFilter:       'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border:               '1px solid rgba(255,255,255,0.45)',
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
            background:           'rgba(255, 255, 255, 0.82)',
            backdropFilter:       'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border:               '1px solid rgba(255, 255, 255, 0.35)',
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
    </Box>
  );
}
