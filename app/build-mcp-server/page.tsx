import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'How to Build an MCP Server (Developer Guide)',
  description:
    'Step-by-step developer tutorial for building Model Context Protocol (MCP) servers in TypeScript and Python, implementing tools, and publishing.',
  alternates: {
    canonical: 'https://allmcps.com/build-mcp-server',
  },
  openGraph: {
    title: 'How to Build an MCP Server (Developer Guide) | AllMCPs',
    description:
      'Step-by-step developer tutorial for building Model Context Protocol (MCP) servers in TypeScript and Python.',
    url: 'https://allmcps.com/build-mcp-server',
  },
};

const guideJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'TechArticle',
  headline: 'How to Build an MCP Server: Complete Developer Guide',
  description:
    'Comprehensive step-by-step guide to building Model Context Protocol (MCP) servers using TypeScript and Python SDKs.',
  author: { '@type': 'Organization', name: 'AllMCPs' },
  publisher: { '@type': 'Organization', name: 'AllMCPs' },
};

export default function BuildMCPServerPage() {
  return (
    <main className="page-shell page-shell--content">
      <div className="page-shell-inner">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(guideJsonLd) }}
        />
        <div className="surface page-panel">
          <h1 className="text-page-title" style={{ marginBottom: '0.5rem' }}>
            How to Build an MCP Server
          </h1>
          <p className="text-lead" style={{ marginBottom: '2rem' }}>
            A hands-on developer guide to building custom Model Context Protocol servers in TypeScript and Python.
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
                <a href="#overview">Overview & Core Concepts</a>
              </li>
              <li>
                <a href="#typescript-guide">Building with TypeScript</a>
              </li>
              <li>
                <a href="#python-guide">Building with Python</a>
              </li>
              <li>
                <a href="#primitives">Tools, Resources & Prompts</a>
              </li>
              <li>
                <a href="#testing">Testing with MCP Inspector & Claude Desktop</a>
              </li>
              <li>
                <a href="#publishing">Publishing & Listing on AllMCPs</a>
              </li>
            </ul>
          </nav>

          <div className="markdown-body">
            <h2 id="overview">Overview & Core Concepts</h2>
            <p>
              An <strong>MCP Server</strong> is a lightweight process that exposes capabilities (tools, data
              resources, or prompt templates) over standard JSON-RPC 2.0. Any MCP-compatible AI client (like
              Claude Desktop, Cursor, or Claude Code) can connect to your server and invoke its tools on demand.
            </p>

            <h2 id="typescript-guide">Building with TypeScript</h2>
            <p>
              The official <code>@modelcontextprotocol/sdk</code> package makes creating TypeScript MCP servers
              straightforward:
            </p>
            <pre>
              <code>{`npm install @modelcontextprotocol/sdk zod`}</code>
            </pre>
            <p>Here is a complete working TypeScript server that exposes a calculator tool:</p>
            <pre>
              <code>{`import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const server = new Server(
  { name: "my-calculator-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

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
    return {
      content: [{ type: "text", text: String(a + b) }]
    };
  }
  throw new Error("Tool not found");
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);`}</code>
            </pre>

            <h2 id="python-guide">Building with Python</h2>
            <p>
              Python developers can use the official <code>mcp</code> library or FastMCP wrapper:
            </p>
            <pre>
              <code>{`pip install "mcp[cli]"`}</code>
            </pre>
            <p>Creating a server with FastMCP takes just a few lines of code:</p>
            <pre>
              <code>{`from mcp.server.fastmcp import FastMCP

mcp = FastMCP("My Python Tool")

@mcp.tool()
def add_numbers(a: int, b: int) -> int:
    """Add two numbers together."""
    return a + b

if __name__ == "__main__":
    mcp.run()`}</code>
            </pre>

            <h2 id="primitives">Tools, Resources & Prompts</h2>
            <ul>
              <li>
                <strong>Tools</strong>: Functions that execute side effects or perform calculations. Always provide
                clear parameters and descriptive JSON schema so the AI model knows when and how to call them.
              </li>
              <li>
                <strong>Resources</strong>: Read-only data sources identified by URIs (e.g.{' '}
                <code>file:///logs/app.log</code> or <code>db://users/123</code>).
              </li>
              <li>
                <strong>Prompts</strong>: Reusable template workflows that users can invoke directly inside their AI
                client interface.
              </li>
            </ul>

            <h2 id="testing">Testing with MCP Inspector</h2>
            <p>
              Test your server directly in your browser without restarting your AI client using the official MCP
              Inspector:
            </p>
            <pre>
              <code>{`npx @modelcontextprotocol/inspector node dist/index.js`}</code>
            </pre>
            <p>
              This launches an interactive UI where you can test tool execution, inspect schemas, and view real-time
              JSON-RPC messages.
            </p>

            <h2 id="publishing">Publishing & Listing on AllMCPs</h2>
            <p>Once your server is ready:</p>
            <ol>
              <li>Publish your package to NPM (for Node.js) or PyPI (for Python), or host it on GitHub.</li>
              <li>
                Include a <code>README.md</code> with clear setup instructions for <code>claude_desktop_config.json</code>.
              </li>
              <li>
                Head over to our <Link href="/submit">Submit Page</Link> to list your server on AllMCPs and reach
                thousands of AI developers!
              </li>
            </ol>
          </div>
        </div>
      </div>
    </main>
  );
}
