'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { ExternalLink, Copy, Cloud, CheckCircle2, AlertCircle, ShieldCheck, Globe, Terminal, Sparkles, HelpCircle, ArrowRight, Lock } from 'lucide-react';
import { toast } from '../../../../components/ui/Toast';
import { CopyBlock } from '../../../../components/ui/CopyBlock';
import { SignInGate } from '../../../../components/ui/SignInGate';
import { getClaimVerificationToken } from '../../../../lib/verificationTokens';
import { getApexDomain, getDnsProviderLinks } from '../../../../lib/dnsProviders';

type ClaimMethod = 'github' | 'website_badge' | 'dns';
type BadgeStyle = 'shield' | 'flat-square' | 'featured' | 'directory';

const REPO_BADGE_STYLES: { id: BadgeStyle; label: string }[] = [
  { id: 'shield', label: 'Standard (20px)' },
  { id: 'flat-square', label: 'Square (20px)' },
];

const SITE_BADGE_STYLES: { id: BadgeStyle; label: string }[] = [
  { id: 'featured', label: 'Featured Banner (32px)' },
  { id: 'directory', label: 'Directory Card (40px)' },
];

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
  const hasGithub = repoUrl.includes('github.com');
  const [method, setMethod] = useState<ClaimMethod>(
    hasGithub ? 'github' : 'website_badge'
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
  const [badgeStyle, setBadgeStyle] = useState<BadgeStyle>(
    hasGithub ? 'shield' : 'directory'
  );
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
  
  const githubVerifyMarkdown = userId
    ? `[![AllMCPs Verified](${badgeSrc})](${baseUrl}/mcp/${serverId}?verify=${userId})`
    : null;
  const signInHref = `/login?callbackUrl=${encodeURIComponent(`/mcp/${serverId}/claim`)}`;

  const selectMethod = (next: ClaimMethod) => {
    setMethod(next);
    if (next === 'github' && !REPO_BADGE_STYLES.some((s) => s.id === badgeStyle)) {
      setBadgeStyle('shield');
    } else if (next === 'website_badge' && !SITE_BADGE_STYLES.some((s) => s.id === badgeStyle)) {
      setBadgeStyle('directory');
    }
  };

  const alreadyVerifiedForMethod = method === 'github' ? claimed : siteVerified;

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
          padding: '3.5rem 2rem',
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ fontSize: '4rem', marginBottom: '1rem', display: 'inline-block' }}>🎉</div>
        <h2 style={{ marginBottom: '1rem', color: '#10b981', fontSize: '1.75rem', fontWeight: 800 }}>Claim Successful!</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.6, maxWidth: '540px', margin: '0 auto 1.5rem' }}>
          Your listing is now marked as <strong>Verified</strong> on AllMCPs. {siteVerified ? 'Your product website is verified as well!' : ''}
        </p>
        <div
          style={{
            color: 'var(--text-secondary)',
            marginBottom: '2rem',
            lineHeight: 1.6,
            fontSize: '0.9rem',
            padding: '1rem 1.25rem',
            borderRadius: 12,
            background: 'rgba(16,185,129,0.08)',
            border: '1px solid rgba(16,185,129,0.25)',
            textAlign: 'left',
            maxWidth: '560px',
            margin: '0 auto 2rem',
          }}
        >
          <strong style={{ color: '#34d399', display: 'block', marginBottom: '0.25rem' }}>✨ Earn Reciprocal Dofollow Backlinks:</strong>
          Keep an AllMCPs badge live on your GitHub README or product website. When our automated health checker sees your live link, your website link on AllMCPs becomes a high-value dofollow backlink!
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center' }}>
          <Link
            href={`/mcp/${serverId}`}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'var(--brand-gradient, var(--accent-color))',
              color: '#ffffff',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: 'bold',
              boxShadow: '0 4px 14px rgba(0, 229, 255, 0.25)',
            }}
          >
            View listing
          </Link>
          <Link
            href="/badge-generator"
            style={{
              padding: '0.75rem 1.5rem',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-muted)',
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
              background: 'var(--bg-muted)',
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Verification Status Banner Header */}
      <div
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '1.5rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1.25rem',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
        }}
      >
        {/* GitHub Ownership Card */}
        <div
          style={{
            padding: '1rem 1.15rem',
            borderRadius: '12px',
            background: claimed ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-muted)',
            border: claimed ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.85rem',
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: claimed ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
              flexShrink: 0,
            }}
          >
            🐙
          </div>
          <div>
            <div style={{ fontSize: '0.725rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              GitHub Repo Control
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, marginTop: '0.15rem', color: claimed ? '#10b981' : 'var(--text-primary)' }}>
              {claimed ? '✓ Verified & Claimed' : 'Unverified'}
            </div>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.775rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {claimed ? 'Codebase ownership confirmed via README badge.' : 'Add README badge to claim official project.'}
            </p>
          </div>
        </div>

        {/* Website Verification Card */}
        <div
          style={{
            padding: '1rem 1.15rem',
            borderRadius: '12px',
            background: siteVerified ? 'rgba(16, 185, 129, 0.08)' : websiteUrl ? 'rgba(245, 158, 11, 0.08)' : 'var(--bg-muted)',
            border: siteVerified ? '1px solid rgba(16, 185, 129, 0.3)' : websiteUrl ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.85rem',
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: siteVerified ? 'rgba(16, 185, 129, 0.2)' : websiteUrl ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
              flexShrink: 0,
            }}
          >
            🌐
          </div>
          <div>
            <div style={{ fontSize: '0.725rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Product Website Link
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, marginTop: '0.15rem', color: siteVerified ? '#10b981' : websiteUrl ? '#f59e0b' : 'var(--text-secondary)' }}>
              {siteVerified ? '✓ Domain Confirmed' : websiteUrl ? 'Needs Verification' : 'No Website Attached'}
            </div>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.775rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {siteVerified ? `Domain verified for ${websiteUrl}.` : websiteUrl ? `Verify site for dofollow backlink.` : 'Attach site to qualify for reciprocal link.'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Wizard Shell */}
      <div
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '2rem',
        }}
      >
        {/* STEP 1: Select Method */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem' }}>
            <span
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: 'var(--accent-color)',
                color: 'var(--bg-color)',
                fontWeight: 'bold',
                fontSize: '0.875rem',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              1
            </span>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Choose Verification Method
            </h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '0.85rem',
            }}
          >
            {hasGithub && (
              <button
                type="button"
                onClick={() => selectMethod('github')}
                style={{
                  padding: '1.1rem 1.25rem',
                  borderRadius: '12px',
                  border: method === 'github' ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                  background: method === 'github' ? 'rgba(var(--accent-rgb), 0.12)' : 'var(--bg-muted)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    🐙 GitHub README
                  </span>
                  {claimed && (
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.15)', padding: '0.1rem 0.45rem', borderRadius: '999px' }}>
                      ✓ Verified
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: '0.775rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  Claims repo ownership &amp; grants Official status badge on AllMCPs.
                </p>
              </button>
            )}

            <button
              type="button"
              onClick={() => selectMethod('website_badge')}
              style={{
                padding: '1.1rem 1.25rem',
                borderRadius: '12px',
                border: method === 'website_badge' ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                background: method === 'website_badge' ? 'rgba(var(--accent-rgb), 0.12)' : 'var(--bg-muted)',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  🌐 Website Badge / Tag
                </span>
                {siteVerified && method === 'website_badge' && (
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.15)', padding: '0.1rem 0.45rem', borderRadius: '999px' }}>
                    ✓ Verified
                  </span>
                )}
              </div>
              <p style={{ margin: 0, fontSize: '0.775rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                Embed badge or meta tag on website for a reciprocal dofollow link.
              </p>
            </button>

            <button
              type="button"
              onClick={() => selectMethod('dns')}
              style={{
                padding: '1.1rem 1.25rem',
                borderRadius: '12px',
                border: method === 'dns' ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                background: method === 'dns' ? 'rgba(var(--accent-rgb), 0.12)' : 'var(--bg-muted)',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  ⚡ DNS TXT Record
                </span>
                {siteVerified && method === 'dns' && (
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.15)', padding: '0.1rem 0.45rem', borderRadius: '999px' }}>
                    ✓ Verified
                  </span>
                )}
              </div>
              <p style={{ margin: 0, fontSize: '0.775rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                Publish TXT record on domain DNS for instant owner proof.
              </p>
            </button>
          </div>
        </div>

        {/* STEP 2: Configure & Copy Snippet */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
            <span
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: 'var(--accent-color)',
                color: 'var(--bg-color)',
                fontWeight: 'bold',
                fontSize: '0.875rem',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              2
            </span>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Follow Instructions &amp; Copy Code
            </h2>
          </div>

          {/* Already Verified Banner */}
          {alreadyVerifiedForMethod && (
            <div
              style={{
                padding: '1rem 1.15rem',
                borderRadius: '12px',
                background: 'rgba(16,185,129,0.08)',
                border: '1px solid rgba(16,185,129,0.3)',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}
            >
              <CheckCircle2 size={22} color="#10b981" />
              <div>
                <strong style={{ color: '#10b981', fontSize: '0.9rem' }}>
                  {method === 'github' ? 'GitHub README Ownership Confirmed' : 'Website Verification Active'}
                </strong>
                <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.785rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  This method is verified and active. You don't need to repeat this unless your repository or DNS settings change.
                </p>
              </div>
            </div>
          )}

          {/* Website URL Field for Website / DNS methods */}
          {(method === 'website_badge' || method === 'dns') && (
            <div style={{ marginBottom: '1.5rem', padding: '1.15rem', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-muted)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Product Website URL
                </label>
                {claimed && (
                  <button
                    type="button"
                    onClick={handleAttachWebsite}
                    disabled={attachLoading}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem' }}
                  >
                    {attachLoading ? 'Saving…' : 'Save Website URL'}
                  </button>
                )}
              </div>
              <input
                type="url"
                className="form-input"
                placeholder="https://yourproduct.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                style={{ width: '100%' }}
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.4rem', marginBottom: 0 }}>
                This is the website address that will receive the reciprocal dofollow backlink on AllMCPs.
              </p>
            </div>
          )}

          {/* METHOD: GITHUB README */}
          {method === 'github' && (
            <div>
              {/* AI Agent Banner Box */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(var(--accent-rgb), 0.08) 0%, rgba(16, 185, 129, 0.08) 100%)',
                  border: '1px solid rgba(var(--accent-rgb), 0.3)',
                  borderRadius: '12px',
                  padding: '1.1rem 1.25rem',
                  marginBottom: '1.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: 'var(--accent-color)', fontSize: '0.925rem' }}>
                    <Sparkles size={18} />
                    <span>Have an AI Agent claim &amp; verify this for you!</span>
                  </div>
                  <button
                    type="button"
                    onClick={copyAgentClaimPrompt}
                    style={{
                      background: 'var(--accent-color)',
                      color: 'var(--bg-color)',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.45rem 0.85rem',
                      fontSize: '0.825rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      boxShadow: '0 2px 8px rgba(var(--accent-rgb), 0.2)',
                    }}
                  >
                    📋 Copy AI Agent Prompt
                  </button>
                </div>
                <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Copy this prompt into <strong>Cursor</strong>, <strong>Claude Code</strong>, <strong>Windsurf</strong>, or <strong>Antigravity</strong> inside your codebase. The agent will add the badge and push it automatically.
                </p>
              </div>

              {/* Badge Configurator */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                  1. Customize your README badge:
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                  {/* Style */}
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>Style:</span>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {REPO_BADGE_STYLES.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setBadgeStyle(s.id)}
                          style={{
                            padding: '0.3rem 0.65rem',
                            borderRadius: '999px',
                            border: '1px solid var(--border-color)',
                            background: badgeStyle === s.id ? 'rgba(0,229,255,0.15)' : 'transparent',
                            color: badgeStyle === s.id ? 'var(--accent-color)' : 'var(--text-primary)',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: badgeStyle === s.id ? 700 : 500,
                          }}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Metric */}
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>Displayed Metric:</span>
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
                            background: badgeMetric === m.id ? 'rgba(0,229,255,0.15)' : 'transparent',
                            color: badgeMetric === m.id ? 'var(--accent-color)' : 'var(--text-primary)',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: badgeMetric === m.id ? 700 : 500,
                          }}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Theme */}
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>Theme:</span>
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
                            background: badgeTheme === t ? 'rgba(0,229,255,0.15)' : 'transparent',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: badgeTheme === t ? 700 : 500,
                          }}
                        >
                          {t === 'dark' ? 'Dark' : 'Light'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Badge Preview */}
                <div
                  style={{
                    padding: '0.85rem 1.15rem',
                    borderRadius: '10px',
                    background: badgeTheme === 'light' ? '#ffffff' : '#090d16',
                    border: '1px solid var(--border-color)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    marginBottom: '1.25rem',
                  }}
                >
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Preview:</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={badgeSrc} alt="GitHub badge preview" height={badgeHeight} />
                </div>
              </div>

              {/* Code Snippet Block */}
              {!isSignedIn ? (
                <SignInGate href={signInHref} />
              ) : (
                <div style={{ marginBottom: '1.25rem' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                    2. Add code to your <code>README.md</code>:
                  </h3>
                  <CopyBlock
                    code={githubVerifyMarkdown || ''}
                    title="README.md"
                    language="markdown"
                    toastMessage="README badge snippet copied"
                  />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem', lineHeight: 1.45 }}>
                    🔒 This snippet includes your unique verification signature. It links directly to your project on AllMCPs.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* METHOD: WEBSITE BADGE */}
          {method === 'website_badge' && (
            <div>
              {!isSignedIn ? (
                <SignInGate href={signInHref} />
              ) : (
                <>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                      1. Customize website badge:
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                      {/* Style */}
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>Style:</span>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          {SITE_BADGE_STYLES.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => setBadgeStyle(s.id)}
                              style={{
                                padding: '0.35rem 0.75rem',
                                borderRadius: '999px',
                                border: '1px solid var(--border-color)',
                                background: badgeStyle === s.id ? 'rgba(0,229,255,0.15)' : 'transparent',
                                color: badgeStyle === s.id ? 'var(--accent-color)' : 'var(--text-primary)',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: badgeStyle === s.id ? 700 : 500,
                              }}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Metric */}
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>Metric:</span>
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
                                background: badgeMetric === m.id ? 'rgba(0,229,255,0.15)' : 'transparent',
                                color: badgeMetric === m.id ? 'var(--accent-color)' : 'var(--text-primary)',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: badgeMetric === m.id ? 700 : 500,
                              }}
                            >
                              {m.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Theme */}
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>Theme:</span>
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
                                background: badgeTheme === t ? 'rgba(0,229,255,0.15)' : 'transparent',
                                color: 'var(--text-primary)',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: badgeTheme === t ? 700 : 500,
                              }}
                            >
                              {t === 'dark' ? 'Dark' : 'Light'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '1rem 1.25rem',
                        borderRadius: '10px',
                        background: badgeTheme === 'light' ? '#ffffff' : '#090d16',
                        border: '1px solid var(--border-color)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '52px',
                        marginBottom: '1.25rem',
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={badgeSrc} alt="AllMCPs badge preview" height={badgeHeight} />
                    </div>
                  </div>

                  <div style={{ marginBottom: '1.25rem' }}>
                    <h3 style={{ marginBottom: '0.5rem', fontSize: '0.95rem', fontWeight: 700 }}>Markdown format:</h3>
                    <CopyBlock code={badgeMarkdown} title="README.md" language="markdown" toastMessage="Markdown badge copied" />
                  </div>

                  <div style={{ marginBottom: '1.25rem' }}>
                    <h3 style={{ marginBottom: '0.5rem', fontSize: '0.95rem', fontWeight: 700 }}>HTML format:</h3>
                    <CopyBlock code={badgeHtml} title="badge.html" language="html" toastMessage="HTML badge copied" />
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.4rem', lineHeight: 1.5 }}>
                      This badge includes a reciprocal link back to AllMCPs. Keep it live to qualify for a dofollow backlink to your site.
                    </p>
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <h3 style={{ marginBottom: '0.5rem', fontSize: '0.95rem', fontWeight: 700 }}>Or HTML Meta Tag (alternative to badge):</h3>
                    <CopyBlock code={metaTag} title="index.html" language="html" toastMessage="Meta tag copied" />
                  </div>
                </>
              )}
            </div>
          )}

          {/* METHOD: DNS TXT RECORD */}
          {method === 'dns' && (
            <div>
              {!isSignedIn ? (
                <SignInGate href={signInHref} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0, lineHeight: 1.6 }}>
                    Publish the following TXT record on <strong style={{ color: 'var(--text-primary)' }}>{apexDomain || 'your domain DNS'}</strong>:
                  </p>

                  {/* Record fields */}
                  <div
                    style={{
                      display: 'grid',
                      gap: '0.65rem',
                      padding: '1.15rem',
                      borderRadius: '12px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-muted)',
                    }}
                  >
                    <DnsFieldRow label="Type" value="TXT" onCopy={() => copyText('TXT', 'Type')} />
                    <DnsFieldRow
                      label="Name"
                      value="@"
                      hint={apexDomain ? `or ${apexDomain}` : 'apex / root host'}
                      onCopy={() => copyText('@', 'Name')}
                    />
                    <DnsFieldRow label="Value" value={dnsValue} mono onCopy={() => copyText(dnsValue, 'TXT value')} />
                    <DnsFieldRow label="TTL" value="Auto / 3600" onCopy={() => copyText('3600', 'TTL')} />
                  </div>

                  {/* Cloudflare helper */}
                  <div
                    style={{
                      padding: '1.15rem',
                      borderRadius: '12px',
                      border: '1px solid rgba(249,115,22,0.35)',
                      background: 'linear-gradient(135deg, rgba(249,115,22,0.08), rgba(59,130,246,0.06))',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                      <Cloud size={18} color="#f97316" />
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Cloudflare (1-Click Setup)</h4>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.85rem', lineHeight: 1.5 }}>
                      Open Cloudflare DNS and paste the fields above, or use a scoped API token to auto-create the TXT record in 1 click.
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
                            description: 'Paste it as Content when adding the record in Cloudflare.',
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.75rem' }}>
                        <label style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          Token with template <strong>Edit zone DNS</strong> limited to {apexDomain || 'this domain'}:
                        </label>
                        <input
                          type="password"
                          className="form-input"
                          autoComplete="off"
                          placeholder="Cloudflare API Token"
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
                          }}
                        >
                          {cfLoading ? 'Adding record…' : 'Add TXT record in Cloudflare'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Other Providers */}
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                      Other Provider Quick-Links:
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {providerLinks
                        .filter((p) => p.id !== 'cloudflare')
                        .map((p) => (
                          <a
                            key={p.id}
                            href={p.href}
                            target="_blank"
                            rel="noopener noreferrer"
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
                              background: 'var(--bg-muted)',
                              color: 'var(--text-primary)',
                              fontSize: '0.775rem',
                              fontWeight: 500,
                              textDecoration: 'none',
                            }}
                          >
                            {p.name}
                            <ExternalLink size={12} style={{ opacity: 0.6 }} />
                          </a>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* STEP 3: Confirm & Claim */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
            <span
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: 'var(--accent-color)',
                color: 'var(--bg-color)',
                fontWeight: 'bold',
                fontSize: '0.875rem',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              3
            </span>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Confirm &amp; Run Verification
            </h2>
          </div>

          {/* Action Callout Box */}
          <div
            style={{
              padding: '1.25rem',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-muted)',
              marginBottom: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Selected Action:</span>
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--accent-color)' }}>
                {method === 'github'
                  ? 'Verify GitHub Repository README'
                  : method === 'website_badge'
                    ? 'Verify Website Badge / Meta Tag'
                    : 'Verify Domain DNS TXT Record'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Target URL:</span>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                {method === 'github' ? repoUrl : websiteUrl || 'Not set yet'}
              </span>
            </div>
          </div>

          {/* Main Action Button */}
          {!isSignedIn ? (
            <a
              href={signInHref}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '1rem',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                fontWeight: 800,
                fontSize: '1.05rem',
                textDecoration: 'none',
                background: 'var(--brand-gradient, var(--accent-color))',
                color: '#ffffff',
                borderRadius: '10px',
                boxShadow: '0 4px 16px rgba(0, 229, 255, 0.25)',
              }}
            >
              <Lock size={18} /> Sign In to Verify &amp; Claim Listing
            </a>
          ) : (
            <button
              type="button"
              onClick={handleVerify}
              disabled={loading}
              style={{
                width: '100%',
                padding: '1.05rem',
                background: loading ? '#374151' : 'var(--brand-gradient, var(--accent-color))',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 800,
                fontSize: '1.05rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: loading ? 'none' : '0 4px 16px rgba(0, 229, 255, 0.25)',
                transition: 'all 0.15s ease',
              }}
            >
              {loading ? (
                'Verifying…'
              ) : (
                <>
                  <ShieldCheck size={20} />
                  {alreadyVerifiedForMethod
                    ? method === 'github'
                      ? 'Re-verify Repo Ownership'
                      : 'Re-verify Website'
                    : claimed
                      ? method === 'github'
                        ? 'Verify Repo Ownership'
                        : 'Verify Website Domain'
                      : 'Verify & Claim Listing'}
                </>
              )}
            </button>
          )}

          {error && (
            <div
              style={{
                marginTop: '1.25rem',
                padding: '1rem',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid #ef4444',
                borderRadius: '10px',
                color: '#ef4444',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
              }}
            >
              <AlertCircle size={20} />
              <div>
                <strong>Verification Failure:</strong> {error}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
        gridTemplateColumns: '6.5rem 1fr auto',
        gap: '0.5rem',
        alignItems: 'center',
      }}
    >
      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
          background: 'var(--card-bg)',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
        }}
      >
        <Copy size={14} />
      </button>
    </div>
  );
}
