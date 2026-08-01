import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Privacy policy for AllMCPs. Learn how we handle analytics, cookie consent, and data protection on our website.',
  alternates: {
    canonical: 'https://allmcps.com/privacy',
  },
  openGraph: {
    title: 'Privacy Policy | AllMCPs',
    description:
      'Privacy policy for AllMCPs. Learn how we handle analytics, cookie consent, and data protection on our website.',
    url: 'https://allmcps.com/privacy',
  },
};

export default function PrivacyPage() {
  return (
    <main className="page-shell page-shell--content">
      <div className="page-shell-inner">
      <div className="surface page-panel">
        <h1 className="text-page-title" style={{ marginBottom: '0.5rem' }}>Privacy Policy</h1>
        <p className="text-meta" style={{ marginBottom: '2rem' }}>Effective date: August 1, 2026</p>

        <div className="markdown-body">
          <p>
            This Privacy Policy explains how Jackalope Digital LLC (&ldquo;Jackalope Digital,&rdquo; &ldquo;we,&rdquo;
            &ldquo;us,&rdquo; or &ldquo;our&rdquo;) collects, uses, and shares information in connection with
            AllMCPs, including the website at allmcps.com (the &ldquo;Service&rdquo;). The Service offers optional
            user accounts (used to claim and manage directory listings) and paid listing features; the information
            involved in those is described below.
          </p>

          <h2>1. Information We Collect</h2>

          <h3>Information you provide to us</h3>
          <ul>
            <li>
              <strong>Contact form.</strong> If you contact us, we collect the name, email address, and message you
              provide so we can respond to you. This information is sent to us via our email delivery provider,
              Resend.
            </li>
            <li>
              <strong>MCP server submissions.</strong> If you submit a listing through our submission form, we
              collect the server URL, name, description, and category you provide. This information describes the
              tool being submitted, not you personally &mdash; we do not require your name, email, or any other
              personal information to submit a listing.
            </li>
            <li>
              <strong>Account &amp; sign-in.</strong> If you create an account to claim or manage a listing, we
              collect the email address you sign in with. We use passwordless &ldquo;magic link&rdquo; sign-in, so
              we do not collect or store a password. Sign-in links are delivered through our email provider,
              Resend. We keep basic account records (such as your email and the listings associated with your
              account) so you can manage your listings.
            </li>
            <li>
              <strong>Payments.</strong> If you purchase a paid listing feature (such as priority review, a
              featured boost, or a Premium subscription), your payment is processed by our payment provider,
              Stripe. Stripe collects the payment details needed to complete the transaction; we do not receive
              or store your full card number. We retain a record of the purchase (such as the plan, amount, and
              the listing it applies to) to provide the feature and for our accounting records.
            </li>
          </ul>

          <h3>Information collected automatically</h3>
          <p>
            Like most websites, the Service is fronted by infrastructure that automatically processes standard
            technical data for every request &mdash; for example, IP address, browser and device information, and
            request timestamps. This is handled by our hosting, content-delivery, and security provider, Cloudflare,
            and is used for security, abuse prevention, and keeping the Service running reliably. When you submit a
            form on the Site, Cloudflare Turnstile (our bot-detection tool) also processes some of this data to
            verify you are not a bot; see{' '}
            <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">
              Cloudflare&rsquo;s Privacy Policy
            </a>{' '}
            for how Cloudflare handles this data.
          </p>
          <p>
            We use Google Analytics to collect aggregate, anonymous statistics about site usage, traffic sources, and performance (such as page views and popular directory listings). This helps us understand how visitors interact with AllMCPs so we can improve the Service. Google Analytics processes data such as truncated IP addresses, browser type, device details, and pages visited.
          </p>
          <p>
            We also use PostHog, a product-analytics tool, to understand how visitors move
            through the Service &mdash; for example, which pages and listings are viewed, how
            searches are used, and how features such as newsletter signup and listing submission
            perform. PostHog processes data such as IP address (used to derive approximate,
            city-level location and then discarded), browser and device details, pages visited,
            and interaction events. We configure PostHog to create identifiable profiles only for
            signed-in users. Analytics collection through PostHog is subject to the same consent
            controls described in the &ldquo;Cookies&rdquo; section below. For more information,
            see{' '}
            <a href="https://posthog.com/privacy" target="_blank" rel="noopener noreferrer">
              PostHog&rsquo;s Privacy Policy
            </a>.
          </p>

          <h3>Aggregate usage metrics</h3>
          <p>
            We track counters for each directory listing &mdash; unique views, copy/install actions, and
            upvotes &mdash; to power features like our &ldquo;Trending&rdquo; and &ldquo;Most Viewed&rdquo;
            rankings. Copy/install actions are simple aggregate counts. Unique views and upvotes are not tied
            to an account; they use the abuse-prevention check described below.
          </p>
          <p>
            To prevent the same visitor from inflating a listing&rsquo;s unique views or upvotes, we check those
            actions against a one-way, salted hash of the submitting IP address. This hash cannot be reversed
            to recover the original IP address, is used solely for this spam-prevention check, and is not used
            to track visitors across the Site or for any other purpose. Your browser may also store a small
            local flag so we do not re-submit a view or vote you already recorded.
          </p>

          <h2>2. How We Use Information</h2>
          <p>We use the information described above to:</p>
          <ul>
            <li>respond to inquiries submitted through our contact form;</li>
            <li>review, moderate, and publish submitted MCP server listings;</li>
            <li>authenticate account sign-in and let you claim and manage your listings;</li>
            <li>process payments for paid listing features and provide the features you purchase;</li>
            <li>maintain the security, integrity, and availability of the Service and prevent spam or abuse; and</li>
            <li>understand aggregate engagement with listings so we can improve the directory.</li>
          </ul>

          <h2>3. How We Share Information</h2>
          <p>We do not sell your personal information. We share information only with the following categories of service providers, who process it on our behalf:</p>
          <ul>
            <li><strong>Cloudflare</strong> &mdash; hosting, content delivery, DDoS and bot protection (Turnstile), and access control for our internal admin tools.</li>
            <li><strong>Google Analytics (Google LLC)</strong> &mdash; site usage analytics and performance measurement. Google Analytics uses cookies to collect aggregate visitor statistics; for more information, see <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google&rsquo;s Privacy Policy</a>.</li>
            <li><strong>PostHog (PostHog, Inc.)</strong> &mdash; product analytics that help us understand how visitors use the Service so we can improve it. PostHog uses cookies and similar local storage to measure usage and interaction events; for more information, see <a href="https://posthog.com/privacy" target="_blank" rel="noopener noreferrer">PostHog&rsquo;s Privacy Policy</a>.</li>
            <li><strong>Resend</strong> &mdash; delivery of emails sent through our contact form and account sign-in (&ldquo;magic link&rdquo;) emails.</li>
            <li><strong>Stripe</strong> &mdash; payment processing for paid listing features. Stripe handles your payment details directly; for more information, see <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">Stripe&rsquo;s Privacy Policy</a>.</li>
            <li><strong>GitHub</strong> &mdash; when a submitted URL points to a GitHub repository, our server queries GitHub&rsquo;s public API to auto-fill listing details (such as the repository&rsquo;s name and description). No personal information about you is sent to GitHub as part of this lookup.</li>
          </ul>
          <p>
            We may also disclose information if required to do so by law, or to protect the rights, property, or
            safety of Jackalope Digital, our users, or the public.
          </p>

          <h2>4. Cookies</h2>
          <p>
            We use analytics cookies (such as Google Analytics and PostHog cookies) to measure site traffic, page usage, and performance. For visitors located in the European Union (EU), European Economic Area (EEA), and the United Kingdom (UK), we display a consent banner allowing you to accept or decline analytics cookies. Non-essential analytics cookies &mdash; including both Google Analytics and PostHog &mdash; are only enabled for EU/EEA/UK visitors after explicit consent is granted. You can also control or block cookies at any time through your web browser settings.
          </p>
          <p>
            If you sign in to an account, we set an essential authentication cookie to keep your login session
            active. This cookie is strictly necessary to provide the account and is not used for analytics or
            advertising; it is only set once you sign in, not for ordinary visitors browsing the directory.
          </p>
          <p>
            Our internal admin dashboard, which is restricted to Jackalope Digital personnel via Cloudflare Access, uses an authentication cookie to keep that login session active; this cookie is not set for ordinary visitors browsing the directory.
          </p>

          <h2>5. Data Retention</h2>
          <p>
            We retain submitted listing information for as long as the listing remains part of the directory, or as
            needed to maintain our records of reviewed submissions. Contact form messages are retained as long as
            reasonably necessary to address your inquiry and for our records. We may retain information longer
            where required by law or for legitimate business purposes such as security and fraud prevention.
          </p>

          <h2>6. Data Security</h2>
          <p>
            We take reasonable technical and organizational measures designed to protect information from
            unauthorized access, alteration, or disclosure. However, no method of transmission or storage is
            completely secure, and we cannot guarantee absolute security.
          </p>

          <h2>7. Children&rsquo;s Privacy</h2>
          <p>
            The Service is not directed to children under 13, and we do not knowingly collect personal information
            from children under 13. If you believe a child has provided us with personal information, contact us
            and we will take appropriate steps to delete it.
          </p>

          <h2>8. Your Choices and Rights</h2>
          <p>You may:</p>
          <ul>
            <li>ask us to remove a listing you submitted, or correct inaccurate information in it;</li>
            <li>ask what information we hold about you in connection with a contact form submission; and</li>
            <li>ask us to delete personal information you provided to us, subject to legitimate business or legal retention needs.</li>
          </ul>
          <p>
            To make any of these requests, contact us using the information below. Depending on where you live, you
            may have additional rights under applicable law (for example, under the California Consumer Privacy Act
            or the EU/UK GDPR); we will honor valid requests to the extent required by the law that applies to you.
          </p>

          <h2>9. International Users</h2>
          <p>
            The Service is hosted using Cloudflare&rsquo;s global network, which means information may be processed
            in countries other than your own. By using the Service, you understand that your information may be
            transferred to and processed in such locations.
          </p>

          <h2>10. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time, including as we add new features such as user
            accounts or payments. If we make material changes, we will update the effective date above. We
            encourage you to review this page periodically.
          </p>

          <h2>11. Contact Us</h2>
          <p>
            Questions about this Privacy Policy, or requests relating to your information, can be sent to{' '}
            <a href="mailto:contact@allmcps.com">contact@allmcps.com</a> or via our{' '}
            <Link href="/contact">Contact page</Link>.
          </p>

          <p style={{ marginTop: '2rem' }}>
            See also our <Link href="/terms">Terms of Service</Link>.
          </p>
        </div>
      </div>
      </div>
    </main>
  );
}
