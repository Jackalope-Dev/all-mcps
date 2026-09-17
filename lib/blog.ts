import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import blogManifest from './blog-manifest.json';

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');
const FILENAME_PATTERN = /^(\d{4}-\d{2}-\d{2})-(.+)\.md$/;

export type BlogFaq = {
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

export function getAllTags(): string[] {
  const tags = new Set<string>();
  for (const post of getAllPosts()) {
    for (const tag of post.tags) tags.add(tag);
  }
  return Array.from(tags).sort();
}
