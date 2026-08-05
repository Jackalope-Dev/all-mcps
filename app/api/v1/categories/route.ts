import { NextResponse } from 'next/server';
import { DIRECTORY_CATEGORIES, getCategoryMeta, categorySlug } from '../../../../lib/categories';

export async function GET() {
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
      },
    }
  );
}
