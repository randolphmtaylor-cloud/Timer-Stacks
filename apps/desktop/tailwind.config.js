import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Absolute paths so content scanning works regardless of the process CWD.
// When vite is invoked from the monorepo root (`vite apps/desktop`), relative
// paths like './src/**' would resolve to the root, missing all source files.
const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    resolve(__dirname, 'index.html'),
    resolve(__dirname, 'src/**/*.{ts,tsx}'),
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
        mono: ['"SF Mono"', '"Fira Code"', 'Menlo', 'monospace'],
      },
      colors: {
        // Premium neutral palette
        surface: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#efefef',
          300: '#e0e0e0',
          400: '#d4d4d4',
          500: '#a3a3a3',
          600: '#737373',
          700: '#525252',
          800: '#1c1c1e',
          900: '#111113',
          950: '#0a0a0b',
        },
        accent: {
          DEFAULT: '#6366f1',
          light: '#818cf8',
          dark:  '#4f46e5',
        },
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.08)',
        'card-dark': '0 1px 3px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.4)',
        float: '0 8px 32px rgba(0,0,0,0.12)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
};
