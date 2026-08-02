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
  const [category, setCategory] = useState(DEFAULT_SUBMIT_CATEGORY);

  const agentPromptText = `Read this repository's package.json and README.md to extract the MCP server name, description, category, and repository URL. Then submit this MCP server to AllMCPs.com by sending a POST request to https://allmcps.com/api/v1/submit with JSON: {"name": "<name>", "url": "<repo_url>", "description": "<description>", "category": "<category>", "email": "<your_email>"}`;

  const copyAgentPrompt = async () => {
    try {
      await navigator.clipboard.writeText(agentPromptText);
      toast.success('AI Agent Prompt Copied!', {
        description: 'Paste this prompt in Cursor, Claude Code, Windsurf, or Antigravity inside your project repo.',
      });
    } catch {
      toast.error('Could not copy automatically.');
    }
  };

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
        category?: string;
        source?: string;
        llmEnriched?: boolean;
      };
      if (!res.ok) throw new Error(data.error || 'Prefill failed');

      if (data.name && !name) setName(data.name);
      else if (data.name) setName(data.name);
      if (data.description) setDescription(data.description);
      if (data.url) setUrl(data.url);
      if (data.websiteUrl) setWebsiteUrl(data.websiteUrl);
      else if (data.source === 'website') setWebsiteUrl(fromUrl.trim());
      if (data.category) setCategory(data.category);

      toast.success('Details prefilled', {
        description: data.llmEnriched
          ? 'Enriched with AI (falls back if the model budget is hit).'
          : data.source === 'github'
            ? 'From GitHub repository metadata.'
            : 'From the website title and meta tags.',
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
    data.name = name;
    data.email = email;
    data.url = url.trim() || websiteUrl.trim();
    data.websiteUrl = websiteUrl;
    data.description = description;
    data.category = category;

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
    const isGithub = url.includes('github.com');
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://allmcps.com';
    const sampleId = submittedId || 'your-server';
    const badgeSrc = `${baseUrl}/api/badge/${sampleId}?style=shield`;
    const badgeMarkdown = `[![AllMCPs Verified](${badgeSrc})](${baseUrl}/mcp/${sampleId})`;

    return (
      <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🎉</div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Server Submitted Successfully!</h3>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.9rem', maxWidth: '500px', margin: '0.5rem auto 1rem' }}>
          Your MCP server is in the review queue. When it goes live you&apos;ll get an email with a direct claim link — free dofollow after you verify your site and keep the badge.
        </p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: '500px', margin: '0 auto 1.5rem', lineHeight: 1.55 }}>
          Bookmark the claim page below now. Path after approval: open claim → verify domain → badge stays dofollow for a reciprocal SEO link.
        </p>

        {submittedId && (
          <div
            style={{
              textAlign: 'left',
              maxWidth: '540px',
              margin: '0 auto 1.75rem',
              padding: '1.25rem',
              borderRadius: '12px',
              border: '1px solid rgba(0,229,255,0.25)',
              background: 'rgba(0,229,255,0.04)',
            }}
          >
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#00E5FF', marginBottom: '0.5rem' }}>
              Step 1: Add your AllMCPs Badge
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
              {isGithub
                ? 'Embed this standard 20px badge in your GitHub repository README.md. Adding it triggers automatic verification and marks your listing as Verified.'
                : 'Embed this badge or HTML verification tag on your website to claim ownership.'}
            </p>

            <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
              <pre
                style={{
                  background: 'rgba(0,0,0,0.6)',
                  padding: '0.85rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  color: '#10b981',
                  fontSize: '0.75rem',
                  overflowX: 'auto',
                  margin: 0,
                }}
              >
                <code>{badgeMarkdown}</code>
              </pre>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(badgeMarkdown);
                    toast.success('Badge Markdown copied!');
                  } catch {
                    toast.error('Could not copy automatically.');
                  }
                }}
                style={{
                  position: 'absolute',
                  top: '0.4rem',
                  right: '0.4rem',
                  background: 'var(--accent-color)',
                  color: 'var(--bg-color)',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '0.2rem 0.6rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Copy
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Badge Preview:</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={badgeSrc} alt="AllMCPs badge preview" height={20} />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center' }}>
          {submittedId && (
            <>
              <a
                href={`/mcp/${submittedId}/claim`}
                style={{
                  padding: '0.65rem 1.25rem',
                  background: 'var(--accent-color)',
                  color: 'var(--bg-color)',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                  textDecoration: 'none',
                }}
              >
                Save claim link (after approval) →
              </a>
              <a
                href={`/mcp/${submittedId}`}
                style={{
                  padding: '0.65rem 1.25rem',
                  border: '1px solid var(--border-color)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'var(--text-primary)',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  textDecoration: 'none',
                }}
              >
                Preview listing
              </a>
            </>
          )}
          <a
            href={submittedId ? `/pricing?serverId=${encodeURIComponent(submittedId)}` : '/pricing'}
            style={{
              padding: '0.65rem 1.25rem',
              border: '1px solid var(--border-color)',
              background: 'rgba(255,255,255,0.05)',
              color: 'var(--text-primary)',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.9rem',
              textDecoration: 'none',
            }}
          >
            Priority Review ($5) / Promote →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%)',
          border: '1px solid rgba(0, 229, 255, 0.3)',
          borderRadius: '12px',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: '#00E5FF', fontSize: '0.95rem' }}>
            <span style={{ fontSize: '1.25rem' }}>🤖</span>
            <span>Let your AI Agent submit this repository automatically!</span>
          </div>
          <button
            type="button"
            onClick={copyAgentPrompt}
            style={{
              background: '#00E5FF',
              color: '#090d16',
              border: 'none',
              borderRadius: '6px',
              padding: '0.45rem 0.85rem',
              fontSize: '0.825rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              boxShadow: '0 2px 8px rgba(0, 229, 255, 0.2)',
            }}
          >
            📋 Copy Agent Prompt
          </button>
        </div>
        <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Paste this prompt into <strong>Cursor</strong>, <strong>Claude Code</strong>, <strong>Windsurf</strong>, or <strong>Antigravity</strong> inside your MCP project repository. Your agent will extract metadata and submit to AllMCPs automatically!
        </p>
      </div>

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
            value={category}
            onChange={(e) => setCategory(e.target.value)}
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
    </div>
  );
}
