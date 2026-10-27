import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import blogManifest from './blog-manifest.json';
import { keywordTokens } from './blogPipeline/similarity';

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');
const FILENAME_PATTERN = /^(\d{4}-\d{2}-\d{2})-(.+)\.md$/;

type BlogFaq = {
  q: string;
  a: string;
};

export type BlogPost = {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  tags: string[];
  faq: BlogFaq[];
  readingTime: number;
  content: string;
};

function readPostFile(filename: string): BlogPost {
  const match = filename.match(FILENAME_PATTERN);
  if (!match) {
    throw new Error(
      `Blog post filename "${filename}" must match YYYY-MM-DD-slug.md`,
    );
  }
  const [, date, slug] = match;

  const raw = fs.readFileSync(path.join(BLOG_DIR, filename), 'utf8');
  const { data, content } = matter(raw);

  if (!data.title || !data.excerpt) {
    throw new Error(
      `Blog post "${filename}" is missing required frontmatter (title, excerpt)`,
    );
  }

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

  return {
    slug,
    title: data.title as string,
    date,
    excerpt: data.excerpt as string,
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
    faq: Array.isArray(data.faq) ? (data.faq as BlogFaq[]) : [],
    readingTime: Math.max(1, Math.ceil(wordCount / 200)),
    content: content.trim(),
  };
}

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

export function getAllPosts(): BlogPost[] {
  const today = getTodayString();
  const includeFuture = process.env.INCLUDE_FUTURE_POSTS === 'true';

  let rawPosts: BlogPost[] = [];

  try {
    if (fs.existsSync(BLOG_DIR)) {
      const filenames = fs
        .readdirSync(BLOG_DIR)
        .filter((f) => f.endsWith('.md'));
      if (filenames.length > 0) {
        rawPosts = filenames.map(readPostFile);
      }
    }
  } catch {
    // If fs fails (e.g. in Cloudflare Worker environment), fall back to static blogManifest
  }

  if (rawPosts.length === 0) {
    rawPosts = blogManifest as BlogPost[];
  }

  return rawPosts
    .filter((post) => includeFuture || post.date <= today)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return getAllPosts().find((post) => post.slug === slug);
}

/**
 * Topics worth a filter chip on /blog (see BLOG_TOPICS), most-used first. A
 * topic on a single post just restates one title, so it waits for a second.
 */
export function getFilterTags(): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const post of getAllPosts()) {
    for (const tag of post.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return Array.from(counts, ([tag, count]) => ({ tag, count }))
    .filter(({ count }) => count >= 2)
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/**
 * Posts most related to `post`, for the "Related articles" block: shared
 * topics plus overlap of title intent tokens (same tokenizer the blog
 * pipeline uses for cannibalization checks), newest first on ties. Gives every
 * post — including older ones — inbound links from its topical neighbours.
 */
export function getRelatedPosts(post: BlogPost, limit = 3): BlogPost[] {
  const titleTokens = keywordTokens(post.title);
  const tags = new Set(post.tags);
  return getAllPosts()
    .filter((p) => p.slug !== post.slug)
    .map((p) => {
      let score = 0;
      for (const t of p.tags) if (tags.has(t)) score += 2;
      for (const t of keywordTokens(p.title))
        if (titleTokens.has(t)) score += 1;
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || (a.p.date < b.p.date ? 1 : -1))
    .slice(0, limit)
    .map((x) => x.p);
}
