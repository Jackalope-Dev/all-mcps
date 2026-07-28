import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { servers } from '../../../db/schema';
import { z } from 'zod';
import { isSafeSubmissionUrl } from '../../../lib/urlSafety';

const submitSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  name: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  websiteUrl: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((v) => (v || '').trim())
    .refine((v) => !v || z.string().url().safeParse(v).success, {
      message: 'Website must be a valid URL',
    }),
});

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as any;
    const token = body['cf-turnstile-response'];

    if (!token) {
      return NextResponse.json({ success: false, error: 'Missing Turnstile token' }, { status: 400 });
    }

    const verifyForm = new URLSearchParams();
    verifyForm.append('secret', process.env.TURNSTILE_SECRET || '');
    verifyForm.append('response', token);
    verifyForm.append('remoteip', req.headers.get('x-forwarded-for') || '');

    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: verifyForm,
    });

    const verifyResult = (await verifyRes.json()) as any;
    if (!verifyResult.success) {
      return NextResponse.json({ success: false, error: 'Turnstile verification failed' }, { status: 403 });
    }

    const result = submitSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues }, { status: 400 });
    }

    const { url } = result.data;
    let websiteUrl = result.data.websiteUrl || '';
    let name = result.data.name || '';
    let description = result.data.description || '';
    let category = result.data.category || 'Community';

    if (!isSafeSubmissionUrl(url)) {
      return NextResponse.json({ error: 'Repository URL must be a public http(s) address.' }, { status: 400 });
    }

    if (websiteUrl && !isSafeSubmissionUrl(websiteUrl)) {
      return NextResponse.json({ error: 'Website URL must be a public http(s) address.' }, { status: 400 });
    }

    const githubMatch = url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (githubMatch) {
      const owner = githubMatch[1];
      let repo = githubMatch[2];
      if (repo.endsWith('.git')) repo = repo.slice(0, -4);

      try {
        const ghRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
          headers: { 'User-Agent': 'AllMCPs-Directory' },
        });
        if (ghRes.ok) {
          const ghData = (await ghRes.json()) as any;
          if (!name) name = ghData.name;
          if (!description && ghData.description) description = ghData.description;
          if (!websiteUrl && ghData.homepage && isSafeSubmissionUrl(ghData.homepage)) {
            websiteUrl = ghData.homepage;
          }
        }
      } catch (e) {
        console.error('GitHub API fetch failed', e);
      }
    }

    if (!name) {
      return NextResponse.json(
        { error: 'Name could not be auto-filled, please provide it manually.' },
        { status: 400 }
      );
    }

    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    let env;
    try {
      const ctx = await getCloudflareContext();
      env = ctx.env;
    } catch (e) {
      throw new Error('Could not get Cloudflare context.');
    }

    if (!env || !env.DB) {
      throw new Error('Database binding not found');
    }

    const db = drizzle(env.DB as any);

    await db
      .insert(servers)
      .values({
        id,
        name,
        url,
        description: description || 'No description provided.',
        category,
        websiteUrl: websiteUrl || null,
        isPremium: false,
        websiteVerified: false,
        isOfficial: false,
        status: 'pending',
        createdAt: new Date(),
      })
      .onConflictDoNothing();

    return NextResponse.json({
      success: true,
      message: 'Server submitted successfully for review!',
      id,
    });
  } catch (error) {
    console.error('Submission error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
