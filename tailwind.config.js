/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        teal: {
          DEFAULT: '#00d4aa',
          dim: 'rgba(0,212,170,0.1)',
          glow: 'rgba(0,212,170,0.25)',
        },
        bg: {
          primary: '#07090d',
          secondary: '#0c1118',
          card: '#0f1520',
          hover: '#131d2a',
        },
        border: {
          DEFAULT: 'rgba(0,212,170,0.12)',
          hover: 'rgba(0,212,170,0.28)',
          muted: 'rgba(255,255,255,0.06)',
        },
        txt: {
          primary: '#e8f2fc',
          secondary: '#7a9ab8',
          muted: '#3d5468',
        },
        gain: '#22c55e',
        loss: '#ef4444',
        warn: '#f59e0b',
      },
      fontFamily: {
        display: ['var(--font-playfair)', 'Georgia', 'serif'],
        mono: ['var(--font-dm-mono)', 'Courier New', 'monospace'],
        sans: ['var(--font-dm-mono)', 'system-ui', 'sans-serif'],
      },
      animation: {
        'scan': 'scan 8s linear infinite',
        'pulse-teal': 'pulse-teal 2s ease-in-out infinite',
        'slide-up': 'slide-up 0.4s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
        'shimmer': 'shimmer 1.8s ease-in-out infinite',
        'blink': 'blink 1s step-end infinite',
        'ticker': 'ticker 30s linear infinite',
      },
      keyframes: {
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        'pulse-teal': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.4 },
        },
        'slide-up': {
          '0%': { transform: 'translateY(16px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
        'fade-in': {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        blink: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0 },
        },
        ticker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      backgroundImage: {
        'grid-pattern': `linear-gradient(rgba(0,212,170,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,170,0.03) 1px, transparent 1px)`,
        'shimmer-gradient': 'linear-gradient(90deg, transparent 0%, rgba(0,212,170,0.08) 50%, transparent 100%)',
      },
      backgroundSize: {
        'grid': '40px 40px',
      },
    },
  },
  plugins: [],
}
