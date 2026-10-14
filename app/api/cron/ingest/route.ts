import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { isCronAuthorized } from '../../../../lib/cronAuth';
import { getGithubToken } from '../../../../lib/githubAuth';
import {
  fetchAwesomeLists,
  fetchGithubTopicCandidates,
  fetchNpmCandidates,
  fetchRegistrySince,
} from '../../../../lib/ingest/fetchSources';
import { ingestCandidates } from '../../../../lib/ingest/run';
import type { IngestCandidate } from '../../../../lib/ingest/sources';

/**
 * Pulls new MCP servers from public sources and stages them as pending,
 * ingested listings (no submitterEmail). From there the stale sweep checks
 * the source, Jev triages it and the imported-listing gate / auto-promote
 * publish what clears the bar, exactly as for the old weekly GitHub Actions
 * run (scripts/ingest-sources.mjs, now a manual backup).
 *
 *   ?source=registry  official MCP Registry, entries updated in the last
 *                     `hours` (default 6; scheduled every 4h with overlap,
 *                     plus a 30h catch-up once a day for missed runs)
 *   ?source=awesome   the community awesome-list READMEs (daily)
 *   ?source=npm       npm keyword search, rotating page (daily)
 *   ?source=github    GitHub topic search, pushed in the last week (daily)
 *
 * Bounded per run: at most MAX_NEW new listings and a wall-clock budget, so a
 * big backlog drains over several runs instead of blowing the Worker limit.
 */

const MAX_NEW = 40;
/** The scheduled tick waits on this run alongside health/enrich/stale-sweep. */
const BUDGET_MS = 4 * 60 * 1000;
const MAX_REGISTRY_HOURS = 72;

const SOURCES = ['registry', 'awesome', 'npm', 'github'] as const;
type Source = (typeof SOURCES)[number];

export async function POST(req: Request) {
  const startedAt = Date.now();
  try {
    if (!(await isCronAuthorized(req))) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    const params = new URL(req.url).searchParams;
    const source = (params.get('source') ?? 'registry') as Source;
    if (!SOURCES.includes(source)) {
      return NextResponse.json(
        { error: `source must be one of ${SOURCES.join(', ')}` },
        { status: 400 },
      );
    }

    const { env } = await getCloudflareContext();
    if (!env?.DB) throw new Error('Database binding not found');
    const db = drizzle(env.DB as any);
    const githubToken = getGithubToken(env);
    const now = new Date();

    let candidates: IngestCandidate[];
    if (source === 'registry') {
      const hours = Math.min(
        Math.max(Number(params.get('hours')) || 6, 1),
        MAX_REGISTRY_HOURS,
      );
      candidates = await fetchRegistrySince(
        new Date(now.getTime() - hours * 3_600_000),
      );
    } else if (source === 'awesome') {
      candidates = await fetchAwesomeLists();
    } else if (source === 'npm') {
      candidates = await fetchNpmCandidates(now);
    } else {
      candidates = await fetchGithubTopicCandidates(now, githubToken);
    }

    const result = await ingestCandidates(db, candidates, {
      now,
      maxNew: MAX_NEW,
      deadline: startedAt + BUDGET_MS,
      githubToken,
    });
    console.log(`[ingest] ${source}`, JSON.stringify(result));
    return NextResponse.json({ success: true, source, ...result });
  } catch (error) {
    console.error('[ingest] failed', error);
    return NextResponse.json({ error: 'Ingest failed.' }, { status: 500 });
  }
}
