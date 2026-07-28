import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { Button } from "../components/ui/Button";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

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
    <html lang="en">
      <body className={inter.className}>
        <header className="container">
          <div className="main-header">
            <Link href="/" className="logo animate-fade-in" style={{ fontSize: '1.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: 'inherit' }} aria-label="Go to AllMCPs Homepage">
              <img src="/logo-icon.svg" alt="" width={40} height={40} aria-hidden="true" />
              AllMCPs
            </Link>
            <nav className="animate-fade-in delay-1" style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }} aria-label="Main Navigation">
              <Link href="/" className="nav-link">Browse</Link>
              <Link href="/categories" className="nav-link">Categories</Link>
              <Button href="/submit" variant="primary">Submit MCP</Button>
            </nav>
          </div>
        </header>
        
        {children}
        
        <footer className="container" style={{ borderTop: '1px solid var(--border-color)', marginTop: '4rem', padding: '4rem 0', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem' }}>
            <div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1rem' }}>AllMCPs</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>The definitive directory for discovering and installing Model Context Protocol servers.</p>
            </div>
            <div>
              <h4 style={{ fontWeight: 600, marginBottom: '1rem' }}>Resources</h4>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <li><Link href="/blog" className="nav-link">Blog</Link></li>
                <li><Link href="/what-is-mcp" className="nav-link">What is MCP?</Link></li>
                <li><Link href="/guide" className="nav-link">LLM Agents Guide</Link></li>
              </ul>
            </div>
            <div>
              <h4 style={{ fontWeight: 600, marginBottom: '1rem' }}>Company</h4>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <li><Link href="/about" className="nav-link">About Jackalope Digital</Link></li>
                <li><Link href="/contact" className="nav-link">Contact</Link></li>
                <li><Link href="/terms" className="nav-link">Terms & Privacy</Link></li>
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
