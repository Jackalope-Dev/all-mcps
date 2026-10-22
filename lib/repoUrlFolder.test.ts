import { describe, expect, it } from 'vitest';
import { githubFolderPrefix, parseGithubUrl } from './repoUrl';

describe('parseGithubUrl', () => {
  it('reads owner and repo from a whole-repo URL', () => {
    expect(
      parseGithubUrl('https://github.com/grafana/mcp-grafana.git'),
    ).toEqual({ owner: 'grafana', repo: 'mcp-grafana' });
  });

  it('keeps the branch and folder of a monorepo deep link', () => {
    expect(
      parseGithubUrl(
        'https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem/',
      ),
    ).toEqual({
      owner: 'modelcontextprotocol',
      repo: 'servers',
      ref: 'main',
      path: 'src/filesystem',
    });
  });

  it('resolves a blob link to a file to its folder', () => {
    expect(
      parseGithubUrl(
        'https://github.com/awslabs/mcp/blob/main/src/aws-docs/README.md',
      )?.path,
    ).toBe('src/aws-docs');
  });

  it('ignores unsafe folder paths', () => {
    expect(
      parseGithubUrl('https://github.com/o/r/tree/main/../etc')?.path,
    ).toBeUndefined();
  });
});

describe('githubFolderPrefix', () => {
  it('is the folder with a trailing slash, or empty', () => {
    expect(
      githubFolderPrefix('https://github.com/o/r/tree/main/packages/x'),
    ).toBe('packages/x/');
    expect(githubFolderPrefix('https://github.com/o/r')).toBe('');
    expect(githubFolderPrefix(null)).toBe('');
  });
});
