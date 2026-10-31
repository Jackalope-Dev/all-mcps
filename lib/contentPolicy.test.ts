import { describe, expect, it } from 'vitest';
import { isAdultContent as scriptVersion } from '../scripts/contentPolicy.mjs';
import { isAdultContent } from './contentPolicy';

/**
 * Each pattern was written against a listing removed on 2026-10-31; the
 * misses are real catalog listings that must stay. Every case also runs
 * through the plain-node copy in scripts/contentPolicy.mjs, which the
 * registry-sync workflow uses.
 */
const ADULT: string[] = [
  'EscortFox: search the directory by city and district',
  'Search adult short-form video: clips, creators and hashtags.',
  'Live cam rooms online now on Stripchat, Chaturbate and more',
  'Chat with adult (18+) AI companions that remember you',
  'Official facts about Acme (18+ AI companions): prices, docs',
  'Search, browse and download comics from Acme (adult comic site)',
  'Where an NSFW AI app can get listed: 273 places',
  'Search rule34.xxx posts by tag',
  'Uncensored image, image-to-video and chat generation for adult apps',
  "Videos and voices from Acme's named and uncensored engines",
  'AI adult image, character and movie generator',
  'https://acme.porn/mcp-server',
];

const NOT_ADULT: string[] = [
  "MCP server for Skolverket's open APIs - Curriculum, School Units, and Adult Education",
  'Search US sex-offender registries and criminal records, with citations',
  'Tabak Acme in Claude: Katalog, Beratung & Warenkorb. Kauf 18+ im Shop.',
  'Every abliterated and uncensored LLM on Hugging Face',
  'Character authoring for persistent fictional adult human identities',
  'Authorized-adult face-shape and symmetry feedback',
  'Governance proxy for MCP servers. 18+ framework integrations',
  'https://github.com/acmexxx1/codex-mcp-tool',
  'Sourced internet slang definitions, including labeled non-graphic adult vocabulary',
];

describe('isAdultContent', () => {
  it.each(ADULT)('flags %s', (text) => {
    expect(isAdultContent(text)).toBe(true);
    expect(scriptVersion(text)).toBe(true);
  });

  it.each(NOT_ADULT)('leaves %s', (text) => {
    expect(isAdultContent(text)).toBe(false);
    expect(scriptVersion(text)).toBe(false);
  });

  it('reads every field it is given and skips empty ones', () => {
    expect(isAdultContent('Acme', null, undefined, 'https://acme.porn')).toBe(
      true,
    );
    expect(isAdultContent('Acme', null, 'https://acme.dev')).toBe(false);
  });
});
