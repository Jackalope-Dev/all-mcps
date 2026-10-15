import type { Metadata } from 'next';
import { InspectorModes } from '../../../components/tools/InspectorModes';
import { LiveMcpInspector } from '../../../components/tools/LiveMcpInspector';
import { ProtocolInspectorTool } from '../../../components/tools/ProtocolInspectorTool';
import { ToolPage } from '../../../components/tools/ToolPage';

export const metadata: Metadata = {
  title: 'Free MCP Protocol Inspector & Response Debugger',
  description:
    'Test, validate, and debug Model Context Protocol (MCP) JSON-RPC messages, tool outputs, resources, and image base64 blobs with a live client renderer.',
  alternates: { canonical: 'https://allmcps.com/tools/protocol-inspector' },
  openGraph: {
    images: [
      {
        url: 'https://allmcps.com/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'AllMCPs',
      },
    ],
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
    'Browser-based protocol inspector and visual simulator for Model Context Protocol (MCP) JSON-RPC requests, responses, tools, resources, and image payloads.',
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
      name: 'Protocol Inspector',
      item: 'https://allmcps.com/tools/protocol-inspector',
    },
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
    <ToolPage
      href="/tools/protocol-inspector"
      crumb="Protocol Inspector"
      title="MCP Protocol Inspector & Response Debugger"
      description={
        <p>
          Connect to a live MCP server to list and call its tools, or validate
          Model Context Protocol (MCP) JSON-RPC 2.0 payloads, verify content
          block schemas, catch protocol errors, and preview how AI clients
          display execution results.
        </p>
      }
      meta={['Free', 'No sign-in', 'Live calls proxied server-side']}
      jsonLd={[webAppJsonLd, faqJsonLd, breadcrumbJsonLd]}
      faqJsonLd={false}
      aboutTitle="Understanding Model Context Protocol JSON-RPC specifications"
      about={
        <>
          <p>
            The Model Context Protocol communicates over standard JSON-RPC 2.0
            transports (stdio pipes or Server-Sent Events). When an AI client
            like Claude Desktop, Cursor, or Windsurf calls a tool or queries a
            resource, it expects responses to adhere strictly to protocol
            schemas.
          </p>
          <p>
            Common integration issues &mdash; such as missing{' '}
            <code>content</code> arrays, unhandled base64 image strings, or
            omitted <code>mimeType</code> headers &mdash; can cause AI clients
            to silently drop tool outputs or fail turns. Use this diagnostic
            inspector during development to verify payload compliance instantly.
          </p>
        </>
      }
      faq={[
        {
          question: 'How do I debug MCP JSON-RPC protocol messages?',
          answer: (
            <>
              Paste any JSON-RPC request or tool execution response payload into
              the inspector above. The diagnostic engine checks specification
              compliance (<code>jsonrpc: &quot;2.0&quot;</code>, content array
              structures, MIME types, isError flags) and renders a live visual
              preview of how AI clients display the result.
            </>
          ),
        },
        {
          question: 'What makes an MCP tool call response valid?',
          answer: (
            <>
              A valid MCP tool call response must contain a <code>content</code>{' '}
              array of objects. Each content object requires a <code>type</code>{' '}
              property (<code>&quot;text&quot;</code>,{' '}
              <code>&quot;image&quot;</code>, or{' '}
              <code>&quot;resource&quot;</code>). Text objects must have a
              string <code>text</code> property, and image objects must specify
              a valid <code>mimeType</code> (e.g.{' '}
              <code>&quot;image/png&quot;</code>) and base64-encoded{' '}
              <code>data</code> string.
            </>
          ),
        },
        {
          question: 'How do images and resources render in Claude Desktop MCP?',
          answer:
            'When a tool returns an image content block with mimeType and base64 data, Claude Desktop and Cursor render the image inline within the conversation turn. Resource content blocks with URIs allow clients to read text or binary files directly.',
        },
        {
          question: 'What does isError: true mean in an MCP response?',
          answer: (
            <>
              Setting <code>isError: true</code> inside a tool call result tells
              the AI model that the tool execution failed (e.g. network error,
              invalid SQL query, or missing file), allowing the model to analyze
              the error output and adjust its strategy.
            </>
          ),
        },
      ]}
      links={[
        { href: '/build-mcp-server', label: 'How to build an MCP server' },
        { href: '/tools/config-validator', label: 'Validate config files' },
      ]}
    >
      <InspectorModes
        live={<LiveMcpInspector />}
        payload={<ProtocolInspectorTool />}
      />
    </ToolPage>
  );
}
