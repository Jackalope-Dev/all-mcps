/**
 * Publish a pipeline draft straight from the admin dashboard.
 *
 * Posts are statically built from content/blog, and a push to main triggers
 * the Cloudflare Workers Build deploy — so "publish" is just committing the
 * markdown file to the repo through the GitHub contents API. This replaces the
 * `scripts/pull-blog-drafts.mjs` + manual commit step for the common case; the
 * human review still happens, it just happens in /admin.
 *
 * Needs a Worker secret `BLOG_PUBLISH_TOKEN`: a fine-grained PAT scoped to the
 * one repo with Contents: read & write. Deliberately separate from
 * GITHUB_TOKEN, which the crons use read-only for rate limits.
 */

import { githubApiHeaders } from '../githubAuth';

export const DEFAULT_BLOG_REPO = 'Jackalope-Dev/all-mcps';
export const DEFAULT_BLOG_BRANCH = 'main';

export type PublishableDraft = {
  title: string;
  slug: string;
  excerpt: string;
  tags: string[];
  faq: { q: string; a: string }[];
  content: string;
};

export type BlogPublishConfig = {
  token: string;
  repo: string;
  branch: string;
};

/** Reads publish config from the Worker env (or process.env in dev). */
export function getBlogPublishConfig(env?: unknown): BlogPublishConfig | null {
  const e = (env && typeof env === 'object' ? env : {}) as Record<
    string,
    unknown
  >;
  const read = (key: string) => {
    const v =
      e[key] ?? (typeof process !== 'undefined' ? process.env[key] : undefined);
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
  };
  const token = read('BLOG_PUBLISH_TOKEN');
  if (!token) return null;
  return {
    token,
    repo: read('BLOG_PUBLISH_REPO') || DEFAULT_BLOG_REPO,
    branch: read('BLOG_PUBLISH_BRANCH') || DEFAULT_BLOG_BRANCH,
  };
}

/** JSON strings are valid YAML double-quoted scalars, so this is safe for any text. */
const q = (s: string) => JSON.stringify(String(s));

/** Same file format scripts/pull-blog-drafts.mjs writes. */
export function draftToMarkdown(d: PublishableDraft): string {
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

export function blogPostPath(date: string, slug: string): string {
  return `content/blog/${date}-${slug}.md`;
}

/** UTF-8 safe base64 (btoa alone only handles Latin-1). */
function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export type CommitResult =
  | { ok: true; alreadyExisted: boolean; commitUrl: string | null }
  | { ok: false; status: number; error: string };

/**
 * Creates `path` on the configured branch. Never overwrites: if the file is
 * already there (e.g. a previous publish committed but the D1 status update
 * failed), it reports `alreadyExisted` so the caller can just mark it exported.
 */
export async function commitNewFile(
  config: BlogPublishConfig,
  path: string,
  content: string,
  message: string,
  fetchImpl: typeof fetch = fetch,
): Promise<CommitResult> {
  const url = `https://api.github.com/repos/${config.repo}/contents/${path}`;
  const headers = {
    ...githubApiHeaders(config.token),
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const existing = await fetchImpl(
    `${url}?ref=${encodeURIComponent(config.branch)}`,
    { headers },
  );
  if (existing.ok) return { ok: true, alreadyExisted: true, commitUrl: null };
  if (existing.status !== 404) {
    return {
      ok: false,
      status: existing.status,
      error: `GitHub lookup failed (${existing.status}): ${await existing.text()}`,
    };
  }

  const res = await fetchImpl(url, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: toBase64(content),
      branch: config.branch,
    }),
  });
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: `GitHub commit failed (${res.status}): ${await res.text()}`,
    };
  }
  const data = (await res.json().catch(() => ({}))) as {
    commit?: { html_url?: string };
  };
  return {
    ok: true,
    alreadyExisted: false,
    commitUrl: data.commit?.html_url ?? null,
  };
}
