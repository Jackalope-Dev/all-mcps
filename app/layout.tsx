import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Atkinson_Hyperlegible_Next, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import { CookieBanner } from "../components/CookieBanner";
import { ToastProvider } from "../components/ui/Toast";
import { PurchaseTracker } from "../components/PurchaseTracker";
import { CommandPaletteLazy } from "../components/CommandPaletteLazy";
import { PostHogIdentify } from "../components/PostHogIdentify";
import { ThemeSwitcher } from "../components/ThemeSwitcher";
import { DeferredChrome } from "../components/DeferredChrome";
import "./globals.css";

// Atkinson Hyperlegible Next: purpose-built so l / I / 1 don't collide —
// lowercase "l" has a clear tail (not a plain vertical bar). Critical for "AllMCPs".
//
// adjustFontFallback MUST stay false: next/font has no size-adjust override metrics
// for this family ("Failed to find font override values…"). Enabling it only logs
// that error and still falls back to an unadjusted system font — no CLS win.
// --font-atkinson (not --font-sans): Tailwind v4 defines its own --font-sans
// custom property via `@import "tailwindcss"`. Both stylesheets load at the
// same Next.js Float precedence, so whichever loaded last would win the
// cascade — an incidental, build-order-dependent outcome that caused an
// intermittent flash to Tailwind's system-font fallback on some loads.
const sans = Atkinson_Hyperlegible_Next({
  subsets: ["latin"],
  variable: "--font-atkinson",
  display: "swap",
  adjustFontFallback: false,
});

// Geist Mono is Firecrawl's code/data face — used here for ASCII motifs,
// section kickers, terminal chrome, and tabular figures. Atkinson stays
// on all UI and prose (see BRAND_GUIDE.md).
const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  // Match light/dark shell chrome so browser UI doesn't flash the wrong color.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
};

