import { describe, expect, it } from 'vitest';
import { isGitHubRepoUrl, isRepositoryUrl } from './repoUrl';

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
