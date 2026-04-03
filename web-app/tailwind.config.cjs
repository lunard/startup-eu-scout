module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        eu: {
          blue:    '#003399',
          gold:    '#FFD700',
          navy:    '#0A1628',
          'navy-2': '#0F2040',
          'navy-3': '#162952',
          sky:     '#1E90FF',
          muted:   '#8899BB',
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        display: ['"Cal Sans"', '"Inter"', 'system-ui', 'sans-serif'],
      },
      backdropBlur: { xs: '2px' },
      animation: {
        'fade-in':   'fadeIn 0.4s ease-out',
        'slide-up':  'slideUp 0.4s cubic-bezier(0.16,1,0.3,1)',
        'pulse-slow':'pulse 3s ease-in-out infinite',
        'shimmer':   'shimmer 1.8s linear infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' },              to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(24px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        shimmer: { from: { backgroundPosition: '-200% 0' }, to: { backgroundPosition: '200% 0' } },
      },
      boxShadow: {
        'glass': '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
        'glow-blue': '0 0 20px rgba(30,144,255,0.35)',
        'glow-gold': '0 0 20px rgba(255,215,0,0.3)',
        'card': '0 2px 16px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
}
