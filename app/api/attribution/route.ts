import { NextResponse } from 'next/server';
import {
  ATTRIBUTION_COOKIE,
  ATTRIBUTION_MAX_AGE_SECONDS,
  attributionFromRequest,
  captureTouch,
  serializeAttribution,
  shouldReplaceTouch,
} from '@/lib/attribution';

function cookie(req: Request, value: string, maxAge: number) {
  const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
  return `${ATTRIBUTION_COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;
}

/**
 * Stores how this visitor arrived (lib/attribution.ts) in an HttpOnly cookie.
 * Called by lib/attributionClient.ts only after analytics consent, with the
 * landing page URL and document.referrer. Writes nothing to the database.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    href?: unknown;
    referrer?: unknown;
  } | null;
  const href = typeof body?.href === 'string' ? body.href.slice(0, 2000) : '';
  const referrer =
    typeof body?.referrer === 'string' ? body.referrer.slice(0, 2000) : '';

  // Only our own pages count as a landing page.
  let sameOrigin = false;
  try {
    sameOrigin = new URL(href).host === new URL(req.url).host;
  } catch {
    // fall through
  }
  const touch = sameOrigin
    ? captureTouch({ href, referrer, now: Date.now() })
    : null;

  const res = new NextResponse(null, { status: 204 });
  res.headers.set('Cache-Control', 'no-store');
  if (touch && shouldReplaceTouch(attributionFromRequest(req), touch)) {
    res.headers.append(
      'Set-Cookie',
      cookie(req, serializeAttribution(touch), ATTRIBUTION_MAX_AGE_SECONDS),
    );
  }
  return res;
}

/** Removes the cookie when the visitor declines analytics cookies. */
export async function DELETE(req: Request) {
  const res = new NextResponse(null, { status: 204 });
  res.headers.set('Cache-Control', 'no-store');
  res.headers.append('Set-Cookie', cookie(req, '', 0));
  return res;
}
