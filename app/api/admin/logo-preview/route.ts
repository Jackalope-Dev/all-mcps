import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getAuthorizedAdminEmail } from '../../../../lib/accessAuth';

/** Logos: pending/<id>.png — Screenshots: screenshots/pending/<id>.png */
const PENDING_KEY_PATTERN = /^(?:screenshots\/)?pending\/[a-z0-9-]+\.png$/;

export async function GET(req: Request) {
  if (!(await getAuthorizedAdminEmail(req.headers))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const key = new URL(req.url).searchParams.get('key') || '';
  if (!PENDING_KEY_PATTERN.test(key)) {
    return new NextResponse(null, { status: 400 });
  }

  let env: any;
  try {
    const ctx = await getCloudflareContext();
    env = ctx.env;
  } catch {
    return new NextResponse(null, { status: 500 });
  }
  if (!env?.LOGOS) {
    return new NextResponse(null, { status: 500 });
  }

  const object = await env.LOGOS.get(key);
  if (!object) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(object.body, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, no-store' },
  });
}
