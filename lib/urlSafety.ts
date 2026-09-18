function isPrivateOrReservedIpv4(a: number, b: number): boolean {
  if (a === 127) return true; // loopback
  if (a === 10) return true; // private
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 169 && b === 254) return true; // link-local
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a === 0) return true; // "this" network
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isPrivateOrReservedHost(hostname: string): boolean {
  // A trailing dot is a valid fully-qualified spelling ("localhost.") that
  // would otherwise slip past the exact-match checks below.
  const host = hostname.toLowerCase().replace(/\.$/, '');

  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local')
  ) {
    return true;
  }

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    return isPrivateOrReservedIpv4(Number(ipv4[1]), Number(ipv4[2]));
  }

  const v6 = host.replace(/^\[|\]$/g, '');
  if (v6 === '::1' || v6 === '::') return true; // loopback / unspecified
  if (v6.startsWith('fe80:')) return true; // link-local
  if (/^f[cd][0-9a-f]{2}:/i.test(v6)) return true; // unique local fc00::/7

  // IPv4-mapped IPv6 (::ffff:a.b.c.d). The URL parser normalizes the dotted
  // tail to two hex groups, e.g. [::ffff:127.0.0.1] -> [::ffff:7f00:1].
  const mapped = v6.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mapped) {
    const hi = Number.parseInt(mapped[1], 16);
    return isPrivateOrReservedIpv4(hi >> 8, hi & 0xff);
  }

  return false;
}

/** Validates a user-submitted URL is safe to store and later fetch server-side. */
export function isSafeSubmissionUrl(urlString: string): boolean {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return false;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  if (isPrivateOrReservedHost(url.hostname)) return false;

  return true;
}

/** Normalizes a URL string by lowercasing scheme and host using URL standard formatting. */
export function normalizeUrl(urlString: string): string {
  const trimmed = (urlString || '').trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    return parsed.href;
  } catch {
    return trimmed;
  }
}

/** Defense-in-depth check before the health-check cron fetches a stored URL. */
export const isSafeFetchTarget = isSafeSubmissionUrl;

const MAX_REDIRECTS = 5;

/**
 * fetch() that re-checks every redirect hop with isSafeFetchTarget. A default
 * fetch follows redirects on its own, so a public URL that passed the check
 * could still 302 to a blocked host. Mirrors fetch's own method rules: 303,
 * and 301/302 on a POST, continue as a bodiless GET; 307/308 replay as-is.
 */
export async function safeFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  let current = url;
  let req: RequestInit = { ...init, redirect: 'manual' };
  for (let hop = 0; ; hop++) {
    if (!isSafeFetchTarget(current)) {
      throw new Error('Redirected to a URL that is not a permitted endpoint.');
    }
    const res = await fetch(current, req);
    const location = res.headers.get('location');
    if (res.status < 300 || res.status > 399 || !location) return res;
    if (hop >= MAX_REDIRECTS) throw new Error('Too many redirects.');

    const next = new URL(location, current);
    const method = (req.method || 'GET').toUpperCase();
    if (
      res.status === 303 ||
      ((res.status === 301 || res.status === 302) && method === 'POST')
    ) {
      req = { ...req, method: 'GET', body: undefined };
    }
    // Same as fetch: credentials meant for one origin don't follow a
    // redirect to another.
    if (next.origin !== new URL(current).origin) {
      const headers = new Headers(req.headers);
      headers.delete('authorization');
      req = { ...req, headers };
    }
    current = next.href;
  }
}
