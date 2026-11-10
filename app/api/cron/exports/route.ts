import { NextResponse } from 'next/server';
import { getCatalogCount } from '../../../../lib/catalogCount';
import { EXPORT_BUILDERS } from '../../../../lib/catalogExportBuild';
import {
  acquireExportLock,
  type CatalogExportName,
  exportBucket,
  exportKey,
  releaseExportLock,
  writeExport,
} from '../../../../lib/catalogExportStore';
import { isCronAuthorized } from '../../../../lib/cronAuth';

/**
 * Rebuilds the stored catalog exports (/llms-full.txt, /data.json,
 * /llms.txt) into R2; the public routes only ever serve the stored copies
 * (lib/catalogExportStore.ts). Scheduled from FAST_JOBS in
 * lib/cronSchedule.ts and runs on the jobs Worker; POST it by hand (with the
 * cron secret) right after a deploy that changes an export's format.
 *
 * One build at a time (an R2 lock). Each export is built and uploaded on its
 * own, so one failing (D1 down mid-build) leaves the others fresh and its own
 * last good copy in place. It is scheduled hourly but rebuilds only exports
 * whose stored copy is older than REBUILD_AFTER_MS (or missing), so a failed
 * or missing export is retried within the hour while a good one is rebuilt
 * every two hours. `?force=1` rebuilds everything.
 */
const BUILD_ATTEMPTS = 3;
const RETRY_PAUSE_MS = 15_000;
/** A little under 2 h, so the hourly tick rebuilds every other run. */
const REBUILD_AFTER_MS = 110 * 60 * 1000;

export async function POST(req: Request) {
  if (!(await isCronAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const bucket = await exportBucket();
  if (!bucket) {
    return NextResponse.json(
      { error: 'Export bucket binding not found' },
      { status: 500 },
    );
  }
  if (!(await acquireExportLock(bucket))) {
    return NextResponse.json({
      success: true,
      message: 'skipped: another export build holds the lock',
    });
  }

  const force = new URL(req.url).searchParams.get('force') === '1';
  const results: Record<string, unknown> = {};
  let failed = 0;
  let attempted = 0;
  try {
    const catalog = await getCatalogCount();
    for (const name of Object.keys(EXPORT_BUILDERS) as CatalogExportName[]) {
      const startedAt = Date.now();
      const stored = await bucket.head(exportKey(name)).catch(() => null);
      const generatedAt = Date.parse(stored?.customMetadata?.generatedAt ?? '');
      if (!force && Date.now() - generatedAt < REBUILD_AFTER_MS) {
        results[name] = { skipped: true, ms: 0 };
        continue;
      }
      attempted++;
      // The build pages the whole catalog, so it runs into D1's 10 s
      // overload window when the tick's other crons are busy (seen on the
      // first run). Each page already retries once; a failed export is
      // retried whole after a pause instead of waiting two hours.
      for (let attempt = 1; ; attempt++) {
        try {
          const now = new Date();
          const build = await EXPORT_BUILDERS[name](catalog, now);
          const { bytes } = await writeExport(bucket, name, build.chunks, {
            generatedAt: now.toISOString(),
            rows: String(build.rows),
          });
          results[name] = {
            rows: build.rows,
            bytes,
            ms: Date.now() - startedAt,
            attempts: attempt,
          };
          break;
        } catch (err) {
          console.error(
            `[exports] building ${name} failed (attempt ${attempt}):`,
            err instanceof Error ? err.message.slice(0, 300) : err,
          );
          if (attempt < BUILD_ATTEMPTS) {
            await new Promise((r) => setTimeout(r, RETRY_PAUSE_MS));
            continue;
          }
          failed++;
          results[name] = {
            error: err instanceof Error ? err.message : String(err),
            ms: Date.now() - startedAt,
          };
          break;
        }
      }
    }
  } finally {
    await releaseExportLock(bucket);
  }

  const summary = Object.entries(results)
    .map(([name, r]) => {
      const x = r as {
        skipped?: boolean;
        rows?: number;
        bytes?: number;
        ms: number;
        error?: string;
      };
      if (x.skipped) return `${name} fresh`;
      return x.error
        ? `${name} failed (${x.error.slice(0, 120)})`
        : `${name} ${x.rows} rows ${(x.bytes ?? 0) >> 20} MiB in ${Math.round(x.ms / 1000)}s`;
    })
    .join('; ');
  return NextResponse.json(
    { success: failed === 0, message: summary, results },
    { status: attempted > 0 && failed === attempted ? 500 : 200 },
  );
}
