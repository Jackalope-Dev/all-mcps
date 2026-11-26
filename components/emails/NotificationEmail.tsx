import { Text } from '@react-email/components';
import { BaseLayout, PrimaryButton, textStyle } from './BaseLayout';

interface NotificationEmailProps {
  heading: string;
  message: string;
  actionText?: string;
  actionUrl?: string;
}

export const NotificationEmail = ({
  heading = 'You have a new notification',
  message = 'This is a standard notification message from AllMCPs.',
  actionText,
  actionUrl,
}: NotificationEmailProps) => {
  // Callers separate paragraphs with a blank line; single newlines stay breaks.
  const paragraphs = message
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <BaseLayout previewText={heading} heading={heading}>
      {paragraphs.map((para, i) => (
        <Text
          // biome-ignore lint/suspicious/noArrayIndexKey: static paragraphs, never reordered
          key={i}
          style={{ ...textStyle, whiteSpace: 'pre-line' as const }}
        >
          {para}
        </Text>
      ))}

      {actionText && actionUrl && (
        <PrimaryButton href={actionUrl}>{actionText}</PrimaryButton>
      )}
    </BaseLayout>
  );
};
