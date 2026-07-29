import * as React from "react";
import { Resend } from "resend";
import { NotificationEmail } from "../components/emails/NotificationEmail";

// One-off manual verification script for the BaseLayout header-background fix.
// Usage: RESEND_API_KEY=... npx tsx scripts/send-test-email.tsx you@example.com

async function main() {
  const to = process.argv[2];
  if (!to) {
    console.error("Usage: RESEND_API_KEY=... npx tsx scripts/send-test-email.tsx <recipient-email>");
    process.exit(1);
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY is not set in the environment.");
    process.exit(1);
  }

  const from = `AllMCPs <${process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"}>`;
  const resend = new Resend(apiKey);

  const { error, data } = await resend.emails.send({
    from,
    to,
    subject: "Listing Verified & Claimed: Test Server",
    react: NotificationEmail({
      heading: "Listing Verified & Claimed: Test Server",
      message:
        'Congratulations! Your ownership proof for "Test Server" was successfully verified via GitHub README. Your listing now features the Verified badge on AllMCPs.',
      actionText: "View Listing",
      actionUrl: "https://allmcps.com/mcp/test-server",
    }) as React.ReactElement,
  });

  if (error) {
    console.error("Send failed:", error);
    process.exit(1);
  }

  console.log("Sent:", data);
}

main();
