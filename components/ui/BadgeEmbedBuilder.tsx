'use client';

import React, { useState } from 'react';
import { Copy, Check, ShieldCheck, Sparkles } from 'lucide-react';
import { toast } from './Toast';
import { trackShare } from '../../lib/gtag';

interface BadgeEmbedBuilderProps {
  serverId?: string;
  serverName?: string;
  className?: string;
}

export function BadgeEmbedBuilder({
  serverId = 'sample-mcp-server',
  serverName = 'Sample MCP Server',
  className = '',
}: BadgeEmbedBuilderProps) {
  const [badgeStyle, setBadgeStyle] = useState<'shield' | 'flat-square' | 'featured' | 'directory'>('shield');
  const [badgeMetric, setBadgeMetric] = useState<'status' | 'upvotes' | 'views' | 'installs'>('status');
  const [badgeTheme, setBadgeTheme] = useState<'dark' | 'light'>('dark');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [customId, setCustomId] = useState(serverId);

  const cleanId = customId.trim() || 'sample-mcp-server';
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://allmcps.com';

  const queryParams = new URLSearchParams();
  if (badgeStyle !== 'shield') queryParams.set('style', badgeStyle);
  if (badgeMetric !== 'status') queryParams.set('metric', badgeMetric);
  if (badgeTheme !== 'dark') queryParams.set('theme', badgeTheme);

  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
  const badgeSrc = `${baseUrl}/api/badge/${cleanId}${queryString}`;
  const targetUrl = `${baseUrl}/mcp/${cleanId}`;

  const badgeHeight = badgeStyle === 'directory' ? 40 : badgeStyle === 'featured' ? 32 : 20;

  const markdownSnippet = `[![AllMCPs](${badgeSrc})](${targetUrl})`;
  const htmlSnippet = `<a href="${targetUrl}"><img src="${badgeSrc}" alt="AllMCPs" height="${badgeHeight}" /></a>`;

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
      trackShare({ method: `copy_${key}`, serverId: cleanId });
      toast.success('Copied snippet to clipboard!');
    } catch (err) {
      toast.error('Could not copy to clipboard');
    }
  };

  const styleOptions: { value: typeof badgeStyle; label: string }[] = [
    { value: 'shield', label: 'Standard Badge (20px)' },
    { value: 'flat-square', label: 'Flat Square (20px)' },
    { value: 'featured', label: 'Featured Banner (32px)' },
    { value: 'directory', label: 'Directory Card (40px)' },
  ];

  const metricOptions: { value: typeof badgeMetric; label: string }[] = [
    { value: 'status', label: 'Status (Verified)' },
    { value: 'upvotes', label: 'Upvotes' },
    { value: 'views', label: 'Views' },
    { value: 'installs', label: 'Installs' },
  ];

  return (
    <div className={`badge-embed-builder ${className}`}>
      <div className="badge-embed-builder-header">
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Sparkles size={16} style={{ color: 'var(--accent-color)' }} />
            Dynamic SVG Verification Badge
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
            Embed on your GitHub README or project site to showcase your listing. Verify your site and keep the badge
            dofollow to turn your listing&apos;s website link into a reciprocal dofollow backlink.
          </p>
        </div>

        {/* Server ID Override Input if generic builder */}
        {!serverId && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Server ID:</span>
            <input
              type="text"
              value={customId}
              onChange={(e) => setCustomId(e.target.value)}
              placeholder="e.g. sqlite-mcp"
              className="form-input"
              style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem', fontFamily: 'monospace', width: 'auto', maxWidth: '180px' }}
            />
          </div>
        )}
      </div>

      {/* Style & Data Metric Toggles */}
      <div className="badge-embed-builder-toggles">
        {/* Style selection */}
        <div>
          <div className="badge-embed-label">Badge Style</div>
          <div className="badge-embed-toggle-group">
            {styleOptions.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setBadgeStyle(value)}
                className={`badge-embed-toggle-btn ${badgeStyle === value ? 'is-active' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Metric selection & Theme selection */}
        <div className="badge-embed-metric-row">
          <div>
            <div className="badge-embed-label">Displayed Data / Metric</div>
            <div className="badge-embed-toggle-group">
              {metricOptions.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setBadgeMetric(value)}
                  className={`badge-embed-toggle-btn ${badgeMetric === value ? 'is-active' : ''}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="badge-embed-label">Theme</div>
            <div className="badge-embed-toggle-group">
              <button
                type="button"
                onClick={() => setBadgeTheme('dark')}
                className={`badge-embed-toggle-btn ${badgeTheme === 'dark' ? 'is-active-light' : ''}`}
              >
                Dark
              </button>
              <button
                type="button"
                onClick={() => setBadgeTheme('light')}
                className={`badge-embed-toggle-btn ${badgeTheme === 'light' ? 'is-active-solid' : ''}`}
              >
                Light
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Live Badge Preview */}
      <div>
        <div className="badge-embed-label">Live Preview</div>
        <div className={`badge-embed-preview ${badgeTheme === 'light' ? 'badge-embed-preview--light' : 'badge-embed-preview--dark'}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/badge/${cleanId}${queryString}`}
            alt={`${serverName} AllMCPs Badge`}
            style={{ height: `${badgeHeight}px`, maxWidth: '100%' }}
          />
        </div>
      </div>

      {/* Verification Bonus Callout */}
      <div className="badge-embed-callout">
        <ShieldCheck size={16} style={{ color: '#34d399', flexShrink: 0, marginTop: '0.125rem' }} />
        <div className="badge-embed-callout-text">
          <span style={{ fontWeight: 600 }}>Automatic badge health sync</span>: we re-check your badge on each health
          run, so once it&apos;s live your reciprocal dofollow link stays credited automatically. (To claim the Verified
          owner badge, use the personalized badge on your listing&apos;s claim page — a generic badge can&apos;t prove
          ownership.)
        </div>
      </div>

      {/* Reciprocal Dofollow Callout */}
      <div className="badge-embed-callout">
        <ShieldCheck size={16} style={{ color: 'var(--accent-color)', flexShrink: 0, marginTop: '0.125rem' }} />
        <div className="badge-embed-callout-text">
          <span style={{ fontWeight: 600 }}>Reciprocal dofollow link</span>: These snippets are a genuine{' '}
          <strong>dofollow</strong> link back to AllMCPs (no <code>rel=&quot;nofollow&quot;</code>). Verify your site
          (badge, meta tag, or DNS) and keep the link dofollow, and your listing&apos;s website link becomes dofollow in
          return — we recheck the badge on each health run and only credit links that actually pass ranking signal.
        </div>
      </div>

      {/* Code Snippet Outputs */}
      <div className="badge-embed-snippets">
        {/* Markdown Snippet */}
        <div className="badge-embed-snippet-block">
          <div className="badge-embed-snippet-label">
            <span>Markdown (for GitHub README.md)</span>
          </div>
          <div className="badge-embed-snippet-code">
            <pre>
              <code>{markdownSnippet}</code>
            </pre>
            <button
              type="button"
              onClick={() => copyToClipboard(markdownSnippet, 'markdown')}
              className="badge-embed-copy-btn"
            >
              {copiedKey === 'markdown' ? <Check size={14} style={{ color: '#34d399' }} /> : <Copy size={14} />}
              <span>{copiedKey === 'markdown' ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* HTML Snippet */}
        <div className="badge-embed-snippet-block">
          <div className="badge-embed-snippet-label">
            <span>HTML (for Website or Blog)</span>
          </div>
          <div className="badge-embed-snippet-code">
            <pre>
              <code>{htmlSnippet}</code>
            </pre>
            <button
              type="button"
              onClick={() => copyToClipboard(htmlSnippet, 'html')}
              className="badge-embed-copy-btn"
            >
              {copiedKey === 'html' ? <Check size={14} style={{ color: '#34d399' }} /> : <Copy size={14} />}
              <span>{copiedKey === 'html' ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
