import { describe, expect, it, vi } from 'vitest';
import { canUseReadReplica, withReadReplicaDb } from './d1Replicas';

const req = (path: string, init: RequestInit = {}) =>
  new Request(`https://allmcps.com${path}`, init);

describe('canUseReadReplica', () => {
  it('allows anonymous page and read API traffic', () => {
    for (const path of [
      '/',
      '/browse?q=slack',
      '/mcp/github/vs/gitlab',
      '/api/browse?q=x',
      '/api/v1/search?q=x',
      '/sitemap.xml',
      '/submit-guide',
    ]) {
      expect(canUseReadReplica(req(path)), path).toBe(true);
    }
    expect(canUseReadReplica(req('/', { method: 'HEAD' }))).toBe(true);
  });

  it('keeps writes on the primary', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      expect(canUseReadReplica(req('/api/mcp', { method }))).toBe(false);
    }
  });

  it('keeps account, auth, billing and cron paths on the primary', () => {
    for (const path of [
      '/dashboard',
      '/dashboard/listings',
      '/admin',
      '/login?callbackUrl=%2Fmcp%2Fx',
      '/verify-request',
      '/submit',
      '/api/auth/session',
      '/api/cron/health',
      '/api/dashboard/my-listings',
      '/api/lopebase/resources/users',
      '/api/stripe/portal',
    ]) {
      expect(canUseReadReplica(req(path)), path).toBe(false);
    }
  });

  it('keeps signed-in visitors on the primary', () => {
    for (const cookie of [
      'authjs.session-token=abc',
      'theme=dark; __Secure-authjs.session-token=abc',
      '__Secure-authjs.session-token.0=abc',
    ]) {
      expect(canUseReadReplica(req('/mcp/x', { headers: { cookie } }))).toBe(
        false,
      );
    }
    expect(
      canUseReadReplica(
        req('/mcp/x', { headers: { cookie: 'authjs.csrf-token=abc' } }),
      ),
    ).toBe(true);
  });
});

describe('withReadReplicaDb', () => {
  const session = { prepare: vi.fn(), batch: vi.fn() };
  const makeEnv = () => ({
    DB: { withSession: vi.fn(() => session) } as unknown as D1Database,
    OTHER: 'kept',
  });

  it('swaps DB for an unconstrained session on replica-eligible requests', () => {
    const env = makeEnv();
    const out = withReadReplicaDb(env, req('/browse'));
    expect(env.DB.withSession).toHaveBeenCalledWith('first-unconstrained');
    expect(out.DB).toBe(session);
    expect(out.OTHER).toBe('kept');
    expect(env.DB).not.toBe(session);
  });

  it('returns env untouched otherwise', () => {
    const env = makeEnv();
    expect(withReadReplicaDb(env, req('/api/cron/health'))).toBe(env);
    expect(env.DB.withSession).not.toHaveBeenCalled();
    const noSessions = { DB: {} as D1Database };
    expect(withReadReplicaDb(noSessions, req('/'))).toBe(noSessions);
  });
});
