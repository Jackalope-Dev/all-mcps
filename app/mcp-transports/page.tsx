import type { Metadata } from 'next';
import Link from 'next/link';
import { CopyBlock } from '@/components/ui/CopyBlock';
import { FaqSection } from '@/components/ui/FaqSection';
import { TableOfContents, type TocItem } from '@/components/ui/TableOfContents';
import { serializeJsonLd } from '@/lib/jsonLd';

export const metadata: Metadata = {
  title: 'MCP Transports Explained: stdio vs Streamable HTTP',
  description:
    'How MCP servers actually talk to clients: the stdio transport, Streamable HTTP, and the deprecated HTTP+SSE model. Which to choose, what breaks on each, and how to support both during the deprecation window.',
  alternates: {
    canonical: 'https://allmcps.com/mcp-transports',
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
    title: 'MCP Transports Explained: stdio vs Streamable HTTP | AllMCPs',
    description:
      'The stdio transport, Streamable HTTP, and the deprecated HTTP+SSE model — which to choose, what breaks on each, and how to support both.',
    url: 'https://allmcps.com/mcp-transports',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MCP Transports Explained: stdio vs Streamable HTTP | AllMCPs',
    description:
      'The stdio transport, Streamable HTTP, and the deprecated HTTP+SSE model — which to choose, what breaks on each, and how to support both.',
  },
};

const faqs = [
  {
    q: 'Which MCP transport should I use?',
    a: 'If the server needs access to the machine the user is sitting at — their filesystem, their shell, their local database, their SSH keys — use stdio. It runs as a child process of the client, inherits that user’s permissions, and never opens a network port. If the server is a shared service that multiple people or agents connect to, use Streamable HTTP. The deciding question is whose machine the work happens on, not how complex the server is.',
  },
  {
    q: 'Is HTTP+SSE still supported in MCP?',
    a: 'It is deprecated, not removed. The 2026-07-28 revision marked the HTTP+SSE transport discouraged in favour of Streamable HTTP, and MCP’s feature lifecycle policy gives deprecated features a minimum twelve-month window before removal is considered. Existing servers keep working, but new servers should build on Streamable HTTP, and clients should attempt the modern transport first and fall back only on failure.',
  },
  {
    q: 'Why did HTTP+SSE get deprecated?',
    a: 'Because it split one logical conversation across two endpoints plus a session identifier. The client opened a long-lived GET /sse stream, received a session-scoped POST URL, and every response came back down that original stream. That forced the POST and the stream to reach the same process, which meant sticky sessions on every load balancer, dropped conversations on every deploy, and a socket held open per conversation. Streamable HTTP gives each request its own response and removes the requirement entirely.',
  },
  {
    q: 'Can a stdio server write to stdout?',
    a: 'Only protocol messages. On stdio, stdout is the wire — newline-delimited JSON-RPC and nothing else. A stray console.log, a dependency’s startup banner, or a progress bar written to stdout corrupts the message stream and produces parse errors that look random and are very hard to trace. All diagnostics go to stderr, which the client captures as logs and which is also the replacement for the deprecated Logging capability.',
  },
  {
    q: 'Does my server need to support more than one transport?',
    a: 'Usually not. Most servers are clearly local or clearly remote, and supporting one transport well beats supporting two badly. The exception is a server already deployed on HTTP+SSE that is migrating to Streamable HTTP, where both run side by side until legacy traffic reaches zero. Even then, only the transport layer should know the difference — tool handlers should be identical across both.',
  },
  {
    q: 'Why does my remote MCP server stream fine locally but not in production?',
    a: 'Something between the client and your server is buffering the response. A streamed Streamable HTTP response is a single HTTP response, so any proxy, CDN, or compression middleware that buffers response bodies will hold it until your handler finishes — turning incremental events into one delayed blob or a gateway timeout. Disable response buffering on the MCP route (proxy_buffering off in Nginx, or the X-Accel-Buffering: no header) and test through the real edge rather than localhost.',
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
  headline: 'MCP Transports Explained: stdio vs Streamable HTTP',
  description:
    'A complete explanation of the Model Context Protocol transports: how stdio framing works, what Streamable HTTP changed, why the HTTP+SSE dual-endpoint model was deprecated, and how to choose and operate each one.',
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
      name: 'MCP Transports',
      item: 'https://allmcps.com/mcp-transports',
    },
  ],
};

