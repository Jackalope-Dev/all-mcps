# Wordmark Legibility Fix: "AllMCPs"

## Problem

The "AllMCPs" wordmark is ambiguous at a glance — the double `l` in "All" reads as "A11MCPs" or "AIIMCPs" depending on font rendering. This happens at both places the wordmark is rendered as styled text: the navbar logo and the footer heading (`app/layout.tsx`).

`<title>`, meta tags, and JSON-LD occurrences are plain text and cannot be styled — out of scope.

## Approach

Split the rendered text into two spans, `All` and `MCPs`, and give `All` the brand's existing accent gradient (the same gradient-clipped-text technique already used for "superpowers" in the homepage hero, `app/page.tsx:50`). `MCPs` stays plain/inherited color. No font swap, no letter-spacing change.

Isolating "All" as its own colored block lets the eye parse it as a distinct chunk before parsing individual glyphs, which resolves the ambiguity without touching global typography or the brand guide.

Rejected alternatives:
- **Font swap (e.g. Geist):** bigger visual change across the whole site's type for a problem localized to one word.
- **Loosen letter-spacing:** a smaller, purely typographic fix, but color-splitting was preferred as it also reinforces "All" + "MCPs" as two readable chunks (word + acronym), not just an anti-collision fix.

## Changes

`app/layout.tsx`:
- Navbar logo (`~line 100-103`): replace the plain `AllMCPs` text with `<span style={{ background: 'linear-gradient(135deg, var(--accent-color), #007BFF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>All</span>MCPs`.
- Footer `<h3>` (`~line 117`): same span split.

`.logo` and the footer `h3` CSS rules in `app/globals.css` are unchanged — only the text markup changes, not weight/spacing/size.

The `aria-label="Go to AllMCPs Homepage"` on the navbar `Link` is unchanged; span-splitting the visible text doesn't affect it.

## Testing

Visual check only — load `/` and confirm:
- Navbar logo reads clearly as "All" (colored) + "MCPs" (white).
- Footer heading matches.
- No layout shift/wrapping regression at typical viewport widths.
