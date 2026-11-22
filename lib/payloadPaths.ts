/**
 * Googlebot reads "/..." strings in a page's RSC payload as URLs to crawl, so
 * install snippets and README text that a Server Component hands to a Client
 * Component (`/path/to/venv/bin/python3`, `/Users/YOUR_USERNAME/...`, `/etc`)
 * came back as hundreds of 404s on allmcps.com in Search Console.
 *
 * `maskPaths` escapes every slash in the strings of a prop value before it
 * crosses the client boundary, and `unmaskPaths` restores them exactly in the
 * Client Component before anything renders or is copied, so visitors and the
 * clipboard see the original text. The escape is reversible for any input:
 * `~` becomes `~~` and `/` becomes `~s`.
 */
export function maskPaths<T>(value: T): T {
  return mapStrings(value, (s) =>
    s.includes('/') || s.includes('~')
      ? s.replace(/~/g, '~~').replace(/\//g, '~s')
      : s,
  );
}

export function unmaskPaths<T>(value: T): T {
  return mapStrings(value, (s) =>
    s.includes('~')
      ? s.replace(/~([~s])/g, (_m, c: string) => (c === '~' ? '~' : '/'))
      : s,
  );
}

function mapStrings<T>(value: T, fn: (s: string) => string): T {
  if (typeof value === 'string') return fn(value) as T;
  if (Array.isArray(value)) {
    return value.map((v) => mapStrings(v, fn)) as T;
  }
  if (value && typeof value === 'object' && isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = mapStrings(v, fn);
    return out as T;
  }
  return value;
}

function isPlainObject(value: object): boolean {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
