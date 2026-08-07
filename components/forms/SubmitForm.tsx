'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { TurnstileWidget } from '../ui/TurnstileWidget';
import { toast } from '../ui/Toast';
import { DEFAULT_SUBMIT_CATEGORY, DIRECTORY_CATEGORIES } from '../../lib/categories';
import { trackSubmitLead } from '../../lib/gtag';
import { MCP_CLIENTS } from '../../lib/clients';
import {
  PRICING_MODELS,
  PRICING_MODEL_LABELS,
  AUTH_TYPES,
  AUTH_TYPE_LABELS,
  MAINTENANCE_STATUSES,
  MAINTENANCE_STATUS_LABELS,
} from '../../lib/serverEnums';

type FormStep = 1 | 2 | 3;

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

  // Optional enrichment fields — none required, all improve discoverability/trust.
  const [tagsInput, setTagsInput] = useState('');
  const [pricingModel, setPricingModel] = useState('');
  const [pricingNotes, setPricingNotes] = useState('');
  const [authType, setAuthType] = useState('');
  const [license, setLicense] = useState('');
  const [compatibleClients, setCompatibleClients] = useState<string[]>([]);
  const [maintenanceStatus, setMaintenanceStatus] = useState('');
  const [supportUrl, setSupportUrl] = useState('');
  const [suggestedInstallCommand, setSuggestedInstallCommand] = useState('');
  const [suggestedInstallArgsInput, setSuggestedInstallArgsInput] = useState('');

  const agentPromptText = `Read this repository's package.json and README.md to extract the MCP server name, description, category, and repository URL. Then submit this MCP server to AllMCPs.com by sending a POST request to https://allmcps.com/api/v1/submit with JSON: {"name": "<name>", "url": "<repo_url>", "description": "<description>", "category": "<category>", "email": "<your_email>"}`;

  /** Which step feels "current" based on what's filled — purely visual guidance. */
  const activeStep: FormStep = useMemo(() => {
    if (!url.trim() && !websiteUrl.trim()) return 1;
    if (!name.trim() || !email.trim() || !description.trim()) return 2;
    return 3;
  }, [url, websiteUrl, name, email, description]);

  const copyAgentPrompt = async () => {
    try {
      await navigator.clipboard.writeText(agentPromptText);
      toast.success('AI agent prompt copied', {
        description: 'Paste it in Cursor, Claude Code, or Windsurf inside your repo.',
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

      if (data.name) setName(data.name);
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
    const data: Record<string, unknown> = Object.fromEntries(formData.entries());
    data['cf-turnstile-response'] = token;
    data.name = name;
    data.email = email;
    data.url = url.trim() || websiteUrl.trim();
    data.websiteUrl = websiteUrl;
    data.description = description;
    data.category = category;
    data.tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
    data.pricingModel = pricingModel || undefined;
    data.pricingNotes = pricingNotes || undefined;
    data.authType = authType || undefined;
    data.license = license || undefined;
    data.compatibleClients = compatibleClients;
    data.maintenanceStatus = maintenanceStatus || undefined;
    data.supportUrl = supportUrl || undefined;
    data.suggestedInstallCommand = suggestedInstallCommand || undefined;
    data.suggestedInstallArgs = suggestedInstallArgsInput.split(/\s+/).map((a) => a.trim()).filter(Boolean);

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
      <div className="submit-success">
        <div className="submit-success-hero">
          <div className="submit-success-icon" aria-hidden="true">
            ✓
          </div>
          <h2 className="submit-success-title">You&apos;re in the review queue</h2>
          <p className="submit-success-lead">
            We&apos;ll email you when the listing is approved. Meanwhile, prepare your badge and
            optionally skip the queue with a boost.
          </p>
        </div>

        <ol className="submit-timeline">
          <li className="submit-timeline-item">
            <span className="submit-timeline-step" aria-hidden="true">
              1
            </span>
            <div>
              <h3>We review your listing</h3>
              <p>Free submissions are reviewed in queue. Priority Review jumps ahead.</p>
            </div>
          </li>
          <li className="submit-timeline-item">
            <span className="submit-timeline-step" aria-hidden="true">
              2
            </span>
            <div>
              <h3>You get an approval email</h3>
              <p>Includes a direct claim link once the listing is live.</p>
            </div>
          </li>
          <li className="submit-timeline-item">
            <span className="submit-timeline-step" aria-hidden="true">
              3
            </span>
            <div>
              <h3>Claim &amp; verify</h3>
              <p>
                Verify your site and keep the AllMCPs badge live for a free reciprocal dofollow
                backlink.
              </p>
            </div>
          </li>
        </ol>

        {submittedId && (
          <div className="submit-badge-prep">
            <h3 className="submit-badge-prep-title">Prepare your badge</h3>
            <p className="submit-badge-prep-body">
              {isGithub
                ? 'Add this to your GitHub README after approval to speed up verification.'
                : 'Add this badge or HTML tag to your site after approval to claim ownership.'}
            </p>
            <div className="submit-badge-code-wrap">
              <pre className="submit-badge-code">
                <code>{badgeMarkdown}</code>
              </pre>
              <button
                type="button"
                className="btn btn-primary btn-sm submit-badge-copy"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(badgeMarkdown);
                    toast.success('Badge markdown copied');
                  } catch {
                    toast.error('Could not copy automatically.');
                  }
                }}
              >
                Copy
              </button>
            </div>
            <div className="submit-badge-preview">
              <span>Preview</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={badgeSrc} alt="AllMCPs badge preview" height={20} />
            </div>
          </div>
        )}

        <div className="submit-upsell">
          <h3 className="submit-upsell-title">Optional: launch faster</h3>
          <p className="submit-upsell-lead">Boosts are optional — free listings are reviewed in queue.</p>
          <div className="submit-upsell-grid">
            <div className="submit-upsell-card">
              <span className="submit-upsell-kicker">Quick pass</span>
              <h4>Priority Review</h4>
              <p>Jump the manual queue — typically reviewed within a few hours.</p>
              <div className="submit-upsell-footer">
                <span className="submit-upsell-price">$5</span>
                <Link
                  href={
                    submittedId
                      ? `/pricing?serverId=${encodeURIComponent(submittedId)}&sku=priority_review`
                      : '/pricing'
                  }
                  className="btn btn-primary btn-sm"
                >
                  Get priority
                </Link>
              </div>
            </div>
            <div className="submit-upsell-card submit-upsell-card--spotlight">
              <span className="submit-upsell-kicker submit-upsell-kicker--green">Spotlight</span>
              <h4>7-day launch boost</h4>
              <p>Featured placement on homepage discovery and search for a week.</p>
              <div className="submit-upsell-footer">
                <span className="submit-upsell-price">$12</span>
                <Link
                  href={
                    submittedId
                      ? `/pricing?serverId=${encodeURIComponent(submittedId)}&sku=featured_7d`
                      : '/pricing'
                  }
                  className="btn btn-primary btn-sm"
                >
                  Boost 7 days
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="submit-success-actions">
          {submittedId && (
            <>
              <Link href={`/mcp/${submittedId}/claim`} className="btn btn-primary">
                Open claim page
              </Link>
              <Link href={`/mcp/${submittedId}`} className="btn btn-secondary">
                Preview listing
              </Link>
            </>
          )}
          <Link
            href={submittedId ? `/pricing?serverId=${encodeURIComponent(submittedId)}` : '/pricing'}
            className="btn btn-secondary"
          >
            All plans
          </Link>
          <Link href="/dashboard" className="btn btn-secondary">
            Go to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="submit-flow">
      <div className="submit-agent-banner">
        <div className="submit-agent-banner-text">
          <span className="submit-agent-banner-kicker">Optional · for AI agents</span>
          <p>
            Have Cursor, Claude Code, or Windsurf submit for you — copy the prompt and run it inside
            your MCP repo.
          </p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={copyAgentPrompt}>
          Copy agent prompt
        </Button>
      </div>

      <nav className="submit-stepper" aria-label="Submission steps">
        {(
          [
            { n: 1 as FormStep, label: 'URL' },
            { n: 2 as FormStep, label: 'Details' },
            { n: 3 as FormStep, label: 'Submit' },
          ] as const
        ).map((s, i, arr) => (
          <div key={s.n} className="submit-stepper-item-wrap">
            <div
              className={`submit-stepper-item${activeStep === s.n ? ' is-current' : ''}${
                activeStep > s.n ? ' is-done' : ''
              }`}
            >
              <span className="submit-stepper-num" aria-hidden="true">
                {activeStep > s.n ? '✓' : s.n}
              </span>
              <span className="submit-stepper-label">{s.label}</span>
            </div>
            {i < arr.length - 1 && <span className="submit-stepper-connector" aria-hidden="true" />}
          </div>
        ))}
      </nav>

      <form onSubmit={handleSubmit} className="submit-form">
        <section
          className={`submit-section${activeStep === 1 ? ' is-active' : ''}`}
          aria-labelledby="submit-step-1"
        >
          <header className="submit-section-header">
            <span className="submit-section-badge">Step 1</span>
            <h2 id="submit-step-1">Repository or website</h2>
            <p>Paste a GitHub URL or product site — we&apos;ll pull what we can automatically.</p>
          </header>

          <Input
            name="url"
            label="GitHub repository or website URL"
            placeholder="https://github.com/username/repo"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            autoComplete="url"
          />

          <div className="submit-prefill-row">
            <Button
              type="button"
              variant="secondary"
              disabled={prefillLoading || (!url.trim() && !websiteUrl.trim())}
              onClick={() => runPrefill(url || websiteUrl)}
            >
              {prefillLoading ? 'Fetching metadata…' : 'Auto-prefill form'}
            </Button>
            <p className="submit-hint">
              Fills name, description, category, and website from GitHub or page meta tags.
            </p>
          </div>
        </section>

        <section
          className={`submit-section${activeStep === 2 ? ' is-active' : ''}`}
          aria-labelledby="submit-step-2"
        >
          <header className="submit-section-header">
            <span className="submit-section-badge">Step 2</span>
            <h2 id="submit-step-2">Listing details</h2>
            <p>How your server appears in the directory and where we send status updates.</p>
          </header>

          <Input
            name="name"
            label="Server name"
            placeholder="e.g. GitHub MCP"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="form-field">
            <Input
              name="email"
              label="Contact email"
              placeholder="you@example.com"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <p className="submit-hint">Used for review status and your claim link — never sold.</p>
          </div>

          <div className="form-field">
            <Input
              name="websiteUrl"
              label="Website URL (optional)"
              placeholder="https://yoursite.com"
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
            />
            <p className="submit-hint">
              Free listings use <strong>nofollow</strong> on website links. Verify + badge (or
              Premium) unlocks a <strong>dofollow</strong> reciprocal link.
            </p>
          </div>

          <div className="form-field">
            <label htmlFor="submit-description" className="form-label">
              Short description
            </label>
            <textarea
              id="submit-description"
              name="description"
              className="form-input submit-textarea"
              rows={3}
              placeholder="What tools or capabilities this server exposes to AI agents…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="submit-category" className="form-label">
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

          <details className="submit-optional-details">
            <summary>Optional details (pricing, auth, license, compatible clients…)</summary>
            <div className="submit-optional-body">
              <p className="submit-hint">
                None of this is required — the more you fill in, the easier your listing is to find
                and trust.
              </p>

              <div className="form-field">
                <Input
                  name="tagsInputRaw"
                  label="Tags (comma-separated, up to 5)"
                  placeholder="e.g. sql, database, read-only"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                />
              </div>

              <div className="submit-optional-grid">
                <div className="form-field">
                  <label htmlFor="submit-pricing" className="form-label">
                    Pricing
                  </label>
                  <select
                    id="submit-pricing"
                    className="form-input"
                    value={pricingModel}
                    onChange={(e) => setPricingModel(e.target.value)}
                  >
                    <option value="">Not specified</option>
                    {PRICING_MODELS.map((p) => (
                      <option key={p} value={p}>
                        {PRICING_MODEL_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="submit-auth" className="form-label">
                    Auth required
                  </label>
                  <select
                    id="submit-auth"
                    className="form-input"
                    value={authType}
                    onChange={(e) => setAuthType(e.target.value)}
                  >
                    <option value="">Not specified</option>
                    {AUTH_TYPES.map((a) => (
                      <option key={a} value={a}>
                        {AUTH_TYPE_LABELS[a]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="submit-maintenance" className="form-label">
                    Maintenance status
                  </label>
                  <select
                    id="submit-maintenance"
                    className="form-input"
                    value={maintenanceStatus}
                    onChange={(e) => setMaintenanceStatus(e.target.value)}
                  >
                    <option value="">Not specified</option>
                    {MAINTENANCE_STATUSES.map((m) => (
                      <option key={m} value={m}>
                        {MAINTENANCE_STATUS_LABELS[m]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <Input
                    name="licenseInputRaw"
                    label="License"
                    placeholder="e.g. MIT"
                    value={license}
                    onChange={(e) => setLicense(e.target.value)}
                  />
                </div>
              </div>

              {pricingModel && pricingModel !== 'free' && (
                <div className="form-field">
                  <Input
                    name="pricingNotesInputRaw"
                    label="Pricing notes (optional)"
                    placeholder="e.g. Free tier: 100 req/day, then $0.01/req"
                    value={pricingNotes}
                    onChange={(e) => setPricingNotes(e.target.value)}
                  />
                </div>
              )}

              <div className="form-field">
                <Input
                  name="supportUrlInputRaw"
                  label="Support / community link (optional)"
                  placeholder="https://discord.gg/... or a docs URL"
                  type="url"
                  value={supportUrl}
                  onChange={(e) => setSupportUrl(e.target.value)}
                />
              </div>

              <div className="form-field">
                <label className="form-label">Compatible clients</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {MCP_CLIENTS.map((c) => {
                    const checked = compatibleClients.includes(c.slug);
                    return (
                      <label
                        key={c.slug}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          fontSize: '0.8rem',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          padding: '0.3rem 0.6rem',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setCompatibleClients((prev) =>
                              e.target.checked ? [...prev, c.slug] : prev.filter((s) => s !== c.slug)
                            )
                          }
                        />
                        {c.name}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="submit-optional-grid">
                <div className="form-field">
                  <Input
                    name="suggestedInstallCommandInputRaw"
                    label="Suggested install command (optional)"
                    placeholder="e.g. npx"
                    value={suggestedInstallCommand}
                    onChange={(e) => setSuggestedInstallCommand(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <Input
                    name="suggestedInstallArgsInputRaw"
                    label="Suggested install args (space-separated)"
                    placeholder="e.g. -y @scope/package"
                    value={suggestedInstallArgsInput}
                    onChange={(e) => setSuggestedInstallArgsInput(e.target.value)}
                  />
                </div>
              </div>
              <p className="submit-hint">
                Only used as a hint if we can&apos;t confidently detect an install command
                automatically — reviewers can still correct it.
              </p>
            </div>
          </details>
        </section>

        <section
          className={`submit-section${activeStep === 3 ? ' is-active' : ''}`}
          aria-labelledby="submit-step-3"
        >
          <header className="submit-section-header">
            <span className="submit-section-badge">Step 3</span>
            <h2 id="submit-step-3">Security &amp; submit</h2>
            <p>One quick check, then you&apos;re in the queue. Listing is free.</p>
          </header>

          <TurnstileWidget onSuccess={setToken} onExpire={() => setToken('')} onError={() => setToken('')} />

          <div className="submit-form-footer">
            <Button variant="primary" type="submit" disabled={status === 'loading'} size="lg">
              {status === 'loading' ? 'Submitting…' : 'Submit to AllMCPs'}
            </Button>
            <p className="submit-hint">
              By submitting you agree to our{' '}
              <Link href="/terms" className="submit-inline-link">
                Terms
              </Link>
              . Paid boosts are optional after submit.
            </p>
          </div>
        </section>
      </form>
    </div>
  );
}
