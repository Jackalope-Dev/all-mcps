import { Metadata } from 'next';
import { ContactForm } from '../../components/forms/ContactForm';

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Get in touch with the AllMCPs team.',
};

export default function ContactPage() {
  return (
    <main className="container" style={{ padding: '6rem 0' }}>
      <div className="glass-panel" style={{ padding: '4rem', maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '1.5rem' }}>Contact Us</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          Have a question, feedback, or need help with a listing? Send us a message.
        </p>
        
        <ContactForm />
      </div>
    </main>
  );
}
