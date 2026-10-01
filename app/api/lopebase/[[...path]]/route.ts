import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { getEnv } from '@/lib/env';
import { createLopebaseAdapter, d1LopebaseStore } from '@/lib/lopebase';

// Read-only, signed admin adapter for LopeBase (see lib/lopebase.ts). Built per
// request because the signing secret and D1 binding come from the Worker env.
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const ctx = await getCloudflareContext({ async: true });
  const adapter = createLopebaseAdapter({
    secrets: [
      await getEnv('LOPEBASE_SIGNING_SECRET'),
      await getEnv('LOPEBASE_SIGNING_SECRET_PREVIOUS'),
    ],
    store: d1LopebaseStore(drizzle(ctx.env.DB)),
  });
  return adapter.handle(req);
}
