import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockHandlers = {
  GET: vi.fn(
    async () =>
      new Response(JSON.stringify({ ok: true, method: 'GET' }), {
        status: 200,
      }),
  ),
  POST: vi.fn(
    async () =>
      new Response(JSON.stringify({ ok: true, method: 'POST' }), {
        status: 200,
      }),
  ),
};

vi.mock('@/lib/auth', () => ({
  handlers: mockHandlers,
}));

const { GET, POST } = await import('./route');

describe('NextAuth catch-all route handler (/api/auth/[...nextauth])', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('login redirection', () => {
    it('redirects GET /api/auth/login to /login with 303', async () => {
      const req = new NextRequest('https://allmcps.com/api/auth/login');
      const res = await GET(req);

      expect(res.status).toBe(303);
      expect(res.headers.get('location')).toBe('https://allmcps.com/login');
      expect(mockHandlers.GET).not.toHaveBeenCalled();
    });

    it('redirects POST /api/auth/login to /login with 303 (forces GET on redirect)', async () => {
      const req = new NextRequest('https://allmcps.com/api/auth/login', {
        method: 'POST',
      });
      const res = await POST(req);

      expect(res.status).toBe(303);
      expect(res.headers.get('location')).toBe('https://allmcps.com/login');
      expect(mockHandlers.POST).not.toHaveBeenCalled();
    });

    it('preserves query params when redirecting /api/auth/login', async () => {
      const req = new NextRequest(
        'https://allmcps.com/api/auth/login?callbackUrl=%2Fdashboard',
      );
      const res = await GET(req);

      expect(res.status).toBe(303);
      expect(res.headers.get('location')).toBe(
        'https://allmcps.com/login?callbackUrl=%2Fdashboard',
      );
    });
  });

  describe('verify-request redirection', () => {
    it('redirects GET /api/auth/verify-request to /verify-request with 303', async () => {
      const req = new NextRequest(
        'https://allmcps.com/api/auth/verify-request',
      );
      const res = await GET(req);

      expect(res.status).toBe(303);
      expect(res.headers.get('location')).toBe(
        'https://allmcps.com/verify-request',
      );
      expect(mockHandlers.GET).not.toHaveBeenCalled();
    });

    it('redirects POST /api/auth/verify-request to /verify-request with 303', async () => {
      const req = new NextRequest(
        'https://allmcps.com/api/auth/verify-request',
        {
          method: 'POST',
        },
      );
      const res = await POST(req);

      expect(res.status).toBe(303);
      expect(res.headers.get('location')).toBe(
        'https://allmcps.com/verify-request',
      );
      expect(mockHandlers.POST).not.toHaveBeenCalled();
    });
  });

  describe('OAuth token endpoint probe', () => {
    it('returns 400 with helpful error for POST /api/auth/token', async () => {
      const req = new NextRequest('https://allmcps.com/api/auth/token', {
        method: 'POST',
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
      const data = (await res.json()) as { error?: string };
      expect(data.error).toBe('unsupported_grant_type');
      expect(mockHandlers.POST).not.toHaveBeenCalled();
    });
  });

  describe('unrecognized auth actions (scanners / bots)', () => {
    it('returns 400 for unknown actions without calling Auth.js handlers', async () => {
      const req = new NextRequest('https://allmcps.com/api/auth/wp-login.php');
      const res = await GET(req);

      expect(res.status).toBe(400);
      const data = (await res.json()) as { error?: string };
      expect(data.error).toBe('unknown_action');
      expect(mockHandlers.GET).not.toHaveBeenCalled();
    });

    it('returns 400 for POST to unrecognized action', async () => {
      const req = new NextRequest('https://allmcps.com/api/auth/admin', {
        method: 'POST',
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
      const data = (await res.json()) as { error?: string };
      expect(data.error).toBe('unknown_action');
      expect(mockHandlers.POST).not.toHaveBeenCalled();
    });
  });

  describe('valid Auth.js actions', () => {
    it('delegates valid action GET requests to Auth.js handlers', async () => {
      const req = new NextRequest('https://allmcps.com/api/auth/session');
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(mockHandlers.GET).toHaveBeenCalledTimes(1);
    });

    it('delegates valid action POST requests to Auth.js handlers', async () => {
      const req = new NextRequest(
        'https://allmcps.com/api/auth/signin/resend',
        { method: 'POST' },
      );
      const res = await POST(req);

      expect(res.status).toBe(200);
      expect(mockHandlers.POST).toHaveBeenCalledTimes(1);
    });

    it('delegates /api/auth/providers to Auth.js handlers', async () => {
      const req = new NextRequest('https://allmcps.com/api/auth/providers');
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(mockHandlers.GET).toHaveBeenCalledTimes(1);
    });
  });
});
