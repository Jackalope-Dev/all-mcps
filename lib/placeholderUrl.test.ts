import { describe, expect, it } from 'vitest';
import { isPlaceholderHost, isPlaceholderUrl } from './placeholderUrl';

describe('isPlaceholderHost', () => {
  it('matches documentation hosts copied from sample configs', () => {
    for (const host of [
      'example.com',
      'mcp.example.com',
      'your-server.example.com',
      'fhir.example.org',
      'host.example.cn',
      'proxy.lib.example.edu',
      'netbox.example.internal',
      'your-worker.example',
      'vector-mcp.example.invalid',
      'api.acme.test',
    ]) {
      expect(isPlaceholderHost(host), host).toBe(true);
    }
  });

  it('leaves real hosts that merely contain the word alone', () => {
    for (const host of [
      'brainscanner.dev',
      'example-health.org',
      'examples.acme.dev',
      'vecmo-example.pages.dev',
      'localhost',
      'testing.acme.dev',
    ]) {
      expect(isPlaceholderHost(host), host).toBe(false);
    }
  });
});

describe('isPlaceholderUrl', () => {
  it('reads the host out of a URL', () => {
    expect(isPlaceholderUrl('https://mcp.example.com:8443/mcp')).toBe(true);
    expect(isPlaceholderUrl('https://brainscanner.dev/mcp')).toBe(false);
  });

  it('is false for empty or unparseable input', () => {
    expect(isPlaceholderUrl(null)).toBe(false);
    expect(isPlaceholderUrl('')).toBe(false);
    expect(isPlaceholderUrl('not a url')).toBe(false);
  });
});
