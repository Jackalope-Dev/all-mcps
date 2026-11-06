import { describe, expect, it } from 'vitest';
import {
  isBrochureToolset,
  isDirectoryUrl,
  type PolicyFlag,
  policyFlags,
} from './listingPolicy';

const listing = (description: string, extra = {}) => ({
  name: 'Acme',
  description,
  url: 'https://github.com/acme/acme-mcp',
  websiteUrl: null,
  ...extra,
});

const tools = (...names: string[]) =>
  JSON.stringify(names.map((name) => ({ name, description: '' })));

/**
 * Hits are (paraphrased) real listings; misses are real listings that must
 * stay out, mostly from the 2026-11-03 backtest over every live listing.
 */
const HITS: [PolicyFlag, string][] = [
  ['adult', 'EscortFox: search the directory by city and district'],
  ['gambling', 'Provably fair on-chain slot machine for AI agents'],
  ['gambling', 'Public read-only football and cricket betting tips'],
  ['gambling', 'Real-money crypto casino audits and rankings'],
  ['malware', 'Browser cookie stealer and keylogger for red teams'],
  ['evasion', 'Stealth web scraper bypassing Cloudflare anti-bot'],
  ['evasion', 'Solve reCAPTCHA v2/v3 and Turnstile from AI agents'],
  ['evasion', 'Undetectable browser automation for LLM agents'],
  ['crypto_speculation', 'Memecoin sniper bot for new Solana launches'],
  ['lead_gen', 'Get a plumber now: call/text (610) 362-5950'],
  [
    'lead_gen',
    'List products and get an indexed page with a dofollow backlink',
  ],
  ['lead_gen', 'Prototype preview: payments are paused while we test'],
];

const MISSES: string[] = [
  'Unified threat intel: ransomware leak sites, botnet C&C, infostealers',
  'Live sports betting odds from 265+ bookmakers',
  'Solana token risk scoring and rug detection',
  'Stock market trading signals and regime detection',
  'Web content extraction for AI agents, robots-respecting',
  'Search Canadian case law and legislation via CanLII',
  'Manage contacts and groups in your CRM',
];

describe('policyFlags', () => {
  it.each(HITS)('flags %s: %s', (flag, text) => {
    expect(policyFlags(listing(text))).toContain(flag);
  });

  it.each(MISSES)('leaves %s', (text) => {
    expect(policyFlags(listing(text))).toEqual([]);
  });

  it('reads only listing text, not tool descriptions', () => {
    // Threat-intel and inference tools describe ransomware or nsfw filters.
    const t = JSON.stringify([
      {
        name: 'lookup',
        description: 'Search ransomware and nsfw keylogger feeds',
      },
    ]);
    expect(policyFlags(listing('Threat intel lookup', { tools: t }))).toEqual(
      [],
    );
  });

  it('flags a brochure from tool names', () => {
    const t = tools(
      'get_company_profile',
      'list_services',
      'get_faq',
      'get_contact_info',
      'list_cases',
      'search_knowledge_base',
      'list_documents',
      'get_document',
      'list_integrations',
      'get_service',
    );
    expect(policyFlags(listing('Facts about Acme', { tools: t }))).toEqual([
      'brochure',
    ]);
  });
});

describe('isBrochureToolset', () => {
  it('needs three publisher-only tools', () => {
    expect(
      isBrochureToolset([
        'get_company_overview',
        'list_case_studies',
        'get_case_study',
        'get_network_stats',
      ]),
    ).toBe(true);
    expect(isBrochureToolset(['get_faq', 'get_contact_info'])).toBe(false);
  });

  it('flags a company site served as a knowledge base', () => {
    expect(
      isBrochureToolset([
        'get_overview',
        'list_modules',
        'get_module',
        'search_content',
        'get_article',
        'get_page',
        'get_faq',
        'get_access_and_pricing',
        'get_privacy_and_data',
        'get_partner_info',
        'get_contact_and_links',
      ]),
    ).toBe(true);
  });

  it('leaves pricing and partner-data APIs', () => {
    expect(
      isBrochureToolset([
        'get_pricing',
        'get_partner_orders',
        'list_partners',
        'get_partner_balance',
      ]),
    ).toBe(false);
  });

  it('leaves analytics tools that happen to say overview', () => {
    expect(
      isBrochureToolset([
        'domain_overview',
        'keyword_overview',
        'backlinks_overview',
        'organic_competitors',
      ]),
    ).toBe(false);
  });

  it('leaves CRMs and case-law servers', () => {
    expect(
      isBrochureToolset(['list_contacts', 'get_contact', 'search_cases']),
    ).toBe(false);
  });
});

describe('isDirectoryUrl', () => {
  it.each([
    'https://glama.ai/mcp/servers/acme',
    'https://smithery.ai/server/@acme/acme',
    'https://www.pulsemcp.com/servers/acme',
    'https://allmcps.com/mcp/acme',
    'https://github.com/someone/awesome-mcp-servers',
    'https://github.com/someone/Awesome-MCP-ZH',
  ])('flags %s', (url) => {
    expect(isDirectoryUrl(url)).toBe(true);
  });

  it.each([
    'https://github.com/acme/awesome-coolify',
    'https://github.com/acme/awesome-things',
    'https://github.com/acme/awesome-mineflayer-mcp',
    'https://github.com/acme/acme-mcp',
    'not a url',
    null,
  ])('leaves %s', (url) => {
    expect(isDirectoryUrl(url)).toBe(false);
  });
});
