import { Button, Link, Text } from '@react-email/components';
import {
  BaseLayout,
  buttonStyle,
  highlightTextStyle,
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
          ? `Your MCP listing is live — claim it for a free dofollow backlink`
          : canResubmit
            ? `Your MCP listing needs a few changes`
            : `About your MCP listing submission`
      }
      heading={
        isApproved
          ? 'Listing Approved! 🎉'
          : canResubmit
            ? 'Listing Update Required'
            : 'Submission Not Approved'
      }
    >
      <Text style={textStyle}>Hello,</Text>
      <Text style={textStyle}>
        We have reviewed your submission for{' '}
        <span style={highlightTextStyle}>{mcpName}</span>.
      </Text>

      {isApproved ? (
        <>
          <Text style={textStyle}>
            Great news — your MCP server is live on the AllMCPs directory.
            Developers can discover and install it now:
          </Text>
          <Button href={listingUrl} style={buttonStyle}>
            View live listing
          </Button>

          <Text style={{ ...textStyle, marginTop: '28px' }}>
            <strong style={{ color: '#e2e8f0' }}>
              Free SEO boost: dofollow backlink
            </strong>
          </Text>
          <Text style={textStyle}>
            You can earn a{' '}
            <strong style={{ color: '#34d399' }}>dofollow</strong> website
            backlink from AllMCPs at no cost:
          </Text>
          <Text style={textStyle}>
            1. Check that your listing links to your product website (claim the
            listing to change it)
            <br />
            2. Place the AllMCPs badge on that site <em>without</em> a{' '}
            <code style={codeStyle}>nofollow</code> attribute
            <br />
            3. Our health checks detect it and make the link dofollow
          </Text>
          <Text style={textStyle}>
            We recheck the badge periodically so it stays honest. The badge is
            the only way to a dofollow link; it can&apos;t be bought.
          </Text>
          <Button
            href={claimUrl}
            style={{ ...buttonStyle, backgroundColor: '#0e7490' }}
          >
            Claim listing &amp; get free dofollow link
          </Button>
          <Text style={{ ...textStyle, fontSize: '13px', color: '#94a3b8' }}>
            After claiming you can also edit details, upload a logo, and manage
            the listing from your{' '}
            <Link href="https://allmcps.com/dashboard" style={linkStyle}>
              dashboard
            </Link>
            .
          </Text>
        </>
      ) : (
        <>
          <Text style={textStyle}>
            {canResubmit
              ? "Thanks for submitting! We couldn't approve it as it is, but it should be fixable. Here's what we found:"
              : "Thanks for submitting. We weren't able to approve it, and here's why:"}
          </Text>
          {feedback && (
            <div style={feedbackContainer}>
              {feedback.split(/\n{2,}/).map((para, i) => (
                <Text
                  // biome-ignore lint/suspicious/noArrayIndexKey: static paragraphs, never reordered
                  key={i}
                  style={{ ...feedbackText, marginTop: i > 0 ? '12px' : 0 }}
                >
                  {para}
                </Text>
              ))}
            </div>
          )}
          {canResubmit ? (
            <>
              <Text style={textStyle}>
                We&apos;ve kept your submission. Sign in to your dashboard with
                this email address to edit it and send it back for review.
              </Text>
              <Button href={listingUrl} style={buttonStyle}>
                Edit and resubmit
              </Button>
            </>
          ) : (
            <Text style={{ ...textStyle, fontSize: '13px', color: '#94a3b8' }}>
              If you think we got this wrong, let us know through{' '}
              <Link href="https://allmcps.com/contact" style={linkStyle}>
                our contact page
              </Link>{' '}
              and we'll take another look.
            </Text>
          )}
        </>
      )}
    </BaseLayout>
  );
};

const feedbackContainer = {
  backgroundColor: 'rgba(255, 0, 0, 0.05)',
  borderLeft: '4px solid #ef4444',
  padding: '16px',
  marginTop: '24px',
  marginBottom: '24px',
};

const feedbackText = {
  color: '#e2e8f0',
  fontSize: '14px',
  lineHeight: '22px',
  margin: 0,
};

const codeStyle = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '12px',
  color: '#94a3b8',
};

const linkStyle = {
  color: '#00E5FF',
  textDecoration: 'underline' as const,
};
