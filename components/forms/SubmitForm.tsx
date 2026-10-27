'use client';

import {
  AlertTriangle,
  Bot,
  Check,
  ChevronDown,
  FolderGit2,
  Globe,
  Link2,
  Loader2,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_SUBMIT_CATEGORY,
  DIRECTORY_CATEGORIES,
} from '../../lib/categories';
import { MCP_CLIENTS } from '../../lib/clients';
import { isUserInEU } from '../../lib/consentRegion';
import { trackSubmitLead } from '../../lib/gtag';
import type { Hue } from '../../lib/palette';
import { isGitHubRepoUrl, isRepositoryUrl } from '../../lib/repoUrl';
import {
  AUTH_TYPE_LABELS,
  AUTH_TYPES,
  MAINTENANCE_STATUS_LABELS,
  MAINTENANCE_STATUSES,
  PRICING_MODEL_LABELS,
  PRICING_MODELS,
} from '../../lib/serverEnums';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { toast } from '../ui/Toast';
import { TurnstileWidget } from '../ui/TurnstileWidget';
import { SubmitPreview } from './SubmitPreview';
import { SubmitSuccess } from './SubmitSuccess';

type Field = 'url' | 'name' | 'email' | 'description' | 'websiteUrl';

/** Step identity hues (progress dots + step numbers), in order. */
const STEP_HUES: readonly Hue[] = ['blue', 'violet', 'orange'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DESCRIPTION_SWEET_SPOT = { min: 40, max: 220 };

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/** A single-choice chip row standing in for a short <select>. */
function ChipChoice<T extends string>({
  label,
  options,
  labels,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <fieldset className="acct-fieldset">
      <legend className="form-label">{label}</legend>
      <div className="acct-chip-row">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            className="chip"
            aria-pressed={value === o}
            onClick={() => onChange(value === o ? '' : o)}
          >
            {labels[o]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function SubmitForm() {
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [token, setToken] = useState<string>('');
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [prefilledFrom, setPrefilledFrom] = useState<string | null>(null);
  const [duplicateMatch, setDuplicateMatch] = useState<{
    id: string;
    name: string;
    status: string;
  } | null>(null);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [attempted, setAttempted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [url, setUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(DEFAULT_SUBMIT_CATEGORY);
  const [newsletterOptIn, setNewsletterOptIn] = useState(true);

  // GDPR/PECR: no pre-ticked opt-in for EU/UK visitors. Same region signal the
  // cookie banner uses — checked client-side post-mount to avoid a hydration
  // mismatch (the server doesn't know the visitor's timezone/locale).
  useEffect(() => {
    if (isUserInEU()) setNewsletterOptIn(false);
  }, []);

  // Optional enrichment fields — none required, all improve discoverability/trust.
  const [tagsInput, setTagsInput] = useState('');
  const [pricingModel, setPricingModel] = useState('');
  const [pricingNotes, setPricingNotes] = useState('');
  const [authType, setAuthType] = useState('');
  const [license, setLicense] = useState('');
  const [compatibleClients, setCompatibleClients] = useState<string[]>([]);
  const [maintenanceStatus, setMaintenanceStatus] = useState('');
  const [supportUrl, setSupportUrl] = useState('');
  const [remoteEndpointUrl, setRemoteEndpointUrl] = useState('');
  const [suggestedInstallCommand, setSuggestedInstallCommand] = useState('');
  const [suggestedInstallArgsInput, setSuggestedInstallArgsInput] =
    useState('');

  const agentPromptText = `Read this repository's package.json and README.md to understand what this MCP server does. Then submit it to AllMCPs.com using its remote MCP server: POST {"jsonrpc":"2.0","id":1,"method":"tools/list"} to https://allmcps.com/api/mcp to see the full "submit_mcp_server" schema, including the exact allowed category values and other enums — then POST {"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"submit_mcp_server","arguments":{...}}} to the same URL with as many fields as you can confidently determine from the repo: name, url, description, category, email (required), plus optional enrichment like tags, license, authType, pricingModel, maintenanceStatus, compatibleClients, supportUrl, suggestedInstallCommand, and suggestedInstallArgs. Only include a field if you're confident about it — leave uncertain ones out. If you can't make MCP tool calls, POST the same field names as flat JSON to https://allmcps.com/api/v1/submit instead (GET https://allmcps.com/api/v1/categories first for the valid category list).`;

  const tags = useMemo(
    () =>
      tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    [tagsInput],
  );

  // Inline validation — only surfaced once a field is blurred or the visitor
  // tries to submit, so nobody is scolded mid-keystroke.
  const primaryLink = (url || websiteUrl).trim();
  const errors: Partial<Record<Field, string>> = {
    url: !primaryLink
      ? 'Add a repository or website URL'
      : url.trim() && !isHttpUrl(url)
        ? 'Enter a full URL starting with https://'
        : undefined,
    name: name.trim() ? undefined : 'Give your server a name',
    email: !email.trim()
      ? 'We need an email for review updates'
      : EMAIL_RE.test(email.trim())
        ? undefined
        : 'That email doesn’t look right',
    description: description.trim()
      ? undefined
      : 'Describe what the server does in a sentence',
    websiteUrl:
      websiteUrl.trim() && !isHttpUrl(websiteUrl)
        ? 'Enter a full URL starting with https://'
        : undefined,
  };
  const showError = (f: Field) =>
    (touched[f] || attempted) && errors[f] ? errors[f] : undefined;
  const touch = (f: Field) => setTouched((t) => ({ ...t, [f]: true }));

  const sourceDone = !errors.url;
  const detailsDone =
    !errors.name && !errors.email && !errors.description && !errors.websiteUrl;
  const steps = [
    { label: 'Source', done: sourceDone },
    { label: 'Details', done: detailsDone },
    { label: 'Submit', done: sourceDone && detailsDone && Boolean(token) },
  ];
  const requiredDone = [
    sourceDone,
    !errors.name,
    !errors.email,
    !errors.description,
    Boolean(token),
  ].filter(Boolean).length;
  const progress = Math.round((requiredDone / 5) * 100);

  const urlKind = !url.trim()
    ? null
    : isGitHubRepoUrl(url)
      ? 'github'
      : isRepositoryUrl(url)
        ? 'repo'
        : isHttpUrl(url)
          ? 'website'
          : null;

  const copyAgentPrompt = async () => {
    try {
      await navigator.clipboard.writeText(agentPromptText);
      toast.success('AI agent prompt copied', {
        description:
          'Paste it in Cursor, Claude Code, or Windsurf inside your repo.',
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
    setDuplicateMatch(null);
    try {
      const res = await fetch('/api/submit/prefill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: fromUrl.trim() }),
      });
      const data = (await res.json()) as {
        error?: string;
        duplicate?: boolean;
        existing?: { id: string; name: string; status: string };
        name?: string;
        description?: string;
        url?: string;
        websiteUrl?: string;
        category?: string;
        pricingModel?: string;
        authType?: string;
        license?: string;
        maintenanceStatus?: string;
        source?: string;
        llmEnriched?: boolean;
      };
      if (!res.ok) throw new Error(data.error || 'Prefill failed');

      if (data.duplicate && data.existing) {
        setDuplicateMatch(data.existing);
        return;
      }

      if (data.name) setName(data.name);
      if (data.description) setDescription(data.description);
      if (data.url) setUrl(data.url);
      if (data.websiteUrl) setWebsiteUrl(data.websiteUrl);
      else if (data.source === 'website') setWebsiteUrl(fromUrl.trim());
      if (data.category) setCategory(data.category);
      if (data.pricingModel) setPricingModel(data.pricingModel);
      if (data.authType) setAuthType(data.authType);
      if (data.license) setLicense(data.license);
      if (data.maintenanceStatus) setMaintenanceStatus(data.maintenanceStatus);
      setPrefilledFrom(
        data.llmEnriched
          ? 'Prefilled with AI from your repo — check it over.'
          : data.source === 'github'
            ? 'Prefilled from GitHub repository metadata.'
            : 'Prefilled from the website title and meta tags.',
      );

      toast.success('Details prefilled', {
        description: data.llmEnriched
          ? 'Enriched with AI (falls back if the model budget is hit).'
          : data.source === 'github'
            ? 'From GitHub repository metadata.'
            : 'From the website title and meta tags.',
      });
    } catch (e: any) {
      toast.error('Prefill failed', {
        description: e?.message || 'Enter fields manually.',
      });
    } finally {
      setPrefillLoading(false);
    }
  };

  // Smart default: pasting a link into an empty form prefills it right away.
  const handleUrlPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').trim();
    if (!isHttpUrl(pasted) || name.trim() || description.trim()) return;
    e.preventDefault();
    setUrl(pasted);
    setDuplicateMatch(null);
    touch('url');
    void runPrefill(pasted);
  };

  // Since we stopped inferring an endpoint from a bare homepage, a remote-only
  // server has no working install path unless the submitter tells us the
  // endpoint — so ask, instead of silently listing something uninstallable.
  const looksRemoteWithoutEndpoint =
    primaryLink.length > 0 &&
    !isRepositoryUrl(primaryLink) &&
    !remoteEndpointUrl.trim();

  const resetForm = () => {
    setStatus('idle');
    setSubmittedId(null);
    setToken('');
    setName('');
    setUrl('');
    setWebsiteUrl('');
    setDescription('');
    setCategory(DEFAULT_SUBMIT_CATEGORY);
    setTagsInput('');
    setPricingModel('');
    setPricingNotes('');
    setAuthType('');
    setLicense('');
    setCompatibleClients([]);
    setMaintenanceStatus('');
    setSupportUrl('');
    setRemoteEndpointUrl('');
    setSuggestedInstallCommand('');
    setSuggestedInstallArgsInput('');
    setPrefilledFrom(null);
    setDuplicateMatch(null);
    setTouched({});
    setAttempted(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAttempted(true);

    const firstInvalid = (
      ['url', 'name', 'email', 'description', 'websiteUrl'] as Field[]
    ).find((f) => errors[f]);
    if (firstInvalid) {
      const el = formRef.current?.querySelector<HTMLElement>(
        `[data-field="${firstInvalid}"]`,
      );
      el?.focus();
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      toast.error('A few details are missing', {
        description: errors[firstInvalid],
      });
      return;
    }

    if (!token) {
      toast.error('Complete the security check', {
        description: 'Please finish the Turnstile challenge before submitting.',
      });
      return;
    }

    setStatus('loading');
    const formData = new FormData(e.currentTarget);
    const data: Record<string, unknown> = Object.fromEntries(
      formData.entries(),
    );
    data['cf-turnstile-response'] = token;
    data.name = name;
    data.email = email;
    data.url = url.trim() || websiteUrl.trim();
    data.websiteUrl = websiteUrl;
    data.description = description;
    data.category = category;
    data.tags = tags;
    data.pricingModel = pricingModel || undefined;
    data.pricingNotes = pricingNotes || undefined;
    data.authType = authType || undefined;
    data.license = license || undefined;
    data.compatibleClients = compatibleClients;
    data.maintenanceStatus = maintenanceStatus || undefined;
    data.supportUrl = supportUrl || undefined;
    data.remoteEndpointUrl = remoteEndpointUrl || undefined;
    data.suggestedInstallCommand = suggestedInstallCommand || undefined;
    data.suggestedInstallArgs = suggestedInstallArgsInput
      .split(/\s+/)
      .map((a) => a.trim())
      .filter(Boolean);
    data.newsletterOptIn = newsletterOptIn;

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          id?: string;
        } | null;
        setSubmittedId(payload?.id || null);
        setStatus('success');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        trackSubmitLead({
          serverName: name,
          category: (data.category as string) || DEFAULT_SUBMIT_CATEGORY,
          url: url || websiteUrl,
        });
        toast.success('Server submitted', {
          description: 'Your listing is pending review.',
        });
      } else {
        const errorData = (await res.json().catch(() => null)) as {
          error?: unknown;
          duplicate?: boolean;
          existing?: { id: string; name: string; status: string };
        } | null;
        const serverError = errorData?.error
          ? typeof errorData.error === 'string'
            ? errorData.error
            : JSON.stringify(errorData.error)
          : 'Submission failed.';
        setStatus('error');
        // The route deliberately re-checks for duplicates here as a safety net
        // for anyone who skipped prefill or edited the URL afterwards — show
        // them the same View/Claim card prefill does, not just a toast.
        if (errorData?.duplicate && errorData.existing) {
          setDuplicateMatch(errorData.existing);
          formRef.current
            ?.querySelector('[data-field="url"]')
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          toast.error('Submission failed', { description: serverError });
        }
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
      <SubmitSuccess
        name={name}
        submittedId={submittedId}
        isGithub={isGitHubRepoUrl(url)}
        onSubmitAnother={resetForm}
      />
    );
  }

  const descLen = description.trim().length;
  const preview = (
    <SubmitPreview
      name={name}
      description={description}
      category={category}
      url={primaryLink}
      tags={tags}
    />
  );

  return (
    <div className="acct-submit">
      <div className="acct-submit-main">
        <div className="acct-progress">
          <ol className="acct-progress-steps" aria-label="Submission progress">
            {steps.map((s, i) => {
              const current = !s.done && steps.slice(0, i).every((p) => p.done);
              return (
                <li
                  key={s.label}
                  className={`hue-${STEP_HUES[i]}${s.done ? ' is-done' : ''}${current ? ' is-current' : ''}`}
                  aria-current={current ? 'step' : undefined}
                >
                  <span className="acct-progress-dot" aria-hidden="true">
                    {s.done ? <Check size={12} strokeWidth={3} /> : i + 1}
                  </span>
                  {s.label}
                </li>
              );
            })}
          </ol>
          <div
            className="acct-progress-bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label="Required fields complete"
          >
            <span style={{ transform: `scaleX(${progress / 100})` }} />
          </div>
        </div>

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="acct-submit-form"
          noValidate
        >
          {/* ── Step 1 ─────────────────────────────────────────────── */}
          <section
            className={`acct-step hue-${STEP_HUES[0]}${sourceDone ? ' is-done' : ''}`}
            aria-labelledby="submit-step-1"
          >
            <header className="acct-step-head">
              <span className="acct-step-n" aria-hidden="true">
                {sourceDone ? <Check size={14} strokeWidth={3} /> : '1'}
              </span>
              <div>
                <h2 id="submit-step-1">Where does it live?</h2>
                <p>
                  Paste a GitHub repo or product site — we&apos;ll fill in the
                  rest for you.
                </p>
              </div>
            </header>

            <div className="form-field">
              <label htmlFor="submit-url" className="form-label">
                Repository or website URL
              </label>
              <div
                className={`acct-url-group${showError('url') ? ' is-error' : ''}`}
              >
                <span className="acct-url-icon" aria-hidden="true">
                  {urlKind === 'github' ? (
                    <FolderGit2 size={16} />
                  ) : urlKind === 'website' ? (
                    <Globe size={16} />
                  ) : (
                    <Link2 size={16} />
                  )}
                </span>
                <input
                  id="submit-url"
                  data-field="url"
                  name="url"
                  type="url"
                  inputMode="url"
                  className="acct-url-input"
                  placeholder="https://github.com/owner/repo"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setDuplicateMatch(null);
                  }}
                  onPaste={handleUrlPaste}
                  onBlur={() => touch('url')}
                  autoComplete="url"
                  aria-invalid={Boolean(showError('url')) || undefined}
                  aria-describedby="submit-url-hint"
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm acct-url-prefill"
                  disabled={prefillLoading || !primaryLink}
                  onClick={() => runPrefill(url || websiteUrl)}
                >
                  {prefillLoading ? (
                    <Loader2
                      size={14}
                      className="acct-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Sparkles size={14} aria-hidden="true" />
                  )}
                  {prefillLoading ? 'Fetching…' : 'Prefill'}
                </button>
              </div>
              <p
                id="submit-url-hint"
                className={`acct-field-hint${showError('url') ? ' is-error' : ''}`}
              >
                {showError('url')
                  ? showError('url')
                  : prefilledFrom
                    ? prefilledFrom
                    : urlKind === 'github'
                      ? 'GitHub repo detected — Prefill pulls name, description and category.'
                      : urlKind === 'website'
                        ? 'Website detected — we’ll read its title and meta tags.'
                        : 'Tip: paste a link and we’ll prefill the form automatically.'}
              </p>
            </div>

            {duplicateMatch?.status === 'withdrawn' && (
              <div role="alert" className="acct-callout acct-callout--warn">
                <AlertTriangle size={18} aria-hidden="true" />
                <div>
                  <p className="acct-callout-title">
                    This server can&rsquo;t be listed
                  </p>
                  <p className="acct-callout-body">
                    &ldquo;{duplicateMatch.name}&rdquo; was withdrawn from the
                    directory at its owner&rsquo;s request.
                  </p>
                </div>
              </div>
            )}
            {duplicateMatch && duplicateMatch.status !== 'withdrawn' && (
              <div role="alert" className="acct-callout acct-callout--warn">
                <AlertTriangle size={18} aria-hidden="true" />
                <div>
                  <p className="acct-callout-title">
                    This server is already listed
                  </p>
                  <p className="acct-callout-body">
                    &ldquo;{duplicateMatch.name}&rdquo; is already in the
                    directory
                    {duplicateMatch.status === 'removed'
                      ? ' — our automated checks marked it offline. If this is your project and it works again, claim it to fix the link instead of creating a new listing.'
                      : duplicateMatch.status === 'pending'
                        ? ' and is currently awaiting review.'
                        : '.'}
                  </p>
                  <div className="acct-callout-actions">
                    <Link
                      href={`/mcp/${duplicateMatch.id}/claim`}
                      className="btn btn-primary btn-sm"
                    >
                      Claim this listing
                    </Link>
                    <Link
                      href={`/mcp/${duplicateMatch.id}`}
                      className="btn btn-secondary btn-sm"
                    >
                      View listing
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* ── Step 2 ─────────────────────────────────────────────── */}
          <section
            className={`acct-step hue-${STEP_HUES[1]}${detailsDone ? ' is-done' : ''}`}
            aria-labelledby="submit-step-2"
          >
            <header className="acct-step-head">
              <span className="acct-step-n" aria-hidden="true">
                {detailsDone ? <Check size={14} strokeWidth={3} /> : '2'}
              </span>
              <div>
                <h2 id="submit-step-2">Listing details</h2>
                <p>How your server appears in the directory.</p>
              </div>
            </header>

            <div className="acct-grid-2">
              <Input
                id="submit-name"
                data-field="name"
                name="name"
                label="Server name"
                placeholder="e.g. GitHub MCP"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => touch('name')}
                error={Boolean(showError('name'))}
                helperText={showError('name')}
                required
              />
              <div className="form-field">
                <label htmlFor="submit-category" className="form-label">
                  Category
                </label>
                <div className="acct-select">
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
              </div>
            </div>

            <div className="form-field">
              <div className="acct-label-row">
                <label htmlFor="submit-description" className="form-label">
                  Short description
                </label>
                <span
                  className={`acct-counter tabular${
                    descLen > DESCRIPTION_SWEET_SPOT.max ? ' is-over' : ''
                  }`}
                  aria-hidden="true"
                >
                  {descLen}
                </span>
              </div>
              <textarea
                id="submit-description"
                data-field="description"
                name="description"
                className={`form-input acct-textarea${showError('description') ? ' form-input-error' : ''}`}
                rows={3}
                placeholder="What tools or capabilities does this server give AI agents?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => touch('description')}
                aria-invalid={Boolean(showError('description')) || undefined}
                aria-describedby="submit-description-hint"
                required
              />
              <p
                id="submit-description-hint"
                className={`acct-field-hint${showError('description') ? ' is-error' : ''}`}
              >
                {showError('description') ??
                  (descLen === 0
                    ? `One or two sentences — ${DESCRIPTION_SWEET_SPOT.min}–${DESCRIPTION_SWEET_SPOT.max} characters reads best on cards.`
                    : descLen < DESCRIPTION_SWEET_SPOT.min
                      ? 'A little more detail helps people (and AI search) find it.'
                      : descLen > DESCRIPTION_SWEET_SPOT.max
                        ? 'Long descriptions get cut off on cards — lead with the key point.'
                        : 'Nice — that length reads well on directory cards.')}
              </p>
            </div>

            <div className="acct-grid-2">
              <Input
                id="submit-email"
                data-field="email"
                name="email"
                label="Contact email"
                placeholder="you@example.com"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => touch('email')}
                autoComplete="email"
                inputMode="email"
                error={Boolean(showError('email'))}
                helperText={
                  showError('email') ??
                  'For review status and your claim link. Never sold.'
                }
              />
              <Input
                id="submit-website"
                data-field="websiteUrl"
                name="websiteUrl"
                label="Website (optional)"
                placeholder="https://yoursite.com"
                type="url"
                inputMode="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                onBlur={() => touch('websiteUrl')}
                error={Boolean(showError('websiteUrl'))}
                helperText={
                  showError('websiteUrl') ?? (
                    <>
                      Verified owners get a <strong>dofollow</strong> link.
                    </>
                  )
                }
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

            <details className="acct-disclosure">
              <summary>
                <span>
                  <strong>Add more detail</strong>
                  <span className="acct-disclosure-sub">
                    Pricing, auth, license, clients, install hints — all
                    optional
                  </span>
                </span>
                <ChevronDown size={16} aria-hidden="true" />
              </summary>
              <div className="acct-disclosure-body">
                <Input
                  id="submit-tags"
                  name="tagsInputRaw"
                  label="Tags"
                  placeholder="e.g. sql, database, read-only"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  helperText="Comma-separated, up to 5."
                />

                <ChipChoice
                  label="Pricing"
                  options={PRICING_MODELS}
                  labels={PRICING_MODEL_LABELS}
                  value={pricingModel}
                  onChange={setPricingModel}
                />

                {pricingModel && pricingModel !== 'free' && (
                  <Input
                    id="submit-pricing-notes"
                    name="pricingNotesInputRaw"
                    label="Pricing notes (optional)"
                    placeholder="e.g. Free tier: 100 req/day, then $0.01/req"
                    value={pricingNotes}
                    onChange={(e) => setPricingNotes(e.target.value)}
                  />
                )}

                <ChipChoice
                  label="Auth required"
                  options={AUTH_TYPES}
                  labels={AUTH_TYPE_LABELS}
                  value={authType}
                  onChange={setAuthType}
                />

                <ChipChoice
                  label="Maintenance status"
                  options={MAINTENANCE_STATUSES}
                  labels={MAINTENANCE_STATUS_LABELS}
                  value={maintenanceStatus}
                  onChange={setMaintenanceStatus}
                />

                <fieldset className="acct-fieldset">
                  <legend className="form-label">Compatible clients</legend>
                  <div className="acct-chip-row">
                    {MCP_CLIENTS.map((c) => {
                      const checked = compatibleClients.includes(c.slug);
                      return (
                        <button
                          key={c.slug}
                          type="button"
                          className="chip"
                          aria-pressed={checked}
                          onClick={() =>
                            setCompatibleClients((prev) =>
                              checked
                                ? prev.filter((s) => s !== c.slug)
                                : [...prev, c.slug],
                            )
                          }
                        >
                          {checked ? (
                            <Check
                              size={12}
                              strokeWidth={3}
                              aria-hidden="true"
                            />
                          ) : null}
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <div className="acct-grid-2">
                  <Input
                    id="submit-license"
                    name="licenseInputRaw"
                    label="License"
                    placeholder="e.g. MIT"
                    value={license}
                    onChange={(e) => setLicense(e.target.value)}
                  />
                  <Input
                    id="submit-support"
                    name="supportUrlInputRaw"
                    label="Support / community link"
                    placeholder="https://discord.gg/…"
                    type="url"
                    value={supportUrl}
                    onChange={(e) => setSupportUrl(e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <Input
                    id="submit-endpoint"
                    name="remoteEndpointUrlInputRaw"
                    label="Hosted MCP endpoint"
                    placeholder="https://your-server.com/mcp"
                    type="url"
                    value={remoteEndpointUrl}
                    onChange={(e) => setRemoteEndpointUrl(e.target.value)}
                    helperText="If you offer a live remote endpoint, we’ll verify it directly instead of guessing tools from your README."
                  />
                  {looksRemoteWithoutEndpoint && (
                    <p className="acct-callout acct-callout--info acct-callout--compact">
                      The link you gave isn&rsquo;t a source repository, so this
                      looks like a hosted service. If it&rsquo;s a remote MCP
                      server, add its endpoint here — without it we can&rsquo;t
                      generate working install buttons, and we won&rsquo;t guess
                      one from your homepage.
                    </p>
                  )}
                </div>

                <div className="acct-grid-2">
                  <Input
                    id="submit-install-cmd"
                    name="suggestedInstallCommandInputRaw"
                    label="Install command"
                    placeholder="e.g. npx"
                    value={suggestedInstallCommand}
                    onChange={(e) => setSuggestedInstallCommand(e.target.value)}
                  />
                  <Input
                    id="submit-install-args"
                    name="suggestedInstallArgsInputRaw"
                    label="Install args (space-separated)"
                    placeholder="e.g. -y @scope/package"
                    value={suggestedInstallArgsInput}
                    onChange={(e) =>
                      setSuggestedInstallArgsInput(e.target.value)
                    }
                  />
                </div>
                <p className="acct-field-hint">
                  Only used as a hint if we can&apos;t detect an install command
                  automatically — reviewers can still correct it.
                </p>
              </div>
            </details>
          </section>

          {/* ── Step 3 ─────────────────────────────────────────────── */}
          <section
            className={`acct-step hue-${STEP_HUES[2]}`}
            aria-labelledby="submit-step-3"
          >
            <header className="acct-step-head">
              <span className="acct-step-n" aria-hidden="true">
                3
              </span>
              <div>
                <h2 id="submit-step-3">Review &amp; submit</h2>
                <p>One quick security check and you&apos;re in the queue.</p>
              </div>
            </header>

            <div className="acct-submit-mobile-preview">{preview}</div>

            <TurnstileWidget
              onSuccess={setToken}
              onExpire={() => setToken('')}
              onError={() => setToken('')}
            />

            <div className="acct-submit-foot">
              <Button
                variant="primary"
                type="submit"
                disabled={status === 'loading'}
                size="lg"
                className="acct-submit-btn"
              >
                {status === 'loading' ? (
                  <>
                    <Loader2
                      size={16}
                      className="acct-spin"
                      aria-hidden="true"
                    />
                    Submitting…
                  </>
                ) : (
                  'Submit for review'
                )}
              </Button>
              <p className="acct-field-hint">
                Listing is free. By submitting you agree to our{' '}
                <Link href="/terms" className="acct-inline-link">
                  Terms
                </Link>
                .
              </p>
            </div>
          </section>
        </form>
      </div>

      <aside className="acct-submit-aside" aria-label="Listing preview">
        <div className="acct-submit-aside-inner">
          <p className="acct-aside-label">Live preview</p>
          {preview}

          <div className="acct-aside-card">
            <h3>What happens next</h3>
            <ol className="acct-mini-steps">
              <li>We review your listing (free, in queue).</li>
              <li>You get an approval email with a claim link.</li>
              <li>Claim it to edit details and earn a dofollow link.</li>
            </ol>
          </div>

          <div className="acct-aside-card acct-agent-card">
            <div className="acct-agent-head">
              <Bot size={16} aria-hidden="true" />
              <h3>Let your agent do it</h3>
            </div>
            <p>
              Copy a prompt for Cursor, Claude Code or Windsurf and run it in
              your repo — it submits via our MCP server.
            </p>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={copyAgentPrompt}
            >
              Copy agent prompt
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
