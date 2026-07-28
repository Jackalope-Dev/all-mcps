'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { ExternalLink, Copy, Cloud } from 'lucide-react';
import { toast } from '../../../../components/ui/Toast';
import { getDnsTxtRecordValue, getSiteVerificationToken } from '../../../../lib/verificationTokens';
import { getApexDomain, getDnsProviderLinks } from '../../../../lib/dnsProviders';

type ClaimMethod = 'github' | 'website_badge' | 'dns';

export default function ClaimClient({
  serverId,
  serverName,
  repoUrl,
  websiteUrl: initialWebsite,
  isOfficial,
  websiteVerified,
}: {
  serverId: string;
  serverName: string;
  repoUrl: string;
  websiteUrl?: string | null;
  isOfficial?: boolean;
  websiteVerified?: boolean;
}) {
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
  const [badgeStyle, setBadgeStyle] = useState<'directory' | 'featured'>('directory');

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://allmcps.com';
  const dnsValue = useMemo(() => getDnsTxtRecordValue(serverId), [serverId]);
  const metaToken = useMemo(() => getSiteVerificationToken(serverId), [serverId]);
  const apexDomain = useMemo(() => getApexDomain(websiteUrl.trim()), [websiteUrl]);
  const providerLinks = useMemo(() => getDnsProviderLinks(apexDomain), [apexDomain]);

  const badgeSrc = `${baseUrl}/api/badge/${serverId}?style=${badgeStyle}&theme=${badgeTheme}`;
  const badgeMarkdown = `[![Listed on AllMCPs](${badgeSrc})](${baseUrl}/mcp/${serverId})`;
  const badgeHtml = `<a href="${baseUrl}/mcp/${serverId}"><img src="${badgeSrc}" alt="Listed on AllMCPs" height="${badgeStyle === 'directory' ? 40 : 32}" /></a>`;
  const metaTag = `<meta name="allmcps-verification" content="${metaToken}" />`;
  const githubBadgeMd = `[![AllMCPs Verified](https://img.shields.io/badge/AllMCPs-Verified-blue)](${baseUrl}/mcp/${serverId})`;

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Could not copy', { description: 'Select the text and copy it manually.' });
    }
  };

  const handleVerify = async () => {
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

      const data = (await res.json()) as { error?: string; message?: string };

      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Verification failed');
      }

      setSuccess(true);
      setClaimed(true);
      if (method === 'website_badge' || method === 'dns') {
        setSiteVerified(true);
      }
      toast.success('Claim successful', {
        description: data.message || 'Your listing is now verified.',
      });
    } catch (err: any) {
      const message = err?.message || 'Verification failed';
      setError(message);
      toast.error('Verification failed', { description: message });
    } finally {
      setLoading(false);
    }
  };

  const handleAttachWebsite = async () => {
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
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          This listing is now marked as verified. If you attached a website, it is marked verified too.
          Premium listings receive a dofollow website backlink; free listings remain nofollow.
        </p>
        <Link
          href={`/mcp/${serverId}`}
          style={{
            padding: '0.75rem 1.5rem',
            background: 'var(--accent-color)',
            color: 'white',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: 'bold',
          }}
        >
          View Profile
        </Link>
      </div>
    );
  }

  const methods: { id: ClaimMethod; label: string; hint: string }[] = [
    { id: 'github', label: 'GitHub README', hint: 'Best if your listing points at a public GitHub repo' },
    { id: 'website_badge', label: 'Website badge', hint: 'Embed a badge or meta tag on your site' },
    { id: 'dns', label: 'DNS TXT', hint: 'Add a TXT record on your domain' },
  ];

  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '2rem' }}>
      <h2 style={{ marginBottom: '0.5rem' }}>{claimed ? 'Manage' : 'Claim'} {serverName}</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.6' }}>
        {claimed
          ? 'This listing is verified. Attach or update your website, then prove control with a badge or DNS if you have not already.'
          : 'Many listings were imported from public data. Prove you own this project to get the Verified badge.'}
        {siteVerified ? ' Website is verified.' : claimed && websiteUrl ? ' Website not verified yet.' : ''}
      </p>

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

      {method === 'github' && (
        <>
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>1. Add this to your README</h3>
            <div style={{ position: 'relative' }}>
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
                <code>{githubBadgeMd}</code>
              </pre>
              <button
                type="button"
                onClick={() => copyText(githubBadgeMd, 'README badge')}
                style={{
                  position: 'absolute',
                  top: '0.5rem',
                  right: '0.5rem',
                  background: 'var(--accent-color)',
                  border: 'none',
                  color: 'white',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                }}
              >
                Copy
              </button>
            </div>
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>2. Repo</h3>
            <a href={repoUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)' }}>
              {repoUrl}
            </a>
          </div>
        </>
      )}

      {method === 'website_badge' && (
        <>
          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem' }}>1. Choose a badge</h3>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              {(['directory', 'featured'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setBadgeStyle(s)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '999px',
                    border: '1px solid var(--border-color)',
                    background: badgeStyle === s ? 'rgba(59,130,246,0.15)' : 'transparent',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                  }}
                >
                  {s === 'directory' ? 'Directory' : 'Featured'}
                </button>
              ))}
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
            <div
              style={{
                padding: '1rem',
                borderRadius: '10px',
                background: badgeTheme === 'light' ? '#f1f5f9' : '#0a0a0a',
                border: '1px solid var(--border-color)',
                display: 'inline-flex',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={badgeSrc} alt="AllMCPs badge preview" height={badgeStyle === 'directory' ? 40 : 32} />
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
      )}

      {method === 'dns' && (
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
      )}

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
            color: 'white',
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
