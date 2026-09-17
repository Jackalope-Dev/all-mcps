import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

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
    /\.(?:css|js|mjs|map|txt|xml|webmanifest|ico|svg|png|jpg|jpeg|gif|webp|avif|woff|woff2|ttf|eot)$/i.test(
      pathname,
    )
  ) {
    return NextResponse.next();
  }

  // 0. Legacy redirects & URL normalization (301 Permanent Redirect)
  if (pathname.length > 1 && pathname.endsWith('/')) {
    const url = req.nextUrl.clone();
    url.pathname = pathname.slice(0, -1);
    return NextResponse.redirect(url, 301);
  }

  // `/?category=`/`/?q=` are filtered/search views that live on /browse — this
  // used to be a redirect inside app/page.tsx's Server Component, but merely
  // reading `searchParams` there (even to find it empty, true for virtually all
  // real homepage traffic) forced Next to render the whole homepage dynamically,
  // defeating its ISR caching for every visitor. Doing the redirect here instead
  // means the homepage component itself never touches searchParams. 307 to match
  // next/navigation's `redirect()` default (what this replaced).
  if (pathname === '/') {
    const homeCategory = searchParams.get('category');
    const homeQ = searchParams.get('q');
    if (homeCategory || homeQ) {
      const url = new URL('/browse', req.url);
      url.search = '';
      if (homeCategory) url.searchParams.set('category', homeCategory);
      if (homeQ) url.searchParams.set('q', homeQ);
      return NextResponse.redirect(url, 307);
    }
  }

  if (
    pathname.startsWith('/server/') ||
    pathname.startsWith('/servers/') ||
    pathname.startsWith('/mcp-server/') ||
    pathname.startsWith('/mcp-servers/')
  ) {
    const rest = pathname
      .replace(/^\/servers\//, '')
      .replace(/^\/server\//, '')
      .replace(/^\/mcp-servers\//, '')
      .replace(/^\/mcp-server\//, '');
    const url = req.nextUrl.clone();
    url.pathname = `/mcp/${rest}`;
    return NextResponse.redirect(url, 301);
  }

  if (pathname === '/directory') {
    const url = req.nextUrl.clone();
    url.pathname = '/browse';
    return NextResponse.redirect(url, 301);
  }

  if (pathname.startsWith('/directory/')) {
    const cat = pathname.replace(/^\/directory\//, '');
    const url = req.nextUrl.clone();
    url.pathname = `/categories/${cat}`;
    return NextResponse.redirect(url, 301);
  }

  let response: NextResponse;

  // 1. Well-known, OpenAPI & Auth.md rewrites
  if (pathname === '/.well-known/api-catalog') {
    response = NextResponse.rewrite(
      new URL('/api/well-known/api-catalog', req.url),
    );
  } else if (
    pathname === '/.well-known/openid-configuration' ||
    pathname === '/.well-known/oauth-authorization-server'
  ) {
    response = NextResponse.rewrite(
      new URL('/api/well-known/openid-configuration', req.url),
    );
  } else if (pathname === '/.well-known/oauth-protected-resource') {
    response = NextResponse.rewrite(
      new URL('/api/well-known/oauth-protected-resource', req.url),
    );
  } else if (
    pathname === '/.well-known/mcp/server-card.json' ||
    pathname === '/.well-known/mcp/server-card'
  ) {
    response = NextResponse.rewrite(
      new URL('/api/well-known/mcp-server-card', req.url),
    );
  } else if (
    pathname === '/.well-known/agent-skills/index.json' ||
    pathname === '/.well-known/agent-skills/index'
  ) {
    response = NextResponse.rewrite(
      new URL('/api/well-known/agent-skills/index', req.url),
    );
  } else if (
    pathname === '/.well-known/acp.json' ||
    pathname === '/.well-known/acp'
  ) {
    response = NextResponse.rewrite(new URL('/api/well-known/acp', req.url));
  } else if (
    pathname === '/.well-known/mcp.json' ||
    pathname === '/.well-known/mcp'
  ) {
    // GET returns the descriptive manifest; POST/OPTIONS proxy straight to the
    // real MCP JSON-RPC endpoint so `initialize` (and every other tool call)
    // actually works at this well-known URL instead of just describing itself.
    response =
      req.method === 'GET'
        ? NextResponse.rewrite(new URL('/api/well-known/mcp-json', req.url))
        : NextResponse.rewrite(new URL('/api/mcp', req.url));
  } else if (pathname === '/auth.md') {
    response = NextResponse.rewrite(
      new URL('/api/well-known/auth-md', req.url),
    );
  } else if (pathname === '/openapi.json') {
    response = NextResponse.rewrite(new URL('/api/v1/openapi.json', req.url));
  }
  // 2. Existing MCP Markdown rewrite — single-segment /mcp/{id} only (with or without
  // .md), so deeper sub-paths like /mcp/{id}/alternatives and /mcp/{id}/vs/{other}
  // fall through to branch 3 instead of being misparsed as a bogus server id.
  else if (
    pathname.startsWith('/mcp/') &&
    !pathname.slice('/mcp/'.length).includes('/')
  ) {
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
      // nofollow: the mirrored README's relative links would otherwise be
      // crawled and resolved against allmcps.com (/mcp/<id>.md), 404ing.
      response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    } else {
      response = NextResponse.next();
    }
  }
  // 3. Markdown negotiation for agents on general pages
  else if (
    (acceptHeader.includes('text/markdown') ||
      searchParams.get('format') === 'md') &&
    !pathname.startsWith('/api/') &&
    !pathname.startsWith('/_next/') &&
    !pathname.startsWith('/.well-known/')
  ) {
    // Query params set on the rewrite target URL don't reach the destination Route
    // Handler's `request.url` (confirmed empirically — the rewritten pathname is
    // honored for routing, but req.nextUrl.searchParams there still reflects the
    // ORIGINAL request). Pass the target path via a request header instead, which
    // does propagate through NextResponse.rewrite()'s `request.headers` option.
    const url = new URL('/api/v1/markdown-renderer', req.url);
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-agent-markdown-path', pathname);
    response = NextResponse.rewrite(url, {
      request: { headers: requestHeaders },
    });
  } else {
    response = NextResponse.next();
  }

  // RFC 8288 Link Header for Agent Discovery + AEO surfaces
  const linkHeader = [
    '</.well-known/api-catalog>; rel="api-catalog"',
    '</docs/api>; rel="service-doc"',
    '</.well-known/agent-skills/index.json>; rel="agent-skills"',
    '</.well-known/mcp/server-card.json>; rel="mcp-server-card"',
    '</.well-known/openid-configuration>; rel="oauth-authorization-server"',
    '</.well-known/oauth-protected-resource>; rel="oauth-protected-resource"',
    '</auth.md>; rel="authorizing-agent"',
    // llms.txt / catalog dataset — discoverable without scraping HTML
    '</llms.txt>; rel="describedby"; type="text/plain"',
    '</llms-full.txt>; rel="alternate"; type="text/plain"',
    '</data.json>; rel="alternate"; type="application/json"',
    '</blog/rss.xml>; rel="alternate"; type="application/rss+xml"',
  ].join(', ');

  response.headers.set('Link', linkHeader);
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()',
  );
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains',
  );
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self' https://p.allmcps.com https://*.posthog.com https://us.posthog.com; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://www.googletagmanager.com https://*.posthog.com https://us.posthog.com https://us-assets.i.posthog.com https://p.allmcps.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://*.posthog.com https://us-assets.i.posthog.com https://p.allmcps.com; img-src 'self' data: blob: https:; font-src 'self' data: https:; connect-src 'self' https:; frame-src 'self' https://challenges.cloudflare.com https://js.stripe.com https://*.posthog.com https://us.posthog.com https://p.allmcps.com https://www.youtube.com https://www.youtube-nocookie.com;",
  );

  // CDNs cache by URL alone unless told otherwise. Every non-API path here can
  // serve either HTML or the markdown-negotiated body depending on the request's
  // Accept header (see branches 2 & 3 above), so without `Vary: Accept` a CDN can
  // cache one representation and hand it to a client that asked for the other
  // (e.g. an HTML page served to an agent that sent `Accept: text/markdown`).
  // Next already sets its own Vary (RSC routing headers) — append rather than
  // overwrite so both are honored.
  const existingVary = response.headers.get('Vary');
  const varyTokens = new Set(
    (existingVary || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
  );
  varyTokens.add('Accept');
  varyTokens.add('Accept-Encoding');
  response.headers.set('Vary', Array.from(varyTokens).join(', '));

  // Private app routes must not be cached. Public HTML should keep ISR /
  // CDN s-maxage — Googlebot sends Accept: text/html, and a blanket no-store
  // here was preventing cached listing/marketing pages from being reused.
  const isPrivate =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/verify-request');
  if (isPrivate) {
    response.headers.set(
      'Cache-Control',
      'no-store, max-age=0, must-revalidate',
    );
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/|favicon.ico|sw.js|.*\\.(?:css|js|mjs|map|txt|xml|webmanifest|ico|svg|png|jpg|jpeg|gif|webp|avif|woff|woff2|ttf|eot)$).*)',
  ],
};
