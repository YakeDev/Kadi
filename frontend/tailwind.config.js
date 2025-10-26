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
        'bg-elevated': 'rgba(255,255,255,0.78)',
        'bg-panel': 'rgba(255,255,255,0.92)',
        border: 'rgba(15,23,42,0.08)'
      },
      borderRadius: {
        md: '14px',
        xl: '20px'
      },
      boxShadow: {
        soft: '0 28px 60px -45px rgba(28,28,30,0.32)',
        card: '0 40px 90px -60px rgba(28,28,30,0.36)',
        glass: '0 20px 48px -32px rgba(28,28,30,0.26)'
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
