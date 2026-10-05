import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextResponse } from 'next/server';
import { getAuthorizedAdminEmail } from '@/lib/adminAuth';

export async function POST(req: Request) {
  try {
    if (!(await getAuthorizedAdminEmail())) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { job } = body as { job?: string };

    const CRON_PATHS: Record<string, string> = {
      health: '/api/cron/health',
      'ai-content': '/api/cron/ai-content',
      enrich: '/api/cron/enrich',
      indexnow: '/api/cron/indexnow',
    };

    const cronPath = typeof job === 'string' ? CRON_PATHS[job] : undefined;
    if (!cronPath) {
      return NextResponse.json(
        {
          error: `Invalid job. Allowed: ${Object.keys(CRON_PATHS).join(', ')}`,
        },
        { status: 400 },
      );
    }

    let env: any;
    try {
      const ctx = await getCloudflareContext();
      env = ctx.env;
    } catch {
      // Best-effort context
    }

    const secret =
      env?.CRON_SECRET ||
      env?.ADMIN_SECRET ||
      process.env.CRON_SECRET ||
      process.env.ADMIN_SECRET;

    const allowedOrigins = new Set([
      'https://allmcps.com',
      'https://www.allmcps.com',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ]);
    const reqOrigin = new URL(req.url).origin;
    const origin = allowedOrigins.has(reqOrigin)
      ? reqOrigin
      : 'https://allmcps.com';

    const cronUrl = new URL(cronPath, origin).toString();
    const cookieHeader = req.headers.get('cookie');
    const authHeader = req.headers.get('authorization');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (cookieHeader) headers.Cookie = cookieHeader;
    if (authHeader) headers.Authorization = authHeader;
    else if (secret) headers.Authorization = `Bearer ${secret}`;

    // On the split deployment the jobs Worker owns /api/cron/* — call it over
    // the JOBS service binding rather than looping back through the site.
    const jobs = env?.JOBS as Fetcher | undefined;
    const cronReq = new Request(cronUrl, { method: 'POST', headers });
    const cronRes = jobs ? await jobs.fetch(cronReq) : await fetch(cronReq);

    let cronData = {};
    try {
      cronData = await cronRes.json();
    } catch {
      cronData = { statusText: cronRes.statusText };
    }

    return NextResponse.json({
      success: cronRes.ok,
      job,
      statusCode: cronRes.status,
      result: cronData,
    });
  } catch (error: any) {
    console.error('Admin cron error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 },
    );
  }
}
