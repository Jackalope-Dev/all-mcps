'use client';

import {
  Bot,
  Check,
  Download,
  Layers,
  Link2,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { trackFeatureUse } from '@/lib/gtag';
import { resolveInstallConfig } from '@/lib/installConfig';
import type { Server } from '@/lib/servers';
import {
  buildStackShareUrl,
  clearStack,
  getStackServerIds,
  parseStackFromUrl,
  removeServerFromStack,
  saveStackServerIds,
  toggleServerInStack,
} from '@/lib/stackStore';
import { CodePanel, downloadText, useCopy } from './tools/CodePanel';
import { ServerPicker } from './tools/ServerPicker';

type ClientFormat = 'claude' | 'cursor' | 'cline' | 'windsurf' | 'prompt';

const CLIENT_TABS: Array<{
  id: ClientFormat;
  label: string;
  file: string;
  hint: string;
}> = [
  {
    id: 'claude',
    label: 'Claude',
    file: 'claude_desktop_config.json',
    hint: 'Claude Desktop → Settings → Developer → Edit Config',
  },
  {
    id: 'cursor',
    label: 'Cursor',
    file: 'mcp.json',
    hint: '.cursor/mcp.json in your project, or ~/.cursor/mcp.json',
  },
  {
    id: 'cline',
    label: 'Cline',
    file: 'cline_mcp_settings.json',
    hint: 'Cline / Roo Code → MCP Servers → Edit settings',
  },
  {
    id: 'windsurf',
    label: 'Windsurf',
    file: 'mcp_config.json',
    hint: '~/.codeium/windsurf/mcp_config.json',
  },
  {
    id: 'prompt',
    label: 'AI prompt',
    file: 'mcp_agent_prompt.md',
    hint: 'Paste into ChatGPT, Claude, or Cursor and let it set things up',
  },
];

interface StackBuilderProps {
  allServers?: Server[];
  isOpen?: boolean;
  isModal?: boolean;
  onClose?: () => void;
}

type CatalogServerItem = {
  id: string;
  name: string;
  description: string;
  category: string;
  url?: string;
  installKind?: string | null;
  installCommand?: string | null;
  installArgs?: string | null;
  installPackage?: string | null;
  installConfidence?: any;
  suggestedInstallCommand?: string | null;
  suggestedInstallArgs?: string | null;
  logoUrl?: string | null;
};

function resolveFor(server: CatalogServerItem) {
  return resolveInstallConfig({
    id: server.id,
    name: server.name,
    url: server.url || '',
    description: server.description,
    installKind: server.installKind,
    installCommand: server.installCommand,
    installArgs: server.installArgs,
    installPackage: server.installPackage,
    installConfidence: server.installConfidence,
    suggestedInstallCommand: server.suggestedInstallCommand,
    suggestedInstallArgs: server.suggestedInstallArgs,
  });
}

function configKey(id: string) {
  return id.replace(/[^a-z0-9_-]/gi, '_');
}

/** Removal waits for the row's exit animation before touching the store. */
const EXIT_MS = 200;

export function StackBuilderModal({
  allServers = [],
  isOpen = true,
  isModal = true,
  onClose,
}: StackBuilderProps) {
  const [serverIds, setServerIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState<ClientFormat>('claude');
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const [linkCopied, copyLink] = useCopy();
  const [promptCopied, copyPrompt] = useCopy();
  const [fetchedCatalog, setFetchedCatalog] = useState<CatalogServerItem[]>([]);
  const fetchedRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const refreshStack = React.useCallback(() => {
    setServerIds(getStackServerIds());
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlServers = params.get('servers');
      if (urlServers) {
        const parsed = parseStackFromUrl(urlServers);
        if (parsed.length > 0) {
          saveStackServerIds(parsed);
        }
      }
    }

    refreshStack();
    setHydrated(true);

    const handleStackUpdate = () => {
      refreshStack();
    };

    window.addEventListener('mcp_stack_updated', handleStackUpdate);
    window.addEventListener('popstate', handleStackUpdate);
    return () => {
      window.removeEventListener('mcp_stack_updated', handleStackUpdate);
      window.removeEventListener('popstate', handleStackUpdate);
    };
  }, [refreshStack]);

  // Look up only what the builder shows: stack entries missing from
  // `allServers` by id, and (once) the most-used listings for recommendations.
  const stackKey = serverIds.join(',');
  // biome-ignore lint/correctness/useExhaustiveDependencies: stackKey stands in for serverIds; fetchedCatalog is read for the known set only.
  useEffect(() => {
    if (!isOpen) return;
    const known = new Set([
      ...allServers.map((s) => s.id),
      ...fetchedCatalog.map((s) => s.id),
    ]);
    const missing = serverIds.filter((id) => !known.has(id));
    const urls: string[] = [];
    if (missing.length > 0) {
      urls.push(
        `/api/search-index?ids=${encodeURIComponent(missing.join(','))}`,
      );
    }
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      urls.push('/api/search-index?limit=20');
    }
    if (urls.length === 0) return;
    Promise.all(
      urls.map((u) =>
        fetch(u)
          .then((res) =>
            res.ok ? (res.json() as Promise<{ servers?: unknown }>) : null,
          )
          .catch(() => null),
      ),
    ).then((pages) => {
      const rows = pages.flatMap((d) =>
        Array.isArray(d?.servers) ? (d.servers as CatalogServerItem[]) : [],
      );
      if (rows.length === 0) return;
      setFetchedCatalog((prev) => {
        const map = new Map(prev.map((s) => [s.id, s]));
        for (const r of rows) map.set(r.id, r);
        return Array.from(map.values());
      });
    });
  }, [isOpen, stackKey, allServers]);

  // Modal: Escape closes, focus moves into the dialog, page scroll locks.
  useEffect(() => {
    if (!isOpen || !onClose || !isModal || !hydrated) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const prevFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [isOpen, onClose, isModal, hydrated]);

  const catalogMap = useMemo(() => {
    const map = new Map<string, CatalogServerItem>();
    for (const s of allServers) {
      map.set(s.id, s as unknown as CatalogServerItem);
    }
    for (const s of fetchedCatalog) {
      if (!map.has(s.id)) map.set(s.id, s);
    }
    return map;
  }, [allServers, fetchedCatalog]);

  const selectedServers = useMemo(
    () =>
      serverIds.map((id): CatalogServerItem => {
        const found = catalogMap.get(id);
        if (found) return found;
        const cleanName = `${id
          .replace(/-(mcp|server)$/gi, '')
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase())} MCP`;
        return {
          id,
          name: cleanName,
          description: 'Model Context Protocol Server',
          category: 'MCP Tool',
          url: '',
        };
      }),
    [catalogMap, serverIds],
  );

  const recommendedServers = useMemo(() => {
    const selectedSet = new Set(serverIds);
    const catalog =
      fetchedCatalog.length > 0
        ? fetchedCatalog
        : (allServers as unknown as CatalogServerItem[]);
    if (!catalog.length) return [];

    const defaultStapleIds = [
      'github-mcp',
      'postgresql-mcp',
      'puppeteer-mcp',
      'memory-mcp',
      'sqlite-mcp',
      'docker-mcp',
      'slack-mcp',
      'terminal-mcp',
    ];
    const activeCategories = new Set(
      selectedServers.map((s) => s.category).filter(Boolean),
    );

    const recs: CatalogServerItem[] = [];
    for (const item of catalog) {
      if (selectedSet.has(item.id)) continue;
      if (
        activeCategories.size === 0 ||
        activeCategories.has(item.category) ||
        defaultStapleIds.includes(item.id)
      ) {
        recs.push(item);
      }
      if (recs.length >= 6) break;
    }
    return recs;
  }, [allServers, fetchedCatalog, serverIds, selectedServers]);

  const mergedConfig = useMemo(() => {
    if (activeTab === 'prompt') {
      const serverDetails = selectedServers
        .map((server, i) => {
          const cfg = resolveFor(server);
          const installStr =
            cfg.kind === 'remote'
              ? `URL: ${cfg.url}`
              : `${cfg.command} ${cfg.args.join(' ')}`;
          return `${i + 1}. **${server.name}** (${server.category || 'MCP Tool'})\n   - Description: ${server.description || 'Model Context Protocol server'}\n   - Install Command: \`${installStr}\``;
        })
        .join('\n\n');

      const jsonSnippet: Record<string, unknown> = {};
      for (const server of selectedServers) {
        const cfg = resolveFor(server);
        jsonSnippet[configKey(server.id)] =
          cfg.kind === 'remote'
            ? { url: cfg.url }
            : { command: cfg.command, args: cfg.args };
      }

      return `Please configure the following Model Context Protocol (MCP) servers in my AI client:

${serverDetails}

Merged mcpServers JSON snippet:
\`\`\`json
${JSON.stringify({ mcpServers: jsonSnippet }, null, 2)}
\`\`\`

Please update my configuration file and guide me through setting any required API keys or environment variables.`;
    }

    const mcpServers: Record<string, unknown> = {};
    for (const server of selectedServers) {
      const cfg = resolveFor(server);
      const base =
        cfg.kind === 'remote'
          ? { url: cfg.url }
          : { command: cfg.command, args: cfg.args };
      mcpServers[configKey(server.id)] =
        activeTab === 'cline'
          ? { ...base, disabled: false, autoApprove: [] }
          : base;
    }
    return JSON.stringify({ mcpServers }, null, 2);
  }, [selectedServers, activeTab]);

  const handleCopyLink = () => {
    copyLink(buildStackShareUrl(serverIds));
  };

  const handleCopyPrompt = () => {
    trackFeatureUse('stack_builder', {
      action: 'copy_ai_prompt',
      count: selectedServers.length,
    });
    const promptText = `Please configure the following Model Context Protocol (MCP) servers in my AI client:

${selectedServers
  .map(
    (s, i) =>
      `${i + 1}. **${s.name}** (${s.category})\n   - Description: ${s.description || 'MCP tool'}`,
  )
  .join('\n\n')}

Merged mcpServers configuration JSON:
\`\`\`json
${mergedConfig}
\`\`\`

Please update my client configuration file and help me set any required API keys or environment variables.`;
    copyPrompt(promptText);
  };

  const activeClient =
    CLIENT_TABS.find((t) => t.id === activeTab) ?? CLIENT_TABS[0];

  const handleDownload = () => {
    downloadText(
      mergedConfig,
      activeClient.file,
      activeTab === 'prompt' ? 'text/markdown' : 'application/json',
    );
  };

  const removeWithExit = (id: string) => {
    setLeaving((prev) => new Set(prev).add(id));
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(
      () => {
        removeServerFromStack(id);
        setLeaving((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      },
      reduce ? 0 : EXIT_MS,
    );
  };

  const addServer = (id: string, action: string) => {
    if (serverIds.includes(id)) return;
    toggleServerInStack(id);
    trackFeatureUse('stack_builder', { action, server_id: id });
  };

  const addedIds = useMemo(() => new Set(serverIds), [serverIds]);

  if (!isOpen) return null;

  const count = selectedServers.length;

  const content = (
    <div
      id="stack-builder"
      className={`stk-root ${isModal ? 'stk-root--modal' : ''}`}
    >
      {isModal ? (
        <div className="stk-modal-head">
          <span className="stk-modal-icon" aria-hidden="true">
            <Layers size={18} />
          </span>
          <div>
            <h2 id="stk-modal-title" className="stk-modal-title">
              Your MCP stack
            </h2>
            <p className="stk-modal-sub">
              {count} {count === 1 ? 'server' : 'servers'} · one config for
              every client
            </p>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close stack builder"
              className="tl-icon-btn stk-modal-close"
            >
              <X size={18} />
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="tl-workspace stk-workspace">
        <section className="tl-pane" aria-labelledby="stk-pick">
          <div className="tl-pane-head">
            <h2 id="stk-pick" className="tl-pane-title">
              <span className="tl-step">1</span> Pick servers
              {count > 0 ? (
                <span className="stk-count tabular" aria-live="polite">
                  {count}
                </span>
              ) : null}
            </h2>
            {count > 0 ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm stk-clear"
                onClick={() => {
                  clearStack();
                  trackFeatureUse('stack_builder', { action: 'clear' });
                }}
              >
                <Trash2 size={14} aria-hidden="true" /> Clear
              </button>
            ) : null}
          </div>

          <ServerPicker
            source="index"
            addedIds={addedIds}
            placeholder="Search servers to add — e.g. github, postgres"
            onSelect={(hit) => {
              setFetchedCatalog((prev) =>
                prev.some((p) => p.id === hit.id) ? prev : [...prev, hit],
              );
              addServer(hit.id, 'add_search');
            }}
          />

          {!hydrated ? (
            <div className="stk-list" aria-hidden="true">
              <div className="skeleton" style={{ height: '3.25rem' }} />
              <div className="skeleton" style={{ height: '3.25rem' }} />
            </div>
          ) : count === 0 ? (
            <div className="tl-empty">
              <Layers size={22} aria-hidden="true" />
              <p className="tl-empty-title">Your stack is empty</p>
              <p style={{ margin: 0 }}>
                Search above, load a preset, or use{' '}
                <strong>Add to stack</strong> on any server page.
              </p>
              {isModal ? (
                <Link
                  href="/browse"
                  onClick={onClose}
                  className="btn btn-secondary btn-sm"
                >
                  Browse servers
                </Link>
              ) : (
                <a href="#stack-presets" className="btn btn-secondary btn-sm">
                  See preset stacks
                </a>
              )}
            </div>
          ) : (
            <ul className="stk-list" aria-label="Servers in your stack">
              {selectedServers.map((s) => (
                <li
                  key={s.id}
                  className={`stk-item ${leaving.has(s.id) ? 'is-leaving' : ''}`}
                >
                  <span className="stk-avatar" aria-hidden="true">
                    {s.logoUrl ? (
                      // biome-ignore lint/performance/noImgElement: tiny remote logo, sized by CSS.
                      <img src={s.logoUrl} alt="" loading="lazy" />
                    ) : (
                      s.name.slice(0, 1).toUpperCase()
                    )}
                  </span>
                  <span className="stk-item-text">
                    <Link
                      href={`/mcp/${s.id}`}
                      className="stk-item-name"
                      onClick={isModal ? onClose : undefined}
                    >
                      {s.name}
                    </Link>
                    <span className="stk-item-meta">
                      {s.category || 'MCP Tool'}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="tl-icon-btn tl-icon-btn--danger"
                    aria-label={`Remove ${s.name} from stack`}
                    onClick={() => removeWithExit(s.id)}
                  >
                    <X size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {recommendedServers.length > 0 ? (
            <div className="stk-recs">
              <p className="stk-recs-label">
                <Sparkles size={13} aria-hidden="true" />
                {count > 0 ? 'Pairs well with your stack' : 'Popular picks'}
              </p>
              <div className="stk-recs-row">
                {recommendedServers.map((rec) => (
                  <button
                    key={rec.id}
                    type="button"
                    className="chip"
                    title={rec.category || 'MCP Tool'}
                    onClick={() => addServer(rec.id, 'add_recommended')}
                  >
                    <Plus size={12} aria-hidden="true" />
                    {rec.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="tl-pane tl-sticky" aria-labelledby="stk-export">
          <div className="tl-pane-head">
            <h2 id="stk-export" className="tl-pane-title">
              <span className="tl-step">2</span> Export
            </h2>
          </div>
          <div className="tl-toolbar">
            <fieldset className="segmented fieldset-plain" aria-label="Client">
              {CLIENT_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={activeTab === tab.id}
                  onClick={() => {
                    trackFeatureUse('stack_builder', {
                      action: 'switch_client',
                      client: tab.id,
                    });
                    setActiveTab(tab.id);
                  }}
                >
                  {tab.id === 'prompt' ? (
                    <Bot size={13} aria-hidden="true" />
                  ) : null}
                  {tab.label}
                </button>
              ))}
            </fieldset>
          </div>
          <CodePanel
            title={activeClient.file}
            code={count > 0 ? mergedConfig : ''}
            language={activeTab === 'prompt' ? 'markdown' : 'json'}
            maxHeight={isModal ? '18rem' : '28rem'}
            snippetType="install_command"
            highlight={activeTab !== 'prompt'}
            empty={
              <>
                <Layers size={22} aria-hidden="true" />
                <span>
                  Add servers and the merged config appears here, live.
                </span>
              </>
            }
          />
          <p className="tl-hint">{activeClient.hint}</p>
          <div className="tl-actions stk-actions">
            <button
              type="button"
              className="btn btn-primary btn-md"
              onClick={handleDownload}
              disabled={count === 0}
            >
              <Download size={15} aria-hidden="true" /> Download{' '}
              {activeTab === 'prompt' ? 'prompt' : 'config'}
            </button>
            <button
              type="button"
              className={`btn btn-secondary btn-md tl-copy ${promptCopied ? 'is-copied' : ''}`}
              onClick={handleCopyPrompt}
              disabled={count === 0}
            >
              {promptCopied ? (
                <Check size={15} aria-hidden="true" />
              ) : (
                <Bot size={15} aria-hidden="true" />
              )}
              {promptCopied ? 'Prompt copied' : 'Copy AI prompt'}
            </button>
            <button
              type="button"
              className={`btn btn-ghost btn-md tl-copy ${linkCopied ? 'is-copied' : ''}`}
              onClick={handleCopyLink}
              disabled={count === 0}
            >
              {linkCopied ? (
                <Check size={15} aria-hidden="true" />
              ) : (
                <Link2 size={15} aria-hidden="true" />
              )}
              {linkCopied ? 'Link copied' : 'Share link'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );

  if (!isModal) {
    return content;
  }

  // Portal to <body> so no transformed/stacking ancestor (route transition
  // wrapper, deferred chrome) can trap the overlay under the site header.
  if (!hydrated) return null;
  return createPortal(
    <div className="stk-modal">
      {/* Backdrop: a click outside the dialog closes it. The dialog
          (position: relative, later in the DOM) paints above this button. */}
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close stack builder"
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          margin: 0,
          padding: 0,
          border: 0,
          background: 'transparent',
          cursor: 'default',
        }}
      />
      <div
        ref={dialogRef}
        className="stk-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stk-modal-title"
        tabIndex={-1}
      >
        {content}
      </div>
    </div>,
    document.body,
  );
}
