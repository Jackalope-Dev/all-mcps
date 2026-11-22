import { and, eq, inArray, or, type SQL } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/d1';
import { servers, submissionIps, submitterBlocks } from '../db/schema';
import {
  domainAndParents,
  emailDomain,
  emailProblem,
  isSharedMailDomain,
} from './emailDomain';
import { hashVisitorForServer } from './upvoteHash';

type Db = ReturnType<typeof drizzle>;

/** Shown to a blocked submitter. Says no more than it has to. */
export const BLOCKED_SUBMITTER_ERROR =
  "Submissions from this address aren't accepted. If you think this is a mistake, email support@allmcps.com.";

/**
 * The caller's IP from Cloudflare's header (or the first forwarded hop), or
 * null when neither is present, so a missing header never hashes to one
 * shared value that a single block would then catch for everyone.
 */
export function requestIp(req: Request): string | null {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    null
  );
}

/**
 * Salted one-way hash of a submitter IP (same pepper as upvote/report dedup,
 * its own 'submitter' bucket). Stored on the listing or ad so /admin can block
 * the connection without the database ever holding a raw IP.
 */
export function hashSubmitterIp(
  ip: string | null | undefined,
): Promise<string | null> {
  if (!ip || ip === 'unknown') return Promise.resolve(null);
  return hashVisitorForServer(ip, 'submitter');
}

/** True when an admin has blocked this email, its domain, or this IP hash. */
export async function isSubmitterBlocked(
  db: Db,
  who: { email?: string | null; ipHash?: string | null },
): Promise<boolean> {
  const conds: SQL[] = [];
  const email = (who.email ?? '').trim().toLowerCase();
  if (email) {
    conds.push(
      and(
        eq(submitterBlocks.kind, 'email'),
        eq(submitterBlocks.value, email),
      ) as SQL,
    );
    const domains = domainAndParents(emailDomain(email));
    if (domains.length > 0) {
      conds.push(
        and(
          eq(submitterBlocks.kind, 'domain'),
          inArray(submitterBlocks.value, domains),
        ) as SQL,
      );
    }
  }
  if (who.ipHash) {
    conds.push(
      and(
        eq(submitterBlocks.kind, 'ip'),
        eq(submitterBlocks.value, who.ipHash),
      ) as SQL,
    );
  }
  if (conds.length === 0) return false;
  const rows = await db
    .select({ id: submitterBlocks.id })
    .from(submitterBlocks)
    .where(or(...conds))
    .limit(1);
  return rows.length > 0;
}

/**
 * The one gate every public intake runs: a blocked email, domain or IP is
 * refused, then the address has to look deliverable (lib/emailDomain.ts).
 * Returns the error to show, or null to carry on.
 */
export async function screenSubmitter(
  db: Db,
  who: { email: string; ipHash?: string | null },
): Promise<string | null> {
  if (await isSubmitterBlocked(db, who)) return BLOCKED_SUBMITTER_ERROR;
  return emailProblem(who.email);
}

/**
 * Remembers which connection a just-inserted listing came from. Best-effort:
 * the listing is already in, and a lost row only means /admin can block the
 * email but not the IP for this one.
 */
export async function recordSubmissionIp(
  db: Db,
  serverId: string,
  ipHash: string | null,
): Promise<void> {
  if (!ipHash) return;
  await db
    .insert(submissionIps)
    .values({ serverId, ipHash, createdAt: new Date() })
    .onConflictDoNothing()
    .catch((e) => console.error('Failed to record submission IP:', e));
}

/**
 * /admin "Block submitter": blocks the listing's submitter email and IP (and
 * the email's domain unless it is a shared webmail provider, or the admin
 * opts out), then rejects every other pending listing from that email or IP.
 * Quiet on purpose: nobody is emailed. Returns what it did.
 */
export async function blockSubmitter(
  db: Db,
  opts: {
    serverId: string;
    blockDomain: boolean;
    reason: string;
    admin: string;
  },
): Promise<{ blocked: string[]; rejected: number } | { error: string }> {
  const [row] = await db
    .select({
      email: servers.submitterEmail,
      ipHash: submissionIps.ipHash,
    })
    .from(servers)
    .leftJoin(submissionIps, eq(submissionIps.serverId, servers.id))
    .where(eq(servers.id, opts.serverId))
    .limit(1);
  if (!row) return { error: 'Listing not found.' };
  const email = (row.email ?? '').trim().toLowerCase();
  if (!email && !row.ipHash) {
    return {
      error: 'This listing has no submitter email or IP to block (ingested).',
    };
  }

  const entries: { kind: 'email' | 'domain' | 'ip'; value: string }[] = [];
  if (email) entries.push({ kind: 'email', value: email });
  const domain = emailDomain(email);
  if (opts.blockDomain && domain && !isSharedMailDomain(domain)) {
    entries.push({ kind: 'domain', value: domain });
  }
  if (row.ipHash) entries.push({ kind: 'ip', value: row.ipHash });

  const now = new Date();
  await db
    .insert(submitterBlocks)
    .values(
      entries.map((e) => ({
        ...e,
        reason: opts.reason || null,
        sourceId: opts.serverId,
        createdBy: opts.admin,
        createdAt: now,
      })),
    )
    .onConflictDoNothing();

  const match: SQL[] = [];
  if (email) match.push(eq(servers.submitterEmail, email));
  if (row.ipHash) {
    match.push(
      inArray(
        servers.id,
        db
          .select({ id: submissionIps.serverId })
          .from(submissionIps)
          .where(eq(submissionIps.ipHash, row.ipHash)),
      ),
    );
  }
  const rejected = await db
    .update(servers)
    .set({ status: 'rejected' })
    .where(and(eq(servers.status, 'pending'), or(...match)))
    .returning({ id: servers.id });

  return {
    blocked: entries.map((e) =>
      e.kind === 'ip' ? 'ip' : `${e.kind}:${e.value}`,
    ),
    rejected: rejected.length,
  };
}
