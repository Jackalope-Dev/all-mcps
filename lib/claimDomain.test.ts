import { describe, expect, it } from 'vitest';
import { claimWebsiteMatchesListing } from './claimDomain';

describe('claimWebsiteMatchesListing', () => {
  it('rejects an unrelated domain (agentworld regression)', () => {
    // A user verified agentworld.me against a listing for blocksigner.org and
    // was auto-granted ownership of someone else's listing.
    expect(
      claimWebsiteMatchesListing('https://agentworld.me', {
        url: 'https://blocksigner.org',
        websiteUrl: null,
      }),
    ).toBe(false);
  });

  it('accepts the same host or a sub/parent domain of the server URL', () => {
    const listing = { url: 'https://mcp.x1wealth.com', websiteUrl: null };
    expect(claimWebsiteMatchesListing('https://x1wealth.com', listing)).toBe(
      true,
    );
    expect(
      claimWebsiteMatchesListing('https://www.mcp.x1wealth.com/', listing),
    ).toBe(true);
  });

  it("accepts the listing's existing website", () => {
    expect(
      claimWebsiteMatchesListing('https://careclinic.io/careclinic-mcp/', {
        url: 'https://cdn.careclinic.io/mcp/help/index.html',
        websiteUrl: 'https://careclinic.io/',
      }),
    ).toBe(true);
  });

  it('rejects siblings on shared hosting', () => {
    expect(
      claimWebsiteMatchesListing('https://sml-allmcps-verify.onrender.com', {
        url: 'https://ghostkey-mcp.onrender.com/mcp',
        websiteUrl: null,
      }),
    ).toBe(false);
  });

  it('never matches a custom site against a GitHub repo listing', () => {
    expect(
      claimWebsiteMatchesListing('https://agentworld.me', {
        url: 'https://github.com/shawnhvac/agentworld-mcp',
        websiteUrl: null,
      }),
    ).toBe(false);
  });

  it('rejects lookalike suffixes and garbage input', () => {
    const listing = { url: 'https://acme.com', websiteUrl: null };
    expect(claimWebsiteMatchesListing('https://evilacme.com', listing)).toBe(
      false,
    );
    expect(claimWebsiteMatchesListing('not a url', listing)).toBe(false);
  });
});
