import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getAuthorizedAdminEmail } from '@/lib/accessAuth';

export async function POST(req: Request) {
  try {
    if (!(await getAuthorizedAdminEmail(req.headers))) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { job } = body as { job?: string };

    const validJobs = ['health', 'ai-content', 'enrich', 'highlight', 'indexnow', 'newsletter-digest'];
    if (!job || !validJobs.includes(job)) {
      return NextResponse.json(
        { error: `Invalid job. Allowed: ${validJobs.join(', ')}` },
        { status: 400 }
      );
    }

    let env: any;
    try {
      const ctx = await getCloudflareContext();
      env = ctx.env;
    } catch {
      // Best-effort context
    }

    const secret = env?.ADMIN_SECRET || process.env.ADMIN_SECRET;
    const origin = new URL(req.url).origin;

    const cronUrl = `${origin}/api/cron/${job}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (secret) {
      headers['Authorization'] = `Bearer ${secret}`;
    }

    const cronRes = await fetch(cronUrl, {
      method: 'GET',
      headers,
    });

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
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
