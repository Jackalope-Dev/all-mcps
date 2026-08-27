'use client';

import { Turnstile } from '@marsidev/react-turnstile';

interface TurnstileWidgetProps {
  onSuccess?: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
  /** 'interaction-only' renders no visible UI unless Cloudflare decides a challenge is needed. Defaults to 'always' (existing behavior). */
  appearance?: 'always' | 'interaction-only';
  /** Omits the vertical margin wrapper — for inline/compact forms. Defaults to false (existing behavior). */
  compact?: boolean;
}

export function TurnstileWidget({
  onSuccess,
  onError,
  onExpire,
  appearance = 'always',
  compact = false,
}: TurnstileWidgetProps) {
  // Use the provided environment variable or the user's actual site key
  const siteKey =
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '0x4AAAAAAD_iUPDcKGNCmYcX';

  return (
    <div
      className={compact ? 'turnstile-widget-compact' : 'my-4'}
      style={compact ? undefined : { marginTop: '1rem', marginBottom: '1rem' }}
    >
      <Turnstile
        siteKey={siteKey}
        onSuccess={onSuccess}
        onError={onError}
        onExpire={onExpire}
        options={{ action: 'turnstile-spin-v2', appearance }}
      />
    </div>
  );
}
