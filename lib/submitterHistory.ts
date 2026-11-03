import { and, eq, isNotNull } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { moderationDecisions, servers } from '../db/schema';

/**
 * A submitter's track record, shown on each pending submission in /admin so a
 * resubmission or a domain with a run of rejections stands out (one domain
 * once sent 30+ listings that were all rejected).
 *
 * Counted per email and per "domain": the email's domain for a company
 * address, otherwise the listing's site host or GitHub owner, since a free
 * mailbox says nothing about who is behind it. Rejections come from
 * moderation_decisions, so history starts when that table did (2026-11-03).
 */

type Db = DrizzleD1Database<any>;

const FREE_MAIL = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'yahoo.com',
  'icloud.com',
  'me.com',
  'proton.me',
  'protonmail.com',
  'aol.com',
  'gmx.com',
  'gmx.de',
  'mail.ru',
  'yandex.ru',
  'qq.com',
  '163.com',
  '126.com',
]);

/** Code hosts where the owner, not the host, says who published it. */
const CODE_HOSTS = new Set(['github.com', 'gitlab.com', 'bitbucket.org']);

function siteKey(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    if (CODE_HOSTS.has(host)) {
      const owner = u.pathname.split('/')[1]?.toLowerCase();
      return owner ? `${host}/${owner}` : null;
    }
    return host;
  } catch {
    return null;
  }
}

/** The domain a submission is counted under; null when nothing identifies one. */
export function submitterDomain(
  email: string | null | undefined,
  url: string | null | undefined,
  websiteUrl: string | null | undefined,
): string | null {
  const at = email?.trim().toLowerCase().split('@')[1];
  if (at && !FREE_MAIL.has(at)) return at;
  return siteKey(websiteUrl) ?? siteKey(url);
}

export type SubmitterHistory = {
  emailRejected: number;
  emailApproved: number;
  domain: string | null;
  domainRejected: number;
  domainApproved: number;
  /** This submission was rejected before and sent back. */
  resubmitted: boolean;
};

type Listing = {
  id: string;
  submitterEmail: string | null;
  url: string;
  websiteUrl: string | null;
};

export async function getSubmitterHistory(
  db: Db,
  pending: Listing[],
): Promise<Map<string, SubmitterHistory>> {
  const out = new Map<string, SubmitterHistory>();
  const manual = pending.filter((p) => p.submitterEmail);
  if (manual.length === 0) return out;

  const [rejects, approved] = await Promise.all([
    db
      .select({
        serverId: moderationDecisions.serverId,
        snapshot: moderationDecisions.snapshot,
      })
      .from(moderationDecisions)
      .where(eq(moderationDecisions.action, 'reject')),
    db
      .select({
        submitterEmail: servers.submitterEmail,
        url: servers.url,
        websiteUrl: servers.websiteUrl,
      })
      .from(servers)
      .where(
        and(eq(servers.status, 'active'), isNotNull(servers.submitterEmail)),
      ),
  ]);

  const bump = (m: Map<string, number>, k: string | null | undefined) => {
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  };
  const rejEmail = new Map<string, number>();
  const rejDomain = new Map<string, number>();
  const rejectedIds = new Set<string>();
  for (const r of rejects) {
    // A listing rejected twice counts once.
    if (rejectedIds.has(r.serverId)) continue;
    rejectedIds.add(r.serverId);
    let s: {
      submitterEmail?: string | null;
      url?: string;
      websiteUrl?: string | null;
    } = {};
    try {
      s = JSON.parse(r.snapshot);
    } catch {}
    if (!s.submitterEmail) continue;
    bump(rejEmail, s.submitterEmail.toLowerCase());
    bump(rejDomain, submitterDomain(s.submitterEmail, s.url, s.websiteUrl));
  }
  const okEmail = new Map<string, number>();
  const okDomain = new Map<string, number>();
  for (const a of approved) {
    bump(okEmail, a.submitterEmail?.toLowerCase());
    bump(okDomain, submitterDomain(a.submitterEmail, a.url, a.websiteUrl));
  }

  for (const p of manual) {
    const email = (p.submitterEmail as string).toLowerCase();
    const domain = submitterDomain(email, p.url, p.websiteUrl);
    out.set(p.id, {
      emailRejected: rejEmail.get(email) ?? 0,
      emailApproved: okEmail.get(email) ?? 0,
      domain,
      domainRejected: domain ? (rejDomain.get(domain) ?? 0) : 0,
      domainApproved: domain ? (okDomain.get(domain) ?? 0) : 0,
      resubmitted: rejectedIds.has(p.id),
    });
  }
  return out;
}
