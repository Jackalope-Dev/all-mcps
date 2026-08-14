import * as React from "react";
import { Text, Section, Row, Column, Hr, Button } from "@react-email/components";
import {
  BaseLayout,
  textStyle,
  highlightTextStyle,
  buttonStyle,
} from "./BaseLayout";

interface ReceiptEmailProps {
  receiptId: string;
  date: string;
  amount: string;
  description: string;
  actionText?: string;
  actionUrl?: string;
}

export const ReceiptEmail = ({
  receiptId = "RCPT-123456",
  date = "July 27, 2026",
  amount = "$49.00",
  description = "AllMCPs Listing Fee",
  actionText,
  actionUrl,
}: ReceiptEmailProps) => {
  return (
    <BaseLayout
      previewText={`Your receipt for ${amount}`}
      heading="Payment Receipt"
    >
      <Text style={textStyle}>
        Thank you for your payment. Your transaction was successful.
      </Text>
      
      <Section style={receiptSection}>
        <Row style={row}>
          <Column style={labelColumn}>Receipt ID</Column>
          <Column style={valueColumn}>{receiptId}</Column>
        </Row>
        <Row style={row}>
          <Column style={labelColumn}>Date</Column>
          <Column style={valueColumn}>{date}</Column>
        </Row>
        <Hr style={divider} />
        <Row style={row}>
          <Column style={labelColumn}>Description</Column>
          <Column style={valueColumn}>{description}</Column>
        </Row>
        <Hr style={divider} />
        <Row style={totalRow}>
          <Column style={totalLabelColumn}>Total Paid</Column>
          <Column style={totalValueColumn}>{amount}</Column>
        </Row>
      </Section>

      {actionText && actionUrl && (
        <Button href={actionUrl} style={buttonStyle}>
          {actionText}
        </Button>
      )}

      <Text style={{ ...textStyle, marginTop: "32px", fontSize: "14px" }}>
        If you have any questions about this receipt, please reply to this email.
      </Text>
    </BaseLayout>
  );
};

export default ReceiptEmail;

const receiptSection = {
  backgroundColor: "#020617", // Slate 950
  borderRadius: "8px",
  padding: "24px",
  marginTop: "24px",
  border: "1px solid rgba(255,255,255,0.05)",
};

const row = {
  marginBottom: "12px",
};

const labelColumn = {
  color: "#64748b",
  fontSize: "14px",
  width: "120px",
};

const valueColumn = {
  color: "#e2e8f0",
  fontSize: "14px",
  fontWeight: "500",
};

const divider = {
  borderColor: "rgba(255, 255, 255, 0.1)",
  margin: "12px 0",
};

const totalRow = {
  marginTop: "12px",
};

const totalLabelColumn = {
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "500",
  width: "120px",
};

const totalValueColumn = {
  color: "#00E5FF", // Cyan
  fontSize: "16px",
  fontWeight: "800",
};
