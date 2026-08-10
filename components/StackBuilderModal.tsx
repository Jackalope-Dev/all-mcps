'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  Layers,
  Trash2,
  Copy,
  Check,
  Download,
  Share2,
  Sparkles,
  X,
  ExternalLink,
  Plus,
  Wrench,
  CheckCircle2,
  Bot,
} from 'lucide-react';
import { getStackServerIds, removeServerFromStack, toggleServerInStack, clearStack, buildStackShareUrl } from '@/lib/stackStore';
import { resolveInstallConfig } from '@/lib/installConfig';
import type { Server } from '@/lib/servers';
import { CopyBlock } from './ui/CopyBlock';
import { trackFeatureUse } from '@/lib/gtag';

type ClientFormat = 'claude' | 'cursor' | 'cline' | 'windsurf';

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

export function StackBuilderModal({
  allServers = [],
  isOpen = true,
  isModal = true,
  onClose,
}: StackBuilderProps) {
  const [serverIds, setServerIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<ClientFormat>('claude');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [fetchedCatalog, setFetchedCatalog] = useState<CatalogServerItem[]>([]);
  const fetchedRef = useRef(false);

  const refreshStack = () => {
    setServerIds(getStackServerIds());
  };

  useEffect(() => {
    refreshStack();
    window.addEventListener('mcp_stack_updated', refreshStack);
    return () => window.removeEventListener('mcp_stack_updated', refreshStack);
  }, []);

  // Fetch full directory catalog if any stack item is missing from `allServers`
  useEffect(() => {
    if (!isOpen || fetchedRef.current) return;
    fetchedRef.current = true;

    fetch('/api/search-index')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: any) => {
        if (data?.servers && Array.isArray(data.servers)) {
          setFetchedCatalog(data.servers);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen || !onClose || !isModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isModal]);

  const selectedServers = useMemo(() => {
    const map = new Map<string, CatalogServerItem>();
    for (const s of allServers) {
      map.set(s.id, s as unknown as CatalogServerItem);
    }
    for (const s of fetchedCatalog) {
      if (!map.has(s.id)) {
        map.set(s.id, s);
      }
    }
    return serverIds
      .map((id) => map.get(id) || { id, name: id, description: '', category: 'MCP Tool', url: '' })
      .filter(Boolean);
  }, [allServers, fetchedCatalog, serverIds]);

  const recommendedServers = useMemo(() => {
    const selectedSet = new Set(serverIds);
    const catalog = fetchedCatalog.length > 0 ? fetchedCatalog : (allServers as unknown as CatalogServerItem[]);
    if (!catalog.length) return [];

    const defaultStapleIds = ['github-mcp', 'postgresql-mcp', 'puppeteer-mcp', 'memory-mcp', 'sqlite-mcp', 'docker-mcp', 'slack-mcp', 'terminal-mcp'];
    const activeCategories = new Set(selectedServers.map((s) => s.category).filter(Boolean));

    const recs: CatalogServerItem[] = [];
    for (const item of catalog) {
      if (selectedSet.has(item.id)) continue;
      if (activeCategories.has(item.category) || defaultStapleIds.includes(item.id)) {
        recs.push(item);
      }
      if (recs.length >= 6) break;
    }
    return recs;
  }, [allServers, fetchedCatalog, serverIds, selectedServers]);

  const mergedConfig = useMemo(() => {
    const mcpServers: Record<string, unknown> = {};

    for (const server of selectedServers) {
      const cfg = resolveInstallConfig({
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

      const key = server.id.replace(/[^a-z0-9_-]/gi, '_');

      if (cfg.kind === 'remote') {
        mcpServers[key] = {
          url: cfg.url,
        };
      } else {
        mcpServers[key] = {
          command: cfg.command,
          args: cfg.args,
        };
      }
    }

    return JSON.stringify({ mcpServers }, null, 2);
  }, [selectedServers]);

  const handleCopyLink = () => {
    const shareUrl = buildStackShareUrl(serverIds);
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyPrompt = () => {
    trackFeatureUse('stack_builder', { action: 'copy_ai_prompt', count: selectedServers.length });
    const promptText = `Please configure the following Model Context Protocol (MCP) servers in my AI client:

${selectedServers
  .map(
    (s, i) =>
      `${i + 1}. **${s.name}** (${s.category})\n   - Description: ${s.description || 'MCP tool'}`
  )
  .join('\n\n')}

Merged mcpServers configuration JSON:
\`\`\`json
${mergedConfig}
\`\`\`

Please update my client configuration file and help me set any required API keys or environment variables.`;

    navigator.clipboard.writeText(promptText);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleDownload = () => {
    const filename = activeTab === 'cursor' ? 'mcp.json' : 'claude_desktop_config.json';
    const blob = new Blob([mergedConfig], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  const content = (
    <div
      style={{
        width: '100%',
        maxWidth: isModal ? '760px' : '100%',
        maxHeight: isModal ? '90vh' : 'none',
        backgroundColor: 'var(--bg-elevated)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        boxShadow: isModal ? '0 25px 50px -12px rgba(0, 0, 0, 0.6)' : 'var(--shadow-md)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div
        style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(90deg, rgba(0,229,255,0.05), transparent)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'var(--brand-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontWeight: 700,
            }}
          >
            <Layers size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              MCP Stack Builder
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
              {selectedServers.length} {selectedServers.length === 1 ? 'server' : 'servers'} selected in your multi-tool stack
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {selectedServers.length > 0 && (
            <button
              type="button"
              onClick={() => clearStack()}
              style={{
                background: 'none',
                border: 'none',
                color: '#ef4444',
                fontSize: '0.8rem',
                cursor: 'pointer',
                padding: '0.35rem 0.65rem',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <Trash2 size={13} /> Clear Stack
            </button>
          )}
          {isModal && onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                borderRadius: '8px',
                padding: '0.35rem',
                cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Content Body */}
      <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1 }}>
        {selectedServers.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '3rem 1.5rem',
              backgroundColor: 'rgba(255,255,255,0.02)',
              border: '1px dashed var(--border-color)',
              borderRadius: '12px',
            }}
          >
            <Wrench size={32} style={{ color: 'var(--accent-color)', margin: '0 auto 1rem', opacity: 0.8 }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Your MCP Stack is Empty
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto 1.5rem' }}>
              Click &ldquo;+ Add to Stack&rdquo; on any MCP server card to build a combined configuration file for your AI client.
            </p>
            <Link
              href="/browse"
              onClick={isModal ? onClose : undefined}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1.25rem',
                borderRadius: '8px',
                background: 'var(--brand-gradient)',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.85rem',
                textDecoration: 'none',
              }}
            >
              <Plus size={15} /> Browse Servers
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Selected Chips */}
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Selected Tools ({selectedServers.length})
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                {selectedServers.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.35rem 0.65rem',
                      backgroundColor: 'rgba(0, 229, 255, 0.1)',
                      border: '1px solid rgba(0, 229, 255, 0.3)',
                      borderRadius: '20px',
                      fontSize: '0.8rem',
                      color: 'var(--text-primary)',
                      fontWeight: 500,
                    }}
                  >
                    <span>{s.name}</span>
                    <button
                      type="button"
                      onClick={() => removeServerFromStack(s.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommended Complementary Tools */}
            {recommendedServers.length > 0 && (
              <div style={{ marginTop: '0.25rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.5rem' }}>
                  <Sparkles size={13} style={{ color: 'var(--accent-color)' }} /> Recommended to Complement Stack
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
                  {recommendedServers.map((rec) => (
                    <div
                      key={rec.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                        padding: '0.45rem 0.65rem',
                        backgroundColor: 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {rec.name}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {rec.category || 'MCP Tool'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          toggleServerInStack(rec.id);
                          trackFeatureUse('stack_builder', { action: 'add_recommended', server_id: rec.id });
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                          padding: '0.25rem 0.55rem',
                          borderRadius: '6px',
                          border: '1px solid var(--accent-color)',
                          backgroundColor: 'rgba(0, 229, 255, 0.1)',
                          color: 'var(--accent-color)',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        <Plus size={12} /> Add
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Format Selector Tabs */}
            <div>
              <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                {(['claude', 'cursor', 'cline', 'windsurf'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => {
                      trackFeatureUse('stack_builder', { action: 'switch_client', client: tab });
                      setActiveTab(tab);
                    }}
                    style={{
                      padding: '0.4rem 0.85rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer',
                      backgroundColor: activeTab === tab ? 'var(--accent-color)' : 'rgba(255,255,255,0.05)',
                      color: activeTab === tab ? '#020617' : 'var(--text-secondary)',
                      textTransform: 'capitalize',
                    }}
                  >
                    {tab === 'claude' ? 'Claude Desktop' : tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Merged Code Output */}
            <div>
              <CopyBlock code={mergedConfig} language="json" />
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      {selectedServers.length > 0 && (
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
            backgroundColor: 'var(--bg-elevated)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleCopyLink}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'rgba(255,255,255,0.05)',
                color: 'var(--text-primary)',
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              {copiedLink ? <CheckCircle2 size={14} style={{ color: '#34d399' }} /> : <Share2 size={14} />}
              {copiedLink ? 'Link Copied!' : 'Share Stack Link'}
            </button>

            <button
              type="button"
              onClick={handleCopyPrompt}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'rgba(0, 229, 255, 0.08)',
                color: 'var(--accent-color)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {copiedPrompt ? <CheckCircle2 size={14} style={{ color: '#34d399' }} /> : <Bot size={14} />}
              {copiedPrompt ? 'Prompt Copied!' : 'Copy AI Agent Prompt'}
            </button>
          </div>

          <button
            type="button"
            onClick={handleDownload}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 1rem',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--brand-gradient)',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            <Download size={15} /> Download Config
          </button>
        </div>
      )}
    </div>
  );

  if (!isModal) {
    return content;
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(2, 6, 23, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      {content}
    </div>
  );
}
