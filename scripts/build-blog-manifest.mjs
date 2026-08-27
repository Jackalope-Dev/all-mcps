import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');
const OUTPUT_FILE = path.join(process.cwd(), 'lib', 'blog-manifest.json');
const FILENAME_PATTERN = /^(\d{4}-\d{2}-\d{2})-(.+)\.md$/;

function readPostFile(filename) {
  const match = filename.match(FILENAME_PATTERN);
  if (!match) return null;
  const [, date, slug] = match;

  const raw = fs.readFileSync(path.join(BLOG_DIR, filename), 'utf8');
  const { data, content } = matter(raw);

  if (!data.title || !data.excerpt) return null;

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

  return {
    slug,
    title: data.title,
    date,
    excerpt: data.excerpt,
    tags: Array.isArray(data.tags) ? data.tags : [],
    faq: Array.isArray(data.faq) ? data.faq : [],
    readingTime: Math.max(1, Math.ceil(wordCount / 200)),
    content: content.trim(),
  };
}

function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

function buildManifest() {
  if (!fs.existsSync(BLOG_DIR)) {
    fs.writeFileSync(OUTPUT_FILE, '[]\n', 'utf8');
    console.log(
      `BLOG_DIR does not exist. Created empty manifest at ${OUTPUT_FILE}`,
    );
    return;
  }

  const today = getTodayString();
  const includeFuture = process.env.INCLUDE_FUTURE_POSTS === 'true';

  const filenames = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.md'));
  const posts = filenames
    .map(readPostFile)
    .filter(Boolean)
    .filter((post) => includeFuture || post.date <= today)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(posts, null, 2)}\n`, 'utf8');
  console.log(
    `Generated blog manifest with ${posts.length} post(s) (filtered for date <= ${today}) -> ${OUTPUT_FILE}`,
  );
}

buildManifest();
