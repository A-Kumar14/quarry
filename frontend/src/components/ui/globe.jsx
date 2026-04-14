"use client";

import { useEffect, useRef } from 'react';
import createGlobe from 'cobe';

export function Globe({ className = '', config = {} }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    let globe = null;

    const onResize = () => {
      if (!canvas) return;
      const size = canvas.offsetWidth || 320;
      if (globe) globe.destroy();

      let phi = 0;
      globe = createGlobe(canvas, {
        width: size,
        height: size,
        devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        phi: 0,
        theta: 0.25,
        dark: 0,
        diffuse: 1.2,
        mapSamples: 12000,
        mapBrightness: 1.1,
        baseColor: [0.38, 0.31, 0.20],
        markerColor: [0.95, 0.42, 0.2],
        glowColor: [0.90, 0.84, 0.72],
        markerElevation: 0.01,
        markers: [],
        ...config,
        onRender: (state) => {
          phi += 0.0032;
          state.phi = phi;
          state.theta = 0.22;
          state.scale = 0.9;
          if (config.onRender) config.onRender(state);
        },
      });

      canvas.style.opacity = '1';
    };

    onResize();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      if (globe) globe.destroy();
    };
  }, [config]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        opacity: 0,
        transition: 'opacity 0.8s ease',
        display: 'block',
      }}
    />
  );
}

