import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0D0D0D',
        'bg-surface': '#141414',
        'bg-elevated': '#1E1E1E',
        accent: '#6C63FF',
        'accent-hover': '#5A52E0',
        'bid-price': '#00D4AA',
        'text-primary': '#FFFFFF',
        'text-secondary': '#A0A0A0',
        'timer-green': '#22C55E',
        'timer-orange': '#F97316',
        'timer-red': '#EF4444',
        'live-dot': '#EF4444',
        border: 'rgba(255,255,255,0.08)',
      },
      fontFamily: {
        heebo: ['Heebo', 'sans-serif'],
      },
      animation: {
        'pulse-fast': 'pulse 0.8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'blink': 'blink 1s step-end infinite',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
    },
  },
  plugins: [],
}
export default config
