import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import type * as React from 'react';

interface BaseLayoutProps {
  previewText: string;
  heading?: string;
  children: React.ReactNode;
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://allmcps.com';

export const BaseLayout = ({
  previewText,
  heading,
  children,
}: BaseLayoutProps) => {
  return (
    <Html>
      <Head>
        {/* Tells dark-mode-aware clients (Gmail, Apple/iOS Mail, Outlook.com) this
            email already handles its own colors, so they don't "smart" auto-invert
            an already-dark header to a light background — which is what made the
            white wordmark unreadable (white-on-white) in at least one client. */}
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style>
          {`
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;800;900&display=swap');
          `}
        </style>
      </Head>
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* bgcolor (not just the inline style) because classic Outlook's Word
              rendering engine largely ignores CSS background-color on tables. Belt
              and suspenders with the baked-in background below. */}
          <Section style={header} bgcolor="#020617">
            {/*
              Since email clients require absolute URLs for images,
              we construct the URL using the baseUrl.
              logo-email-header.png (unlike logo-full-light.png) bakes the dark
              header background directly into the PNG, so the white wordmark stays
              legible even if a client ignores/overrides the surrounding cell's
              background — the image no longer depends on it.
            */}
            <Img
              src={`${baseUrl}/logo-email-header.png`}
              width="150"
              alt="AllMCPs"
              style={logo}
            />
          </Section>

          <Section style={bodyContent}>
            {heading && <Heading style={h1}>{heading}</Heading>}
            {children}
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              © {new Date().getFullYear()} AllMCPs. All rights reserved.
              <br />
              The definitive directory for discovering and installing MCP
              servers.
            </Text>
            <Text style={footerLinks}>
              <Link href={`${baseUrl}/terms`} style={link}>
                Terms
              </Link>{' '}
              •{' '}
              <Link href={`${baseUrl}/privacy`} style={link}>
                Privacy
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default BaseLayout;

const main = {
  backgroundColor: '#020617', // Slate 950
  fontFamily:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  padding: '40px 0',
};

const container = {
  margin: '0 auto',
  padding: '0 20px',
  maxWidth: '600px',
};

const header = {
  backgroundColor: '#020617', // Slate 950 — explicit so Outlook's per-table
  // rendering doesn't default this cell to white and hide the white wordmark.
  padding: '20px 0',
  textAlign: 'center' as const,
};

const logo = {
  margin: '0 auto',
  display: 'block',
};

const bodyContent = {
  backgroundColor: '#0f172a', // Slate 900
  padding: '40px 30px',
  borderRadius: '12px',
  border: '1px solid rgba(255, 255, 255, 0.1)',
};

const h1 = {
  color: '#ffffff',
  fontSize: '24px',
  fontWeight: '800',
  lineHeight: '32px',
  margin: '0 0 20px 0',
  letterSpacing: '-1px',
};

const footer = {
  padding: '32px 0 0 0',
  textAlign: 'center' as const,
};

const footerText = {
  color: '#64748b',
  fontSize: '14px',
  lineHeight: '24px',
  margin: '0 0 12px 0',
};

const footerLinks = {
  margin: '0',
};

const link = {
  color: '#94a3b8',
  textDecoration: 'underline',
  fontSize: '14px',
};

// Common styles to be exported and used by other templates
export const textStyle = {
  color: '#94a3b8',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '0 0 24px 0',
  fontWeight: '400',
};

export const highlightTextStyle = {
  color: '#ffffff',
  fontWeight: '500',
};

export const buttonStyle = {
  backgroundColor: '#00E5FF', // Cyan
  borderRadius: '6px',
  color: '#020617', // Dark Slate text for contrast against Cyan
  fontSize: '16px',
  fontWeight: '800',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  padding: '14px 24px',
  margin: '32px auto 0',
  width: '100%',
  boxSizing: 'border-box' as const,
};
