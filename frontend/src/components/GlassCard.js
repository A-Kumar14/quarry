import React from 'react';

export const glassStyle = {
  background: 'var(--glass-bg)',
  backdropFilter: 'blur(40px) saturate(200%) brightness(1.08)',
  WebkitBackdropFilter: 'blur(40px) saturate(200%) brightness(1.08)',
  borderRadius: 18,
  borderTop: '1px solid var(--glass-border-t)',
  borderLeft: '1px solid var(--glass-border-l)',
  borderRight: '1px solid var(--glass-border-r)',
  borderBottom: '1px solid var(--glass-border-b)',
  boxShadow: 'var(--glass-shadow)',
};

export default function GlassCard({ children, style, className, ...props }) {
  return (
    <div style={{ ...glassStyle, ...style }} className={className} {...props}>
      {children}
    </div>
  );
}