const tocItems: TocItem[] = [
  { id: 'short-answer', text: 'The short answer' },
  { id: 'stdio', text: 'stdio: the local transport' },
  { id: 'streamable-http', text: 'Streamable HTTP: the remote transport' },
  { id: 'http-sse', text: 'HTTP+SSE and why it was deprecated' },
  { id: 'choosing', text: 'Choosing between them' },
  { id: 'failure-modes', text: 'Failure modes by transport' },
  { id: 'both', text: 'Supporting both during migration' },
  { id: 'faq', text: 'FAQ' },
];

export default function MCPTransportsPage() {
  return (
    <main className="page-shell page-shell--default">
      <div className="page-shell-inner">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(techArticleJsonLd),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(breadcrumbJsonLd),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqJsonLd) }}
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
                MCP Transports
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
                MCP Transports Explained
              </h1>
              <p className="text-lead" style={{ margin: 0 }}>
                A transport is how an MCP client and server physically exchange
                messages, and it is the single decision that most affects how
                your server is installed, secured, and scaled. There are two you
                should build on — <strong>stdio</strong> and{' '}
                <strong>Streamable HTTP</strong> — and one you should be
                migrating away from.
              </p>
            </div>

            <div className="lg:hidden" style={{ marginBottom: '2rem' }}>
              <TableOfContents items={tocItems} />
            </div>

            <div className="markdown-body">
              <h2 id="short-answer">The short answer</h2>
              <p>
                MCP separates <em>what</em> a server exposes (tools, resources,
                prompts) from <em>how</em> the messages get there. The protocol
                is JSON-RPC either way; the transport decides where the server
                runs and who can reach it.
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Transport</th>
                    <th>Server runs</th>
                    <th>Use when</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>stdio</strong>
                    </td>
                    <td>As a child process of the client</td>
                    <td>
                      The work happens on the user&rsquo;s own machine —
                      filesystem, shell, local database
                    </td>
                    <td>Current</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Streamable HTTP</strong>
                    </td>
                    <td>As a network service</td>
                    <td>
                      One server is shared by many users, agents, or teams
                    </td>
                    <td>Current</td>
                  </tr>
                  <tr>
                    <td>HTTP+SSE</td>
                    <td>As a network service, dual-endpoint</td>
                    <td>Existing deployments only</td>
                    <td>Deprecated</td>
                  </tr>
                </tbody>
              </table>
              <p>
                The deciding question is not how complex your server is. It is{' '}
                <strong>whose machine the work happens on</strong>. A server
                that reads local files cannot be remote, and a server that
                fronts a shared production database should not be spawned
                separately on every laptop.
              </p>

              <h2 id="stdio">stdio: the local transport</h2>
              <p>
                With stdio, the client launches your server as a subprocess and
                talks to it over standard input and output. There is no port, no
                URL, and no network exposure at all. This is what the config
                blocks in{' '}
                <Link href="/mcp-for-claude-desktop">Claude Desktop</Link>,{' '}
                <Link href="/mcp-for-cursor">Cursor</Link>, and{' '}
                <Link href="/mcp-for-windsurf">Windsurf</Link> describe when
                they specify a <code>command</code> and <code>args</code>:
              </p>
              <CopyBlock
                language="json"
                code={`{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/me/projects"]
    }
  }
}`}
              />
              <p>
                Framing is newline-delimited JSON-RPC: one message per line, in
                both directions. That framing did not change in the 2026-07-28
                revision, which makes stdio the most stable surface in the
                protocol.
              </p>
              <p>
                The security model is inherited rather than configured. The
                server runs as the user who launched the client, with that
                user&rsquo;s permissions — which is exactly why a stdio server
                deserves the same scrutiny as any program you would run
                directly. Our <Link href="/mcp-security">security guide</Link>{' '}
                covers what to check before granting that access.
              </p>
              <p>
                <strong>The one rule that catches everyone:</strong> on stdio,
                stdout belongs to the protocol. Anything else written there — a{' '}
                <code>console.log</code>, a dependency&rsquo;s startup banner, a
                progress bar — lands in the middle of the JSON-RPC stream and
                corrupts it. Diagnostics go to stderr, which the client captures
                as logs. This is also where the deprecated Logging capability
                went: write to stderr or emit OpenTelemetry instead.
              </p>

              <h2 id="streamable-http">
                Streamable HTTP: the remote transport
              </h2>
              <p>
                Streamable HTTP is the current transport for servers that run
                somewhere else. One endpoint accepts JSON-RPC requests, and each
                request gets its own response — either a plain JSON body or a
                stream scoped to that single request.
              </p>
              <CopyBlock
                language="http"
                code={`POST /mcp HTTP/1.1
Host: mcp.example.com
Content-Type: application/json
Accept: application/json, text/event-stream

{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search","arguments":{"q":"postgres"}}}`}
              />
              <p>
                The <code>Accept</code> header is the negotiation. The client
                declares it can handle either shape, and the server chooses per
                request: a fast tool answers with <code>application/json</code>,
                while a long-running one streams progress events that belong to
                that one call and end with it.
              </p>
              <p>
                What matters operationally is what is <em>absent</em>. There is
                no standalone stream held open between requests, so idle
                timeouts stop being a protocol concern. There is no session
                identifier, so nothing needs to be remembered between requests.
                And because two requests from the same client need not reach the
                same process, you can scale horizontally without session
                affinity.
              </p>

              <h2 id="http-sse">HTTP+SSE and why it was deprecated</h2>
              <p>
                The older remote transport split one conversation across two
                endpoints. The client opened a long-lived <code>GET /sse</code>{' '}
                stream, the server pushed back a session-scoped POST URL, and
                every subsequent request went to that URL while its response
                came back down the original stream.
              </p>
              <p>
                Three consequences followed, and each one became a production
                problem:
              </p>
              <ul>
                <li>
                  <strong>The stream had to outlive every request.</strong> One
                  socket stayed open for the whole conversation, and had to
                  survive every proxy and idle timeout in between — many of
                  which default to sixty seconds, shorter than plenty of
                  legitimate tool calls.
                </li>
                <li>
                  <strong>
                    The POST and its stream had to reach the same process.
                  </strong>{' '}
                  That forced session affinity on the load balancer, which meant
                  deploys dropped in-flight conversations and scaling stopped
                  being transparent.
                </li>
                <li>
                  <strong>The session identifier was real state.</strong>{' '}
                  Something had to map that id to an open socket on a specific
                  instance, with all the eviction and recovery questions that
                  implies.
                </li>
              </ul>
              <p>
                The{' '}
                <Link href="/mcp-protocol-versioning">2026-07-28 revision</Link>{' '}
                marked HTTP+SSE discouraged for exactly this reason. It is
                deprecated rather than removed, and MCP&rsquo;s feature
                lifecycle policy gives deprecated features at least twelve
                months — but no new server should be built on it. If you are
                running one today, the{' '}
                <Link href="/blog/migrating-mcp-servers-http-sse-to-streamable-http">
                  migration walkthrough
                </Link>{' '}
                covers running both transports side by side until legacy traffic
                reaches zero.
              </p>

              <h2 id="choosing">Choosing between them</h2>
              <p>Work down this list and stop at the first one that applies:</p>
              <ul>
                <li>
                  <strong>
                    Does the server need the user&rsquo;s own machine?
                  </strong>{' '}
                  Local files, shell access, a database on localhost, the
                  user&rsquo;s SSH keys or git credentials — that is stdio, and
                  nothing else will do.
                </li>
                <li>
                  <strong>
                    Do multiple people or agents share one instance?
                  </strong>{' '}
                  A team-wide connector, an internal API gateway, anything with
                  centrally-held credentials — Streamable HTTP.
                </li>
                <li>
                  <strong>
                    Do you need to update it without redistribution?
                  </strong>{' '}
                  A remote server is deployed once; a stdio server is
                  re-installed by every user, on their own schedule, forever.
                </li>
                <li>
                  <strong>Is a browser the client?</strong> Then it is
                  necessarily remote, and CORS becomes part of your problem.
                </li>
              </ul>
              <p>
                When both would work, stdio is the smaller commitment: no
                hosting, no authentication surface, no uptime obligation. A
                remote server is a production service, with everything that
                implies — see{' '}
                <Link href="/deploy-mcp-server">
                  Deploying Remote MCP Servers
                </Link>{' '}
                and{' '}
                <Link href="/securing-remote-mcp-servers-authentication-guide">
                  Securing &amp; Authenticating Remote MCP Servers
                </Link>
                .
              </p>

              <h2 id="failure-modes">Failure modes by transport</h2>
              <p>
                Most &ldquo;my MCP server won&rsquo;t connect&rdquo; reports
                resolve to one of these, and which transport you are on narrows
                it immediately.
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Symptom</th>
                    <th>Transport</th>
                    <th>Usual cause</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <code>spawn npx ENOENT</code>
                    </td>
                    <td>stdio</td>
                    <td>
                      The GUI client was launched with a minimal PATH and cannot
                      find the binary. Use an absolute path in{' '}
                      <code>command</code>.
                    </td>
                  </tr>
                  <tr>
                    <td>Random JSON parse errors</td>
                    <td>stdio</td>
                    <td>
                      Something wrote non-protocol output to stdout. Move all
                      logging to stderr.
                    </td>
                  </tr>
                  <tr>
                    <td>Connects, then drops after ~60s</td>
                    <td>HTTP+SSE</td>
                    <td>
                      A proxy idle timeout closed the long-lived stream. A
                      reason to migrate rather than tune.
                    </td>
                  </tr>
                  <tr>
                    <td>Works locally, stalls in production</td>
                    <td>Streamable HTTP</td>
                    <td>
                      A proxy or compression layer is buffering the response
                      body. Disable response buffering on the MCP route.
                    </td>
                  </tr>
                  <tr>
                    <td>Requests fail after scaling up</td>
                    <td>HTTP+SSE</td>
                    <td>
                      The POST reached an instance that does not hold the
                      stream. Sticky sessions, or migrate.
                    </td>
                  </tr>
                </tbody>
              </table>
              <p>
                For the full diagnostic tree, see{' '}
                <Link href="/mcp-troubleshooting">MCP Troubleshooting</Link>. To
                inspect a live server&rsquo;s handshake and tool list directly,
                the{' '}
                <Link href="/tools/protocol-inspector">protocol inspector</Link>{' '}
                speaks both remote transports.
              </p>

              <h2 id="both">Supporting both during migration</h2>
              <p>
                A server already deployed on HTTP+SSE should keep answering it
                while adding the modern endpoint. The rule that keeps this
                maintainable is that{' '}
                <strong>
                  only the transport layer knows which era a caller belongs to
                </strong>{' '}
                — both paths hand off to the same tool implementations, and no
                tool handler ever branches on transport.
              </p>
              <p>
                Detection belongs per connection or origin, not per call.
                Clients on the current revision send{' '}
                <code>io.modelcontextprotocol/protocolVersion</code> in every
                request&rsquo;s <code>_meta</code>; legacy clients complete an{' '}
                <code>initialize</code> handshake and never send that field.
                Cache the answer for the life of the process rather than
                re-probing.
              </p>
              <p>
                One check worth running against production, since it fails
                loudly when a proxy is buffering:
              </p>
              <CopyBlock
                language="bash"
                code={`curl -N -X POST https://mcp.example.com/mcp \\
  -H 'Content-Type: application/json' \\
  -H 'Accept: text/event-stream' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`}
              />
              <p>
                With <code>-N</code> disabling curl&rsquo;s own buffering,
                events should arrive incrementally. If they all land at once
                when the call completes, something between you and the server is
                buffering, and your code is not the problem.
              </p>

              <div style={{ marginTop: '2rem', marginBottom: '2.5rem' }}>
                <FaqSection
                  title="Frequently Asked Questions"
                  items={faqs.map((f) => ({ question: f.q, answer: f.a }))}
                />
              </div>

              <p style={{ marginTop: '2rem' }}>
                <strong>Next steps:</strong> new to MCP entirely? Start with{' '}
                <Link href="/what-is-mcp">What is an MCP?</Link> Writing your
                first server? See{' '}
                <Link href="/build-mcp-server">How to Build an MCP Server</Link>
                . Moving one off HTTP+SSE? Follow the{' '}
                <Link href="/blog/migrating-mcp-servers-http-sse-to-streamable-http">
                  migration walkthrough
                </Link>
                . Or browse all <Link href="/guides">MCP guides</Link> and{' '}
                <Link href="/browse">the directory</Link>.
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
