import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'Terms of service and usage conditions for the AllMCPs directory, server submissions, and featured listing services.',
  alternates: {
    canonical: 'https://allmcps.com/terms',
  },
  openGraph: {
    title: 'Terms of Service | AllMCPs',
    description:
      'Terms of service and usage conditions for the AllMCPs directory, server submissions, and featured listing services.',
    url: 'https://allmcps.com/terms',
  },
};

export default function TermsPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: 'Terms of Service',
        description: 'Terms of service and usage conditions for the AllMCPs directory, server submissions, and featured listing services.',
        url: 'https://allmcps.com/terms',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://allmcps.com' },
          { '@type': 'ListItem', position: 2, name: 'Terms of Service', item: 'https://allmcps.com/terms' },
        ],
      },
    ],
  };

  return (
    <main className="page-shell page-shell--content">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="page-shell-inner">
      <div className="surface page-panel">
        <h1 className="text-page-title" style={{ marginBottom: '0.5rem' }}>Terms of Service</h1>
        <p className="text-meta" style={{ marginBottom: '2rem' }}>Effective date: July 28, 2026</p>

        <div className="markdown-body">
          <p>
            These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of AllMCPs, including the
            website located at allmcps.com (the &ldquo;Site&rdquo;) and any related services (collectively, the
            &ldquo;Service&rdquo;). The Service is operated by Jackalope Digital LLC (&ldquo;Jackalope Digital,&rdquo;
            &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;). By accessing or using the Service, you agree to
            be bound by these Terms. If you do not agree, do not use the Service.
          </p>

          <h2>1. Description of the Service</h2>
          <p>
            AllMCPs is a directory of Model Context Protocol (MCP) servers. We aggregate, organize, and present
            information about third-party MCP servers submitted by us or by members of the public, to help users
            discover and evaluate tools for use with AI agents. AllMCPs is an informational directory only &mdash; we
            do not develop, host, operate, control, or maintain the third-party MCP servers listed on the Site
            unless explicitly stated otherwise.
          </p>

          <h2>2. Eligibility</h2>
          <p>
            You must be at least 13 years old to use the Service. By using the Service, you represent that you meet
            this requirement and that you have the legal capacity to enter into these Terms.
          </p>

          <h2>3. Third-Party Listings and Content</h2>
          <p>
            Listings on AllMCPs link to or describe software, servers, and tools operated by third parties that we
            do not own or control. We do not guarantee the accuracy, safety, security, legality, or continued
            availability of any listed MCP server, and inclusion in the directory is not an endorsement. You install,
            connect to, or otherwise use any third-party MCP server entirely at your own risk, and you are
            responsible for independently evaluating any tool before using it. We are not a party to any agreement
            between you and the operator of a listed MCP server.
          </p>

          <h2>4. Submitting a Listing</h2>
          <p>When you submit a server, tool, or related information to AllMCPs through our submission form, you represent and agree that:</p>
          <ul>
            <li>the information you submit is accurate to the best of your knowledge and not misleading;</li>
            <li>you have the right to submit the URL, name, and description you provide, and doing so does not infringe any third party&rsquo;s intellectual property or other rights;</li>
            <li>you will not submit content that is unlawful, malicious, deceptive, or intended to harm users of the Service (including URLs pointing to malware, phishing pages, or unauthorized destinations); and</li>
            <li>you grant Jackalope Digital a non-exclusive, worldwide, royalty-free license to display, reproduce, and distribute the submitted information as part of the Service.</li>
          </ul>
          <p>
            We review submissions before they are published and may edit, decline, delay, or remove any submission
            or listing at our sole discretion, at any time, without notice and without liability to you.
          </p>

          <h2>5. Prohibited Conduct</h2>
          <p>When using the Service, you agree not to:</p>
          <ul>
            <li>submit spam, bulk, or automated submissions, or otherwise abuse the submission or engagement-tracking features of the Site;</li>
            <li>attempt to gain unauthorized access to any part of the Service, its infrastructure, or its data;</li>
            <li>interfere with, disrupt, or place undue burden on the Service or the servers and networks connected to it;</li>
            <li>use automated means (scrapers, bots, crawlers) to access the Service in a manner that sends more request messages than a human could reasonably produce in the same period, except for standard search engine indexing; or</li>
            <li>misrepresent your identity or affiliation, or impersonate any person or entity, in connection with the Service.</li>
          </ul>

          <h2>6. Intellectual Property</h2>
          <p>
            The Site, including its design, branding, logos, text, and underlying software (excluding third-party
            listings and any content submitted by users), is owned by Jackalope Digital LLC and is protected by
            applicable intellectual property laws. Trademarks, logos, and product names of third-party MCP servers
            referenced on the Site belong to their respective owners and are used for identification purposes only.
          </p>

          <h2>7. No Warranties</h2>
          <p>
            THE SERVICE, INCLUDING ALL DIRECTORY LISTINGS, IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS
            AVAILABLE,&rdquo; WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING
            WITHOUT LIMITATION WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND
            NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE, OR
            THAT ANY LISTED MCP SERVER IS SAFE, ACCURATE, OR FUNCTIONS AS DESCRIBED.
          </p>

          <h2>8. Limitation of Liability</h2>
          <p>
            TO THE FULLEST EXTENT PERMITTED BY LAW, JACKALOPE DIGITAL LLC AND ITS OFFICERS, EMPLOYEES, AND AGENTS
            WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS
            OF DATA, PROFITS, OR REVENUE, ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE OR ANY THIRD-PARTY MCP
            SERVER DISCOVERED THROUGH THE SERVICE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
            OUR TOTAL LIABILITY FOR ANY CLAIM ARISING FROM THESE TERMS OR THE SERVICE WILL NOT EXCEED ONE HUNDRED
            U.S. DOLLARS (US $100).
          </p>

          <h2>9. Indemnification</h2>
          <p>
            You agree to indemnify and hold harmless Jackalope Digital LLC from any claims, damages, liabilities,
            and expenses (including reasonable attorneys&rsquo; fees) arising from your use of the Service, your
            submissions, or your violation of these Terms.
          </p>

          <h2>10. Termination</h2>
          <p>
            We may suspend or terminate your access to the Service, or remove any listing or submission, at any
            time and for any reason, including if we believe you have violated these Terms.
          </p>

          <h2>11. Changes to These Terms</h2>
          <p>
            We may update these Terms from time to time. If we make material changes, we will update the effective
            date above. Your continued use of the Service after changes take effect constitutes acceptance of the
            revised Terms.
          </p>

          <h2>12. Governing Law</h2>
          <p>
            These Terms are governed by the laws of the State of Colorado, without regard to its conflict of law
            principles, except to the extent preempted by U.S. federal law.
          </p>

          <h2>13. Contact Us</h2>
          <p>
            Questions about these Terms can be sent to{' '}
            <a href="mailto:contact@allmcps.com">contact@allmcps.com</a> or via our{' '}
            <Link href="/contact">Contact page</Link>.
          </p>

          <p style={{ marginTop: '2rem' }}>
            See also our <Link href="/privacy">Privacy Policy</Link>.
          </p>
        </div>
      </div>
      </div>
    </main>
  );
}
