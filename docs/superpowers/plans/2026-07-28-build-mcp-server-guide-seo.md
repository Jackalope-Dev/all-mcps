# Build-MCP-Server Guide Expansion + SEO/Link Audit Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/build-mcp-server` into a comprehensive, SEO-optimized, copy-paste-ready guide to building an MCP server, and fix the handful of real gaps found in a full-site SEO/link audit (missing sitemap entry, missing page metadata, missing llms.txt links, missing internal cross-links between the site's pillar content pages).

**Architecture:** Content-and-config change only — no new routes, no new dependencies, no schema/data changes. The guide page stays a React Server Component; code samples render through the existing `CopyBlock` client component (`components/ui/CopyBlock.tsx`) instead of static `<pre><code>`. Two schema.org JSON-LD blocks (`TechArticle` + new `FAQPage`) are embedded via `<script>` tags, matching the existing pattern on this page and `/guide`.

**Tech Stack:** Next.js App Router (Metadata API), React Server Components, existing `CopyBlock` client component, schema.org JSON-LD.

## Global Constraints

- Do not change the `/build-mcp-server` URL — reuse the existing route to preserve its existing sitemap entry and inbound links (per spec Part 1).
- Every code sample block must use `<CopyBlock code={\`...\`} />`, not raw `<pre><code>`.
- Match existing page conventions exactly: `page-shell page-shell--content` wrapper, `surface page-panel` panel, `markdown-body` prose wrapper, `text-page-title` / `text-lead` classes, `<nav aria-label="On this page">` TOC pattern — copy these from `app/guide/page.tsx` and the current `app/build-mcp-server/page.tsx`.
- **This repository has another process actively editing files concurrently** (a newsletter-signup feature, touching `components/SiteFooter.tsx`, `app/layout.tsx`, `components/DirectoryGrid.tsx`, `lib/blogToc.ts` as of plan-writing time). Before every `Edit` in this plan, re-`Read` the target file fresh — do not trust this plan's quoted line numbers or "current content" snippets if the file has changed underneath you. If an `Edit`'s `old_string` doesn't match, re-read and adapt rather than forcing it.
- Verification for every task in this plan is: `npm run lint` and `npm run build` must both succeed (there is no test runner configured in this repo — `package.json` only defines `dev`/`build`/`start`/`lint`/`preview`/`deploy`/`cf-typegen`). Content-presence checks use `Grep`, not a test framework.

---

### Task 1: Rewrite `app/build-mcp-server/page.tsx` with the expanded guide

**Files:**
- Modify: `app/build-mcp-server/page.tsx` (full rewrite)

