import { isAdultContent } from './contentPolicy';

/**
 * Listing-level policy checks that hold a listing for a human instead of
 * letting an automation gate (lib/autoDecision.ts) or the 7-day auto-promote
 * fallback publish it.
 *
 * None of these reject on their own. Adult content isn't listed at all
 * (lib/contentPolicy.ts, /terms); the rest are kinds of listing where a
 * working MCP server still isn't enough to publish it unseen. They come from
 * what an admin overrode in the submission gate's shadow run and a review of
 * the 2,539 listings approved Oct 4 – Nov 3 2026: an escort directory, company
 * brochures, single-business lead-gen pages, an SEO backlink farm and a
 * Cloudflare-bypass scraper.
 *
 * Every pattern was backtested against all ~34.6k active and pending listings
 * (2026-11-03) and is matched on the listing's own text only. Tool names and
 * descriptions made the word lists far too noisy: threat-intel servers say
 * "ransomware", sports-data APIs list betting odds, and inference APIs carry
 * an nsfw filter flag. The one exception is the brochure check, which reads
 * tool *names* because that is the only place a brochure shows.
 */

const POLICY_FLAGS = [
  'adult',
  'gambling',
  'malware',
  'evasion',
  'crypto_speculation',
  'lead_gen',
  'brochure',
  'directory',
] as const;
export type PolicyFlag = (typeof POLICY_FLAGS)[number];

export const POLICY_FLAG_LABEL: Record<PolicyFlag, string> = {
  adult: 'adult content (not listed, see /terms)',
  gambling: 'casino or betting tips',
  malware: 'malware or credential-theft wording',
  evasion: 'bot-detection or CAPTCHA evasion',
  crypto_speculation: 'memecoin sniping or pump wording',
  lead_gen: 'lead-gen or SEO page for one business',
  brochure: 'brochure: tools only describe the publisher',
  directory: 'source URL is a directory or curated list',
};

/** Odds and sports-data APIs are fine; casinos and tipster services are held. */
const GAMBLING_RE =
  /\b(casinos?|igaming|online\s+poker|slot\s+machines?|betting\s+(tips|picks)|sportsbook\s+bonus(es)?|place\s+(real[-\s]money\s+)?bets?)\b/i;

/** Wording that sells the attack, not wording that describes defending against it. */
const MALWARE_RE =
  /\b(keyloggers?|(credential|password|cookie|session)\s+(stealers?|grabbers?)|remote\s+access\s+trojans?|phishing\s+kits?|ddos\s+(tools?|for\s+hire)|booter|stresser\s+service)\b/i;

const EVASION_RE =
  /\b(undetectable|anti-?detect(ion)?\s+browsers?|(bypass\w*|solv\w+)\s+(re)?captchas?|captcha\s+(solv\w+|bypass\w*)|(bypass\w*|evad\w+|get\s+past)\s+(the\s+)?(bot\s+detection|cloudflare|anti-?bot|datadome|bans?))\b/i;

/** Rug-check and token-risk tools are fine; sniping and pumping are held. */
const CRYPTO_SPECULATION_RE =
  /\b(pump\s+(and|&)\s+dump|memecoin\s+(snip\w+|launch\w*)|sniper\s+bots?|token\s+sniping|guaranteed\s+(returns|profits?)|100x\s+gems?)\b/i;

/**
 * Single-business lead-gen and SEO pages dressed as servers: a phone number
 * in the description, a referral or quote funnel, a backlink offer, or an
 * unfinished prototype taking payments.
 */
const LEAD_GEN_RE =
  /(\(\d{3}\)\s?\d{3}-\d{4}|\bdo-?follow\s+backlinks?\b|\bfree\s+referral\s+service\b|\b(get|request)\s+a\s+free\s+(quote|callback|estimate)\b|\bpayments?\s+(are\s+)?paused\b|\bunaccepted\s+proposals?\b)/i;

/**
 * Tool names that only describe the publisher itself. A brochure server
 * (AIAgentCycle, Holos33) answers the handshake and passes every text check,
 * but its tools are an "about us" page. "contacts" and "cases" alone are left
 * out: CRMs, case-law and incident-response servers use them legitimately.
 */
const COMPANY_INFO_TOOL_RE =
  /\b((company|business|brand)\s+(profile|overview|info|facts|story)|about(\s+us)?$|^(get\s+)?overview$|contact\s+(info|details|and\s+support)|faqs?$|case\s+stud(y|ies)|testimonials?|team$|official\s+links?)\b/;

/** Splits snake/camel tool names into words so `get_company_profile` matches. */
function toolWords(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_\-.]/g, ' ')
    .toLowerCase()
    .trim();
}

/** At least 3 publisher-only tools, making up 30%+ of the toolset. */
export function isBrochureToolset(toolNames: string[]): boolean {
  const hits = toolNames.filter((n) =>
    COMPANY_INFO_TOOL_RE.test(toolWords(n)),
  ).length;
  return hits >= 3 && hits / toolNames.length >= 0.3;
}

/** Other directories and registries: a listing URL there links to a listing, not a server. */
const DIRECTORY_HOSTS = [
  'allmcps.com',
  'glama.ai',
  'smithery.ai',
  'mcp.so',
  'pulsemcp.com',
  'mcpmarket.com',
  'mcptry.com',
  'mcpservers.org',
  'mcp.directory',
  'cursor.directory',
  'lobehub.com',
];

/**
 * True when the source URL is another directory's page or an awesome-MCP list.
 * Other awesome-* repos are often real servers with an unlucky name
 * (awesome-coolify, awesome-things), so only the MCP-list shapes count.
 */
export function isDirectoryUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  if (DIRECTORY_HOSTS.some((d) => host === d || host.endsWith(`.${d}`)))
    return true;
  if (host !== 'github.com') return false;
  const repo = u.pathname.split('/')[2]?.toLowerCase() ?? '';
  return /^awesome[-_]?mcps?([-_](servers?|registry|list|zh))?$/.test(repo);
}

export type PolicyInput = {
  name: string;
  description: string | null;
  url: string;
  websiteUrl: string | null;
  /** servers.tools JSON (tool definitions from the handshake or README). */
  tools?: string | null;
};

function toolNames(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((t) => (typeof t?.name === 'string' ? t.name : null))
      .filter((n): n is string => Boolean(n));
  } catch {
    return [];
  }
}

/** Every policy flag the listing trips, in POLICY_FLAGS order. Pure. */
export function policyFlags(l: PolicyInput): PolicyFlag[] {
  const text = [l.name, l.description, l.url, l.websiteUrl]
    .filter(Boolean)
    .join(' \n ');
  const flags: PolicyFlag[] = [];
  if (isAdultContent(text)) flags.push('adult');
  if (GAMBLING_RE.test(text)) flags.push('gambling');
  if (MALWARE_RE.test(text)) flags.push('malware');
  if (EVASION_RE.test(text)) flags.push('evasion');
  if (CRYPTO_SPECULATION_RE.test(text)) flags.push('crypto_speculation');
  if (LEAD_GEN_RE.test(text)) flags.push('lead_gen');
  if (isBrochureToolset(toolNames(l.tools))) flags.push('brochure');
  if (isDirectoryUrl(l.url)) flags.push('directory');
  return flags;
}
