import { describe, expect, it } from 'vitest';
import {
  createSigner,
  directoryResponse,
  SIGNATURE_AGENT,
  signRequestHeaders,
} from './webBotAuth';

async function newKeyJwk() {
  const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  return crypto.subtle.exportKey('jwk', pair.privateKey);
}

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function verify(x: string, base: string, sigHeader: string) {
  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: 'OKP', crv: 'Ed25519', x },
    { name: 'Ed25519' },
    false,
    ['verify'],
  );
  const sig = sigHeader.match(/^sig1=:(.+):$/)?.[1] ?? '';
  return crypto.subtle.verify(
    { name: 'Ed25519' },
    key,
    b64ToBytes(sig),
    new TextEncoder().encode(base),
  );
}

describe('webBotAuth', () => {
  it('rejects anything but an Ed25519 private JWK', async () => {
    expect(await createSigner('not json')).toBeNull();
    expect(await createSigner('{"kty":"RSA"}')).toBeNull();
    const jwk = await newKeyJwk();
    expect(
      await createSigner(JSON.stringify({ ...jwk, d: undefined })),
    ).toBeNull();
  });

  it('signs nothing when no key is configured', async () => {
    expect(await signRequestHeaders('example.com', null)).toEqual({});
    expect((await directoryResponse('allmcps.com', null)).status).toBe(404);
  });

  it('produces a request signature that verifies against the published key', async () => {
    const jwk = await newKeyJwk();
    const signer = await createSigner(JSON.stringify(jwk));
    expect(signer).not.toBeNull();
    const headers = await signRequestHeaders('MCP.Example.com:8443', signer);

    expect(headers['Signature-Agent']).toBe(SIGNATURE_AGENT);
    const params = headers['Signature-Input'].replace(/^sig1=/, '');
    expect(params).toMatch(/^\("@authority" "signature-agent"\);created=\d+/);
    expect(params).toContain(`keyid="${signer?.kid}"`);
    expect(params).toContain('alg="ed25519"');
    expect(params).toContain('tag="web-bot-auth"');

    const base = [
      '"@authority": mcp.example.com:8443',
      `"signature-agent": ${SIGNATURE_AGENT}`,
      `"@signature-params": ${params}`,
    ].join('\n');
    expect(await verify(jwk.x as string, base, headers.Signature)).toBe(true);
  });

  it('serves a signed JWKS directory with only the public key', async () => {
    const jwk = await newKeyJwk();
    const signer = await createSigner(JSON.stringify(jwk));
    const res = await directoryResponse('allmcps.com', signer);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe(
      'application/http-message-signatures-directory+json',
    );
    const body = (await res.json()) as { keys: unknown[] };
    expect(body.keys).toEqual([
      { kty: 'OKP', crv: 'Ed25519', x: jwk.x, kid: signer?.kid },
    ]);
    expect(JSON.stringify(body)).not.toContain(jwk.d as string);

    const params = (res.headers.get('signature-input') ?? '').replace(
      /^sig1=/,
      '',
    );
    expect(params).toContain('tag="http-message-signatures-directory"');
    const base = [
      '"@authority";req: allmcps.com',
      `"@signature-params": ${params}`,
    ].join('\n');
    expect(
      await verify(jwk.x as string, base, res.headers.get('signature') ?? ''),
    ).toBe(true);
  });
});