**Interfaces:**
- Consumes: `CopyBlock` from `@/components/ui/CopyBlock` — `<CopyBlock code={string} />` (props: `code: string; serverId?: string`; `serverId` omitted here since this isn't a listing page).
- Produces: Same route `/build-mcp-server`, same exported `Metadata` shape other tasks/pages link to. No other task imports from this file.

- [ ] **Step 1: Read the current file**

Read `app/build-mcp-server/page.tsx` fresh (do not rely on any earlier snapshot) so the rewrite is based on the live file.

- [ ] **Step 2: Replace the full file contents**

Write this exact content to `app/build-mcp-server/page.tsx`:

```tsx
import { Metadata } from 'next';
import Link from 'next/link';
import { CopyBlock } from '@/components/ui/CopyBlock';

export const metadata: Metadata = {
  title: 'How to Build an MCP Server (Complete Developer Guide)',
  description:
    'Build a Model Context Protocol (MCP) server from scratch: full TypeScript and Python code for tools, resources, and prompts, local testing, remote deployment, and publishing.',
  alternates: {
    canonical: 'https://allmcps.com/build-mcp-server',
  },
  openGraph: {
    title: 'How to Build an MCP Server (Complete Developer Guide) | AllMCPs',
    description:
      'Build a Model Context Protocol (MCP) server from scratch: full TypeScript and Python code for tools, resources, and prompts, local testing, remote deployment, and publishing.',
    url: 'https://allmcps.com/build-mcp-server',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'How to Build an MCP Server (Complete Developer Guide) | AllMCPs',
    description:
      'Build a Model Context Protocol (MCP) server from scratch: full TypeScript and Python code for tools, resources, and prompts, local testing, remote deployment, and publishing.',
  },
};

const techArticleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'TechArticle',
  headline: 'How to Build an MCP Server: Complete Developer Guide',
  description:
    'Comprehensive step-by-step guide to building, testing, deploying, and publishing Model Context Protocol (MCP) servers using the TypeScript and Python SDKs.',
  author: { '@type': 'Organization', name: 'AllMCPs' },
  publisher: { '@type': 'Organization', name: 'AllMCPs' },
};

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Which language should I use to build an MCP server?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'TypeScript and Python have the most mature official SDKs and the most existing example servers to learn from, so most developers start there. Go, Java/Kotlin, and C# SDKs are also officially maintained if they better match your existing stack.',
      },
    },
    {
      '@type': 'Question',
      name: 'Do I need to host my MCP server, or can it run locally?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Most MCP servers start as local processes that your AI client launches for you (the stdio transport) and never need hosting at all. You only need a remote, hosted server (over HTTP/SSE) if multiple people need to share one instance, or if it must run somewhere other than the user’s machine.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is MCP the same as OpenAI-style function calling?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No. Function calling is a model feature for invoking a single function schema you define inline in your prompt. MCP is a standardized client-server protocol: one MCP server can expose many tools, resources, and prompts, and any MCP-compatible client can connect to it without custom integration code.',
      },
    },
    {
      '@type': 'Question',
      name: 'How do I test my server without restarting Claude Desktop every time?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Use the official MCP Inspector (npx @modelcontextprotocol/inspector) to run your server and call its tools, resources, and prompts directly in a browser UI, with live JSON-RPC logs, before wiring it into a full AI client.',
      },
    },
    {
      '@type': 'Question',
      name: 'Does my MCP server need authentication?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'A local stdio server inherits the permissions of the user running it, so it typically doesn’t need its own auth layer. A remote HTTP server should require a bearer token or similar credential, since anyone who can reach the URL can otherwise call its tools.',
      },
    },
    {
      '@type': 'Question',
      name: 'How do I get my MCP server listed on AllMCPs?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Publish it to npm, PyPI, or GitHub with a clear README and setup instructions, then submit it through the AllMCPs submission form for review.',
      },
    },
  ],
};

export default function BuildMCPServerPage() {
  return (
    <main className="page-shell page-shell--content">
      <div className="page-shell-inner">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(techArticleJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
        <div className="surface page-panel">
          <h1 className="text-page-title" style={{ marginBottom: '0.5rem' }}>
            How to Build an MCP Server
          </h1>
          <p className="text-lead" style={{ marginBottom: '2rem' }}>
            A complete, hands-on developer guide to building, testing, deploying, and publishing custom Model
            Context Protocol servers in TypeScript and Python. New to MCP itself? Start with{' '}
            <Link href="/what-is-mcp">What is an MCP?</Link> first.
          </p>

          <nav
            aria-label="On this page"
            className="surface-muted"
            style={{ marginBottom: '2.5rem', padding: '1.25rem 1.5rem' }}
          >
            <strong style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              On this page
            </strong>
            <ul
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
                paddingLeft: '1.25rem',
                margin: 0,
                fontSize: '0.9rem',
              }}
            >
              <li>
                <a href="#overview">Overview &amp; Core Concepts</a>
              </li>
              <li>
                <a href="#choosing-stack">Choosing Your Stack</a>
              </li>
              <li>
                <a href="#typescript-guide">Building with TypeScript</a>
              </li>
              <li>
                <a href="#python-guide">Building with Python</a>
              </li>
              <li>
                <a href="#primitives">Tools, Resources &amp; Prompts</a>
              </li>
              <li>
                <a href="#testing">Testing Locally</a>
              </li>
              <li>
                <a href="#deploying">Deploying a Remote Server</a>
              </li>
              <li>
                <a href="#publishing">Publishing &amp; Listing on AllMCPs</a>
              </li>
              <li>
                <a href="#faq">FAQ</a>
              </li>
              <li>
                <a href="#further-reading">Further Reading</a>
              </li>
            </ul>
          </nav>

          <div className="markdown-body">
            <h2 id="overview">Overview &amp; Core Concepts</h2>
            <p>
              An <strong>MCP Server</strong> is a lightweight process that exposes capabilities &mdash; tools,
              data resources, and prompt templates &mdash; over standard JSON-RPC 2.0. Any MCP-compatible AI
              client (Claude Desktop, Claude Code, Cursor, and others) can connect to your server and use those
              capabilities on demand, without you writing custom integration code for each client.
            </p>

            <h2 id="choosing-stack">Choosing Your Stack</h2>
            <p>
              MCP has officially maintained SDKs in several languages. TypeScript and Python are the most
              mature, with the largest ecosystem of example servers to learn from &mdash; this guide covers
              both in full. If your project already lives in another language, these SDKs work the same way
              conceptually:
            </p>
            <ul>
              <li>
                <strong>TypeScript / JavaScript</strong> &mdash;{' '}
                <a
                  href="https://github.com/modelcontextprotocol/typescript-sdk"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  @modelcontextprotocol/sdk
                </a>
              </li>
              <li>
                <strong>Python</strong> &mdash;{' '}
                <a
                  href="https://github.com/modelcontextprotocol/python-sdk"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  mcp (with the FastMCP helper)
                </a>
              </li>
              <li>
                <strong>Go</strong> &mdash;{' '}
                <a href="https://github.com/modelcontextprotocol/go-sdk" target="_blank" rel="noopener noreferrer">
                  modelcontextprotocol/go-sdk
                </a>
              </li>
              <li>
                <strong>Java / Kotlin</strong> &mdash;{' '}
                <a
                  href="https://github.com/modelcontextprotocol/kotlin-sdk"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  modelcontextprotocol/kotlin-sdk
                </a>
              </li>
              <li>
                <strong>C#</strong> &mdash;{' '}
                <a
                  href="https://github.com/modelcontextprotocol/csharp-sdk"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  modelcontextprotocol/csharp-sdk
                </a>
              </li>
            </ul>

            <h2 id="typescript-guide">Building with TypeScript</h2>
            <p>
              Install the official SDK and a schema validator:
            </p>
            <CopyBlock code={`npm install @modelcontextprotocol/sdk zod`} />
            <p>
              Here is a complete working TypeScript server that exposes a <strong>tool</strong>, a{' '}
              <strong>resource</strong>, and a <strong>prompt</strong>:
            </p>
            <CopyBlock
              code={`import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "my-mcp-server", version: "1.0.0" },
  { capabilities: { tools: {}, resources: {}, prompts: {} } }
);

