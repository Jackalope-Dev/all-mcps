'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { ExternalLink, Copy, Cloud } from 'lucide-react';
import { toast } from '../../../../components/ui/Toast';
import { getClaimVerificationToken } from '../../../../lib/verificationTokens';
import { getApexDomain, getDnsProviderLinks } from '../../../../lib/dnsProviders';

type ClaimMethod = 'github' | 'website_badge' | 'dns';

export default function ClaimClient({
  serverId,
  serverName,
  repoUrl,
  websiteUrl: initialWebsite,
  isOfficial,
  websiteVerified,
  userId,
}: {
  serverId: string;
  serverName: string;
  repoUrl: string;
  websiteUrl?: string | null;
  isOfficial?: boolean;
  websiteVerified?: boolean;
  userId: string | null;
}) {
  const isSignedIn = !!userId;
  const [method, setMethod] = useState<ClaimMethod>(
    repoUrl.includes('github.com') ? 'github' : 'website_badge'
  );
  const [websiteUrl, setWebsiteUrl] = useState(initialWebsite || '');
  const [loading, setLoading] = useState(false);
  const [attachLoading, setAttachLoading] = useState(false);
  const [cfLoading, setCfLoading] = useState(false);
  const [cfToken, setCfToken] = useState('');
  const [showCfToken, setShowCfToken] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [claimed, setClaimed] = useState(!!isOfficial);
  const [siteVerified, setSiteVerified] = useState(!!websiteVerified);
  const [badgeTheme, setBadgeTheme] = useState<'dark' | 'light'>('dark');
  const [badgeStyle, setBadgeStyle] = useState<'shield' | 'flat-square' | 'featured' | 'directory'>('shield');
  const [badgeMetric, setBadgeMetric] = useState<'status' | 'upvotes' | 'views' | 'installs'>('status');

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://allmcps.com';
  const personalizedToken = useMemo(
    () => (userId ? getClaimVerificationToken(serverId, userId) : null),
    [serverId, userId]
  );
  const dnsValue = personalizedToken ?? '';
  const apexDomain = useMemo(() => getApexDomain(websiteUrl.trim()), [websiteUrl]);
  const providerLinks = useMemo(() => getDnsProviderLinks(apexDomain), [apexDomain]);

  const queryParams = new URLSearchParams();
  if (badgeStyle !== 'shield') queryParams.set('style', badgeStyle);
  if (badgeMetric !== 'status') queryParams.set('metric', badgeMetric);
  if (badgeTheme !== 'dark') queryParams.set('theme', badgeTheme);

  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
  const badgeSrc = `${baseUrl}/api/badge/${serverId}${queryString}`;
  const badgeHeight = badgeStyle === 'directory' ? 40 : badgeStyle === 'featured' ? 32 : 20;

  const badgeMarkdown = `[![AllMCPs](${badgeSrc})](${baseUrl}/mcp/${serverId})`;
  const badgeHtml = `<a href="${baseUrl}/mcp/${serverId}"><img src="${badgeSrc}" alt="AllMCPs" height="${badgeHeight}" /></a>`;
  const metaTag = personalizedToken ? `<meta name="allmcps-verification" content="${personalizedToken}" />` : '';
  // The link (not the badge image) carries the `verify` token — it's what
  // proves *this* signed-in account added the badge, not just that a generic
  // AllMCPs link exists somewhere in the README (see readmeContainsClaimBadge).
  const githubVerifyMarkdown = userId
    ? `[![AllMCPs Verified](${badgeSrc})](${baseUrl}/mcp/${serverId}?verify=${userId})`
    : null;
  const signInHref = `/login?callbackUrl=${encodeURIComponent(`/mcp/${serverId}/claim`)}`;

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Could not copy', { description: 'Select the text and copy it manually.' });
    }
  };

  const agentClaimPromptText = `Read this repository's README.md. Embed the following AllMCPs verification badge into README.md:

${badgeMarkdown}

Then commit and push your changes to GitHub. Once pushed, call the verification API to claim ownership of "${serverId}" on AllMCPs.com!`;

  const copyAgentClaimPrompt = async () => {
    try {
      await navigator.clipboard.writeText(agentClaimPromptText);
      toast.success('AI Agent Claim Prompt Copied!', {
        description: 'Paste this prompt in Cursor, Claude Code, Windsurf, or Antigravity inside your project repo.',
      });
    } catch {
      toast.error('Could not copy automatically.');
    }
  };

  const handleVerify = async () => {
    if (!isSignedIn) {
      window.location.href = signInHref;
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: serverId,
          method,
          websiteUrl: websiteUrl.trim() || undefined,
        }),
      });

      const data = (await res.json()) as { error?: string; message?: string; pending?: boolean };

      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Verification failed');
      }

      if (data.pending) {
        toast.success('Submitted for review', {
          description: data.message || "We'll email you once an admin approves it.",
        });
      } else {
        setSuccess(true);
        setClaimed(true);
        if (method === 'website_badge' || method === 'dns') {
          setSiteVerified(true);
        }
        toast.success('Claim successful', {
          description: data.message || 'Your listing is now verified.',
        });
      }
    } catch (err: any) {
      const message = err?.message || 'Verification failed';
      setError(message);
      toast.error('Verification failed', { description: message });
    } finally {
      setLoading(false);
    }
  };

  const handleAttachWebsite = async () => {
    if (!isSignedIn) {
      window.location.href = signInHref;
      return;
    }
    if (!websiteUrl.trim()) {
      toast.error('Enter a website URL');
      return;
    }
    setAttachLoading(true);
    setError('');
    try {
      const res = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: serverId,
          method: 'attach_website',
          websiteUrl: websiteUrl.trim(),
        }),
      });
      const data = (await res.json()) as { error?: string; message?: string; websiteVerified?: boolean };
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Could not save website');
      }
      setSiteVerified(!!data.websiteVerified);
      toast.success('Website saved', {
        description: data.message || 'Verify with badge or DNS when ready.',
      });
    } catch (err: any) {
      const message = err?.message || 'Could not save website';
      setError(message);
      toast.error('Save failed', { description: message });
    } finally {
      setAttachLoading(false);
    }
  };

  const handleCloudflareOneClick = async () => {
    if (!websiteUrl.trim()) {
      toast.error('Enter your website URL first');
      return;
    }
    if (!cfToken.trim()) {
      toast.error('Paste a Cloudflare API token', {
        description: 'Zone:DNS:Edit + Zone:Zone:Read for this domain.',
      });
      setShowCfToken(true);
      return;
    }

    setCfLoading(true);
    setError('');
    try {
      const res = await fetch('/api/claim/dns/cloudflare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverId,
          websiteUrl: websiteUrl.trim(),
          apiToken: cfToken.trim(),
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        hint?: string;
        message?: string;
        success?: boolean;
      };

      if (!res.ok) {
        throw new Error(
          [data.error, data.hint].filter(Boolean).join(' ') || 'Cloudflare request failed'
        );
      }

      // Clear token from memory after use
      setCfToken('');
      toast.success('DNS record ready', {
        description: data.message || 'You can verify now.',
      });
    } catch (err: any) {
      const message = err?.message || 'Cloudflare setup failed';
      setError(message);
      toast.error('Could not add DNS via Cloudflare', { description: message });
    } finally {
      setCfLoading(false);
    }
  };

  if (success) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '3rem',
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
        }}
      >
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
        <h2 style={{ marginBottom: '1rem', color: '#10b981' }}>Claim Successful!</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.55 }}>
          This listing is now marked as verified. If you attached a website, it is marked verified too.
        </p>
        <p
          style={{
            color: 'var(--text-secondary)',
            marginBottom: '1.5rem',
            lineHeight: 1.55,
            fontSize: '0.9rem',
            padding: '0.85rem 1rem',
            borderRadius: 8,
            background: 'rgba(16,185,129,0.08)',
            border: '1px solid rgba(16,185,129,0.25)',
            textAlign: 'left',
          }}
        >
          <strong style={{ color: '#34d399' }}>Free dofollow backlink:</strong> keep a dofollow AllMCPs
          badge on your product site or README. We recheck it on health runs — when it&apos;s live, your
          website link on AllMCPs becomes dofollow. Premium skips the badge requirement.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center' }}>
          <Link
            href={`/mcp/${serverId}`}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'var(--accent-color)',
              color: 'var(--bg-color)',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: 'bold',
            }}
          >
            View listing
          </Link>
          <Link
            href="/badge-generator"
            style={{
              padding: '0.75rem 1.5rem',
              border: '1px solid var(--border-color)',
              background: 'rgba(255,255,255,0.05)',
              color: 'var(--text-primary)',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Get badge code
          </Link>
          <Link
            href="/dashboard"
            style={{
              padding: '0.75rem 1.5rem',
              border: '1px solid var(--border-color)',
              background: 'rgba(255,255,255,0.05)',
              color: 'var(--text-primary)',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Open dashboard
          </Link>
        </div>
      </div>
    );
  }

  const hasGithub = repoUrl.includes('github.com');
  const methods: { id: ClaimMethod; label: string; hint: string }[] = [
    ...(hasGithub
      ? [
          {
            id: 'github' as ClaimMethod,
            label: 'GitHub README Badge',
            hint: 'Recommended for GitHub repos. Adding a badge to your README.md proves write access for instant verification.',
          },
        ]
      : []),
    {
      id: 'website_badge' as ClaimMethod,
      label: 'Website Badge / Meta Tag',
      hint: 'Recommended for websites. Embed a dynamic badge or HTML verification tag on your domain.',
    },
    {
      id: 'dns' as ClaimMethod,
      label: 'DNS TXT Record',
      hint: 'Add a TXT record to your domain DNS settings to prove domain ownership.',
    },
  ];

  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '2rem' }}>
      <h2 style={{ marginBottom: '0.5rem' }}>{claimed ? 'Manage' : 'Claim'} {serverName}</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.6' }}>
        {claimed
          ? 'This listing is verified. Attach or update your website, then prove control with a badge or DNS if you have not already.'
          : 'Prove you own this project to get the Verified badge and unlock owner management.'}
        {siteVerified ? ' Website is verified.' : claimed && websiteUrl ? ' Website not verified yet.' : ''}
      </p>

      <div
        style={{
          background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%)',
          border: '1px solid rgba(0, 229, 255, 0.3)',
          borderRadius: '12px',
          padding: '1.25rem',
          marginBottom: '1.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: '#00E5FF', fontSize: '0.95rem' }}>
            <span style={{ fontSize: '1.25rem' }}>🤖</span>
            <span>Have an AI Agent claim &amp; verify this server for you!</span>
          </div>
          <button
            type="button"
            onClick={copyAgentClaimPrompt}
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
            📋 Copy Agent Claim Prompt
          </button>
        </div>
        <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Paste this prompt into <strong>Cursor</strong>, <strong>Claude Code</strong>, <strong>Windsurf</strong>, or <strong>Antigravity</strong> inside your MCP project repository. Your agent will add the badge, commit/push, and verify ownership automatically!
        </p>
      </div>

      {claimed && (
        <div
          style={{
            marginBottom: '1.75rem',
            padding: '1.1rem',
            borderRadius: '12px',
            border: '1px solid rgba(0,229,255,0.25)',
            background: 'rgba(0,229,255,0.05)',
          }}
        >
          <h3 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>Website on this listing</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
            Free listings show this URL with nofollow; premium gets dofollow. Saving does not require re-claiming.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'stretch' }}>
            <input
              type="url"
              className="form-input"
              placeholder="https://yoursite.com"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              style={{ flex: '1 1 220px', margin: 0 }}
            />
            <button
              type="button"
              className="btn btn-primary"
              disabled={attachLoading}
              onClick={handleAttachWebsite}
              style={{ padding: '0.65rem 1rem', fontSize: '0.85rem', opacity: attachLoading ? 0.7 : 1 }}
            >
              {attachLoading ? 'Saving…' : 'Save website'}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.75rem' }}>
        {methods.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMethod(m.id)}
            className={`directory-segmented-btn ${method === m.id ? 'is-active' : ''}`}
            style={{
              padding: '0.55rem 0.9rem',
              borderRadius: '8px',
              border: method === m.id ? '1px solid rgba(59,130,246,0.5)' : '1px solid var(--border-color)',
              background: method === m.id ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)',
              color: method === m.id ? 'var(--accent-color)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
            }}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
        {methods.find((m) => m.id === method)?.hint}
      </p>

      {(method === 'website_badge' || method === 'dns') && (
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            Website URL
          </label>
          <input
            type="url"
            className="form-input"
            placeholder="https://yoursite.com"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            required
          />
        </div>
      )}

      {method === 'github' && (!isSignedIn ? (
        <SignInGate href={signInHref} />
      ) : (
        <>
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem' }}>1. Add badge to your GitHub README</h3>

            {/* Badge controls for GitHub */}
            <div style={{ marginBottom: '0.6rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Style:</span>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {[
                  { id: 'shield', label: 'Standard (20px)' },
                  { id: 'flat-square', label: 'Square (20px)' },
                  { id: 'featured', label: 'Featured Banner (32px)' },
                  { id: 'directory', label: 'Directory Card (40px)' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setBadgeStyle(s.id as any)}
                    style={{
                      padding: '0.3rem 0.65rem',
                      borderRadius: '999px',
                      border: '1px solid var(--border-color)',
                      background: badgeStyle === s.id ? 'rgba(59,130,246,0.15)' : 'transparent',
                      color: badgeStyle === s.id ? 'var(--accent-color)' : 'var(--text-primary)',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Displayed Metric:</span>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {[
                  { id: 'status', label: 'Status' },
                  { id: 'upvotes', label: 'Upvotes' },
                  { id: 'views', label: 'Views' },
                  { id: 'installs', label: 'Installs' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setBadgeMetric(m.id as any)}
                    style={{
                      padding: '0.3rem 0.65rem',
                      borderRadius: '999px',
                      border: '1px solid var(--border-color)',
                      background: badgeMetric === m.id ? 'rgba(59,130,246,0.15)' : 'transparent',
                      color: badgeMetric === m.id ? 'var(--accent-color)' : 'var(--text-primary)',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Theme:</span>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {(['dark', 'light'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setBadgeTheme(t)}
                    style={{
                      padding: '0.3rem 0.65rem',
                      borderRadius: '999px',
                      border: '1px solid var(--border-color)',
                      background: badgeTheme === t ? 'rgba(59,130,246,0.15)' : 'transparent',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                    }}
                  >
                    {t === 'dark' ? 'Dark' : 'Light'}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
              <pre
                style={{
                  background: 'rgba(0,0,0,0.5)',
                  padding: '1rem',
                  borderRadius: '8px',
                  overflowX: 'auto',
                  border: '1px solid var(--border-color)',
                  color: '#10b981',
                  fontSize: '0.8rem',
                }}
              >
                <code>{githubVerifyMarkdown}</code>
              </pre>
              <button
                type="button"
                onClick={() => copyText(githubVerifyMarkdown || '', 'README badge snippet')}
                style={{
                  position: 'absolute',
                  top: '0.5rem',
                  right: '0.5rem',
                  background: 'var(--accent-color)',
                  border: 'none',
                  color: 'var(--bg-color)',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                }}
              >
                Copy Markdown
              </button>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
              This link includes your account — it's what ties the claim to you, not just the badge image.
            </p>

            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                background: badgeTheme === 'light' ? '#f1f5f9' : '#0a0a0a',
                border: '1px solid var(--border-color)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Badge Preview:</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={badgeSrc} alt="GitHub badge preview" height={badgeHeight} />
            </div>
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>2. Target Repository</h3>
            <a href={repoUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)' }}>
              {repoUrl}
            </a>
          </div>
        </>
      ))}

      {method === 'website_badge' && (!isSignedIn ? (
        <SignInGate href={signInHref} />
      ) : (
        <>
          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem' }}>1. Customize your badge</h3>
            
            {/* Style buttons */}
            <div style={{ marginBottom: '0.6rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Style:</span>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {[
                  { id: 'shield', label: 'Standard (20px)' },
                  { id: 'flat-square', label: 'Square (20px)' },
                  { id: 'featured', label: 'Featured Banner (32px)' },
                  { id: 'directory', label: 'Directory Card (40px)' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setBadgeStyle(s.id as any)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '999px',
                      border: '1px solid var(--border-color)',
                      background: badgeStyle === s.id ? 'rgba(59,130,246,0.15)' : 'transparent',
                      color: badgeStyle === s.id ? 'var(--accent-color)' : 'var(--text-primary)',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Metric buttons */}
            <div style={{ marginBottom: '0.6rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Displayed Metric:</span>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {[
                  { id: 'status', label: 'Status' },
                  { id: 'upvotes', label: 'Upvotes' },
                  { id: 'views', label: 'Views' },
                  { id: 'installs', label: 'Installs' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setBadgeMetric(m.id as any)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '999px',
                      border: '1px solid var(--border-color)',
                      background: badgeMetric === m.id ? 'rgba(59,130,246,0.15)' : 'transparent',
                      color: badgeMetric === m.id ? 'var(--accent-color)' : 'var(--text-primary)',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Theme buttons */}
            <div style={{ marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Theme:</span>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {(['dark', 'light'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setBadgeTheme(t)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '999px',
                      border: '1px solid var(--border-color)',
                      background: badgeTheme === t ? 'rgba(59,130,246,0.15)' : 'transparent',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                    }}
                  >
                    {t === 'dark' ? 'Dark' : 'Light'}
                  </button>
                ))}
              </div>
            </div>

            <div
              style={{
                padding: '1rem',
                borderRadius: '10px',
                background: badgeTheme === 'light' ? '#f1f5f9' : '#0a0a0a',
                border: '1px solid var(--border-color)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '48px',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={badgeSrc} alt="AllMCPs badge preview" height={badgeHeight} />
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{ marginBottom: '0.5rem', fontSize: '0.95rem' }}>Markdown</h3>
            <pre style={codeBoxStyle}>
              <code>{badgeMarkdown}</code>
            </pre>
            <button type="button" className="btn btn-secondary" style={{ marginTop: '0.5rem' }} onClick={() => copyText(badgeMarkdown, 'Markdown badge')}>
              Copy Markdown
            </button>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{ marginBottom: '0.5rem', fontSize: '0.95rem' }}>HTML</h3>
            <pre style={codeBoxStyle}>
              <code>{badgeHtml}</code>
            </pre>
            <button type="button" className="btn btn-secondary" style={{ marginTop: '0.5rem' }} onClick={() => copyText(badgeHtml, 'HTML badge')}>
              Copy HTML
            </button>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem', lineHeight: 1.5 }}>
              This badge links back to AllMCPs <strong>dofollow</strong> — keep it that way (don&apos;t add{' '}
              <code>rel=&quot;nofollow&quot;</code>) and your listing&apos;s website link becomes dofollow in return. We
              re-verify the badge is a live dofollow link on each health check.
            </p>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '0.5rem', fontSize: '0.95rem' }}>Or meta tag (in &lt;head&gt;)</h3>
            <pre style={codeBoxStyle}>
              <code>{metaTag}</code>
            </pre>
            <button type="button" className="btn btn-secondary" style={{ marginTop: '0.5rem' }} onClick={() => copyText(metaTag, 'Meta tag')}>
              Copy meta tag
            </button>
          </div>
        </>
      ))}

      {method === 'dns' && (!isSignedIn ? (
        <SignInGate href={signInHref} />
      ) : (
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>1. Add a DNS TXT record</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem', lineHeight: 1.6 }}>
            Prove you control{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{apexDomain || 'your domain'}</strong> by publishing
            this TXT record. Use one-click for Cloudflare when you can; otherwise open your provider and paste the
            fields below.
          </p>

          {/* Record fields */}
          <div
            style={{
              display: 'grid',
              gap: '0.65rem',
              marginBottom: '1.25rem',
              padding: '1rem',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              background: 'rgba(0,0,0,0.25)',
            }}
          >
            <DnsFieldRow label="Type" value="TXT" onCopy={() => copyText('TXT', 'Type')} />
            <DnsFieldRow
              label="Name"
              value="@"
              hint={apexDomain ? `or ${apexDomain}` : 'apex / root host'}
              onCopy={() => copyText('@', 'Name')}
            />
            <DnsFieldRow label="Content / Value" value={dnsValue} mono onCopy={() => copyText(dnsValue, 'TXT value')} />
            <DnsFieldRow label="TTL" value="Auto / 3600" onCopy={() => copyText('3600', 'TTL')} />
          </div>

          {/* Cloudflare primary path */}
          <div
            style={{
              marginBottom: '1.25rem',
              padding: '1.1rem',
              borderRadius: '12px',
              border: '1px solid rgba(249,115,22,0.35)',
              background: 'linear-gradient(135deg, rgba(249,115,22,0.08), rgba(59,130,246,0.06))',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Cloud size={18} color="#f97316" />
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Cloudflare (recommended)</h4>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.9rem', lineHeight: 1.55 }}>
              Open DNS Records, click <strong>Add record</strong>, paste Type/Name/Content above — or use a scoped API
              token to create the record for you in one click. We never store the token.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: showCfToken ? '0.85rem' : 0 }}>
              <a
                href="https://dash.cloudflare.com/?to=/:account/:zone/dns/records"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  textDecoration: 'none',
                  fontSize: '0.85rem',
                  padding: '0.55rem 0.9rem',
                }}
                onClick={() => {
                  void copyText(dnsValue, 'TXT value');
                  toast.info('TXT value copied', {
                    description: 'Paste it as Content when you add the record in Cloudflare.',
                  });
                }}
              >
                Open Cloudflare DNS <ExternalLink size={14} />
              </a>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.85rem', padding: '0.55rem 0.9rem' }}
                onClick={() => setShowCfToken((v) => !v)}
              >
                {showCfToken ? 'Hide API one-click' : 'One-click with API token'}
              </button>
            </div>

            {showCfToken && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Create a token at{' '}
                  <a
                    href="https://dash.cloudflare.com/profile/api-tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--accent-color)' }}
                  >
                    API Tokens
                  </a>{' '}
                  → Create Token → use template <strong>Edit zone DNS</strong> (or custom: Zone DNS Edit + Zone Read)
                  limited to {apexDomain || 'this domain'}.
                </label>
                <input
                  type="password"
                  className="form-input"
                  autoComplete="off"
                  placeholder="Cloudflare API token"
                  value={cfToken}
                  onChange={(e) => setCfToken(e.target.value)}
                  style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.85rem' }}
                />
                <button
                  type="button"
                  onClick={handleCloudflareOneClick}
                  disabled={cfLoading}
                  className="btn btn-primary"
                  style={{
                    alignSelf: 'flex-start',
                    fontSize: '0.85rem',
                    padding: '0.55rem 0.9rem',
                    opacity: cfLoading ? 0.7 : 1,
                    cursor: cfLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {cfLoading ? 'Adding record…' : 'Add TXT record in Cloudflare'}
                </button>
              </div>
            )}
          </div>

          {/* Other providers */}
          <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.6rem', color: 'var(--text-secondary)' }}>
            Other providers
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {providerLinks
              .filter((p) => p.id !== 'cloudflare')
              .map((p) => (
                <a
                  key={p.id}
                  href={p.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={p.description}
                  onClick={() => {
                    void copyText(dnsValue, 'TXT value');
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.4rem 0.75rem',
                    borderRadius: '999px',
                    border: '1px solid var(--border-color)',
                    background: 'rgba(255,255,255,0.04)',
                    color: 'var(--text-primary)',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    textDecoration: 'none',
                  }}
                >
                  {p.name}
                  <ExternalLink size={12} style={{ opacity: 0.6 }} />
                </a>
              ))}
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', lineHeight: 1.5, margin: 0 }}>
            Clicking a provider copies the TXT value for you. DNS can take a few minutes to propagate — we check apex
            and www.
          </p>
        </div>
      ))}

      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>
          {method === 'github' ? '3' : '2'}. Verify
        </h3>
        <button
          type="button"
          onClick={handleVerify}
          disabled={loading}
          style={{
            width: '100%',
            padding: '1rem',
            background: loading ? '#374151' : 'var(--accent-color)',
            color: loading ? 'white' : 'var(--bg-color)',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 'bold',
            fontSize: '1.05rem',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Verifying...' : claimed ? 'Re-verify ownership' : 'Verify & claim listing'}
        </button>
        {error && (
          <div
            style={{
              marginTop: '1rem',
              padding: '1rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid #ef4444',
              borderRadius: '8px',
              color: '#ef4444',
              fontSize: '0.9rem',
            }}
          >
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>
    </div>
  );
}

function SignInGate({ href }: { href: string }) {
  return (
    <div
      style={{
        padding: '1.5rem',
        textAlign: 'center',
        border: '1px dashed var(--border-color)',
        borderRadius: '12px',
        marginBottom: '1.5rem',
      }}
    >
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
        Sign in to get your personalized verification tag for this method.
      </p>
      <a href={href} className="btn btn-primary" style={{ textDecoration: 'none' }}>
        Sign in
      </a>
    </div>
  );
}

const codeBoxStyle: CSSProperties = {
  background: 'rgba(0,0,0,0.5)',
  padding: '1rem',
  borderRadius: '8px',
  overflowX: 'auto',
  border: '1px solid var(--border-color)',
  color: '#a1a1aa',
  fontSize: '0.75rem',
  margin: 0,
};

function DnsFieldRow({
  label,
  value,
  hint,
  mono,
  onCopy,
}: {
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
  onCopy: () => void;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '7rem 1fr auto',
        gap: '0.5rem',
        alignItems: 'center',
      }}
    >
      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
      <div style={{ minWidth: 0 }}>
        <code
          style={{
            display: 'block',
            fontSize: mono ? '0.75rem' : '0.85rem',
            color: 'var(--text-primary)',
            wordBreak: 'break-all',
            fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit',
          }}
        >
          {value}
        </code>
        {hint ? (
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{hint}</span>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onCopy}
        aria-label={`Copy ${label}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '2rem',
          height: '2rem',
          borderRadius: '6px',
          border: '1px solid var(--border-color)',
          background: 'rgba(255,255,255,0.05)',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
        }}
      >
        <Copy size={14} />
      </button>
    </div>
  );
}
