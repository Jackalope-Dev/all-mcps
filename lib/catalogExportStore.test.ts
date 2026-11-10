import { describe, expect, it, vi } from 'vitest';

/**
 * The stored-export layer (lib/catalogExportStore.ts) against an in-memory
 * stand-in for the R2 calls it makes: whole and multipart writes, the build
 * lock, and serving with ETag, conditional requests and byte ranges.
 */

type Stored = {
  bytes: Uint8Array;
  etag: string;
  uploaded: Date;
  customMetadata?: Record<string, string>;
};

function parseRange(
  header: string | null,
  size: number,
): { suffix: number } | { offset: number; length: number } | undefined {
  const m = header ? /^bytes=(\d*)-(\d*)$/.exec(header) : null;
  if (!m) return undefined;
  if (m[1] === '') return { suffix: Number(m[2]) };
  const offset = Number(m[1]);
  if (offset >= size) throw new Error('InvalidRange');
  const end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  return { offset, length: end - offset + 1 };
}

function fakeBucket() {
  const objects = new Map<string, Stored>();
  const parts: { size: number }[] = [];
  let n = 0;
  const meta = (key: string, o: Stored) => ({
    key,
    size: o.bytes.byteLength,
    httpEtag: o.etag,
    uploaded: o.uploaded,
    customMetadata: o.customMetadata,
    writeHttpMetadata: () => {},
  });
  const store = (key: string, bytes: Uint8Array, opts?: any) => {
    const o: Stored = {
      bytes,
      etag: `"e${++n}"`,
      uploaded: new Date('2026-11-10T00:00:00Z'),
      customMetadata: opts?.customMetadata,
    };
    objects.set(key, o);
    return meta(key, o);
  };
  const bucket = {
    objects,
    parts,
    async head(key: string) {
      const o = objects.get(key);
      return o ? meta(key, o) : null;
    },
    async put(key: string, value: Uint8Array | string, opts?: any) {
      const bytes =
        typeof value === 'string' ? new TextEncoder().encode(value) : value;
      return store(key, bytes, opts);
    },
    async delete(key: string) {
      objects.delete(key);
    },
    async get(key: string, opts?: { onlyIf?: Headers; range?: Headers }) {
      const o = objects.get(key);
      if (!o) return null;
      const m = meta(key, o);
      if (opts?.onlyIf?.get('if-none-match') === o.etag) return m;
      const range = parseRange(
        opts?.range?.get('range') ?? null,
        o.bytes.byteLength,
      );
      let slice = o.bytes;
      if (range && 'suffix' in range) {
        slice = o.bytes.slice(o.bytes.byteLength - range.suffix);
      } else if (range) {
        slice = o.bytes.slice(range.offset, range.offset + range.length);
      }
      return {
        ...m,
        range,
        body: new Blob([slice as Uint8Array<ArrayBuffer>]).stream(),
      };
    },
    async createMultipartUpload(key: string, opts?: any) {
      const chunks: Uint8Array[] = [];
      return {
        async uploadPart(num: number, data: Uint8Array) {
          chunks[num - 1] = data;
          parts.push({ size: data.byteLength });
          return { partNumber: num, etag: `p${num}` };
        },
        async complete() {
          const total = chunks.reduce((t, c) => t + c.byteLength, 0);
          const all = new Uint8Array(total);
          let off = 0;
          for (const c of chunks) {
            all.set(c, off);
            off += c.byteLength;
          }
          return store(key, all, opts);
        },
        async abort() {},
      };
    },
  };
  return bucket;
}

const bucket = fakeBucket();
vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: () => ({ env: { NEXT_INC_CACHE_R2_BUCKET: bucket } }),
}));

const {
  acquireExportLock,
  exportKey,
  releaseExportLock,
  resolvedRange,
  serveStoredExport,
  writeExport,
} = await import('./catalogExportStore');

const r2 = bucket as unknown as R2Bucket;
const get = (headers: Record<string, string> = {}) =>
  new Request('https://allmcps.com/llms-full.txt', { headers });

