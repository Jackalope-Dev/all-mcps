/**
 * Prebuilt whole-catalog exports (/llms-full.txt, /data.json, /llms.txt),
 * stored in R2 and served from there.
 *
 * Built on every request, llms-full.txt read the whole catalog from D1 and
 * rendered ~90 MB of markdown per hit: ~30-50 s, a Range request got the
 * whole body anyway, and slow readers left the isolate "hung" until the
 * runtime canceled it. data.json took ~7 s and llms.txt ~5 s, and one failed
 * D1 page out of ~16 turned either into a 503 (Nov 2026).
 *
 * Now /api/cron/exports builds them on a schedule (lib/catalogExportBuild.ts)
 * and the routes stream the stored object, with its ETag, conditional
 * requests and byte ranges handled by R2. A new build becomes visible only
 * when its upload completes, so readers get the last good copy until then.
 */

/** Under its own prefix: isr-cache-cleanup only deletes `incremental-cache/`. */
const PREFIX = 'exports/v1/';

const CATALOG_EXPORTS = {
  'llms-full.txt': { contentType: 'text/plain; charset=utf-8' },
  'data.json': { contentType: 'application/json; charset=utf-8' },
  'llms.txt': { contentType: 'text/plain; charset=utf-8' },
} as const;

export type CatalogExportName = keyof typeof CATALOG_EXPORTS;

export function exportKey(name: CatalogExportName): string {
  return PREFIX + name;
}

/** The R2 bucket the exports live in, or null without bindings (build, tests). */
export async function exportBucket(): Promise<R2Bucket | null> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const { env } = getCloudflareContext();
    return (
      (env as { NEXT_INC_CACHE_R2_BUCKET?: R2Bucket })
        .NEXT_INC_CACHE_R2_BUCKET ?? null
    );
  } catch {
    return null;
  }
}

/**
 * Browsers and agents may keep a copy an hour; shared caches a little longer
 * and stale for a day while they revalidate (the ETag makes that a 304).
 */
const CACHE_CONTROL =
  'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400';

/**
 * The stored copy of `name` as a response (200, 206 for a byte range, 304
 * for a matching If-None-Match / If-Modified-Since, 416 for an unsatisfiable
 * range), or null when none has been built yet or R2 failed — the caller
 * decides what a missing copy means.
 */
export async function serveStoredExport(
  request: Request,
  name: CatalogExportName,
  extraHeaders: Record<string, string> = {},
): Promise<Response | null> {
  const bucket = await exportBucket();
  if (!bucket) return null;
  const key = exportKey(name);
  const hasRange = request.headers.has('range');
  let obj: R2Object | R2ObjectBody | null;
  try {
    obj = await bucket.get(key, {
      onlyIf: request.headers,
      ...(hasRange ? { range: request.headers } : {}),
    });
  } catch (err) {
    if (!hasRange) {
      console.error(`[exports] reading ${key} from R2 failed:`, err);
      return null;
    }
    // R2 rejects a range it can't satisfy (past the end, or malformed).
    const head = await bucket.head(key).catch(() => null);
    if (!head) return null;
    const start = /^bytes=(\d+)-/.exec(request.headers.get('range') ?? '');
    if (start && Number(start[1]) >= head.size) {
      return new Response(null, {
        status: 416,
        headers: {
          'Content-Range': `bytes */${head.size}`,
          'Cache-Control': 'no-store',
        },
      });
    }
    // A range we can't read as one span: the whole object, as RFC 9110 allows.
    const plain = new Request(request.url, { method: request.method });
    return serveStoredExport(plain, name, extraHeaders);
  }
  if (!obj) return null;

  const headers = new Headers(extraHeaders);
  obj.writeHttpMetadata(headers);
  headers.set('Content-Type', CATALOG_EXPORTS[name].contentType);
  headers.set('Cache-Control', CACHE_CONTROL);
  headers.set('ETag', obj.httpEtag);
  headers.set('Last-Modified', obj.uploaded.toUTCString());
  headers.set('Accept-Ranges', 'bytes');
  const generatedAt = obj.customMetadata?.generatedAt;
  if (generatedAt) headers.set('X-Export-Generated-At', generatedAt);

  // Precondition matched (If-None-Match / If-Modified-Since): no body.
  if (!('body' in obj)) return new Response(null, { status: 304, headers });

  const body = request.method === 'HEAD' ? null : obj.body;
  const range = hasRange ? resolvedRange(obj.range, obj.size) : null;
  if (range) {
    headers.set(
      'Content-Range',
      `bytes ${range.start}-${range.end}/${obj.size}`,
    );
    headers.set('Content-Length', String(range.end - range.start + 1));
    if (!body) obj.body.cancel().catch(() => {});
    return new Response(body, { status: 206, headers });
  }
  headers.set('Content-Length', String(obj.size));
  if (!body) obj.body.cancel().catch(() => {});
  return new Response(body, { status: 200, headers });
}

