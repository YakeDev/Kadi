/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        nuit: '#0f172a',
        neutre: '#f1f5f9',
        accent: '#f97316'
      }
    }
  },
  plugins: []
}
