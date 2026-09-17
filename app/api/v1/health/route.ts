import { NextResponse } from 'next/server';
import {
  checkRateLimit,
  clientKey,
  rateLimitedResponse,
  rateLimitHeaders,
} from '@/lib/rateLimit';

export async function GET(request: Request) {
  // Generous limit — this is the canonical low-cost probe/monitor endpoint,
  // so it gets a higher budget than data-bearing endpoints like search.
  const rateLimit = checkRateLimit(`v1_health:${clientKey(request)}`, 120, 60);
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit);

  return NextResponse.json(
    {
      status: 'ok',
      service: 'AllMCPs API',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        ...rateLimitHeaders(rateLimit),
      },
    },
  );
}
