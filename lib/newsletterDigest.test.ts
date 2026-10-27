import { describe, expect, it } from 'vitest';
import {
  buildDigestBlocks,
  type DigestCandidate,
  displayName,
  factsLine,
  githubRepoKey,
  newListingScore,
  pickDiverse,
  trendingScore,
  withUtm,
} from './newsletterDigest';

function candidate(overrides: Partial<DigestCandidate> = {}): DigestCandidate {
  return {
    id: 'acme-brainscanner',
    name: 'Acme Brainscanner',
    url: 'https://github.com/acme/brainscanner',
    description: 'Scan brains via MCP.',
    category: '🧠 Knowledge & Memory',
    logoUrl: null,
    aiSummary: 'Lets agents read brainscanner.dev scans.',
    aiUseCases: '["Summarize last night\'s scan","Compare two scans"]',
    githubStars: 1200,
    npmDownloads: null,
    isOfficial: false,
    toolsSource: null,
    tools: null,
    pricingModel: 'free',
    authType: 'none',
    installKind: 'stdio',
    listingQuality: 2,
    ...overrides,
  };
}

describe('ranking', () => {
  it('ranks an adopted new listing above an empty one', () => {
    const adopted = candidate({ githubStars: 5000 });
    const empty = candidate({ githubStars: 0, listingQuality: 1.5 });
    expect(newListingScore(adopted)).toBeGreaterThan(newListingScore(empty));
  });

  it('caps misattributed npm downloads so they cannot outrank real stars', () => {
    const inflated = candidate({ githubStars: 5, npmDownloads: 30_000_000 });
    const starred = candidate({ githubStars: 20_000 });
    expect(newListingScore(starred)).toBeGreaterThan(newListingScore(inflated));
  });

  it('ranks trending by this week’s views and upvotes', () => {
    const busy = candidate({ weeklyViews: 12, githubStars: 10 });
    const famous = candidate({ weeklyViews: 3, githubStars: 90_000 });
    expect(trendingScore(busy)).toBeGreaterThan(trendingScore(famous));
    expect(
      trendingScore(candidate({ weeklyViews: 3, weeklyUpvotes: 2 })),
    ).toBeGreaterThan(trendingScore(candidate({ weeklyViews: 8 })));
  });

  it('caps each category and honours exclusions', () => {
    const pool = [
      candidate({ id: 'a', githubStars: 900, category: 'Databases' }),
      candidate({ id: 'b', githubStars: 800, category: 'Databases' }),
      candidate({ id: 'c', githubStars: 700, category: 'Databases' }),
      candidate({ id: 'd', githubStars: 10, category: 'Security' }),
    ];
    expect(pickDiverse(pool, newListingScore, 3).map((c) => c.id)).toEqual([
      'a',
      'b',
      'd',
    ]);
    expect(
      pickDiverse(pool, newListingScore, 3, new Set(['a'])).map((c) => c.id),
    ).toEqual(['b', 'c', 'd']);
  });
});

describe('githubRepoKey', () => {
  it('treats a monorepo sub-package as its repo', () => {
    expect(
      githubRepoKey(
        'https://github.com/Acme/Brainscanner/tree/main/packages/mcp',
      ),
    ).toBe('acme/brainscanner');
    expect(githubRepoKey('https://github.com/acme/brainscanner.git')).toBe(
      'acme/brainscanner',
    );
    expect(githubRepoKey('https://brainscanner.dev')).toBeNull();
  });
});

describe('copy', () => {
  it('splits owner/repo names into a title and byline', () => {
    expect(displayName('acme/brainscanner-mcp')).toEqual({
      title: 'brainscanner-mcp',
      by: 'acme',
    });
    expect(displayName('@acme/brainscanner')).toEqual({
      title: 'brainscanner',
      by: 'acme',
    });
    expect(displayName('Acme Brainscanner')).toEqual({
      title: 'Acme Brainscanner',
      by: null,
    });
  });

  it('builds the facts line', () => {
    expect(
      factsLine(
        candidate({
          githubStars: 36_442,
          installKind: 'remote',
          authType: 'oauth',
          tools: '[{"name":"a"},{"name":"b"}]',
        }),
      ),
    ).toEqual([
      'Knowledge & Memory',
      '★ 36.4k',
      'Free',
      'OAuth',
      'Hosted',
      '2 tools',
    ]);
    // Single-digit star counts are noise, not social proof.
    expect(factsLine(candidate({ githubStars: 3 }))).not.toContain('★ 3');
  });

  it('tags links with the campaign and slot', () => {
    const url = new URL(withUtm('/mcp/acme', 'digest-2026-w44', 'new-2'));
    expect(url.origin + url.pathname).toBe('https://allmcps.com/mcp/acme');
    expect(url.searchParams.get('utm_source')).toBe('newsletter');
    expect(url.searchParams.get('utm_campaign')).toBe('digest-2026-w44');
    expect(url.searchParams.get('utm_content')).toBe('new-2');
  });
});

describe('buildDigestBlocks', () => {
  it('renders pick, sections and blog with tracked, escaped links', () => {
    const blocks = buildDigestBlocks({
      pick: candidate({ id: 'pick', name: 'Acme "Pick" <b>' }),
      newListings: [candidate({ id: 'n1', logoUrl: '/logos/n1' })],
      trending: [candidate({ id: 't1' })],
      blogPost: { slug: 'acme-guide', title: 'Acme guide', excerpt: 'How to.' },
      editorial: {
        intro: 'Hello',
        pickWriteup: 'Have your agent compare two scans.',
        blurbs: { n1: 'Read scans from chat.' },
      },
      campaign: 'digest-2026-w44',
    });
    const html = JSON.stringify(blocks);

    expect(html).toContain('https://allmcps.com/email-header.png');
    expect(html).not.toContain('"type":"logo"');
    expect(html).toContain('utm_content=pick');
    expect(html).toContain('utm_content=new-1');
    expect(html).toContain('utm_content=trending-1');
    expect(html).toContain('utm_content=blog');
    expect(html).toContain('utm_content=browse');
    expect(html).toContain('Have your agent compare two scans.');
    expect(html).toContain('Read scans from chat.');
    expect(html).toContain('Compare two scans');
    // Logos are absolutized for email clients.
    expect(html).toContain('https://allmcps.com/logos/n1');
    // Names are escaped, never injected.
    expect(html).not.toContain('<b>');
    expect(html).toContain('&quot;Pick&quot;');
  });

  it('omits empty sections', () => {
    const blocks = buildDigestBlocks({
      pick: null,
      newListings: [],
      trending: [candidate({ id: 't1' })],
      blogPost: null,
      editorial: { intro: 'Hi', pickWriteup: '', blurbs: {} },
      campaign: 'digest-2026-w44',
    });
    const html = JSON.stringify(blocks);
    expect(html).not.toContain('Pick of the week');
    expect(html).not.toContain('New &amp; notable');
    expect(html).not.toContain('From the blog');
    expect(html).toContain('Trending this week');
  });
});
