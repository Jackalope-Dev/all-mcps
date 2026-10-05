'use client';

import { Check, Link2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from '@/components/ui/Toast';
import { trackEvent } from '@/lib/gtag';

const PAGE_URL = 'https://allmcps.com/state-of-mcp';

function shareTargets(text: string, url: string) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);
  return [
    {
      id: 'x',
      label: 'X',
      href: `https://x.com/intent/post?text=${t}&url=${u}`,
    },
    {
      id: 'linkedin',
      label: 'LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
    },
    {
      id: 'reddit',
      label: 'Reddit',
      href: `https://www.reddit.com/submit?url=${u}&title=${t}`,
    },
    {
      id: 'hn',
      label: 'Hacker News',
      href: `https://news.ycombinator.com/submitlink?u=${u}&t=${t}`,
    },
    {
      id: 'bluesky',
      label: 'Bluesky',
      href: `https://bsky.app/intent/compose?text=${encodeURIComponent(`${text} ${url}`)}`,
    },
  ];
}

function track(method: string, anchor: string) {
  trackEvent('share', {
    method,
    content_type: 'report',
    item_id: anchor ? `state-of-mcp#${anchor}` : 'state-of-mcp',
  });
}

function useCopy(url: string, anchor: string) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      track('copy_url', anchor);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy', {
        description: 'Your browser blocked clipboard access.',
      });
    }
  };
  return { copied, copy };
}

/** Page-level share row under the hero. */
export function ShareBar({ text }: { text: string }) {
  const { copied, copy } = useCopy(PAGE_URL, '');
  return (
    <div className="som-share">
      <span className="som-share-label">Share</span>
      {shareTargets(text, PAGE_URL).map((s) => (
        <a
          key={s.id}
          className="som-share-btn"
          href={s.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track(s.id, '')}
        >
          {s.label}
        </a>
      ))}
      <button type="button" className="som-share-btn" onClick={copy}>
        {copied ? <Check size={14} /> : <Link2 size={14} />}
        {copied ? 'Copied' : 'Copy link'}
      </button>
    </div>
  );
}

/** Per-stat share: deep-links to the section so the post lands on the chart. */
export function ShareStat({ anchor, text }: { anchor: string; text: string }) {
  const url = `${PAGE_URL}#${anchor}`;
  const { copied, copy } = useCopy(url, anchor);
  const x = shareTargets(text, url)[0];
  return (
    <div className="som-stat-share">
      <a
        className="som-share-btn som-share-btn--quiet"
        href={x.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track('x', anchor)}
      >
        Post this stat
      </a>
      <button
        type="button"
        className="som-share-btn som-share-btn--quiet"
        onClick={copy}
      >
        {copied ? <Check size={14} /> : <Link2 size={14} />}
        {copied ? 'Copied' : 'Copy link'}
      </button>
    </div>
  );
}
