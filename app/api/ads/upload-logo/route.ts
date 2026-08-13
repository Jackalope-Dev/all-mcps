import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { processLogoUpload, LogoValidationError } from '@/lib/logoImage';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No image file provided.' }, { status: 400 });
    }

    let env: any;
    try {
      const ctx = await getCloudflareContext();
      env = ctx.env;
    } catch {
      return NextResponse.json({ error: 'Storage unavailable' }, { status: 500 });
    }

    if (!env?.LOGOS) {
      return NextResponse.json({ error: 'Storage unavailable' }, { status: 500 });
    }

    let processed: Uint8Array;
    try {
      processed = await processLogoUpload(await file.arrayBuffer());
    } catch (err) {
      if (err instanceof LogoValidationError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }

    const id = `ad_${crypto.randomUUID().replace(/-/g, '')}`;
    const storageKey = `sponsor-ads/${id}.png`;

    await env.LOGOS.put(storageKey, processed, {
      httpMetadata: { contentType: 'image/png' },
    });

    const logoUrl = `/api/ads/logo/${id}`;

    return NextResponse.json({
      success: true,
      logoUrl,
    });
  } catch (error: any) {
    console.error('Sponsor logo upload error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to upload logo image.' },
      { status: 500 }
    );
  }
}
