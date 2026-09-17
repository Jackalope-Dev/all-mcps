import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Finds and retires duplicate MCP listings on the remote Cloudflare D1 DB.
 *
 * The submit/ingest dedup (lib/urlDedup.ts) only blocks an exact repo-URL
 * match, so the same project resubmitted under a different GitHub org or a
 * marketing URL slips through and lands as `foo`, `foo-2`, `foo-3`… This
 * script catches those with two extra keys:
 *
 *   1. normalized primary URL   (host + path, no protocol/.git/trailing slash)
 *   2. lower(name) + normalized website_url   (only when website_url is set)
 *
 * Clusters that overlap on either key are merged (union-find), then classified:
 *
 *   AUTO   — the members clearly point at the same repo: identical owner/repo,
 *            a monorepo subpath relationship, or the same repo basename under a
 *            different owner (a personal-account → org move). These are written
 *            to SQL on --apply.
 *   REVIEW — same vendor / name / website but genuinely different repos
 *            (e.g. `agishub/agishub-mcp` vs `agishub/agishub` — a memory server
 *            and an x402 payments server sharing one bad display name). Printed
 *            only; promote a real one by adding it to FORCED_CLUSTERS.
 *
 * Within a cluster the keeper is the strongest row (active > official > premium
 * > enriched > traction > oldest); every other row is set to status='removed'
 * — reversible, the page stays reachable, matches how retired listings are
 * already handled. Rows already 'removed' are left alone.
 *
 * Usage:
 *   node scripts/dedupe-listings.mjs            # dry run — writes nothing
 *   node scripts/dedupe-listings.mjs --apply    # write status='removed' to D1
 *   node scripts/dedupe-listings.mjs --all      # also apply the REVIEW tier (careful)
 */

const APPLY = process.argv.includes('--apply');
const INCLUDE_REVIEW = process.argv.includes('--all');
const DB_NAME = 'all-mcps';

/**
 * Explicit, human-reviewed merges. `keep` is the surviving id; every id in
 * `remove` is retired. Always applied (they bypass the AUTO/REVIEW split).
 */
