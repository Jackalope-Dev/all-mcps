import type { Metadata } from "next";
import { Atkinson_Hyperlegible_Next } from "next/font/google";
import Link from "next/link";
import Script from "next/script";
import { Button } from "../components/ui/Button";
import { BrandLogo } from "../components/BrandLogo";
import { WebMCPProvider } from "../components/WebMCPProvider";
import { CookieBanner } from "../components/CookieBanner";
import { ToastProvider } from "../components/ui/Toast";
import "./globals.css";

// Atkinson Hyperlegible Next: purpose-built so l / I / 1 don't collide —
// lowercase "l" has a clear tail (not a plain vertical bar). Critical for "AllMCPs".
const sans = Atkinson_Hyperlegible_Next({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: 'AllMCPs | The Directory for Model Context Protocol Servers',
    template: '%s | AllMCPs'
  },
  description: 'Find, discover, and install the best Model Context Protocol (MCP) servers to give your AI agents superpowers.',
  metadataBase: new URL('https://allmcps.com'),
  openGraph: {
    title: 'AllMCPs | The Directory for Model Context Protocol Servers',
    description: 'Find, discover, and install the best Model Context Protocol (MCP) servers to give your AI agents superpowers.',
    url: 'https://allmcps.com',
    siteName: 'AllMCPs',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AllMCPs | The Directory for Model Context Protocol Servers',
    description: 'Find, discover, and install the best Model Context Protocol (MCP) servers to give your AI agents superpowers.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={sans.variable}>
      <head>
        <Script id="google-consent-mode" strategy="beforeInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('consent', 'default', {
              'analytics_storage': 'denied',
              'ad_storage': 'denied',
              'ad_user_data': 'denied',
              'ad_personalization': 'denied'
            });
          `}
        </Script>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-NZ92KYZX74"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', 'G-NZ92KYZX74');
          `}
        </Script>
      </head>
      <body className={sans.className}>
        <WebMCPProvider />
        <CookieBanner />
        <ToastProvider />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'Organization',
                  name: 'AllMCPs',
                  url: 'https://allmcps.com',
                  logo: 'https://allmcps.com/logo-icon.svg',
                  description: 'The definitive directory for discovering and installing Model Context Protocol servers.',
                },
                {
                  '@type': 'WebSite',
                  name: 'AllMCPs',
                  url: 'https://allmcps.com',
                  potentialAction: {
                    '@type': 'SearchAction',
                    target: 'https://allmcps.com/browse?q={search_term_string}',
                    'query-input': 'required name=search_term_string',
                  },
                },
              ],
            }),
          }}
        />
        <header className="container">
          <div className="main-header">
            <BrandLogo size="md" />
            <nav className="animate-fade-in delay-1" style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }} aria-label="Main Navigation">
              <Link href="/browse" className="nav-link">Browse</Link>
              <Link href="/categories" className="nav-link">Categories</Link>
              <Button href="/submit" variant="primary">Submit MCP</Button>
            </nav>
          </div>
        </header>
        
        {children}
        
        <footer className="container" style={{ marginTop: '4rem', padding: '4rem 0', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <hr className="brand-divider" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '2rem' }}>
            <div>
              <div style={{ marginBottom: '1rem' }}>
                <BrandLogo size="sm" href="/" />
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6 }}>
                The definitive directory for discovering and installing Model Context Protocol servers.
              </p>
            </div>
            <div>
              <h4 style={{ fontWeight: 600, marginBottom: '1rem' }}>Resources</h4>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <li><Link href="/blog" className="nav-link">Blog</Link></li>
                <li><Link href="/what-is-mcp" className="nav-link">What is an MCP?</Link></li>
                <li><Link href="/guide" className="nav-link">LLM Agents Guide</Link></li>
              </ul>
            </div>
            <div>
              <h4 style={{ fontWeight: 600, marginBottom: '1rem' }}>For AI & Agents</h4>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <li><a href="/llms.txt" className="nav-link" target="_blank" rel="noopener">llms.txt Standard ↗</a></li>
                <li><a href="/api/mcp" className="nav-link" target="_blank" rel="noopener">Remote MCP Server ↗</a></li>
                <li><a href="/api/v1/search" className="nav-link" target="_blank" rel="noopener">Agent Search API ↗</a></li>
              </ul>
            </div>
            <div>
              <h4 style={{ fontWeight: 600, marginBottom: '1rem' }}>Company</h4>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <li><Link href="/about" className="nav-link">About</Link></li>
                <li><Link href="/contact" className="nav-link">Contact</Link></li>
                <li><a href="https://jackalope.digital" target="_blank" rel="noopener noreferrer" className="nav-link">Jackalope Digital ↗</a></li>
                <li><Link href="/terms" className="nav-link">Terms of Service</Link></li>
                <li><Link href="/privacy" className="nav-link">Privacy Policy</Link></li>
              </ul>
            </div>
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '2rem', textAlign: 'center' }}>
            &copy; {new Date().getFullYear()} Jackalope Digital LLC. All rights reserved.
          </div>
        </footer>
      </body>
    </html>
  );
}
