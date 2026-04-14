"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import createGlobe from 'cobe';
import { useDarkMode } from '../../DarkModeContext';

const defaultMarkers = [
  { id: 'sf', location: [37.78, -122.44], city: 'San Francisco', country: 'United States', headline: 'AI startups race to launch agent products this quarter.' },
  { id: 'london', location: [51.51, -0.13], city: 'London', country: 'United Kingdom', headline: 'Policy makers debate new media transparency standards.' },
  { id: 'tokyo', location: [35.68, 139.65], city: 'Tokyo', country: 'Japan', headline: 'Markets react to semiconductor supply chain shifts.' },
];

export function GlobeLive({ markers = defaultMarkers, className = '', speed = 0.003 }) {
  const [dark] = useDarkMode();
  const canvasRef = useRef(null);
  const pointerInteracting = useRef(null);
  const dragOffset = useRef({ phi: 0, theta: 0 });
  const phiOffsetRef = useRef(0);
  const thetaOffsetRef = useRef(0);
  const isPausedRef = useRef(false);
  const [liveViewers, setLiveViewers] = useState(2847);
  const [activeIndex, setActiveIndex] = useState(0);
  const safeMarkers = useMemo(
    () => (Array.isArray(markers) ? markers : [])
      .filter((m) => Array.isArray(m?.location) && m.location.length === 2)
      .filter((m) => Number.isFinite(m.location[0]) && Number.isFinite(m.location[1])),
    [markers]
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveViewers((v) => Math.max(100, v + Math.floor(Math.random() * 21) - 8));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!safeMarkers.length) return undefined;
    const rotate = setInterval(() => {
      setActiveIndex((i) => (i + 1) % safeMarkers.length);
    }, 2500);
    return () => clearInterval(rotate);
  }, [safeMarkers]);

  const handlePointerDown = useCallback((e) => {
    pointerInteracting.current = { x: e.clientX, y: e.clientY };
    if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
    isPausedRef.current = true;
  }, []);

  const handlePointerUp = useCallback(() => {
    if (pointerInteracting.current !== null) {
      phiOffsetRef.current += dragOffset.current.phi;
      thetaOffsetRef.current += dragOffset.current.theta;
      dragOffset.current = { phi: 0, theta: 0 };
    }
    pointerInteracting.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
    isPausedRef.current = false;
  }, []);

  useEffect(() => {
    const handlePointerMove = (e) => {
      if (pointerInteracting.current !== null) {
        dragOffset.current = {
          phi: (e.clientX - pointerInteracting.current.x) / 300,
          theta: (e.clientY - pointerInteracting.current.y) / 1000,
        };
      }
    };
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp, { passive: true });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [handlePointerUp]);

  useEffect(() => {
    if (!canvasRef.current) return undefined;
    const canvas = canvasRef.current;
    let globe = null;
    let phi = 0;
    let resizeObserver;

    function init() {
      const width = canvas.offsetWidth;
      if (width === 0 || globe) return;

      try {
        globe = createGlobe(canvas, {
          devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
          width,
          height: width,
          phi: 0,
          theta: 0.2,
          dark: dark ? 1 : 0,
          diffuse: dark ? 1.08 : 1.15,
          mapSamples: 12000,
          mapBrightness: dark ? 1.7 : 2.2,
          baseColor: dark ? [0.14, 0.19, 0.28] : [0.72, 0.64, 0.52],
          markerColor: dark ? [0.96, 0.44, 0.22] : [0.90, 0.24, 0.18],
          glowColor: dark ? [0.08, 0.10, 0.16] : [0.86, 0.79, 0.68],
          markerElevation: 0.01,
          markers: safeMarkers.map((m) => ({ location: m.location, size: 0.038 })),
          onRender: (state) => {
            if (!isPausedRef.current) phi += speed;
            state.phi = phi + phiOffsetRef.current + dragOffset.current.phi;
            state.theta = 0.2 + thetaOffsetRef.current + dragOffset.current.theta;
            state.scale = 0.88;
          },
        });
      } catch (err) {
        console.error('GlobeLive init failed', err); // eslint-disable-line no-console
        return;
      }

      setTimeout(() => { if (canvas) canvas.style.opacity = '1'; }, 10);
    }

    if (canvas.offsetWidth > 0) {
      init();
    } else {
      resizeObserver = new ResizeObserver((entries) => {
        if (entries[0]?.contentRect.width > 0) {
          resizeObserver.disconnect();
          init();
        }
      });
      resizeObserver.observe(canvas);
    }

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      if (globe) globe.destroy();
    };
  }, [safeMarkers, speed, dark]);

  const active = safeMarkers[activeIndex] || safeMarkers[0];
  const cityCountry = active
    ? `${active.city || active.id}, ${active.country || 'Global'}`
    : 'Global Live';
  const headline = active?.headline || 'Tracking live developments from major global hotspots.';
  const hotspotCount = safeMarkers.length;

  return (
    <div className={`relative select-none ${className}`} style={{ width: '100%', height: '100%' }}>
      <style>{`
        @keyframes live-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>

      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        style={{
          width: '100%',
          height: '100%',
          cursor: 'grab',
          opacity: 0,
          transition: 'opacity 1.2s ease',
          borderRadius: '50%',
          background: dark
            ? 'radial-gradient(circle at 50% 45%, rgba(34,42,58,0.55), rgba(8,12,20,0.85) 72%)'
            : 'radial-gradient(circle at 50% 45%, rgba(224,211,187,0.68), rgba(201,184,154,0.62) 72%)',
          touchAction: 'none',
        }}
      />

      <div style={{
        position: 'absolute',
        top: 12,
        left: 12,
        width: 'min(78%, 260px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '7px 9px',
        background: dark
          ? 'linear-gradient(135deg, rgba(8,12,20,0.92) 0%, rgba(22,28,42,0.86) 100%)'
          : 'linear-gradient(135deg, rgba(16,16,16,0.9) 0%, rgba(35,35,35,0.85) 100%)',
        border: dark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.10)',
        borderRadius: 8,
        boxShadow: '0 6px 16px rgba(0,0,0,0.28)',
        pointerEvents: 'none',
      }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            width: 8,
            height: 8,
            background: '#ff3b30',
            borderRadius: '50%',
            boxShadow: '0 0 8px #ff3b30',
            animation: 'live-pulse 1.5s ease-in-out infinite',
          }} />
          <span style={{
            fontFamily: 'monospace',
            fontSize: '0.62rem',
            fontWeight: 700,
            letterSpacing: '0.1em',
            color: '#ff3b30',
            textTransform: 'uppercase',
          }}>
            LIVE
          </span>
          <span style={{
            fontFamily: 'system-ui, sans-serif',
            fontSize: '0.60rem',
            color: 'rgba(255,255,255,0.68)',
          }}>
            {Math.floor(liveViewers * 0.72).toLocaleString()} watching
          </span>
          <span style={{ color: 'rgba(255,255,255,0.58)' }}>·</span>
          <span style={{
            fontFamily: 'monospace',
            fontSize: '0.58rem',
            letterSpacing: '0.08em',
            color: 'rgba(255,255,255,0.74)',
            textTransform: 'uppercase',
          }}>
            {hotspotCount} hotspots
          </span>
        </div>

        <div style={{
          fontFamily: 'system-ui, sans-serif',
          fontSize: '0.66rem',
          fontWeight: 600,
          color: 'rgba(255,255,255,0.94)',
          lineHeight: 1.2,
        }}>
          {cityCountry}
        </div>

        <div style={{
          fontFamily: 'system-ui, sans-serif',
          fontSize: '0.60rem',
          color: 'rgba(255,255,255,0.74)',
          lineHeight: 1.35,
        }}>
          {headline}
        </div>
      </div>
    </div>
  );
}

