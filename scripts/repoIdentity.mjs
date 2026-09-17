/**
 * Ingest guard: does a candidate's name have anything to do with the repo it
 * claims?
 *
 * Three live listings were found pointing at large, unrelated projects — e.g.
 * "ai-netcafe" -> ChatGPTNextWeb/NextChat (88k stars), "labelhead-artist-
 * momentum" -> paperclipai/paperclip (80k). These came from the registry
 * ingest, not from submitters, and the damage is not just a wrong link:
 * github_stars is enriched FROM the linked repo, so those rows ranked on stars
 * they did not own.
 *
 * This is deliberately a WARNING, not a rejection. A naive token check flagged
 * 18 listings of which only 3 were real, so the tokenizer below is tuned to
 * kill the known false-positive shapes (monorepo subpaths, camelCase repo
 * names, spacing differences) and anything still ambiguous goes to the same
 * human review bucket the duplicate warnings use.
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

/** "FinanceToolkit" -> "Finance Toolkit", so camelCase repo names tokenize. */
function splitCamel(value) {
  return String(value || '').replace(/([a-z0-9])([A-Z])/g, '$1 $2');
}

/** Meaningful lowercase tokens, filler words dropped. */
export function identityTokens(value) {
  return new Set(
    splitCamel(value)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2 && !STOPWORDS.has(t)),
  );
}

/** Separator-free form, so "World Monitor" can match "worldmonitor". */
export function condense(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Returns a warning string when `candidate.name` shares no identity with the
 * GitHub path it points at AND that repo is popular enough that borrowing it
 * would distort ranking. Returns null when the pairing looks fine.
 *
 * The star floor matters: a mismatch against an obscure repo is unverifiable
 * and mostly harmless, while a mismatch against a big one is exactly the case
 * that inflates a listing's stars with someone else's traction.
 */
export function findRepoIdentityMismatch(candidate, options = {}) {
  const minStars = options.minStars ?? 1000;

  const match = /github\.com\/(.+)$/i.exec(candidate?.url || '');
  if (!match) return null;

  const stars = Number(candidate?.githubStars);
  if (!Number.isFinite(stars) || stars < minStars) return null;

  const repoPath = match[1]
    .replace(/[?#].*$/, '')
    .replace(/\.git$/i, '')
    .replace(/\/+$/, '');
  const nameTokens = identityTokens(candidate?.name);
  if (nameTokens.size === 0) return null;

  const pathTokens = identityTokens(repoPath);
  if (pathTokens.size === 0) return null;

  for (const token of nameTokens) {
    if (pathTokens.has(token)) return null;
  }

  // Spacing-only differences: "World Monitor" vs koala73/worldmonitor, and the
  // monorepo case where the name matches a deep path segment.
  const nameCondensed = condense(candidate?.name);
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
