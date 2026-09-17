import { NextResponse } from 'next/server';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Catches every request under /api/ that doesn't match a more specific route
 * (Next.js always prefers a static/dynamic segment match over a catch-all).
 * Without this, an unmatched API path falls through to Next's default 404
 * page — an HTML document — which breaks agents that expect every /api/
 * response, including errors, to be JSON. See AGENTS.md's error-shape
 * convention (`{ error, message }`) used by every other route handler.
 */
function notFound(request: Request) {
  const { pathname } = new URL(request.url);
  return NextResponse.json(
    {
      error: 'not_found',
      message: `No API route exists at ${pathname}.`,
      status: 404,
      docs: 'https://allmcps.com/docs/api',
    },
    { status: 404, headers: CORS_HEADERS },
  );
}

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
