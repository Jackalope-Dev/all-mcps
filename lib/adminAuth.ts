/**
 * Verifies the request's `Authorization: Bearer <secret>` header against
 * ADMIN_SECRET. Fails closed: if the secret isn't configured, every request
 * is rejected rather than falling back to a default value.
 */
export async function isAdminAuthorized(req: Request): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;

  const authHeader = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;

  // Constant-time comparison via Web Crypto (portable across edge/workerd
  // runtimes, unlike Node's `crypto.timingSafeEqual`).
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(authHeader)),
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(expected)),
  ]);

  const bytesA = new Uint8Array(a);
  const bytesB = new Uint8Array(b);

  let diff = 0;
  for (let i = 0; i < bytesA.length; i++) {
    diff |= bytesA[i] ^ bytesB[i];
  }

  return diff === 0 && authHeader.length > 0;
}