describe('writeExport', () => {
  it('puts a small export in one write', async () => {
    const res = await writeExport(r2, 'llms.txt', ['# a\n', 'b\n'], {
      generatedAt: 'now',
    });
    expect(res.bytes).toBe(6);
    expect(
      new TextDecoder().decode(
        bucket.objects.get(exportKey('llms.txt'))?.bytes,
      ),
    ).toBe('# a\nb\n');
  });

  it('streams a large export up in >= 5 MiB parts', async () => {
    const line = `${'x'.repeat(1023)}\n`;
    async function* chunks() {
      for (let i = 0; i < 20 * 1024; i++) yield line; // 20 MiB
    }
    const res = await writeExport(r2, 'llms-full.txt', chunks(), {});
    expect(res.bytes).toBe(20 * 1024 * 1024);
    expect(
      bucket.objects.get(exportKey('llms-full.txt'))?.bytes.byteLength,
    ).toBe(20 * 1024 * 1024);
    const sizes = bucket.parts.map((p) => p.size);
    expect(sizes.length).toBeGreaterThan(1);
    for (const size of sizes.slice(0, -1)) {
      expect(size).toBeGreaterThanOrEqual(5 * 1024 * 1024);
    }
  });

  it('keeps the last good copy when a build fails mid-way', async () => {
    const before = bucket.objects.get(exportKey('llms.txt'));
    async function* broken() {
      yield 'partial';
      throw new Error('D1_ERROR: overloaded');
    }
    await expect(writeExport(r2, 'llms.txt', broken(), {})).rejects.toThrow();
    expect(bucket.objects.get(exportKey('llms.txt'))).toBe(before);
  });
});

describe('serveStoredExport', () => {
  it('serves the stored copy with strong cache headers', async () => {
    const res = await serveStoredExport(get(), 'llms.txt');
    expect(res?.status).toBe(200);
    expect(res?.headers.get('ETag')).toMatch(/^"e\d+"$/);
    expect(res?.headers.get('Cache-Control')).toContain('max-age=3600');
    expect(res?.headers.get('Accept-Ranges')).toBe('bytes');
    expect(res?.headers.get('Content-Length')).toBe('6');
    expect(await res?.text()).toBe('# a\nb\n');
  });

  it('answers a matching If-None-Match with 304 and no body', async () => {
    const etag = bucket.objects.get(exportKey('llms.txt'))?.etag ?? '';
    const res = await serveStoredExport(
      get({ 'If-None-Match': etag }),
      'llms.txt',
    );
    expect(res?.status).toBe(304);
    expect(res?.body).toBeNull();
  });

  it('serves only the requested bytes for a Range request', async () => {
    const res = await serveStoredExport(
      get({ Range: 'bytes=0-1000' }),
      'llms-full.txt',
    );
    expect(res?.status).toBe(206);
    expect(res?.headers.get('Content-Range')).toBe(
      `bytes 0-1000/${20 * 1024 * 1024}`,
    );
    expect(res?.headers.get('Content-Length')).toBe('1001');
    expect((await res?.arrayBuffer())?.byteLength).toBe(1001);
  });

  it('answers 416 for a range past the end', async () => {
    const res = await serveStoredExport(
      get({ Range: 'bytes=999999999-' }),
      'llms-full.txt',
    );
    expect(res?.status).toBe(416);
  });

  it('returns null when nothing has been built yet', async () => {
    expect(await serveStoredExport(get(), 'data.json')).toBeNull();
  });
});

describe('resolvedRange', () => {
  it('reads offset, length and suffix ranges as inclusive spans', () => {
    expect(resolvedRange({ offset: 0, length: 10 }, 100)).toEqual({
      start: 0,
      end: 9,
    });
    expect(resolvedRange({ suffix: 5 }, 100)).toEqual({ start: 95, end: 99 });
    expect(resolvedRange({ offset: 90 }, 100)).toEqual({ start: 90, end: 99 });
    // The whole object is not a partial response.
    expect(resolvedRange({ offset: 0, length: 100 }, 100)).toBeNull();
    expect(resolvedRange(undefined, 100)).toBeNull();
  });
});

describe('export build lock', () => {
  it('lets one build in at a time and frees a stale lock', async () => {
    const t = Date.now();
    expect(await acquireExportLock(r2, t)).toBe(true);
    expect(await acquireExportLock(r2, t + 60_000)).toBe(false);
    expect(await acquireExportLock(r2, t + 21 * 60_000)).toBe(true);
    await releaseExportLock(r2);
    expect(await acquireExportLock(r2, t + 22 * 60_000)).toBe(true);
    await releaseExportLock(r2);
  });
});
