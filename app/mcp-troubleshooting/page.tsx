import { Metadata } from 'next';
import Link from 'next/link';
import { TableOfContents, TocItem } from '@/components/ui/TableOfContents';
import { CopyBlock } from '@/components/ui/CopyBlock';

export const metadata: Metadata = {
  title: 'MCP Troubleshooting: Server Not Connecting, Zero Tools, Timeouts',
  description:
    'Fix MCP server not connecting, zero tools, PATH errors, stdout corruption, missing env vars, and timeouts — Claude Desktop, Cursor, Claude Code, Windsurf, and more.',
  alternates: {
    canonical: 'https://allmcps.com/mcp-troubleshooting',
  },
  openGraph: {
    title: 'MCP Troubleshooting: Server Not Connecting, Zero Tools, Timeouts | AllMCPs',
    description:
      'Fix MCP server not connecting, zero tools, PATH errors, stdout corruption, missing env vars, and timeouts across every major client.',
    url: 'https://allmcps.com/mcp-troubleshooting',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MCP Troubleshooting: Server Not Connecting, Zero Tools, Timeouts | AllMCPs',
    description:
      'Fix MCP server not connecting, zero tools, PATH errors, stdout corruption, missing env vars, and timeouts across every major client.',
  },
};

const faqs = [
  {
    q: 'Why is my MCP server not connecting?',
    a: 'Almost always one of: invalid JSON in the client config, the launch command not found on the client PATH, a server that crashes before answering initialize/tools/list, non-JSON text written to stdout on stdio transport, or the client never restarted after the config change. Find the MCP log first — the UI status alone is rarely enough.',
  },
  {
    q: 'Why does my MCP server show zero tools?',
    a: 'The process started but failed before (or during) tools/list. Common causes are missing environment variables, an exception in server startup, wrong working directory, or stdout pollution corrupting the JSON-RPC stream. Check the client’s MCP log for that server’s stderr output.',
  },
  {
    q: 'Where are Claude Desktop MCP logs?',
    a: 'On macOS, logs are typically under ~/Library/Logs/Claude/. On Windows, check %APPDATA%\\Claude\\logs\\. Look for MCP-related files and the stderr of the specific server process, not only the main app log.',
  },
  {
    q: 'Why does Cursor or Claude Desktop say command not found for npx?',
    a: 'GUI apps often launch with a minimal PATH that does not include nvm, fnm, Homebrew, or your shell profile. Use absolute paths to node/npx in the config command field, or start the client from a terminal so it inherits your shell environment.',
  },
  {
    q: 'Can console.log break an MCP server?',
    a: 'Yes on stdio transport. stdout is reserved for JSON-RPC frames. Any console.log, print(), or library that writes to stdout can corrupt the stream so the client hangs or reports a parse error. Log only to stderr (console.error / logging to stderr).',
  },
  {
    q: 'How do I validate my MCP client config?',
    a: 'Paste the JSON into the free AllMCPs config validator, or lint it as strict JSON (no trailing commas, no comments). Then confirm each server entry has a command (or url for remote servers) and that args is an array of strings.',
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

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'TechArticle',
  headline: 'MCP Troubleshooting: Server Not Connecting, Zero Tools, Timeouts',
  description:
    'Practical troubleshooting guide for Model Context Protocol servers — connection failures, zero tools, PATH issues, stdout corruption, env vars, and timeouts.',
  author: { '@type': 'Organization', name: 'Jackalope Digital LLC' },
  publisher: { '@type': 'Organization', name: 'AllMCPs' },
  isPartOf: { '@type': 'CollectionPage', name: 'MCP Guides', '@id': 'https://allmcps.com/guides' },
};

const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Guides', item: 'https://allmcps.com/guides' },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'MCP Troubleshooting',
      item: 'https://allmcps.com/mcp-troubleshooting',
    },
  ],
};

const howToJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'How to troubleshoot an MCP server that will not connect',
  description: 'A five-step process to diagnose and fix MCP connection failures.',
  step: [
    {
      '@type': 'HowToStep',
      name: 'Open the client MCP log',
      text: 'Locate the MCP-specific log for your client and copy the exact error for the failing server.',
    },
    {
      '@type': 'HowToStep',
      name: 'Validate the config JSON',
      text: 'Ensure the client config is valid JSON and each server entry has a command or remote URL.',
    },
    {
      '@type': 'HowToStep',
      name: 'Run the server command in a terminal',
      text: 'Execute the same command and args outside the client to see crashes, missing binaries, or env errors.',
    },
    {
      '@type': 'HowToStep',
      name: 'Check PATH and environment variables',
      text: 'Use absolute paths if the GUI client cannot find npx/node, and supply required env vars in the config.',
    },
    {
      '@type': 'HowToStep',
      name: 'Restart the client fully',
      text: 'Quit and reopen the host app after config changes so MCP servers are relaunched cleanly.',
    },
  ],
};

