import fs from 'node:fs';
import path from 'node:path';
import { render } from '@react-email/components';
import { ListingStatusEmail } from '../components/emails/ListingStatusEmail';
// We have to use require or dynamic imports to avoid Next.js specific aliases if tsx doesn't map them
import { MagicLinkEmail } from '../components/emails/MagicLinkEmail';
import { NotificationEmail } from '../components/emails/NotificationEmail';
import { ReceiptEmail } from '../components/emails/ReceiptEmail';

async function generatePreviews() {
  const outDir = path.join(process.cwd(), 'email-previews');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir);
  }

  const magicLinkHtml = await render(
    <MagicLinkEmail loginUrl="https://allmcps.com/login?token=test" />,
  );
  fs.writeFileSync(path.join(outDir, 'magic-link.html'), magicLinkHtml);

  const receiptHtml = await render(
    <ReceiptEmail
      receiptId="RCPT-001"
      date="Oct 10, 2026"
      amount="$49.00"
      description="Submission Fee"
    />,
  );
  fs.writeFileSync(path.join(outDir, 'receipt.html'), receiptHtml);

  const approvedHtml = await render(
    <ListingStatusEmail
      mcpName="Test Server"
      status="approved"
      listingUrl="https://allmcps.com/mcp/test-server"
      claimUrl="https://allmcps.com/mcp/test-server/claim"
    />,
  );
  fs.writeFileSync(path.join(outDir, 'listing-approved.html'), approvedHtml);

  const rejectedHtml = await render(
    <ListingStatusEmail
      mcpName="Test Server"
      status="rejected"
      feedback="Missing documentation."
    />,
  );
  fs.writeFileSync(path.join(outDir, 'listing-rejected.html'), rejectedHtml);

  const notificationHtml = await render(
    <NotificationEmail heading="Alert" message="System maintenance tonight" />,
  );
  fs.writeFileSync(path.join(outDir, 'notification.html'), notificationHtml);

  console.log('Previews generated in ./email-previews/');
}

generatePreviews().catch(console.error);
