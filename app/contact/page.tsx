import { Metadata } from 'next';
import { ContactForm } from '../../components/forms/ContactForm';
import { PageShell, PageHeader } from '../../components/PageShell';

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Get in touch with the AllMCPs team.',
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
