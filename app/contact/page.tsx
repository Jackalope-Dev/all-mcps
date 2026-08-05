import { Metadata } from 'next';
import { ContactForm } from '../../components/forms/ContactForm';
import { PageShell, PageHeader } from '../../components/PageShell';

export const metadata: Metadata = {
  title: 'Contact AllMCPs — Support, Listings & Sponsorships',
  description:
    'Get in touch with the AllMCPs team about listing inquiries, sponsorships, support requests, or general feedback on our MCP directory.',
  alternates: {
    canonical: 'https://allmcps.com/contact',
  },
  openGraph: {
    title: 'Contact AllMCPs — Support, Listings & Sponsorships | AllMCPs',
    description:
      'Get in touch with the AllMCPs team about listing inquiries, sponsorships, support requests, or general feedback on our MCP directory.',
    url: 'https://allmcps.com/contact',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Contact AllMCPs — Support, Listings & Sponsorships | AllMCPs',
    description:
      'Get in touch with the AllMCPs team about listing inquiries, sponsorships, support requests, or general feedback on our MCP directory.',
  },
};

export default function ContactPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ContactPage',
        name: 'Contact AllMCPs Team',
        description: 'Get in touch with the AllMCPs team for listing inquiries, sponsorships, support, or feedback on our MCP directory.',
        url: 'https://allmcps.com/contact',
      },
      {
        '@type': 'Organization',
        name: 'AllMCPs',
        url: 'https://allmcps.com',
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'customer support',
          url: 'https://allmcps.com/contact',
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://allmcps.com' },
          { '@type': 'ListItem', position: 2, name: 'Contact', item: 'https://allmcps.com/contact' },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PageShell variant="content" panel>
        <PageHeader
          title="Contact Us"
          description="Have a question, feedback, or need help with a listing? Send us a message."
        />
        <ContactForm />
      </PageShell>
    </>
  );
}
