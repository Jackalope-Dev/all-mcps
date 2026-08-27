/**
 * Helpers for Open Graph image generation.
 */

/**
 * Clean markdown formatting and excess whitespace from strings.
 */
export function cleanText(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .replace(/<[^>]*>/g, '') // remove HTML tags
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // replace markdown links with label
    .replace(/[*_`~#]/g, '') // strip markdown syntax
    .replace(/₿/g, 'BTC') // replace Bitcoin symbol (U+20BF) to avoid Satori font fetch
    .replace(/[\u20A0-\u20CF]/g, '') // strip rare currency symbols that trigger loadGoogleFont
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '') // strip unsupported pictographs
    .replace(/\s+/g, ' ') // collapse whitespace
    .trim();
}

/**
 * Safely truncate titles to prevent overflow on fixed 1200x630 canvas.
 */
export function truncateTitle(
  title: string | null | undefined,
  maxLength: number = 75,
): string {
  const cleaned = cleanText(title);
  if (!cleaned) return 'Model Context Protocol Server';
  if (cleaned.length <= maxLength) return cleaned;

  const truncated = cleaned.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > 45) {
    return `${truncated.slice(0, lastSpace)}…`;
  }
  return `${truncated}…`;
}

/**
 * Safely truncate descriptions to fit within 2-3 lines of text
 * without overflowing the OG image layout.
 */
export function truncateDescription(
  desc: string | null | undefined,
  maxLength: number = 150,
): string {
  const cleaned = cleanText(desc);
  if (!cleaned)
    return 'Discover, filter, and install Model Context Protocol (MCP) servers to give your AI agents superpowers.';
  if (cleaned.length <= maxLength) return cleaned;

  const truncated = cleaned.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > 100) {
    return `${truncated.slice(0, lastSpace)}…`;
  }
  return `${truncated}…`;
}