const tocItems: TocItem[] = [
  { id: 'quick-map', text: 'Symptom → likely cause' },
  { id: 'logs', text: 'Find the real error (logs)' },
  { id: 'config', text: 'Config JSON mistakes' },
  { id: 'path', text: 'PATH and command not found' },
  { id: 'zero-tools', text: 'Zero tools / silent crash' },
  { id: 'stdout', text: 'Stdout corruption (stdio)' },
  { id: 'env', text: 'Missing env vars & secrets' },
  { id: 'timeouts', text: 'Timeouts & hanging tools' },
  { id: 'remote', text: 'Remote HTTP/SSE failures' },
  { id: 'checklist', text: 'Fix checklist' },
  { id: 'deeper', text: 'Deeper guides & tools' },
  { id: 'faq', text: 'FAQ' },
];

export default function McpTroubleshootingPage() {
  return (
    <main className="page-shell page-shell--default">
      <div className="page-shell-inner">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
        />

        <div className="lg:grid lg:grid-cols-[1fr_260px] lg:gap-10">
          <div className="surface page-panel min-w-0">
            <nav aria-label="Breadcrumb" style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
              <Link href="/guides" style={{ color: 'var(--text-secondary)' }}>
                Guides
              </Link>
              <span style={{ color: 'var(--text-secondary)', margin: '0 0.4rem' }}>/</span>
              <span style={{ color: 'var(--text-primary)' }}>MCP Troubleshooting</span>
            </nav>

            <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto 2.5rem' }}>
              <h1 className="text-page-title" style={{ marginBottom: '0.5rem' }}>
                MCP Troubleshooting: Not Connecting, Zero Tools, Timeouts
              </h1>
              <p className="text-lead" style={{ margin: 0 }}>
                A practical fix guide for Model Context Protocol failures in Claude Desktop, Cursor, Claude Code,
                Windsurf, Cline, and other MCP hosts. Prefer a clean install first? See the{' '}
                <Link href="/guide">setup guide</Link> or client pages for{' '}
                <Link href="/mcp-for-cursor">Cursor</Link> and{' '}
                <Link href="/mcp-for-claude-desktop">Claude Desktop</Link>.
              </p>
            </div>

            <div className="lg:hidden">
              <TableOfContents items={tocItems} />
            </div>

            <div className="markdown-body">
              <div
                style={{
                  background: 'rgba(var(--accent-rgb), 0.05)',
                  borderLeft: '4px solid var(--accent-color)',
                  borderRadius: '12px',
                  padding: '1.25rem 1.5rem',
                  marginBottom: '2.5rem',
                }}
              >
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0, lineHeight: 1.65 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>TL;DR:</strong> Do not guess from the status
                  dot. Open the client&rsquo;s MCP log, map the error to config / PATH / crash / stdout / env, run the
                  same command in a terminal, fix, then fully restart the host. Use the{' '}
                  <Link href="/tools/config-validator">config validator</Link> before hand-editing JSON.
                </p>
              </div>

              <h2 id="quick-map">Symptom → likely cause</h2>
              <p>
                Most &ldquo;MCP is broken&rdquo; reports collapse into a short list of root causes. Match your
                symptom first:
              </p>
              <ul>
                <li>
                  <strong>Server never appears / config rejected</strong> — invalid JSON, wrong config file path, or
                  client not reloaded.
                </li>
                <li>
                  <strong>Server shows error / disconnected within seconds</strong> — command not found, crash on
                  startup, missing env, or stdout corruption.
                </li>
                <li>
                  <strong>Connected but zero tools</strong> — failed <code>tools/list</code>, exception during
                  initialize, or incomplete server implementation.
                </li>
                <li>
                  <strong>Tool call hangs or times out</strong> — slow external API, blocked network, deadlock, or
                  waiting on interactive input.
                </li>
                <li>
                  <strong>Remote URL never connects</strong> — wrong endpoint, TLS/CORS, missing auth header, or
                  server only speaking stdio.
                </li>
              </ul>

              <h2 id="logs">Find the real error (logs by client)</h2>
              <p>
                The UI almost always under-reports. The MCP log (or the server process stderr) contains the fix.
                Common places to look:
              </p>
              <ul>
                <li>
                  <strong>Claude Desktop (macOS):</strong> <code>~/Library/Logs/Claude/</code>
                </li>
                <li>
                  <strong>Claude Desktop (Windows):</strong> <code>%APPDATA%\Claude\logs\</code>
                </li>
                <li>
                  <strong>Claude Code:</strong> run with <code>claude --debug</code>, or check{' '}
                  <code>~/.claude/logs/</code>
                </li>
                <li>
                  <strong>Cursor:</strong> Output / MCP panels in the IDE, plus any MCP log channel in developer
                  tools
                </li>
                <li>
                  <strong>Windsurf / Cline / VS Code forks:</strong> extension or agent output panels labeled MCP
                </li>
              </ul>
              <p>
                Copy the first stack trace or <code>ENOENT</code> / parse error for the specific server id, then jump
                to the matching section below. A longer walkthrough of failure modes lives in{' '}
                <Link href="/blog/mcp-server-not-connecting-troubleshooting-guide">
                  MCP server not connecting
                </Link>
                .
              </p>

              <h2 id="config">Config JSON mistakes</h2>
              <p>
                Client configs are strict JSON. Trailing commas, single quotes, comments, or a mistyped{' '}
                <code>mcpServers</code> key will fail silently or disable every server in the file.
              </p>
              <p>A minimal local stdio entry looks like:</p>
              <CopyBlock
                code={`{
  "mcpServers": {
    "example": {
      "command": "npx",
      "args": ["-y", "some-mcp-package"],
      "env": {
        "API_KEY": "your-key"
      }
    }
  }
}`}
                language="json"
              />
              <p>
                Validate with the free <Link href="/tools/config-validator">MCP config validator</Link>, or
                generate a clean snippet with the <Link href="/tools/config-generator">config generator</Link>.
                After saving, <strong>fully quit and reopen</strong> the host app — many clients do not hot-reload
                MCP process trees.
              </p>

              <h2 id="path">PATH and &ldquo;command not found&rdquo;</h2>
              <p>
                Desktop hosts launched from a dock or Start menu often inherit a minimal PATH. Your terminal has{' '}
                <code>npx</code> via nvm/fnm/Homebrew; the GUI app does not. Symptoms include{' '}
                <code>ENOENT</code>, <code>spawn npx ENOENT</code>, or &ldquo;command not found.&rdquo;
              </p>
              <ul>
                <li>
                  Prefer an <strong>absolute path</strong> to <code>node</code> / <code>npx</code> /{' '}
                  <code>uvx</code> in the <code>command</code> field.
                </li>
                <li>
                  On macOS, <code>which npx</code> in the same shell you use daily shows the path to paste.
                </li>
                <li>
                  Alternatively launch the client from a terminal so it inherits your shell environment.
                </li>
              </ul>

              <h2 id="zero-tools">Zero tools / silent crash</h2>
              <p>
                If the server appears then shows <strong>0 tools</strong>, the process usually started and then died
                before answering <code>tools/list</code>. Check for:
              </p>
              <ul>
                <li>Missing required environment variables (API keys, database URLs).</li>
                <li>Unhandled exceptions in the server&rsquo;s startup or tool registration path.</li>
                <li>Wrong package name or version so the process exits immediately.</li>
                <li>
                  Working-directory issues when the server expects files relative to <code>cwd</code>.
                </li>
              </ul>
              <p>
                Reproduce outside the client: run the exact <code>command</code> + <code>args</code> in a terminal
                with the same <code>env</code>. If it crashes there, the client will never stay healthy. For
                author-side debugging (Inspector, unit tests, CI), read{' '}
                <Link href="/blog/testing-and-debugging-mcp-servers">
                  Testing and debugging MCP servers
                </Link>
                .
              </p>

              <h2 id="stdout">Stdout corruption on stdio transport</h2>
              <p>
                On <strong>stdio</strong> MCP servers, <code>stdout</code> is the protocol wire. Anything else on
                that stream — <code>console.log</code>, <code>print()</code>, a noisy dependency — breaks framing.
                Clients then hang, report parse errors, or flip to disconnected with a cryptic message.
              </p>
              <ul>
                <li>
                  Log only to <strong>stderr</strong> (<code>console.error</code>, or a logger bound to stderr).
                </li>
                <li>
                  Never print banners or progress bars to stdout in production MCP servers.
                </li>
                <li>
                  If you maintain the server, add a CI check that fails if tests capture unexpected stdout.
                </li>
              </ul>

              <h2 id="env">Missing env vars &amp; secrets</h2>
              <p>
                Many directory listings require API keys or connection strings. If the README lists required env
                vars, put them under the server&rsquo;s <code>env</code> object (or the host&rsquo;s secret store) —
                do not assume the GUI inherits your shell exports.
              </p>
              <ul>
                <li>Use least-privilege keys; prefer read-only tokens when the task allows.</li>
                <li>
                  Avoid committing secrets into shared config files — see{' '}
                  <Link href="/mcp-security">MCP security best practices</Link>.
                </li>
                <li>
                  After changing env, restart the host so child processes pick up the new values.
                </li>
              </ul>

              <h2 id="timeouts">Timeouts &amp; hanging tools</h2>
              <p>
                A connected server with tools that hang usually means the tool handler is waiting on the network,
                a lock, or user input. Check:
              </p>
              <ul>
                <li>External API latency, rate limits, or blocked egress.</li>
                <li>Tools that prompt interactively (MCP tools should not block on stdin prompts).</li>
                <li>Deadlocks when multiple tools share a single connection pool.</li>
                <li>
                  Client-side timeouts that are shorter than a legitimate long-running job — split work or stream
                  progress via logging on stderr.
                </li>
              </ul>

              <h2 id="remote">Remote HTTP / SSE failures</h2>
              <p>
                Remote servers use a URL instead of a local command. Failures usually come from endpoint shape,
                TLS, authentication, or mixing transports:
              </p>
              <ul>
                <li>
                  Confirm the host documents the correct path (often an SSE or streamable HTTP endpoint, not the
                  marketing homepage).
                </li>
                <li>Require HTTPS in production; mixed content and expired certs fail closed.</li>
                <li>Send the auth scheme the server expects (Bearer token, OAuth) — see the auth guide on the blog.</li>
                <li>
                  A package built only for stdio will not magically work as a remote URL — deploy it first (
                  <Link href="/deploy-mcp-server">deploy guide</Link>).
                </li>
              </ul>

              <h2 id="checklist">Fix checklist</h2>
              <ol>
                <li>Open the MCP log and copy the exact error for this server.</li>
                <li>
                  Validate config JSON (
                  <Link href="/tools/config-validator">validator</Link>).
                </li>
                <li>Run the same command + args in a terminal with the same env.</li>
                <li>Switch to absolute paths if you see PATH / ENOENT errors.</li>
                <li>Remove stdout logging on stdio servers; keep logs on stderr.</li>
                <li>Fill required env vars; restart the host completely.</li>
                <li>
                  Still stuck? Compare a known-good listing from the{' '}
                  <Link href="/browse">directory</Link> or re-test with the{' '}
                  <Link href="/tools/playground">MCP playground</Link> / protocol inspector.
                </li>
              </ol>

              <h2 id="deeper">Deeper guides &amp; tools</h2>
              <ul>
                <li>
                  <Link href="/blog/mcp-server-not-connecting-troubleshooting-guide">
                    MCP server not connecting (deep dive)
                  </Link>
                </li>
                <li>
                  <Link href="/blog/testing-and-debugging-mcp-servers">
                    Testing and debugging MCP servers
                  </Link>
                </li>
                <li>
                  <Link href="/blog/how-to-install-mcp-servers-in-claude-cursor-windsurf-and-vs-code">
                    Install MCP in Claude, Cursor, Windsurf, VS Code
                  </Link>
                </li>
                <li>
                  <Link href="/tools/config-validator">Config validator</Link> ·{' '}
                  <Link href="/tools/config-generator">Config generator</Link> ·{' '}
                  <Link href="/tools/protocol-inspector">Protocol inspector</Link> ·{' '}
                  <Link href="/tools/playground">Playground</Link>
                </li>
              </ul>

              <h2 id="faq">Frequently asked questions</h2>
              {faqs.map((f) => (
                <div key={f.q} style={{ marginBottom: '1.25rem' }}>
                  <h3 style={{ fontSize: '1.05rem', marginBottom: '0.35rem' }}>{f.q}</h3>
                  <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{f.a}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="hidden lg:block">
            <div style={{ position: 'sticky', top: '5.5rem' }}>
              <TableOfContents items={tocItems} />
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
