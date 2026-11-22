import { describe, expect, it } from 'vitest';
import { resolveRepoLink } from './repoLinks';
import { absolutizeReadmeMarkdown } from './servers';

const repo = 'https://github.com/arcmira/mcp';

describe('resolveRepoLink', () => {
  it('resolves relative links against the default branch, not main', () => {
    expect(resolveRepoLink('./plugins/arcmira#keep-it-updated', repo)).toBe(
      'https://github.com/arcmira/mcp/blob/HEAD/plugins/arcmira#keep-it-updated',
    );
  });

  it('resolves relative images to raw content on the default branch', () => {
    expect(resolveRepoLink('assets/logo.png', `${repo}.git`, true)).toBe(
      'https://raw.githubusercontent.com/arcmira/mcp/HEAD/assets/logo.png',
    );
  });

  it("resolves from a monorepo listing's own folder", () => {
    const deep = 'https://github.com/awslabs/mcp/tree/main/src/aws-docs';
    expect(resolveRepoLink('docs/a.md', deep)).toBe(
      'https://github.com/awslabs/mcp/blob/HEAD/src/aws-docs/docs/a.md',
    );
    expect(resolveRepoLink('../other/', deep)).toBe(
      'https://github.com/awslabs/mcp/blob/HEAD/src/other/',
    );
    expect(resolveRepoLink('/LICENSE', deep)).toBe(
      'https://github.com/awslabs/mcp/blob/HEAD/LICENSE',
    );
  });

  it('leaves absolute and anchor links alone', () => {
    expect(resolveRepoLink('https://example.com/x', repo)).toBe(
      'https://example.com/x',
    );
    expect(resolveRepoLink('#install', repo)).toBe('#install');
    expect(resolveRepoLink('mailto:a@b.c', undefined)).toBe('mailto:a@b.c');
  });

  it('serves github.com blob images from raw content', () => {
    expect(
      resolveRepoLink(
        'https://github.com/o/r/blob/main/a.png',
        undefined,
        true,
      ),
    ).toBe('https://raw.githubusercontent.com/o/r/main/a.png');
  });

  it('returns null for what it cannot resolve', () => {
    expect(resolveRepoLink('docs/x.md', 'https://gitlab.com/o/r')).toBeNull();
    expect(resolveRepoLink('docs/x.md', undefined)).toBeNull();
    expect(resolveRepoLink('/etc', 'https://acme.dev')).toBeNull();
    expect(resolveRepoLink('../../x.md', repo)).toBeNull();
    expect(resolveRepoLink('', repo)).toBeNull();
  });
});

describe('absolutizeReadmeMarkdown', () => {
  it('points every relative link at the repository or drops it', () => {
    const md = [
      '[guide](docs/GETTING_STARTED.md) ![x](a.png) [up](#top)',
      '<a href="packages/openclaw">pkg</a>',
      '```',
      'cd /path/to/x && open docs/a.md',
      '```',
    ].join('\n');
    expect(absolutizeReadmeMarkdown(md, `${repo}/tree/main/pkg`)).toBe(
      [
        '[guide](https://github.com/arcmira/mcp/blob/HEAD/pkg/docs/GETTING_STARTED.md) ![x](https://raw.githubusercontent.com/arcmira/mcp/HEAD/pkg/a.png) [up](#top)',
        '<a href="https://github.com/arcmira/mcp/blob/HEAD/pkg/packages/openclaw">pkg</a>',
        '```',
        'cd /path/to/x && open docs/a.md',
        '```',
      ].join('\n'),
    );
    expect(absolutizeReadmeMarkdown(md, 'https://gitlab.com/o/r')).toBe(
      [
        'guide  [up](#top)',
        '<a >pkg</a>',
        '```',
        'cd /path/to/x && open docs/a.md',
        '```',
      ].join('\n'),
    );
  });
});
