/**
 * Catalog content policy: categories AllMCPs does not list regardless of how
 * well the server works (see /terms § Submitting a Listing).
 *
 * Adult content was removed from the catalog on 2026-10-31: porn and adult
 * video search, escort and cam directories, NSFW image/video generation and
 * 18+ AI companions. This text check keeps new ones from being auto-imported
 * and from being auto-approved; a human still makes the final call on
 * submissions, so it errs toward catching too much rather than too little.
 *
 * Deliberately not matched: "adult education", sex-offender registries,
 * age-gated retail ("Kauf 18+"), "uncensored LLM" catalogs, and fictional
 * "adult human" characters — all legitimate listings today.
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
    // "adult" a word or two before what makes it adult content, so "adult
    // short-form video" matches and "adult education" doesn't.
    String.raw`\badult\b(?:[\s-]+[\w()+-]+){0,2}?[\s-]+(content|videos?|clips|sites?|websites?|comics?|entertainment|companions?|images?|apps?|cams?|chat|industry|films?|movies?|creators?|toys?)\b`,
  ].join('|'),
  'i',
);

/** True when the listing's own text says it serves adult content. */
export function isAdultContent(
  ...text: (string | null | undefined)[]
): boolean {
  return ADULT_RE.test(text.filter(Boolean).join(' \n '));
}
