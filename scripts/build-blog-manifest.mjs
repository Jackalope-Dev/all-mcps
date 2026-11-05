import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

/**
 * Snapshot content/blog for the Cloudflare Worker, which has no filesystem.
 * Stores each file's raw front matter and body; lib/blog.ts (toBlogPost)
 * normalizes both this and the on-disk files the same way, and filters
 * future-dated posts at read time.
 */
const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');
const OUTPUT_FILE = path.join(process.cwd(), 'lib', 'blog-manifest.json');

const files = fs.existsSync(BLOG_DIR)
  ? fs
      .readdirSync(BLOG_DIR)
      .filter((f) => f.endsWith('.md'))
      .sort()
      .map((file) => {
        const { data, content } = matter(
          fs.readFileSync(path.join(BLOG_DIR, file), 'utf8'),
        );
        return { file, data, content };
      })
  : [];

fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(files, null, 2)}\n`, 'utf8');
console.log(
  `Generated blog manifest with ${files.length} post(s) -> ${OUTPUT_FILE}`,
);
