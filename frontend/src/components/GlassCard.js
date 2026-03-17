import React from 'react';

export const glassStyle = {
  background: 'rgba(255, 255, 255, 0.15)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(255, 255, 255, 0.25)',
  borderRadius: 16,
  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
};

export default function GlassCard({ children, style, className, ...props }) {
  return (
    <div style={{ ...glassStyle, ...style }} className={className} {...props}>
      {children}
    </div>
  );
}
