import { defineConfig } from 'astro/config';

// Cambia SITE_URL en Netlify o aquí cuando tengas el dominio final.
export default defineConfig({
  site: process.env.SITE_URL || 'https://boda-santiago-daygrett.netlify.app',
});
