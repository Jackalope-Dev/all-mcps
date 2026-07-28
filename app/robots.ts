import { MetadataRoute } from 'next';

export const runtime = 'edge';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin'],
      },
      {
        userAgent: ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'Amazonbot', 'Bytespider'],
        allow: ['/', '/llms.txt', '/llms-full.txt', '/api/v1/', '/api/mcp'],
        disallow: ['/admin'],
      },
    ],
    sitemap: ['https://allmcps.com/sitemap.xml', 'https://allmcps.com/llms.txt'],
  };
}
