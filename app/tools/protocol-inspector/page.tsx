import { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { ProtocolInspectorTool } from '../../../components/tools/ProtocolInspectorTool';
import { LiveMcpInspector } from '../../../components/tools/LiveMcpInspector';

export const metadata: Metadata = {
  title: 'Free MCP Protocol Inspector & Response Debugger — Validate JSON-RPC Payloads',
  description:
    'Test, validate, and debug Model Context Protocol (MCP) JSON-RPC messages, tool outputs, resources, and image base64 blobs. Includes a live AI client visual renderer.',
  alternates: { canonical: 'https://allmcps.com/tools/protocol-inspector' },
  openGraph: {
    title: 'Free MCP Protocol Inspector & Response Debugger | AllMCPs',
    description:
      'Inspect MCP JSON-RPC 2.0 payloads, validate schema compliance, catch protocol errors, and preview client rendering.',
    url: 'https://allmcps.com/tools/protocol-inspector',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free MCP Protocol Inspector & Response Debugger | AllMCPs',
    description:
      'Inspect MCP JSON-RPC 2.0 payloads, validate schema compliance, catch protocol errors, and preview client rendering.',
  },
};

const webAppJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'MCP Protocol Inspector & Response Debugger',
  url: 'https://allmcps.com/tools/protocol-inspector',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'All',
  isAccessibleForFree: true,
  provider: { '@type': 'Organization', name: 'AllMCPs', url: 'https://allmcps.com' },
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  description:
    'Browser-based protocol inspector and visual simulator for Model Context Protocol (MCP) JSON-RPC requests, responses, tools, resources, and image payloads.',
};

const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://allmcps.com' },
    { '@type': 'ListItem', position: 2, name: 'Tools', item: 'https://allmcps.com/tools' },
    { '@type': 'ListItem', position: 3, name: 'Protocol Inspector', item: 'https://allmcps.com/tools/protocol-inspector' },
  ],
};

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'How do I debug MCP JSON-RPC protocol messages?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Paste any JSON-RPC request or tool execution response payload into the inspector above. The diagnostic engine checks specification compliance (jsonrpc: "2.0", content array structures, MIME types, isError flags) and renders a live visual preview of how AI clients display the result.',
      },
    },
    {
      '@type': 'Question',
      name: 'What makes an MCP tool call response valid?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'A valid MCP tool call response must contain a "content" array of objects. Each content object requires a "type" property ("text", "image", or "resource"). Text objects must have a string "text" property, and image objects must specify a valid "mimeType" (e.g. "image/png") and base64-encoded "data" string.',
      },
    },
    {
      '@type': 'Question',
      name: 'How do images and resources render in Claude Desktop MCP?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'When a tool returns an image content block with mimeType and base64 data, Claude Desktop and Cursor render the image inline within the conversation turn. Resource content blocks with URIs allow clients to read text or binary files directly.',
      },
    },
    {
      '@type': 'Question',
      name: 'What does isError: true mean in an MCP response?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Setting isError: true inside a tool call result tells the AI model that the tool execution failed (e.g. network error, invalid SQL query, or missing file), allowing the model to analyze the error output and adjust its strategy.',
      },
    },
  ],
};

