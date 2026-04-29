/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#6366f1',
          light: '#818cf8',
          dark: '#4f46e5',
        },
        surface: {
          50:  '#fafafa',
          100: '#f5f5f5',
          800: '#1c1c1e',
          900: '#111113',
        },
      },
    },
  },
  plugins: [],
};
