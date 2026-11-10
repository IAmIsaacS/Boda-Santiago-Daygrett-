/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          white: '#FFFFFF',
          dark: '#242424',
          secondary: '#666666',
          accent: '#EFC2D0', // Rosa pastel
          line: '#E5E5E5'
        }
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"Montserrat"', '-apple-system', 'sans-serif'],
        hero: ['"Corinthia"', 'cursive']
      },
      maxWidth: {
        'content': '1320px'
      }
    }
  }
};
