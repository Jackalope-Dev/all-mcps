import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isSafeSubmissionUrl } from '../../../../../lib/urlSafety';
import { getClaimVerificationToken } from '../../../../../lib/verificationTokens';
import { getApexDomain } from '../../../../../lib/dnsProviders';
import { auth } from '../../../../../lib/auth';

/**
 * One-shot: create the AllMCPs verification TXT record via a user-supplied
 * Cloudflare API token. The token is never stored — only used for this request.
 *
 * Token needs: Zone → Zone → Read, Zone → DNS → Edit (scoped to the domain ideally).
 * Docs: https://developers.cloudflare.com/fundamentals/api/get-started/create-token/
 */

const bodySchema = z.object({
  serverId: z.string().min(1),
  websiteUrl: z.string().url(),
  apiToken: z.string().min(20).max(200),
});

type CfListZones = {
  success: boolean;
  errors?: Array<{ message: string }>;
  result?: Array<{ id: string; name: string }>;
};

type CfDnsList = {
  success: boolean;
  result?: Array<{ id: string; type: string; name: string; content: string }>;
};

type CfDnsCreate = {
  success: boolean;
  errors?: Array<{ message: string }>;
  result?: { id: string };
};

export async function POST(req: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
    }

    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request. Check website URL and API token.' }, { status: 400 });
    }

    const { serverId, websiteUrl, apiToken } = parsed.data;
    const token = apiToken.trim();

    if (!isSafeSubmissionUrl(websiteUrl)) {
      return NextResponse.json({ error: 'Website URL must be a public http(s) address.' }, { status: 400 });
    }

    const apex = getApexDomain(websiteUrl);
    if (!apex) {
      return NextResponse.json({ error: 'Could not parse domain from website URL.' }, { status: 400 });
    }

    const content = getClaimVerificationToken(serverId, userId);
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    // 1. Resolve zone for this apex domain
    const zonesRes = await fetch(
      `https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(apex)}&status=active`,
      { headers, signal: AbortSignal.timeout(12000) }
    );
    const zonesJson = (await zonesRes.json()) as CfListZones;

    if (!zonesRes.ok || !zonesJson.success) {
      const msg = zonesJson.errors?.[0]?.message || 'Cloudflare rejected the API token or zone lookup failed.';
      return NextResponse.json(
        {
          error: msg,
          hint: 'Create a token at dash.cloudflare.com/profile/api-tokens with Zone:DNS:Edit and Zone:Zone:Read for this domain.',
        },
        { status: 400 }
      );
    }

    const zone = zonesJson.result?.[0];
    if (!zone) {
      return NextResponse.json(
        {
          error: `No active Cloudflare zone found for ${apex}.`,
          hint: 'Confirm the domain uses Cloudflare nameservers and the token can access that zone.',
        },
        { status: 404 }
      );
    }

    // 2. Skip create if the TXT already exists
    const listRes = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zone.id}/dns_records?type=TXT&per_page=100`,
      { headers, signal: AbortSignal.timeout(12000) }
    );
    const listJson = (await listRes.json()) as CfDnsList;
    const existing = (listJson.result || []).find((r) => {
      const c = r.content.replace(/^"|"$/g, '');
      return c.includes(content) || c === content;
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        alreadyExists: true,
        message: 'Verification TXT record already present in Cloudflare. You can verify now.',
        zone: zone.name,
      });
    }

    // 3. Create TXT on the apex (@)
    const createRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone.id}/dns_records`, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify({
        type: 'TXT',
        name: apex,
        content,
        ttl: 3600,
        comment: 'AllMCPs site verification',
      }),
    });
    const createJson = (await createRes.json()) as CfDnsCreate;

    if (!createRes.ok || !createJson.success) {
      const msg = createJson.errors?.[0]?.message || 'Failed to create DNS record.';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      alreadyExists: false,
      message: `TXT record added on ${zone.name}. DNS may take a minute to propagate — then click Verify.`,
      zone: zone.name,
    });
  } catch (e) {
    console.error('Cloudflare DNS claim helper error:', e instanceof Error ? e.message : 'unknown');
    return NextResponse.json({ error: 'Could not reach Cloudflare. Try again or add the record manually.' }, { status: 500 });
  }
}
