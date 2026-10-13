import { describe, expect, it } from 'vitest';
import {
  classifyRepoResponse,
  githubRepoPath,
  isRepoGoneConfirmed,
  REPO_GONE_CONFIRM_MS,
} from './repoCheck';

describe('classifyRepoResponse', () => {
  it('only treats 404/410/451 as gone', () => {
    expect(classifyRepoResponse(404)).toBe('gone');
    expect(classifyRepoResponse(410)).toBe('gone');
    expect(classifyRepoResponse(451)).toBe('gone');
    expect(classifyRepoResponse(403)).toBe('unknown');
    expect(classifyRepoResponse(429)).toBe('unknown');
    expect(classifyRepoResponse(502)).toBe('unknown');
  });

  it('reads archived and disabled from the API body', () => {
    expect(classifyRepoResponse(200, {})).toBe('ok');
    expect(classifyRepoResponse(200, { archived: true })).toBe('archived');
    expect(classifyRepoResponse(200, { disabled: true })).toBe('archived');
  });
});

describe('githubRepoPath', () => {
  it('extracts owner/repo and strips .git', () => {
    expect(githubRepoPath('https://github.com/a/b.git')).toBe('a/b');
    expect(githubRepoPath('https://github.com/a/b/tree/main/src')).toBe('a/b');
    expect(githubRepoPath('https://gitlab.com/a/b')).toBeNull();
  });
});

describe('isRepoGoneConfirmed', () => {
  const now = new Date('2026-10-13T00:00:00Z');
  const dayAgo = new Date(now.getTime() - REPO_GONE_CONFIRM_MS);
  it('needs two sightings a day apart', () => {
    expect(isRepoGoneConfirmed(1, dayAgo, now)).toBe(false);
    expect(isRepoGoneConfirmed(2, new Date(now.getTime() - 1000), now)).toBe(
      false,
    );
    expect(isRepoGoneConfirmed(2, dayAgo, now)).toBe(true);
  });
});
