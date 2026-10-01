/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/keyboard/src/**/*.{ts,tsx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: 'var(--surface)',
        gray: Object.fromEntries(
          [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((n) => [
            n,
            `var(--gray-${n})`,
          ]),
        ),
        emerald: {
          50: 'var(--accent-soft)',
          100: 'var(--accent-soft)',
          200: 'var(--accent-border)',
          600: 'var(--accent)',
          700: 'var(--accent)',
          800: 'var(--accent-hover)',
        },
        amber: {
          50: 'var(--guide-soft)',
          100: 'var(--guide-soft)',
          300: 'var(--guide-border)',
          700: 'var(--guide-text)',
          800: 'var(--guide-text)',
        },
      },
    },
  },
  plugins: [],
};
