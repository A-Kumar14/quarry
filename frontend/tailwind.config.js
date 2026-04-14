/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      backdropBlur: {
        xs: '2px',
      },
      colors: {
        // shadcn-compatible tokens mapped to Quarry's design system
        card: 'var(--bg-secondary)',
        foreground: 'var(--fg-primary)',
        border: 'var(--border)',
        primary: {
          DEFAULT: '#F97316',
          foreground: '#ffffff',
        },
        secondary: {
          DEFAULT: 'var(--bg-secondary)',
          foreground: 'var(--fg-secondary)',
        },
        muted: {
          DEFAULT: 'var(--bg-tertiary)',
          foreground: 'var(--fg-dim)',
        },
        accent: {
          DEFAULT: '#F97316',
          foreground: '#ffffff',
        },
      },
    },
  },
  plugins: [],
};