export const metadata: Metadata = {
  title: {
    default: "AllMCPs | Directory for Model Context Protocol Servers",
    template: "%s | AllMCPs",
  },
  description:
    "Discover and install Model Context Protocol (MCP) servers to give your AI agents superpowers. Browse 50+ categories of verified MCP tools.",
  metadataBase: new URL("https://allmcps.com"),
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-tile.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    shortcut: "/favicon.ico",
    apple: "/logo-icon.png",
  },
  alternates: {
    types: {
      "application/rss+xml": "https://allmcps.com/blog/rss.xml",
      "text/plain": "https://allmcps.com/llms.txt",
      "application/json": "https://allmcps.com/data.json",
    },
  },
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
    <html lang="en" className={`${sans.variable} ${mono.variable}`} data-theme="dark" suppressHydrationWarning>
      <head>
        {/*
          A plain <script> tag (not next/script) on purpose: this Next.js version's
          own docs (node_modules/next/dist/docs/.../script.md) say beforeInteractive
          scripts are "preloaded and fetched before any first-party code, but their
          execution does not block page hydration" — internally they're inserted via
          appBootstrap's loadScriptsInSequence (client JS creating a <script> element
          and appending it to <head>), not a literal blocking tag in the served HTML.
          That let the browser paint the CSS-default dark theme (see :root in
          globals.css) before this ran and flipped data-theme, causing a flash.
          A raw <script> written directly into the SSR'd HTML has none of that
          indirection — the browser executes it synchronously while parsing <head>,
          before body content paints.
        */}
        <script
          id="theme-init"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var mode = localStorage.getItem('allmcps-theme') || 'system';
                  var effectiveTheme = mode;
                  if (mode === 'system') {
                    effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  }
                  document.documentElement.setAttribute('data-theme', effectiveTheme);
                  window.__allmcpsTheme = effectiveTheme;
                } catch (e) {}
              })();
            `,
          }}
        />
        {/*
          Consent defaults must run before GTM. A raw <script> in SSR HTML executes
          while parsing <head>; next/script beforeInteractive is injected later via
          client JS and does not actually block hydration in this Next.js version.
        */}
        <script
          id="google-consent-mode"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('consent', 'default', {
                'analytics_storage': 'denied',
                'ad_storage': 'denied',
                'ad_user_data': 'denied',
                'ad_personalization': 'denied'
              });
            `,
          }}
        />
        {/*
          Service worker cleanup. This site ships NO service worker.
          Off the critical path — unregistering after first paint is enough and
          avoids competing with hydration.
        */}
        <Script id="sw-killswitch" strategy="lazyOnload">
          {`
            (function() {
              try {
                if (!('serviceWorker' in navigator)) return;
                navigator.serviceWorker.getRegistrations().then(function(regs) {
                  if (!regs || regs.length === 0) return;
                  Promise.all(regs.map(function(r) {
                    return r.unregister().catch(function() {});
                  })).then(function() {
                    if (window.caches && caches.keys) {
                      return caches.keys().then(function(keys) {
                        return Promise.all(keys.map(function(k) {
                          return caches.delete(k).catch(function() {});
                        }));
                      }).catch(function() {});
                    }
                  }).catch(function() {});
                }).catch(function() {});
              } catch (e) {}
            })();
          `}
        </Script>
        {/*
          Analytics load on idle (lazyOnload) so they stay off the critical path for
          LCP / TBT. Consent defaults above still run early via beforeInteractive.
        */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-NZ92KYZX74"
          strategy="lazyOnload"
        />
        <Script id="google-analytics" strategy="lazyOnload">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', 'G-NZ92KYZX74');
          `}
        </Script>
        {/*
          PostHog product analytics. Starts opted-out (opt_out_capturing_by_default)
          so nothing is captured until the CookieBanner grants consent — mirroring the
          Google consent-mode gate above. person_profiles: 'identified_only' keeps
          anonymous visitors out of person profiles.

          api_host points at our first-party managed reverse proxy (p.allmcps.com)
          to reduce ad-blocker/tracking-prevention loss; ui_host keeps PostHog UI
          links (e.g. session replay) pointing back to us.posthog.com.
        */}
        <Script id="posthog-init" strategy="lazyOnload">
          {`
            !function(t,e){var o,n,p,r;e.__SV||(window.posthog&&window.posthog.__loaded)||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="an ln init xn Cn Br kn In capture Fn nn calculateEventProperties On register register_once register_for_session unregister unregister_for_session Ln getFeatureFlag getFeatureFlagPayload getFeatureFlagResult getAllFeatureFlags isFeatureEnabled reloadFeatureFlags updateFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSurveysLoaded onSessionId getSurveys getActiveMatchingSurveys renderSurvey displaySurvey cancelPendingSurvey canRenderSurvey canRenderSurveyAsync Dn identify setPersonProperties unsetPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset shutdown setIdentity clearIdentity get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException addExceptionStep captureLog startExceptionAutocapture stopExceptionAutocapture loadToolbar get_property getSessionProperty An Rn createPersonProfile setInternalOrTestUser $n yn jn opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing get_explicit_consent_status is_capturing clear_opt_in_out_capturing Tn debug Ur Rt getPageViewId captureTraceFeedback captureTraceMetric pn".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
            posthog.init('phc_r8gEwaQjDhxSLZVbQEYpdxqbNMLExUwjFyvj94DkyPY5', {
              api_host: 'https://p.allmcps.com',
              ui_host: 'https://us.posthog.com',
              defaults: '2026-05-30',
              person_profiles: 'identified_only',
              opt_out_capturing_by_default: true
            });
          `}
        </Script>
      </head>
      <body className={sans.className}>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <Suspense fallback={null}>
          <PurchaseTracker />
        </Suspense>
        <PostHogIdentify />
        <CommandPaletteLazy />
        <CookieBanner />
        <ToastProvider />
        <DeferredChrome />
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
                  sameAs: ["https://x.com/AllMCPs", "https://github.com/Jackalope-Dev"],
                  description:
                    "The definitive directory for discovering and installing Model Context Protocol servers.",
                  contactPoint: {
                    "@type": "ContactPoint",
                    email: "contact@allmcps.com",
                    contactType: "customer support",
                    url: "https://allmcps.com/contact",
                    availableLanguage: ["English"],
                  },
                  address: {
                    "@type": "PostalAddress",
                    streetAddress: "1500 N Grant St # 7225",
                    addressLocality: "Denver",
                    addressRegion: "CO",
                    postalCode: "80203",
                    addressCountry: "US",
                  },
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
        {/* Skip-link target for every route. Pages may still use their own <main>
            for landmarks; this wrapper is the single guaranteed #main-content. */}
        <div id="main-content" tabIndex={-1} className="main-content-root">
          {children}
        </div>
        <SiteFooter />
        <ThemeSwitcher />
      </body>
    </html>
  );
}
