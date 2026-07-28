import { NextResponse } from 'next/server';

// TEMPORARY diagnostic route to isolate an outbound-fetch hang from the Worker.
// Remove once the /api/stripe/checkout timeout is root-caused.

async function ping(url: string) {
  const start = Date.now();
  try {
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(8000) });
    return { url, ok: res.ok, status: res.status, ms: Date.now() - start };
  } catch (e: any) {
    return { url, ok: false, error: e?.message || String(e), ms: Date.now() - start };
  }
}

export async function GET() {
  const results = await Promise.all([
    ping('https://api.stripe.com/v1'),
    ping('https://api.github.com'),
    ping('https://cloudflare.com'),
  ]);

  return NextResponse.json({ results });
}
