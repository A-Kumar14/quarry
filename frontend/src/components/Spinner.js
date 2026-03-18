import React from 'react';

export default function Spinner({ size = 20 }) {
  return (
    <>
      <div style={{
        width: size, height: size, borderRadius: '50%',
        border: '2px solid var(--border)',
        borderTopColor: 'var(--accent)',
        animation: 'spin 0.7s linear infinite',
        margin: '0 auto',
        flexShrink: 0,
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
