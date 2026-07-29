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

  return (
    <div className={`rounded-xl border border-white/10 bg-black/40 backdrop-blur-md p-6 ${className}`}>
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div>
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" /> Dynamic SVG Verification Badge
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Embed on your GitHub README or project site to showcase your listing and automatically claim Verified status.
          </p>
        </div>

        {/* Server ID Override Input if generic builder */}
        {!serverId && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-400">Server ID:</span>
            <input
              type="text"
              value={customId}
              onChange={(e) => setCustomId(e.target.value)}
              placeholder="e.g. sqlite-mcp"
              className="px-2.5 py-1 rounded bg-zinc-900 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>
        )}
      </div>

      {/* Style & Data Metric Toggles */}
      <div className="space-y-4 mb-5">
        {/* Style selection */}
        <div>
          <div className="text-xs font-medium text-zinc-400 mb-1.5">Badge Style</div>
          <div className="flex items-center gap-1.5 bg-zinc-900/80 p-1 rounded-lg border border-white/10 flex-wrap">
            <button
              type="button"
              onClick={() => setBadgeStyle('shield')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                badgeStyle === 'shield'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Standard Badge (20px)
            </button>
            <button
              type="button"
              onClick={() => setBadgeStyle('flat-square')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                badgeStyle === 'flat-square'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Flat Square (20px)
            </button>
            <button
              type="button"
              onClick={() => setBadgeStyle('featured')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                badgeStyle === 'featured'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Featured Banner (32px)
            </button>
            <button
              type="button"
              onClick={() => setBadgeStyle('directory')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                badgeStyle === 'directory'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Directory Card (40px)
            </button>
          </div>
        </div>

        {/* Metric selection & Theme selection */}
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <div className="text-xs font-medium text-zinc-400 mb-1.5">Displayed Data / Metric</div>
            <div className="flex items-center gap-1.5 bg-zinc-900/80 p-1 rounded-lg border border-white/10 flex-wrap">
              <button
                type="button"
                onClick={() => setBadgeMetric('status')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  badgeMetric === 'status'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Status (Verified)
              </button>
              <button
                type="button"
                onClick={() => setBadgeMetric('upvotes')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  badgeMetric === 'upvotes'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Upvotes
              </button>
              <button
                type="button"
                onClick={() => setBadgeMetric('views')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  badgeMetric === 'views'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Views
              </button>
              <button
                type="button"
                onClick={() => setBadgeMetric('installs')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  badgeMetric === 'installs'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Installs
              </button>
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-zinc-400 mb-1.5">Theme</div>
            <div className="flex items-center gap-1.5 bg-zinc-900/80 p-1 rounded-lg border border-white/10">
              <button
                type="button"
                onClick={() => setBadgeTheme('dark')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  badgeTheme === 'dark' ? 'bg-white/15 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Dark
              </button>
              <button
                type="button"
                onClick={() => setBadgeTheme('light')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  badgeTheme === 'light' ? 'bg-white text-zinc-900 font-semibold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Light
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Live Badge Preview */}
      <div className="mb-5">
        <div className="text-xs text-zinc-400 font-medium mb-1.5">Live Preview</div>
        <div
          className={`p-4 rounded-xl border flex items-center justify-center transition-colors min-h-[64px] ${
            badgeTheme === 'light' ? 'bg-slate-100 border-slate-300' : 'bg-zinc-950 border-white/10'
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/badge/${cleanId}${queryString}`}
            alt={`${serverName} AllMCPs Badge`}
            style={{ height: `${badgeHeight}px` }}
            className="max-w-full"
          />
        </div>
      </div>

      {/* Verification Bonus Callout */}
      <div className="mb-5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs text-emerald-200">
          <span className="font-semibold">Automatic Health & Verification Sync</span>: Adding this badge to your GitHub README triggers automated verification on the next health check run!
        </div>
      </div>

      {/* Code Snippet Outputs */}
      <div className="space-y-3">
        {/* Markdown Snippet */}
        <div>
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
            <span>Markdown (for GitHub README.md)</span>
          </div>
          <div className="relative group rounded-lg bg-zinc-950 border border-white/10 p-2.5">
            <pre className="text-xs text-zinc-300 font-mono overflow-x-auto pr-16">
              <code>{markdownSnippet}</code>
            </pre>
            <button
              type="button"
              onClick={() => copyToClipboard(markdownSnippet, 'markdown')}
              className="absolute top-2 right-2 p-1.5 rounded bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition-all flex items-center gap-1 text-xs"
            >
              {copiedKey === 'markdown' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="text-xs">{copiedKey === 'markdown' ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* HTML Snippet */}
        <div>
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
            <span>HTML (for Website or Blog)</span>
          </div>
          <div className="relative group rounded-lg bg-zinc-950 border border-white/10 p-2.5">
            <pre className="text-xs text-zinc-300 font-mono overflow-x-auto pr-16">
              <code>{htmlSnippet}</code>
            </pre>
            <button
              type="button"
              onClick={() => copyToClipboard(htmlSnippet, 'html')}
              className="absolute top-2 right-2 p-1.5 rounded bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition-all flex items-center gap-1 text-xs"
            >
              {copiedKey === 'html' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="text-xs">{copiedKey === 'html' ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
