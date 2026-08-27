'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { trackNewsletterSignup } from '../../lib/gtag';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { toast } from '../ui/Toast';

const TurnstileWidget = dynamic(
  () => import('../ui/TurnstileWidget').then((m) => m.TurnstileWidget),
  { ssr: false },
);

type NewsletterSource = 'footer' | 'homepage' | 'modal';

export function NewsletterSignupForm({
  source,
  compact = false,
  onSuccess,
}: {
  source: NewsletterSource;
  compact?: boolean;
  onSuccess?: () => void;
}) {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [captchaReady, setCaptchaReady] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token) {
      toast.error('Complete the security check', {
        description: 'Please try again in a moment.',
      });
      return;
    }

    setStatus('loading');
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source, 'cf-turnstile-response': token }),
      });

      if (res.ok) {
        setStatus('success');
        trackNewsletterSignup({ source });
        toast.success('Subscribed', { description: "You're on the list." });
        // Persist a cookie so the newsletter modal won't reappear
        document.cookie =
          'allmcps_subscribed=1; path=/; max-age=31536000; SameSite=Lax';
        onSuccess?.();
      } else {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setStatus('error');
        toast.error('Could not subscribe', {
          description: data?.error || 'Please try again.',
        });
        (window as any).turnstile?.reset();
        setToken('');
      }
    } catch {
      setStatus('error');
      toast.error('Could not subscribe', {
        description: 'Network error. Please try again.',
      });
      (window as any).turnstile?.reset();
      setToken('');
    }
  };

  if (status === 'success') {
    return (
      <p
        style={{
          color: 'var(--text-secondary)',
          fontSize: '0.9rem',
          margin: 0,
        }}
      >
        You&apos;re subscribed — thanks for joining!
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={
        compact ? 'newsletter-form newsletter-form-compact' : 'newsletter-form'
      }
    >
      <Input
        name="email"
        type="email"
        placeholder="you@example.com"
        required
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onFocus={() => setCaptchaReady(true)}
        aria-label="Email address"
      />
      {captchaReady ? (
        <TurnstileWidget
          appearance="interaction-only"
          compact
          onSuccess={setToken}
          onExpire={() => setToken('')}
          onError={() => setToken('')}
        />
      ) : null}
      <Button variant="primary" type="submit" disabled={status === 'loading'}>
        {status === 'loading' ? 'Subscribing…' : 'Subscribe'}
      </Button>
    </form>
  );
}
