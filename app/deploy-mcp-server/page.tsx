import { Metadata } from 'next';
import Link from 'next/link';
import { CopyBlock } from '@/components/ui/CopyBlock';
import { TableOfContents, TocItem } from '@/components/ui/TableOfContents';

export const metadata: Metadata = {
  title: 'Deploying & Hosting Remote MCP Servers Guide',
  description:
    'Deploy and host remote MCP servers on Cloudflare Workers, Docker, Fly.io, and AWS with SSE transport, CORS, SSL, and monitoring best practices.',
  alternates: {
    canonical: 'https://allmcps.com/deploy-mcp-server',
  },
  openGraph: {
    title: 'Deploying & Hosting Remote MCP Servers Guide | AllMCPs',
    description:
      'Deploy and host remote MCP servers on Cloudflare Workers, Docker, Fly.io, and AWS with SSE transport, CORS, SSL, and monitoring best practices.',
    url: 'https://allmcps.com/deploy-mcp-server',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Deploying & Hosting Remote MCP Servers Guide | AllMCPs',
    description:
      'Deploy and host remote MCP servers on Cloudflare Workers, Docker, Fly.io, and AWS with SSE transport, CORS, SSL, and monitoring best practices.',
  },
};

const faqs = [
  {
    q: 'When should I deploy a remote MCP server instead of running stdio locally?',
    a: 'Use local stdio when your server needs direct access to local developer resources (files, local git repos, localhost databases) on the user machine. Deploy a remote server over HTTP/SSE when multiple users or autonomous AI agents need centralized access to shared cloud databases, enterprise APIs, heavy compute environments, or third-party SaaS integrations without requiring every client machine to run local processes and store API keys.',
  },
  {
    q: 'How does remote MCP communication work over HTTP/SSE?',
    a: 'The client establishes a persistent HTTP GET connection to a Server-Sent Events (/sse) endpoint on the server to listen for server-to-client JSON-RPC messages and notifications. The server returns a session URI. Subsequent client-to-server requests (like calling a tool or reading a resource) are delivered as HTTP POST requests to /message?sessionId=<session_id>.',
  },
  {
    q: 'Can I deploy an MCP server on serverless platforms like Cloudflare Workers or AWS Lambda?',
    a: 'Yes! Serverless deployments on Cloudflare Workers (via the agents package and McpAgent class) or AWS Lambda / API Gateway operate effectively for stateless tool invocations. Cloudflare Workers handle streaming HTTP connections efficiently, making them one of the fastest and lowest-cost ways to host remote MCP tools globally.',
  },
  {
    q: 'How do I handle authentication and API keys for a remote MCP server?',
    a: 'Remote MCP servers should require authentication over HTTPS. Pass authorization tokens using standard Bearer HTTP headers (Authorization: Bearer <token>) or query tokens, and validate them using JWT verification or OAuth 2.0 PKCE. Server-side API credentials (such as Stripe or database keys) remain safely stored in cloud secret managers rather than exposed on client machines.',
  },
  {
    q: 'How do I proxy a local stdio MCP server over SSE/HTTP for remote clients?',
    a: 'You can wrap any existing stdio MCP server in an SSE wrapper process using reverse proxies or lightweight Node.js/Python bridge scripts (such as mcp-proxy or supergateway) that translate incoming HTTP POST requests and SSE streams into stdio stdin/stdout lines for the child process.',
  },
  {
    q: 'How do I keep my remote MCP server secure and prevent unauthorized usage?',
    a: 'Enforce strict TLS (HTTPS), validate CORS headers for web-based clients, implement rate limiting per token, sandbox any dynamic code execution inside containers or cloud isolates, validate inputs with Zod schemas, and never print raw debugging logs to stdout in stdio mode.',
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

const techArticleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'TechArticle',
  headline: 'Deploying & Hosting Remote MCP Servers: Production Cloud Guide',
  description:
    'Step-by-step blueprints for deploying production-ready remote Model Context Protocol (MCP) servers to Cloudflare Workers, Docker, Fly.io, and AWS Lambda with HTTP/SSE transports.',
  author: { '@type': 'Organization', name: 'AllMCPs' },
  publisher: { '@type': 'Organization', name: 'AllMCPs' },
  isPartOf: { '@type': 'CollectionPage', name: 'MCP Guides', '@id': 'https://allmcps.com/guides' },
};

const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Guides', item: 'https://allmcps.com/guides' },
    { '@type': 'ListItem', position: 2, name: 'Deploy MCP Server', item: 'https://allmcps.com/deploy-mcp-server' },
  ],
};

