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
        'bg-primary': '#070E10',
        'bg-surface': '#0C1416',
        'bg-elevated': '#151D22',
        'bg-hover': '#1A252B',
        accent: '#D4A853',
        'accent-hover': '#C4982F',
        'accent-light': '#E8C97A',
        'accent-muted': 'rgba(212,168,83,0.15)',
        'bid-price': '#00D4AA',
        'text-primary': '#F0F0F0',
        'text-secondary': '#8A9BA8',
        'timer-green': '#34D399',
        'timer-orange': '#FB923C',
        'timer-red': '#F43F5E',
        'live-dot': '#F43F5E',
        border: 'rgba(255,255,255,0.07)',
        'border-hover': 'rgba(255,255,255,0.14)',
      },
      fontFamily: {
        heebo: ['var(--font-heebo)', 'Heebo', 'sans-serif'],
        rubik: ['var(--font-rubik)', 'Rubik', 'sans-serif'],
      },
      animation: {
        'pulse-fast': 'pulse 0.8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'blink': 'blink 1.2s ease-in-out infinite',
        'fade-in-up': 'fadeInUp 0.5s ease-out both',
        'fade-in': 'fadeIn 0.4s ease-out both',
        'scale-in': 'scaleIn 0.4s ease-out both',
        'slide-in-right': 'slideInRight 0.5s ease-out both',
        'slide-in-left': 'slideInLeft 0.5s ease-out both',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.2' },
        },
        fadeInUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        slideInRight: {
          from: { opacity: '0', transform: 'translateX(20px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        slideInLeft: {
          from: { opacity: '0', transform: 'translateX(-20px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
      boxShadow: {
        'glow-accent': '0 4px 20px rgba(212, 168, 83, 0.25)',
        'glow-bid': '0 4px 20px rgba(0, 212, 170, 0.2)',
      },
    },
  },
  plugins: [],
}
export default config
