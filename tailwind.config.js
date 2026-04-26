/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        // Apple-inspired color system
        apple: {
          bg: '#fbfbfd',        // Light background
          surface: '#ffffff',   // Card/surface white
          gray: {
            50: '#f5f5f7',      // Lightest gray (Apple's bg)
            100: '#e8e8ed',     // Light gray
            200: '#d2d2d7',     // Border gray
            300: '#b0b0b6',     // Muted text
            400: '#8e8e93',     // Secondary text
            500: '#636366',     // Primary text light
            600: '#48484a',     // Primary text
            700: '#363638',     // Dark text
            800: '#242426',     // Darker text
            900: '#1c1c1e',     // Almost black
          },
          blue: '#007AFF',      // Primary blue
          teal: '#5AC8FA',      // Teal accent
          green: '#34C759',     // Success green
          yellow: '#FFCC00',    // Warning yellow
          orange: '#FF9500',    // Orange accent
          red: '#FF3B30',       // Error red
          purple: '#AF52DE',    // Purple accent
          pink: '#FF2D55',      // Pink accent
        },
        // Semantic colors
        primary: '#007AFF',
        secondary: '#5AC8FA',
        success: '#34C759',
        warning: '#FFCC00',
        danger: '#FF3B30',
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
        'apple': '0.75rem',     // 12px - Apple's standard
        'apple-sm': '0.5rem',   // 8px
        'apple-lg': '1rem',     // 16px
        'apple-xl': '1.25rem',  // 20px
      },
      backdropBlur: {
        'apple': '20px',
      },
      boxShadow: {
        'apple-sm': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        'apple': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'apple-lg': '0 10px 40px rgba(0, 0, 0, 0.15)',
        'apple-xl': '0 20px 60px rgba(0, 0, 0, 0.15)',
        'apple-inner': 'inset 0 1px 3px 0 rgba(0, 0, 0, 0.08)',
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