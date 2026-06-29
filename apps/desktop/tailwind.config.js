/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{js,jsx,ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        surface: {
          900: '#0f1117',
          800: '#161b27',
          700: '#1e2535',
          600: '#252d3d',
          500: '#2e3850'
        },
        accent: {
          DEFAULT: '#f59e0b',
          hover: '#fbbf24'
        }
      }
    }
  },
  plugins: []
}