const FORCED_CLUSTERS = [
  {
    reason:
      'Packkit — one project resubmitted as the owner moved GitHub orgs (DanMat → PackkitJS → PackkitLabs). Keep the established row with a live site.',
    keep: 'packkit-2',
    remove: ['packkit', 'packkit-3', 'packkit-4', 'danmat-create-packkit'],
  },
  // The three below are the same site listed twice as plain-vs-www. They land
  // in REVIEW rather than AUTO because they are website-only listings with no
  // repo for the AUTO tier to compare. normalizeUrlKey now strips `www.` so no
  // new ones can be created, but these predate that fix.
  {
    reason:
      'Postey — identical name, same site listed as postey.ai and www.postey.ai.',
    keep: 'postey',
    remove: ['postey-2'],
  },
  {
    reason:
      'Glushkov Modelling MCP — identical name, same site listed with and without www.',
    keep: 'glushkov-modelling-mcp',
    remove: ['glushkov-modelling-mcp-2'],
  },
  {
    reason:
      'Mynto — same site (mynto.no vs www.mynto.no); the second row is just a longer descriptive name.',
    keep: 'mynto',
    remove: ['mynto-ai-regnskapsf-rer-for-norske-selskaper'],
  },
  // --- Reviewed 2026-09-09 ---------------------------------------------
  // Promoted out of REVIEW on one mechanical rule: same GitHub owner, and the
  // two repo names differ only by an `mcp` token, punctuation, or case. Judged
  // from owner + repo name only (repo contents were not inspected), so
  // anything needing a guess about what the code actually does was left in
  // REVIEW rather than retired.
  {
    reason: 'Fitbit MCP — same owner, repo renamed fitbitmcp -> fitbit-mcp.',
    keep: 'fitbitmcp',
    remove: ['fitbitmcp-2'],
  },
  {
    reason: 'Garmin MCP — same owner, repo renamed garminmcp -> garmin-mcp.',
    keep: 'garminmcp',
    remove: ['garminmcp-2'],
  },
  {
    reason: 'Oura MCP — same owner, repo renamed ouramcp -> oura-mcp.',
    keep: 'ouramcp',
    remove: ['ouramcp-2'],
  },
  {
    reason: 'Polar MCP — same owner, repo renamed polarmcp -> polar-mcp.',
    keep: 'polarmcp',
    remove: ['polarmcp-2'],
  },
  {
    reason:
      'Withings MCP — same owner, repo renamed withingsmcp -> withings-mcp.',
    keep: 'withingsmcp',
    remove: ['withingsmcp-2'],
  },
  {
    reason:
      'Aguara — same owner, aguara-mcp vs mcp-aguara (same words reversed).',
    keep: 'aguara-mcp',
    remove: ['aguara-mcp-2'],
  },
  {
    reason: 'SWSD — same owner, MCP-SWSD vs swsd-mcp.',
    keep: 'swsd',
    remove: ['swsd-2'],
  },
  {
    reason: 'Abfallkalender — same owner, mcp-abfall vs abfall-mcp-server.',
    keep: 'abfallkalender-deutschland',
    remove: ['abfallkalender-deutschland-2'],
  },
  {
    reason: 'AgentDocs — same owner, agentdocs vs mcp-agentdocs.',
    keep: 'agentdocs-2',
    remove: ['agentdocs-3'],
  },
  {
    reason: 'Macuse — same owner, macuse vs macuse-mcp.',
    keep: 'macuse',
    remove: ['macuse-2'],
  },
  {
    reason: 'Clutter — same owner, clutter vs clutter-mcp.',
    keep: 'clutter-2',
    remove: ['clutter'],
  },
  {
    reason: 'TubePull — same owner, tubepull vs tubepull-mcp.',
    keep: 'tubepull-2',
    remove: ['tubepull'],
  },
  {
    reason: 'DialogBrain — same owner, dialogbrain vs dialogbrain-mcp.',
    keep: 'dialogbrain-2',
    remove: ['dialogbrain'],
  },
  {
    reason: 'Sqemo — same owner, sqemo vs sqemo-mcp.',
    keep: 'sqemo-2',
    remove: ['sqemo'],
  },
  {
    reason: 'What2Post — same owner, what2post vs what2post-mcp.',
    keep: 'what2post-2',
    remove: ['what2post'],
  },
  {
    reason: 'Corent — same owner, corent vs corent-mcp.',
    keep: 'corent-2',
    remove: ['corent'],
  },
  {
    reason: 'Proof Inbox — same owner, proof-inbox vs proof-inbox-mcp.',
    keep: 'proof-inbox-2',
    remove: ['proof-inbox'],
  },
  {
    reason: 'Uizze — same owner, uizze vs uizze-mcp.',
    keep: 'uizze-2',
    remove: ['uizze'],
  },
  {
    reason: 'Telemost — same owner, telemost vs telemost-mcp-server.',
    keep: 'telemost-mcp-server-2',
    remove: ['telemost-mcp-server'],
  },
  {
    reason: 'VDB — same owner, vdb vs vdb-mcp.',
    keep: 'vdb-2',
    remove: ['vdb'],
  },
  {
    reason:
      'American Default — same owner, american-default vs american-default-mcp.',
    keep: 'american-default-research-2',
    remove: ['american-default-research'],
  },
  {
    reason: 'Solentic — same owner, solentic vs solentic-mcp.',
    keep: 'blueprint-agentic-staking-solentic-2',
    remove: ['blueprint-agentic-staking-solentic'],
  },
  {
    reason: 'Nexus AI — same owner, nexus-ai vs nexusai.',
    keep: 'nexus-ai-2',
    remove: ['nexus-ai'],
  },
  {
    reason: 'Comber — same owner, comber vs comber-public.',
    keep: 'comber',
    remove: ['comber-2'],
  },
  {
    reason: 'Silex — same owner, silex-monorepo vs silex.',
    keep: 'silex-2',
    remove: ['silex'],
  },
  {
    reason:
      'Bawbel Scanner — one owner, three repos for one product (bawbel-mcp / bawbel-scanner / scanner).',
    keep: 'bawbel-scanner-2',
    remove: ['bawbel-scanner', 'bawbel-scanner-3'],
  },
  {
    reason: 'WhaTools — same owner, wha-tools vs whatools.',
    keep: 'whatools-whatsapp-tools-2',
    remove: ['whatools-whatsapp-tools'],
  },
  {
    reason: 'LiquiLens — same owner, liquilens-mcp vs LiquiLens (case only).',
    keep: 'liquilens-the-failure-radar',
    remove: ['liquilens-the-failure-radar-2'],
  },
  {
    reason: 'Ssemble — identical repo name, moved GitLab -> GitHub org.',
    keep: 'ssemble-ai-clipping-2',
    remove: ['ssemble-ai-clipping'],
  },
  {
    reason: 'VitaminMCP — same owner, VitaminMCP vs VitaminMCP-minecraft.',
    keep: 'vitaminmcp',
    remove: ['vitaminmcp-2'],
  },
  {
    // Both rows came from the registry ingest, not a submitter. The retired row
    // points at ChatGPTNextWeb/NextChat — an unrelated 88k-star project — so it
    // was displaying someone else's stars and README. ai-netcafe-2 carries the
    // real repo (mario03690/ai-netcafe).
    reason:
      'ai-netcafe — duplicate whose repo URL pointed at the unrelated NextChat project; keep the row with the real repo.',
    keep: 'ai-netcafe-2',
    remove: ['ai-netcafe'],
  },
];

