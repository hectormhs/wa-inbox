/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        wa: {
          green: '#25D366',
          dark: '#111B21',
          darker: '#0B141A',
          panel: '#202C33',
          input: '#2A3942',
          bubble: '#005C4B',
          light: '#E9EDEF',
          muted: '#8696A0',
        },
      },
    },
  },
  plugins: [],
};
