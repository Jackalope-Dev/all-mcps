/** DNS host helpers for claim verification UX. */

export function getApexDomain(websiteUrl: string): string | null {
  try {
    const host = new URL(websiteUrl).hostname.toLowerCase();
    if (!host) return null;
    return host.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export type DnsProviderLink = {
  id: string;
  name: string;
  /** Opens the provider's DNS management UI (user still pastes the record). */
  href: string;
  description: string;
  /** Highlight as the primary one-click path when applicable. */
  primary?: boolean;
};

/**
 * Deep links into common DNS consoles.
 * Cloudflare's `?to=/:account/:zone/dns/records` is resolved after login
 * (same pattern Cloudflare docs use for "Go to Records").
 */
export function getDnsProviderLinks(
  apexDomain: string | null,
): DnsProviderLink[] {
  const zoneHint = apexDomain ? encodeURIComponent(apexDomain) : '';

  return [
    {
      id: 'cloudflare',
      name: 'Cloudflare',
      href: 'https://dash.cloudflare.com/?to=/:account/:zone/dns/records',
      description: apexDomain
        ? `Open DNS for your account, pick ${apexDomain}, then Add record`
        : 'Open DNS Records, pick your domain, then Add record',
      primary: true,
    },
    {
      id: 'vercel',
      name: 'Vercel',
      href: apexDomain
        ? `https://vercel.com/domains/${zoneHint}`
        : 'https://vercel.com/dashboard/domains',
      description: 'Domains → select domain → DNS Records',
    },
    {
      id: 'namecheap',
      name: 'Namecheap',
      href: 'https://ap.www.namecheap.com/domains/list/',
      description: 'Domain List → Manage → Advanced DNS',
    },
    {
      id: 'godaddy',
      name: 'GoDaddy',
      href: 'https://dcc.godaddy.com/control/portfolio',
      description: 'My Products → DNS → Add → TXT',
    },
    {
      id: 'route53',
      name: 'AWS Route 53',
      href: 'https://console.aws.amazon.com/route53/v2/hostedzones',
      description: 'Hosted zones → your domain → Create record',
    },
    {
      id: 'google',
      name: 'Squarespace Domains',
      href: 'https://account.squarespace.com/domains',
      description: 'Domain → DNS settings → Add record (TXT)',
    },
  ];
}

export type DnsRecordFields = {
  type: 'TXT';
  /** Display name for forms (`@` for apex). */
  name: string;
  /** Alternate name some panels want (full apex hostname). */
  nameAlt: string;
  content: string;
  ttl: string;
};
