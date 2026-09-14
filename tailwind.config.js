/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        green: { DEFAULT: '#5B8C51', dark: '#3E6B37' },
        orange: { DEFAULT: '#F2994A', dark: '#D9782E' },
        cream: { DEFAULT: '#FFF8EE', 2: '#FFEFDB' },
        ink: '#2B241C',
      },
    },
  },
  plugins: [],
}
