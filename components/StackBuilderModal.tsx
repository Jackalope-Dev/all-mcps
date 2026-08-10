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
} from 'lucide-react';
import { getStackServerIds, removeServerFromStack, clearStack, buildStackShareUrl } from '@/lib/stackStore';
import { resolveInstallConfig } from '@/lib/installConfig';
import type { Server } from '@/lib/servers';
import { CopyBlock } from './ui/CopyBlock';

type ClientFormat = 'claude' | 'cursor' | 'cline' | 'windsurf';

interface StackBuilderProps {
  allServers?: Server[];
  isOpen?: boolean;
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

export function StackBuilderModal({ allServers = [], isOpen = true, onClose }: StackBuilderProps) {
  const [serverIds, setServerIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<ClientFormat>('claude');
  const [copiedLink, setCopiedLink] = useState(false);
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
      .then((data) => {
        if (data?.servers && Array.isArray(data.servers)) {
          setFetchedCatalog(data.servers);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen || !onClose) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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
      <div
        style={{
          width: '100%',
          maxWidth: '760px',
          maxHeight: '90vh',
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
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
                color: '#020617',
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
            {onClose && (
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
                onClick={onClose}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1.25rem',
                  borderRadius: '8px',
                  background: 'var(--brand-gradient)',
                  color: '#020617',
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
                        backgroundColor: 'rgba(0, 229, 255, 0.08)',
                        border: '1px solid rgba(0, 229, 255, 0.25)',
                        borderRadius: '20px',
                        fontSize: '0.8rem',
                        color: 'var(--accent-color)',
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

              {/* Format Selector Tabs */}
              <div>
                <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                  {(['claude', 'cursor', 'cline', 'windsurf'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
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
              backgroundColor: 'var(--bg-elevated)',
            }}
          >
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
              onClick={handleDownload}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 1rem',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--brand-gradient)',
                color: '#020617',
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
    </div>
  );
}
