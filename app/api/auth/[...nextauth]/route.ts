import { type NextRequest, NextResponse } from 'next/server';
import { handlers } from '@/lib/auth';

export async function GET(req: NextRequest) {
  if (req.nextUrl.pathname.endsWith('/verify-request')) {
    return NextResponse.redirect(new URL('/verify-request', req.url), 303);
  }
  return handlers.GET(req);
}

export async function POST(req: NextRequest) {
  if (req.nextUrl.pathname.endsWith('/verify-request')) {
    return NextResponse.redirect(new URL('/verify-request', req.url), 303);
  }
  return handlers.POST(req);
}
