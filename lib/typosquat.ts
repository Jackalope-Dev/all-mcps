/**
 * Package names that imitate a popular package — `@modeicontextprotocol/…`,
 * `server-githbu`, `rncp-server` for `mcp-server`. Typosquats are the cheapest supply-chain attack on a catalog like
 * ours: the listing looks like the real server and the install runs someone
 * else's code.
 *
 * A match flags the listing for a human (lib/staleness.ts 'typosquat'); it
 * never removes it. To keep false positives rare, the imitated package must be
 * far more used than the suspect one, and short names (where one edit is just
 * a different word) never match on edit distance alone.
 */

export type PopularPackage = { name: string; downloads: number };

/** The popular package must have at least this many monthly downloads… */
const MIN_POPULAR_DOWNLOADS = 1000;
/** …and at least this many times the suspect's. */
const POPULARITY_RATIO = 20;
/** Bare names shorter than this never match on edit distance. */
const MIN_FUZZY_LENGTH = 7;

/** Characters attackers swap for look-alikes, folded to one form. */
function fold(s: string): string {
  return s
    .toLowerCase()
    .replace(/rn/g, 'm')
    .replace(/vv/g, 'w')
    .replace(/[1il|]/g, 'l')
    .replace(/0/g, 'o')
    .replace(/[_.]/g, '-');
}

function stripVersionSuffix(bare: string): string {
  return bare.replace(/[-_]?v?\d+$/, '');
}

function split(name: string): { scope: string | null; bare: string } {
  const n = name.trim().toLowerCase();
  if (n.startsWith('@') && n.includes('/')) {
    const i = n.indexOf('/');
    return { scope: n.slice(1, i), bare: n.slice(i + 1) };
  }
  return { scope: null, bare: n };
}

/** Optimal string alignment distance (Damerau-Levenshtein with adjacent swaps). */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/**
 * The popular package `name` appears to imitate, or null. `downloads` is the
 * suspect's own monthly downloads (null = unknown, treated as zero).
 */
export function findTyposquatTarget(
  name: string,
  downloads: number | null | undefined,
  popular: PopularPackage[],
): string | null {
  // Unknown downloads (never measured, or not an npm package) can't be
  // compared against the popular one, so no verdict.
  if (downloads == null) return null;
  const suspect = split(name);
  if (!suspect.bare) return null;
  const lowered = name.trim().toLowerCase();

  for (const p of popular) {
    const target = p.name.trim().toLowerCase();
    if (target === lowered) continue;
    if (p.downloads < MIN_POPULAR_DOWNLOADS) continue;
    if (p.downloads < Math.max(1, downloads) * POPULARITY_RATIO) continue;
    const t = split(target);

    // Look-alike scope with the same bare name: @modeicontextprotocol/x.
    // A different, ordinary scope (@acme/notion-mcp-server) is just another
    // author using a descriptive name, which is common and fine.
    if (
      t.scope &&
      suspect.scope &&
      suspect.scope !== t.scope &&
      suspect.bare === t.bare &&
      (fold(suspect.scope) === fold(t.scope) ||
        (t.scope.length >= MIN_FUZZY_LENGTH &&
          editDistance(suspect.scope, t.scope) <= 1))
    ) {
      return p.name;
    }

    // Same scope (or both unscoped), look-alike name. Only character swaps
    // that imitate: homoglyphs (rn/m, 1/l, 0/o) and two adjacent letters
    // transposed. Plain one-letter differences are usually different real
    // products (mysql/mssql, redis/reddit, jira/jina), so they don't count.
    if (suspect.scope !== t.scope || suspect.bare.length < MIN_FUZZY_LENGTH)
      continue;
    if (stripVersionSuffix(suspect.bare) === stripVersionSuffix(t.bare))
      continue;
    if (fold(suspect.bare) === fold(t.bare)) return p.name;
    if (isAdjacentTransposition(suspect.bare, t.bare)) return p.name;
  }
  return null;
}

/** True when `a` is `b` with exactly two neighbouring characters swapped. */
function isAdjacentTransposition(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return (
    i < a.length - 1 &&
    a[i] === b[i + 1] &&
    a[i + 1] === b[i] &&
    a[i] !== a[i + 1] &&
    a.slice(i + 2) === b.slice(i + 2)
  );
}
