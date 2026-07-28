'use client';

import { useState } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { TurnstileWidget } from '../ui/TurnstileWidget';
import { toast } from '../ui/Toast';

const CATEGORIES = [
  '💻 Developer Tools',
  '🗄️ Databases',
  '📂 File Systems',
  '🔎 Search & Data Extraction',
  '💬 Communication',
  '💰 Finance & Fintech',
  '🔒 Security',
  '🛠️ Other Tools and Integrations',
  'Community',
  'Other',
];

export function SubmitForm() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [token, setToken] = useState<string>('');
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token) {
      toast.error('Complete the security check', {
        description: 'Please finish the Turnstile challenge before submitting.',
      });
      return;
    }

    setStatus('loading');
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    data['cf-turnstile-response'] = token;

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        const payload = (await res.json().catch(() => null)) as { id?: string } | null;
        setSubmittedId(payload?.id || null);
        setStatus('success');
        toast.success('Server submitted', {
          description: 'Your listing is pending review. You can claim it after approval.',
        });
      } else {
        const errorData = (await res.json().catch(() => null)) as { error?: unknown } | null;
        const serverError = errorData?.error
          ? typeof errorData.error === 'string'
            ? errorData.error
            : JSON.stringify(errorData.error)
          : 'Submission failed.';
        setStatus('error');
        toast.error('Submission failed', { description: serverError });
        (window as any).turnstile?.reset();
        setToken('');
      }
    } catch (err) {
      setStatus('error');
      toast.error('Submission failed', {
        description: 'An unexpected error occurred. Please try again.',
      });
      (window as any).turnstile?.reset();
      setToken('');
    }
  };

  if (status === 'success') {
    return (
      <div style={{ textAlign: 'center', padding: '2rem 0' }}>
        <h3>Server submitted successfully!</h3>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
          It is now pending review. Free listings link your website with <code>nofollow</code>; premium listings
          get a dofollow backlink. After approval you can claim the page and verify your website.
        </p>
        {submittedId && (
          <p style={{ marginTop: '1.25rem' }}>
            <a href={`/mcp/${submittedId}/claim`} style={{ color: 'var(--accent-color)', fontWeight: 600 }}>
              Claim &amp; verify ownership →
            </a>
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <Input name="name" label="Server Name" placeholder="e.g., GitHub MCP" />
      <Input name="url" label="Repository URL" placeholder="https://github.com/..." required />
      <Input
        name="websiteUrl"
        label="Website (optional)"
        placeholder="https://yoursite.com"
        type="url"
      />
      <p style={{ margin: '-0.75rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        Product or docs site. Free listings show this link with <strong>nofollow</strong>. Premium / paid
        listings get a <strong>dofollow</strong> backlink. You can verify ownership later via DNS TXT or a site badge.
      </p>
      <Input name="description" label="Short Description" placeholder="A brief description of what this server does" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Category</label>
        <select name="category" className="form-input" defaultValue="💻 Developer Tools">
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      <TurnstileWidget onSuccess={setToken} onExpire={() => setToken('')} onError={() => setToken('')} />

      <Button variant="primary" type="submit" disabled={status === 'loading'} style={{ marginTop: '1rem', alignSelf: 'flex-start' }}>
        {status === 'loading' ? 'Submitting...' : 'Submit Server'}
      </Button>
    </form>
  );
}
