import { NextResponse } from 'next/server';
import { getCatalogCount } from '../../../../lib/catalogCount';
import { EXPORT_BUILDERS } from '../../../../lib/catalogExportBuild';
import {
  acquireExportLock,
  type CatalogExportName,
  exportBucket,
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
 * last good copy in place.
 */
const BUILD_ATTEMPTS = 3;
const RETRY_PAUSE_MS = 15_000;

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

  const results: Record<string, unknown> = {};
  let failed = 0;
  try {
    const catalog = await getCatalogCount();
    for (const name of Object.keys(EXPORT_BUILDERS) as CatalogExportName[]) {
      const startedAt = Date.now();
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
        rows?: number;
        bytes?: number;
        ms: number;
        error?: string;
      };
      return x.error
        ? `${name} failed (${x.error.slice(0, 120)})`
        : `${name} ${x.rows} rows ${(x.bytes ?? 0) >> 20} MiB in ${Math.round(x.ms / 1000)}s`;
    })
    .join('; ');
  return NextResponse.json(
    { success: failed === 0, message: summary, results },
    { status: failed === Object.keys(results).length ? 500 : 200 },
  );
}
