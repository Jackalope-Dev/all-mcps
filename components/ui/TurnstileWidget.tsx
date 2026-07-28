'use client';

import { Turnstile } from '@marsidev/react-turnstile';

interface TurnstileWidgetProps {
  onSuccess?: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
}

export function TurnstileWidget({ onSuccess, onError, onExpire }: TurnstileWidgetProps) {
  // Use the provided environment variable or the user's actual site key
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '0x4AAAAAAD_iUPDcKGNCmYcX';

  return (
    <div className="my-4" style={{ marginTop: '1rem', marginBottom: '1rem' }}>
      <Turnstile
        siteKey={siteKey}
        onSuccess={onSuccess}
        onError={onError}
        onExpire={onExpire}
        options={{ action: 'turnstile-spin-v2' }}
      />
    </div>
  );
}
