import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Atkinson_Hyperlegible_Next } from "next/font/google";
import Script from "next/script";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import { WebMCPProvider } from "../components/WebMCPProvider";
import { CookieBanner } from "../components/CookieBanner";
import { NewsletterModal } from "../components/NewsletterModal";
import { ToastProvider } from "../components/ui/Toast";
import { PurchaseTracker } from "../components/PurchaseTracker";
import "./globals.css";

// Atkinson Hyperlegible Next: purpose-built so l / I / 1 don't collide —
// lowercase "l" has a clear tail (not a plain vertical bar). Critical for "AllMCPs".
const sans = Atkinson_Hyperlegible_Next({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  adjustFontFallback: false,
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#020617",
};

export const metadata: Metadata = {
  title: {
    default: "AllMCPs | Directory for Model Context Protocol Servers",
    template: "%s | AllMCPs",
  },
  description:
    "Discover and install Model Context Protocol (MCP) servers to give your AI agents superpowers. Browse 50+ categories of verified MCP tools.",
  metadataBase: new URL("https://allmcps.com"),
  openGraph: {
    title: "AllMCPs | Directory for Model Context Protocol Servers",
    description:
      "Discover and install Model Context Protocol (MCP) servers to give your AI agents superpowers. Browse 50+ categories of verified MCP tools.",
    url: "https://allmcps.com",
    siteName: "AllMCPs",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@AllMCPs",
    creator: "@AllMCPs",
    title: "AllMCPs | Directory for Model Context Protocol Servers",
    description:
      "Discover and install Model Context Protocol (MCP) servers to give your AI agents superpowers.",
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
        <Suspense fallback={null}>
          <PurchaseTracker />
        </Suspense>
        <WebMCPProvider />
        <CookieBanner />
        <NewsletterModal />
        <ToastProvider />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  name: "AllMCPs",
                  url: "https://allmcps.com",
                  logo: "https://allmcps.com/logo-icon.svg",
                  sameAs: ["https://x.com/AllMCPs"],
                  description:
                    "The definitive directory for discovering and installing Model Context Protocol servers.",
                },
                {
                  "@type": "WebSite",
                  name: "AllMCPs",
                  url: "https://allmcps.com",
                  potentialAction: {
                    "@type": "SearchAction",
                    target: "https://allmcps.com/browse?q={search_term_string}",
                    "query-input": "required name=search_term_string",
                  },
                },
              ],
            }),
          }}
        />
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}

