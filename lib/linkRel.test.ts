import { describe, expect, it } from 'vitest';
import {
  MARKDOWN_LINK_REL,
  repoLinkRel,
  supportLinkRel,
  websiteLinkRel,
} from './linkRel';

const tokens = (rel: string) => new Set(rel.split(/\s+/));
const isDofollow = (rel: string) =>
  !['nofollow', 'sponsored', 'ugc'].some((t) => tokens(rel).has(t));

describe('websiteLinkRel', () => {
  it('is dofollow only with a live website backlink (the free badge program)', () => {
    expect(isDofollow(websiteLinkRel(false, true))).toBe(true);
    expect(isDofollow(websiteLinkRel(true, true))).toBe(true);
  });

  it('marks a Premium-only website link sponsored: payment never buys dofollow', () => {
    const rel = websiteLinkRel(true, false);
    expect(tokens(rel).has('sponsored')).toBe(true);
    expect(isDofollow(rel)).toBe(false);
  });

  it('keeps a free listing without the badge nofollow', () => {
    expect(websiteLinkRel(false, false)).toBe('noopener noreferrer nofollow');
  });
});

describe('repoLinkRel', () => {
  it('is dofollow for vendor-official or owner-verified listings', () => {
    expect(isDofollow(repoLinkRel({ isOfficial: true }))).toBe(true);
    expect(isDofollow(repoLinkRel({ ownerVerified: true }))).toBe(true);
  });

  it('is nofollow otherwise, Premium included', () => {
    const premiumOnly = { isPremium: true, isOfficial: false };
    expect(repoLinkRel(premiumOnly)).toBe('noopener noreferrer nofollow');
    expect(repoLinkRel({})).toBe('noopener noreferrer nofollow');
  });
});

describe('supportLinkRel', () => {
  const site = 'https://acme.dev';
  it('follows the website rule on the listing’s own site', () => {
    expect(isDofollow(supportLinkRel(false, true, `${site}/help`, site))).toBe(
      true,
    );
    expect(
      tokens(supportLinkRel(true, false, `${site}/help`, site)).has(
        'sponsored',
      ),
    ).toBe(true);
    expect(supportLinkRel(false, false, `${site}/help`, site)).toBe(
      'noopener noreferrer nofollow',
    );
  });

  it('stays nofollow off the listing’s own site, whatever the listing earned', () => {
    expect(supportLinkRel(true, true, 'https://discord.gg/x', site)).toBe(
      'noopener noreferrer nofollow',
    );
  });
});

describe('MARKDOWN_LINK_REL', () => {
  it('marks README / description links as user content, nofollow', () => {
    expect(tokens(MARKDOWN_LINK_REL).has('ugc')).toBe(true);
    expect(tokens(MARKDOWN_LINK_REL).has('nofollow')).toBe(true);
  });
});
