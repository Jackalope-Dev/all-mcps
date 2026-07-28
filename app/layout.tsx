import type { Metadata } from "next";
import { Inter } from "next/font/google";
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
    images: [
      {
        url: '/opengraph-image.jpg',
        width: 1200,
        height: 630,
        alt: 'AllMCPs Directory',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AllMCPs | The Directory for Model Context Protocol Servers',
    description: 'Find, discover, and install the best Model Context Protocol (MCP) servers to give your AI agents superpowers.',
    images: ['/opengraph-image.jpg'],
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
            <div className="logo animate-fade-in" style={{ fontSize: '1.75rem' }}>
              AllMCPs
            </div>
            <nav className="animate-fade-in delay-1" style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
              <a href="#" className="nav-link">Browse</a>
              <a href="#" className="nav-link">Categories</a>
              <a href="#" className="glass-panel" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 600 }}>Submit MCP</a>
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
                <li><a href="#" className="nav-link">Blog</a></li>
                <li><a href="#" className="nav-link">What is MCP?</a></li>
                <li><a href="#" className="nav-link">LLM Agents Guide</a></li>
              </ul>
            </div>
            <div>
              <h4 style={{ fontWeight: 600, marginBottom: '1rem' }}>Company</h4>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <li><a href="#" className="nav-link">About Jackalope Digital</a></li>
                <li><a href="#" className="nav-link">Contact</a></li>
                <li><a href="#" className="nav-link">Terms & Privacy</a></li>
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
