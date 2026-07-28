import * as React from "react";
import { Text, Button } from "@react-email/components";
import {
  BaseLayout,
  textStyle,
  highlightTextStyle,
  buttonStyle,
} from "./BaseLayout";

interface ListingStatusEmailProps {
  mcpName: string;
  status: "approved" | "rejected";
  feedback?: string;
  listingUrl?: string;
}

export const ListingStatusEmail = ({
  mcpName = "Awesome MCP Server",
  status = "approved",
  feedback = "",
  listingUrl = "https://allmcps.com/server/awesome-mcp-server",
}: ListingStatusEmailProps) => {
  const isApproved = status === "approved";

  return (
    <BaseLayout
      previewText={`Your MCP listing has been ${status}`}
      heading={isApproved ? "Listing Approved! 🎉" : "Listing Update Required"}
    >
      <Text style={textStyle}>
        Hello,
      </Text>
      <Text style={textStyle}>
        We have reviewed your submission for <span style={highlightTextStyle}>{mcpName}</span>.
      </Text>
      
      {isApproved ? (
        <>
          <Text style={textStyle}>
            Great news! Your MCP server has been approved and is now live on the directory. You can view your listing using the link below:
          </Text>
          <Button href={listingUrl} style={buttonStyle}>
            View Listing
          </Button>
        </>
      ) : (
        <>
          <Text style={textStyle}>
            Unfortunately, we cannot approve your listing in its current state. Please review the feedback below and update your submission.
          </Text>
          {feedback && (
            <div style={feedbackContainer}>
              <Text style={feedbackText}>{feedback}</Text>
            </div>
          )}
          <Button href="https://allmcps.com/dashboard" style={buttonStyle}>
            Update Submission
          </Button>
        </>
      )}
    </BaseLayout>
  );
};

export default ListingStatusEmail;

const feedbackContainer = {
  backgroundColor: "rgba(255, 0, 0, 0.05)",
  borderLeft: "4px solid #ef4444",
  padding: "16px",
  marginTop: "24px",
  marginBottom: "24px",
};

const feedbackText = {
  color: "#e2e8f0",
  fontSize: "14px",
  lineHeight: "22px",
  margin: 0,
};
