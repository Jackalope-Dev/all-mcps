/**
 * Acquisition attribution: where a visitor came from (referrer host, UTM tags,
 * landing page), kept in the first-party `allmcps_src` cookie and copied onto
 * conversions (submissions, paid upgrades, paid ads) so the admin Acquisition
 * tab can show which channels actually bring paying customers.
 *
 * The cookie is written client-side only once analytics consent is granted
 * (components/CookieBanner.tsx → lib/attributionClient.ts), and read
 * server-side by the submit / checkout routes. Everything here is pure so the
 * same parsing runs in the browser, the Worker, and tests.
 */

export const ATTRIBUTION_COOKIE = 'allmcps_src';
export const ATTRIBUTION_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

export type Attribution = {
  /** Referrer hostname without `www.`, or null for direct / own-site. */
  ref: string | null;
  src: string | null;
  med: string | null;
  cmp: string | null;
  /** Landing pathname (no query string). */
  land: string | null;
  /** Epoch ms of the attributed visit. */
  ts: number;
};

const CHANNELS = [
  'paid',
  'search',
  'ai',
  'social',
  'github',
  'directory',
  'email',
  'referral',
  'direct',
  'unknown',
] as const;
export type Channel = (typeof CHANNELS)[number];

export const HEARD_FROM_OPTIONS = [
  { value: 'search', label: 'Google / Bing search' },
  { value: 'ai', label: 'ChatGPT, Claude or another AI assistant' },
  { value: 'github', label: 'GitHub' },
  { value: 'reddit', label: 'Reddit' },
  { value: 'x', label: 'X / Twitter' },
  { value: 'hacker_news', label: 'Hacker News' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'directory', label: 'Another MCP directory' },
  { value: 'newsletter', label: 'Newsletter or email' },
  { value: 'outreach', label: 'AllMCPs reached out to me' },
  { value: 'friend', label: 'A friend or colleague' },
  { value: 'other', label: 'Somewhere else' },
] as const;
export type HeardFrom = (typeof HEARD_FROM_OPTIONS)[number]['value'];

const HEARD_FROM_VALUES = new Set<string>(
  HEARD_FROM_OPTIONS.map((o) => o.value),
);

export function normalizeHeardFrom(value: unknown): HeardFrom | null {
  return typeof value === 'string' && HEARD_FROM_VALUES.has(value)
    ? (value as HeardFrom)
    : null;
}

/** Our own hosts: a referrer from these is internal navigation, not a source. */
const OWN_HOST = /(^|\.)allmcps\.com$|^localhost$|^127\.0\.0\.1$/;

/**
 * Hosts that show up as the referrer only because the visitor bounced through
 * a payment or sign-in step — never how they found us.
 */
const PASS_THROUGH_HOSTS = new Set([
  'checkout.stripe.com',
  'billing.stripe.com',
  'accounts.google.com',
]);

const AI_HOSTS = [
  'chatgpt.com',
  'chat.openai.com',
  'openai.com',
  'claude.ai',
  'perplexity.ai',
  'gemini.google.com',
  'copilot.microsoft.com',
  'chat.deepseek.com',
  'grok.com',
  'meta.ai',
  'you.com',
  'phind.com',
  'poe.com',
  'chat.mistral.ai',
];
const SEARCH_HOSTS = [
  'google',
  'bing.com',
  'duckduckgo.com',
  'search.yahoo.com',
  'yahoo.com',
  'yandex',
  'baidu.com',
  'ecosia.org',
  'search.brave.com',
  'kagi.com',
  'startpage.com',
  'naver.com',
  'qwant.com',
];
const SOCIAL_HOSTS = [
  'x.com',
  'twitter.com',
  't.co',
  'reddit.com',
  'linkedin.com',
  'lnkd.in',
  'facebook.com',
  'm.facebook.com',
  'l.facebook.com',
  'news.ycombinator.com',
  'youtube.com',
  'instagram.com',
  'threads.net',
  'bsky.app',
  'discord.com',
  'producthunt.com',
];
const DIRECTORY_HOSTS = [
  'smithery.ai',
  'glama.ai',
  'mcp.so',
  'pulsemcp.com',
  'mcpservers.org',
  'mcpmarket.com',
  'mcp.directory',
  'cursor.directory',
];
const EMAIL_HOSTS = [
  'mail.google.com',
  'outlook.live.com',
  'outlook.office.com',
  'outlook.office365.com',
  'mail.yahoo.com',
  'titan.email',
];
const PAID_MEDIUMS = new Set([
  'cpc',
  'ppc',
  'paid',
  'paidsearch',
  'paid_search',
  'paid-social',
  'paid_social',
  'paidsocial',
  'display',
  'cpm',
  'ads',
  'ad',
  'sponsored',
]);
const EMAIL_MEDIUMS = new Set(['email', 'e-mail', 'newsletter']);

/** Exact host or any subdomain; bare labels (e.g. `google`) match any TLD. */
function hostMatches(host: string, list: string[]): boolean {
  return list.some((entry) => {
    if (!entry.includes('.')) {
      return new RegExp(`(^|\\.)${entry}\\.[a-z.]+$`).test(host);
    }
    return host === entry || host.endsWith(`.${entry}`);
  });
}

