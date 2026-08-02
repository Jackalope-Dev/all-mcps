import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  const acceptHeader = req.headers.get('accept') || '';

  // Never run rewrite/header logic for framework and static asset requests.
  // This avoids touching CSS/JS/font delivery paths where iOS Safari is
  // particularly sensitive to stale or mismatched responses.
  if (
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname === '/sw.js' ||
    /\.(?:css|js|mjs|map|txt|xml|webmanifest|ico|svg|png|jpg|jpeg|gif|webp|avif|woff|woff2|ttf|eot)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  let response: NextResponse;

  // 1. Well-known, OpenAPI & Auth.md rewrites
  if (pathname === '/.well-known/api-catalog') {
    response = NextResponse.rewrite(new URL('/api/well-known/api-catalog', req.url));
  } else if (
    pathname === '/.well-known/openid-configuration' ||
    pathname === '/.well-known/oauth-authorization-server'
  ) {
    response = NextResponse.rewrite(new URL('/api/well-known/openid-configuration', req.url));
  } else if (pathname === '/.well-known/oauth-protected-resource') {
    response = NextResponse.rewrite(new URL('/api/well-known/oauth-protected-resource', req.url));
  } else if (
    pathname === '/.well-known/mcp/server-card.json' ||
    pathname === '/.well-known/mcp/server-card'
  ) {
    response = NextResponse.rewrite(new URL('/api/well-known/mcp-server-card', req.url));
  } else if (
    pathname === '/.well-known/agent-skills/index.json' ||
    pathname === '/.well-known/agent-skills/index'
  ) {
    response = NextResponse.rewrite(new URL('/api/well-known/agent-skills/index', req.url));
  } else if (pathname === '/.well-known/acp.json' || pathname === '/.well-known/acp') {
    response = NextResponse.rewrite(new URL('/api/well-known/acp', req.url));
  } else if (pathname === '/.well-known/mcp.json' || pathname === '/.well-known/mcp') {
    response = NextResponse.rewrite(new URL('/api/well-known/mcp-json', req.url));
  } else if (pathname === '/auth.md') {
    response = NextResponse.rewrite(new URL('/api/well-known/auth-md', req.url));
  } else if (pathname === '/openapi.json') {
    response = NextResponse.rewrite(new URL('/api/v1/openapi.json', req.url));
  }
  // 2. Existing MCP Markdown rewrite
  else if (pathname.startsWith('/mcp/')) {
    const isMarkdownAccept = acceptHeader.includes('text/markdown');
    const isMarkdownFormat = searchParams.get('format') === 'md';
    const isDotMdPath = pathname.endsWith('.md');

    if (isMarkdownAccept || isMarkdownFormat || isDotMdPath) {
      let serverId = pathname.replace('/mcp/', '');
      if (serverId.endsWith('.md')) {
        serverId = serverId.slice(0, -3);
      }
      const url = req.nextUrl.clone();
      url.pathname = `/api/v1/mcp/${serverId}/markdown`;
      response = NextResponse.rewrite(url);
    } else {
      response = NextResponse.next();
    }
  }
  // 3. Markdown negotiation for agents on general pages
  else if (
    (acceptHeader.includes('text/markdown') || searchParams.get('format') === 'md') &&
    !pathname.startsWith('/api/') &&
    !pathname.startsWith('/_next/') &&
    !pathname.startsWith('/.well-known/')
  ) {
    const url = req.nextUrl.clone();
    url.pathname = '/api/v1/markdown-renderer';
    url.searchParams.set('path', pathname);
    response = NextResponse.rewrite(url);
  } else {
    response = NextResponse.next();
  }

  // RFC 8288 Link Header for Agent Discovery
  const linkHeader = [
    '</.well-known/api-catalog>; rel="api-catalog"',
    '</docs/api>; rel="service-doc"',
    '</.well-known/agent-skills/index.json>; rel="agent-skills"',
    '</.well-known/mcp/server-card.json>; rel="mcp-server-card"',
    '</.well-known/openid-configuration>; rel="oauth-authorization-server"',
    '</.well-known/oauth-protected-resource>; rel="oauth-protected-resource"',
    '</auth.md>; rel="authorizing-agent"',
  ].join(', ');

  response.headers.set('Link', linkHeader);
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // Prevent stale HTML from referencing outdated hashed CSS/JS bundles after deploys.
  if (!pathname.startsWith('/api/') && acceptHeader.includes('text/html')) {
    response.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/|favicon.ico|sw.js|.*\\.(?:css|js|mjs|map|txt|xml|webmanifest|ico|svg|png|jpg|jpeg|gif|webp|avif|woff|woff2|ttf|eot)$).*)'],
};
