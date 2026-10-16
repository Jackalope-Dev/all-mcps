'use client';

import {
  ArrowRight,
  BadgeCheck,
  Check,
  Copy,
  Mail,
  Rocket,
  SearchCheck,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import type React from 'react';
import { useState } from 'react';
import { badgeTargetUrl } from '../../lib/badgeLink';
import { useViewerId } from '../../lib/clientSession';
import { toast } from '../ui/Toast';

const STEPS = [
  {
    icon: SearchCheck,
    title: 'We review it',
    body: 'Free submissions are reviewed in the queue. Priority Review jumps ahead.',
  },
  {
    icon: Mail,
    title: 'You get an approval email',
    body: 'It includes a direct claim link once the listing is live.',
  },
  {
    icon: BadgeCheck,
    title: 'Claim & verify',
    body: 'Verify ownership and keep the badge live for a free dofollow backlink.',
  },
] as const;

/** The "you're in the queue" screen shown after a successful submission. */
export function SubmitSuccess({
  name,
  submittedId,
  isGithub,
  onSubmitAnother,
}: {
  name: string;
  submittedId: string | null;
  isGithub: boolean;
  onSubmitAnother: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const viewerId = useViewerId();
  const baseUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://allmcps.com';
  const sampleId = submittedId || 'your-server';
  const badgeSrc = `${baseUrl}/api/badge/${sampleId}?style=shield`;
  const badgeMarkdown = `[![AllMCPs](${badgeSrc})](${badgeTargetUrl(baseUrl, sampleId, viewerId)})`;
  const pricingHref = (sku?: string) =>
    submittedId
      ? `/pricing?serverId=${encodeURIComponent(submittedId)}${sku ? `&sku=${sku}` : ''}`
      : '/pricing';

  const copyBadge = async () => {
    try {
      await navigator.clipboard.writeText(badgeMarkdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      toast.success('Badge markdown copied');
    } catch {
      toast.error('Could not copy automatically.');
    }
  };

  return (
    <div className="acct-success">
      <header className="acct-success-hero">
        <div className="acct-success-check" aria-hidden="true">
          <svg viewBox="0 0 52 52" width="52" height="52" aria-hidden="true">
            <circle cx="26" cy="26" r="24" />
            <path d="M15 27l7 7 15-16" />
          </svg>
        </div>
        <h2
          className="acct-success-title animate-in"
          style={{ '--i': 2 } as React.CSSProperties}
        >
          {name.trim() ? (
            <>
              <span className="acct-success-name">{name.trim()}</span> is in the
              review queue
            </>
          ) : (
            <>You&apos;re in the review queue</>
          )}
        </h2>
        <p
          className="acct-success-lead animate-in"
          style={{ '--i': 3 } as React.CSSProperties}
        >
          We&apos;ll email you as soon as it&apos;s approved. Here&apos;s what
          happens next — and a few ways to get more out of your listing.
        </p>
        <div
          className="acct-success-actions animate-in"
          style={{ '--i': 4 } as React.CSSProperties}
        >
          {submittedId ? (
            <>
              <Link
                href={`/mcp/${submittedId}/claim`}
                className="btn btn-primary btn-md"
              >
                Open claim page
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
              <Link
                href={`/mcp/${submittedId}`}
                className="btn btn-secondary btn-md"
              >
                Preview listing
              </Link>
            </>
          ) : (
            <Link href="/dashboard" className="btn btn-primary btn-md">
              Go to dashboard
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          )}
        </div>
      </header>

      <ol className="acct-success-steps reveal-stagger">
        {STEPS.map(({ icon: Icon, title, body }, i) => (
          <li key={title} style={{ '--i': i } as React.CSSProperties}>
            <span className="acct-success-step-icon" aria-hidden="true">
              <Icon size={17} />
            </span>
            <span className="acct-success-step-n tabular">0{i + 1}</span>
            <h3>{title}</h3>
            <p>{body}</p>
          </li>
        ))}
      </ol>

      <div className="acct-success-grid">
        {submittedId ? (
          <section className="acct-card acct-success-badge">
            <h3 className="acct-card-title">Prepare your badge</h3>
            <p className="acct-card-sub">
              {isGithub
                ? 'Add this to your GitHub README after approval to speed up verification.'
                : 'Add this badge to your site after approval to claim ownership.'}
            </p>
            <div className="acct-badge-preview">
              {/* biome-ignore lint/performance/noImgElement: dynamic SVG badge from our own API */}
              <img src={badgeSrc} alt="AllMCPs badge preview" height={20} />
            </div>
            <div className="acct-code-row">
              <code>{badgeMarkdown}</code>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={copyBadge}
                aria-label="Copy badge markdown"
              >
                {copied ? (
                  <Check size={14} aria-hidden="true" />
                ) : (
                  <Copy size={14} aria-hidden="true" />
                )}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </section>
        ) : null}

        <section className="acct-card acct-success-boost">
          <h3 className="acct-card-title">Optional: launch faster</h3>
          <p className="acct-card-sub">
            Free listings are always reviewed. Boosts just get you there sooner.
          </p>
          <div className="acct-boost-list">
            <Link href={pricingHref('priority_review')} className="acct-boost">
              <span className="acct-boost-icon" aria-hidden="true">
                <Zap size={16} />
              </span>
              <span className="acct-boost-body">
                <strong>Priority Review</strong>
                <span>Skip ahead of the free review queue.</span>
              </span>
              <span className="acct-boost-price tabular">$5</span>
            </Link>
            <Link href={pricingHref('featured_7d')} className="acct-boost">
              <span className="acct-boost-icon" aria-hidden="true">
                <Rocket size={16} />
              </span>
              <span className="acct-boost-body">
                <strong>7-day launch boost</strong>
                <span>Featured on homepage discovery and search.</span>
              </span>
              <span className="acct-boost-price tabular">$12</span>
            </Link>
          </div>
          <Link href={pricingHref()} className="link-arrow">
            Compare all plans
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </section>
      </div>

      <div className="acct-success-foot">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onSubmitAnother}
        >
          Submit another server
        </button>
        <Link href="/dashboard" className="btn btn-ghost btn-sm">
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
