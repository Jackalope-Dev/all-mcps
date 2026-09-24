/**
 * Pull finished drafts from the blog pipeline (lib/blogPipeline) into
 * content/blog as regular posts, then mark them exported.
 *
 * The pipeline has already deduped the topic, written the post, validated it
 * and passed it through an editorial review loop — this is the human step:
 * read the diff, fix anything off, commit, and deploy (`npm run build` first).
 *
 * Usage:
 *   ALLMCPS_ADMIN_SECRET=xxx node scripts/pull-blog-drafts.mjs            # export all ready drafts dated today
 *   ... node scripts/pull-blog-drafts.mjs --dry-run                       # list ready + needs_human, write nothing
 *   ... node scripts/pull-blog-drafts.mjs --limit 2                       # export the oldest 2
 *   ... node scripts/pull-blog-drafts.mjs --date 2026-10-01               # set the post date (future dates stay hidden until a build on/after it)
 *   ... node scripts/pull-blog-drafts.mjs --reject <id>                   # discard a draft
 *   ... node scripts/pull-blog-drafts.mjs --retry <id>                    # send a needs_human draft back through review
 *
 * Env: ALLMCPS_BASE_URL (default https://allmcps.com), ALLMCPS_ADMIN_SECRET or CRON_SECRET.
 */

import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = process.env.ALLMCPS_BASE_URL || 'https://allmcps.com';
const SECRET =
  process.env.ALLMCPS_ADMIN_SECRET ||
  process.env.CRON_SECRET ||
  process.env.ADMIN_SECRET;
const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

if (!SECRET) {
  console.error(
    'Missing ALLMCPS_ADMIN_SECRET (or CRON_SECRET) environment variable.',
  );
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${SECRET}`,
  'Content-Type': 'application/json',
};

async function api(method, query = '', body) {
  const res = await fetch(`${BASE_URL}/api/cron/blog-drafts${query}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(
      `${method} blog-drafts → ${res.status}: ${await res.text()}`,
    );
  }
  return res.json();
}

/** JSON strings are valid YAML double-quoted scalars, so this is safe for any text. */
const q = (s) => JSON.stringify(String(s));

function toMarkdown(d) {
  const lines = [
    '---',
    `title: ${q(d.title)}`,
    `excerpt: ${q(d.excerpt)}`,
    `tags: [${d.tags.map(q).join(', ')}]`,
  ];
  if (d.faq.length > 0) {
    lines.push('faq:');
    for (const f of d.faq) {
      lines.push(`  - q: ${q(f.q)}`, `    a: ${q(f.a)}`);
    }
  }
  lines.push('---', '', d.content.trim(), '');
  return lines.join('\n');
}

function summarize(d) {
  const r = d.review || {};
  const s = r.review?.scores;
  const scores = s
    ? Object.entries(s)
        .map(([k, v]) => `${k} ${v}`)
        .join(', ')
    : 'n/a';
  const sim = r.similarity
    ? `closest ${r.similarity.maxCosineUrl} (${r.similarity.maxCosine}), shingle ${r.similarity.shingle}`
    : 'n/a';
  return [
    `  ${d.id}  [${d.status}]  /blog/${d.slug}`,
    `    "${d.title}"`,
    `    keyword: ${d.primaryKeyword} · passes: ${d.iterations} · scores: ${scores}`,
    `    similarity: ${sim}`,
    ...(d.status !== 'ready' && r.issues?.length
      ? [`    open issues:\n${r.issues.map((i) => `      - ${i}`).join('\n')}`]
      : []),
  ].join('\n');
}

async function main() {
  const rejectId = value('--reject');
  if (rejectId) {
    await api('POST', '', { id: rejectId, status: 'rejected' });
    console.log(`Rejected ${rejectId}`);
    return;
  }
  const retryId = value('--retry');
  if (retryId) {
    await api('POST', '', { id: retryId, status: 'review' });
    console.log(`Sent ${retryId} back for review`);
    return;
  }

  const { drafts } = await api('GET', '?status=ready,needs_human');
  const ready = drafts.filter((d) => d.status === 'ready');
  const needsHuman = drafts.filter((d) => d.status === 'needs_human');

  if (needsHuman.length > 0) {
    console.log(
      `\n${needsHuman.length} draft(s) need a human (failed the review loop):`,
    );
    for (const d of needsHuman) console.log(summarize(d));
    console.log('  → --retry <id> to re-run the loop, or --reject <id>.');
  }

  if (ready.length === 0) {
    console.log('\nNo ready drafts.');
    return;
  }

  const limit = Number(value('--limit')) || ready.length;
  const date = value('--date') || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    console.error(`--date must be YYYY-MM-DD, got ${date}`);
    process.exit(1);
  }
  const existingSlugs = new Set(
    fs
      .readdirSync(BLOG_DIR)
      .map((f) => f.match(/^\d{4}-\d{2}-\d{2}-(.+)\.md$/)?.[1])
      .filter(Boolean),
  );

  console.log(`\n${ready.length} ready draft(s):`);
  for (const d of ready.slice(0, limit)) {
    console.log(summarize(d));
    if (flag('--dry-run')) continue;
    if (existingSlugs.has(d.slug)) {
      console.log(
        `    ! skipped: content/blog already has a post with slug ${d.slug}`,
      );
      continue;
    }
    const file = path.join(BLOG_DIR, `${date}-${d.slug}.md`);
    fs.writeFileSync(file, toMarkdown(d), 'utf8');
    await api('POST', '', { id: d.id, status: 'exported' });
    console.log(`    ✓ wrote ${path.relative(process.cwd(), file)}`);
    if (d.backlinkSuggestions?.length) {
      console.log('    Add a link to the new post from these related pages:');
      for (const b of d.backlinkSuggestions) {
        console.log(
          `      - ${b.url} ("${b.title}") → anchor e.g. "${b.anchor}"`,
        );
      }
    }
  }

  if (!flag('--dry-run')) {
    console.log(
      '\nNext: read the new files, then `npm run build` and commit. The pipeline\n' +
        'picks up published posts from the manifest automatically after deploy.',
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
