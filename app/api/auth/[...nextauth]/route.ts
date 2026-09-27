import { type NextRequest, NextResponse } from 'next/server';
import { handlers } from '@/lib/auth';

const VALID_AUTH_ACTIONS = new Set([
  'providers',
  'session',
  'csrf',
  'signin',
  'signout',
  'callback',
  'verify-request',
  'error',
  'webauthn-options',
]);

function extractAuthAction(pathname: string): string | null {
  const match = pathname.match(/^\/api\/auth(?:\/([^/]+))?/);
  return match?.[1] || null;
}

function handleAuthRoute(req: NextRequest, isPost: boolean) {
  const action = extractAuthAction(req.nextUrl.pathname);

  // Friendly redirect for /api/auth/login -> /login.
  // 303 See Other ensures both GET and POST requests are redirected via GET.
  if (action === 'login' || req.nextUrl.pathname.endsWith('/login')) {
    const url = new URL('/login', req.url);
    url.search = req.nextUrl.search;
    return NextResponse.redirect(url, 303);
  }

  // Friendly redirect for /api/auth/verify-request -> /verify-request.
  if (
    action === 'verify-request' ||
    req.nextUrl.pathname.endsWith('/verify-request')
  ) {
    const url = new URL('/verify-request', req.url);
    url.search = req.nextUrl.search;
    return NextResponse.redirect(url, 303);
  }

  // Handle /api/auth/token: inform OAuth clients how programmatic tokens work
  // rather than letting Auth.js throw UnknownAction.
  if (action === 'token') {
    return NextResponse.json(
      {
        error: 'unsupported_grant_type',
        error_description:
          'Programmatic agent tokens are issued via POST /api/v1/agent/register/confirm. See /auth.md',
      },
      { status: 400 },
    );
  }

  // Reject unrecognized auth actions before Auth.js throws UnknownAction
  // and logs console.error to Cloudflare Workers log drain.
  if (action && !VALID_AUTH_ACTIONS.has(action)) {
    return NextResponse.json(
      {
        error: 'unknown_action',
        message: `Unknown auth action: ${action}`,
      },
      { status: 400 },
    );
  }

  return isPost ? handlers.POST(req) : handlers.GET(req);
}

export async function GET(req: NextRequest) {
  return handleAuthRoute(req, false);
}

export async function POST(req: NextRequest) {
  return handleAuthRoute(req, true);
}
