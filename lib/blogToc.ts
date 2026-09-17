export type TocEntry = {
  text: string;
  slug: string;
};

const HEADING_LINE = /^##\s+(.+)$/;
const FENCE_LINE = /^\s*(```|~~~)/;
const USER_CONTENT_PREFIX = 'user-content-';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Line-by-line fence tracker so a `## ` line inside a fenced code block (e.g. a
 * shell/config sample) is never mistaken for a heading — `##` is a common shell
 * comment marker, and this is an MCP directory blog where config snippets are
 * the obvious content.
 */
function makeFenceTracker() {
  let inFence = false;
  let marker = '';
  return (line: string): boolean => {
    const wasInFence = inFence;
    const match = line.match(FENCE_LINE);
    if (match) {
      if (!inFence) {
        inFence = true;
        marker = match[1];
      } else if (line.trim().startsWith(marker)) {
        inFence = false;
      }
    }
    return wasInFence;
  };
}

export function extractToc(content: string): TocEntry[] {
  const entries: TocEntry[] = [];
  const seen = new Map<string, number>();
  const isFenced = makeFenceTracker();

  for (const line of content.split('\n')) {
    const inFence = isFenced(line);
    if (inFence) continue;
    const match = line.match(HEADING_LINE);
    if (!match) continue;

    const text = match[1].trim();
    let slug = slugify(text);
    const count = seen.get(slug) || 0;
    seen.set(slug, count + 1);
    if (count > 0) slug = `${slug}-${count}`;
    entries.push({ text, slug });
  }

  return entries;
}

/**
 * Rewrites `## Heading` lines outside fenced code blocks into raw `<h2 id="...">`
 * HTML for anchor linking. Reuses extractToc's output as the single source of
 * truth for slugs, so the two functions can never disagree on what a given
 * heading's anchor is.
 */
export function withHeadingAnchors(content: string): string {
  const toc = extractToc(content);
  let tocIndex = 0;
  const isFenced = makeFenceTracker();

  const lines = content.split('\n').map((line) => {
    const inFence = isFenced(line);
    if (inFence) return line;
    const match = line.match(HEADING_LINE);
    if (!match) return line;

    const entry = toc[tocIndex++];
    return `<h2 id="${entry.slug}">${escapeHtml(entry.text)}</h2>`;
  });

  return lines.join('\n');
}

export function tocHref(slug: string): string {
  return `#${USER_CONTENT_PREFIX}${slug}`;
}
