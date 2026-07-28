import { jwtVerify, createRemoteJWKSet } from 'jose';

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

/**
 * Verifies the Cf-Access-Jwt-Assertion header Cloudflare Access attaches to
 * requests that already passed the /admin* Access application at the edge.
 * This is a defense-in-depth check against the origin being reached directly
 * (e.g. a misconfigured route), not the primary access control.
 */
export async function getAuthorizedAdminEmail(headers: Headers): Promise<string | null> {
  const teamDomain = process.env.ACCESS_TEAM_DOMAIN;
  const aud = process.env.ACCESS_AUD;
  const allowedEmail = process.env.ADMIN_EMAIL;
  if (!teamDomain || !aud || !allowedEmail) return null;

  const token = headers.get('cf-access-jwt-assertion');
  if (!token) return null;

  try {
    if (!jwks) {
      jwks = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
    }

    const { payload } = await jwtVerify(token, jwks, {
      issuer: teamDomain,
      audience: aud,
    });

    const email = typeof payload.email === 'string' ? payload.email : null;
    if (!email || email.toLowerCase() !== allowedEmail.toLowerCase()) return null;

    return email;
  } catch {
    return null;
  }
}
