/**
 * GitHub API auth for health/enrich crons.
 *
 * Token must live on the **Cloudflare Worker** (`wrangler secret put GITHUB_TOKEN`).
 * GitHub Actions' automatic `GITHUB_TOKEN` only exists inside GH runners — it is
 * NOT available to Workers. Actions workflows only curl our cron endpoints with
 * `ADMIN_SECRET`; the Worker then talks to api.github.com with this secret.
 */

/** Optional classic/fine-grained PAT for higher GitHub API rate limits. */
export function getGithubToken(env?: unknown): string | null {
  const fromProcess =
    typeof process !== 'undefined' ? process.env.GITHUB_TOKEN || process.env.GH_TOKEN : undefined;
  if (fromProcess && fromProcess.trim()) return fromProcess.trim();
  if (env && typeof env === 'object') {
    const e = env as Record<string, unknown>;
    const t = e.GITHUB_TOKEN ?? e.GH_TOKEN;
    if (typeof t === 'string' && t.trim()) return t.trim();
  }
  return null;
}

export function githubApiHeaders(
  token?: string | null,
  accept = 'application/vnd.github+json',
  userAgent = 'AllMCPs'
): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': userAgent,
    Accept: accept,
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}
