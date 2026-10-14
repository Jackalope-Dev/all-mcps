import { describe, expect, it } from 'vitest';
import {
  githubRepoSlug,
  isGitHubRepoUrl,
  isPackageRepoMismatch,
  isRepositoryUrl,
} from './repoUrl';

describe('isRepositoryUrl', () => {
  it('accepts real repository URLs across the common hosts', () => {
    for (const url of [
      'https://github.com/anthropics/claude-code',
      'https://www.github.com/anthropics/claude-code',
      'https://gitlab.com/group/project',
      'https://bitbucket.org/team/repo',
      'https://codeberg.org/owner/repo',
      'https://github.com/owner/repo/tree/main/packages/server',
    ]) {
      expect(isRepositoryUrl(url), url).toBe(true);
    }
  });

  it('rejects product homepages — the case that mislabeled listings', () => {
    for (const url of [
      'https://brainscanner.dev',
      'https://brainscanner.dev/connect',
      'https://example.com/docs/github.com/owner/repo',
    ]) {
      expect(isRepositoryUrl(url), url).toBe(false);
    }
  });

  it('rejects a lookalike host that a substring check would accept', () => {
    expect(isRepositoryUrl('https://github.com.example.dev/owner/repo')).toBe(
      false,
    );
  });

  it('rejects bare hosts with no owner/project path', () => {
    expect(isRepositoryUrl('https://github.com')).toBe(false);
    expect(isRepositoryUrl('https://github.com/explore')).toBe(false);
  });

  it('rejects empty, malformed, and non-http input', () => {
    expect(isRepositoryUrl(null)).toBe(false);
    expect(isRepositoryUrl(undefined)).toBe(false);
    expect(isRepositoryUrl('')).toBe(false);
    expect(isRepositoryUrl('not a url')).toBe(false);
    expect(isRepositoryUrl('javascript:alert(1)')).toBe(false);
  });
});

describe('isGitHubRepoUrl', () => {
  it('accepts only github.com repositories', () => {
    expect(isGitHubRepoUrl('https://github.com/owner/repo')).toBe(true);
    expect(isGitHubRepoUrl('https://www.github.com/owner/repo')).toBe(true);
  });

  it('rejects other repo hosts that isRepositoryUrl accepts', () => {
    expect(isRepositoryUrl('https://gitlab.com/owner/repo')).toBe(true);
    expect(isGitHubRepoUrl('https://gitlab.com/owner/repo')).toBe(false);
  });

  it('rejects the lookalike host that could fake a README claim proof', () => {
    expect(isGitHubRepoUrl('https://github.com.example.dev/owner/repo')).toBe(
      false,
    );
  });

  it('rejects a bare github.com with no repo path', () => {
    expect(isGitHubRepoUrl('https://github.com')).toBe(false);
  });
});

describe('githubRepoSlug', () => {
  it('reduces every GitHub reference shape to owner/repo', () => {
    expect(githubRepoSlug('https://github.com/Acme/Repo')).toBe('acme/repo');
    expect(githubRepoSlug('git+https://github.com/acme/repo.git')).toBe(
      'acme/repo',
    );
    expect(githubRepoSlug('git@github.com:acme/repo.git')).toBe('acme/repo');
    expect(githubRepoSlug('github:acme/repo')).toBe('acme/repo');
    expect(
      githubRepoSlug(
        'https://github.com/modelcontextprotocol/servers/tree/main/src/git',
      ),
    ).toBe('modelcontextprotocol/servers');
  });

  it('returns null for anything else', () => {
    expect(githubRepoSlug('https://gitlab.com/acme/repo')).toBeNull();
    expect(githubRepoSlug(null)).toBeNull();
  });
});

describe('isPackageRepoMismatch', () => {
  it('flags a package from an unrelated repo', () => {
    expect(isPackageRepoMismatch('stranger/other-tool', 'acme/mcp')).toBe(true);
  });

  it('allows renames, transfers and forks', () => {
    expect(isPackageRepoMismatch('acme/new-name', 'acme/old-name')).toBe(false);
    expect(isPackageRepoMismatch('neworg/mcp', 'oldorg/mcp')).toBe(false);
    expect(
      isPackageRepoMismatch('upstream/tool', 'me/tool-fork', 'Upstream/Tool'),
    ).toBe(false);
    expect(isPackageRepoMismatch(null, 'acme/mcp')).toBe(false);
  });

  it('ignores GitHub site pages that look like repos', () => {
    expect(githubRepoSlug('https://github.com/sponsors/acme')).toBeNull();
  });
});
