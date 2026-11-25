import { describe, expect, it } from 'vitest';
import {
  buildDigestBlocks,
  type DigestCandidate,
  type DigestEditorial,
  factsLine,
  githubRepoKey,
  isDigestTooThin,
  isDigestTrustworthy,
  listingTitle,
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
    repoCreatedAt: null,
    reviewFlagged: false,
    ...overrides,
  };
}

function editorial(over: Partial<DigestEditorial> = {}): DigestEditorial {
  return {
    headline: 'Scan brains from chat',
    intro: 'Hello',
    pickWriteup: '',
    pickPrompts: [],
    blurbs: {},
    prompts: {},
    ...over,
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
  it('humanizes owner/repo names into a title and byline', () => {
    const t = (name: string, url = 'https://github.com/acme/brainscanner') =>
      listingTitle({ name, url });
    expect(t('acme/brainscanner-mcp')).toEqual({
      title: 'Brainscanner MCP',
      by: 'acme',
    });
    expect(t('@acme/brainscanner')).toEqual({
      title: 'Brainscanner',
      by: 'acme',
    });
    expect(t('Acme Brainscanner')).toEqual({
      title: 'Acme Brainscanner',
      by: null,
    });
  });

  it('names the maker of a bare repo-slug listing', () => {
    expect(
      listingTitle({ name: 'scanner', url: 'https://github.com/acme/scanner' }),
    ).toEqual({ title: 'Scanner', by: 'acme' });
    // The owner is already the brand: no repeat.
    expect(
      listingTitle({
        name: 'brainscanner',
        url: 'https://github.com/brainscanner-dev/brainscanner',
      }),
    ).toEqual({ title: 'Brainscanner', by: null });
    expect(
      listingTitle({
        name: 'brainscanner-ui-mcp',
        url: 'https://brainscanner.dev',
      }).title,
    ).toBe('Brainscanner UI MCP');
  });

  it('never titles a listing just "mcp"', () => {
    // The Nov 23 2026 subject read "Pick of the week: mcp".
    expect(
      listingTitle({ name: '@acme/mcp', url: 'https://github.com/acme/x' }),
    ).toEqual({
      title: 'Acme MCP',
      by: null,
    });
    expect(
      listingTitle({ name: 'mcp', url: 'https://github.com/acme/mcp' }).title,
    ).toBe('Acme MCP');
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
      editorial: editorial({
        pickWriteup: 'Have your agent compare two scans.',
        blurbs: { n1: 'Read scans from chat.' },
        prompts: { n1: 'Summarize my latest scan' },
      }),
      campaign: 'digest-2026-w44',
    });
    const html = JSON.stringify(blocks);

    expect(html).toContain('https://allmcps.com/email-header.png');
    expect(html).not.toContain('"type":"logo"');
    expect(html).toContain('utm_content=pick-button');
    expect(html).toContain('utm_content=new-1');
    expect(html).toContain('utm_content=trending-1');
    expect(html).toContain('utm_content=blog');
    expect(html).toContain('utm_content=browse');
    expect(html).toContain('Have your agent compare two scans.');
    expect(html).toContain('Read scans from chat.');
    expect(html).toContain('Compare two scans');
    expect(html).toContain('Summarize my latest scan');
    expect(html).toContain('Scan brains from chat');
    expect(html).toContain('Hit reply');
    // Cards draw their own rounded box (radius on the <td>), not Sequenzy's square-prone styles.
    expect(html).toContain('border-radius:16px');
    expect(html).not.toContain('"borderRadius"');
    // Logos are absolutized for email clients.
    expect(html).toContain('https://allmcps.com/logos/n1');
    // Names are escaped, never injected.
    expect(html).not.toContain('<b>');
    expect(html).toContain('&quot;Pick&quot;');
  });

  it('puts a full-width-safe cyan setup button directly under the pick card', () => {
    const blocks = buildDigestBlocks({
      pick: candidate({ id: 'acme-pick', name: 'acme/brainscanner' }),
      newListings: [candidate({ id: 'n1' })],
      trending: [],
      blogPost: null,
      editorial: editorial({ pickWriteup: 'Great.' }),
      campaign: 'digest-2026-w47',
    });
    const pickIndex = blocks.findIndex((b) =>
      String(b.content ?? '').includes('Pick of the week'),
    );
    expect(pickIndex).toBeGreaterThan(-1);
    const button = blocks
      .slice(pickIndex + 1, pickIndex + 3)
      .find((b) => b.type === 'button');
    expect(button).toBeDefined();
    expect(button?.text).toBe('Set up Brainscanner →');
    expect(button?.buttonColor).toBe('#00E5FF');
    expect(button?.buttonTextColor).toBe('#020617');
    expect(button?.styles).toEqual({ textAlign: 'center' });
    // No fixed pixel width, so it can't overflow a 375px screen.
    expect(button?.width).toBeUndefined();
    const url = new URL(button?.url);
    expect(url.origin + url.pathname).toBe('https://allmcps.com/mcp/acme-pick');
    expect(url.searchParams.get('utm_campaign')).toBe('digest-2026-w47');
    expect(url.searchParams.get('utm_content')).toBe('pick-button');
    // The pick card itself is kept.
    expect(blocks[pickIndex].content).toContain('Great.');
  });

  it('keeps markup out of the pick button label', () => {
    const blocks = buildDigestBlocks({
      pick: candidate({ id: 'p', name: 'Acme <b>Pick</b>' }),
      newListings: [],
      trending: [],
      blogPost: null,
      editorial: editorial(),
      campaign: 'digest-2026-w47',
    });
    const button = blocks.find(
      (b) => b.type === 'button' && String(b.text).startsWith('Set up'),
    );
    expect(button?.text).not.toMatch(/[<>]/);
  });

  it('omits empty sections', () => {
    const blocks = buildDigestBlocks({
      pick: null,
      newListings: [],
      trending: [candidate({ id: 't1' })],
      blogPost: null,
      editorial: editorial(),
      campaign: 'digest-2026-w44',
    });
    const html = JSON.stringify(blocks);
    expect(html).not.toContain('Pick of the week');
    expect(html).not.toContain('New &amp; notable');
    expect(html).not.toContain('From the blog');
    expect(html).toContain('Trending this week');
  });

  it('prefers written prompts for the pick and falls back to the headline default', () => {
    const blocks = buildDigestBlocks({
      pick: candidate({ id: 'p' }),
      newListings: [],
      trending: [],
      blogPost: null,
      editorial: editorial({
        headline: '',
        pickPrompts: ['Compare my last two scans and flag changes'],
      }),
      campaign: 'digest-2026-w48',
    });
    const html = JSON.stringify(blocks);
    expect(html).toContain('Compare my last two scans and flag changes');
    // Written prompts replace the listing's own use cases.
    expect(html).not.toContain('Summarize last night');
    expect(blocks.find((b) => b.type === 'heading')?.content).toBe(
      'This week on AllMCPs',
    );
  });
});

