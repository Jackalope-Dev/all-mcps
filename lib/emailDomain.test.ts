import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  domainAndParents,
  domainReceivesMail,
  emailProblem,
  isDisposableDomain,
  isSharedMailDomain,
  UNREACHABLE_EMAIL_ERROR,
} from './emailDomain';

/** Fake Cloudflare DoH: answers per `${name}/${type}`. */
function stubDns(answers: Record<string, { Status: number; Answer?: unknown[] }>) {
  const fetchMock = vi.fn(async (url: string) => {
    const u = new URL(url);
    const key = `${u.searchParams.get('name')}/${u.searchParams.get('type')}`;
    return new Response(JSON.stringify(answers[key] ?? { Status: 0 }));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('domain lists', () => {
  it('walks parents down to two labels', () => {
    expect(domainAndParents('mx.mail.brainscanner.dev')).toEqual([
      'mx.mail.brainscanner.dev',
      'mail.brainscanner.dev',
      'brainscanner.dev',
    ]);
  });

  it('knows throwaway inboxes, including subdomains', () => {
    expect(isDisposableDomain('mailinator.com')).toBe(true);
    expect(isDisposableDomain('eu.yopmail.com')).toBe(true);
    expect(isDisposableDomain('brainscanner.dev')).toBe(false);
  });

  it('never treats webmail as a blockable domain', () => {
    expect(isSharedMailDomain('gmail.com')).toBe(true);
    expect(isSharedMailDomain('brainscanner.dev')).toBe(false);
  });
});

describe('domainReceivesMail', () => {
  it('accepts a domain with an MX record', async () => {
    stubDns({
      'mx-ok.brainscanner.dev/MX': {
        Status: 0,
        Answer: [{ type: 15, data: '10 mx.brainscanner.dev.' }],
      },
    });
    expect(await domainReceivesMail('mx-ok.brainscanner.dev')).toBe(true);
  });

  it('refuses a domain that does not exist', async () => {
    stubDns({ 'gone.brainscanner.dev/MX': { Status: 3 } });
    expect(await domainReceivesMail('gone.brainscanner.dev')).toBe(false);
  });

  it('refuses an RFC 7505 null MX', async () => {
    stubDns({
      'nullmx.brainscanner.dev/MX': {
        Status: 0,
        Answer: [{ type: 15, data: '0 .' }],
      },
    });
    expect(await domainReceivesMail('nullmx.brainscanner.dev')).toBe(false);
  });

  it('falls back to an A record (implicit MX)', async () => {
    stubDns({
      'a-only.brainscanner.dev/MX': { Status: 0 },
      'a-only.brainscanner.dev/A': {
        Status: 0,
        Answer: [{ type: 1, data: '203.0.113.7' }],
      },
    });
    expect(await domainReceivesMail('a-only.brainscanner.dev')).toBe(true);
  });

  it('refuses a domain with no MX and no address', async () => {
    stubDns({});
    expect(await domainReceivesMail('empty.brainscanner.dev')).toBe(false);
  });

  it('fails open when DNS is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('timeout');
      }),
    );
    expect(await domainReceivesMail('flaky.brainscanner.dev')).toBe(true);
  });
});

describe('emailProblem', () => {
  it('refuses placeholder and throwaway addresses without a lookup', async () => {
    const fetchMock = stubDns({});
    expect(await emailProblem('probe@example.com')).toBe(UNREACHABLE_EMAIL_ERROR);
    expect(await emailProblem('x@mailinator.com')).toBe(UNREACHABLE_EMAIL_ERROR);
    expect(await emailProblem('not-an-email')).toBe(UNREACHABLE_EMAIL_ERROR);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes a deliverable address', async () => {
    stubDns({
      'deliver.brainscanner.dev/MX': {
        Status: 0,
        Answer: [{ type: 15, data: '10 mx.brainscanner.dev.' }],
      },
    });
    expect(await emailProblem('dev@deliver.brainscanner.dev')).toBeNull();
  });
});
