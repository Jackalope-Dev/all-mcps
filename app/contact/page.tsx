import { Metadata } from 'next';
import { ContactForm } from '../../components/forms/ContactForm';
import { PageShell, PageHeader } from '../../components/PageShell';

export const metadata: Metadata = {
  title: 'Contact AllMCPs Team',
  description:
    'Get in touch with the AllMCPs team for listing inquiries, sponsorships, support, or feedback on our MCP directory.',
  alternates: {
    canonical: 'https://allmcps.com/contact',
  },
  openGraph: {
    title: 'Contact AllMCPs Team | AllMCPs',
    description:
      'Get in touch with the AllMCPs team for listing inquiries, sponsorships, support, or feedback on our MCP directory.',
    url: 'https://allmcps.com/contact',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Contact AllMCPs Team | AllMCPs',
    description:
      'Get in touch with the AllMCPs team for listing inquiries, sponsorships, support, or feedback on our MCP directory.',
  },
};

export default function ContactPage() {
  return (
    <PageShell variant="content" panel>
      <PageHeader
        title="Contact Us"
        description="Have a question, feedback, or need help with a listing? Send us a message."
      />
      <ContactForm />
    </PageShell>
  );
}
