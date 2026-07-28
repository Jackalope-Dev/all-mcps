export type TocEntry = {
  text: string;
  slug: string;
};

const HEADING_PATTERN = /^##\s+(.+)$/gm;
const USER_CONTENT_PREFIX = 'user-content-';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function extractToc(content: string): TocEntry[] {
  const entries: TocEntry[] = [];
  const seen = new Map<string, number>();
  for (const match of content.matchAll(HEADING_PATTERN)) {
    const text = match[1].trim();
    let slug = slugify(text);
    const count = seen.get(slug) || 0;
    seen.set(slug, count + 1);
    if (count > 0) slug = `${slug}-${count}`;
    entries.push({ text, slug });
  }
  return entries;
}

export function withHeadingAnchors(content: string): string {
  const seen = new Map<string, number>();
  return content.replace(HEADING_PATTERN, (_full, rawText: string) => {
    const text = rawText.trim();
    let slug = slugify(text);
    const count = seen.get(slug) || 0;
    seen.set(slug, count + 1);
    if (count > 0) slug = `${slug}-${count}`;
    return `<h2 id="${slug}">${text}</h2>`;
  });
}

export function tocHref(slug: string): string {
  return `#${USER_CONTENT_PREFIX}${slug}`;
}
