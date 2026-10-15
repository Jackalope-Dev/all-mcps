import type { Metadata } from 'next';
import Link from 'next/link';
import { ArticleLayout } from '@/components/content/ArticleLayout';
import { CopyCommand } from '@/components/content/CopyCommand';
import { CopyBlock } from '@/components/ui/CopyBlock';
import type { TocItem } from '@/components/ui/TableOfContents';
import { serializeJsonLd } from '@/lib/jsonLd';

export const metadata: Metadata = {
  title: 'AllMCPs API Documentation',
  description:
    'Public AllMCPs REST API for searching MCP servers, fetching listing markdown, health checks, and badges. Built for AI agents and developer integrations.',
  alternates: { canonical: 'https://allmcps.com/docs/api' },
  openGraph: {
    images: [
      {
        url: 'https://allmcps.com/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'AllMCPs',
      },
    ],
    title: 'AllMCPs API Documentation',
    description:
      'Search MCP servers, fetch markdown docs, and integrate the AllMCPs directory into agents and tools.',
    url: 'https://allmcps.com/docs/api',
    type: 'website',
  },
};

const ENDPOINTS = [
  {
    method: 'GET',
    path: '/api/v1/search',
    title: 'Search servers',
    desc: 'Keyword, semantic and category search over listed servers, ranked toward ones we have seen run. Optional transport=stdio|remote and verified=1 filters. Returns install hints with confidence scores.',
    example: 'https://allmcps.com/api/v1/search?q=github&limit=5',
  },
  {
    method: 'GET',
    path: '/api/v1/servers/{id}',
    title: 'Get server by ID',
    desc: 'Single listing with quality score, popularity signals, public metadata, and a configs array with ready-to-paste setup for each MCP client (Claude Desktop, Claude Code, Cursor, VS Code, Windsurf, Cline, Zed, Codex, Gemini CLI, JetBrains, Roo Code, Continue, LM Studio). configs is null when the install is not confirmed. Pending, rejected and flagged listings return 404.',
    example: 'https://allmcps.com/api/v1/servers/github-github-mcp-server',
  },
  {
    method: 'GET',
    path: '/api/v1/mcp/{id}/markdown',
    title: 'Markdown detail',
    desc: 'LLM-friendly Markdown for a listing. Also available via Accept: text/markdown on /mcp/{id}.',
    example: 'https://allmcps.com/mcp/github-github-mcp-server.md',
  },
  {
    method: 'GET',
    path: '/api/v1/health',
    title: 'Service health',
    desc: 'Lightweight health probe for monitors and agents.',
    example: 'https://allmcps.com/api/v1/health',
  },
  {
    method: 'GET',
    path: '/api/badge/{id}',
    title: 'SVG badge',
    desc: 'Dynamic badge for READMEs and docs. Use dofollow links when embedding for reciprocal SEO.',
    example:
      'https://allmcps.com/api/badge/github-github-mcp-server?style=shield',
  },
  {
    method: 'POST',
    path: '/api/v1/submit',
    title: 'Agent submission',
    desc: 'Submit a new MCP listing programmatically (requires email). Accepts the same optional enrichment fields as the /api/mcp submit_mcp_server tool (tags, license, authType, pricingModel, maintenanceStatus, compatibleClients, supportUrl, suggested install command/args). Human form is /submit.',
    example: 'POST https://allmcps.com/api/v1/submit',
  },
  {
    method: 'GET',
    path: '/api/v1/categories',
    title: 'List categories',
    desc: 'Every category AllMCPs accepts, with label, emoji, slug, and group — use to pick a valid "category" value before submitting.',
    example: 'https://allmcps.com/api/v1/categories',
  },
  {
    method: 'POST',
    path: '/api/v1/agent/register',
    title: 'Agent registration',
    desc: 'Register an AI agent with email to receive a 6-digit verification code.',
    example: 'POST https://allmcps.com/api/v1/agent/register',
  },
  {
    method: 'POST',
    path: '/api/v1/agent/register/confirm',
    title: 'Confirm registration & mint Bearer token',
    desc: 'Exchange 6-digit confirmation code for an amcp_... agent Bearer token.',
    example: 'POST https://allmcps.com/api/v1/agent/register/confirm',
  },
  {
    method: 'POST',
    path: '/api/v1/agent/claim',
    title: 'Claim listing via agent',
    desc: 'Claim an MCP server listing programmatically using DNS TXT record, site badge, or GitHub README proof.',
    example: 'POST https://allmcps.com/api/v1/agent/claim',
  },
  {
    method: 'POST',
    path: '/api/v1/agent/revoke',
    title: 'Revoke agent token',
    desc: 'Revoke an active agent Bearer token.',
    example: 'POST https://allmcps.com/api/v1/agent/revoke',
  },
  {
    method: 'POST',
    path: '/api/v1/inspect',
    title: 'Live MCP inspector',
    desc: 'Proxy tools/list (and related methods) against a remote MCP endpoint for debugging.',
    example: 'POST https://allmcps.com/api/v1/inspect',
  },
  {
    method: 'GET',
    path: '/api/mcp',
    title: 'Remote MCP server',
    desc: "AllMCPs itself as a remote MCP server (protocol 2026-07-28, plus initialize-based 2025-11-25 and earlier): search with transport and verified-only filters, per-client install configs, alternatives, side-by-side comparison, stack recommendations, categories, boosting, and a fully schema'd submit_mcp_server tool (call tools/list for the exact enum values). Also available as the allmcps-server npm package (stdio bridge to this same endpoint).",
    example: 'https://allmcps.com/api/mcp',
  },
] as const;

