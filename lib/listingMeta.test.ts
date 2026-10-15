import { describe, expect, it } from 'vitest';
import { buildListingMetaDescription } from './listingMeta';

const tool = { name: 't', description: '' };

describe('buildListingMetaDescription', () => {
  it('describes the listing from its own data', () => {
    expect(
      buildListingMetaDescription({
        aiSummary: 'Query Postgres databases in plain English.',
        description: 'raw',
        tools: [tool, tool, tool],
        toolsSource: 'introspected',
        installKind: 'stdio',
        githubStars: 1234,
        vulnScannedAt: new Date(),
        vulnCriticalCount: 0,
        vulnHighCount: 0,
        vulnMediumCount: 0,
        vulnLowCount: 0,
      }),
    ).toBe(
      'Query Postgres databases in plain English. 3 tools verified live, no known vulnerabilities, runs locally, 1.2k GitHub stars.',
    );
  });

  it('never claims a clean scan for unscanned or vulnerable servers', () => {
    expect(
      buildListingMetaDescription({ aiSummary: 'X', vulnScannedAt: null }),
    ).toBe('X.');
    expect(
      buildListingMetaDescription({
        aiSummary: 'X',
        vulnScannedAt: new Date(),
        vulnHighCount: 2,
      }),
    ).toBe('X. 2 high-severity advisories.');
    expect(
      buildListingMetaDescription({
        aiSummary: 'X',
        vulnScannedAt: new Date(),
        vulnLowCount: 1,
      }),
    ).toBe('X.');
  });

  it('does not call README-parsed tools verified', () => {
    expect(
      buildListingMetaDescription({
        aiSummary: 'X',
        tools: [tool],
        toolsSource: 'readme',
        remoteEndpointUrl: 'https://x.dev/mcp',
      }),
    ).toBe('X. 1 tool, remote server.');
  });

  it('drops trailing facts instead of cutting mid-word to stay within 160', () => {
    const desc = buildListingMetaDescription({
      aiSummary: 'a'.repeat(95),
      tools: [tool, tool],
      toolsSource: 'introspected',
      installKind: 'stdio',
      githubStars: 500,
      vulnScannedAt: new Date(),
    });
    expect(desc.length).toBeLessThanOrEqual(160);
    expect(desc.endsWith('.')).toBe(true);
    expect(desc).not.toContain('GitHub stars');
  });

  it('falls back to the raw description when there is no AI summary', () => {
    expect(buildListingMetaDescription({ description: 'Raw text.' })).toBe(
      'Raw text.',
    );
  });
});
