/**
 * Listings are ingested from scraped READMEs, so their descriptions almost always
 * open with noise that is meaningless on AllMCPs: an empty badge link
 * (`[](https://glama.ai/…)` or an `![](img)` shield), a run of platform-indicator
 * emoji (📇 ☁️ 🏠 🍎 🪟 🐧 …), and a leading separator dash. These leak into cards,
 * `<meta>` descriptions, OpenGraph tags, and the RSS/LLM feeds.
 *
 * `cleanListingDescription` peels that leading chrome off while preserving the rest
 * of the description verbatim (including any legitimate inline markdown), so the same
 * value is safe to render through `SafeMarkdown` or slice into a plain-text snippet.
 *
 * The badge/emoji/dash prefix can appear in any order, so the strips run in a short
 * loop until the front of the string stabilizes on the real sentence. If stripping
 * would empty the description entirely, the original (trimmed) text is returned so a
 * listing never loses its only copy.
 */
export function cleanListingDescription(description: string | null | undefined): string {
  if (!description) return '';
  let text = description;
  for (let i = 0; i < 5; i++) {
    const before = text;
    text = text
      // Leading badge links: empty-text `[](url)` or image `![alt](img)`.
      .replace(/^(?:\s*(?:!\[[^\]]*\]\([^)]*\)|\[\s*\]\([^)]*\))\s*)+/g, '')
      // Leading platform-indicator emoji run (incl. variation selectors, ZWJ, skin tones).
      .replace(/^[\p{Extended_Pictographic}️‍\u{1F3FB}-\u{1F3FF}\s]+/u, '')
      // Leading separator left behind once badges/emoji are gone.
      .replace(/^[-–—:|·•]+\s+/, '');
    if (text === before) break;
  }
  text = text.trim();
  return text.length > 0 ? text : description.trim();
}
