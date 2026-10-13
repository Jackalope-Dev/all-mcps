import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import type { RoleEnv } from '@/lib/cronSchedule';
import { getEnv } from '@/lib/env';
import {
  createLopebaseAdapter,
  d1LopebaseStore,
  lopebaseServices,
} from '@/lib/lopebase';

// Read-only, signed admin adapter for LopeBase (see lib/lopebase.ts). Built per
// request because the signing secret and D1 binding come from the Worker env.
export const dynamic = 'force-dynamic';

// Module scope so cached service checks (Resend) persist between health polls.
const services = lopebaseServices(async () => {
  const { env } = await getCloudflareContext({ async: true });
  return {
    db: env.DB,
    isrCache: env.NEXT_INC_CACHE_R2_BUCKET,
    logos: env.LOGOS,
    vectors: env.VECTOR_INDEX,
    jobs: (env as unknown as RoleEnv).JOBS,
    resendApiKey: await getEnv('RESEND_API_KEY'),
  };
});

export async function GET(req: Request) {
  const ctx = await getCloudflareContext({ async: true });
  const adapter = createLopebaseAdapter({
    secrets: [
      await getEnv('LOPEBASE_SIGNING_SECRET'),
      await getEnv('LOPEBASE_SIGNING_SECRET_PREVIOUS'),
    ],
    store: d1LopebaseStore(drizzle(ctx.env.DB)),
    services,
  });
  return adapter.handle(req);
}
