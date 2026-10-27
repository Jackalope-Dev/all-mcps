import { beforeEach, describe, expect, it, vi } from 'vitest';
import serversData from '../data/mcp-servers.json';

// getServerById reads D1 first and falls back to the bundled snapshot. Fake
// the D1 row it gets back.
let d1Rows: Record<string, unknown>[] = [];

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: async () => ({ env: { DB: {} } }),
}));
vi.mock('drizzle-orm/d1', () => ({
  drizzle: () => ({
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => d1Rows }) }),
    }),
  }),
}));

const { getServerById } = await import('./servers');

// An id the snapshot also has, so a fall-through would visibly serve it.
const snapshotId = (serversData as { id: string }[])[0].id;

describe('getServerById and withdrawn listings', () => {
  beforeEach(() => {
    d1Rows = [];
  });

  it('serves an active row', async () => {
    d1Rows = [
      { id: snapshotId, name: 'X', url: 'https://x', status: 'active' },
    ];
    expect((await getServerById(snapshotId))?.id).toBe(snapshotId);
  });

  it('treats a withdrawn row as not found, without falling back to the snapshot', async () => {
    d1Rows = [
      { id: snapshotId, name: 'X', url: 'https://x', status: 'withdrawn' },
    ];
    expect(await getServerById(snapshotId)).toBeUndefined();
  });

  it('still serves a removed row (its page stays up with a banner)', async () => {
    d1Rows = [
      { id: snapshotId, name: 'X', url: 'https://x', status: 'removed' },
    ];
    expect((await getServerById(snapshotId))?.status).toBe('removed');
  });
});
