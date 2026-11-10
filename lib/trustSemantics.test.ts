import { describe, expect, it } from 'vitest';
import {
  isOperatorListing,
  isReferenceServer,
  isVerifiedListing,
  productBrand,
  trustLabel,
} from './featuredStatus';
import { computeQualityScore } from './qualityScore';
import {
  formatServerAsMarkdown,
  relatedRankingScore,
  type Server,
} from './servers';

/**
 * Owner-verified (an approved claim), vendor-official (admin-set with
 * evidence) and paid (Premium / Featured) are three separate things. Paying
 * must never show up as verification, score or organic rank.
 */

function server(overrides: Partial<Server> = {}): Server {
  return {
    id: 'demo',
    name: 'acme/demo-mcp',
    url: 'https://github.com/acme/demo-mcp',
    description: 'A demo MCP server.',
    category: '💻 Developer Tools',
    isOfficial: false,
    status: 'active',
    createdAt: '2026-01-01',
    ...overrides,
  };
}

const trustPoints = (s: Server) =>
  computeQualityScore(s).components.find((c) => c.key === 'trust')?.earned;

describe('trust labels', () => {
  it('Verified = owner-verified or official, never Premium', () => {
    expect(isVerifiedListing({ ownerVerified: true })).toBe(true);
    expect(isVerifiedListing({ isOfficial: true })).toBe(true);
    expect(isVerifiedListing(server({ isPremium: true }))).toBe(false);
    expect(
      isVerifiedListing(
        server({ isPremium: true, featuredUntil: '2999-01-01' }),
      ),
    ).toBe(false);
  });

  it('labels a claim "Verified owner", not Official', () => {
    expect(trustLabel({ ownerVerified: true })?.label).toBe('Verified owner');
    expect(trustLabel({ ownerVerified: true, isOfficial: false })?.kind).toBe(
      'owner',
    );
  });

  it('labels vendor-published servers Official, naming the product', () => {
    const t = trustLabel(
      { isOfficial: true, officialSource: 'github-org' },
      'Acme',
    );
    expect(t?.label).toBe('Official');
    expect(t?.title).toBe('Published by the company behind Acme');
    // Official outranks the owner claim when both hold.
    expect(trustLabel({ isOfficial: true, ownerVerified: true })?.label).toBe(
      'Official',
    );
  });

  it('names the product, not the listing, in the Official tooltip', () => {
    const official = { isOfficial: true, officialSource: 'vendor-endpoint' };
    expect(trustLabel(official, 'Slack MCP')?.title).toBe(
      'Published by the company behind Slack',
    );
    expect(trustLabel(official, 'GitHub MCP Server')?.title).toBe(
      'Published by the company behind GitHub',
    );
    expect(trustLabel(official, 'MCP Server for Notion')?.title).toBe(
      'Published by the company behind Notion',
    );
    // Nothing brand-like left: name no one rather than repeat the listing.
    expect(trustLabel(official, 'MCP Server')?.title).toBe(
      'Published by the vendor',
    );
    expect(trustLabel(official)?.title).toBe('Published by the vendor');
    expect(productBrand('Pinecone Assistant MCP')).toBe('Pinecone Assistant');
    expect(productBrand('stripe-mcp')).toBe('stripe');
  });

  it('labels modelcontextprotocol reference servers Reference', () => {
    const ref = { isOfficial: true, officialSource: 'reference' };
    expect(isReferenceServer(ref)).toBe(true);
    expect(trustLabel(ref)?.label).toBe('Reference');
    expect(isReferenceServer({ officialSource: 'reference' })).toBe(false);
  });

  it('gives paid and unclaimed listings no trust label', () => {
    expect(trustLabel(server({ isPremium: true }))).toBeNull();
    expect(trustLabel(server())).toBeNull();
  });

  it("recognises AllMCPs' own listings by the operator's GitHub org", () => {
    expect(
      isOperatorListing({
        url: 'https://github.com/Jackalope-Dev/allmcps-server',
      }),
    ).toBe(true);
    expect(isOperatorListing({ url: 'https://github.com/acme/x' })).toBe(false);
    expect(isOperatorListing({ url: null })).toBe(false);
  });
});

describe('payment and the quality score', () => {
  it('Premium earns no trust points', () => {
    expect(trustPoints(server({ isPremium: true }))).toBe(
      trustPoints(server()),
    );
  });

  it('Premium leaves the whole score unchanged', () => {
    expect(computeQualityScore(server({ isPremium: true })).score).toBe(
      computeQualityScore(server()).score,
    );
  });

  it('owner-verified and official listings still earn full trust credit', () => {
    expect(trustPoints(server({ ownerVerified: true }))).toBe(20);
    expect(
      trustPoints(server({ isOfficial: true, officialSource: 'vendor-docs' })),
    ).toBe(20);
  });

  it('Official no longer grants free availability points', () => {
    const health = (s: Server) =>
      computeQualityScore(s).components.find((c) => c.key === 'health');
    expect(health(server({ isOfficial: true }))?.earned).toBe(
      health(server())?.earned,
    );
  });
});

describe('payment and organic ranking', () => {
  it('Premium gets no related-ranking boost', () => {
    expect(relatedRankingScore(server({ isPremium: true }))).toBe(
      relatedRankingScore(server()),
    );
  });

  it('verified listings keep their boost', () => {
    expect(relatedRankingScore(server({ ownerVerified: true }))).toBe(
      relatedRankingScore(server()) + 5,
    );
  });
});

describe('agent markdown', () => {
  it('never marks a Premium-only listing [Verified]', () => {
    const md = formatServerAsMarkdown(server({ isPremium: true }));
    expect(md.split('\n')[0]).toBe('# acme/demo-mcp');
  });

  it('shows the real trust label', () => {
    expect(
      formatServerAsMarkdown(server({ ownerVerified: true })).split('\n')[0],
    ).toBe('# acme/demo-mcp [Verified owner]');
    expect(
      formatServerAsMarkdown(
        server({ isOfficial: true, officialSource: 'reference' }),
      ).split('\n')[0],
    ).toBe('# acme/demo-mcp [Reference]');
  });
});
