/**
 * Plain-node copy of lib/contentPolicy.ts for scripts/ingest-sources.mjs,
 * which runs under `node` and can't import TypeScript. Keep the two patterns
 * identical; lib/contentPolicy.test.ts runs every case through both.
 */
const ADULT_RE = new RegExp(
  [
    String.raw`\bporn\w*`,
    String.raw`\bnsfw\b`,
    String.raw`\bescort\w*`,
    String.raw`\bn?hentai\b`,
    String.raw`\berotic\w*`,
    String.raw`\bxxx\b`,
    String.raw`\brule34\b`,
    String.raw`\b(onlyfans|fansly|chaturbate|stripchat|livejasmin|bongacams)\b`,
    String.raw`\bnud(e|es|ity)\b`,
    String.raw`\bsex(ting|\s+(chat|cams?|toys?|work|workers?|dolls?))\b`,
    String.raw`\bai\s+(girlfriend|boyfriend)s?\b`,
    String.raw`\b18\+\)?\s+(ai\s+)?(companion|chat|content|video)`,
    String.raw`\buncensored\s+(images?|videos?|engines?|generation)\b`,
    String.raw`\badult\b(?:[\s-]+[\w()+-]+){0,2}?[\s-]+(content|videos?|clips|sites?|websites?|comics?|entertainment|companions?|images?|apps?|cams?|chat|industry|films?|movies?|creators?|toys?)\b`,
  ].join('|'),
  'i',
);

/** True when the listing's own text says it serves adult content. */
export function isAdultContent(...text) {
  return ADULT_RE.test(text.filter(Boolean).join(' \n '));
}
