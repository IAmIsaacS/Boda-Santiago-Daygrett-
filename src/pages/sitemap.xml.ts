import type { APIRoute } from 'astro';

const FALLBACK_SITE = 'https://boda-santiago-daygrett.netlify.app';

export const GET: APIRoute = ({ site }) => {
  const siteURL = site ?? new URL(FALLBACK_SITE);
  const pageURL = new URL('/', siteURL);
  const lastmod = new Date().toISOString();

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${pageURL.href}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
};
