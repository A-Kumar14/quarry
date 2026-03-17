import React from 'react';

export default function Toast({ show, message }) {
  return (
    <div style={{
      position:             'fixed',
      bottom:               28,
      left:                 '50%',
      transform:            `translateX(-50%) translateY(${show ? '0' : '12px'})`,
      opacity:              show ? 1 : 0,
      pointerEvents:        'none',
      transition:           'opacity 0.22s ease, transform 0.22s ease',
      zIndex:               9999,
      background:           'rgba(17, 24, 39, 0.90)',
      backdropFilter:       'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      color:                '#fff',
      padding:              '8px 20px',
      borderRadius:         10,
      fontFamily:           'var(--font-family)',
      fontSize:             '0.82rem',
      fontWeight:           500,
      boxShadow:            '0 4px 20px rgba(0,0,0,0.22)',
      whiteSpace:           'nowrap',
    }}>
      {message}
    </div>
  );
}
