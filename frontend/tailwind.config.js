/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        krishi: {
          primary: '#1E8E4A',
          accent: '#F6A500',
          background: '#F7FAFC',
          text: '#1F2937',
          primaryDark: '#176B39',
        },
        primary: {
          50: '#ecf8ef',
          100: '#d4edd9',
          200: '#a8dbb3',
          300: '#7bc98d',
          400: '#4eb767',
          500: '#1E8E4A',
          600: '#18723b',
          700: '#12562c',
          800: '#0c3a1d',
          900: '#061e0e',
        },
        accent: {
          DEFAULT: '#F6A500',
          light: '#FFB833',
          dark: '#CC8400',
        }
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans Devanagari', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
