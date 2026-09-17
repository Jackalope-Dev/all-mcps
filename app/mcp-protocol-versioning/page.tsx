import type { Metadata } from 'next';
import Link from 'next/link';
import { MCPVersioningPlayground } from '@/components/tools/MCPVersioningPlayground';
import { CopyBlock } from '@/components/ui/CopyBlock';
import { FaqSection } from '@/components/ui/FaqSection';
import { TableOfContents, type TocItem } from '@/components/ui/TableOfContents';

export const metadata: Metadata = {
  title: 'MCP Protocol Versioning Explained (2026-07-28 Revision)',
  description:
    'MCP dropped the initialize handshake for a stateless, per-request protocol. What changed in the 2026-07-28 revision, why, and how to keep servers and clients working across both eras.',
  alternates: {
    canonical: 'https://allmcps.com/mcp-protocol-versioning',
  },
  openGraph: {
    images: [
      {
        url: 'https://allmcps.com/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'AllMCPs',
      },
    ],
    title: 'MCP Protocol Versioning Explained (2026-07-28 Revision) | AllMCPs',
    description:
      'MCP dropped the initialize handshake for a stateless, per-request protocol. What changed, why, and how to support both eras.',
    url: 'https://allmcps.com/mcp-protocol-versioning',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MCP Protocol Versioning Explained (2026-07-28 Revision) | AllMCPs',
    description:
      'MCP dropped the initialize handshake for a stateless, per-request protocol. What changed, why, and how to support both eras.',
  },
};

const faqs = [
  {
    q: 'Is the initialize handshake really gone from MCP?',
    a: 'For the current protocol revision (2026-07-28), yes. There is no initialize request, no initialized notification, and no protocol-level session. Every request carries its own protocol version, capabilities, and identity in its _meta field, and a server processes each one independently. Servers built for 2025-11-25 and earlier still use the old handshake, and the spec calls that combination "legacy" rather than wrong.',
  },
  {
    q: 'Will my existing MCP server stop working?',
    a: 'Not immediately. A legacy client talking to a legacy server keeps working exactly as before, since that combination never touches the new per-request fields at all. What breaks is mixing eras: a modern client sending _meta-only requests to a legacy server, or a legacy client sending initialize to a server that only speaks the modern revision.',
  },
  {
    q: 'What replaced sampling, elicitation, and roots as server-initiated requests?',
    a: 'The Multi Round-Trip Requests (MRTR) pattern. A server that needs a sampling completion, an elicitation answer, or a client’s roots list no longer sends its own request mid-response. It instead answers the client’s original request with resultType: "input_required", listing what it still needs. The client gathers that input and retries the original request, under a new request id, carrying the answers plus an opaque requestState value it echoes back unread.',
  },
  {
    q: 'Are Roots, Sampling, and Logging actually deprecated now?',
    a: 'Yes, as of the 2026-07-28 revision. They still work during the deprecation window, but new servers should not build on them. The suggested migrations are: pass directories or files as ordinary tool arguments or resource URIs instead of Roots, call your LLM provider’s API directly instead of routing completions through Sampling, and write to stderr or emit OpenTelemetry instead of the Logging capability.',
  },
  {
    q: 'How do I know if a server I am connecting to is modern or legacy?',
    a: 'Call server/discover first. Every modern server must implement it, and it returns the server’s supported protocol versions, capabilities, and identity in one request. If the server does not recognize server/discover at all (an unrecognized-method error on stdio, or a non-MCP error body on HTTP), treat it as legacy and fall back to an initialize handshake instead.',
  },
  {
    q: 'Do I need to rewrite my server today?',
    a: 'Only if you are hand-rolling the wire protocol yourself. Most people build on an official SDK, and SDK maintainers are the ones absorbing this change first. Check your SDK’s changelog for 2026-07-28 support before you change any of your own code, and treat the version negotiation and MRTR sections below as what your SDK should be doing under the hood.',
  },
];

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

const techArticleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'TechArticle',
  headline:
    'MCP Protocol Versioning Explained: The Stateless 2026-07-28 Revision',
  description:
    'A complete explanation of how the Model Context Protocol moved from a session-based initialize handshake to a stateless, per-request protocol: version negotiation, server/discover, Multi Round-Trip Requests, deprecated features, and how to support both eras.',
  author: { '@type': 'Organization', name: 'Jackalope Digital LLC' },
  publisher: { '@type': 'Organization', name: 'AllMCPs' },
  isPartOf: {
    '@type': 'CollectionPage',
    name: 'MCP Guides',
    '@id': 'https://allmcps.com/guides',
  },
};

const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: 'https://allmcps.com',
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Guides',
      item: 'https://allmcps.com/guides',
    },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'MCP Protocol Versioning',
      item: 'https://allmcps.com/mcp-protocol-versioning',
    },
  ],
};

const tocItems: TocItem[] = [
  { id: 'short-answer', text: 'What actually changed' },
  { id: 'why-stateless', text: 'Why MCP went stateless' },
  { id: 'discovery', text: 'server/discover replaces initialize' },
  { id: 'mrtr', text: 'Multi Round-Trip Requests' },
  { id: 'playground', text: 'Interactive: try it yourself' },
  { id: 'deprecated', text: 'What is now deprecated' },
  { id: 'state', text: 'Handling state without a session' },
  { id: 'compatibility', text: 'Supporting both eras' },
  { id: 'transports', text: 'stdio & Streamable HTTP changes' },
  { id: 'checklist', text: 'What to actually do this week' },
  { id: 'faq', text: 'FAQ' },
];

