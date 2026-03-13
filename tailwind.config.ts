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
        'bg-primary': '#080F0F',
        'bg-surface': '#0E1515',
        'bg-elevated': '#1A1F2E',
        accent: '#433BFF',
        'accent-hover': '#3730D9',
        'accent-light': '#89A6FB',
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
