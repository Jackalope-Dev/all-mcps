import { describe, expect, it } from 'vitest';
import {
  looksLikeMissingConfig,
  settleVerificationStatus,
} from './stdioVerification';

describe('looksLikeMissingConfig', () => {
  it.each([
    'Error: GITHUB_TOKEN environment variable is required',
    'Missing required environment variable: OPENAI_API_KEY',
    'ValueError: API key not set. Please set NOTION_API_KEY',
    'Request failed: 401 Unauthorized',
    'Invalid API key provided: allmcps-placeholder',
    'Usage: mcp-server-filesystem <allowed-directory> [additional-directories...]',
    'Please set the SLACK_BOT_TOKEN env var',
  ])('recognises %s', (line) => {
    expect(looksLikeMissingConfig(line)).toBe(true);
  });

  it.each([
    '',
    'npm ERR! 404 Not Found - GET https://registry.npmjs.org/nope',
    'TypeError: Cannot read properties of undefined (reading "map")',
    'Server started on stdio',
  ])('ignores %s', (line) => {
    expect(looksLikeMissingConfig(line)).toBe(false);
  });
});

describe('settleVerificationStatus', () => {
  const stderr = 'Error: GITHUB_TOKEN environment variable is required';
  it('upgrades timeouts and handshake failures that asked for config', () => {
    expect(settleVerificationStatus('timeout', stderr)).toBe(
      'needs_credentials',
    );
    expect(settleVerificationStatus('handshake_failed', stderr)).toBe(
      'needs_credentials',
    );
  });
  it('never upgrades an install failure or a plain timeout', () => {
    expect(settleVerificationStatus('install_failed', stderr)).toBe(
      'install_failed',
    );
    expect(settleVerificationStatus('timeout', 'boom')).toBe('timeout');
  });
});
