/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0d0a06',
        surface: '#1a1208',
        parchment: '#f5ead6',
        gold: '#c9a84c',
        blood: '#8b1a1a',
        dim: '#6b5c4a',
      },
      fontFamily: {
        serif: ['"Noto Serif Thai"', 'serif'],
        sans: ['"Noto Sans Thai"', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
      },
    },
  },
  plugins: [],
}
