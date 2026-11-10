import type { APIRoute } from 'astro';

const FALLBACK_SITE = 'https://boda-santiago-daygrett.netlify.app';

export const GET: APIRoute = ({ site }) => {
  const siteURL = site ?? new URL(FALLBACK_SITE);
  const sitemapURL = new URL('sitemap.xml', siteURL);

  const body = [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${sitemapURL.href}`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
