function isPrivateOrReservedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();

  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    return true;
  }

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 127) return true; // loopback
    if (a === 10) return true; // private
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 169 && b === 254) return true; // link-local
    if (a === 0) return true; // "this" network
    return false;
  }

  const v6 = host.replace(/^\[|\]$/g, '');
  if (v6 === '::1' || v6 === '::') return true; // loopback / unspecified
  if (v6.startsWith('fe80:')) return true; // link-local
  if (/^f[cd][0-9a-f]{2}:/i.test(v6)) return true; // unique local fc00::/7

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

