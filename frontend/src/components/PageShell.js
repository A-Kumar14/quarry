import React from 'react';
import { useDarkMode } from '../DarkModeContext';

/**
 * Shared page wrapper that accounts for the fixed mast + top-right navbar.
 * Keeps pages visually consistent and prevents content from hiding underneath the overlay.
 */
export default function PageShell({
  children,
  maxWidth = 1120,
  paddingX = 24,
  paddingTop = 84, // fixed overlay (top=12) + nav height + breathing room
  paddingBottom = 80,
  style,
}) {
  useDarkMode(); // ensures dark-mode class effects are applied within page trees

  return (
    <div style={{ minHeight: '100vh', width: '100%', ...style }}>
      <div
        style={{
          maxWidth,
          margin: '0 auto',
          padding: `${paddingTop}px ${paddingX}px ${paddingBottom}px`,
          boxSizing: 'border-box',
        }}
      >
        {children}
      </div>
    </div>
  );
}

