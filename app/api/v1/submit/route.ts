import { NextResponse } from 'next/server';
import { clientKey } from '../../../../lib/rateLimit';
import { submitListing } from '../../../../lib/submitListing';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as any;
    const outcome = await submitListing(body, clientKey(req));
    return NextResponse.json(outcome.body, {
      status: outcome.status,
      headers: outcome.ok ? undefined : outcome.headers,
    });
  } catch (e: any) {
    console.error('Agent submission error:', e);
    return NextResponse.json(
      { error: e?.message || 'Internal Server Error' },
      { status: 500 },
    );
  }
}
