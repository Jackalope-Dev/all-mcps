import {
  ArrowRight,
  BadgeCheck,
  CreditCard,
  Megaphone,
  PlusCircle,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { serializeJsonLd } from '@/lib/jsonLd';
import { ContactForm } from '../../components/forms/ContactForm';
import { PageShell } from '../../components/PageShell';

export const metadata: Metadata = {
  title: 'Contact & Support — Listings & Sponsorships',
  description:
    'Get in touch with the AllMCPs team about listing inquiries, sponsorships, support requests, or general feedback on our MCP directory.',
  alternates: {
    canonical: 'https://allmcps.com/contact',
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
    title: 'Contact & Support — Listings & Sponsorships | AllMCPs',
    description:
      'Get in touch with the AllMCPs team about listing inquiries, sponsorships, support requests, or general feedback on our MCP directory.',
    url: 'https://allmcps.com/contact',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Contact & Support — Listings & Sponsorships | AllMCPs',
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
        description:
          'Get in touch with the AllMCPs team for listing inquiries, sponsorships, support, or feedback on our MCP directory.',
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
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: 'https://allmcps.com',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Contact',
            item: 'https://allmcps.com/contact',
          },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <PageShell variant="default">
        <div className="acct-contact">
          <div className="acct-contact-intro">
            <header className="acct-page-head">
              <h1 className="text-page-title">Contact the AllMCPs team</h1>
              <p className="text-lead">
                Questions, feedback, or help with a listing — send us a message
                and we’ll get back to you by email.
              </p>
            </header>

            <p className="acct-contact-shortcuts-label">
              Faster for common requests
            </p>
            <ul className="acct-contact-shortcuts">
              <li className="hue-blue">
                <Link href="/submit">
                  <PlusCircle size={17} aria-hidden="true" />
                  <span>
                    <strong>Add a server</strong>
                    <span>Submit it for free review</span>
                  </span>
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </li>
              <li className="hue-teal">
                <Link href="/dashboard">
                  <BadgeCheck size={17} aria-hidden="true" />
                  <span>
                    <strong>Edit or claim a listing</strong>
                    <span>Manage it from your dashboard</span>
                  </span>
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </li>
              <li className="hue-pink">
                <Link href="/advertise">
                  <Megaphone size={17} aria-hidden="true" />
                  <span>
                    <strong>Advertising</strong>
                    <span>Self-serve sponsor campaigns</span>
                  </span>
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </li>
              <li className="hue-violet">
                <Link href="/pricing">
                  <CreditCard size={17} aria-hidden="true" />
                  <span>
                    <strong>Billing &amp; boosts</strong>
                    <span>Plans, FAQ and invoices</span>
                  </span>
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </li>
            </ul>
          </div>

          <div className="acct-card acct-contact-card">
            <ContactForm />
          </div>
        </div>
      </PageShell>
    </>
  );
}
