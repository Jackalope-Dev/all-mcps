import {
  Body,
  Button,
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

/*
 * Shared shell for every Resend email (sign-in, notices, receipts, listing
 * status). It mirrors the weekly newsletter (lib/newsletterDigest.ts): a light
 * canvas, the wordmark header image, one white rounded card, a cyan button with
 * ink text and quiet slate footer copy. Keep the two in step when either changes.
 */

interface BaseLayoutProps {
  previewText: string;
  heading?: string;
  children: React.ReactNode;
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://allmcps.com';

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO =
  "ui-monospace,SFMono-Regular,Menlo,Consolas,'Courier New',monospace";

const INK = '#020617';
const BODY = '#1e293b';
const MUTED = '#64748b';
const BORDER = '#e2e8f0';
const RULE = '#e5e7eb';
const CANVAS = '#ffffff';
const CYAN = '#00E5FF';
const BLUE = '#007bff';

export const BaseLayout = ({
  previewText,
  heading,
  children,
}: BaseLayoutProps) => {
  return (
    <Html lang="en">
      <Head>
        {/* A light email: ask clients not to auto-invert it. */}
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            {/* Same 800x180 header image the newsletter uses; its dark
                background is baked into the PNG, so it reads on any canvas. */}
            <Link href={baseUrl}>
              <Img
                src={`${baseUrl}/email-header.png`}
                width="280"
                height="63"
                alt="AllMCPs"
                style={logo}
              />
            </Link>
          </Section>

          <Section style={card}>
            {heading && <Heading style={h1}>{heading}</Heading>}
            {children}
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              AllMCPs · the directory for discovering and installing MCP servers
            </Text>
            <Text style={footerText}>
              <Link href={baseUrl} style={footerLink}>
                allmcps.com
              </Link>
              {'  ·  '}
              <Link href={`${baseUrl}/terms`} style={footerLink}>
                Terms
              </Link>
              {'  ·  '}
              <Link href={`${baseUrl}/privacy`} style={footerLink}>
                Privacy
              </Link>
            </Text>
            <Text style={footerText}>
              Jackalope Digital · 1500 N Grant St #7225 · Denver, CO 80203
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

/** The one primary call to action: centered, sized to its label, never full width. */
export const PrimaryButton = ({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) => (
  <Section style={buttonRow}>
    <Button href={href} style={buttonStyle}>
      {children}
    </Button>
  </Section>
);

/** A soft inset panel inside the card: steps, receipts, reviewer feedback. */
export const Panel = ({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'info' | 'warning';
}) => (
  <Section style={{ ...panelBase, ...PANEL_TONES[tone] }}>{children}</Section>
);

const PANEL_TONES = {
  neutral: { backgroundColor: '#f8fafc', border: `1px solid ${BORDER}` },
  info: { backgroundColor: '#f0f7ff', border: '1px solid #bfdbfe' },
  warning: { backgroundColor: '#fffbeb', border: '1px solid #fde68a' },
} as const;

const main = {
  backgroundColor: CANVAS,
  fontFamily: FONT,
  margin: 0,
  padding: '24px 0 32px',
};

const container = {
  margin: '0 auto',
  padding: '0 16px',
  maxWidth: '580px',
};

const header = {
  padding: '0 0 20px',
  textAlign: 'center' as const,
};

const logo = {
  margin: '0 auto',
  display: 'block',
  borderRadius: '4px',
};

// Like the newsletter: content sits straight on the white canvas; only the
// panels inside it are boxed.
const card = {
  padding: '8px 4px 12px',
};

const h1 = {
  color: INK,
  fontFamily: FONT,
  fontSize: '28px',
  fontWeight: '800',
  lineHeight: '36px',
  letterSpacing: '-0.4px',
  margin: '0 0 16px',
};

const footer = {
  borderTop: `1px solid ${RULE}`,
  marginTop: '24px',
  padding: '20px 8px 0',
  textAlign: 'center' as const,
};

const footerText = {
  color: MUTED,
  fontFamily: FONT,
  fontSize: '12px',
  lineHeight: '20px',
  margin: '0 0 4px',
};

const footerLink = {
  color: MUTED,
  textDecoration: 'underline',
};

const buttonRow = {
  textAlign: 'center' as const,
  margin: '28px 0 8px',
};

const panelBase = {
  borderRadius: '16px',
  padding: '18px 20px',
  margin: '20px 0',
};

export const textStyle = {
  color: BODY,
  fontFamily: FONT,
  fontSize: '15px',
  lineHeight: '25px',
  margin: '0 0 16px',
};

export const mutedTextStyle = {
  ...textStyle,
  color: MUTED,
  fontSize: '13px',
  lineHeight: '21px',
};

export const highlightTextStyle = {
  color: INK,
  fontWeight: '700',
};

export const linkStyle = {
  color: BLUE,
  fontWeight: '600',
  textDecoration: 'none',
};

export const codeStyle = {
  fontFamily: MONO,
  fontSize: '12px',
  color: INK,
  backgroundColor: '#f1f5f9',
  borderRadius: '4px',
  padding: '1px 5px',
};

/** Raw URL fallback under a button: small, wrapped, selectable. */
export const urlBoxStyle = {
  fontFamily: MONO,
  fontSize: '12px',
  lineHeight: '18px',
  color: MUTED,
  wordBreak: 'break-all' as const,
  margin: '6px 0 0',
};

const buttonStyle = {
  backgroundColor: CYAN,
  borderRadius: '8px',
  color: INK,
  fontFamily: FONT,
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '16px 36px',
};
