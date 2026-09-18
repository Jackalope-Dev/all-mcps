import type { Metadata } from 'next';
import { serializeJsonLd } from '@/lib/jsonLd';
import { SubmitForm } from '../../components/forms/SubmitForm';
import { PageHeader, PageShell } from '../../components/PageShell';

export const metadata: Metadata = {
  title: 'Submit Your MCP Server for Listing & Review',
  description:
    'Submit your Model Context Protocol server to the AllMCPs directory for review, claim verification, and to reach thousands of AI developers and agent builders.',
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
      'Submit your Model Context Protocol server to the AllMCPs directory. Reach thousands of AI developers and agent users.',
    url: 'https://allmcps.com/submit',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Submit Your MCP Server for Listing & Review | AllMCPs',
    description:
      'Submit your Model Context Protocol server to the AllMCPs directory. Reach thousands of AI developers.',
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
          'Submit your Model Context Protocol server to the AllMCPs directory. Reach thousands of AI developers and agent users.',
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
    <PageShell variant="content" panel>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <PageHeader
        title="Submit an MCP server"
        description={
          <>
            Free listing review for Model Context Protocol servers. Add a repo
            or website, we prefill what we can, then you claim ownership after
            approval.
          </>
        }
      />
      <SubmitForm />
    </PageShell>
  );
}