/**
 * Cluster signatures (sorted member ids, comma-joined) that are NOT duplicates
 * — the keys collided but the listings are distinct. Never touched.
 */
const NOT_DUPLICATES = new Set([
  'agent-memory,mcp-57', // agishub: memory server vs x402 payments server
]);

/** Repo basenames too generic to treat a cross-owner match as "same repo". */
const GENERIC_REPO_NAMES = new Set([
  'mcp',
  'server',
  'servers',
  'mcp-server',
  'mcp-servers',
  'skills',
  'agent-skills',
  'agent',
  'agents',
  'tools',
  'sdk',
  'api',
  'app',
  'core',
  'main',
  'python-sdk',
  'typescript',
]);

function parseRepo(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const segs = u.pathname
      .replace(/\.git$/i, '')
      .replace(/\/+$/, '')
      .split('/')
      .filter(Boolean)
      .map((s) => s.toLowerCase());
    if (segs.length < 2)
      return { host, owner: '', repo: '', path: segs, ok: false };
    // Strip GitHub/GitLab tree/blob suffixes so a subpath still names its repo.
    const cut = segs.findIndex(
      (s) => s === 'tree' || s === 'blob' || s === '-',
    );
    const trimmed = cut > 1 ? segs.slice(0, cut) : segs;
    return {
      host,
      owner: trimmed[0] ?? '',
      repo: trimmed[1] ?? '',
      path: segs,
      ok: true,
    };
  } catch {
    return { host: '', owner: '', repo: '', path: [], ok: false };
  }
}

/** Do two listing URLs point at the same underlying repo? */
function sameRepo(a, b) {
  const ra = parseRepo(a);
  const rb = parseRepo(b);
  if (!ra.ok || !rb.ok) return false;
  if (ra.host !== rb.host) return false;
  // Identical owner/repo.
  if (ra.owner === rb.owner && ra.repo === rb.repo) return true;
  // One path is a prefix of the other (monorepo subpath, e.g. …/tree/main/mcp).
  const [short, long] =
    ra.path.length <= rb.path.length ? [ra.path, rb.path] : [rb.path, ra.path];
  if (short.length >= 2 && short.every((s, i) => s === long[i])) return true;
  // Same repo name under a different owner (personal → org), unless the repo
  // name is too generic for that to mean anything on its own.
  if (ra.repo && ra.repo === rb.repo && !GENERIC_REPO_NAMES.has(ra.repo)) {
    return true;
  }
  return false;
}

