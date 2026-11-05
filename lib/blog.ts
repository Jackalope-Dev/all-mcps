import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import blogManifest from './blog-manifest.json';
import { keywordTokens } from './blogTitleTokens';
import { BLOG_TOPICS, type BlogTopic, MAX_POST_TOPICS } from './blogTopics';

/**
 * Blog posts are written and published by LopeBase (the content autopilot): it
 * opens a pull request adding `content/blog/<slug>.md` in its "markdown"
 * format, which .github/workflows/lopebase-posts.yml merges once CI passes.
 * This module reads that format; see AGENTS.md → Blog Posts.
 */
const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');
const FILENAME_PATTERN = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;

type BlogFaq = {
  q: string;
  a: string;
};

export type BlogPost = {
  slug: string;
  title: string;
  /** YYYY-MM-DD the post went live. */
  date: string;
  /** YYYY-MM-DD of the last real edit (LopeBase writes `updated`), else `date`. */
  updated: string;
  excerpt: string;
  /** 1-2 of BLOG_TOPICS, main topic first (labels the OG card and filter chips). */
  tags: string[];
  /** LopeBase's free-form tags: meta keywords only, never filter chips. */
  keywords: string[];
  faq: BlogFaq[];
  /**
   * First image LopeBase rendered for the post (it is also placed in the body),
   * used for structured data and social previews only.
   */
  image?: { url: string; alt: string };
  readingTime: number;
  content: string;
};

/** A post file split into front matter and body, before normalization. */
export type RawPostFile = {
  file: string;
  data: Record<string, unknown>;
  content: string;
};

/**
 * Keyword cues for free-form tags that are not BLOG_TOPICS. LopeBase is told
 * to lead with BLOG_TOPICS names; this only catches drift, first match wins.
 */
const TOPIC_CUES: [BlogTopic, RegExp][] = [
  [
    'Security',
    /secur|auth|oauth|permission|secret|credential|injection|sandbox|vulnerab|threat|privacy/,
  ],
  [
    'Deployment',
    /deploy|docker|hosting|kubernetes|serverless|scal|production|observab|logging|monitor|cloudflare|container/,
  ],
  [
    'Building Servers',
    /build|sdk|typescript|python|implement|schema|transport|tool design|develop|testing|debug/,
  ],
  ['Directory & News', /directory|registry|news|allmcps/],
];

function toDay(value: unknown): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime()))
    return value.toISOString().slice(0, 10);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value))
    return value.slice(0, 10);
  return undefined;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string' && v.trim() !== '')
    : [];
}

/** Map front-matter tags onto 1-2 BLOG_TOPICS, keeping the post's order. */
export function postTopics(tags: string[], title: string): BlogTopic[] {
  const topics: BlogTopic[] = [];
  const add = (t: BlogTopic) => {
    if (!topics.includes(t) && topics.length < MAX_POST_TOPICS) topics.push(t);
  };
  for (const tag of tags) {
    const exact = BLOG_TOPICS.find(
      (t) => t.toLowerCase() === tag.trim().toLowerCase(),
    );
    if (exact) add(exact);
  }
  if (topics.length === 0) {
    const haystack = [...tags, title].join(' ').toLowerCase();
    for (const [topic, cue] of TOPIC_CUES) if (cue.test(haystack)) add(topic);
  }
  if (topics.length === 0) add('Using MCP');
  return topics;
}

/**
 * LopeBase keeps the FAQ in the body (## FAQ with ### questions) and also
 * writes it to front matter. The page renders the front-matter copy with
 * FAQPage data, so drop the body section rather than show it twice.
 */
export function stripFaqSection(body: string): string {
  return body
    .replace(
      /^##[ \t]+(?:FAQs?|Frequently asked questions)[ \t]*\n[\s\S]*?(?=^##[ \t]|(?![\s\S]))/im,
      '',
    )
    .trim();
}

function parseFaq(value: unknown): BlogFaq[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (f): f is BlogFaq =>
      typeof f === 'object' &&
      f !== null &&
      typeof (f as BlogFaq).q === 'string' &&
      typeof (f as BlogFaq).a === 'string',
  );
}

export function toBlogPost({ file, data, content }: RawPostFile): BlogPost {
  const match = file.match(FILENAME_PATTERN);
  if (!match) {
    throw new Error(
      `Blog post filename "${file}" must be a kebab-case slug.md`,
    );
  }
  const slug = match[1];
  const date = toDay(data.date);
  const title = typeof data.title === 'string' ? data.title : '';
  const excerpt = typeof data.description === 'string' ? data.description : '';
  if (!title || !excerpt || !date) {
    throw new Error(
      `Blog post "${file}" is missing required front matter (title, description, date)`,
    );
  }

  const rawTags = stringList(data.tags);
  const tags = postTopics(rawTags, title);
  const faq = parseFaq(data.faq);
  const body = faq.length > 0 ? stripFaqSection(content) : content.trim();
  const wordCount = body.split(/\s+/).filter(Boolean).length;
  const imageUrl =
    typeof data.image === 'string' && data.image.startsWith('https://')
      ? data.image
      : undefined;

  return {
    slug,
    title,
    date,
    updated: toDay(data.updated) ?? date,
    excerpt,
    tags,
    keywords: rawTags.filter((t) => !(tags as string[]).includes(t)),
    faq,
    ...(imageUrl
      ? {
          image: {
            url: imageUrl,
            alt: typeof data.image_alt === 'string' ? data.image_alt : '',
          },
        }
      : {}),
    readingTime: Math.max(1, Math.ceil(wordCount / 200)),
    content: body,
  };
}

function readPostFiles(dir = BLOG_DIR): RawPostFile[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((file) => {
      const { data, content } = matter(
        fs.readFileSync(path.join(dir, file), 'utf8'),
      );
      return { file, data, content };
    });
}

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

export function getAllPosts(): BlogPost[] {
  const today = getTodayString();
  const includeFuture = process.env.INCLUDE_FUTURE_POSTS === 'true';

  let files: RawPostFile[] = [];
  try {
    files = readPostFiles();
  } catch {
    // No fs on the Cloudflare Worker: fall back to the prebuild manifest.
  }
  if (files.length === 0) files = blogManifest as RawPostFile[];

  return files
    .map(toBlogPost)
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
