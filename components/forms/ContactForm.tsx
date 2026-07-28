'use client';

import { useState } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { TurnstileWidget } from '../ui/TurnstileWidget';
import { toast } from '../ui/Toast';

export function ContactForm() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [token, setToken] = useState<string>('');

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
    const data = Object.fromEntries(formData.entries());

    data['cf-turnstile-response'] = token;

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setStatus('success');
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
    } catch (err) {
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
      <div style={{ textAlign: 'center', padding: '2rem 0' }}>
        <h3>Message sent successfully!</h3>
        <p>We'll get back to you soon.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <Input name="name" label="Your Name" placeholder="Jane Doe" required />
      <Input name="email" label="Email Address" type="email" placeholder="jane@example.com" required />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Message</label>
        <textarea name="message" className="form-input" rows={5} placeholder="How can we help you?" required></textarea>
      </div>

      <TurnstileWidget onSuccess={setToken} onExpire={() => setToken('')} onError={() => setToken('')} />

      <Button variant="primary" type="submit" disabled={status === 'loading'} style={{ marginTop: '1rem', alignSelf: 'flex-start' }}>
        {status === 'loading' ? 'Sending...' : 'Send Message'}
      </Button>
    </form>
  );
}
