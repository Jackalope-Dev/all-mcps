import { describe, expect, it } from 'vitest';
import {
  auditListingPageRel,
  comparableUrl,
  relQualifiers,
  websiteLinkRelsInHtml,
} from './listingRelAudit';

const WEBSITE = 'https://querysail.com/google-search-console';
const SUPPORT = 'https://querysail.com/support';

/** Mirrors the markup the listing page rendered for querysail in 2026-10. */
function page(websiteRel: string, supportRel = websiteRel): string {
  const utm =
    'utm_source=allmcps&amp;utm_medium=directory&amp;utm_campaign=website_button&amp;utm_content=querysail-google-search-console-mcp';
  return [
    `<a href="${WEBSITE}?${utm}" target="_blank" rel="${websiteRel}" class="mcp-action-btn mcp-action-btn--accent">`,
    `<a href="${SUPPORT}?${utm}" target="_blank" rel="${supportRel}" class="mcp-action-btn">`,
    '<a href="https://example.com/readme-link?utm_campaign=listing-readme" rel="nofollow">',
    '<a href="/mcp/querysail-google-search-console-mcp/alternatives" rel="nofollow">',
  ].join('\n');
}

describe('comparableUrl', () => {
  it('drops utm params, fragment and trailing slash but keeps other query params', () => {
    expect(comparableUrl('https://a.com/x/?utm_source=s&ref=1#top')).toBe(
      'https://a.com/x?ref=1',
    );
    expect(comparableUrl('https://a.com/')).toBe('https://a.com');
    expect(comparableUrl('not a url')).toBeNull();
  });
});

describe('relQualifiers', () => {
  it('keeps only nofollow / sponsored / ugc, in a fixed order', () => {
    expect(relQualifiers('noopener noreferrer')).toBe('');
    expect(relQualifiers('Sponsored noopener NOFOLLOW')).toBe(
      'nofollow sponsored',
    );
    expect(relQualifiers('ugc nofollow')).toBe('nofollow ugc');
  });
});

describe('websiteLinkRelsInHtml', () => {
  it('finds only website-button anchors pointing at the website', () => {
    expect(websiteLinkRelsInHtml(page('noopener noreferrer'), WEBSITE)).toEqual(
      ['noopener noreferrer'],
    );
    expect(websiteLinkRelsInHtml(page('x'), 'https://elsewhere.com')).toEqual(
      [],
    );
  });
});

describe('auditListingPageRel', () => {
  const verified = {
    websiteUrl: WEBSITE,
    isPremium: false,
    websiteBacklinkOk: true,
  };

  it('flags a verified listing still served with nofollow (the querysail case)', () => {
    const result = auditListingPageRel(
      page('noopener noreferrer nofollow'),
      verified,
    );
    expect(result).toEqual({
      ok: false,
      reason: 'rel-mismatch',
      rels: ['noopener noreferrer nofollow'],
    });
  });

  it('passes once the served page is dofollow', () => {
    expect(auditListingPageRel(page('noopener noreferrer'), verified)).toEqual({
      ok: true,
    });
    expect(
      auditListingPageRel(page('noopener noreferrer'), {
        ...verified,
        isPremium: true,
      }),
    ).toEqual({ ok: true });
  });

  it('expects sponsored, not dofollow, for a Premium listing without the badge', () => {
    const premiumOnly = {
      ...verified,
      isPremium: true,
      websiteBacklinkOk: false,
    };
    expect(
      auditListingPageRel(page('noopener noreferrer'), premiumOnly),
    ).toEqual({
      ok: false,
      reason: 'rel-mismatch',
      rels: ['noopener noreferrer'],
    });
    expect(
      auditListingPageRel(page('noopener noreferrer nofollow'), premiumOnly).ok,
    ).toBe(false);
    expect(
      auditListingPageRel(page('noopener noreferrer sponsored'), premiumOnly),
    ).toEqual({ ok: true });
  });

  it('flags a listing that lost its badge but still serves dofollow', () => {
    const result = auditListingPageRel(page('noopener noreferrer'), {
      ...verified,
      websiteBacklinkOk: false,
    });
    expect(result.ok).toBe(false);
  });

  it('ignores the support link, which can legitimately stay nofollow', () => {
    expect(
      auditListingPageRel(
        page('noopener noreferrer', 'noopener noreferrer nofollow'),
        verified,
      ),
    ).toEqual({ ok: true });
  });

  it('reports a missing website link rather than passing silently', () => {
    expect(auditListingPageRel('<html></html>', verified)).toEqual({
      ok: false,
      reason: 'link-missing',
      rels: [],
    });
  });
});
