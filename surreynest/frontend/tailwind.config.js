import defaultTheme from 'tailwindcss/defaultTheme'

/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,jsx}'],
    theme: {
        extend: {
            colors: {
                primary: '#ea871d',
                'background-light': '#f7f6f8',
                'background-dark': '#211911',
            },
            fontFamily: {
                sans: ['Inter', ...defaultTheme.fontFamily.sans],
                display: ['Inter', ...defaultTheme.fontFamily.sans],
            },
            keyframes: {
                'float': {
                    '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
                    '33%': { transform: 'translate(30px, -20px) scale(1.05)' },
                    '66%': { transform: 'translate(-20px, 15px) scale(0.95)' },
                },
                'pulse-glow': {
                    '0%, 100%': { opacity: '0.6' },
                    '50%': { opacity: '1' },
                },
            },
            animation: {
                'float': 'float 8s ease-in-out infinite',
                'float-slow': 'float 12s ease-in-out infinite',
                'float-slower': 'float 16s ease-in-out infinite',
                'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
            },
            boxShadow: {
                'glass': '0 4px 30px rgba(0, 0, 0, 0.06)',
                'glass-lg': '0 8px 40px rgba(0, 0, 0, 0.08)',
                'primary-glow': '0 0 40px rgba(234, 135, 29, 0.15)',
                'primary-glow-lg': '0 0 60px rgba(234, 135, 29, 0.2)',
            },
        },
    },
    plugins: [],
}
