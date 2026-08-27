'use client';

import {
  Check,
  Copy,
  ExternalLink,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { parseServerName } from '../../lib/displayName';
import { trackShare } from '../../lib/gtag';
import { ServerAvatar } from './ServerAvatar';
import { toast } from './Toast';

interface BadgeEmbedBuilderProps {
  serverId?: string;
  serverName?: string;
  className?: string;
}

type IndexedServer = {
  id: string;
  name: string;
  description: string;
  category: string;
  logoUrl?: string | null;
};

export function BadgeEmbedBuilder({
  serverId = '',
  serverName = '',
  className = '',
}: BadgeEmbedBuilderProps) {
  const [badgeStyle, setBadgeStyle] = useState<
    'shield' | 'flat-square' | 'featured' | 'directory'
  >('shield');
  const [badgeMetric, setBadgeMetric] = useState<
    'status' | 'upvotes' | 'views' | 'installs'
  >('status');
  const [badgeTheme, setBadgeTheme] = useState<'dark' | 'light'>('dark');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Server selection state
  const [customId, setCustomId] = useState(serverId || 'allmcps-server');
  const [selectedServerName, setSelectedServerName] = useState(
    serverName || 'AllMCPs Server',
  );

  // Autocomplete search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [allServers, setAllServers] = useState<IndexedServer[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Check URL params on mount for pre-filling server ID (e.g. ?server=allmcps-server or ?id=sqlite-mcp)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const paramId =
      params.get('server') || params.get('id') || params.get('serverId');
    if (paramId) {
      setCustomId(paramId);
      const { displayName } = parseServerName(paramId);
      setSelectedServerName(displayName);
    }
  }, []);

  // Fetch search index on focus/search
  const fetchIndex = async () => {
    if (allServers.length > 0) return;
    try {
      setIsSearching(true);
      const res = await fetch('/api/search-index');
      if (res.ok) {
        const data = (await res.json()) as { servers?: IndexedServer[] } | null;
        if (data?.servers) {
          setAllServers(data.servers);
        }
      }
    } catch {
      // degrade silently
    } finally {
      setIsSearching(false);
    }
  };

  // Filter server suggestions
  const suggestions = searchQuery.trim()
    ? allServers
        .filter((s) => {
          const q = searchQuery.toLowerCase();
          return (
            s.id.toLowerCase().includes(q) ||
            s.name.toLowerCase().includes(q) ||
            s.category.toLowerCase().includes(q)
          );
        })
        .slice(0, 8)
    : allServers.slice(0, 8);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectServer = (server: IndexedServer) => {
    setCustomId(server.id);
    const { displayName } = parseServerName(server.name);
    setSelectedServerName(displayName);
    setSearchQuery('');
    setDropdownOpen(false);
  };

  const cleanId = customId.trim() || 'allmcps-server';
  const baseUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://allmcps.com';

  const queryParams = new URLSearchParams();
  if (badgeStyle !== 'shield') queryParams.set('style', badgeStyle);
  if (badgeMetric !== 'status') queryParams.set('metric', badgeMetric);
  if (badgeTheme !== 'dark') queryParams.set('theme', badgeTheme);

  const queryString = queryParams.toString()
    ? `?${queryParams.toString()}`
    : '';
  const badgeSrc = `${baseUrl}/api/badge/${cleanId}${queryString}`;
  const targetUrl = `${baseUrl}/mcp/${cleanId}`;

  const badgeHeight =
    badgeStyle === 'directory' ? 40 : badgeStyle === 'featured' ? 32 : 20;

  const markdownSnippet = `[![AllMCPs](${badgeSrc})](${targetUrl})`;
  const htmlSnippet = `<a href="${targetUrl}"><img src="${badgeSrc}" alt="${selectedServerName} on AllMCPs" height="${badgeHeight}" /></a>`;

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
      trackShare({ method: `copy_${key}`, serverId: cleanId });
      toast.success('Copied snippet to clipboard!');
    } catch {
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
    <div
      className={`badge-embed-builder ${className}`}
      style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}
    >
      {/* STEP 1: Select Your MCP Server */}
      <section
        style={{
          padding: '1.25rem 1.35rem',
          borderRadius: '14px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.85rem',
          }}
        >
          <span
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: 'var(--brand-cyan)',
              color: '#000',
              fontWeight: 800,
              fontSize: '0.85rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            1
          </span>
          <h3
            style={{
              fontSize: '1.1rem',
              fontWeight: 700,
              margin: 0,
              color: 'var(--text-primary)',
            }}
          >
            Select Your MCP Server
          </h3>
        </div>

        <p
          style={{
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            margin: '0 0 1rem',
            lineHeight: 1.5,
          }}
        >
          Search for an indexed MCP server from AllMCPs or enter a custom server
          ID below:
        </p>

        {/* Selected Server Card */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            padding: '0.85rem 1rem',
            borderRadius: '10px',
            background: 'var(--bg-muted)',
            border: '1px solid var(--border-color)',
            marginBottom: '1rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              minWidth: 0,
            }}
          >
            <ServerAvatar name={selectedServerName} size={36} />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  color: 'var(--text-primary)',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                }}
              >
                {selectedServerName}
              </div>
              <div
                style={{
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary)',
                  fontFamily: 'monospace',
                }}
              >
                ID: {cleanId}
              </div>
            </div>
          </div>
          <a
            href={`/mcp/${cleanId}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '0.78rem',
              color: 'var(--accent-color)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              textDecoration: 'none',
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            <span>View Listing</span>
            <ExternalLink size={12} />
          </a>
        </div>

        {/* Search & Selection Input Container */}
        <div ref={searchContainerRef} style={{ position: 'relative' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-secondary)',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => {
                  fetchIndex();
                  setDropdownOpen(true);
                }}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setDropdownOpen(true);
                }}
                placeholder="Search server by name or ID (e.g., github-mcp, postgres-mcp)..."
                className="form-input"
                style={{
                  paddingLeft: '2.35rem',
                  fontSize: '0.875rem',
                  width: '100%',
                  borderRadius: '8px',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Manual ID fallback input if user enters raw string */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginTop: '0.75rem',
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
            }}
          >
            <span>Or enter custom server ID manually:</span>
            <input
              type="text"
              value={customId}
              onChange={(e) => {
                const val = e.target.value;
                setCustomId(val);
                setSelectedServerName(
                  val ? parseServerName(val).displayName : 'Custom Server',
                );
              }}
              className="form-input"
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.78rem',
                fontFamily: 'monospace',
                maxWidth: '220px',
                borderRadius: '6px',
              }}
            />
          </div>

          {/* Autocomplete Dropdown List */}
          {dropdownOpen && suggestions.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                right: 0,
                maxHeight: '260px',
                overflowY: 'auto',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 50,
                padding: '0.35rem',
              }}
            >
              <div
                style={{
                  padding: '0.35rem 0.6rem',
                  fontSize: '0.72rem',
                  color: 'var(--text-secondary)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                Indexed Servers ({suggestions.length})
              </div>
              {suggestions.map((s) => {
                const { displayName } = parseServerName(s.name);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => selectServer(s)}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.65rem',
                      borderRadius: '6px',
                      border: 'none',
                      background:
                        s.id === cleanId
                          ? 'rgba(0, 229, 255, 0.12)'
                          : 'transparent',
                      color: 'var(--text-primary)',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <ServerAvatar
                      name={s.name}
                      logoUrl={s.logoUrl}
                      category={s.category}
                      size={24}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {displayName}
                      </div>
                      <div
                        style={{
                          fontSize: '0.72rem',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {s.category} &bull;{' '}
                        <span style={{ fontFamily: 'monospace' }}>{s.id}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* STEP 2: Customize Badge Style & Metrics */}
      <section
        style={{
          padding: '1.25rem 1.35rem',
          borderRadius: '14px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.85rem',
          }}
        >
          <span
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: 'var(--brand-cyan)',
              color: '#000',
              fontWeight: 800,
              fontSize: '0.85rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            2
          </span>
          <h3
            style={{
              fontSize: '1.1rem',
              fontWeight: 700,
              margin: 0,
              color: 'var(--text-primary)',
            }}
          >
            Customize Badge Style &amp; Theme
          </h3>
        </div>

        {/* Style & Metric Toggles */}
        <div
          className="badge-embed-builder-toggles"
          style={{ marginBottom: '1.25rem' }}
        >
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
          <div className="badge-embed-label">
            Live Preview for &quot;{selectedServerName}&quot;
          </div>
          <div
            className={`badge-embed-preview ${badgeTheme === 'light' ? 'badge-embed-preview--light' : 'badge-embed-preview--dark'}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/badge/${cleanId}${queryString}`}
              alt={`${selectedServerName} AllMCPs Badge`}
              style={{ height: `${badgeHeight}px`, maxWidth: '100%' }}
            />
          </div>
        </div>
      </section>

      {/* STEP 3: Copy Code Snippets */}
      <section
        style={{
          padding: '1.25rem 1.35rem',
          borderRadius: '14px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.85rem',
          }}
        >
          <span
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: 'var(--brand-cyan)',
              color: '#000',
              fontWeight: 800,
              fontSize: '0.85rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            3
          </span>
          <h3
            style={{
              fontSize: '1.1rem',
              fontWeight: 700,
              margin: 0,
              color: 'var(--text-primary)',
            }}
          >
            Copy Embed Snippet
          </h3>
        </div>

        {/* Verification Bonus Callout */}
        <div className="badge-embed-callout" style={{ marginBottom: '1rem' }}>
          <ShieldCheck
            size={16}
            style={{ color: '#34d399', flexShrink: 0, marginTop: '0.125rem' }}
          />
          <div className="badge-embed-callout-text">
            <span style={{ fontWeight: 600 }}>Automatic badge health sync</span>
            : we re-check your badge on each health run, so once it&apos;s live
            your reciprocal dofollow link stays credited automatically.
          </div>
        </div>

        {/* Reciprocal Dofollow Callout */}
        <div
          className="badge-embed-callout"
          style={{ marginBottom: '1.25rem' }}
        >
          <ShieldCheck
            size={16}
            style={{
              color: 'var(--accent-color)',
              flexShrink: 0,
              marginTop: '0.125rem',
            }}
          />
          <div className="badge-embed-callout-text">
            <span style={{ fontWeight: 600 }}>Reciprocal dofollow link</span>:
            These snippets are a genuine <strong>dofollow</strong> link back to
            AllMCPs (no <code>rel=&quot;nofollow&quot;</code>). Verify your site
            (badge, meta tag, or DNS) and keep the link dofollow, and your
            listing&apos;s website link becomes dofollow in return.
          </div>
        </div>

        {/* Claim & Verification Action Block */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            padding: '1rem 1.25rem',
            borderRadius: '12px',
            border: '1px solid rgba(0, 229, 255, 0.35)',
            background: 'var(--brand-gradient-soft)',
            marginBottom: '1.25rem',
          }}
        >
          <div style={{ flex: '1 1 260px' }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: '0.925rem',
                color: 'var(--text-primary)',
                marginBottom: '0.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <ShieldCheck size={18} style={{ color: 'var(--accent-color)' }} />
              Claim &amp; Verify Ownership for <code>{cleanId}</code>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: '0.775rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.45,
              }}
            >
              Claim this listing to get your Verified owner badge, manage
              description &amp; logo, and earn reciprocal SEO backlinks.
            </p>
          </div>
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <a
              href={`/mcp/${cleanId}/claim`}
              className="btn btn-primary"
              style={{
                fontSize: '0.825rem',
                padding: '0.5rem 0.95rem',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                fontWeight: 700,
              }}
            >
              Claim &amp; Verify Listing →
            </a>
            <a
              href={`/mcp/${cleanId}`}
              className="btn btn-secondary"
              style={{
                fontSize: '0.825rem',
                padding: '0.5rem 0.85rem',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              View Listing
            </a>
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
                {copiedKey === 'markdown' ? (
                  <Check size={14} style={{ color: '#34d399' }} />
                ) : (
                  <Copy size={14} />
                )}
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
                {copiedKey === 'html' ? (
                  <Check size={14} style={{ color: '#34d399' }} />
                ) : (
                  <Copy size={14} />
                )}
                <span>{copiedKey === 'html' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
