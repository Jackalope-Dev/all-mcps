import { describe, expect, it } from 'vitest';
import { isCatalogReadme } from './listingEnrich';

const entry = (i: number) =>
  `- [org${i}/server-${i}](https://github.com/org${i}/server-${i}) - Server ${i}. \`npx -y server-${i}\``;

describe('isCatalogReadme', () => {
  it('flags an awesome-list fork that links many other repos', () => {
    const readme = `# Awesome MCP Servers\n\n${Array.from({ length: 150 }, (_, i) => entry(i)).join('\n')}`;
    expect(isCatalogReadme(readme, 'aonpro-dev', 'aonpro-mcp')).toBe(true);
  });

  it('keeps a real server README that links a few related repos', () => {
    const readme = [
      '# AON MCP',
      'Source: https://github.com/aon-pro/aonpro-mcp',
      'Clone https://github.com/aon-pro/aonpro-mcp.git',
      'Built on https://github.com/modelcontextprotocol/typescript-sdk',
      'Bridge with https://github.com/geelen/mcp-remote',
      ...Array.from({ length: 20 }, (_, i) => entry(i)),
    ].join('\n');
    expect(isCatalogReadme(readme, 'aon-pro', 'aonpro-mcp')).toBe(false);
  });

  it('does not count links to the repo itself, in any case', () => {
    const readme = Array.from(
      { length: 200 },
      (_, i) => `https://github.com/Aon-Pro/AonPro-MCP/blob/main/f${i}.md`,
    ).join('\n');
    expect(isCatalogReadme(readme, 'aon-pro', 'aonpro-mcp')).toBe(false);
  });
});