export default function MCPProtocolVersioningPage() {
  return (
    <main className="page-shell page-shell--default">
      <div className="page-shell-inner">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(techArticleJsonLd),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />

        <div className="lg:grid lg:grid-cols-[1fr_260px] lg:gap-10">
          <div className="surface page-panel min-w-0">
            <nav
              aria-label="Breadcrumb"
              style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}
            >
              <Link href="/guides" style={{ color: 'var(--text-secondary)' }}>
                Guides
              </Link>
              <span
                style={{ color: 'var(--text-secondary)', margin: '0 0.4rem' }}
              >
                /
              </span>
              <span style={{ color: 'var(--text-primary)' }}>
                MCP Protocol Versioning
              </span>
            </nav>

            <div
              style={{
                textAlign: 'center',
                maxWidth: '760px',
                margin: '0 auto 2.5rem',
              }}
            >
              <h1
                className="text-page-title"
                style={{ marginBottom: '0.5rem' }}
              >
                MCP Protocol Versioning Explained
              </h1>
              <p className="text-lead" style={{ margin: 0 }}>
                As of protocol revision <strong>2026-07-28</strong>, MCP dropped
                the session-based <code>initialize</code> handshake for a fully
                stateless, per-request protocol. If your mental model of MCP
                still starts with &ldquo;the client and server negotiate
                capabilities once, then talk for the rest of the session,&rdquo;
                this guide covers what replaced that, and why.
              </p>
            </div>

            <div className="lg:hidden" style={{ marginBottom: '2rem' }}>
              <TableOfContents items={tocItems} />
            </div>

            <div className="markdown-body">
              <h2 id="short-answer">What actually changed</h2>
              <p>
                Every MCP protocol version is named after the date its last
                backwards-incompatible change shipped. The current version,
                published under that scheme, is <strong>2026-07-28</strong>.
                Compared to the previous revision (2025-11-25), it is not a
                small update. Three things moved together:
              </p>
              <ul>
                <li>
                  <strong>No more handshake.</strong> The{' '}
                  <code>initialize</code> request, the <code>initialized</code>{' '}
                  notification, and protocol-level sessions (including the{' '}
                  <code>Mcp-Session-Id</code> header on HTTP) are gone. Every
                  request now declares its own protocol version and capabilities
                  in a <code>_meta</code> field, and a server answers each one
                  without assuming anything about requests that came before it.
                </li>
                <li>
                  <strong>A new discovery method.</strong>{' '}
                  <code>server/discover</code> is now mandatory for servers to
                  implement. It is the closest thing to an{' '}
                  <code>initialize</code> response left, a single request that
                  returns a server&rsquo;s supported versions, capabilities, and
                  identity.
                </li>
                <li>
                  <strong>No more server-initiated requests.</strong> A server
                  that needs a sampling completion, an elicitation answer, or a
                  client&rsquo;s roots list can no longer send its own JSON-RPC
                  request mid-flight. It uses a new pattern called Multi
                  Round-Trip Requests (MRTR) instead.
                </li>
              </ul>
              <p>
                None of this makes older servers or clients invalid. The spec
                calls the pre-2026-07-28 style <strong>legacy</strong> and the
                new style <strong>modern</strong>, and it spends a whole section
                on how the two interoperate. That section is worth
                understanding, because most MCP servers in the wild today were
                built for the legacy handshake, and that will remain true for a
                while.
              </p>

              <h2 id="why-stateless">Why MCP went stateless</h2>
              <p>
                The handshake model had a real cost: it made an MCP server a
                stateful thing. Once a client completed <code>initialize</code>,
                the server had to remember that client&rsquo;s negotiated
                protocol version and capabilities for the life of the
                connection. For a stdio server running as a local subprocess,
                that is free. For a remote server sitting behind a load balancer
                with multiple instances, it is not, the load balancer has to
                keep pinning a given client to the same instance, or every
                instance has to share session state somewhere.
              </p>
              <p>
                The specification now states this directly: MCP is a stateless
                protocol, and all the information needed to process a request is
                contained in the request itself. A server cannot infer
                capabilities, protocol version, or client identity from prior
                requests, even ones sent over the same connection. Two
                consequences follow that are worth internalizing:
              </p>
              <ul>
                <li>
                  An open connection (a stdio process, an HTTP origin) is not a
                  session or a conversation. A client is allowed to interleave
                  unrelated requests on the same transport, and a server must
                  not treat &ldquo;same connection&rdquo; as a proxy for
                  &ldquo;same conversation.&rdquo;
                </li>
                <li>
                  Anything that genuinely needs to span multiple requests (a
                  long-running job, an application-level handle) has to be
                  passed explicitly, by an identifier the client sends on every
                  request that needs it, not held implicitly by the server.
                </li>
              </ul>

              <h2 id="discovery">server/discover replaces initialize</h2>
              <p>
                Since there is no handshake, there is no required first message
                either. A modern client is free to send any request straight
                away and handle an error if its protocol version is not
                supported. But calling <code>server/discover</code> first is
                useful, and on some transports it is the only reliable way to
                tell a modern server from a legacy one before you commit to a
                request shape.
              </p>
              <CopyBlock
                title="server/discover request"
                language="json"
                code={`{
  "jsonrpc": "2.0",
  "id": "discover-1",
  "method": "server/discover",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientInfo": { "name": "ExampleClient", "version": "1.0.0" },
      "io.modelcontextprotocol/clientCapabilities": {}
    }
  }
}`}
              />
              <CopyBlock
                title="server/discover response"
                language="json"
                code={`{
  "jsonrpc": "2.0",
  "id": "discover-1",
  "result": {
    "resultType": "complete",
    "supportedVersions": ["2026-07-28"],
    "capabilities": { "tools": {}, "resources": {} },
    "_meta": {
      "io.modelcontextprotocol/serverInfo": { "name": "ExampleServer", "version": "1.0.0" }
    },
    "instructions": "This server provides weather and resource utilities.",
    "ttlMs": 3600000,
    "cacheScope": "public"
  }
}`}
              />
              <p>
                Every request that follows carries its own protocol version and
                capabilities the same way, inside <code>_meta</code>, using
                reserved keys under the <code>io.modelcontextprotocol/</code>{' '}
                prefix:
              </p>
              <table>
                <thead>
                  <tr>
                    <th>_meta key</th>
                    <th>Required</th>
                    <th>Carries</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <code>io.modelcontextprotocol/protocolVersion</code>
                    </td>
                    <td>Yes</td>
                    <td>
                      The protocol version this request uses (e.g.{' '}
                      <code>&quot;2026-07-28&quot;</code>)
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <code>io.modelcontextprotocol/clientCapabilities</code>
                    </td>
                    <td>Yes</td>
                    <td>The capabilities relevant to this specific request</td>
                  </tr>
                  <tr>
                    <td>
                      <code>io.modelcontextprotocol/clientInfo</code>
                    </td>
                    <td>No, but should be sent</td>
                    <td>Client name and version</td>
                  </tr>
                  <tr>
                    <td>
                      <code>io.modelcontextprotocol/logLevel</code>
                    </td>
                    <td>No</td>
                    <td>
                      Minimum log level the server should emit for this request
                    </td>
                  </tr>
                </tbody>
              </table>
              <p>
                If a server does not support the requested version, it returns
                an <code>UnsupportedProtocolVersionError</code> (JSON-RPC code{' '}
                <code>-32022</code>) listing what it does support, and the
                client retries with a mutually agreeable version. If a request
                is missing a capability the server needs, the server returns{' '}
                <code>MissingRequiredClientCapabilityError</code> (
                <code>-32021</code>) instead of guessing.
              </p>

              <h2 id="mrtr">Multi Round-Trip Requests</h2>
              <p>
                This is the change most likely to affect real server code. Under
                the legacy handshake, a server could pause mid-request and send
                the client its own request, asking for a sampling completion (
                <code>sampling/createMessage</code>), a piece of user input (
                <code>elicitation/create</code>), or the client&rsquo;s
                workspace roots (<code>roots/list</code>). That only works if
                the connection is a stateful, two-way channel the server can
                write to whenever it wants. A stateless server behind a load
                balancer cannot assume that.
              </p>
              <p>
                <strong>Multi Round-Trip Requests (MRTR)</strong> replaces it.
                Instead of the server sending a request, it answers the
                client&rsquo;s original request with a special result:
              </p>
              <CopyBlock
                title="InputRequiredResult"
                language="json"
                code={`{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resultType": "input_required",
    "inputRequests": {
      "github_login": {
        "method": "elicitation/create",
        "params": {
          "message": "Please provide your GitHub username",
          "requestedSchema": {
            "type": "object",
            "properties": { "name": { "type": "string" } },
            "required": ["name"]
          }
        }
      }
    },
    "requestState": "AEAD-protected blob"
  }
}`}
              />
              <p>
                The client gathers whatever the <code>inputRequests</code> map
                asks for (a sampling completion, an elicitation answer, a roots
                list, possibly more than one at once), then retries the{' '}
                <strong>same original request</strong> under a new JSON-RPC{' '}
                <code>id</code>, this time supplying an{' '}
                <code>inputResponses</code> map keyed the same way, plus the
                exact <code>requestState</code> value it was handed. The client
                never parses or modifies <code>requestState</code>, it is opaque
                to the client by design, the server encodes whatever it needs to
                resume processing into that string (base64 JSON, an encrypted
                token, anything), which is what lets the server stay stateless
                between the two requests. If a load balancer routes the retry to
                a completely different server instance, that instance can still
                resume correctly, because everything it needs travels with the
                request.
              </p>
              <p>
                <code>tools/call</code>, <code>resources/read</code>, and{' '}
                <code>prompts/get</code> are the only requests a server is
                allowed to answer this way. A server also cannot send an{' '}
                <code>inputRequests</code> entry the client has not declared
                support for, if a client never declared the{' '}
                <code>elicitation</code> capability, the server cannot ask for
                one. And because
                <code>requestState</code> round-trips through the client, the
                spec requires servers to treat it as attacker-controlled input:
                if it influences authorization or business logic, it must be
                integrity-protected (HMAC or AEAD) and validated on every retry,
                including a short expiry and a binding to the original request,
                to prevent replay.
              </p>

              <h2 id="playground">Try it yourself</h2>
              <p>
                The two tools below are built directly from the examples in the
                specification. The first steps through an MRTR exchange end to
                end, including what changes if the user declines or cancels
                instead of answering. The second reproduces the protocol&rsquo;s
                own client/server compatibility matrix so you can check a
                specific pairing before you build a fallback path.
              </p>
              <div style={{ margin: '1.5rem 0 2rem' }}>
                <MCPVersioningPlayground />
              </div>

              <h2 id="deprecated">What is now deprecated</h2>
              <p>
                A few features did not survive this revision intact. They are
                still functional during the deprecation window (a minimum of
                twelve months under MCP&rsquo;s feature lifecycle policy), but
                new implementations should not build on them:
              </p>
              <ul>
                <li>
                  <strong>Roots, Sampling, and Logging</strong> are deprecated
                  as client capabilities. The suggested replacements: pass
                  directories or files as ordinary tool arguments, resource
                  URIs, or server configuration instead of Roots; call your LLM
                  provider&rsquo;s API directly instead of routing completions
                  through Sampling; write to <code>stderr</code> (stdio) or emit
                  OpenTelemetry instead of the Logging capability. All three
                  still work under MRTR if you keep using them, they are simply
                  not where new server design should start.
                </li>
                <li>
                  <strong>The HTTP+SSE transport</strong> (from protocol version
                  2024-11-05) is now formally Deprecated rather than just
                  discouraged. New servers should build on Streamable HTTP.
                </li>
                <li>
                  <strong>OAuth 2.0 Dynamic Client Registration</strong> is
                  deprecated as a client registration mechanism in favor of
                  Client ID Metadata Documents, though it remains available for
                  authorization servers that do not yet support the newer
                  approach.
                </li>
                <li>
                  <strong>Experimental tasks</strong> moved out of the core
                  protocol entirely and into an official extension (
                  <code>io.modelcontextprotocol/tasks</code>), with polling (
                  <code>tasks/get</code>, <code>tasks/update</code>) replacing
                  the old blocking <code>tasks/result</code> call.
                </li>
              </ul>

              <h2 id="state">Handling state without a session</h2>
              <p>
                If your server used to lean on the session for anything, an
                uploaded file handle, a paginated cursor, a partially built
                object, that state now has to travel explicitly. The pattern the
                spec points to is a server-minted handle passed back and forth
                as an ordinary tool argument: your server returns an opaque
                identifier from one call, and the client supplies it as a
                parameter on the next one. It is the same idea as{' '}
                <code>requestState</code> in MRTR, just used for your own
                application logic instead of elicitation or sampling.
              </p>
              <p>
                List endpoints changed too. Since there is no session,{' '}
                <code>tools/list</code>, <code>resources/list</code>, and{' '}
                <code>prompts/list</code> no longer vary per connection, and
                their results (along with <code>resources/read</code>) now carry
                required <code>ttlMs</code> and <code>cacheScope</code> fields
                so clients know how long a response is safe to cache and whether
                shared intermediaries are allowed to cache it at all. Change
                notifications moved from a standalone SSE stream to a single
                opt-in <code>subscriptions/listen</code> request that stays open
                and tags each notification with a <code>subscriptionId</code> so
                the client can tell them apart.
              </p>

              <h2 id="compatibility">Supporting both eras</h2>
              <p>
                The spec is precise about how a modern implementation should
                behave toward a legacy one, and vice versa, using the
                compatibility checker above as reference. A few rules matter
                most in practice:
              </p>
              <ul>
                <li>
                  <strong>Detection is per-server, not per-request.</strong>{' '}
                  Once your client figures out whether a given server is modern
                  or legacy, cache that result for the life of the process
                  (stdio) or origin (HTTP) rather than re-probing on every call.
                </li>
                <li>
                  <strong>On stdio</strong>, probe by sending{' '}
                  <code>server/discover</code> first. A real{' '}
                  <code>DiscoverResult</code> means modern. A recognized modern
                  error (like <code>UnsupportedProtocolVersionError</code>)
                  still means modern, just retry with a supported version.
                  Anything else, an unrecognized-method error or a timeout,
                  means legacy: fall back to <code>initialize</code>.
                </li>
                <li>
                  <strong>On Streamable HTTP</strong>, attempt a modern request
                  first and inspect a <code>400</code> response body before
                  falling back. A recognized modern JSON-RPC error in that body
                  still means modern. An empty or unrecognized body means
                  legacy, fall back to <code>initialize</code>, and if that also
                  fails, to the deprecated HTTP+SSE transport as a last resort.
                </li>
                <li>
                  <strong>Legacy clients cannot be rescued.</strong> If your
                  client only knows how to send <code>initialize</code> and the
                  server only speaks the modern revision, there is no
                  fall-forward path. The server will reject the handshake
                  outright. The only fix is upgrading the client.
                </li>
              </ul>

              <h2 id="transports">stdio &amp; Streamable HTTP changes</h2>
              <p>
                The wire-level mechanics changed alongside the lifecycle. On{' '}
                <strong>stdio</strong>, framing is unchanged (newline-delimited
                JSON-RPC over stdin/stdout), but the server can no longer write
                a JSON-RPC request of its own to stdout, server-to-client
                interactions are carried entirely inside{' '}
                <code>InputRequiredResult</code> replies instead.
              </p>
              <p>
                On <strong>Streamable HTTP</strong>, the standalone{' '}
                <code>GET</code> stream and the <code>Mcp-Session-Id</code>{' '}
                header are gone, along with SSE stream resumability via{' '}
                <code>Last-Event-ID</code>. Every request is its own POST,
                answered with either a single JSON object or an SSE stream
                scoped to that one request. Every POST must also carry an{' '}
                <code>MCP-Protocol-Version</code> header matching the{' '}
                <code>_meta</code> value in the body, plus{' '}
                <code>Mcp-Method</code> and (for <code>tools/call</code>,{' '}
                <code>resources/read</code>, <code>prompts/get</code>) an{' '}
                <code>Mcp-Name</code> header, so proxies and load balancers can
                route and log requests without parsing JSON bodies. A mismatch
                between a header and the body it describes is now its own error,{' '}
                <code>HeaderMismatch</code> (<code>-32020</code>), returned as a{' '}
                <code>400</code>.
              </p>

              <h2 id="checklist">What to actually do this week</h2>
              <table>
                <thead>
                  <tr>
                    <th>If you maintain&hellip;</th>
                    <th>Do this</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>An MCP server on an official SDK</td>
                    <td>
                      Check the SDK&rsquo;s changelog for 2026-07-28 support
                      before touching your own code. The SDK should absorb{' '}
                      <code>_meta</code>, <code>server/discover</code>, and MRTR
                      for you.
                    </td>
                  </tr>
                  <tr>
                    <td>A hand-rolled server or client</td>
                    <td>
                      Implement <code>server/discover</code> (mandatory for
                      servers), add the per-request <code>_meta</code> fields,
                      and rework any server-initiated sampling/elicitation/roots
                      calls into the MRTR pattern.
                    </td>
                  </tr>
                  <tr>
                    <td>A server still using Roots, Sampling, or Logging</td>
                    <td>
                      Nothing breaks today, but plan the migration described
                      above; the deprecation clock is already running.
                    </td>
                  </tr>
                  <tr>
                    <td>A client meant to work broadly</td>
                    <td>
                      Build the dual-era probe: <code>server/discover</code> on
                      stdio, an inspected <code>400</code> on HTTP, cached per
                      server for the life of the connection.
                    </td>
                  </tr>
                  <tr>
                    <td>Anything on the deprecated HTTP+SSE transport</td>
                    <td>
                      Start migrating to Streamable HTTP; HTTP+SSE is now
                      formally Deprecated and eligible for future removal.
                    </td>
                  </tr>
                </tbody>
              </table>

              <div style={{ marginTop: '2rem', marginBottom: '2.5rem' }}>
                <FaqSection
                  title="Frequently Asked Questions"
                  items={faqs.map((f) => ({ question: f.q, answer: f.a }))}
                />
              </div>

              <p style={{ marginTop: '2rem' }}>
                <strong>Next steps:</strong> new to MCP entirely? Start with{' '}
                <Link href="/what-is-mcp">What is an MCP?</Link> Building a
                server against these changes? See{' '}
                <Link href="/build-mcp-server">How to Build an MCP Server</Link>{' '}
                and{' '}
                <Link href="/deploy-mcp-server">
                  Deploying Remote MCP Servers
                </Link>
                . Hitting connection errors while an implementation catches up?
                Check{' '}
                <Link href="/mcp-troubleshooting">MCP Troubleshooting</Link>, or
                browse all <Link href="/guides">MCP guides</Link>.
              </p>
            </div>
          </div>

          <div className="hidden lg:block h-full">
            <TableOfContents items={tocItems} />
          </div>
        </div>
      </div>
    </main>
  );
}