export default function ProtocolInspectorPage() {
  return (
    <main className="page-shell page-shell--tool">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <div className="page-shell-inner">
        <nav aria-label="Breadcrumb">
          <ol className="breadcrumb" style={{ marginBottom: '1.5rem' }}>
            <li><Link href="/">Home</Link></li>
            <li className="breadcrumb-separator"><ChevronRight size={12} /></li>
            <li><Link href="/tools">Tools</Link></li>
            <li className="breadcrumb-separator"><ChevronRight size={12} /></li>
            <li className="breadcrumb-current">Protocol Inspector</li>
          </ol>
        </nav>
        <div className="surface page-panel">
          <h1 className="text-page-title" style={{ marginBottom: '0.5rem' }}>
            MCP Protocol Inspector &amp; Response Debugger
          </h1>
          <p className="text-lead" style={{ marginBottom: '2rem' }}>
            Connect to a live MCP server to list and call its tools, or validate Model Context Protocol (MCP)
            JSON-RPC 2.0 payloads, verify content block schemas, catch protocol errors, and preview how AI clients
            display execution results.
          </p>

          <div style={{ marginBottom: '2.5rem' }}>
            <LiveMcpInspector />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '0 0 2rem' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Or validate a payload
            </span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
          </div>

          <ProtocolInspectorTool />

          {/* Question-Forward Educational & FAQ Section */}
          <div style={{ marginTop: '3.5rem', fontSize: '0.925rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '1rem', fontWeight: 700 }}>
              Understanding Model Context Protocol JSON-RPC Specifications
            </h2>
            <p style={{ marginBottom: '1.25rem' }}>
              The Model Context Protocol communicates over standard JSON-RPC 2.0 transports (stdio pipes or Server-Sent Events).
              When an AI client like Claude Desktop, Cursor, or Windsurf calls a tool or queries a resource, it expects
              responses to adhere strictly to protocol schemas.
            </p>
            <p style={{ marginBottom: '2rem' }}>
              Common integration issues &mdash; such as missing <code>content</code> arrays, unhandled base64 image strings,
              or omitted <code>mimeType</code> headers &mdash; can cause AI clients to silently drop tool outputs or fail
              turns. Use this diagnostic inspector during development to verify payload compliance instantly.
            </p>

            <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '1rem', fontWeight: 700 }}>
              Frequently Asked Questions (FAQ)
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ padding: '1.25rem', borderRadius: '8px', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color)' }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', margin: '0 0 0.5rem 0', fontWeight: 600 }}>
                  How do I debug MCP JSON-RPC protocol messages?
                </h3>
                <p style={{ margin: 0 }}>
                  Paste any JSON-RPC request or tool execution response payload into the inspector above. The diagnostic engine
                  checks specification compliance (<code>jsonrpc: &quot;2.0&quot;</code>, content array structures, MIME types,
                  isError flags) and renders a live visual preview of how AI clients display the result.
                </p>
              </div>

              <div style={{ padding: '1.25rem', borderRadius: '8px', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color)' }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', margin: '0 0 0.5rem 0', fontWeight: 600 }}>
                  What makes an MCP tool call response valid?
                </h3>
                <p style={{ margin: 0 }}>
                  A valid MCP tool call response must contain a <code>content</code> array of objects. Each content object
                  requires a <code>type</code> property (<code>&quot;text&quot;</code>, <code>&quot;image&quot;</code>, or{' '}
                  <code>&quot;resource&quot;</code>). Text objects must have a string <code>text</code> property, and image
                  objects must specify a valid <code>mimeType</code> (e.g. <code>&quot;image/png&quot;</code>) and base64-encoded{' '}
                  <code>data</code> string.
                </p>
              </div>

              <div style={{ padding: '1.25rem', borderRadius: '8px', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color)' }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', margin: '0 0 0.5rem 0', fontWeight: 600 }}>
                  How do images and resources render in Claude Desktop MCP?
                </h3>
                <p style={{ margin: 0 }}>
                  When a tool returns an image content block with <code>mimeType</code> and base64 data, Claude Desktop and Cursor
                  render the image inline within the conversation turn. Resource content blocks with URIs allow clients to read text
                  or binary files directly.
                </p>
              </div>

              <div style={{ padding: '1.25rem', borderRadius: '8px', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color)' }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', margin: '0 0 0.5rem 0', fontWeight: 600 }}>
                  What does isError: true mean in an MCP response?
                </h3>
                <p style={{ margin: 0 }}>
                  Setting <code>isError: true</code> inside a tool call result tells the AI model that the tool execution failed
                  (e.g. network error, invalid SQL query, or missing file), allowing the model to analyze the error output and
                  adjust its strategy.
                </p>
              </div>
            </div>

            <div style={{ marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <Link href="/build-mcp-server" style={{ color: 'var(--accent-color)', textDecoration: 'none', fontWeight: 600 }}>
                ← Read How to Build an MCP Server
              </Link>
              <Link href="/tools/config-validator" style={{ color: 'var(--accent-color)', textDecoration: 'none', fontWeight: 600 }}>
                Validate Config Files →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
