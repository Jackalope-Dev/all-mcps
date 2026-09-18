import { ChevronRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { serializeJsonLd } from '@/lib/jsonLd';
import { OpenApiToMcpTool } from '../../../components/tools/OpenApiToMcpTool';
import { FaqSection } from '../../../components/ui/FaqSection';

export const metadata: Metadata = {
  title: 'Free OpenAPI to MCP Code Generator — TS & Python',
  description:
    'Convert OpenAPI 3.0/3.1 or Swagger specs into runnable Model Context Protocol (MCP) servers. Generates TypeScript SDK or Python FastMCP tool handlers.',
  alternates: { canonical: 'https://allmcps.com/tools/openapi-to-mcp' },
  openGraph: {
    images: [
      {
        url: 'https://allmcps.com/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'AllMCPs',
      },
    ],
    title: 'Free OpenAPI to MCP Server Code Generator | AllMCPs',
    description:
      'Turn OpenAPI 3.0 specs or cURL REST endpoints into ready-to-run MCP servers for Claude Desktop, Cursor, and Windsurf.',
    url: 'https://allmcps.com/tools/openapi-to-mcp',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free OpenAPI to MCP Server Code Generator | AllMCPs',
    description:
      'Turn OpenAPI 3.0 specs or cURL REST endpoints into ready-to-run MCP servers for Claude Desktop, Cursor, and Windsurf.',
  },
};

const webAppJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'OpenAPI to MCP Server Code Generator',
  url: 'https://allmcps.com/tools/openapi-to-mcp',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'All',
  isAccessibleForFree: true,
  provider: {
    '@type': 'Organization',
    name: 'AllMCPs',
    url: 'https://allmcps.com',
  },
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  description:
    'Browser-based generator that parses OpenAPI 3.0/3.1 JSON or YAML specs and generates Model Context Protocol (MCP) server code in TypeScript or Python.',
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
      name: 'Tools',
      item: 'https://allmcps.com/tools',
    },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'OpenAPI to MCP',
      item: 'https://allmcps.com/tools/openapi-to-mcp',
    },
  ],
};

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'How do I convert an OpenAPI or Swagger spec to an MCP server?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Paste your OpenAPI 3.0 or 3.1 JSON spec into the converter, configure your API Base URL and authentication strategy (Bearer Token or API Key header), and select your preferred language (TypeScript SDK or Python FastMCP). The generator automatically creates all tool definitions, parameter schemas, and HTTP fetch execution logic.',
      },
    },
    {
      '@type': 'Question',
      name: 'Does this generator support both TypeScript and Python FastMCP?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes! You can toggle between official TypeScript SDK (@modelcontextprotocol/sdk) code using native fetch and Zod input schemas, or Python code using the official FastMCP wrapper and httpx.',
      },
    },
    {
      '@type': 'Question',
      name: 'How does authentication work in generated MCP tools?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'You can configure Bearer Token authentication or custom API Key headers. The generated server reads credentials securely from environment variables (e.g. process.env.API_TOKEN or os.environ.get("API_TOKEN")), ensuring secrets are never hardcoded in client configurations.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is the difference between an OpenAPI spec and an MCP tool schema?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'An OpenAPI spec defines HTTP REST endpoints (paths, methods, request bodies, status codes) for human developers or API gateways. An MCP tool schema packages those capabilities into standardized JSON-RPC 2.0 primitives so LLMs (like Claude 3.7 or GPT-4o) can call functions directly.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is my OpenAPI spec sent to an external server?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No. The parsing and code generation happen 100% locally inside your web browser. No API specs, endpoints, or parameters leave your device.',
      },
    },
  ],
};

