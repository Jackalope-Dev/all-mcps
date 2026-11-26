import { Link, Text } from '@react-email/components';
import {
  BaseLayout,
  linkStyle,
  mutedTextStyle,
  PrimaryButton,
  textStyle,
  urlBoxStyle,
} from './BaseLayout';

interface MagicLinkEmailProps {
  loginUrl: string;
}

export const MagicLinkEmail = ({
  loginUrl = 'https://allmcps.com/api/auth/callback/email?token=example',
}: MagicLinkEmailProps) => {
  return (
    <BaseLayout
      previewText="Your secure sign-in link for AllMCPs"
      heading="Sign in to AllMCPs"
    >
      <Text style={textStyle}>
        Tap the button below to sign in. The link works once and expires in 24
        hours.
      </Text>

      <PrimaryButton href={loginUrl}>Sign in to AllMCPs →</PrimaryButton>

      <Text style={{ ...mutedTextStyle, marginTop: '24px' }}>
        Didn&rsquo;t ask to sign in? You can ignore this email; nobody can get
        in without the link.
      </Text>
      <Text style={{ ...mutedTextStyle, margin: 0 }}>
        Button not working? Paste this into your browser:
      </Text>
      <Text style={urlBoxStyle}>
        <Link href={loginUrl} style={{ ...linkStyle, fontWeight: '400' }}>
          {loginUrl}
        </Link>
      </Text>
    </BaseLayout>
  );
};
