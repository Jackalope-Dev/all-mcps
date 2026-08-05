import { getActiveServers } from '@/lib/servers';
import { upsertServerEmbedding } from '@/lib/vectorSearch';

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const secret = process.env.ADMIN_SECRET;

  if (secret && authHeader !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const cfCtx = await getCloudflareContext();
    const env = cfCtx?.env as CloudflareEnv;

    if (!env?.VECTOR_INDEX || !env?.AI) {
      return Response.json(
        { error: 'Vectorize or Workers AI bindings not configured' },
        { status: 503 }
      );
    }

    const servers = await getActiveServers();
    let indexed = 0;
    let failed = 0;

    for (const server of servers) {
      const ok = await upsertServerEmbedding(server, env);
      if (ok) indexed++;
      else failed++;
    }

    return Response.json({
      status: 'ok',
      total: servers.length,
      indexed,
      failed,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return Response.json(
      { error: error?.message || 'Failed to execute vector indexing cron' },
      { status: 500 }
    );
  }
}
