import { Metadata } from 'next';
import { SubmitForm } from '../../components/forms/SubmitForm';
import { PageShell, PageHeader } from '../../components/PageShell';

export const metadata: Metadata = {
  title: 'Submit your MCP Server to AllMCPs',
  description:
    'Submit your Model Context Protocol server to the AllMCPs directory. Reach thousands of AI developers and agent users.',
  alternates: {
    canonical: 'https://allmcps.com/submit',
  },
  openGraph: {
    title: 'Submit your MCP Server to AllMCPs | AllMCPs',
    description:
      'Submit your Model Context Protocol server to the AllMCPs directory. Reach thousands of AI developers and agent users.',
    url: 'https://allmcps.com/submit',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Submit your MCP Server to AllMCPs | AllMCPs',
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
        description: 'Submit your Model Context Protocol server to the AllMCPs directory. Reach thousands of AI developers and agent users.',
        url: 'https://allmcps.com/submit',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://allmcps.com' },
          { '@type': 'ListItem', position: 2, name: 'Submit Server', item: 'https://allmcps.com/submit' },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PageShell variant="content" panel>
        <PageHeader
          title="Submit an MCP Server"
          description={
            <>
              Have you built an incredible MCP server? Submit it below to get it listed in our
              directory. You can add a website (nofollow on free listings; dofollow for premium) and
              claim ownership after approval via GitHub badge, site badge, or DNS.
            </>
          }
        />
        <SubmitForm />
      </PageShell>
    </>
  );
}
