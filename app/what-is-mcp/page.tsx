import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'What is an MCP?',
  description: 'A clear, practical explanation of the Model Context Protocol (MCP): what it is, how it works, real-world examples, and how to get started.',
};

const faqs = [
  {
    q: 'Who created MCP?',
    a: 'Anthropic introduced the Model Context Protocol as an open standard in November 2024 and open-sourced its specification and SDKs. Since then, it has been adopted and extended by a broad ecosystem of AI companies, developer tools, and independent developers — it is not tied to any single vendor.',
  },
  {
    q: 'Is MCP only for Claude?',
    a: 'No. MCP was designed to be client-agnostic. While Claude Desktop and Claude Code were among the first clients to support it, MCP is now supported by a growing list of AI applications, code editors, and agent frameworks.',
  },
  {
    q: 'Do I need to know how to code to use an MCP server?',
    a: 'Not to use one someone else built. Installing an existing MCP server is usually a matter of pasting a short configuration snippet into your AI client. Building your own MCP server does require programming, typically in TypeScript or Python.',
  },
  {
    q: 'How is an MCP server different from a regular API?',
    a: 'A regular API is built for one specific integration and needs custom client code to consume it. An MCP server describes its tools, data, and prompts in a standardized way that any MCP-compatible AI client already knows how to understand — no custom integration code required on the client side.',
  },
  {
    q: 'Is MCP open source?',
    a: 'Yes. The MCP specification, reference SDKs, and many official and community servers are open source, which is a large part of why the ecosystem has grown quickly.',
  },
];

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: {
      '@type': 'Answer',
      text: f.a,
    },
  })),
};

