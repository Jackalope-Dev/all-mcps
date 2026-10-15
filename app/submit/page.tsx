import type { Metadata } from 'next';
import { serializeJsonLd } from '@/lib/jsonLd';
import { SubmitForm } from '../../components/forms/SubmitForm';
import { PageShell } from '../../components/PageShell';

export const metadata: Metadata = {
  title: 'Submit Your MCP Server for Listing & Review',
  description:
    'Submit your Model Context Protocol server to the AllMCPs directory for free review and claim verification, so developers and AI agents can find it.',
  alternates: {
    canonical: 'https://allmcps.com/submit',
  },
  openGraph: {
    images: [
      {
        url: 'https://allmcps.com/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'AllMCPs',
      },
    ],
    title: 'Submit Your MCP Server for Listing & Review | AllMCPs',
    description:
      'Submit your Model Context Protocol server to the AllMCPs directory, free, so developers and AI agents searching for MCP tools can find it.',
    url: 'https://allmcps.com/submit',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Submit Your MCP Server for Listing & Review | AllMCPs',
    description:
      'Submit your MCP server to the AllMCPs directory, free, so developers and AI agents can find it.',
  },
};

export default function SubmitPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: 'Submit your MCP Server to AllMCPs',
        description:
          'Submit your Model Context Protocol server to the AllMCPs directory, free, so developers and AI agents searching for MCP tools can find it.',
        url: 'https://allmcps.com/submit',
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
            name: 'Submit Server',
            item: 'https://allmcps.com/submit',
          },
        ],
      },
    ],
  };

  return (
    <PageShell variant="default" className="acct-submit-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <header className="acct-page-head">
        <h1 className="text-page-title">Submit an MCP server</h1>
        <p className="text-lead">
          Add a repo or website, we prefill what we can, and you claim ownership
          after approval. Takes about a minute.
        </p>
      </header>
      <SubmitForm />
    </PageShell>
  );
}
