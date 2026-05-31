/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#6366f1', // violet
        danger: '#ef4444',
        warning: '#f59e42',
        success: '#10b981',
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(31, 38, 135, 0.18)',
      },
      borderRadius: {
        xl: '1.25rem',
        '2xl': '1.5rem',
      },
      animation: {
        fadeIn: 'fadeIn 0.6s ease',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
      },
    },
  },
  plugins: [],
};
