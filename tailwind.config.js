const tokens = require('./src/design/tokens.json');
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        gray: tokens.gray, slate: tokens.gray, zinc: tokens.gray, neutral: tokens.gray, stone: tokens.gray,
        // Existing Apple names are compatibility aliases for the one approved palette.
        apple: {
          bg: tokens.colors.canvas, surface: tokens.colors.surface, gray: tokens.gray,
          blue: tokens.colors.primary, teal: tokens.colors.info, green: tokens.colors.success,
          yellow: tokens.colors.warning, orange: tokens.colors.warning, red: tokens.colors.critical,
          purple: '#7950a8', pink: '#b73f73',
        },
        primary: tokens.colors.primary, secondary: tokens.colors.info,
        success: tokens.colors.success, warning: tokens.colors.warning, danger: tokens.colors.critical,
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          'system-ui',
          '"Helvetica Neue"',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        display: ['"SF Pro Display"', '-apple-system', 'system-ui', 'sans-serif'],
        mono: ['"SF Mono"', 'Monaco', 'Consolas', '"Courier New"', 'monospace'],
      },
      fontSize: {
        'xs': ['11px', { lineHeight: '1.5', letterSpacing: '0.06px' }],
        'sm': ['13px', { lineHeight: '1.5', letterSpacing: '-0.01px' }],
        'base': ['15px', { lineHeight: '1.6', letterSpacing: '-0.24px' }],
        'lg': ['17px', { lineHeight: '1.5', letterSpacing: '-0.43px' }],
        'xl': ['20px', { lineHeight: '1.4', letterSpacing: '-0.45px' }],
        '2xl': ['24px', { lineHeight: '1.3', letterSpacing: '0.35px' }],
        '3xl': ['28px', { lineHeight: '1.2', letterSpacing: '0.36px' }],
        '4xl': ['34px', { lineHeight: '1.1', letterSpacing: '0.37px' }],
        '5xl': ['48px', { lineHeight: '1.05', letterSpacing: '-0.003em' }],
        '6xl': ['64px', { lineHeight: '1', letterSpacing: '-0.003em' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      borderRadius: {
        'apple': tokens.radius.control,     // 12px - Apple's standard
        'apple-sm': tokens.radius.small,   // 8px
        'apple-lg': tokens.radius.card,     // 16px
        'apple-xl': tokens.radius.dialog,  // 20px
      },
      backdropBlur: {
        'apple': '20px',
      },
      boxShadow: {
        'apple-sm': tokens.shadow.card, 'apple': tokens.shadow.raised,
        'apple-lg': tokens.shadow.raised, 'apple-xl': tokens.shadow.dialog,
        'apple-inner': 'inset 0 1px 3px rgb(36 35 33 / 0.06)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in',
        'fade-out': 'fadeOut 0.3s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'slide-out': 'slideOut 0.3s ease-in',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideOut: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-100%)' },
        },
      },
      screens: {
        'xs': '475px',
      },
    },
  },
  plugins: [],
}
