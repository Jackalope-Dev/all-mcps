'use client';

import { useState } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { TurnstileWidget } from '../ui/TurnstileWidget';
import { toast } from '../ui/Toast';
import { DEFAULT_SUBMIT_CATEGORY, DIRECTORY_CATEGORIES } from '../../lib/categories';
import { trackSubmitLead } from '../../lib/gtag';

export function SubmitForm() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [token, setToken] = useState<string>('');
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [prefillLoading, setPrefillLoading] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [url, setUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [description, setDescription] = useState('');

  const runPrefill = async (fromUrl: string) => {
    if (!fromUrl.trim()) {
      toast.error('Enter a URL to prefill from');
      return;
    }
    setPrefillLoading(true);
    try {
      const res = await fetch('/api/submit/prefill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: fromUrl.trim() }),
      });
      const data = (await res.json()) as {
        error?: string;
        name?: string;
        description?: string;
        url?: string;
        websiteUrl?: string;
        source?: string;
      };
      if (!res.ok) throw new Error(data.error || 'Prefill failed');

      if (data.name && !name) setName(data.name);
      else if (data.name) setName(data.name);
      if (data.description) setDescription(data.description);
      if (data.url) setUrl(data.url);
      if (data.websiteUrl) setWebsiteUrl(data.websiteUrl);
      else if (data.source === 'website') setWebsiteUrl(fromUrl.trim());

      toast.success('Details prefilled', {
        description: data.source === 'github' ? 'From GitHub repository metadata.' : 'From the website title and meta tags.',
      });
    } catch (e: any) {
      toast.error('Prefill failed', { description: e?.message || 'Enter fields manually.' });
    } finally {
      setPrefillLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token) {
      toast.error('Complete the security check', {
        description: 'Please finish the Turnstile challenge before submitting.',
      });
      return;
    }

    if (!url.trim() && !websiteUrl.trim()) {
      toast.error('Add a repository or website URL');
      return;
    }

    setStatus('loading');
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    data['cf-turnstile-response'] = token;
    // Prefer explicit state (controlled inputs)
    data.name = name;
    data.email = email;
    data.url = url.trim() || websiteUrl.trim();
    data.websiteUrl = websiteUrl;
    data.description = description;

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
        trackSubmitLead({
          serverName: name,
          category: (data.category as string) || DEFAULT_SUBMIT_CATEGORY,
          url: url || websiteUrl,
        });
        toast.success('Server submitted', {
          description: 'Your listing is pending review.',
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
    } catch {
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
          It is now pending review. Optional:{' '}
          <a href="/pricing" style={{ color: 'var(--accent-color)' }}>
            Priority review ($5)
          </a>{' '}
          if you need a faster queue. After approval you can claim ownership and promote the listing.
        </p>
        {submittedId && (
          <p style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
            <a href={`/mcp/${submittedId}/claim`} style={{ color: 'var(--accent-color)', fontWeight: 600 }}>
              Claim &amp; verify ownership →
            </a>
            <a
              href={`/pricing?serverId=${encodeURIComponent(submittedId)}`}
              style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}
            >
              Priority review / promote →
            </a>
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <Input
          name="url"
          label="Repository or website URL"
          placeholder="https://github.com/... or https://yoursite.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          <Button
            type="button"
            variant="secondary"
            disabled={prefillLoading}
            onClick={() => runPrefill(url || websiteUrl)}
            style={{ fontSize: '0.85rem', padding: '0.5rem 0.9rem' }}
          >
            {prefillLoading ? 'Fetching…' : 'Prefill from URL'}
          </Button>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Works with GitHub repos or any public website (title + meta description).
          </span>
        </div>
      </div>

      <Input name="name" label="Server Name" placeholder="e.g., GitHub MCP" value={name} onChange={(e) => setName(e.target.value)} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <Input
          name="email"
          label="Your email"
          placeholder="you@example.com"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          We&apos;ll email you about your listing status and occasional offers.
        </p>
      </div>
      <Input
        name="websiteUrl"
        label="Website (optional if repo is the main link)"
        placeholder="https://yoursite.com"
        type="url"
        value={websiteUrl}
        onChange={(e) => setWebsiteUrl(e.target.value)}
      />
      <p style={{ margin: '-0.75rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        Free listings show website links with <strong>nofollow</strong>. Premium adds a <strong>dofollow</strong>{' '}
        backlink. GitHub is optional — website-only MCP products are welcome.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Short Description</label>
        <textarea
          name="description"
          className="form-input"
          rows={3}
          placeholder="What this server does"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label htmlFor="submit-category" style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
          Category
        </label>
        <select
          id="submit-category"
          name="category"
          className="form-input"
          defaultValue={DEFAULT_SUBMIT_CATEGORY}
          required
        >
          {DIRECTORY_CATEGORIES.map((cat) => (
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