// --- Tool: calculate_sum ---
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "calculate_sum",
      description: "Add two numbers together",
      inputSchema: {
        type: "object",
        properties: {
          a: { type: "number", description: "First number" },
          b: { type: "number", description: "Second number" }
        },
        required: ["a", "b"]
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "calculate_sum") {
    const { a, b } = request.params.arguments as { a: number; b: number };
    return { content: [{ type: "text", text: String(a + b) }] };
  }
  throw new Error("Tool not found");
});

// --- Resource: app config ---
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: "config://app",
      name: "Application Config",
      description: "Static app configuration as JSON",
      mimeType: "application/json"
    }
  ]
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  if (request.params.uri === "config://app") {
    return {
      contents: [
        {
          uri: "config://app",
          mimeType: "application/json",
          text: JSON.stringify({ maxResults: 10, environment: "production" })
        }
      ]
    };
  }
  throw new Error("Resource not found");
});

// --- Prompt: summarize ---
server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: [
    {
      name: "summarize",
      description: "Summarize the provided text in one paragraph",
      arguments: [{ name: "text", description: "The text to summarize", required: true }]
    }
  ]
}));

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  if (request.params.name === "summarize") {
    const text = request.params.arguments?.text ?? "";
    return {
      messages: [
        {
          role: "user",
          content: { type: "text", text: \`Summarize the following text in one paragraph:\\n\\n\${text}\` }
        }
      ]
    };
  }
  throw new Error("Prompt not found");
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);`}
            />

            <h2 id="python-guide">Building with Python</h2>
            <p>
              Python developers can use the official <code>mcp</code> library&rsquo;s FastMCP wrapper, which
              turns plain decorated functions into MCP primitives:
            </p>
            <CopyBlock code={`pip install "mcp[cli]"`} />
            <p>The same tool, resource, and prompt as above, in a few lines of Python:</p>
            <CopyBlock
              code={`from mcp.server.fastmcp import FastMCP
import json

mcp = FastMCP("My Python Tool")

@mcp.tool()
def add_numbers(a: int, b: int) -> int:
    """Add two numbers together."""
    return a + b

@mcp.resource("config://app")
def get_config() -> str:
    """Return static app configuration as JSON."""
    return json.dumps({"max_results": 10, "environment": "production"})

@mcp.prompt()
def summarize(text: str) -> str:
    """Summarize the provided text in one paragraph."""
    return f"Summarize the following text in one paragraph:\\n\\n{text}"

if __name__ == "__main__":
    mcp.run()`}
            />

            <h2 id="primitives">Tools, Resources &amp; Prompts</h2>
            <ul>
              <li>
                <strong>Tools</strong>: Functions that execute side effects or perform calculations. Always
                provide clear parameters and a descriptive JSON schema so the AI model knows when and how to
                call them &mdash; see <code>calculate_sum</code> / <code>add_numbers</code> above.
              </li>
              <li>
                <strong>Resources</strong>: Read-only data sources identified by URIs (e.g.{' '}
                <code>config://app</code>, <code>file:///logs/app.log</code>, or <code>db://users/123</code>).
                Clients can list and read them without invoking a tool.
              </li>
              <li>
                <strong>Prompts</strong>: Reusable template workflows, like <code>summarize</code> above, that
                users can invoke directly inside their AI client&rsquo;s interface.
              </li>
            </ul>

            <h2 id="testing">Testing Locally</h2>
            <p>
              Test your server directly in your browser without wiring it into a full AI client, using the
              official MCP Inspector:
            </p>
            <CopyBlock code={`npx @modelcontextprotocol/inspector node dist/index.js`} />
            <p>
              This launches an interactive UI where you can call tools, read resources, and get prompts, while
              watching the raw JSON-RPC messages in real time.
            </p>
            <p>Once it works in Inspector, point Claude Desktop at it directly:</p>
            <CopyBlock
              code={`{
  "mcpServers": {
    "my-mcp-server": {
      "command": "node",
      "args": ["/absolute/path/to/dist/index.js"]
    }
  }
}`}
            />
            <p>
              For a Python server, swap the command for <code>uv run --directory /absolute/path/to/project
              server.py</code>. Fully restart the client (quit and reopen) after editing its config &mdash; see
              the <Link href="/guide">LLM Agents Guide</Link> for the exact config file locations. Claude Code
              can add a local server directly from the command line instead:
            </p>
            <CopyBlock code={`claude mcp add my-mcp-server -- node /absolute/path/to/dist/index.js`} />

            <h2 id="deploying">Deploying a Remote Server</h2>
            <p>
              Everything above uses the <strong>stdio transport</strong>: your AI client launches the server as
              a local subprocess. For a server that multiple people share, or that needs to run somewhere other
              than the user&rsquo;s machine, expose it over HTTP/SSE instead as a <strong>remote server</strong>.
              One common way to host a remote MCP server is on Cloudflare Workers using the{' '}
              <code>agents</code> package&rsquo;s <code>McpAgent</code> class:
            </p>
            <CopyBlock
              code={`import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export class MyMCP extends McpAgent {
  server = new McpServer({ name: "my-remote-mcp", version: "1.0.0" });

  async init() {
    this.server.tool(
      "calculate_sum",
      { a: z.number(), b: z.number() },
      async ({ a, b }) => ({
        content: [{ type: "text", text: String(a + b) }]
      })
    );
  }
}

export default {
  fetch(request: Request, env: unknown, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (url.pathname === "/mcp") {
      return MyMCP.serve("/mcp").fetch(request, env, ctx);
    }
    return new Response("Not found", { status: 404 });
  }
};`}
            />
            <CopyBlock code={`npx wrangler deploy`} />
            <p>
              See{' '}
              <a
                href="https://developers.cloudflare.com/agents/model-context-protocol/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Cloudflare&rsquo;s MCP documentation
              </a>{' '}
              for authentication, session handling, and other remote-server details.
            </p>

            <h2 id="publishing">Publishing &amp; Listing on AllMCPs</h2>
            <p>Once your server works locally, get it in front of users:</p>
            <ol>
              <li>Publish your package to npm (Node.js) or PyPI (Python), or host it on GitHub with a tagged release.</li>
              <li>
                Write a <code>README.md</code> with a clear <code>claude_desktop_config.json</code> snippet and
                a list of any required environment variables or API keys.
              </li>
              <li>Pick an OSS license &mdash; MIT and Apache-2.0 are the most widely accepted for MCP servers.</li>
              <li>Tag a semantic-versioned release so users can pin a specific version.</li>
              <li>
                Head over to our <Link href="/submit">Submit Page</Link> to list your server on AllMCPs and
                reach thousands of AI developers.
              </li>
            </ol>

            <h2 id="faq">FAQ</h2>
            <h3>Which language should I use to build an MCP server?</h3>
            <p>
              TypeScript and Python have the most mature official SDKs and the most existing example servers to
              learn from, so most developers start there. Go, Java/Kotlin, and C# SDKs are also officially
              maintained if they better match your existing stack.
            </p>
            <h3>Do I need to host my MCP server, or can it run locally?</h3>
            <p>
              Most MCP servers start as local processes that your AI client launches for you (the stdio
              transport) and never need hosting at all. You only need a remote, hosted server (over HTTP/SSE) if
              multiple people need to share one instance, or if it must run somewhere other than the
              user&rsquo;s machine.
            </p>
            <h3>Is MCP the same as OpenAI-style function calling?</h3>
            <p>
              No. Function calling is a model feature for invoking a single function schema you define inline in
              your prompt. MCP is a standardized client-server protocol: one MCP server can expose many tools,
              resources, and prompts, and any MCP-compatible client can connect to it without custom integration
              code.
            </p>
            <h3>How do I test my server without restarting Claude Desktop every time?</h3>
            <p>
              Use the official MCP Inspector (<code>npx @modelcontextprotocol/inspector</code>) to run your
              server and call its tools, resources, and prompts directly in a browser UI, with live JSON-RPC
              logs, before wiring it into a full AI client.
            </p>
            <h3>Does my MCP server need authentication?</h3>
            <p>
              A local stdio server inherits the permissions of the user running it, so it typically doesn&rsquo;t
              need its own auth layer. A remote HTTP server should require a bearer token or similar credential,
              since anyone who can reach the URL can otherwise call its tools.
            </p>
            <h3>How do I get my MCP server listed on AllMCPs?</h3>
            <p>
              Publish it to npm, PyPI, or GitHub with a clear README and setup instructions, then submit it
              through the <Link href="/submit">AllMCPs submission form</Link> for review.
            </p>

            <h2 id="further-reading">Further Reading</h2>
            <ul>
              <li>
                <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener noreferrer">
                  Model Context Protocol specification
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/modelcontextprotocol/typescript-sdk"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  TypeScript SDK on GitHub
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/modelcontextprotocol/python-sdk"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Python SDK on GitHub
                </a>
              </li>
              <li>
                Not sure what MCP actually is under the hood? Read <Link href="/what-is-mcp">What is an MCP?</Link>
              </li>
              <li>
                Connecting an existing server to a client instead of building one? See the{' '}
                <Link href="/guide">LLM Agents Guide</Link>.
              </li>
              <li>
                Ready to find inspiration? <Link href="/browse">Browse the directory</Link> or explore by{' '}
                <Link href="/categories">category</Link>.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: No errors in `app/build-mcp-server/page.tsx`.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: Build succeeds; `/build-mcp-server` compiles with no type errors (this exercises the JSX, the `CopyBlock` import, and both JSON-LD objects serializing cleanly).

- [ ] **Step 5: Verify section anchors and content**

Run: `grep -c "id=\"" app/build-mcp-server/page.tsx` (expect `10`, one per nav item) and `grep -n "FAQPage\|TechArticle" app/build-mcp-server/page.tsx` (expect both present).

- [ ] **Step 6: Commit**

```bash
git add app/build-mcp-server/page.tsx
git commit -m "Expand build-mcp-server guide with resources/prompts, deployment, and FAQ"
```

---

### Task 2: Cross-link `/what-is-mcp` to the new guide

**Files:**
- Modify: `app/what-is-mcp/page.tsx`

**Interfaces:**
- Consumes: none new.
- Produces: none consumed by other tasks.

- [ ] **Step 1: Read the current file and find the "next steps" list**

Read `app/what-is-mcp/page.tsx` fresh. Locate the list containing the line:
```
<li>Browse the <Link href="/browse">AllMCPs directory</Link> to find a server for what you want your agent to do.</li>
```
and the line:
```
For a hands-on walkthrough with real configuration examples, see our <Link href="/guide">LLM Agents Guide</Link>.
```
(these were present as of plan-writing time at lines 196 and 200 — confirm against the live file since it may have shifted).

- [ ] **Step 2: Add a link to the new guide**

Using `Edit` with `old_string` matched from what you just read, add a new list item immediately after the `/browse` list item:

```
            <li>Browse the <Link href="/browse">AllMCPs directory</Link> to find a server for what you want your agent to do.</li>
            <li>Want to build your own? See <Link href="/build-mcp-server">How to Build an MCP Server</Link>.</li>
```

(replacing just the single `/browse` `<li>` line with both lines).

- [ ] **Step 3: Lint and build**

Run: `npm run lint && npm run build`
Expected: Both succeed.

- [ ] **Step 4: Verify**

Run: `grep -n "build-mcp-server" app/what-is-mcp/page.tsx`
Expected: One match, the new link.

- [ ] **Step 5: Commit**

```bash
git add app/what-is-mcp/page.tsx
git commit -m "Link what-is-mcp page to the build-mcp-server guide"
```

---

### Task 3: Cross-link `/guide` to the new guide

**Files:**
- Modify: `app/guide/page.tsx`

**Interfaces:**
- Consumes: none new.
- Produces: none consumed by other tasks.

- [ ] **Step 1: Read the current file and find the "Next steps" list**

Read `app/guide/page.tsx` fresh. Locate the block (present at plan-writing time around line 190-195):
```
          <h2 id="next-steps">Next steps</h2>
          <ul>
            <li>Not sure what MCP actually is under the hood? Read <Link href="/what-is-mcp">What is an MCP?</Link></li>
            <li>Ready to find a server? <Link href="/browse">Browse the directory</Link></li>
            <li>Built something worth sharing? <Link href="/submit">Submit your MCP server</Link></li>
          </ul>
```
Confirm exact current wording/indentation against the live file before editing.

- [ ] **Step 2: Add a link to the new guide**

Using `Edit`, insert a new `<li>` before the closing `</ul>` of that list:

```
            <li>Not sure what MCP actually is under the hood? Read <Link href="/what-is-mcp">What is an MCP?</Link></li>
            <li>Ready to find a server? <Link href="/browse">Browse the directory</Link></li>
            <li>Want to build your own instead? See <Link href="/build-mcp-server">How to Build an MCP Server</Link>.</li>
            <li>Built something worth sharing? <Link href="/submit">Submit your MCP server</Link></li>
```

- [ ] **Step 3: Lint and build**

Run: `npm run lint && npm run build`
Expected: Both succeed.

- [ ] **Step 4: Verify**

Run: `grep -n "build-mcp-server" app/guide/page.tsx`
Expected: One match, the new link.

- [ ] **Step 5: Commit**

```bash
git add app/guide/page.tsx
git commit -m "Link LLM Agents Guide to the build-mcp-server guide"
```

---

### Task 4: Add a "Build an MCP Server" link to the homepage hero

**Files:**
- Modify: `components/DirectoryGrid.tsx`

**Interfaces:**
- Consumes: none new (already imports `Link` from `next/link` at the top of the file).
- Produces: none consumed by other tasks.

- [ ] **Step 1: Read the current file and find the marketing hero**

Read `components/DirectoryGrid.tsx` fresh — this file is under active concurrent edits, so re-read immediately before editing rather than trusting any earlier snapshot. Find the section that renders (as of plan-writing time, around line 311-321):

```tsx
      {/* Marketing hero — only on the unfiltered homepage landing */}
      {!isBrowse && !selectedCategory && (
        <section className="container animate-fade-in delay-1 landing-hero">
          <h1 className="text-display">
            Give your AI agents <span className="text-brand-gradient">superpowers</span>.
          </h1>
          <p className="text-lead">
            Find the best tools to connect your favorite LLMs directly to local files, databases, and external APIs.
          </p>
        </section>
      )}
```

- [ ] **Step 2: Add a guide link below the hero copy**

Using `Edit` with the exact `old_string` from the live file, replace the closing `</p>` of the lead paragraph and the section close with:

```tsx
          <p className="text-lead">
            Find the best tools to connect your favorite LLMs directly to local files, databases, and external APIs.
          </p>
          <p className="text-meta" style={{ marginTop: '0.75rem' }}>
            Building your own? See <Link href="/build-mcp-server">How to Build an MCP Server</Link>.
          </p>
        </section>
      )}
```

- [ ] **Step 3: Lint and build**

Run: `npm run lint && npm run build`
Expected: Both succeed.

- [ ] **Step 4: Verify**

Run: `grep -n "build-mcp-server" components/DirectoryGrid.tsx`
Expected: One match, the new link.

- [ ] **Step 5: Manually check in dev server**

Run: `npm run dev`, open `/`, confirm the new line renders under the hero paragraph and the link navigates to `/build-mcp-server`. Stop the dev server after checking.

- [ ] **Step 6: Commit**

```bash
git add components/DirectoryGrid.tsx
git commit -m "Link homepage hero to the build-mcp-server guide"
```

---

### Task 5: Add a "Build an MCP Server" link to the site footer

**Files:**
- Modify: `components/SiteFooter.tsx`

**Interfaces:**
- Consumes: none new.
- Produces: none consumed by other tasks.

- [ ] **Step 1: Read the current file and find the Resources column**

Read `components/SiteFooter.tsx` fresh — this file is under active concurrent edits (a newsletter CTA was added above the footer grid as of plan-writing time), so re-read immediately before editing. Find the "Resources" column's `<ul className="site-footer-links">`, which contains `/blog`, `/pricing`, `/what-is-mcp`, and `/guide` links.

- [ ] **Step 2: Add the new link**

Using `Edit` with the exact `old_string` from the live file, add a new `<li>` after the `/guide` entry:

```tsx
            <li>
              <Link href="/guide" className="nav-link">
                LLM Agents Guide
              </Link>
            </li>
            <li>
              <Link href="/build-mcp-server" className="nav-link">
                Build an MCP Server
              </Link>
            </li>
```

- [ ] **Step 3: Lint and build**

Run: `npm run lint && npm run build`
Expected: Both succeed.

- [ ] **Step 4: Verify**

Run: `grep -n "build-mcp-server" components/SiteFooter.tsx`
Expected: One match, the new link.

- [ ] **Step 5: Commit**

```bash
git add components/SiteFooter.tsx
git commit -m "Add build-mcp-server link to site footer"
```

---

### Task 6: Add `/pricing` to the sitemap

**Files:**
- Modify: `app/sitemap.ts`

**Interfaces:**
- Consumes: none new.
- Produces: none consumed by other tasks.

- [ ] **Step 1: Read the current file**

Read `app/sitemap.ts` fresh. Find the `sitemapEntries` array, specifically the `/build-mcp-server` entry (currently the last static entry before `blogEntries`/`serverEntries` are appended):

```ts
    {
      url: `${baseUrl}/build-mcp-server`,
      lastModified: safeDateISO(new Date()),
      changeFrequency: 'monthly',
      priority: 0.9,
    }
  ];
```

- [ ] **Step 2: Add a `/pricing` entry**

Using `Edit`, replace that closing block with:

```ts
    {
      url: `${baseUrl}/build-mcp-server`,
      lastModified: safeDateISO(new Date()),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: safeDateISO(new Date()),
      changeFrequency: 'monthly',
      priority: 0.7,
    }
  ];
```

- [ ] **Step 3: Lint and build**

Run: `npm run lint && npm run build`
Expected: Both succeed.

- [ ] **Step 4: Verify**

Run: `grep -n "pricing" app/sitemap.ts`
Expected: One match, the new entry's URL line.

- [ ] **Step 5: Commit**

```bash
git add app/sitemap.ts
git commit -m "Add /pricing to the sitemap"
```

---

### Task 7: Add metadata to `/verify-request`

**Files:**
- Modify: `app/verify-request/page.tsx`

**Interfaces:**
- Consumes: `Metadata` type from `next` (new import in this file).
- Produces: none consumed by other tasks.

- [ ] **Step 1: Read the current file**

Read `app/verify-request/page.tsx` fresh. Current content starts:

```tsx
import { Mail } from 'lucide-react';
import Link from 'next/link';
import { PageShell } from '@/components/PageShell';

export default function VerifyRequestPage() {
```

- [ ] **Step 2: Add a noindex metadata export**

Using `Edit`, replace that block with:

```tsx
import { Mail } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { PageShell } from '@/components/PageShell';

export const metadata: Metadata = {
  title: 'Check your email',
  description: 'A sign-in link has been sent to your email address.',
  robots: {
    index: false,
    follow: true,
  },
};

export default function VerifyRequestPage() {
```

This mirrors the existing pattern in `app/login/page.tsx` (`robots: { index: false, follow: true }`).

- [ ] **Step 3: Lint and build**

Run: `npm run lint && npm run build`
Expected: Both succeed.

- [ ] **Step 4: Verify**

Run: `grep -n "export const metadata" app/verify-request/page.tsx`
Expected: One match.

- [ ] **Step 5: Commit**

```bash
git add app/verify-request/page.tsx
git commit -m "Add noindex metadata to verify-request page"
```

---

### Task 8: Add `/build-mcp-server` and `/pricing` to `llms.txt`

**Files:**
- Modify: `app/llms.txt/route.ts`

**Interfaces:**
- Consumes: none new.
- Produces: none consumed by other tasks.

- [ ] **Step 1: Read the current file**

Read `app/llms.txt/route.ts` fresh. Find the "Useful Links" section:

```ts
  content += `## Useful Links\n`;
  content += `- Directory Homepage: https://allmcps.com\n`;
  content += `- Categories: https://allmcps.com/categories\n`;
  content += `- MCP Guide: https://allmcps.com/guide\n`;
  content += `- What is MCP: https://allmcps.com/what-is-mcp\n`;
```

- [ ] **Step 2: Add the missing links**

Using `Edit`, replace that block with:

```ts
  content += `## Useful Links\n`;
  content += `- Directory Homepage: https://allmcps.com\n`;
  content += `- Categories: https://allmcps.com/categories\n`;
  content += `- MCP Guide: https://allmcps.com/guide\n`;
  content += `- What is MCP: https://allmcps.com/what-is-mcp\n`;
  content += `- How to Build an MCP Server: https://allmcps.com/build-mcp-server\n`;
  content += `- Pricing: https://allmcps.com/pricing\n`;
```

- [ ] **Step 3: Lint and build**

Run: `npm run lint && npm run build`
Expected: Both succeed.

- [ ] **Step 4: Verify**

Run: `grep -n "build-mcp-server\|pricing" app/llms.txt/route.ts`
Expected: Two matches, the two new lines added in Step 2.

- [ ] **Step 5: Commit**

```bash
git add app/llms.txt/route.ts
git commit -m "Add build-mcp-server and pricing links to llms.txt"
```

---

## Final verification (after all tasks)

- [ ] Run `npm run build` once more from a clean state to confirm every change together still compiles.
- [ ] Run `npm run dev`, then visit `/build-mcp-server`, `/what-is-mcp`, `/guide`, `/`, and the footer on any page — confirm every new link resolves and every `CopyBlock` copy button works (click it, confirm the toast and clipboard icon swap appear).
- [ ] Fetch `/llms.txt` and `/sitemap.xml` in the dev server and confirm the new lines/entries are present.
