/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          green: 'hsl(145 80% 48%)',
          navy:  '#0b1120',
          card:  'rgba(255,255,255,0.04)',
        },
      },
      fontFamily: {
        sans:  ['Space Grotesk', 'Inter', 'sans-serif'],
        mono:  ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
