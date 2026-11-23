import { describe, expect, it } from 'vitest';
import { parseServerName } from './displayName';
import {
  hostBrandLabel,
  isGenericListingName,
  isGenericServerName,
  ownerBrandSlug,
} from './genericName';
import { deriveServerName, readmeTitleNamesProject } from './listingEnrich';

describe('isGenericListingName', () => {
  it('flags an owner/repo id whose repo part is only a label', () => {
    expect(isGenericListingName('acme/mcp')).toBe(true);
    expect(isGenericListingName('@acme/mcp-server')).toBe(true);
    expect(isGenericListingName('acme/cli')).toBe(true);
    expect(isGenericListingName('mcp')).toBe(true);
    expect(isGenericListingName('mcp-gateway')).toBe(true);
    expect(isGenericListingName('')).toBe(true);
  });

  it('keeps names that describe the product', () => {
    expect(isGenericListingName('acme/brainscanner')).toBe(false);
    expect(isGenericListingName('acme/mcp-cli')).toBe(false);
    expect(isGenericListingName('agent-memory')).toBe(false);
    expect(isGenericListingName('Brainscanner')).toBe(false);
  });

  it('never treats a non-Latin name as a label', () => {
    expect(isGenericListingName('나라장터 입찰공고')).toBe(false);
    expect(isGenericServerName('ИИПодпись')).toBe(false);
  });
});

describe('ownerBrandSlug and hostBrandLabel', () => {
  it('drops domain-style owner suffixes', () => {
    expect(ownerBrandSlug('@acme-io')).toBe('acme');
    expect(ownerBrandSlug('brainscanner-dev')).toBe('brainscanner');
    expect(ownerBrandSlug('acme-labs')).toBe('acme-labs');
  });

  it('finds the brand in a host', () => {
    expect(hostBrandLabel('https://www.brainscanner.dev/mcp')).toBe(
      'brainscanner',
    );
    expect(hostBrandLabel('https://shop.acme.com.br')).toBe('acme');
    expect(hostBrandLabel('https://scanner.someone.workers.dev')).toBe(
      'scanner',
    );
    expect(hostBrandLabel('not a url')).toBeNull();
  });
});

describe('parseServerName', () => {
  it('folds the owner into a label-only repo name', () => {
    expect(parseServerName('acme/mcp').displayName).toBe('Acme MCP');
    expect(parseServerName('@acme-io/mcp-server').displayName).toBe('Acme MCP');
    expect(parseServerName('acme/cli').displayName).toBe('Acme CLI');
    expect(parseServerName('acme/brainscanner-mcp').displayName).toBe(
      'Brainscanner MCP',
    );
  });

  it('recovers a bare label from the URL', () => {
    expect(
      parseServerName('mcp', 'https://github.com/acme/mcp').displayName,
    ).toBe('Acme MCP');
    expect(
      parseServerName('mcp', 'https://www.brainscanner.dev/mcp').displayName,
    ).toBe('Brainscanner MCP');
    expect(parseServerName('mcp').displayName).toBe('MCP');
  });
});

describe('deriveServerName', () => {
  it('uses a README title only when it names the project', () => {
    expect(
      deriveServerName({
        currentName: 'acme/mcp',
        url: 'https://github.com/acme/mcp',
        ghRepo: { owner: 'acme', repo: 'mcp' },
        readme: '# Acme Brainscanner — Scans For Agents\n',
      }),
    ).toBe('Acme Brainscanner MCP');
    // A section heading is not a title.
    expect(
      deriveServerName({
        currentName: 'acme/mcp',
        url: 'https://github.com/acme/mcp',
        ghRepo: { owner: 'acme', repo: 'mcp' },
        readme: '## Add To MCP Clients\n',
      }),
    ).toBe('Acme MCP');
    expect(
      readmeTitleNamesProject('Configure Claude Desktop', ['acme', 'mcp']),
    ).toBe(false);
  });

  it('prefers the package scope over a monorepo folder repo', () => {
    expect(
      deriveServerName({
        currentName: '@acme/mcp-server',
        url: 'https://github.com/acme/public/tree/main/mcp-server',
        ghRepo: { owner: 'acme', repo: 'public' },
      }),
    ).toBe('Acme MCP');
  });

  it('keeps a meaningful label word after the brand', () => {
    expect(
      deriveServerName({
        currentName: 'mcp-gateway',
        url: 'https://github.com/acme/mcp-gateway',
        ghRepo: { owner: 'acme', repo: 'mcp-gateway' },
      }),
    ).toBe('Acme Gateway MCP');
    expect(
      deriveServerName({
        currentName: 'mcp',
        url: 'https://www.brainscanner.dev/mcp',
      }),
    ).toBe('Brainscanner MCP');
  });

  it('leaves real names alone', () => {
    expect(
      deriveServerName({
        currentName: 'acme/brainscanner',
        url: 'https://github.com/acme/brainscanner',
      }),
    ).toBeNull();
  });
});
