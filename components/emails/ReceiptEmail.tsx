import { Column, Hr, Row, Text } from '@react-email/components';
import {
  BaseLayout,
  mutedTextStyle,
  Panel,
  PrimaryButton,
  textStyle,
} from './BaseLayout';

interface ReceiptEmailProps {
  receiptId: string;
  date: string;
  amount: string;
  description: string;
  actionText?: string;
  actionUrl?: string;
}

export const ReceiptEmail = ({
  receiptId = 'RCPT-123456',
  date = 'July 27, 2026',
  amount = '$49.00',
  description = 'AllMCPs Listing Fee',
  actionText,
  actionUrl,
}: ReceiptEmailProps) => {
  return (
    <BaseLayout
      previewText={`Your receipt for ${amount}`}
      heading="Thanks for your payment"
    >
      <Text style={textStyle}>
        Your payment went through. Here&rsquo;s your receipt.
      </Text>

      <Panel>
        <Row style={row}>
          <Column style={labelColumn}>Item</Column>
          <Column style={valueColumn}>{description}</Column>
        </Row>
        <Row style={row}>
          <Column style={labelColumn}>Date</Column>
          <Column style={valueColumn}>{date}</Column>
        </Row>
        <Row style={row}>
          <Column style={labelColumn}>Receipt</Column>
          <Column style={valueColumn}>{receiptId}</Column>
        </Row>
        <Hr style={divider} />
        <Row>
          <Column style={totalLabelColumn}>Total paid</Column>
          <Column style={totalValueColumn}>{amount}</Column>
        </Row>
      </Panel>

      {actionText && actionUrl && (
        <PrimaryButton href={actionUrl}>{actionText}</PrimaryButton>
      )}

      <Text style={{ ...mutedTextStyle, marginTop: '24px', marginBottom: 0 }}>
        Questions about this charge? Just reply to this email.
      </Text>
    </BaseLayout>
  );
};

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const row = {
  marginBottom: '8px',
};

const labelColumn = {
  color: '#64748b',
  fontFamily: FONT,
  fontSize: '13px',
  width: '96px',
  verticalAlign: 'top' as const,
  paddingBottom: '8px',
};

const valueColumn = {
  color: '#020617',
  fontFamily: FONT,
  fontSize: '14px',
  fontWeight: '500',
  paddingBottom: '8px',
};

const divider = {
  borderColor: '#e2e8f0',
  margin: '8px 0 14px',
};

const totalLabelColumn = {
  color: '#020617',
  fontFamily: FONT,
  fontSize: '15px',
  fontWeight: '700',
  width: '96px',
};

const totalValueColumn = {
  color: '#020617',
  fontFamily: FONT,
  fontSize: '18px',
  fontWeight: '800',
};
