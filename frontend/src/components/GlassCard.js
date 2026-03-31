import React from 'react';
import { GlassCard as RGUGlassCard } from 'react-glass-ui';
import { useDarkMode } from '../DarkModeContext';

/* ── CSS-variable glass style (large panels, search surface) ──────────────── */
export const glassStyle = {
  background: 'var(--glass-bg)',
  backdropFilter: 'var(--glass-blur)',
  WebkitBackdropFilter: 'var(--glass-blur)',
  borderRadius: 18,
  borderTop: '1px solid var(--glass-border-t)',
  borderLeft: '1px solid var(--glass-border-l)',
  borderRight: '1px solid var(--glass-border-r)',
  borderBottom: '1px solid var(--glass-border-b)',
  boxShadow: 'var(--glass-shadow)',
};

/* ── CSS-variable glass card style (content cards, info tiles) ─────────────── */
export const glassCardStyle = {
  background: 'var(--glass-card-bg)',
  backdropFilter: 'var(--glass-card-blur)',
  WebkitBackdropFilter: 'var(--glass-card-blur)',
  borderRadius: 12,
  borderTop: '1px solid var(--glass-card-border-t)',
  borderLeft: '1px solid var(--glass-card-border-l)',
  borderRight: '1px solid var(--glass-card-border-r)',
  borderBottom: '1px solid var(--glass-card-border-b)',
  boxShadow: 'var(--glass-card-shadow)',
};

/* ── Default GlassCard — `variant="card"` uses crisper card tokens ───────── */
export default function GlassCard({ children, style, className, onClick, variant = 'card', ...props }) {
  const base = variant === 'surface' ? glassStyle : glassCardStyle;
  return (
    <div style={{ ...base, ...style }} className={className} onClick={onClick} {...props}>
      {children}
    </div>
  );
}

/* ── LiquidGlassCard — uses react-glass-ui for premium liquid distortion ──── */
/* Use on fixed-width hero elements: feature cards, search surface, etc.       */
export function LiquidGlassCard({
  children,
  dark: darkProp,
  borderRadius = 18,
  padding = '0px',
  onClick,
  width,
  height,
  style,       // applied to outer wrapper div
  className,
}) {
  const [darkCtx] = useDarkMode();
  const dark = darkProp ?? darkCtx;

  const lightProps = {
    backgroundColor: '#FFF8EE',
    backgroundOpacity: 0.55,
    blur: 18,
    distortion: 4,
    chromaticAberration: 0.15,
    borderColor: '#FFFEF5',
    borderOpacity: 0.95,
    borderSize: 1,
    innerLightColor: '#FFFEF0',
    innerLightOpacity: 0.70,
    innerLightBlur: 3,
    innerLightSpread: 1,
    outerLightColor: '#F97316',
    outerLightOpacity: 0.06,
    outerLightBlur: 12,
    outerLightSpread: 3,
  };

  const darkProps = {
    backgroundColor: '#FFFFFF',
    backgroundOpacity: 0.05,
    blur: 16,
    distortion: 3,
    borderColor: '#FFFFFF',
    borderOpacity: 0.08,
    borderSize: 1,
    innerLightColor: '#FFFFFF',
    innerLightOpacity: 0.04,
    innerLightBlur: 1,
    innerLightSpread: 0,
  };

  const glassProps = dark ? darkProps : lightProps;

  return (
    <div style={{ display: 'contents', ...style }} className={className} onClick={onClick}>
      <RGUGlassCard
        {...glassProps}
        borderRadius={borderRadius}
        padding={padding}
        width={width}
        height={height}
        flexibility={3}
        onHoverScale={1.01}
      >
        {children}
      </RGUGlassCard>
    </div>
  );
}
