import { describe, expect, it } from 'vitest';
import { isSafeImageUrl } from './ServerAvatar';

describe('isSafeImageUrl', () => {
  it('allows site-relative paths such as /logos/<id>', () => {
    expect(isSafeImageUrl('/logos/rafflex')).toBe(true);
    expect(isSafeImageUrl('/logos/moxie-docs-mcp')).toBe(true);
    expect(isSafeImageUrl('/api/ads/logo/123')).toBe(true);
    expect(isSafeImageUrl('/logo-icon.png')).toBe(true);
  });

  it('allows valid http and https URLs', () => {
    expect(
      isSafeImageUrl('https://github.com/modelcontextprotocol.png?size=96'),
    ).toBe(true);
    expect(isSafeImageUrl('https://example.com/logo.png')).toBe(true);
    expect(isSafeImageUrl('http://example.com/logo.png')).toBe(true);
  });

  it('rejects protocol-relative and backslash URLs', () => {
    expect(isSafeImageUrl('//evil.com/logo.png')).toBe(false);
    expect(isSafeImageUrl('/\\evil.com/logo.png')).toBe(false);
  });

  it('rejects dangerous URI schemes and invalid inputs', () => {
    expect(isSafeImageUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeImageUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false);
    expect(isSafeImageUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeImageUrl(null)).toBe(false);
    expect(isSafeImageUrl(undefined)).toBe(false);
    expect(isSafeImageUrl('')).toBe(false);
    expect(isSafeImageUrl('   ')).toBe(false);
  });
});
