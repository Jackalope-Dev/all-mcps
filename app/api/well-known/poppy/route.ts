/**
 * /.well-known/poppy.json — Personal Agent Protocol (Poppy) discovery,
 * website-only: Personal Agents browse allmcps.com as ordinary signed-out
 * visitors. No `auth` block: our OAuth server does not implement Poppy's
 * agent identity, Session JWTs or `poppy_domains` metadata, and the 0.1
 * draft treats any `auth` object as an issuer declaration. Declare `agent`,
 * `apis` or a `browser_session_endpoint` only once a Poppy issuer backs them.
 */
const manifest = {
  protocol_version: '0.1',
  organization: { name: 'AllMCPs', domain: 'allmcps.com' },
  web: {},
};

export function GET() {
  return Response.json(manifest, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
