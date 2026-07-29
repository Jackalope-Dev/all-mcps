import { Metadata } from 'next';
import Link from 'next/link';
import { TableOfContents, TocItem } from '@/components/ui/TableOfContents';

export const metadata: Metadata = {
  title: 'LLM Agents Setup & Configuration Guide',
  description:
    'Step-by-step guide to connecting Claude Desktop, Cursor, and LLM agents to MCP servers with configuration examples and security tips.',
  alternates: {
    canonical: 'https://allmcps.com/guide',
  },
  openGraph: {
    title: 'LLM Agents Setup & Configuration Guide | AllMCPs',
    description:
      'Step-by-step guide to connecting Claude Desktop, Cursor, and LLM agents to MCP servers with configuration examples and security tips.',
    url: 'https://allmcps.com/guide',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LLM Agents Setup & Configuration Guide | AllMCPs',
    description:
      'Step-by-step guide to connecting Claude Desktop, Cursor, and LLM agents to MCP servers with configuration examples and security tips.',
  },
};

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'TechArticle',
  headline: 'LLM Agents Guide: Connecting AI Agents to MCP Servers',
  description: 'A practical, step-by-step guide to connecting Claude and other LLM agents to MCP servers.',
  author: { '@type': 'Organization', name: 'Jackalope Digital LLC' },
  publisher: { '@type': 'Organization', name: 'AllMCPs' },
};

const tocItems: TocItem[] = [
  { id: 'prerequisites', text: 'Before you start' },
  { id: 'find-config', text: 'Step 1: Find your client’s configuration' },
  { id: 'local-server', text: 'Step 2: Add a local (stdio) server' },
  { id: 'remote-server', text: 'Step 3: Add a remote (hosted) server' },
  { id: 'common-setups', text: 'Common setups' },
  { id: 'security', text: 'Security best practices' },
  { id: 'troubleshooting', text: 'Troubleshooting' },
  { id: 'advanced', text: 'Advanced: combining multiple servers' },
  { id: 'next-steps', text: 'Next steps' },
];