export default function WhatIsMCPPage() {
  return (
    <main className="container" style={{ padding: '6rem 0' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <div className="glass-panel" style={{ padding: '4rem', maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '0.5rem' }}>What is an MCP?</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          A plain-language guide to the Model Context Protocol &mdash; what it is, how it works, and why it matters.
        </p>

        <nav aria-label="On this page" style={{ marginBottom: '2.5rem', padding: '1.25rem 1.5rem', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
          <strong style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>On this page</strong>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingLeft: '1.25rem', margin: 0, fontSize: '0.9rem' }}>
            <li><a href="#short-answer">The short answer</a></li>
            <li><a href="#problem">The problem MCP solves</a></li>
            <li><a href="#architecture">How MCP works</a></li>
            <li><a href="#capabilities">What can an MCP server do?</a></li>
            <li><a href="#local-vs-remote">Local vs. remote servers</a></li>
            <li><a href="#examples">Real-world examples</a></li>
            <li><a href="#safety">Is MCP safe to use?</a></li>
            <li><a href="#getting-started">Getting started</a></li>
            <li><a href="#faq">FAQ</a></li>
          </ul>
        </nav>

        <div className="markdown-body">
          <h2 id="short-answer">The short answer</h2>
          <p>
            The <strong>Model Context Protocol (MCP)</strong> is an open standard, introduced by Anthropic in
            November 2024, that lets AI applications like Claude connect to external tools, data sources, and
            services in a consistent way. Instead of an AI model being limited to what it already knows, an{' '}
            <strong>MCP server</strong> gives it live, structured access to things like your filesystem, a database,
            a SaaS product, or a search engine &mdash; through one shared protocol instead of a custom integration
            for every combination of AI app and tool.
          </p>
          <p>
            A common way to describe it: MCP is like a USB-C port for AI applications. One standard connector, many
            compatible devices &mdash; instead of a different cable for every combination of laptop and accessory.
          </p>

          <h2 id="problem">The problem MCP solves</h2>
          <p>
            Before MCP, every AI application that wanted to talk to an external system needed its own, purpose-built
            integration. If you had <em>M</em> AI applications and <em>N</em> tools or data sources, you could end
            up needing something close to <em>M &times; N</em> separate integrations &mdash; each one built,
            tested, and maintained independently, often by different teams using different conventions.
          </p>
          <p>
            MCP collapses that down to <em>M + N</em>: a tool or data source is wrapped once as an MCP server, and
            any MCP-compatible client can immediately use it. The integration work happens once, not once per
            client.
          </p>

          <h2 id="architecture">How MCP works</h2>
          <p>MCP defines three roles that communicate using a standard JSON-RPC 2.0 message format:</p>
          <ul>
            <li><strong>Host</strong> &mdash; the AI application the user actually interacts with, such as Claude Desktop, Claude Code, or an IDE like Cursor.</li>
            <li><strong>Client</strong> &mdash; lives inside the host and maintains a single, stateful connection to one MCP server.</li>
            <li><strong>Server</strong> &mdash; a lightweight program, running locally or hosted remotely, that exposes a defined set of capabilities over MCP.</li>
          </ul>
          <p>
            A host can run many clients at once, each connected to a different server, which is how a single AI
            assistant can simultaneously have access to, say, your filesystem, a GitHub account, and a database.
          </p>

          <h2 id="capabilities">What can an MCP server do?</h2>
          <p>Every MCP server can expose up to three primitives to the client that connects to it:</p>
          <ul>
            <li><strong>Tools</strong> &mdash; executable functions the model can decide to call on its own, such as &ldquo;create a GitHub issue&rdquo; or &ldquo;run this SQL query.&rdquo;</li>
            <li><strong>Resources</strong> &mdash; structured or unstructured data the client can read and attach as context, such as a file&rsquo;s contents or a database record.</li>
            <li><strong>Prompts</strong> &mdash; reusable, parameterized prompt templates that a user can select to kick off a specific workflow.</li>
          </ul>
          <p>
            More advanced servers can also use <strong>sampling</strong>, where the server asks the connected
            client&rsquo;s model to generate a completion on its behalf &mdash; useful for agentic workflows that
            need their own reasoning step without managing their own model access.
          </p>

          <h2 id="local-vs-remote">Local vs. remote servers</h2>
          <p>MCP servers connect to clients over one of two transport styles:</p>
          <ul>
            <li>
              <strong>Local (stdio).</strong> The server runs as a subprocess on your machine (commonly launched
              via <code>npx</code> or <code>uvx</code>) and communicates over standard input/output. This is fast
              and well suited to servers that need access to local resources, like your filesystem.
            </li>
            <li>
              <strong>Remote (HTTP).</strong> The server is hosted somewhere and the client connects to it by URL.
              This suits SaaS integrations, servers shared across a team, or servers you don&rsquo;t want to install
              and update locally.
            </li>
          </ul>

          <h2 id="examples">Real-world examples</h2>
          <p>MCP servers exist for a wide range of categories, including:</p>
          <table>
            <thead>
              <tr><th>Category</th><th>What it enables</th></tr>
            </thead>
            <tbody>
              <tr><td>Developer tools</td><td>Read and manage GitHub/GitLab issues and pull requests from chat</td></tr>
              <tr><td>Databases</td><td>Query a Postgres or SQLite database using plain language</td></tr>
              <tr><td>File systems</td><td>Read and write local files as part of a coding or research workflow</td></tr>
              <tr><td>Productivity</td><td>Search and update tools like Slack, Notion, or Google Drive</td></tr>
              <tr><td>Web</td><td>Search the web or fetch and read specific pages</td></tr>
              <tr><td>Commerce</td><td>Interact with payment and commerce platforms like Stripe</td></tr>
            </tbody>
          </table>
          <p>
            You can browse working examples of all of these in the <Link href="/">AllMCPs directory</Link>, organized by <Link href="/categories">category</Link>.
          </p>

          <h2 id="safety">Is MCP safe to use?</h2>
          <p>
            An MCP server can execute code, read local files, or access accounts on your behalf, so it deserves the
            same scrutiny you&rsquo;d give any piece of software with real permissions. A few habits go a long way:
          </p>
          <ul>
            <li>Only connect to servers from sources you trust, and prefer actively maintained ones.</li>
            <li>Review what tools and permissions a server requests before enabling it &mdash; don&rsquo;t grant broader access than a task needs.</li>
            <li>Be cautious with servers that pass untrusted external content (web pages, emails, third-party files) back to the model, since instructions hidden in that content could attempt to manipulate it &mdash; a risk known as prompt injection.</li>
            <li>Use scoped, least-privilege API keys wherever a server needs credentials, and rotate them periodically.</li>
          </ul>
          <p>
            We track a health and verification status for servers listed on AllMCPs to help you gauge whether a
            listing is actively maintained before you connect to it.
          </p>

          <h2 id="getting-started">Getting started in three steps</h2>
          <ol>
            <li>Install or open an MCP-compatible client, such as Claude Desktop or Claude Code.</li>
            <li>Browse the <Link href="/">AllMCPs directory</Link> to find a server for what you want your agent to do.</li>
            <li>Follow that listing&rsquo;s setup instructions &mdash; usually a short configuration snippet &mdash; then restart your client.</li>
          </ol>
          <p>
            For a hands-on walkthrough with real configuration examples, see our <Link href="/guide">LLM Agents Guide</Link>.
          </p>

          <h2 id="faq">Frequently asked questions</h2>
          {faqs.map((f) => (
            <div key={f.q}>
              <h3>{f.q}</h3>
              <p>{f.a}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
