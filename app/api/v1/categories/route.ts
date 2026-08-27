import { NextResponse } from 'next/server';
import {
  categorySlug,
  DIRECTORY_CATEGORIES,
  getCategoryMeta,
} from '../../../../lib/categories';
import {
  checkRateLimit,
  clientKey,
  rateLimitedResponse,
  rateLimitHeaders,
} from '../../../../lib/rateLimit';

export async function GET(request: Request) {
  const rateLimit = checkRateLimit(
    `v1_categories:${clientKey(request)}`,
    60,
    60,
  );
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit);

  const categories = DIRECTORY_CATEGORIES.map((category) => {
    const meta = getCategoryMeta(category);
    return {
      name: category,
      label: meta.label,
      emoji: meta.emoji,
      slug: categorySlug(category),
      group: meta.group.label,
    };
  });

  return NextResponse.json(
    {
      success: true,
      count: categories.length,
      categories,
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        'Access-Control-Allow-Origin': '*',
        ...rateLimitHeaders(rateLimit),
      },
    },
  );
}
