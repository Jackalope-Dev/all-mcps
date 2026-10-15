'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { isUserInEU } from '../../lib/consentRegion';
import { trackContactSubmit } from '../../lib/gtag';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { toast } from '../ui/Toast';
import { TurnstileWidget } from '../ui/TurnstileWidget';

export function ContactForm() {
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [token, setToken] = useState<string>('');
  const [newsletterOptIn, setNewsletterOptIn] = useState(true);

  // Same EU/UK opt-in-only signal as the cookie banner and submit form.
  useEffect(() => {
    if (isUserInEU()) setNewsletterOptIn(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token) {
      toast.error('Complete the security check', {
        description: 'Please finish the Turnstile challenge before sending.',
      });
      return;
    }

    setStatus('loading');
    const formData = new FormData(e.currentTarget);
    const data: Record<string, unknown> = Object.fromEntries(
      formData.entries(),
    );

    data['cf-turnstile-response'] = token;
    data.newsletterOptIn = newsletterOptIn;

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setStatus('success');
        trackContactSubmit({
          name: typeof data.name === 'string' ? data.name : undefined,
          messageLength:
            typeof data.message === 'string' ? data.message.length : 0,
        });
        toast.success('Message sent', {
          description: "We'll get back to you soon.",
        });
      } else {
        setStatus('error');
        toast.error('Could not send message', {
          description: 'Please try again in a moment.',
        });
        (window as any).turnstile?.reset();
        setToken('');
      }
    } catch (_err) {
      setStatus('error');
      toast.error('Could not send message', {
        description: 'Network error. Check your connection and try again.',
      });
      (window as any).turnstile?.reset();
      setToken('');
    }
  };

  if (status === 'success') {
    return (
      <div className="acct-contact-done" role="status">
        <div className="acct-success-check" aria-hidden="true">
          <svg viewBox="0 0 52 52" width="44" height="44" aria-hidden="true">
            <circle cx="26" cy="26" r="24" />
            <path d="M15 27l7 7 15-16" />
          </svg>
        </div>
        <h2>Message sent</h2>
        <p>Thanks for reaching out — we’ll get back to you by email soon.</p>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setStatus('idle')}
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="acct-contact-form">
      <div className="acct-grid-2">
        <Input
          id="contact-name"
          name="name"
          label="Name"
          placeholder="Jane Doe"
          autoComplete="name"
          required
        />
        <Input
          id="contact-email"
          name="email"
          label="Email"
          type="email"
          placeholder="jane@example.com"
          autoComplete="email"
          inputMode="email"
          required
        />
      </div>

      <div className="form-field">
        <label htmlFor="contact-message" className="form-label">
          Message
        </label>
        <textarea
          id="contact-message"
          name="message"
          className="form-input acct-textarea"
          rows={6}
          placeholder="How can we help? Include a listing URL if it’s about a specific server."
          required
        />
      </div>

      <label className="form-checkbox-row">
        <input
          type="checkbox"
          name="newsletterOptIn"
          checked={newsletterOptIn}
          onChange={(e) => setNewsletterOptIn(e.target.checked)}
        />
        <span>
          Send me the weekly AllMCPs newsletter — new servers and guides.
        </span>
      </label>

      <TurnstileWidget
        onSuccess={setToken}
        onExpire={() => setToken('')}
        onError={() => setToken('')}
      />

      <Button
        variant="primary"
        type="submit"
        size="lg"
        disabled={status === 'loading'}
        className="acct-contact-submit"
      >
        {status === 'loading' ? (
          <>
            <Loader2 size={16} className="acct-spin" aria-hidden="true" />
            Sending…
          </>
        ) : (
          'Send message'
        )}
      </Button>
    </form>
  );
}
