/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#0a84ff',
        'primary-soft': 'rgba(10,132,255,0.14)',
        'text-dark': '#1d1d1f',
        'text-muted': '#6e6e73',
        'bg-base': '#f5f5f7',
        'bg-elevated': '#ffffff',
        'bg-panel': '#ffffff',
        border: 'rgba(15,23,42,0.08)'
      },
      borderRadius: {
        md: '14px',
        xl: '20px'
      },
      boxShadow: {
        soft: '0 0 0 0 rgba(0,0,0,0)',
        card: '0 0 0 0 rgba(0,0,0,0)',
        glass: '0 0 0 0 rgba(0,0,0,0)'
      },
      fontFamily: {
        sans: [
          '"SF Pro Display"',
          '"SF Pro Text"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Inter',
          'Helvetica',
          'Arial',
          'sans-serif'
        ]
      }
    }
  },
  plugins: []
}
