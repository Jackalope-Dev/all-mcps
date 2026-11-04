import { afterEach, describe, expect, it, vi } from 'vitest';
import { redactEmails, syncSequenzySubscriber } from './sequenzy';

describe('syncSequenzySubscriber', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('overwrites attributes on an existing subscriber before tagging', async () => {
    vi.stubEnv('SEQUENZY_API_KEY', 'test-key');
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await syncSequenzySubscriber({
      email: ' Owner@Acme.dev ',
      tags: ['listing-approved'],
      customAttributes: { serverName: 'Brainscanner' },
    });

    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    expect(calls.map(([url, init]) => [init.method, url])).toEqual([
      ['PATCH', 'https://api.sequenzy.com/api/v1/subscribers/owner%40acme.dev'],
      ['POST', 'https://api.sequenzy.com/api/v1/subscribers'],
    ]);
    expect(JSON.parse(calls[0][1].body as string)).toEqual({
      customAttributes: { serverName: 'Brainscanner' },
      customAttributesStrategy: 'merge',
    });
  });

  it('still creates a new subscriber when the attribute update 404s', async () => {
    vi.stubEnv('SEQUENZY_API_KEY', 'test-key');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 404 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});

    await syncSequenzySubscriber({
      email: 'new@acme.dev',
      tags: ['submitted-listing'],
      customAttributes: { serverName: 'Brainscanner' },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(err).not.toHaveBeenCalled();
    err.mockRestore();
  });

  it('skips the attribute update when there are no attributes', async () => {
    vi.stubEnv('SEQUENZY_API_KEY', 'test-key');
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await syncSequenzySubscriber({ email: 'a@acme.dev', tags: ['customer'] });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('redactEmails', () => {
  it('removes every email address from a Sequenzy error body', () => {
    const body =
      '{"error":"Invalid email","email":"Jane.Doe+mcp@example.co.uk","detail":"bob@x.io is blocked"}';
    const out = redactEmails(body);
    expect(out).not.toMatch(/@/);
    expect(out).toContain('"error":"Invalid email"');
  });

  it('leaves bodies without emails untouched', () => {
    const body = '{"error":"lists[0] not found"}';
    expect(redactEmails(body)).toBe(body);
  });
});
