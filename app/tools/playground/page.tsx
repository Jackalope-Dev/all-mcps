import type { Metadata } from 'next';
import Link from 'next/link';
import { McpPlayground } from '@/components/tools/McpPlayground';
import { ToolPage } from '@/components/tools/ToolPage';

export const metadata: Metadata = {
  title: 'Interactive MCP Server Playground & Console',
  description:
    'Test Model Context Protocol (MCP) remote JSON-RPC 2.0 endpoints online. Send initialize, tools/list, and tools/call requests with live response logging.',
  alternates: { canonical: 'https://allmcps.com/tools/playground' },
  openGraph: {
    images: [
      {
        url: 'https://allmcps.com/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'AllMCPs',
      },
    ],
    title: 'Interactive MCP Server Playground & Console | AllMCPs',
    description:
      'Test and inspect remote Model Context Protocol (MCP) endpoints, run tool calls, and validate JSON-RPC 2.0 responses in your browser.',
    url: 'https://allmcps.com/tools/playground',
  },
};

export default function PlaygroundPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: 'Interactive MCP Server Playground',
        description:
          'Online testing sandbox for Model Context Protocol (MCP) JSON-RPC 2.0 servers.',
        url: 'https://allmcps.com/tools/playground',
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Cross-platform',
        isAccessibleForFree: true,
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
            name: 'Tools',
            item: 'https://allmcps.com/tools',
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: 'MCP Playground',
            item: 'https://allmcps.com/tools/playground',
          },
        ],
      },
    ],
  };

  return (
    <ToolPage
      href="/tools/playground"
      crumb="MCP Playground"
      title="MCP Playground"
      description={
        <p>
          Test Model Context Protocol (MCP) servers live in your browser.
          Inspect protocol handshakes, send <code>tools/call</code> requests,
          and validate JSON-RPC 2.0 responses.
        </p>
      }
      meta={['Free', 'No sign-in', 'Requests go straight from your browser']}
      jsonLd={[jsonLd]}
      aboutTitle="How the MCP Playground works"
      about={
        <>
          <p>
            The playground sends JSON-RPC 2.0 requests straight from your
            browser to an MCP endpoint over HTTP and shows the raw response. It
            points at the AllMCPs MCP server by default, so you can try{' '}
            <code>tools/list</code> and <code>tools/call</code> without
            installing anything and see exactly what a client exchanges with a
            server.
          </p>
          <p>
            To test your own remote server, change the endpoint URL. The server
            must accept cross-origin requests from the browser (CORS), and
            servers that require an initialize handshake, a session ID, or OAuth
            will reject bare requests — use the{' '}
            <Link href="/tools/protocol-inspector">protocol inspector</Link> to
            decode those responses, or the official MCP Inspector for a full
            session.
          </p>
        </>
      }
      faq={[
        {
          question: 'What is an MCP playground?',
          answer:
            'A browser console for sending Model Context Protocol requests such as tools/list and tools/call to a server and reading the JSON-RPC responses. It is useful for learning the protocol and checking what a remote server returns.',
        },
        {
          question: 'Can I test a local stdio MCP server here?',
          answer:
            'No. Browsers can only make HTTP requests, so the playground works with remote servers over HTTP. For local stdio servers, run the official MCP Inspector, which starts the server process and connects to it.',
        },
        {
          question: 'Why does my server return a CORS or network error?',
          answer:
            'The request is sent from your browser, so the server has to allow cross-origin requests. Servers built for desktop clients often do not send CORS headers; that is expected and does not mean the server is broken.',
        },
        {
          question: 'What does a JSON-RPC error code mean?',
          answer:
            'Codes from -32700 to -32600 mean the request was malformed, -32601 means the method does not exist, -32602 means invalid parameters, and -32603 is an internal error. A tool that fails normally returns a result with isError set instead of a JSON-RPC error.',
        },
      ]}
    >
      <McpPlayground />
    </ToolPage>
  );
}
