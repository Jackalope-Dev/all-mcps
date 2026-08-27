import { Button, Text } from '@react-email/components';
import { BaseLayout, buttonStyle, textStyle } from './BaseLayout';

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
  return (
    <BaseLayout previewText={heading} heading={heading}>
      <Text style={textStyle}>{message}</Text>

      {actionText && actionUrl && (
        <Button href={actionUrl} style={buttonStyle}>
          {actionText}
        </Button>
      )}
    </BaseLayout>
  );
};

export default NotificationEmail;
