/**
 * Ingest guard: does a candidate's name have anything to do with the repo it
 * claims? TypeScript port of scripts/repoIdentity.mjs (kept for the manual
 * ingest script); the two must agree.
 *
 * Three live listings pointed at large, unrelated projects ("ai-netcafe" ->
 * ChatGPTNextWeb/NextChat, 88k stars). github_stars is enriched from the
 * linked repo, so those rows ranked on stars they did not own. This is a
 * warning that sends the row to a human, not a rejection: a naive token check
 * flagged 18 listings of which only 3 were real.
 */

const STOPWORDS = new Set([
  'mcp',
  'server',
  'servers',
  'api',
  'app',
  'the',
  'for',
  'and',
  'official',
  'remote',
  'client',
  'sdk',
  'tools',
  'tool',
  'tree',
  'main',
  'master',
  'blob',
  'src',
  'packages',
  'package',
  'com',
  'github',
]);

function identityTokens(value: string): Set<string> {
  return new Set(
    value
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2 && !STOPWORDS.has(t)),
  );
}

function condense(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * A warning when `name` shares no identity with the GitHub path it points at
 * AND that repo is popular enough (minStars) that borrowing it would distort
 * ranking; null when the pairing looks fine.
 */
export function findRepoIdentityMismatch(
  candidate: { name: string; url: string; githubStars?: number | null },
  minStars = 1000,
): string | null {
  const match = /github\.com\/(.+)$/i.exec(candidate.url || '');
  if (!match) return null;
  const stars = Number(candidate.githubStars);
  if (!Number.isFinite(stars) || stars < minStars) return null;

  const repoPath = match[1]
    .replace(/[?#].*$/, '')
    .replace(/\.git$/i, '')
    .replace(/\/+$/, '');
  const nameTokens = identityTokens(candidate.name);
  if (nameTokens.size === 0) return null;
  const pathTokens = identityTokens(repoPath);
  if (pathTokens.size === 0) return null;
  for (const token of nameTokens) {
    if (pathTokens.has(token)) return null;
  }

  // Spacing-only differences ("World Monitor" vs koala73/worldmonitor) and a
  // name that matches a deep monorepo path segment.
  const nameCondensed = condense(candidate.name);
  const pathCondensed = condense(repoPath);
  if (nameCondensed.length > 3 && pathCondensed.includes(nameCondensed)) {
    return null;
  }
  for (const segment of repoPath.split('/')) {
    const seg = condense(segment);
    if (seg.length > 3 && nameCondensed.includes(seg)) return null;
  }

  return `name "${candidate.name}" shares no identity with repo '${repoPath}' (${stars.toLocaleString()} stars) — confirm this is not another project's repository`;
}