const tocItems: TocItem[] = [
  { id: 'short-answer', text: 'Stdio vs Remote HTTP/SSE: When to Deploy' },
  { id: 'architecture', text: 'Remote MCP Architecture & Transport Flow' },
  { id: 'cloudflare', text: 'Deploying on Cloudflare Workers (Edge)' },
  { id: 'docker', text: 'Containerizing MCP Servers with Docker' },
  { id: 'cloud-hosts', text: 'Deploying to Fly.io & Cloud Platforms' },
  { id: 'express-sse', text: 'Express SSE Remote Server Code (TypeScript)' },
  { id: 'reverse-proxy', text: 'Reverse Proxies (Nginx & Caddy) & SSL' },
  { id: 'secrets-security', text: 'Secrets Management & CORS Hardening' },
  { id: 'monitoring', text: 'Health Monitoring & Log Hygiene' },
  { id: 'client-config', text: 'Connecting Clients to Remote Servers' },
  { id: 'faq', text: 'Frequently Asked Questions' },
  { id: 'next-steps', text: 'Next Steps & Ecosystem Resources' },
];

export default function DeployMCPServerPage() {
  return (
    <main className="page-shell page-shell--default">
      <div className="page-shell-inner">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(techArticleJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
        />

        <div className="lg:grid lg:grid-cols-[1fr_260px] lg:gap-10">
          <div className="surface page-panel min-w-0">
            {/* Breadcrumb Navigation */}
            <nav aria-label="Breadcrumb" style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
              <Link href="/guides" style={{ color: 'var(--text-secondary)' }}>
                Guides
              </Link>
              <span style={{ color: 'var(--text-secondary)', margin: '0 0.4rem' }}>/</span>
              <span style={{ color: 'var(--text-primary)' }}>Deploy MCP Server</span>
            </nav>

            <h1 className="text-page-title" style={{ marginBottom: '0.5rem' }}>
              Deploying &amp; Hosting Remote MCP Servers
            </h1>

            <p className="text-lead" style={{ marginBottom: '2rem' }}>
              A complete, hands-on production guide to hosting remote Model Context Protocol servers on Cloudflare Workers, Docker containers, Fly.io, and AWS with SSE transports, reverse proxies, and enterprise security.
            </p>

            {/* Mobile Table of Contents */}
            <div className="lg:hidden" style={{ marginBottom: '2rem' }}>
              <TableOfContents items={tocItems} />
            </div>

            {/* Main Content inside standard markdown-body */}
            <div className="markdown-body">
              {/* TL;DR Quickstart Box */}
              <div
                style={{
                  background: 'rgba(var(--accent-rgb), 0.05)',
                  borderLeft: '4px solid var(--accent-color)',
                  borderRadius: '12px',
                  padding: '1.25rem 1.5rem',
                  marginBottom: '2.5rem',
                }}
              >
                <h2
                  style={{
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    margin: '0 0 0.5rem 0',
                    borderBottom: 'none',
                    paddingBottom: 0,
                  }}
                >
                  TL;DR &mdash; Production Deployment Quickstart
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0, lineHeight: 1.65 }}>
                  Running a local <code>stdio</code> MCP server is ideal for personal dev tools. To share tools across your team or AI agent fleet, wrap your MCP logic in an <strong>HTTP/SSE transport</strong>, package it as a Docker image or Cloudflare Worker, enforce TLS &amp; Bearer token auth, and route requests to dedicated <code>/sse</code> and <code>/message</code> endpoints.
                </p>
              </div>

              <h2 id="short-answer">Stdio vs Remote HTTP/SSE: When to Deploy</h2>
              <p>
                The <strong>Model Context Protocol (MCP)</strong> supports two primary transport mechanisms for communicating between host AI applications (Claude Desktop, Claude Code, Cursor, Windsurf) and MCP servers:
              </p>
              <ul>
                <li>
                  <strong>Standard Input/Output (stdio):</strong> The client launches the server as a local child process. Messages stream over OS IPC pipes (<code>stdin</code> and <code>stdout</code>). This requires zero network setup and is perfect for desktop tools touching local files.
                </li>
                <li>
                  <strong>Server-Sent Events (SSE) &amp; Streamable HTTP:</strong> The server operates as an independent web service listening on an HTTP port. The client connects over network endpoints (<code>/sse</code> for streaming server-to-client events and <code>/message</code> for client-to-server POST requests).
                </li>
              </ul>
              <p>
                Deploying a <strong>remote MCP server</strong> is necessary when:
              </p>
              <ul>
                <li>Multiple team members or autonomous AI agents need to query a shared centralized database or private microservice without replicating database credentials locally.</li>
                <li>Your MCP server requires high-throughput compute, GPU acceleration, or persistent background tasks that cannot run on end-user laptops.</li>
                <li>You are building a SaaS product or commercial tool that exposes MCP capabilities to subscribers over API authentication.</li>
              </ul>

              <h2 id="architecture">Remote MCP Architecture &amp; Transport Flow</h2>
              <p>
                Understanding the lifecycle of a remote SSE MCP session helps avoid common network disconnects and connection leaks:
              </p>
              <ol>
                <li>
                  <strong>Session Initialization (HTTP GET /sse):</strong> The AI client opens an HTTP GET request to the server&rsquo;s <code>/sse</code> endpoint. The server responds with <code>Content-Type: text/event-stream</code> and sends an initial event payload containing an <code>endpoint</code> URL with a unique session ID:
                  <CopyBlock code={`event: endpoint\ndata: /message?sessionId=sess_987654321_abc`} />
                </li>
                <li>
                  <strong>Client Request Dispatch (HTTP POST /message):</strong> Whenever the host model calls an MCP tool or requests a resource, the client sends an HTTP POST to <code>/message?sessionId=sess_987654321_abc</code> containing standard JSON-RPC 2.0 requests:
                  <CopyBlock
                    code={`{\n  "jsonrpc": "2.0",\n  "id": 1,\n  "method": "tools/call",\n  "params": {\n    "name": "query_database",\n    "arguments": { "query": "SELECT count(*) FROM users;" }\n  }\n}`}
                  />
                </li>
                <li>
                  <strong>Server Execution &amp; SSE Stream Response:</strong> The server receives the POST request, processes the handler asynchronously, and pushes the JSON-RPC response back down the persistent SSE connection.
                </li>
              </ol>

              <h2 id="cloudflare">Deploying on Cloudflare Workers (Edge Serverless)</h2>
              <p>
                Cloudflare Workers provide an ultra-low latency, globally distributed edge environment for hosting stateless or durable MCP tools. Using Cloudflare&rsquo;s official <code>agents</code> framework, you can deploy a remote MCP server in minutes:
              </p>
              <CopyBlock
                code={`// wrangler.json
{
  "name": "production-mcp-agent",
  "main": "src/index.ts",
  "compatibility_date": "2026-01-01",
  "observability": { "enabled": true }
}`}
              />
              <p>Write your server logic inside <code>src/index.ts</code>:</p>
              <CopyBlock
                code={`import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export class CloudflareMCPServer extends McpAgent {
  server = new McpServer({
    name: "cloud-mcp-service",
    version: "1.0.0",
  });

  async init() {
    // Register custom production tool
    this.server.tool(
      "fetch_weather_forecast",
      {
        city: z.string().min(2),
        units: z.enum(["celsius", "fahrenheit"]).default("celsius"),
      },
      async ({ city, units }) => {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                city,
                temp: units === "celsius" ? 22 : 72,
                condition: "Sunny",
              }),
            },
          ],
        };
      }
    );
  }
}

export default {
  async fetch(request: Request, env: Record<string, unknown>, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // Secure endpoint with Bearer Token validation
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized: Missing Bearer Token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname.startsWith("/mcp")) {
      return CloudflareMCPServer.serve("/mcp").fetch(request, env, ctx);
    }

    return new Response("MCP Server operational.", { status: 200 });
  },
};`}
              />
              <p>Deploy to Cloudflare Workers with a single command:</p>
              <CopyBlock code={`npx wrangler deploy`} />

              <h2 id="docker">Containerizing MCP Servers with Docker</h2>
              <p>
                For microservices, enterprise Linux servers, or Kubernetes deployments, containerizing your MCP server guarantees consistent runtimes and isolates host system dependencies.
              </p>
              <p>Below is an optimized, multi-stage <code>Dockerfile</code> for a TypeScript MCP server:</p>
              <CopyBlock
                code={`# Stage 1: Build TypeScript binaries
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build

# Stage 2: Production runtime image
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Security: Run as non-root user
USER node

COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist

EXPOSE 3001
CMD ["node", "dist/server.js"]`}
              />
              <p>Combine your server container with Docker Compose for local testing or production deployment:</p>
              <CopyBlock
                code={`# docker-compose.yml
version: '3.8'
services:
  mcp-server:
    build: .
    ports:
      - "3001:3001"
    environment:
      - PORT=3001
      - DATABASE_URL=postgresql://user:secret@db:5432/app_db
      - MCP_API_KEY=prod_mcp_sec_8f92a1b3c4
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 5s
      retries: 3`}
              />

              <h2 id="cloud-hosts">Deploying to Fly.io &amp; Cloud Platforms</h2>
              <p>
                Platforms like <strong>Fly.io</strong>, <strong>Railway</strong>, and <strong>Render</strong> excel at hosting containerized SSE services because they support persistent, long-lived TCP/HTTP connections without strict gateway timeouts.
              </p>
              <p>To deploy to Fly.io using their CLI:</p>
              <CopyBlock
                code={`# Generate fly.toml configuration
fly launch --name my-remote-mcp-server --no-deploy

# Deploy container image to Fly.io global region
fly deploy`}
              />
              <p>Configure secrets securely using Fly CLI instead of committing credentials to source code:</p>
              <CopyBlock code={`fly secrets set DATABASE_URL="postgresql://user:pass@host:5432/db" MCP_AUTH_TOKEN="sec_key_12345"`} />

              <h2 id="express-sse">Express SSE Remote Server Code (TypeScript)</h2>
              <p>
                Below is a complete, production-ready Express.js server written in TypeScript that configures the official <code>SSEServerTransport</code> from <code>@modelcontextprotocol/sdk</code> with session tracking:
              </p>
              <CopyBlock
                code={`import express from 'express';
import cors from 'cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// Active sessions map
const transports = new Map<string, SSEServerTransport>();

// Initialize MCP Server capabilities
function createMcpServer() {
  const server = new McpServer({
    name: "production-express-mcp",
    version: "1.0.0",
  });

  server.tool(
    "calculate_tax",
    {
      amount: z.number().positive(),
      state: z.string().length(2),
    },
    async ({ amount, state }) => {
      const taxRate = state.toUpperCase() === 'CA' ? 0.0725 : 0.05;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              subtotal: amount,
              tax: Number((amount * taxRate).toFixed(2)),
              total: Number((amount * (1 + taxRate)).toFixed(2)),
            }),
          },
        ],
      };
    }
  );

  return server;
}

// 1. SSE Connection Endpoint
app.get('/sse', async (req, res) => {
  console.log('Client connected to /sse');
  const transport = new SSEServerTransport('/message', res);
  const server = createMcpServer();

  transports.set(transport.sessionId, transport);

  req.on('close', () => {
    console.log(\`Session \${transport.sessionId} closed\`);
    transports.delete(transport.sessionId);
  });

  await server.connect(transport);
});

// 2. HTTP POST Message Endpoint
app.post('/message', async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports.get(sessionId);

  if (!transport) {
    res.status(404).send('Session not found or expired');
    return;
  }

  await transport.handlePostMessage(req, res);
});

// Health check endpoint for load balancers
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', activeSessions: transports.size });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(\`Remote MCP Express server listening on http://localhost:\${PORT}\`);
});`}
              />

              <h2 id="reverse-proxy">Reverse Proxies (Nginx &amp; Caddy) &amp; SSL Setup</h2>
              <p>
                Never expose Node.js or Python application processes directly to the public internet. Always place a reverse proxy like <strong>Nginx</strong> or <strong>Caddy</strong> in front to handle HTTPS TLS termination, HTTP/1.1 response streaming, and client request buffering.
              </p>
              <h3 style={{ borderBottom: 'none', paddingBottom: 0, marginTop: '1.5rem', marginBottom: '0.5rem' }}>
                Caddyfile Configuration (Automatic Let&rsquo;s Encrypt SSL)
              </h3>
              <CopyBlock
                code={`mcp.yourdomain.com {
    # Automatic TLS certificate provisioned by Caddy
    reverse_proxy localhost:3001 {
        # Flush SSE data immediately to prevent response buffering delay
        flush_interval -1
    }
}`}
              />
              <h3 style={{ borderBottom: 'none', paddingBottom: 0, marginTop: '1.5rem', marginBottom: '0.5rem' }}>
                Nginx Configuration (For Long-Lived SSE Connections)
              </h3>
              <CopyBlock
                code={`server {
    listen 443 ssl http2;
    server_name mcp.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/mcp.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mcp.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;

        # Mandatory Nginx directives for Server-Sent Events (SSE)
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding on;

        # Increase timeout for persistent client connections
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}`}
              />

              <h2 id="secrets-security">Secrets Management &amp; CORS Hardening</h2>
              <p>
                When hosting an MCP server in the cloud, security is a paramount concern. Review our comprehensive{' '}
                <Link href="/mcp-security">MCP Security Guide</Link> and{' '}
                <Link href="/blog/securing-remote-mcp-servers-authentication-guide">Remote Authentication Guide</Link>{' '}
                for enterprise threat models. Always follow these infrastructure rules:
              </p>
              <ul>
                <li>
                  <strong>Never hardcode API Keys:</strong> Inject credentials using environment variables (<code>process.env.API_KEY</code>) or platform secret vaults (AWS Secrets Manager, Cloudflare Environment Secrets, Vault).
                </li>
                <li>
                  <strong>Restrict CORS Origins:</strong> If your remote server will be accessed from browser-based web clients or extensions, restrict <code>Access-Control-Allow-Origin</code> to known explicit domain origins rather than wildcard (<code>*</code>).
                </li>
                <li>
                  <strong>Rate Limiting:</strong> Use Nginx <code>limit_req_zone</code> or Redis rate-limiting middleware to cap incoming tool calls per token, protecting downstream APIs from runaway agent loops.
                </li>
              </ul>

              <h2 id="monitoring">Health Monitoring &amp; Log Hygiene</h2>
              <p>
                Maintaining operational observability for remote MCP servers requires separating stdout, stderr, and HTTP response channels cleanly:
              </p>
              <div
                style={{
                  background: 'rgba(245, 158, 11, 0.06)',
                  borderLeft: '4px solid #f59e0b',
                  borderRadius: '12px',
                  padding: '1.25rem 1.5rem',
                  margin: '1.75rem 0',
                }}
              >
                <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)', fontWeight: 600, fontSize: '1rem' }}>
                  ⚠️ Critical Logging Rule for Stdio vs SSE Transports
                </h3>
                <p style={{ margin: 0, fontSize: '0.925rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  In <code>stdio</code> mode, writing raw <code>console.log()</code> text to standard output corrupts the JSON-RPC transport stream and crashes the client. In <strong>remote HTTP/SSE mode</strong>, standard output is safe for application logs, but server metrics should still route to structured log aggregators (Datadog, CloudWatch, Axiom).
                </p>
              </div>
              <p>Expose a lightweight <code>/health</code> endpoint for load balancer health probes:</p>
              <CopyBlock
                code={`app.get('/health', async (req, res) => {
  try {
    // Optionally ping database or internal cache
    await db.raw('SELECT 1');
    res.status(200).json({ status: 'healthy', uptime: process.uptime() });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', error: err instanceof Error ? err.message : 'DB error' });
  }
});`}
              />

              <h2 id="client-config">Connecting Clients to Remote Servers</h2>
              <p>
                Once your remote MCP server is deployed over HTTPS, users and developers can connect their AI clients by updating their JSON configuration snippets.
              </p>
              <p>Example <code>claude_desktop_config.json</code> configuration for a remote SSE server:</p>
              <CopyBlock
                code={`{\n  "mcpServers": {\n    "remote-analytics-mcp": {\n      "url": "https://mcp.yourdomain.com/sse",\n      "headers": {\n        "Authorization": "Bearer sec_prod_token_998877"\n      }\n    }\n  }\n}`}
              />
              <p>
                For step-by-step instructions across Claude Code, Cursor, Windsurf, and VS Code, consult our detailed{' '}
                <Link href="/guide">LLM Agents Integration Guide</Link>.
              </p>

              {/* Redesigned, Premium FAQ Section */}
              <h2 id="faq">Frequently Asked Questions</h2>
              <div style={{ display: 'grid', gap: '1.25rem', marginTop: '1.5rem', marginBottom: '2.5rem' }}>
                {faqs.map((f) => (
                  <div
                    key={f.q}
                    style={{
                      padding: '1.25rem 1.5rem',
                      borderRadius: '12px',
                      background: 'rgba(255, 255, 255, 0.025)',
                      border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                    }}
                  >
                    <h3
                      style={{
                        fontSize: '1.05rem',
                        fontWeight: 600,
                        marginTop: 0,
                        marginBottom: '0.5rem',
                        color: 'var(--text-primary)',
                        borderBottom: 'none',
                        paddingBottom: 0,
                      }}
                    >
                      {f.q}
                    </h3>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.65, fontSize: '0.95rem' }}>
                      {f.a}
                    </p>
                  </div>
                ))}
              </div>

              <h2 id="next-steps">Next Steps &amp; Ecosystem Resources</h2>
              <p>Now that your remote MCP server is live in production, explore the rest of the AllMCPs documentation hub:</p>
              <ul>
                <li>
                  Need to build a custom server first? Follow our step-by-step{' '}
                  <Link href="/build-mcp-server">How to Build an MCP Server Guide</Link>.
                </li>
                <li>
                  Deep dive into OAuth 2.0 PKCE and JWT auth with our guide to{' '}
                  <Link href="/blog/securing-remote-mcp-servers-authentication-guide">
                    Securing Remote MCP Servers
                  </Link>.
                </li>
                <li>
                  Review complete threat models and prompt injection safety in our{' '}
                  <Link href="/mcp-security">MCP Security Best Practices</Link>.
                </li>
                <li>
                  Ready to publish your server to thousands of AI developers?{' '}
                  <Link href="/submit">Submit your MCP server to AllMCPs</Link> or check out our{' '}
                  <Link href="/tools">Free Developer Tools</Link>.
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
