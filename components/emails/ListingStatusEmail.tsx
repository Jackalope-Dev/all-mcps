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
}

export const ListingStatusEmail = ({
  mcpName = 'Awesome MCP Server',
  status = 'approved',
  feedback = '',
  listingUrl = 'https://allmcps.com/mcp/awesome-mcp-server',
  claimUrl = 'https://allmcps.com/mcp/awesome-mcp-server/claim',
}: ListingStatusEmailProps) => {
  const isApproved = status === 'approved';

  return (
    <BaseLayout
      previewText={
        isApproved
          ? `Your MCP listing is live — claim it for a free dofollow backlink`
          : `Your MCP listing needs updates`
      }
      heading={isApproved ? 'Listing Approved! 🎉' : 'Listing Update Required'}
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
            1. Claim ownership of your listing
            <br />
            2. Verify control of your product website (badge or DNS TXT)
            <br />
            3. Place the AllMCPs badge on that site <em>without</em> a{' '}
            <code style={codeStyle}>nofollow</code> attribute
          </Text>
          <Text style={textStyle}>
            We recheck the badge periodically so it stays honest. Premium
            listings get dofollow instantly (no badge required).
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
            We cannot approve your listing in its current state. Please review
            the feedback below and update your submission.
          </Text>
          {feedback && (
            <div style={feedbackContainer}>
              <Text style={feedbackText}>{feedback}</Text>
            </div>
          )}
          <Button href="https://allmcps.com/dashboard" style={buttonStyle}>
            Update submission
          </Button>
        </>
      )}
    </BaseLayout>
  );
};

export default ListingStatusEmail;

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
