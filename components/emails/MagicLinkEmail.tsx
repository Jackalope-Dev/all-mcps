import * as React from "react";
import { Button, Text, Link } from "@react-email/components";
import {
  BaseLayout,
  textStyle,
  highlightTextStyle,
  buttonStyle,
} from "./BaseLayout";

interface MagicLinkEmailProps {
  loginUrl: string;
}

export const MagicLinkEmail = ({
  loginUrl = "https://allmcps.com/api/auth/callback/email?token=example",
}: MagicLinkEmailProps) => {
  return (
    <BaseLayout
      previewText="Sign in to AllMCPs"
      heading="Sign in to AllMCPs"
    >
      <Text style={textStyle}>
        Hello,
      </Text>
      <Text style={textStyle}>
        We received a request to sign in to your AllMCPs account. Click the button below to securely sign in. This link will expire in 24 hours.
      </Text>
      
      <Button href={loginUrl} style={buttonStyle}>
        Sign In to AllMCPs
      </Button>
      
      <Text style={{ ...textStyle, marginTop: "32px", fontSize: "14px" }}>
        If you didn't request this email, you can safely ignore it.
      </Text>
      <Text style={{ ...textStyle, fontSize: "14px" }}>
        Or copy and paste this URL into your browser:{" "}
        <Link href={loginUrl} style={{ color: "#00E5FF" }}>
          {loginUrl}
        </Link>
      </Text>
    </BaseLayout>
  );
};

export default MagicLinkEmail;