function normUrlKey(rawUrl) {
  if (!rawUrl) return '';
  try {
    const u = new URL(rawUrl);
    const p = u.pathname.replace(/\.git$/i, '').replace(/\/+$/, '');
    return `url:${u.hostname.toLowerCase().replace(/^www\./, '')}${p.toLowerCase()}`;
  } catch {
    return `url:${String(rawUrl).trim().toLowerCase()}`;
  }
}

function nameSiteKey(name, site) {
  const s = String(site || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '');
  if (!s) return '';
  const n = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (!n) return '';
  return `ns:${n}|${s}`;
}

/** Higher = stronger claim to be the canonical row. */
function score(r) {
  return (
    (r.status === 'active' ? 5_000_000_000 : 0) +
    (r.is_official ? 1_000_000_000 : 0) +
    (r.is_premium ? 100_000_000 : 0) +
    (r.ai_enriched_at ? 5_000_000 : 0) +
    (r.upvotes || 0) * 200_000 +
    (r.copies || 0) * 50_000 +
    (r.views || 0) * 1_000 +
    (r.github_stars || 0) * 500 +
    Math.min(r.npm_downloads || 0, 5_000_000) * 0.05
  );
}

function pickKeeper(rows) {
  return [...rows].sort((a, b) => {
    const d = score(b) - score(a);
    if (d !== 0) return d;
    const ca = Number(a.created_at) || 0;
    const cb = Number(b.created_at) || 0;
    if (ca !== cb) return ca - cb; // older wins
    return String(a.id).localeCompare(String(b.id));
  })[0];
}

function q(sql) {
  const cmd = `npx wrangler d1 execute ${DB_NAME} --remote --json --command "${sql.replace(/"/g, '\\"')}"`;
  const out = execSync(cmd, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(out)[0]?.results ?? [];
}

// --- union-find ---
class DSU {
  constructor() {
    this.p = new Map();
  }
  find(x) {
    if (!this.p.has(x)) this.p.set(x, x);
    let r = x;
    while (this.p.get(r) !== r) r = this.p.get(r);
    while (this.p.get(x) !== r) {
      const n = this.p.get(x);
      this.p.set(x, r);
      x = n;
    }
    return r;
  }
  union(a, b) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.p.set(ra, rb);
  }
}

/** A cluster is AUTO if every member points at the same repo as the keeper. */
function clusterIsAuto(members, keeper) {
  return members
    .filter((m) => m.id !== keeper.id)
    .every((m) => sameRepo(m.url, keeper.url));
}

