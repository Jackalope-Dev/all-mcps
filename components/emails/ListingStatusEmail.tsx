import { Link, Text } from '@react-email/components';
import {
  BaseLayout,
  codeStyle,
  highlightTextStyle,
  linkStyle,
  mutedTextStyle,
  Panel,
  PrimaryButton,
  textStyle,
} from './BaseLayout';

interface ListingStatusEmailProps {
  mcpName: string;
  status: 'approved' | 'rejected';
  feedback?: string;
  listingUrl?: string;
  /** Claim / verify URL — used on approval to drive free dofollow backlinks (DR growth). */
  claimUrl?: string;
  /**
   * Rejected only: whether the submission was kept for the submitter to edit
   * and resubmit from their dashboard (`listingUrl`). False for reasons no
   * edit can fix (lib/moderationReasons.ts), which get no button.
   */
  canResubmit?: boolean;
}

export const ListingStatusEmail = ({
  mcpName = 'Awesome MCP Server',
  status = 'approved',
  feedback = '',
  listingUrl = 'https://allmcps.com/mcp/awesome-mcp-server',
  claimUrl = 'https://allmcps.com/mcp/awesome-mcp-server/claim',
  canResubmit = true,
}: ListingStatusEmailProps) => {
  const isApproved = status === 'approved';

  return (
    <BaseLayout
      previewText={
        isApproved
          ? `${mcpName} is live. Claim it for a free dofollow backlink.`
          : canResubmit
            ? `Your MCP listing needs a few changes`
            : `About your MCP listing submission`
      }
      heading={
        isApproved
          ? `${mcpName} is live on AllMCPs`
          : canResubmit
            ? 'Your listing needs a few changes'
            : 'We couldn’t approve your submission'
      }
    >
      {isApproved ? (
        <>
          <Text style={textStyle}>
            Good news: we reviewed{' '}
            <span style={highlightTextStyle}>{mcpName}</span> and it&rsquo;s now
            listed in the directory, where developers can find and install it.
          </Text>

          <PrimaryButton href={listingUrl}>View your listing →</PrimaryButton>

          <Panel tone="info">
            <Text style={kicker}>Free SEO boost</Text>
            <Text style={panelTitle}>Earn a dofollow backlink</Text>
            <Text style={panelText}>
              1. Claim the listing and check it links to your product website.
              <br />
              2. Put the AllMCPs badge on that site, without a{' '}
              <code style={codeStyle}>nofollow</code> attribute.
              <br />
              3. Our health checks spot it and make your link dofollow.
            </Text>
            <Text style={{ ...panelText, margin: '12px 0 0' }}>
              We recheck the badge now and then to keep it honest. The badge is
              the only way to a dofollow link; it can&rsquo;t be bought.
            </Text>
            <Text style={{ ...panelText, margin: '12px 0 0' }}>
              <Link href={claimUrl} style={linkStyle}>
                Claim your listing →
              </Link>
            </Text>
          </Panel>

          <Text style={{ ...mutedTextStyle, margin: 0 }}>
            Once claimed you can edit details, upload a logo and see analytics
            from your{' '}
            <Link href="https://allmcps.com/dashboard" style={linkStyle}>
              dashboard
            </Link>
            .
          </Text>
        </>
      ) : (
        <>
          <Text style={textStyle}>
            Thanks for submitting{' '}
            <span style={highlightTextStyle}>{mcpName}</span>.{' '}
            {canResubmit
              ? "We couldn't approve it as it is, but it should be fixable. Here's what we found:"
              : "We weren't able to approve it, and here's why:"}
          </Text>
          {feedback && (
            <Panel tone="warning">
              {feedback.split(/\n{2,}/).map((para, i) => (
                <Text
                  // biome-ignore lint/suspicious/noArrayIndexKey: static paragraphs, never reordered
                  key={i}
                  style={{ ...panelText, marginTop: i > 0 ? '12px' : 0 }}
                >
                  {para}
                </Text>
              ))}
            </Panel>
          )}
          {canResubmit ? (
            <>
              <Text style={textStyle}>
                We&rsquo;ve kept your submission. Sign in to your dashboard with
                this email address to edit it and send it back for review.
              </Text>
              <PrimaryButton href={listingUrl}>
                Edit and resubmit →
              </PrimaryButton>
            </>
          ) : (
            <Text style={{ ...mutedTextStyle, margin: 0 }}>
              Think we got this wrong? Tell us on{' '}
              <Link href="https://allmcps.com/contact" style={linkStyle}>
                our contact page
              </Link>{' '}
              and we&rsquo;ll take another look.
            </Text>
          )}
        </>
      )}
    </BaseLayout>
  );
};

const kicker = {
  ...textStyle,
  color: '#007bff',
  fontSize: '11px',
  lineHeight: '16px',
  fontWeight: '800',
  letterSpacing: '1.2px',
  textTransform: 'uppercase' as const,
  margin: '0 0 6px',
};

const panelTitle = {
  ...textStyle,
  ...highlightTextStyle,
  fontSize: '16px',
  margin: '0 0 8px',
};

const panelText = {
  ...textStyle,
  fontSize: '14px',
  lineHeight: '23px',
  margin: 0,
};