function clean(value: string | null | undefined, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

/** Lowercased hostname without `www.`, or null if unparseable. */
function normalizeHost(urlOrHost: string | null | undefined) {
  if (!urlOrHost) return null;
  let host = urlOrHost.trim().toLowerCase();
  try {
    if (host.includes('://')) host = new URL(host).hostname;
  } catch {
    return null;
  }
  host = host.replace(/^www\./, '').replace(/\.$/, '');
  return /^[a-z0-9.-]+$/.test(host) ? host.slice(0, 120) : null;
}

/** Paths whose page loads are never a meaningful landing (internal tooling). */
const SKIP_LANDING = /^\/(admin|api)(\/|$)/;

/**
 * The touch represented by this page load. Null when the page shouldn't count
 * (admin/API) or the URL is unparseable.
 */
export function captureTouch(input: {
  href: string;
  referrer: string;
  now: number;
}): Attribution | null {
  let url: URL;
  try {
    url = new URL(input.href);
  } catch {
    return null;
  }
  if (SKIP_LANDING.test(url.pathname)) return null;

  const params = url.searchParams;
  let src = clean(params.get('utm_source'), 100);
  let med = clean(params.get('utm_medium'), 100);
  const cmp = clean(params.get('utm_campaign'), 100);
  // Ad click ids without UTM tags (auto-tagging) still mean a paid click.
  if (!src && params.get('gclid')) {
    src = 'google';
    med = med ?? 'cpc';
  } else if (!src && params.get('msclkid')) {
    src = 'bing';
    med = med ?? 'cpc';
  }

  let ref = normalizeHost(input.referrer);
  if (ref && (OWN_HOST.test(ref) || PASS_THROUGH_HOSTS.has(ref))) ref = null;

  return {
    ref,
    src,
    med,
    cmp,
    land: url.pathname.slice(0, 200) || '/',
    ts: input.now,
  };
}

export function isDirect(a: Attribution): boolean {
  return !a.ref && !a.src && !a.med && !a.cmp;
}

/**
 * First non-direct touch wins: a stored touch is kept unless it was a plain
 * direct visit and this one actually came from somewhere.
 */
export function shouldReplaceTouch(
  existing: Attribution | null,
  next: Attribution,
): boolean {
  if (!existing) return true;
  return isDirect(existing) && !isDirect(next);
}

export function classifyChannel(a: Attribution | null): Channel {
  if (!a) return 'unknown';
  const med = a.med?.toLowerCase() ?? '';
  if (PAID_MEDIUMS.has(med)) return 'paid';
  if (EMAIL_MEDIUMS.has(med)) return 'email';

  // ChatGPT and others tag outbound links with utm_source=<their host>, so
  // the source is checked with the same host lists as the referrer.
  const candidates = [a.ref, normalizeHost(a.src)].filter(
    (h): h is string => !!h,
  );
  for (const host of candidates) {
    // AI and webmail before search: gemini.google.com and mail.google.com
    // would otherwise match the bare `google` search entry.
    if (hostMatches(host, AI_HOSTS)) return 'ai';
    if (hostMatches(host, EMAIL_HOSTS)) return 'email';
    if (hostMatches(host, SEARCH_HOSTS)) return 'search';
    if (host === 'github.com' || host.endsWith('.github.com')) return 'github';
    if (hostMatches(host, DIRECTORY_HOSTS)) return 'directory';
    if (hostMatches(host, SOCIAL_HOSTS)) return 'social';
  }
  if (a.ref || a.src || a.cmp) return 'referral';
  return 'direct';
}

export function serializeAttribution(a: Attribution): string {
  return encodeURIComponent(
    JSON.stringify({
      v: 1,
      r: a.ref,
      s: a.src,
      m: a.med,
      c: a.cmp,
      l: a.land,
      t: a.ts,
    }),
  );
}

/** Parses a cookie value; anything malformed or tampered becomes null. */
export function parseAttribution(raw: string | null | undefined) {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(decodeURIComponent(raw));
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (d.v !== 1 || typeof d.t !== 'number' || !Number.isFinite(d.t)) {
    return null;
  }
  const str = (v: unknown, max: number) =>
    typeof v === 'string' ? clean(v, max) : null;
  const attribution: Attribution = {
    ref: typeof d.r === 'string' ? normalizeHost(d.r) : null,
    src: str(d.s, 100),
    med: str(d.m, 100),
    cmp: str(d.c, 100),
    land: str(d.l, 200),
    ts: d.t,
  };
  return attribution;
}

/** Reads the attribution cookie from a raw `Cookie` header. */
export function readAttributionCookie(cookieHeader: string | null) {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === ATTRIBUTION_COOKIE) {
      return parseAttribution(part.slice(eq + 1).trim());
    }
  }
  return null;
}

export function attributionFromRequest(req: Request) {
  return readAttributionCookie(req.headers.get('cookie'));
}

/** Stripe metadata entries (≤500 chars each) carrying attribution through checkout. */
export function attributionToStripeMetadata(
  a: Attribution | null,
): Record<string, string> {
  if (!a) return {};
  const meta: Record<string, string> = { attr_ts: String(a.ts) };
  if (a.ref) meta.attr_ref = a.ref;
  if (a.src) meta.attr_src = a.src;
  if (a.med) meta.attr_med = a.med;
  if (a.cmp) meta.attr_cmp = a.cmp;
  if (a.land) meta.attr_land = a.land;
  return meta;
}

export function attributionFromStripeMetadata(
  meta: Record<string, string> | null | undefined,
): Attribution | null {
  const ts = Number(meta?.attr_ts);
  if (!meta || !Number.isFinite(ts) || ts <= 0) return null;
  return {
    ref: normalizeHost(meta.attr_ref),
    src: clean(meta.attr_src, 100),
    med: clean(meta.attr_med, 100),
    cmp: clean(meta.attr_cmp, 100),
    land: clean(meta.attr_land, 200),
    ts,
  };
}
