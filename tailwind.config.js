/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Cobalt blue — intentional, trustworthy, not teal
        accent: {
          50:  '#eef0ff',
          100: '#dde1ff',
          200: '#c0c7fe',
          300: '#9ba4fd',
          400: '#7c85fa',
          500: '#5c65f5',  // primary action
          600: '#4148e0',  // hover
          700: '#3238c4',
          800: '#2a2f9e',
          900: '#272c7e',
        },
        // Dark system — warm-cool charcoal, NOT Tailwind slate clones
        ui: {
          base:     '#0b0d14',  // page background
          surface:  '#111320',  // sidebar, panels
          elevated: '#171b2d',  // hover, selected
          border:   '#252840',  // card borders
          border2:  '#1c1f32',  // dividers
          muted:    '#3a3f5c',  // inactive icons
          subtle:   '#8890b0',  // secondary text
          primary:  '#c8ccee',  // body text
          bright:   '#edf0ff',  // headings
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      animation: {
        'fade-in':     'fadeIn 0.2s ease-out',
        'slide-up':    'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-right': 'slideRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideRight: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
}
