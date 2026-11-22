import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * Web Bot Auth (draft-ietf-webbotauth-httpsig-protocol): our outbound bots
 * (health checks, claim verification, setup-step extraction) sign each request
 * with an Ed25519 key, and /.well-known/http-message-signatures-directory
 * publishes the public half so sites (and Cloudflare's verified-bot program)
 * can tell a real AllMCPs probe from a spoofed User-Agent.
 *
 * The key is the `WEB_BOT_AUTH_JWK` secret: a private Ed25519 JWK
 * ({"kty":"OKP","crv":"Ed25519","d":"...","x":"..."}). Unset, nothing is
 * signed and the directory 404s.
 */

export const SIGNATURE_AGENT = '"https://allmcps.com"';
const SIGNATURE_TTL_S = 60;

type PrivateJwk = { kty: string; crv: string; d: string; x: string };

type Signer = {
  kid: string;
  publicJwk: { kty: 'OKP'; crv: 'Ed25519'; x: string; kid: string };
  key: CryptoKey;
};

let cached: { raw: string; signer: Promise<Signer | null> } | undefined;

async function readSecret(): Promise<string | null> {
  let value: unknown;
  try {
    const { env } = await getCloudflareContext({ async: true });
    value = (env as unknown as Record<string, unknown>).WEB_BOT_AUTH_JWK;
  } catch {
    // Outside the Worker (tests, scripts): fall back to process.env.
  }
  value ??= process.env.WEB_BOT_AUTH_JWK;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function base64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** RFC 7638 JWK thumbprint, the `keyid` verifiers look up in the directory. */
async function jwkThumbprint(x: string): Promise<string> {
  const canonical = `{"crv":"Ed25519","kty":"OKP","x":"${x}"}`;
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonical),
  );
  return base64url(new Uint8Array(digest));
}

/** Builds a signer from a private-JWK string; null if it isn't an Ed25519 private key. */
export async function createSigner(raw: string): Promise<Signer | null> {
  let jwk: PrivateJwk;
  try {
    jwk = JSON.parse(raw);
  } catch {
    return null;
  }
  if (jwk?.kty !== 'OKP' || jwk.crv !== 'Ed25519' || !jwk.d || !jwk.x) {
    return null;
  }
  try {
    const key = await crypto.subtle.importKey(
      'jwk',
      { kty: 'OKP', crv: 'Ed25519', d: jwk.d, x: jwk.x },
      { name: 'Ed25519' },
      false,
      ['sign'],
    );
    const kid = await jwkThumbprint(jwk.x);
    return {
      kid,
      publicJwk: { kty: 'OKP', crv: 'Ed25519', x: jwk.x, kid },
      key,
    };
  } catch {
    return null;
  }
}

async function getSigner(): Promise<Signer | null> {
  const raw = await readSecret();
  if (!raw) return null;
  if (cached?.raw !== raw) cached = { raw, signer: createSigner(raw) };
  return cached.signer;
}

function signatureParams(
  components: string,
  kid: string,
  tag: string,
  now: number,
): string {
  const nonce = base64(crypto.getRandomValues(new Uint8Array(32)));
  return `(${components});created=${now};expires=${now + SIGNATURE_TTL_S};keyid="${kid}";alg="ed25519";nonce="${nonce}";tag="${tag}"`;
}

async function sign(signer: Signer, base: string): Promise<string> {
  const sig = await crypto.subtle.sign(
    { name: 'Ed25519' },
    signer.key,
    new TextEncoder().encode(base),
  );
  return base64(new Uint8Array(sig));
}

/**
 * RFC 9421 headers for one outbound request to `authority` (URL.host).
 * Covers `@authority` and `signature-agent`, as Web Bot Auth requires, so it
 * must be recomputed for every redirect hop. Empty when no key is configured.
 */
export async function signRequestHeaders(
  authority: string,
  signerOverride?: Signer | null,
  now = Math.floor(Date.now() / 1000),
): Promise<Record<string, string>> {
  const signer =
    signerOverride === undefined ? await getSigner() : signerOverride;
  if (!signer) return {};
  const params = signatureParams(
    '"@authority" "signature-agent"',
    signer.kid,
    'web-bot-auth',
    now,
  );
  const base = [
    `"@authority": ${authority.toLowerCase()}`,
    `"signature-agent": ${SIGNATURE_AGENT}`,
    `"@signature-params": ${params}`,
  ].join('\n');
  return {
    'Signature-Agent': SIGNATURE_AGENT,
    'Signature-Input': `sig1=${params}`,
    Signature: `sig1=:${await sign(signer, base)}:`,
  };
}

/**
 * The /.well-known/http-message-signatures-directory response: the public
 * JWKS, itself signed over `@authority;req` with the directory tag so a
 * verifier can check we hold the key we publish. 404 when unconfigured.
 */
export async function directoryResponse(
  requestHost: string,
  signerOverride?: Signer | null,
): Promise<Response> {
  const signer =
    signerOverride === undefined ? await getSigner() : signerOverride;
  if (!signer) {
    return Response.json(
      { error: 'Web Bot Auth is not configured' },
      {
        status: 404,
      },
    );
  }
  const now = Math.floor(Date.now() / 1000);
  const params = signatureParams(
    '"@authority";req',
    signer.kid,
    'http-message-signatures-directory',
    now,
  );
  const base = [
    `"@authority";req: ${requestHost.toLowerCase()}`,
    `"@signature-params": ${params}`,
  ].join('\n');
  return new Response(JSON.stringify({ keys: [signer.publicJwk] }), {
    status: 200,
    headers: {
      'Content-Type': 'application/http-message-signatures-directory+json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=86400',
      'Signature-Input': `sig1=${params}`,
      Signature: `sig1=:${await sign(signer, base)}:`,
    },
  });
}
