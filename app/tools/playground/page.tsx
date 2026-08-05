import { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { McpPlayground } from '@/components/tools/McpPlayground';

export const metadata: Metadata = {
  title: 'Interactive MCP Server Playground & Console',
  description:
    'Test Model Context Protocol (MCP) remote JSON-RPC 2.0 endpoints online. Send initialize, tools/list, and tools/call requests with live response logging.',
  alternates: { canonical: 'https://allmcps.com/tools/playground' },
  openGraph: {
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
        description: 'Online testing sandbox for Model Context Protocol (MCP) JSON-RPC 2.0 servers.',
        url: 'https://allmcps.com/tools/playground',
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Cross-platform',
        isAccessibleForFree: true,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://allmcps.com' },
          { '@type': 'ListItem', position: 2, name: 'Tools', item: 'https://allmcps.com/tools' },
          { '@type': 'ListItem', position: 3, name: 'MCP Playground', item: 'https://allmcps.com/tools/playground' },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="container page-shell" style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-16)' }}>
        <nav aria-label="Breadcrumb" style={{ marginBottom: '2rem' }}>
          <ol className="breadcrumb">
            <li><Link href="/">Home</Link></li>
            <li className="breadcrumb-separator"><ChevronRight size={12} /></li>
            <li><Link href="/tools">Tools</Link></li>
            <li className="breadcrumb-separator"><ChevronRight size={12} /></li>
            <li className="breadcrumb-current">MCP Playground</li>
          </ol>
        </nav>

        <section style={{ maxWidth: '800px', marginBottom: '2.5rem' }}>
          <h1 className="text-display" style={{ marginBottom: '1rem' }}>
            Interactive MCP <span className="text-brand-gradient">Playground &amp; Console</span>
          </h1>
          <p className="text-lead" style={{ margin: 0 }}>
            Test Model Context Protocol (MCP) servers live in your browser. Inspect protocol handshakes, send <code>tools/call</code> requests, and validate JSON-RPC 2.0 responses.
          </p>
        </section>

        <McpPlayground />
      </main>
    </>
  );
}
