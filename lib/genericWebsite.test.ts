import { describe, expect, it } from 'vitest';
import { isGenericWebsite } from './genericWebsite';

const REPO = 'https://github.com/acme/brainscanner-mcp';

describe('isGenericWebsite', () => {
  it.each([
    'https://modelcontextprotocol.io/',
    'https://modelcontextprotocol.io/introduction',
    'https://registry.modelcontextprotocol.io/?q=io.github.acme%2Fbrainscanner',
    'https://nodejs.org',
    'https://www.python.org/downloads/',
    'https://claude.ai/',
    'https://opensource.org/licenses/MIT',
    'https://www.typescriptlang.org',
    'https://cursor.com',
    'https://code.visualstudio.com/docs/copilot/chat/mcp-servers',
    'https://www.docker.com/products/docker-desktop/',
    'https://cloud.google.com/bigquery',
    'https://mcp.so/server/brainscanner/acme',
  ])('flags %s as a README link, not the product site', (url) => {
    expect(isGenericWebsite(url, REPO)).toBe(true);
  });

  it.each([
    'https://brainscanner.dev',
    'https://www.npmjs.com/package/brainscanner-mcp',
    'https://pypi.org/project/brainscanner-mcp/',
    'https://hub.docker.com/r/acme/brainscanner',
    'https://brainscanner.vercel.app',
    'https://nodejs-tools.dev',
    'https://chromewebstore.google.com/detail/brainscanner/abc123',
    'https://pkg.go.dev/github.com/acme/brainscanner',
  ])('keeps a real product page: %s', (url) => {
    expect(isGenericWebsite(url, REPO)).toBe(false);
  });

  it("keeps a generic host when it is the listing owner's own site", () => {
    expect(
      isGenericWebsite(
        'https://modelcontextprotocol.io',
        'https://github.com/modelcontextprotocol/servers',
      ),
    ).toBe(false);
    expect(
      isGenericWebsite(
        'https://code.visualstudio.com/',
        'https://github.com/microsoft/vscode-mcp',
      ),
    ).toBe(false);
    expect(
      isGenericWebsite('https://claude.ai', 'https://github.com/anthropics/x'),
    ).toBe(false);
  });

  it('is false for empty or unparseable input', () => {
    expect(isGenericWebsite(null, REPO)).toBe(false);
    expect(isGenericWebsite('not a url', REPO)).toBe(false);
  });
});