export default function GuidePage() {
  return (
    <main className="page-shell page-shell--default">
      <div className="page-shell-inner">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
        />
        <div className="lg:grid lg:grid-cols-[1fr_260px] lg:gap-10">
          <div className="surface page-panel min-w-0">
            <h1 className="text-page-title" style={{ marginBottom: '0.5rem' }}>LLM Agents Guide</h1>
            <p className="text-lead" style={{ marginBottom: '2rem' }}>
              A practical, step-by-step guide to connecting your AI agent to MCP servers &mdash; with real configuration
              examples. New to the protocol itself? Start with <Link href="/what-is-mcp">What is an MCP?</Link> first.
            </p>

            {/* Mobile Table of Contents */}
            <div className="lg:hidden">
              <TableOfContents items={tocItems} />
            </div>

            <div className="markdown-body">
              <p>
                This guide walks through connecting an MCP-compatible AI client to an MCP server, from your first
                local install to running several servers together. It assumes no prior MCP experience, but does assume
                you&rsquo;re comfortable editing a JSON file or running a terminal command.
              </p>

              <h2 id="prerequisites">Before you start</h2>
              <p>You&rsquo;ll want:</p>
              <ul>
                <li>An MCP-compatible client installed &mdash; for example Claude Desktop, Claude Code, Cursor, or Windsurf.</li>
                <li>
                  For servers written in Node.js/TypeScript: <a href="https://nodejs.org" target="_blank" rel="noopener noreferrer">Node.js</a> installed, so <code>npx</code> is available on your machine.
                </li>
                <li>
                  For servers written in Python: <a href="https://docs.astral.sh/uv/" target="_blank" rel="noopener noreferrer">uv</a> installed, so <code>uvx</code> is available.
                </li>
                <li>Any credentials the specific server needs (a GitHub token, database connection string, API key, etc.) &mdash; use scoped, least-privilege credentials wherever the service supports them.</li>
              </ul>

              <h2 id="find-config">Step 1: Find your client&rsquo;s configuration</h2>
              <p>
                Most desktop clients configure MCP servers through a JSON file. In Claude Desktop, it&rsquo;s usually
                reachable from <strong>Settings &rarr; Developer &rarr; Edit Config</strong>, and lives on disk at:
              </p>
              <pre><code>{`macOS:    ~/Library/Application Support/Claude/claude_desktop_config.json
Windows:  %APPDATA%\\Claude\\claude_desktop_config.json`}</code></pre>
              <p>
                Claude Code and several other clients also support MCP servers, typically through a command-line
                interface or a project-level config file, in addition to (or instead of) a global JSON file. The
                server entries look the same either way &mdash; run <code>claude mcp --help</code>, or check your
                client&rsquo;s own docs, for the exact current commands.
              </p>

              <h2 id="local-server">Step 2: Add a local (stdio) server</h2>
              <p>
                Local servers run as a subprocess on your machine. Here&rsquo;s a filesystem server, one of the most
                common starting points, added to a client&rsquo;s config:
              </p>
              <pre><code>{`{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/you/Documents"
      ]
    }
  }
}`}</code></pre>
              <p>
                <code>command</code> is the executable to run, and <code>args</code> is the list of arguments passed to
                it &mdash; here, the path the server is allowed to read and write. Save the file, then{' '}
                <strong>fully restart your client</strong> (quit and reopen, not just close the window) so it picks up
                the change.
              </p>

              <h2 id="remote-server">Step 3: Add a remote (hosted) server</h2>
              <p>Remote servers are reached over HTTP instead of being run locally:</p>
              <pre><code>{`{
  "mcpServers": {
    "example-remote": {
      "url": "https://example.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}`}</code></pre>
              <p>
                The exact field names for remote servers vary slightly between clients as this part of the protocol
                has evolved, so always follow the specific instructions on the server&rsquo;s own listing &mdash;
                every <Link href="/browse">AllMCPs directory</Link> entry includes the setup snippet its maintainer provides.
              </p>

              <h2 id="common-setups">Common setups</h2>
              <p>A few of the most popular categories to start with:</p>
              <ul>
                <li><strong>Filesystem</strong> &mdash; read and write local files, useful for coding and research agents.</li>
                <li><strong>GitHub</strong> &mdash; read issues and pull requests, or open new ones, from chat.</li>
                <li><strong>Databases</strong> (Postgres, SQLite) &mdash; query your data in plain language.</li>
                <li><strong>Web search / fetch</strong> &mdash; let your agent search the web or read a specific page.</li>
                <li><strong>Memory</strong> &mdash; give your agent persistent memory of facts across sessions.</li>
                <li><strong>Team tools</strong> (Slack, Notion, Google Drive) &mdash; connect your agent to where your team already works.</li>
              </ul>
              <p>
                Browse working servers in each of these categories on the <Link href="/categories">categories page</Link>.
              </p>

              <h2 id="security">Security best practices</h2>
              <ul>
                <li>Only install servers from sources you trust, and check a listing&rsquo;s health/verification status on AllMCPs before connecting.</li>
                <li>Review exactly which tools a server exposes before enabling it &mdash; don&rsquo;t grant an untrusted server broad filesystem or account access it doesn&rsquo;t need.</li>
                <li>Use scoped, least-privilege API keys and tokens, and rotate them periodically.</li>
                <li>Be cautious with servers that feed untrusted external content (web pages, emails, documents) back to your agent &mdash; hidden instructions in that content can attempt to manipulate the model, a risk known as prompt injection. Review any high-stakes action before it runs.</li>
                <li>Remove servers you&rsquo;re no longer using, and keep the ones you keep up to date.</li>
              </ul>

              <h2 id="troubleshooting">Troubleshooting</h2>
              <h3>Server doesn&rsquo;t show up in the client</h3>
              <p>
                Almost always a JSON syntax error &mdash; a trailing comma or missing quote will silently break the
                whole config file. Validate it, then fully quit and reopen the client (not just close the window).
              </p>
              <h3>&ldquo;Command not found&rdquo; errors</h3>
              <p>
                The client sometimes can&rsquo;t see the same <code>PATH</code> your terminal uses, especially on
                macOS when the app is launched from Finder. If <code>npx</code> or <code>uvx</code> isn&rsquo;t found,
                try using the full path to the executable (find it with <code>which npx</code> in a terminal) in the{' '}
                <code>command</code> field, and use absolute paths in <code>args</code> rather than relative ones.
              </p>
              <h3>Server starts, then immediately crashes</h3>
              <p>Check that any required environment variables or API keys are set correctly and haven&rsquo;t expired.</p>
              <h3>Remote server rejects the connection</h3>
              <p>Confirm the token or header you&rsquo;re sending is current and formatted exactly as the server expects.</p>

              <h2 id="advanced">Advanced: combining multiple servers</h2>
              <p>
                A single client can hold multiple entries under <code>mcpServers</code> at once &mdash; there&rsquo;s no
                limit to running a filesystem server, a GitHub server, and a database server side by side. This is
                where MCP starts to feel less like a single integration and more like a toolbox: an agent that can read
                your code, check open issues, and query production data in the same conversation, choosing which tool
                to reach for as the task requires.
              </p>

              <h2 id="next-steps">Next steps</h2>
              <ul>
                <li>Not sure what MCP actually is under the hood? Read <Link href="/what-is-mcp">What is an MCP?</Link></li>
                <li>Ready to find a server? <Link href="/browse">Browse the directory</Link></li>
                <li>Want to build your own instead? See <Link href="/build-mcp-server">How to Build an MCP Server</Link>.</li>
                <li>Built something worth sharing? <Link href="/submit">Submit your MCP server</Link></li>
              </ul>
            </div>
          </div>

          {/* Desktop Right Sidebar Table of Contents */}
          <div className="hidden lg:block h-full">
            <TableOfContents items={tocItems} />
          </div>
        </div>
      </div>
    </main>
  );
}
