/** UTM values stamped on outbound links rendered from third-party READMEs. */
export const ALLMCPS_UTM = {
  source: 'allmcps',
  medium: 'directory',
  campaign: 'listing-readme',
} as const;

/**
 * Whether a href should be treated as an external navigable URL
 * (vs in-page anchor, mailto, etc.).
 */
export function isOutboundHttpUrl(href: string | undefined | null): boolean {
  if (!href) return false;
  const trimmed = href.trim();
  if (
    !trimmed ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('tel:')
  ) {
    return false;
  }
  // Protocol-relative //example.com
  if (trimmed.startsWith('//')) return true;
  if (/^https?:\/\//i.test(trimmed)) return true;
  return false;
}

/**
 * Attach AllMCPs UTM params to an absolute http(s) URL.
 * Leaves anchors, mailto, and relative paths unchanged.
 * Always sets our utm_* keys so referral traffic is attributable to us.
 */
export function withAllMcpsUtm(
  href: string,
  options?: { content?: string; campaign?: string },
): string {
  const trimmed = href.trim();
  if (!isOutboundHttpUrl(trimmed)) return href;

  try {
    const absolute = trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;
    const url = new URL(absolute);

    url.searchParams.set('utm_source', ALLMCPS_UTM.source);
    url.searchParams.set('utm_medium', ALLMCPS_UTM.medium);
    url.searchParams.set(
      'utm_campaign',
      options?.campaign || ALLMCPS_UTM.campaign,
    );

    if (options?.content) {
      url.searchParams.set('utm_content', options.content);
    }

    return url.toString();
  } catch {
    return href;
  }
}
