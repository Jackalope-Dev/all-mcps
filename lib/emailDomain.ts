import { isPlaceholderHost } from './placeholderUrl';

/**
 * Throwaway-inbox services. A submitter who can't be reached never sees the
 * review result, and a throwaway address is how probe and spam runs come in
 * (Nov 2026: the probe account signed up from one). Deliberately short and
 * well known: a missed one still has to pass the MX check, and /admin's
 * "Block submitter" covers the rest by domain.
 */
const DISPOSABLE_DOMAINS = new Set([
  '10minutemail.com',
  '10minutemail.net',
  'burnermail.io',
  'discard.email',
  'dispostable.com',
  'emailfake.com',
  'emailondeck.com',
  'fakeinbox.com',
  'getnada.com',
  'grr.la',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamailblock.com',
  'inboxkitten.com',
  'mail.tm',
  'mailcatch.com',
  'maildrop.cc',
  'mailinator.com',
  'mailnesia.com',
  'mailpoof.com',
  'minuteinbox.com',
  'mintemail.com',
  'moakt.com',
  'mohmal.com',
  'mytemp.email',
  'nada.email',
  'sharklasers.com',
  'spamgourmet.com',
  'temp-mail.io',
  'temp-mail.org',
  'tempmail.com',
  'tempmail.net',
  'tempmailo.com',
  'tempr.email',
  'throwawaymail.com',
  'tmpmail.net',
  'tmpmail.org',
  'trashmail.com',
  'trashmail.de',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
]);

/**
 * Webmail providers: blocking one of these by domain would lock out everyone
 * on it, so /admin's block only ever adds the address itself for these.
 */
const SHARED_MAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'yahoo.com',
  'icloud.com',
  'me.com',
  'proton.me',
  'protonmail.com',
  'aol.com',
  'gmx.com',
  'gmx.de',
  'mail.com',
  'yandex.ru',
  'yandex.com',
  'qq.com',
  '163.com',
  '126.com',
  'naver.com',
  'zoho.com',
  'fastmail.com',
  'hey.com',
]);

export function emailDomain(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase().split('@')[1] ?? '';
}

/** The domain and each parent with at least two labels: a.b.c → a.b.c, b.c. */
export function domainAndParents(domain: string): string[] {
  const labels = domain.split('.').filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i + 2 <= labels.length; i++) out.push(labels.slice(i).join('.'));
  return out;
}

export function isDisposableDomain(domain: string): boolean {
  return domainAndParents(domain).some((d) => DISPOSABLE_DOMAINS.has(d));
}

export function isSharedMailDomain(domain: string): boolean {
  return SHARED_MAIL_DOMAINS.has(domain);
}

type DnsJson = { Status?: number; Answer?: { type: number; data: string }[] };

async function dns(name: string, type: 'MX' | 'A' | 'AAAA'): Promise<DnsJson> {
  const res = await fetch(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
    {
      headers: { accept: 'application/dns-json' },
      signal: AbortSignal.timeout(3000),
    },
  );
  if (!res.ok) throw new Error(`DoH ${res.status}`);
  return (await res.json()) as DnsJson;
}

const NXDOMAIN = 3;
const mailCache = new Map<string, boolean>();

/**
 * Whether the domain can receive mail: an MX record that isn't the RFC 7505
 * null MX ("0 ."), or failing that an A/AAAA record (the implicit MX). Fails
 * open: a DNS timeout or server error never blocks a real submitter.
 */
export async function domainReceivesMail(domain: string): Promise<boolean> {
  const cached = mailCache.get(domain);
  if (cached !== undefined) return cached;
  let ok = true;
  try {
    const mx = await dns(domain, 'MX');
    if (mx.Status === NXDOMAIN) ok = false;
    else if (mx.Status === 0) {
      const records = (mx.Answer ?? []).filter((a) => a.type === 15);
      if (records.length > 0) {
        ok = !records.every((r) => /^\d+\s+\.?$/.test(r.data.trim()));
      } else {
        const [a, aaaa] = await Promise.all([dns(domain, 'A'), dns(domain, 'AAAA')]);
        ok = [a, aaaa].some((r) => (r.Answer ?? []).some((x) => x.type === 1 || x.type === 28));
      }
    }
  } catch {
    return true; // fail open, and don't cache the failure
  }
  if (mailCache.size > 2000) mailCache.clear();
  mailCache.set(domain, ok);
  return ok;
}

/** Shown when the email can't be used for a submission. */
export const UNREACHABLE_EMAIL_ERROR =
  'Use an email address you can receive mail at: disposable inboxes and domains without a mail server are not accepted.';

/**
 * Null when the address looks deliverable, otherwise the error to show.
 * Reserved domains (example.com) fail without a lookup.
 */
export async function emailProblem(email: string): Promise<string | null> {
  const domain = emailDomain(email);
  if (!domain) return UNREACHABLE_EMAIL_ERROR;
  if (isPlaceholderHost(domain)) return UNREACHABLE_EMAIL_ERROR;
  if (isDisposableDomain(domain)) return UNREACHABLE_EMAIL_ERROR;
  if (!(await domainReceivesMail(domain))) return UNREACHABLE_EMAIL_ERROR;
  return null;
}
