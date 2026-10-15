'use client';

import { ExternalLink, Search, ShieldCheck, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { parseServerName } from '../../lib/displayName';
import { trackShare } from '../../lib/gtag';
import { CodePanel } from '../tools/CodePanel';
import { ServerAvatar } from './ServerAvatar';

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

  // Server selection state
  const [customId, setCustomId] = useState(serverId || 'allmcps-server');
  const [selectedServerName, setSelectedServerName] = useState(
    serverName || 'AllMCPs Server',
  );

  // Autocomplete search state
  const [searchQuery, setSearchQuery] = useState('');
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

  // Suggestions come from the server as you type (popular listings before
  // the first keystroke). It used to download the whole catalog on focus.
  const fetchIndex = async (q = '') => {
    try {
      const res = await fetch(
        `/api/search-index?limit=8${q ? `&q=${encodeURIComponent(q)}` : ''}`,
      );
      if (res.ok) {
        const data = (await res.json()) as { servers?: IndexedServer[] } | null;
        setAllServers(data?.servers ?? []);
      }
    } catch {
      // degrade silently
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchIndex only reads its argument.
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) return;
    const timer = setTimeout(() => void fetchIndex(q), 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const suggestions = allServers.slice(0, 8);

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

  const cleanId =
    encodeURIComponent(customId.trim().replace(/[^a-zA-Z0-9_.-]/g, '')) ||
    'allmcps-server';
  // Origin is read after mount so SSR and first client render match
  // (reading window during render caused a hydration mismatch).
  const [baseUrl, setBaseUrl] = useState('https://allmcps.com');
  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

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

  const safeServerName = selectedServerName.replace(/["<>]/g, '');
  const markdownSnippet = `[![AllMCPs](${badgeSrc})](${targetUrl})`;
  const htmlSnippet = `<a href="${targetUrl}"><img src="${badgeSrc}" alt="${safeServerName} on AllMCPs" height="${badgeHeight}" /></a>`;

  const styleOptions: { value: typeof badgeStyle; label: string }[] = [
    { value: 'shield', label: 'Standard' },
    { value: 'flat-square', label: 'Flat square' },
    { value: 'featured', label: 'Featured banner' },
    { value: 'directory', label: 'Directory card' },
  ];

  const metricOptions: { value: typeof badgeMetric; label: string }[] = [
    { value: 'status', label: 'Status' },
    { value: 'upvotes', label: 'Upvotes' },
    { value: 'views', label: 'Views' },
    { value: 'installs', label: 'Installs' },
  ];

  const showDropdown = dropdownOpen && suggestions.length > 0;

  return (
    <div className={`bdg ${className}`.trim()}>
      <div className="bdg-grid">
        <div className="bdg-controls">
          <section className="tl-pane" aria-labelledby="bdg-server">
            <h2 id="bdg-server" className="tl-pane-title">
              <span className="tl-step">1</span> Server
            </h2>

            <div className="bdg-selected">
              <ServerAvatar name={selectedServerName} size={36} />
              <div className="bdg-selected-text">
                <span className="bdg-selected-name">{selectedServerName}</span>
                <span className="bdg-selected-id">{cleanId}</span>
              </div>
              <a
                href={`/mcp/${cleanId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="tl-icon-btn"
                aria-label="View listing (opens in new tab)"
                title="View listing"
              >
                <ExternalLink size={15} />
              </a>
            </div>

            <div ref={searchContainerRef} className="tl-picker">
              <div className="tl-picker-input">
                <Search size={16} aria-hidden="true" />
                <input
                  type="search"
                  value={searchQuery}
                  onFocus={() => {
                    if (allServers.length === 0) void fetchIndex();
                    setDropdownOpen(true);
                  }}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setDropdownOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setDropdownOpen(false);
                  }}
                  placeholder="Search by name or ID — e.g. github, postgres"
                  className="tl-input"
                  aria-label="Search for your MCP server"
                  autoComplete="off"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="tl-icon-btn bdg-clear"
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>

              {showDropdown ? (
                <div
                  className="tl-picker-pop"
                  role="listbox"
                  aria-label="Servers"
                >
                  {suggestions.map((s) => {
                    const { displayName } = parseServerName(s.name);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        role="option"
                        aria-selected={s.id === cleanId}
                        onClick={() => selectServer(s)}
                        className={`tl-picker-option ${s.id === cleanId ? 'is-added' : ''}`}
                      >
                        <ServerAvatar
                          name={s.name}
                          logoUrl={s.logoUrl}
                          category={s.category}
                          size={28}
                        />
                        <span className="tl-picker-text">
                          <span className="tl-picker-name">{displayName}</span>
                          <span className="tl-picker-meta">
                            {s.category} · {s.id}
                          </span>
                        </span>
                        {s.id === cleanId ? (
                          <span className="tl-picker-add">Selected</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <label className="tl-field">
              <span className="tl-label">
                Or enter a server ID{' '}
                <span className="tl-label-opt">(from its /mcp/ URL)</span>
              </span>
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
                className="tl-input is-mono"
                spellCheck={false}
              />
            </label>
          </section>

          <section className="tl-pane" aria-labelledby="bdg-style">
            <h2 id="bdg-style" className="tl-pane-title">
              <span className="tl-step">2</span> Style
            </h2>
            <div className="tl-field">
              <span className="tl-label" id="bdg-style-l">
                Format
              </span>
              <fieldset
                className="bdg-chips fieldset-plain"
                aria-labelledby="bdg-style-l"
              >
                {styleOptions.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    className="chip"
                    aria-pressed={badgeStyle === value}
                    onClick={() => setBadgeStyle(value)}
                  >
                    {label}
                  </button>
                ))}
              </fieldset>
            </div>
            <div className="tl-field">
              <span className="tl-label" id="bdg-metric-l">
                Shows
              </span>
              <fieldset
                className="bdg-chips fieldset-plain"
                aria-labelledby="bdg-metric-l"
              >
                {metricOptions.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    className="chip"
                    aria-pressed={badgeMetric === value}
                    onClick={() => setBadgeMetric(value)}
                  >
                    {label}
                  </button>
                ))}
              </fieldset>
            </div>
            <div className="tl-field">
              <span className="tl-label" id="bdg-theme-l">
                Theme
              </span>
              <fieldset
                className="segmented fieldset-plain"
                aria-labelledby="bdg-theme-l"
              >
                <button
                  type="button"
                  aria-pressed={badgeTheme === 'dark'}
                  onClick={() => setBadgeTheme('dark')}
                >
                  Dark
                </button>
                <button
                  type="button"
                  aria-pressed={badgeTheme === 'light'}
                  onClick={() => setBadgeTheme('light')}
                >
                  Light
                </button>
              </fieldset>
            </div>
          </section>
        </div>

        <section className="tl-pane bdg-output" aria-labelledby="bdg-copy">
          <h2 id="bdg-copy" className="tl-pane-title">
            <span className="tl-step">3</span> Preview &amp; copy
          </h2>
          <div
            className={`bdg-preview ${badgeTheme === 'light' ? 'bdg-preview--light' : ''}`}
          >
            {/* biome-ignore lint/performance/noImgElement: live SVG badge from our API, sized by the chosen style. */}
            <img
              key={`${cleanId}${queryString}`}
              src={`/api/badge/${cleanId}${queryString}`}
              alt={`${selectedServerName} AllMCPs Badge`}
              style={{ height: `${badgeHeight}px`, maxWidth: '100%' }}
            />
          </div>

          <CodePanel
            title="Markdown · README.md"
            code={markdownSnippet}
            language="text"
            highlight={false}
            onCopied={() =>
              trackShare({ method: 'copy_markdown', serverId: cleanId })
            }
          />
          <CodePanel
            title="HTML · website or blog"
            code={htmlSnippet}
            language="text"
            highlight={false}
            onCopied={() =>
              trackShare({ method: 'copy_html', serverId: cleanId })
            }
          />

          <ul className="bdg-notes">
            <li>
              <ShieldCheck size={15} aria-hidden="true" />
              <span>
                <strong>Reciprocal dofollow link.</strong> These snippets are a
                genuine dofollow link back to AllMCPs (no{' '}
                <code>rel=&quot;nofollow&quot;</code>). Verify your site (badge,
                meta tag, or DNS) and keep the link dofollow, and your
                listing&apos;s website link becomes dofollow in return.
              </span>
            </li>
            <li>
              <ShieldCheck size={15} aria-hidden="true" />
              <span>
                <strong>Automatic badge health sync.</strong> We re-check your
                badge on each health run, so once it&apos;s live your reciprocal
                dofollow link stays credited automatically.
              </span>
            </li>
          </ul>

          <div className="bdg-claim">
            <div>
              <p className="bdg-claim-title">
                Own <code>{cleanId}</code>?
              </p>
              <p className="bdg-claim-sub">
                Claim this listing to get your Verified owner badge, manage
                description &amp; logo, and earn reciprocal SEO backlinks.
              </p>
            </div>
            <div className="tl-actions">
              <a
                href={`/mcp/${cleanId}/claim`}
                className="btn btn-primary btn-sm"
              >
                Claim &amp; verify
              </a>
              <a href={`/mcp/${cleanId}`} className="btn btn-ghost btn-sm">
                View listing
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
