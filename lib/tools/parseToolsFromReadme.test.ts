import { describe, expect, it } from 'vitest';
import { parseToolsFromReadme } from './parseToolsFromReadme';

const names = (readme: string) =>
  parseToolsFromReadme(readme).map((t) => t.name);

// Trimmed from github.com/dreamworkhq/mcp (1.7.0): a generated catalog of
// comma-separated `code` lines, followed by notes bullets that name retired tools.
// The listing was reported for showing six tools, two of them retired, because only
// the notes bullets matched any strategy.
const CATALOG_README = `# @dreamworkhq/mcp

## Tools

The typical flow: browse the public index, save roles to the pipeline.

**Public (no key):**

\`browse_listings\`, \`get_listing\`, \`get_platform_context\`, \`get_upgrade_link\`

**Direct product tools:** routes with no registry action behind them.

\`add_contact\`, \`get_stats\`, \`reopen_application_materials\`, \`update_application_materials\`

Notes on a few tools:

- No tool sends mail on its first call. \`apply\` returns \`held\`.
- 1.3.0 removed the 1.2.0 tools a registry action replaced: \`search_jobs\` and
  \`list_applications\` (use \`get_pipeline\`).
- Releases after 1.5.1 no longer include \`list_escalations\` and
  \`resolve_escalation\`.

## Troubleshooting
`;

describe('generated tool catalogs', () => {
  it('reads every catalog line and ignores the notes bullets', () => {
    expect(names(CATALOG_README)).toEqual([
      'browse_listings',
      'get_listing',
      'get_platform_context',
      'get_upgrade_link',
      'add_contact',
      'get_stats',
      'reopen_application_materials',
      'update_application_materials',
    ]);
  });

  it('does not treat prose with one inline tool name as a catalog', () => {
    const readme = '## Tools\n\nCall `get_platform_context` first.\n';
    expect(names(readme)).toEqual([]);
  });
});

describe('inline-code bullet fallback', () => {
  it('skips bullets that say a tool was removed or retired', () => {
    const readme = `## Tools

- Discovery: \`hol.stats\`, \`hol.search\`
- 2.0 removed \`hol.legacy\`
- \`hol.old\` is deprecated and no longer served
`;
    expect(names(readme)).toEqual(['hol.stats', 'hol.search']);
  });
});
