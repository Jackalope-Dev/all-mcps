/**
 * Shared server-side Cloudflare Turnstile verification, extracted from the
 * copy that used to be inlined in app/api/submit/route.ts. Pulled out once a
 * third and fourth route (reviews, reports) needed the identical check —
 * three-plus copies of a security-sensitive external call is exactly the
 * case where a fix in one copy silently missing the others is a real risk.
 */
export type TurnstileVerifyResult = { ok: true } | { ok: false; error: string; status: number };

/**
 * Verifies a Turnstile token against Cloudflare's siteverify endpoint. `env`
 * is the Worker runtime env (falls back to `process.env`, same as every
 * other secret read in this codebase — see custom-worker.ts's runCronJob).
 */
export async function verifyTurnstileToken(
  token: unknown,
  env: { TURNSTILE_SECRET?: string } | undefined,
  remoteIp: string
): Promise<TurnstileVerifyResult> {
  if (!token || typeof token !== 'string') {
    return { ok: false, error: 'Missing Turnstile token', status: 400 };
  }

  const verifyForm = new URLSearchParams();
  verifyForm.append('secret', env?.TURNSTILE_SECRET || process.env.TURNSTILE_SECRET || '');
  verifyForm.append('response', token);
  verifyForm.append('remoteip', remoteIp);

  const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: verifyForm,
  });

  const verifyResult = (await verifyRes.json()) as any;
  if (!verifyResult.success) {
    return { ok: false, error: 'Turnstile verification failed', status: 403 };
  }
  return { ok: true };
}