export default function OpenApiToMcpPage() {
  return (
    <main className="page-shell page-shell--tool">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(webAppJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
      />

      <div className="page-shell-inner">
        <nav aria-label="Breadcrumb">
          <ol className="breadcrumb" style={{ marginBottom: '1.5rem' }}>
            <li>
              <Link href="/">Home</Link>
            </li>
            <li className="breadcrumb-separator">
              <ChevronRight size={12} />
            </li>
            <li>
              <Link href="/tools">Tools</Link>
            </li>
            <li className="breadcrumb-separator">
              <ChevronRight size={12} />
            </li>
            <li className="breadcrumb-current">OpenAPI to MCP</li>
          </ol>
        </nav>
        <div className="surface page-panel">
          <h1 className="text-page-title" style={{ marginBottom: '0.5rem' }}>
            OpenAPI to MCP Server Code Generator
          </h1>
          <p className="text-lead" style={{ marginBottom: '2rem' }}>
            Turn any OpenAPI 3.0/3.1 or Swagger API specification into a fully
            functional Model Context Protocol (MCP) server in TypeScript or
            Python.
          </p>

          <OpenApiToMcpTool />

          {/* Question-Forward Educational & FAQ Section */}
          <div
            style={{
              marginTop: '3.5rem',
              fontSize: '0.925rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.7,
            }}
          >
            <h2
              style={{
                fontSize: '1.25rem',
                color: 'var(--text-primary)',
                marginBottom: '1rem',
                fontWeight: 700,
              }}
            >
              How OpenAPI to MCP Conversion Works
            </h2>
            <p style={{ marginBottom: '1.25rem' }}>
              Exposing existing Web APIs to AI assistants like Claude Desktop,
              Cursor, and Windsurf allows models to fetch real-time data, query
              databases, and trigger workflows on your behalf. However, manually
              writing Zod schemas and HTTP execution handlers for dozens of REST
              endpoints is slow and error-prone.
            </p>
            <p style={{ marginBottom: '2rem' }}>
              This generator parses your <code>paths</code>, HTTP methods (
              <code>GET</code>, <code>POST</code>, <code>PUT</code>,{' '}
              <code>DELETE</code>), path/query parameters, and JSON request
              bodies, outputting clean boilerplates that adhere to the official
              Model Context Protocol JSON-RPC specification.
            </p>

            <FaqSection
              title="Frequently Asked Questions (FAQ)"
              items={[
                {
                  question:
                    'How do I convert an OpenAPI or Swagger spec to an MCP server?',
                  answer:
                    'Paste your OpenAPI 3.0 or 3.1 JSON spec into the generator above, enter your target API base URL, select an auth mode (Bearer Token or API Key), and pick either TypeScript or Python. Copy or download the generated file, install the SDK dependencies, and add the command to your client config.',
                },
                {
                  question:
                    'Does this generator support both TypeScript and Python FastMCP?',
                  answer: (
                    <>
                      Yes! You can toggle between official TypeScript SDK (
                      <code>@modelcontextprotocol/sdk</code>) code using native
                      fetch and Zod input schemas, or Python code using the
                      official <code>FastMCP</code> framework and{' '}
                      <code>httpx</code>.
                    </>
                  ),
                },
                {
                  question:
                    'How does authentication work in generated MCP tools?',
                  answer: (
                    <>
                      You can configure Bearer Token authentication or custom
                      API Key headers. The generated server reads credentials
                      securely from environment variables (e.g.{' '}
                      <code>process.env.API_TOKEN</code> or{' '}
                      <code>os.environ.get(&quot;API_TOKEN&quot;)</code>),
                      ensuring API keys are never hardcoded in client
                      configurations.
                    </>
                  ),
                },
                {
                  question:
                    'What is the difference between an OpenAPI spec and an MCP tool schema?',
                  answer:
                    'An OpenAPI spec defines HTTP REST endpoints (paths, methods, request bodies, status codes) for human developers or API gateways. An MCP tool schema packages those capabilities into standardized JSON-RPC 2.0 primitives so LLMs can call functions directly without custom integration glue code.',
                },
              ]}
            />

            <div
              style={{
                marginTop: '2.5rem',
                paddingTop: '1.5rem',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                gap: '1rem',
                flexWrap: 'wrap',
              }}
            >
              <Link
                href="/build-mcp-server"
                style={{
                  color: 'var(--accent-color)',
                  textDecoration: 'none',
                  fontWeight: 600,
                }}
              >
                ← Read the Complete Developer Guide on Building MCP Servers
              </Link>
              <Link
                href="/tools/config-generator"
                style={{
                  color: 'var(--accent-color)',
                  textDecoration: 'none',
                  fontWeight: 600,
                }}
              >
                Generate Client Configs →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