async function main() {
  console.log('Fetching all listings from remote D1…');
  const rows = q(
    'SELECT id, name, url, website_url, status, views, copies, upvotes, github_stars, npm_downloads, is_official, is_premium, created_at, ai_enriched_at FROM servers',
  );
  console.log(`  ${rows.length} rows.\n`);

  const byId = new Map(rows.map((r) => [r.id, r]));
  const dsu = new DSU();
  for (const r of rows) dsu.find(r.id);

  for (const keyFn of [
    (r) => normUrlKey(r.url),
    (r) => nameSiteKey(r.name, r.website_url),
  ]) {
    const buckets = new Map();
    for (const r of rows) {
      const k = keyFn(r);
      if (!k) continue;
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(r.id);
    }
    for (const ids of buckets.values()) {
      for (let i = 1; i < ids.length; i++) dsu.union(ids[0], ids[i]);
    }
  }

  const forcedRemovals = new Map(); // id -> { keep, reason }
  for (const fc of FORCED_CLUSTERS) {
    if (!byId.has(fc.keep)) {
      console.warn(`⚠ forced keeper "${fc.keep}" not found — skipping.`);
      continue;
    }
    for (const rid of fc.remove) {
      if (!byId.has(rid)) continue;
      dsu.union(fc.keep, rid);
      forcedRemovals.set(rid, { keep: fc.keep, reason: fc.reason });
    }
  }

  const clusters = new Map();
  for (const r of rows) {
    const root = dsu.find(r.id);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root).push(r);
  }

  const auto = []; // { id, status, keeper, why }
  const review = []; // { keeper, members: [ids] }

  for (const members of clusters.values()) {
    if (members.length < 2) continue;

    const sig = members
      .map((m) => m.id)
      .sort()
      .join(',');
    if (NOT_DUPLICATES.has(sig)) continue;

    const forcedKeep = members.find((m) => forcedRemovals.has(m.id));
    const keeper = forcedKeep
      ? byId.get(forcedRemovals.get(forcedKeep.id).keep)
      : pickKeeper(members);

    const isForced = Boolean(forcedKeep);
    const isAuto = isForced || clusterIsAuto(members, keeper);

    const losers = members.filter(
      (m) => m.id !== keeper.id && m.status !== 'removed',
    );
    if (losers.length === 0) continue;

    if (isAuto || INCLUDE_REVIEW) {
      for (const m of losers) {
        auto.push({
          id: m.id,
          status: m.status,
          keeper: keeper.id,
          why: isForced ? 'forced' : isAuto ? 'same-repo' : 'REVIEW (--all)',
        });
      }
    } else {
      review.push({
        keeper: keeper.id,
        members: members.map((m) => ({
          id: m.id,
          url: m.url,
          status: m.status,
        })),
      });
    }
  }

  auto.sort(
    (a, b) => a.keeper.localeCompare(b.keeper) || a.id.localeCompare(b.id),
  );

  console.log(
    `AUTO — retire ${auto.length} row(s) across ${new Set(auto.map((r) => r.keeper)).size} cluster(s):`,
  );
  for (const r of auto) {
    console.log(
      `  ${r.id.padEnd(40)} (${String(r.status).padEnd(7)}) → keep ${r.keeper}  [${r.why}]`,
    );
  }

  console.log(
    `\nREVIEW — ${review.length} cluster(s) with the same name/site but different repos. Not touched.`,
  );
  console.log('  Add a real duplicate to FORCED_CLUSTERS to retire it.\n');
  for (const c of review) {
    console.log(`  keeper ${c.keeper}`);
    for (const m of c.members) {
      const repo = (() => {
        try {
          return new URL(m.url).host + new URL(m.url).pathname;
        } catch {
          return m.url;
        }
      })();
      console.log(
        `      ${m.id.padEnd(38)} (${String(m.status).padEnd(7)}) ${repo}`,
      );
    }
  }

  if (auto.length === 0) {
    console.log('\nNothing to auto-apply.');
    return;
  }
  if (!APPLY) {
    console.log('\n[DRY RUN] Nothing written. Re-run with --apply.');
    return;
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const sqlFile = path.join(process.cwd(), 'drizzle', `dedupe-${ts}.sql`);
  const lines = auto.map(
    (r) =>
      `UPDATE servers SET status = 'removed' WHERE id = '${r.id.replace(/'/g, "''")}' AND status <> 'removed';`,
  );
  fs.writeFileSync(sqlFile, `${lines.join('\n')}\n`, 'utf8');
  console.log(`\nWrote ${lines.length} statements to ${sqlFile}`);

  execSync(`npx wrangler d1 execute ${DB_NAME} --remote --file=${sqlFile}`, {
    stdio: 'inherit',
  });
  console.log(
    '\n✅ Done. Retired listings stay reachable at /mcp/<id> but drop out of search, browse, API, and the sitemap.',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
