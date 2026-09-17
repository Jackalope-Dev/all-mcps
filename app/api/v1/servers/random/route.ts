import { resolveCategoryParam } from '@/lib/categories';
import { resolveInstallConfig } from '@/lib/installConfig';
import { computeQualityScore } from '@/lib/qualityScore';
import { getActiveServersForScoring, getCategoryServers } from '@/lib/servers';

export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode') || 'random'; // 'random' | 'hidden-gem' | 'superpower' | 'stack'
  // Resolved against the canonical catalog (slug, label, or full stored name) —
  // the stored category carries an emoji prefix, so a raw value never matches.
  // An unrecognized category falls through to the full catalog, same as the
  // empty-pool fallback below.
  const category = resolveCategoryParam(searchParams.get('category'));
  const countParam = parseInt(
    searchParams.get('count') || (mode === 'stack' ? '3' : '1'),
    10,
  );
  const count = Math.min(Math.max(1, countParam), 5);

  let pool = category
    ? await getCategoryServers(category)
    : await getActiveServersForScoring();

  if (!pool || pool.length === 0) {
    pool = await getActiveServersForScoring();
  }

  let selected: typeof pool = [];

  if (mode === 'hidden-gem') {
    // Hidden gems: Quality score >= 40, stars < 500 or upvotes < 50 (wide pool of sleeper picks)
    const gems = pool.filter((s) => {
      const qs = computeQualityScore(s).score;
      const stars = s.githubStars ?? 0;
      const upvotes = s.upvotes ?? 0;
      return qs >= 40 && (stars < 500 || upvotes < 50);
    });

    const candidates = gems.length >= count ? gems : pool;
    selected = shuffle(candidates).slice(0, count);
  } else if (mode === 'superpower') {
    // Superpower: Quality score >= 75 (falls back to top scored if pool is small)
    const highQuality = pool.filter((s) => computeQualityScore(s).score >= 75);
    const candidates =
      highQuality.length >= count
        ? highQuality
        : [...pool]
            .sort(
              (a, b) =>
                computeQualityScore(b).score - computeQualityScore(a).score,
            )
            .slice(0, 20);
    selected = shuffle(candidates).slice(0, count);
  } else if (mode === 'stack') {
    // Stack: pick 3 servers from different categories
    const byCategory = new Map<string, typeof pool>();
    for (const s of pool) {
      const cat = s.category || 'Developer Tools';
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat)!.push(s);
    }

    const categories = Array.from(byCategory.keys());
    const shuffledCats = shuffle(categories);
    const stackResult: typeof pool = [];

    for (const cat of shuffledCats) {
      if (stackResult.length >= count) break;
      const catServers = byCategory.get(cat)!;
      const picked = catServers[Math.floor(Math.random() * catServers.length)];
      if (picked && !stackResult.some((s) => s.id === picked.id)) {
        stackResult.push(picked);
      }
    }

    if (stackResult.length < count) {
      const remaining = pool.filter(
        (s) => !stackResult.some((item) => item.id === s.id),
      );
      stackResult.push(
        ...shuffle(remaining).slice(0, count - stackResult.length),
      );
    }

    selected = stackResult;
  } else {
    // Pure random across the full active catalog
    selected = shuffle(pool).slice(0, count);
  }

  const results = selected.map((server) => {
    const install = resolveInstallConfig({
      id: server.id,
      name: server.name,
      url: server.url,
      description: server.description,
      installKind: server.installKind,
      installCommand: server.installCommand,
      installArgs: server.installArgs,
      installPackage: server.installPackage,
      installConfidence: server.installConfidence,
    });

    const installCommand =
      install.kind === 'stdio'
        ? `npx -y ${install.packageName}`
        : `claude mcp add ${server.id}`;

    return {
      id: server.id,
      name: server.name,
      description: server.description,
      category: server.category || 'Developer Tools',
      url: server.url,
      isOfficial: Boolean(server.isOfficial),
      isVerifiedActive: Boolean(server.isVerifiedActive),
      upvotes: server.upvotes || 0,
      githubStars: server.githubStars ?? null,
      npmDownloads: server.npmDownloads ?? null,
      qualityScore: computeQualityScore(server).score,
      installCommand,
      detailUrl: `/mcp/${server.id}`,
    };
  });

  return Response.json(
    {
      mode,
      category: category || null,
      count: results.length,
      servers: results,
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
        'Content-Type': 'application/json; charset=utf-8',
      },
    },
  );
}

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
