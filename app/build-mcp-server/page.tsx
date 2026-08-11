import { Metadata } from 'next';
import Link from 'next/link';
import { CopyBlock } from '@/components/ui/CopyBlock';
import { TableOfContents, TocItem } from '@/components/ui/TableOfContents';
import { FaqSection } from '@/components/ui/FaqSection';

export const metadata: Metadata = {
  title: 'How to Build an MCP Server (Developer Guide)',
  description:
    'Build a Model Context Protocol server from scratch: TypeScript and Python code for tools, resources, and prompts, plus testing, deployment, and publishing.',
  alternates: {
    canonical: 'https://allmcps.com/build-mcp-server',
  },
  openGraph: {
    images: [{ url: 'https://allmcps.com/opengraph-image', width: 1200, height: 630, alt: 'AllMCPs' }],
    title: 'How to Build an MCP Server (Developer Guide) | AllMCPs',
    description:
      'Build a Model Context Protocol server from scratch: TypeScript and Python code for tools, resources, and prompts, plus testing, deployment, and publishing.',
    url: 'https://allmcps.com/build-mcp-server',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'How to Build an MCP Server (Developer Guide) | AllMCPs',
    description:
      'Build a Model Context Protocol server from scratch: TypeScript and Python code for tools, resources, and prompts, plus testing, deployment, and publishing.',
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

const tocItems: TocItem[] = [
  { id: 'overview', text: 'Overview & Core Concepts' },
  { id: 'choosing-stack', text: 'Choosing Your Stack' },
  { id: 'typescript-guide', text: 'Building with TypeScript' },
  { id: 'python-guide', text: 'Building with Python' },
  { id: 'primitives', text: 'Tools, Resources & Prompts' },
  { id: 'testing', text: 'Testing Locally' },
  { id: 'deploying', text: 'Deploying a Remote Server' },
  { id: 'publishing', text: 'Publishing & Listing on AllMCPs' },
  { id: 'faq', text: 'FAQ' },
  { id: 'further-reading', text: 'Further Reading' },
];

const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://allmcps.com' },
    { '@type': 'ListItem', position: 2, name: 'Guides', item: 'https://allmcps.com/guides' },
    { '@type': 'ListItem', position: 3, name: 'Build an MCP Server', item: 'https://allmcps.com/build-mcp-server' },
  ],
};

export default function BuildMCPServerPage() {
  return (
    <main className="page-shell page-shell--default">
      <div className="page-shell-inner">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(techArticleJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
        />
        <div className="lg:grid lg:grid-cols-[1fr_260px] lg:gap-10">
          <div className="surface page-panel min-w-0">
            <nav aria-label="Breadcrumb" style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
              <Link href="/guides" style={{ color: 'var(--text-secondary)' }}>
                Guides
              </Link>
              <span style={{ color: 'var(--text-secondary)', margin: '0 0.4rem' }}>/</span>
              <span style={{ color: 'var(--text-primary)' }}>Build an MCP Server</span>
            </nav>

            <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto 2.5rem' }}>
              <h1 className="text-page-title" style={{ marginBottom: '0.5rem' }}>
                How to Build an MCP Server
              </h1>
              <p className="text-lead" style={{ margin: 0 }}>
                A complete, hands-on developer guide to building, testing, deploying, and publishing custom Model
                Context Protocol servers in TypeScript and Python. New to MCP itself? Start with{' '}
                <Link href="/what-is-mcp">What is an MCP?</Link> first.
              </p>
            </div>

            {/* Mobile Table of Contents */}
            <div className="lg:hidden" style={{ marginBottom: '2rem' }}>
              <TableOfContents items={tocItems} />
            </div>

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

                  <div style={{ marginTop: '2rem', marginBottom: '2.5rem' }}>
                <FaqSection
                  title="Frequently Asked Questions"
                  items={[
                    {
                      question: 'Which language should I use to build an MCP server?',
                      answer: 'TypeScript and Python have the most mature official SDKs and the most existing example servers to learn from, so most developers start there. Go, Java/Kotlin, and C# SDKs are also officially maintained if they better match your existing stack.',
                    },
                    {
                      question: 'Do I need to host my MCP server, or can it run locally?',
                      answer: 'Most MCP servers start as local processes that your AI client launches for you (the stdio transport) and never need hosting at all. You only need a remote, hosted server (over HTTP/SSE) if multiple people need to share one instance, or if it must run somewhere other than the user\'s machine.',
                    },
                    {
                      question: 'Is MCP the same as OpenAI-style function calling?',
                      answer: 'Function calling is a model feature for invoking a single function schema. MCP is a standardized client-server protocol: one MCP server can expose many tools, resources, and prompts, and any MCP-compatible client can connect to it seamlessly.',
                    },
                    {
                      question: 'How do I test my server without restarting Claude Desktop every time?',
                      answer: 'Use the official MCP Inspector (npx @modelcontextprotocol/inspector) to run your server and call its tools, resources, and prompts directly in a browser UI, with live JSON-RPC logs, before wiring it into a full AI client.',
                    },
                    {
                      question: 'Does my MCP server need authentication?',
                      answer: 'A local stdio server inherits the permissions of the user running it, so it typically doesn\'t need its own auth layer. A remote HTTP server should require a bearer token or similar credential.',
                    },
                    {
                      question: 'How do I get my MCP server listed on AllMCPs?',
                      answer: (
                        <span>
                          Publish it to npm, PyPI, or GitHub with a clear README and setup instructions, then submit it through the <Link href="/submit">AllMCPs submission form</Link> for review.
                        </span>
                      ),
                    },
                  ]}
                />
              </div>

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
                  Ready to take your server to production? Read our <Link href="/deploy-mcp-server">Deploying &amp; Hosting Remote MCP Servers Guide</Link>.
                </li>
                <li>
                  Ready to find inspiration? <Link href="/browse">Browse the directory</Link> or explore by{' '}
                  <Link href="/categories">category</Link>.
                </li>
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