describe('isDigestTrustworthy', () => {
  const now = new Date('2026-11-23T00:00:00Z');
  it('leaves out bought stars, borrowed repos and flagged listings', () => {
    expect(isDigestTrustworthy(candidate(), now)).toBe(true);
    expect(
      isDigestTrustworthy(
        candidate({
          githubStars: 475_000,
          repoCreatedAt: new Date('2026-04-14T00:00:00Z'),
        }),
        now,
      ),
    ).toBe(false);
    expect(
      isDigestTrustworthy(
        candidate({
          name: 'Brainscanner',
          url: 'https://github.com/bigco/unrelated-framework',
          githubStars: 90_000,
        }),
        now,
      ),
    ).toBe(false);
    expect(isDigestTrustworthy(candidate({ reviewFlagged: true }), now)).toBe(
      false,
    );
  });
});

describe('isDigestTooThin', () => {
  it('skips a week with under three listings and no blog post', () => {
    const one = candidate();
    expect(
      isDigestTooThin({
        pick: one,
        newListings: [one],
        trending: [],
        blogPost: null,
      }),
    ).toBe(true);
    expect(
      isDigestTooThin({
        pick: one,
        newListings: [one],
        trending: [],
        blogPost: { slug: 's', title: 't', excerpt: 'e' },
      }),
    ).toBe(false);
    expect(
      isDigestTooThin({
        pick: one,
        newListings: [one, one],
        trending: [],
        blogPost: null,
      }),
    ).toBe(false);
  });
});

describe('team note', () => {
  const base = {
    pick: null,
    newListings: [candidate({ id: 'n1' })],
    trending: [],
    blogPost: null,
    editorial: editorial(),
    campaign: 'digest-2026-w48',
  };
  const note = {
    title: 'Side project',
    body: 'Something we build.',
    url: 'https://example.dev/',
    linkLabel: 'Try it',
    secondaryUrl: 'https://github.com/acme/side',
    secondaryLabel: 'Star it',
  };

  it('tags the main link for the other site and sits before the reply box', () => {
    const blocks = buildDigestBlocks({ ...base, teamNote: note });
    const index = blocks.findIndex((b) =>
      String(b.content ?? '').includes('https://example.dev/'),
    );
    expect(index).toBeGreaterThan(-1);
    const href = /href="(https:\/\/example\.dev\/[^"]+)"/.exec(
      blocks[index].content,
    )?.[1];
    const url = new URL((href ?? '').replace(/&amp;/g, '&'));
    expect(url.searchParams.get('utm_source')).toBe('allmcps');
    expect(url.searchParams.get('utm_medium')).toBe('newsletter');
    expect(url.searchParams.get('utm_campaign')).toBe('digest-2026-w48');
    expect(blocks[index].content).toContain(
      'href="https://github.com/acme/side"',
    );
    const replyIndex = blocks.findIndex((b) =>
      String(b.content ?? '').includes('Hit reply'),
    );
    expect(index).toBeLessThan(replyIndex);
  });

  it('is left out when set to null', () => {
    const html = JSON.stringify(buildDigestBlocks({ ...base, teamNote: null }));
    expect(html).not.toContain('utm_source=allmcps');
  });
});