/** The inclusive byte span R2 returned for a ranged read, or null for the whole object. */
export function resolvedRange(
  range: R2Range | undefined,
  size: number,
): { start: number; end: number } | null {
  if (!range) return null;
  let start: number;
  let length: number;
  if ('suffix' in range && range.suffix !== undefined) {
    length = Math.min(range.suffix, size);
    start = size - length;
  } else {
    const r = range as { offset?: number; length?: number };
    start = r.offset ?? 0;
    length = r.length ?? size - start;
  }
  if (start === 0 && length >= size) return null;
  return { start, end: Math.min(size, start + length) - 1 };
}

/**
 * Bytes per multipart part. R2 needs every part but the last to be >= 5 MiB
 * and all of them the same length ("All non-trailing parts must have the
 * same length"), so parts are cut at exactly this size.
 */
const PART_BYTES = 8 * 1024 * 1024;

/**
 * Writes `chunks` to the export's key as one object, without ever holding
 * the whole file: small exports go up in one put, large ones as a multipart
 * upload in PART_BYTES parts. The previous object stays readable until the
 * upload completes, and a failed build aborts and leaves it in place.
 */
export async function writeExport(
  bucket: R2Bucket,
  name: CatalogExportName,
  chunks: AsyncIterable<string> | Iterable<string>,
  metadata: Record<string, string>,
): Promise<{ bytes: number; etag: string }> {
  const key = exportKey(name);
  const options = {
    httpMetadata: { contentType: CATALOG_EXPORTS[name].contentType },
    customMetadata: metadata,
  };
  const encoder = new TextEncoder();
  // The part being filled; `filled` bytes of it are in use.
  let part = new Uint8Array(PART_BYTES);
  let filled = 0;
  let total = 0;
  let upload: R2MultipartUpload | null = null;
  const parts: R2UploadedPart[] = [];

  try {
    for await (const chunk of chunks) {
      if (!chunk) continue;
      let bytes = encoder.encode(chunk);
      total += bytes.byteLength;
      while (bytes.byteLength > 0) {
        const n = Math.min(PART_BYTES - filled, bytes.byteLength);
        part.set(bytes.subarray(0, n), filled);
        filled += n;
        bytes = bytes.subarray(n);
        if (filled === PART_BYTES) {
          upload ??= await bucket.createMultipartUpload(key, options);
          parts.push(await upload.uploadPart(parts.length + 1, part));
          part = new Uint8Array(PART_BYTES);
          filled = 0;
        }
      }
    }
    const rest = part.slice(0, filled);
    if (!upload) {
      const obj = await bucket.put(key, rest, options);
      return { bytes: total, etag: obj?.httpEtag ?? '' };
    }
    if (filled > 0) {
      parts.push(await upload.uploadPart(parts.length + 1, rest));
    }
    const obj = await upload.complete(parts);
    return { bytes: total, etag: obj.httpEtag };
  } catch (err) {
    await upload?.abort().catch(() => {});
    throw err;
  }
}

const LOCK_KEY = `${PREFIX}.build-lock`;
/** A lock older than this belongs to a build that died; the next one may take over. */
const LOCK_STALE_MS = 20 * 60 * 1000;

/**
 * Takes the build lock, or returns false while another build holds a fresh
 * one. Best-effort (R2 has no compare-and-set across a read and a write), but
 * the builds are idempotent, so a rare overlap only costs a duplicate run.
 */
export async function acquireExportLock(
  bucket: R2Bucket,
  now = Date.now(),
): Promise<boolean> {
  const held = await bucket.head(LOCK_KEY);
  const at = Number(held?.customMetadata?.startedAt ?? 0);
  if (held && now - at < LOCK_STALE_MS) return false;
  await bucket.put(LOCK_KEY, String(now), {
    customMetadata: { startedAt: String(now) },
  });
  return true;
}

export async function releaseExportLock(bucket: R2Bucket): Promise<void> {
  await bucket.delete(LOCK_KEY).catch(() => {});
}
