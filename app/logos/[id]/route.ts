import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

const ID_PATTERN = /^[a-z0-9-]+$/;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_PATTERN.test(id)) {
    return new NextResponse(null, { status: 404 });
  }

  let env: any;
  try {
    const ctx = await getCloudflareContext();
    env = ctx.env;
  } catch {
    return new NextResponse(null, { status: 404 });
  }
  if (!env?.LOGOS) {
    return new NextResponse(null, { status: 404 });
  }

  const object = await env.LOGOS.get(`live/${id}.png`);
  if (!object) {
    return new NextResponse(null, { status: 404 });
  }

  const etag = object.httpEtag || object.etag;
  const headers: Record<string, string> = {
    'Content-Type': 'image/png',
    'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
  };
  if (etag) {
    headers['ETag'] = etag;
  }

  return new NextResponse(object.body, { headers });
}
