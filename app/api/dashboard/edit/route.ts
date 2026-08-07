import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { servers } from '@/db/schema';
import { auth } from '@/lib/auth';
import { diffEditableFields, serializePendingRevision, type EditableServerFields } from '@/lib/pendingRevision';
import { isSafeSubmissionUrl } from '@/lib/urlSafety';
import { sendNotificationEmail } from '@/lib/notify';
import { getAppUrl } from '@/lib/stripe';
import {
  AUTH_TYPES,
  MAINTENANCE_STATUSES,
  PRICING_MODELS,
  normalizeCompatibleClients,
  normalizeTags,
  TAG_LIMITS,
} from '@/lib/serverEnums';
import { parseStringArray } from '@/lib/aiContent';

const optionalEnum = <T extends string>(values: readonly T[]) =>
  z
    .string()
    .optional()
    .nullable()
    .transform((v) => {
      if (v == null || v === '') return '';
      return (values as readonly string[]).includes(v) ? v : '';
    });

const editSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  category: z.string().min(1).max(100),
  websiteUrl: z.string().url().optional().or(z.literal('')),
  tags: z.array(z.string()).max(TAG_LIMITS.maxTags).optional(),
  pricingModel: optionalEnum(PRICING_MODELS),
  pricingNotes: z.string().max(280).optional().or(z.literal('')),
  authType: optionalEnum(AUTH_TYPES),
  license: z.string().max(60).optional().or(z.literal('')),
  compatibleClients: z.array(z.string()).optional(),
  maintenanceStatus: optionalEnum(MAINTENANCE_STATUSES),
  supportUrl: z.string().url().optional().or(z.literal('')).or(z.null()),
  suggestedInstallCommand: z.string().max(80).optional().or(z.literal('')),
  suggestedInstallArgs: z.array(z.string()).max(20).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
    }

    const parsed = editSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const data = parsed.data;
    const id = data.id;
    const websiteUrl = (data.websiteUrl || '').trim();
    if (websiteUrl && !isSafeSubmissionUrl(websiteUrl)) {
      return NextResponse.json({ error: 'Website URL must be a public http(s) address.' }, { status: 400 });
    }
    const supportUrl = (data.supportUrl || '').trim();
    if (supportUrl && !isSafeSubmissionUrl(supportUrl)) {
      return NextResponse.json({ error: 'Support URL must be a public http(s) address.' }, { status: 400 });
    }

    let env: any;
    try {
      const ctx = await getCloudflareContext();
      env = ctx.env;
    } catch {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });
    }
    if (!env?.DB) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });
    }

    const db = drizzle(env.DB as any);
    const rows = await db.select().from(servers).where(eq(servers.id, id)).limit(1);
    const server = rows[0];
    if (!server) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }
    if (server.ownerUserId !== userId) {
      return NextResponse.json({ error: 'You do not own this listing.' }, { status: 403 });
    }

    const tags = normalizeTags(data.tags ?? []);
    const compatibleClients = normalizeCompatibleClients(data.compatibleClients ?? []);
    const suggestedInstallArgs = Array.isArray(data.suggestedInstallArgs)
      ? data.suggestedInstallArgs.map(String).map((s) => s.trim()).filter(Boolean)
      : [];

    const submitted: EditableServerFields = {
      name: data.name,
      description: data.description,
      category: data.category,
      websiteUrl,
      tags,
      pricingModel: data.pricingModel || '',
      pricingNotes: (data.pricingNotes || '').trim(),
      authType: data.authType || '',
      license: (data.license || '').trim(),
      compatibleClients,
      maintenanceStatus: data.maintenanceStatus || '',
      supportUrl,
      suggestedInstallCommand: (data.suggestedInstallCommand || '').trim(),
      suggestedInstallArgs,
    };

    const current: EditableServerFields = {
      name: server.name,
      description: server.description,
      category: server.category,
      websiteUrl: server.websiteUrl || '',
      tags: parseStringArray(server.tags),
      pricingModel: server.pricingModel || '',
      pricingNotes: server.pricingNotes || '',
      authType: server.authType || '',
      license: server.license || '',
      compatibleClients: parseStringArray(server.compatibleClients),
      maintenanceStatus: server.maintenanceStatus || '',
      supportUrl: server.supportUrl || '',
      suggestedInstallCommand: server.suggestedInstallCommand || '',
      suggestedInstallArgs: parseStringArray(server.suggestedInstallArgs),
    };

    const diff = diffEditableFields(current, submitted);

    if (Object.keys(diff).length === 0) {
      return NextResponse.json({ error: 'No changes to submit.' }, { status: 400 });
    }

    await db
      .update(servers)
      .set({ pendingRevision: serializePendingRevision(diff) })
      .where(eq(servers.id, id));

    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      await sendNotificationEmail({
        to: adminEmail,
        heading: 'New pending edit',
        message: `${server.name} has a pending edit awaiting review.`,
        actionText: 'Review in admin',
        actionUrl: `${getAppUrl()}/admin`,
      });
    }

    return NextResponse.json({ success: true, message: 'Edit submitted for review.' });
  } catch (error) {
    console.error('Dashboard edit error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