const endpointId = (path: string) =>
  `ep-${path
    .replace(/^\/api\//, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/-+$/, '')}`;

/** Copyable curl for an endpoint example (GET URL or "POST <url>"). */
function curlFor(method: string, example: string): string {
  const url = example.replace(/^POST\s+/, '');
  if (method === 'POST') {
    return `curl -X POST "${url}" -H "Content-Type: application/json" -d '{}'`;
  }
  return `curl "${url}"`;
}

const TOC: TocItem[] = [
  { id: 'quick-start', text: 'Quick start' },
  { id: 'endpoints', text: 'Endpoints' },
  ...ENDPOINTS.map((ep) => ({
    id: endpointId(ep.path),
    text: ep.title,
    level: 3,
  })),
  { id: 'category-filtering', text: 'Category filtering' },
  { id: 'auth', text: 'Scoped agent auth' },
  { id: 'versioning', text: 'Versioning & deprecation' },
  { id: 'discovery', text: 'Agent discovery' },
];

export default function ApiDocsPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TechArticle',
        headline: 'AllMCPs Directory API Documentation',
        description: metadata.description,
        url: 'https://allmcps.com/docs/api',
        author: {
          '@type': 'Organization',
          name: 'AllMCPs',
          url: 'https://allmcps.com',
        },
      },
      {
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
            name: 'Documentation',
            item: 'https://allmcps.com/docs/api',
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: 'API Reference',
            item: 'https://allmcps.com/docs/api',
          },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <ArticleLayout
        path="/docs/api"
        crumbs={[{ label: 'Home', href: '/' }, { label: 'API reference' }]}
        title="AllMCPs API Documentation"
        lede={
          <p>
            Public, CORS-friendly endpoints for searching MCP servers, embedding
            badges, and plugging the AllMCPs directory into AI agents. No API
            key required for read endpoints. Also available as the official{' '}
            <code>allmcps-server</code> CLI / MCP server on npm, and as a full{' '}
            <Link href="/api/v1/openapi.json">AllMCPs OpenAPI spec</Link>.
          </p>
        }
        meta={<span>REST · JSON · v1</span>}
        toc={TOC}
        progress={false}
      >
        <div className="api-resources">
          <Link
            href="/api/v1/openapi.json"
            className="btn btn-primary btn-sm"
            target="_blank"
          >
            OpenAPI JSON ↗
          </Link>
          <Link
            href="/llms.txt"
            className="btn btn-ghost btn-sm"
            target="_blank"
          >
            llms.txt ↗
          </Link>
          <Link
            href="/.well-known/api-catalog"
            className="btn btn-ghost btn-sm"
            target="_blank"
          >
            API catalog ↗
          </Link>
          <Link
            href="/.well-known/oauth-protected-resource"
            className="btn btn-ghost btn-sm"
            target="_blank"
          >
            OAuth scopes ↗
          </Link>
          <a
            href="https://www.npmjs.com/package/allmcps-server"
            className="btn btn-ghost btn-sm"
            target="_blank"
            rel="noopener noreferrer"
          >
            allmcps-server CLI on npm ↗
          </a>
        </div>

        <h2 id="quick-start">Quick start</h2>
        <p>Search the directory from any HTTP client or agent:</p>
        <CopyCommand command='curl "https://allmcps.com/api/v1/search?q=postgres&limit=5"' />

        <h2 id="endpoints">Endpoints</h2>
        <ul className="api-endpoints">
          {ENDPOINTS.map((ep) => {
            const isUrl = ep.example.startsWith('http');
            return (
              <li key={ep.path + ep.method} id={endpointId(ep.path)}>
                <article className="api-endpoint">
                  <div className="api-endpoint-head">
                    <span
                      className={`api-method api-method--${ep.method.toLowerCase()}`}
                    >
                      {ep.method}
                    </span>
                    <code className="api-path">{ep.path}</code>
                  </div>
                  <h3 className="api-endpoint-title">{ep.title}</h3>
                  <p className="api-endpoint-desc">{ep.desc}</p>
                  <CopyCommand command={curlFor(ep.method, ep.example)} />
                  {isUrl ? (
                    <a
                      href={ep.example}
                      className="api-try"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open example ↗
                    </a>
                  ) : null}
                </article>
              </li>
            );
          })}
        </ul>

        <h2 id="category-filtering">Category filtering</h2>
        <p>
          <code>/api/v1/search?category=</code> accepts any of the three forms
          returned by <Link href="/api/v1/categories">/api/v1/categories</Link>{' '}
          — the full stored <code>name</code> (emoji included), the plain{' '}
          <code>label</code>, or the <code>slug</code>. Matching is
          case-insensitive and ignores surrounding whitespace, so all three
          requests below return the same listings, and the response echoes back
          the canonical category it resolved to. Combine it with <code>q=</code>{' '}
          to apply both filters at once.
        </p>
        <CopyBlock
          code={`curl "https://allmcps.com/api/v1/search?category=databases&limit=5"
curl "https://allmcps.com/api/v1/search?category=Databases&limit=5"
curl --get --data-urlencode "category=🗄️ Databases" "https://allmcps.com/api/v1/search?limit=5"

# Both filters: Postgres servers within Databases only
curl "https://allmcps.com/api/v1/search?q=postgres&category=databases"`}
        />
        <p>
          A category the directory doesn&apos;t have returns <code>400</code>{' '}
          with <code>{'{ "error": "unknown_category" }'}</code> — an empty{' '}
          <code>servers</code> array always means &quot;this category has no
          matching listings&quot;, never &quot;that category name was
          wrong&quot;.
        </p>

        <h2 id="auth">Scoped agent auth</h2>
        <p>
          Read endpoints (search, servers, categories, markdown, health) need no
          auth at all. Endpoints that mutate a listing require a scoped Bearer
          token — register via <code>POST /api/v1/agent/register</code>,
          requesting only the scopes you need in an optional <code>scopes</code>{' '}
          array (omit it to receive the full set below). A token used against an
          endpoint it wasn&apos;t granted a scope for gets back{' '}
          <code>
            403 {'{'}
            "error":"insufficient_scope","requiredScope":"...","grantedScopes":[...]
            {'}'}
          </code>{' '}
          — never a silent failure or a downgraded response.
        </p>
        <table>
          <thead>
            <tr>
              <th>Scope</th>
              <th>Grants</th>
              <th>Required by</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>listings:claim</code>
              </td>
              <td>
                Claim ownership of an existing listing via DNS TXT, site badge,
                or GitHub README proof. No other write access.
              </td>
              <td>
                <code>POST /api/v1/agent/claim</code>
              </td>
            </tr>
            <tr>
              <td colSpan={3}>
                <code>POST /api/v1/agent/revoke</code> needs a valid (unrevoked)
                Bearer token but no specific scope — any token can always revoke
                itself.
              </td>
            </tr>
          </tbody>
        </table>
        <p>
          Machine-readable copies of this table:{' '}
          <Link href="/.well-known/oauth-protected-resource">
            /.well-known/oauth-protected-resource
          </Link>{' '}
          (<code>scopes_supported</code>), the{' '}
          <code>
            components.securitySchemes.agentBearerAuth.flows.clientCredentials.scopes
          </code>{' '}
          map in the <Link href="/api/v1/openapi.json">OpenAPI spec</Link>, and{' '}
          <a href="/auth.md">/auth.md</a>&apos;s frontmatter, for the full
          registration → claim flow with example requests.
        </p>

        <h2 id="versioning">Versioning &amp; deprecation policy</h2>
        <p>
          The API is URL-versioned (<code>/api/v1/...</code>); fields are added,
          not removed or repurposed, within a version. If an endpoint is ever
          deprecated it will carry a <code>Deprecation: true</code> response
          header and, once a removal date is set, a <code>Sunset</code> header,
          for at least 90 days before removal — announced on the{' '}
          <Link href="/blog">blog</Link>. Nothing in v1 is currently deprecated.
        </p>

        <h2 id="discovery">Agent discovery</h2>
        <ul>
          <li>
            <code>Link</code> response headers on every page point at this docs
            URL, the API catalog, and OAuth metadata.
          </li>
          <li>
            Markdown negotiation: send <code>Accept: text/markdown</code> or
            append <code>?format=md</code> / <code>.md</code> to listing, blog,
            or category URLs.
          </li>
          <li>
            Machine catalog: <Link href="/data.json">/data.json</Link> and{' '}
            <Link href="/llms-full.txt">/llms-full.txt</Link>.
          </li>
        </ul>

        <p className="prose-callout">
          Questions or partnership ideas?{' '}
          <Link href="/contact">Contact us</Link>.
        </p>
      </ArticleLayout>
    </>
  );
}
