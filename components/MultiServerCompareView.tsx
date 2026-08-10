'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Scale,
  Sparkles,
  Zap,
  Check,
  Terminal,
  Lock,
  DollarSign,
  Star,
  Eye,
  Download,
  Heart,
  ShieldCheck,
  BadgeCheck,
  Layers,
  HelpCircle,
  Wrench,
  LayoutGrid,
  Table,
  FileText,
  ChevronRight,
  ArrowRight,
  Code2,
  Copy,
} from 'lucide-react';
import type { Server } from '@/lib/servers';
import { ServerAvatar } from '@/components/ui/ServerAvatar';
import { Badge } from '@/components/ui/Badge';
import { CopyBlock } from '@/components/ui/CopyBlock';
import { QualityBadge } from '@/components/ui/QualityBadge';
import { SafeMarkdown } from '@/components/ui/SafeMarkdown';
import { computeQualityScore, tierColor } from '@/lib/qualityScore';
import { resolveInstallConfig, type ResolvedInstall } from '@/lib/installConfig';
import { isVerifiedListing, isFeaturedListing } from '@/lib/featuredStatus';
import { parseCategoryLabel, categorySlug } from '@/lib/categories';
import { parseServerName } from '@/lib/displayName';

interface MultiServerCompareViewProps {
  servers: Server[];
}

function formatAuthLabel(auth?: string | null): string {
  if (!auth || auth === 'none') return 'No Auth Required';
  if (auth === 'api_key') return 'API Key Required';
  if (auth === 'oauth') return 'OAuth 2.0';
  if (auth === 'byok') return 'Bring Your Own Key';
  return auth;
}

function formatPricingLabel(pricing?: string | null): string {
  if (!pricing || pricing === 'free') return 'Free / Open Source';
  if (pricing === 'freemium') return 'Freemium';
  if (pricing === 'paid') return 'Paid Service';
  if (pricing === 'byok') return 'BYOK (Pay Provider)';
  return pricing;
}

function getToolsList(s: Server): string[] {
  if (s.tools && Array.isArray(s.tools) && s.tools.length > 0) {
    return s.tools.map((t) => t.name).filter(Boolean);
  }
  if (s.aiFeatures && Array.isArray(s.aiFeatures) && s.aiFeatures.length > 0) {
    return s.aiFeatures;
  }
  return [];
}

/** Determines a "Best For" summary statement based on metadata */
function deriveBestFor(s: Server, install: ResolvedInstall, toolsCount: number): string {
  const cat = parseCategoryLabel(s.category).label;
  if (install.kind === 'remote') {
    return `Hosted ${cat} integration with zero local process management`;
  }
  if (toolsCount > 10) {
    return `Comprehensive ${cat} automation with ${toolsCount}+ specialized tools`;
  }
  if (s.authType === 'api_key' || s.authType === 'oauth') {
    return `Secure enterprise ${cat} connectivity requiring authentication`;
  }
  return `Lightweight, open-source local ${cat} stdio workflow`;
}

export function MultiServerCompareView({ servers }: MultiServerCompareViewProps) {
  const [viewMode, setViewMode] = useState<'narrative' | 'grid' | 'matrix'>('narrative');
  const [selectedClient, setSelectedClient] = useState<'claude' | 'cursor' | 'windsurf' | 'vscode'>('claude');

  // Process server details
  const enriched = useMemo(() => {
    return servers.map((s) => {
      const { displayName, org } = parseServerName(s.name);
      const quality = computeQualityScore(s);
      const install = resolveInstallConfig({
        id: s.id,
        name: s.name,
        url: s.url,
        description: s.description,
        installKind: s.installKind,
        installCommand: s.installCommand,
        installArgs: s.installArgs,
        installPackage: s.installPackage,
        installConfidence: s.installConfidence,
        suggestedInstallCommand: s.suggestedInstallCommand,
        suggestedInstallArgs: s.suggestedInstallArgs,
      });
      const tools = getToolsList(s);
      const key = s.id.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      const categoryLabel = parseCategoryLabel(s.category).label;
      const bestFor = deriveBestFor(s, install, tools.length);

      // Construct individual JSON config
      const envObj: Record<string, string> = {};
      if (s.aiEnvVars && s.aiEnvVars.length > 0) {
        s.aiEnvVars.forEach((v) => {
          envObj[v] = `YOUR_${v}_HERE`;
        });
      }

      const singleConfigObj =
        install.kind === 'remote'
          ? { mcpServers: { [key]: { url: install.url } } }
          : {
              mcpServers: {
                [key]: {
                  command: install.command,
                  args: install.args,
                  ...(Object.keys(envObj).length > 0 ? { env: envObj } : {}),
                },
              },
            };

      return {
        server: s,
        displayName,
        org,
        quality,
        install,
        tools,
        key,
        categoryLabel,
        bestFor,
        envObj,
        singleConfigJson: JSON.stringify(singleConfigObj, null, 2),
      };
    });
  }, [servers]);

  // Combined mcpServers JSON snippet for all servers in comparison
  const combinedConfigJson = useMemo(() => {
    const mcpServers: Record<string, unknown> = {};

    enriched.forEach(({ key, install, envObj }) => {
      if (install.kind === 'remote') {
        mcpServers[key] = { url: install.url };
      } else {
        mcpServers[key] = {
          command: install.command,
          args: install.args,
          ...(Object.keys(envObj).length > 0 ? { env: envObj } : {}),
        };
      }
    });

    return JSON.stringify({ mcpServers }, null, 2);
  }, [enriched]);

  // Comparative metrics
  const distinctCategories = useMemo(
    () => new Set(enriched.map((e) => e.categoryLabel)).size,
    [enriched]
  );

  const remoteCount = useMemo(
    () => enriched.filter((e) => e.install.kind === 'remote').length,
    [enriched]
  );

  const stdioCount = enriched.length - remoteCount;

  const clientPaths = {
    claude: { title: 'Claude Desktop', file: 'claude_desktop_config.json', hint: 'Add to root mcpServers' },
    cursor: { title: 'Cursor AI', file: '~/.cursor/mcp.json', hint: 'Global MCP configuration' },
    windsurf: { title: 'Windsurf Codeium', file: '~/.codeium/windsurf/mcp_config.json', hint: 'Cascade MCP config' },
    vscode: { title: 'VS Code MCP', file: '.vscode/mcp.json', hint: 'Workspace or Global settings' },
  };

  return (
    <div style={{ width: '100%', maxWidth: '1440px', margin: '0 auto', padding: '1.5rem 1rem 4rem 1rem' }}>
      {/* Top Header & Breadcrumbs */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          <Link href="/compare" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
            Compare
          </Link>
          <ChevronRight size={14} style={{ flexShrink: 0 }} />
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
            {enriched.map((e) => e.displayName).join(' vs ')}
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--brand-cyan)', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              <Sparkles size={16} /> Multi-Server Evaluation & Breakdown
            </div>
            <h1 style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.5rem 0', letterSpacing: '-0.02em' }}>
              {enriched.map((e) => e.displayName).join(' vs ')}
            </h1>
            <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', margin: 0, maxWidth: '800px' }}>
              Evaluating <strong>{enriched.length} MCP servers</strong> side-by-side: breakdown of distinctions, capability matrices, security profiles, and combined installation configs.
            </p>
          </div>

          {/* View Switcher Controls */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '4px',
              gap: '4px',
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode('narrative')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 0.85rem',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: viewMode === 'narrative' ? 'var(--brand-cyan)' : 'transparent',
                color: viewMode === 'narrative' ? '#000000' : 'var(--text-secondary)',
                fontWeight: viewMode === 'narrative' ? 700 : 500,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <FileText size={15} /> Distinctions
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 0.85rem',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: viewMode === 'grid' ? 'var(--brand-cyan)' : 'transparent',
                color: viewMode === 'grid' ? '#000000' : 'var(--text-secondary)',
                fontWeight: viewMode === 'grid' ? 700 : 500,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <LayoutGrid size={15} /> Grid Cards
            </button>
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 0.85rem',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: viewMode === 'matrix' ? 'var(--brand-cyan)' : 'transparent',
                color: viewMode === 'matrix' ? '#000000' : 'var(--text-secondary)',
                fontWeight: viewMode === 'matrix' ? 700 : 500,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Table size={15} /> Spec Matrix
            </button>
          </div>
        </div>
      </div>

      {/* Overview Stat Chips Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '0.85rem',
          marginBottom: '2.5rem',
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '1rem 1.25rem',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            Compared Servers
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
            {enriched.length} Options
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '1rem 1.25rem',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            Category Coverage
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--brand-cyan)', marginTop: '0.2rem' }}>
            {distinctCategories} {distinctCategories === 1 ? 'Category' : 'Distinct Domains'}
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '1rem 1.25rem',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            Execution Transports
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
            {stdioCount > 0 && `${stdioCount} Stdio`}
            {stdioCount > 0 && remoteCount > 0 && ' · '}
            {remoteCount > 0 && `${remoteCount} Cloud SSE`}
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '1rem 1.25rem',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            Total Tools Exposed
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#34d399', marginTop: '0.2rem' }}>
            {enriched.reduce((acc, curr) => acc + curr.tools.length, 0)} Total Tools
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* MODE 1: NARRATIVE & DISTINCTIONS VIEW                */}
      {/* ---------------------------------------------------- */}
      {viewMode === 'narrative' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          {/* Executive Distinctions Cards */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <HelpCircle size={20} style={{ color: 'var(--brand-cyan)' }} />
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Which Server Should You Choose?
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
              {enriched.map(({ server: s, displayName, org, install, tools, categoryLabel, bestFor, singleConfigJson }) => (
                <div
                  key={s.id}
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '14px',
                    padding: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                        <ServerAvatar name={s.name} logoUrl={s.logoUrl} size={40} />
                        <div style={{ minWidth: 0 }}>
                          <Link href={`/mcp/${s.id}`} style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-primary)', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {displayName}
                          </Link>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {categoryLabel} {org ? `· ${org}` : ''}
                          </div>
                        </div>
                      </div>

                      <QualityBadge server={s} compact />
                    </div>

                    {/* Best For Highlight */}
                    <div
                      style={{
                        padding: '0.75rem 0.9rem',
                        backgroundColor: 'rgba(0, 229, 255, 0.06)',
                        border: '1px solid rgba(0, 229, 255, 0.2)',
                        borderRadius: '10px',
                        marginBottom: '1rem',
                        fontSize: '0.85rem',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <strong style={{ color: 'var(--brand-cyan)' }}>Best For:</strong> {bestFor}
                    </div>

                    {/* Key Specs & Distinctions List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Terminal size={14} style={{ color: 'var(--brand-cyan)', flexShrink: 0 }} />
                        <span>Transport: <strong style={{ color: 'var(--text-primary)' }}>{install.kind === 'remote' ? 'Remote HTTP/SSE' : 'Local Subprocess (stdio)'}</strong></span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Lock size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                        <span>Auth: <strong style={{ color: 'var(--text-primary)' }}>{formatAuthLabel(s.authType)}</strong></span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <DollarSign size={14} style={{ color: '#34d399', flexShrink: 0 }} />
                        <span>Pricing: <strong style={{ color: 'var(--text-primary)' }}>{formatPricingLabel(s.pricingModel)}</strong></span>
                      </div>

                      {s.aiEnvVars && s.aiEnvVars.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginTop: '0.2rem' }}>
                          <Code2 size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0, marginTop: '2px' }} />
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                            <span>Keys:</span>
                            {s.aiEnvVars.map((v) => (
                              <code key={v} style={{ fontSize: '0.725rem', padding: '0.1rem 0.35rem', borderRadius: '4px', backgroundColor: 'var(--bg-color)' }}>
                                {v}
                              </code>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Tools Spotlight */}
                    {tools.length > 0 && (
                      <div style={{ marginBottom: '1.25rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem' }}>
                          Key Tools ({tools.length})
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                          {tools.slice(0, 6).map((t) => (
                            <Badge key={t} variant="default" style={{ fontSize: '0.7rem', backgroundColor: 'var(--bg-color)' }}>
                              {t}
                            </Badge>
                          ))}
                          {tools.length > 6 && (
                            <Badge variant="category" style={{ fontSize: '0.7rem' }}>
                              +{tools.length - 6} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Individual Config Snippet */}
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>
                      Server Config
                    </div>
                    <CopyBlock code={singleConfigJson} language="json" serverId={s.id} />
                    <div style={{ marginTop: '0.5rem' }}>
                      <Link href={`/mcp/${s.id}`} style={{ fontSize: '0.8rem', color: 'var(--brand-cyan)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}>
                        View full details page <ArrowRight size={12} />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Tools & Capability Overview Section */}
          <section
            style={{
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-color)',
              borderRadius: '14px',
              padding: '1.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Wrench size={18} style={{ color: 'var(--brand-cyan)' }} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Tool Capability Comparison
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
              {enriched.map(({ server: s, displayName, tools }) => (
                <div key={s.id} style={{ backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                    {displayName} <span style={{ color: 'var(--brand-cyan)', fontWeight: 600, fontSize: '0.8rem' }}>({tools.length} tools)</span>
                  </div>
                  {tools.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                      {tools.map((t) => (
                        <span key={t} style={{ fontSize: '0.75rem', padding: '0.2rem 0.45rem', borderRadius: '6px', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
                          <code>{t}</code>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                      No explicitly listed tools. Capabilities defined via prompt templates or general API adapters.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODE 2: GRID CARDS VIEW                              */}
      {/* ---------------------------------------------------- */}
      {viewMode === 'grid' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
          {enriched.map(({ server: s, displayName, org, install, tools, categoryLabel, singleConfigJson }) => (
            <div
              key={s.id}
              style={{
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border-color)',
                borderRadius: '14px',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                    <ServerAvatar name={s.name} logoUrl={s.logoUrl} size={42} />
                    <div style={{ minWidth: 0 }}>
                      <Link href={`/mcp/${s.id}`} style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-primary)', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {displayName}
                      </Link>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {categoryLabel} {org ? `· ${org}` : ''}
                      </div>
                    </div>
                  </div>

                  <QualityBadge server={s} compact />
                </div>

                {/* Badges row */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '1rem' }}>
                  {isVerifiedListing(s) && (
                    <Badge variant="official" style={{ fontSize: '0.7rem' }}>
                      <BadgeCheck size={12} style={{ marginRight: '3px' }} /> Verified
                    </Badge>
                  )}
                  {isFeaturedListing(s) && (
                    <Badge variant="success" style={{ fontSize: '0.7rem' }}>
                      Featured
                    </Badge>
                  )}
                  <Badge variant="category" style={{ fontSize: '0.7rem' }}>
                    {categoryLabel}
                  </Badge>
                </div>

                {/* Description */}
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1rem', minHeight: '2.8rem' }}>
                  <SafeMarkdown content={s.description || 'No description provided.'} isInline />
                </div>

                {/* Specs List */}
                <div style={{ backgroundColor: 'var(--bg-color)', padding: '0.85rem', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '1rem', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Transport</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{install.kind === 'remote' ? 'Remote HTTP/SSE' : 'Local stdio'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Auth</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatAuthLabel(s.authType)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Pricing</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatPricingLabel(s.pricingModel)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>GitHub Stars</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      <Star size={12} style={{ color: '#f5c518', marginRight: '3px' }} />
                      {(s.githubStars || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Install Config */}
              <div>
                <CopyBlock code={singleConfigJson} language="json" serverId={s.id} />
                <Link
                  href={`/mcp/${s.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    padding: '0.5rem',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    color: 'var(--text-primary)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                    marginTop: '0.5rem',
                  }}
                >
                  Explore Server <ChevronRight size={14} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODE 3: COMPACT SPEC MATRIX VIEW                     */}
      {/* ---------------------------------------------------- */}
      {viewMode === 'matrix' && (
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ overflowX: 'auto', borderRadius: '14px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-elevated)', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: `${200 + enriched.length * 240}px` }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                  <th style={{ padding: '1.25rem', width: '200px', minWidth: '180px', color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Specification
                  </th>
                  {enriched.map(({ server: s, displayName, categoryLabel }) => (
                    <th key={s.id} style={{ padding: '1.25rem', minWidth: '220px', color: 'var(--text-primary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <ServerAvatar name={s.name} logoUrl={s.logoUrl} size={32} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <Link href={`/mcp/${s.id}`} style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 700, fontSize: '1rem', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {displayName}
                          </Link>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{categoryLabel}</div>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Summary */}
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Summary</td>
                  {enriched.map(({ server: s }) => (
                    <td key={s.id} style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.4 }}>
                      <SafeMarkdown content={s.description || '—'} isInline />
                    </td>
                  ))}
                </tr>

                {/* Category */}
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Category</td>
                  {enriched.map(({ server: s, categoryLabel }) => (
                    <td key={s.id} style={{ padding: '1rem 1.25rem', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                      <Link href={`/categories/${categorySlug(s.category)}`} style={{ color: 'var(--brand-cyan)', textDecoration: 'none', fontWeight: 600 }}>
                        {categoryLabel}
                      </Link>
                    </td>
                  ))}
                </tr>

                {/* Quality Score */}
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Quality Signal</td>
                  {enriched.map(({ server: s, quality }) => (
                    <td key={s.id} style={{ padding: '1rem 1.25rem' }}>
                      <span style={{ fontWeight: 700, color: tierColor(quality.tier) }}>
                        {quality.score}/100 <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>({quality.tier})</span>
                      </span>
                    </td>
                  ))}
                </tr>

                {/* Transport Protocol */}
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Transport Protocol</td>
                  {enriched.map(({ server: s, install }) => (
                    <td key={s.id} style={{ padding: '1rem 1.25rem', color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
                        <Terminal size={14} style={{ color: 'var(--brand-cyan)' }} />
                        {install.kind === 'remote' ? 'Remote HTTP/SSE' : 'Local Subprocess (stdio)'}
                      </span>
                    </td>
                  ))}
                </tr>

                {/* Auth Requirement */}
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Auth Requirement</td>
                  {enriched.map(({ server: s }) => (
                    <td key={s.id} style={{ padding: '1rem 1.25rem', color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                      {formatAuthLabel(s.authType)}
                    </td>
                  ))}
                </tr>

                {/* Pricing */}
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Pricing Model</td>
                  {enriched.map(({ server: s }) => (
                    <td key={s.id} style={{ padding: '1rem 1.25rem', color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                      {formatPricingLabel(s.pricingModel)}
                    </td>
                  ))}
                </tr>

                {/* Tools Count & Highlights */}
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Tools Exposed</td>
                  {enriched.map(({ server: s, tools }) => (
                    <td key={s.id} style={{ padding: '1rem 1.25rem', fontSize: '0.85rem' }}>
                      <div style={{ fontWeight: 700, color: 'var(--brand-cyan)', marginBottom: '0.35rem' }}>{tools.length} Tools</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {tools.slice(0, 4).map((t) => (
                          <Badge key={t} variant="default" style={{ fontSize: '0.65rem' }}>
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Stats / Stars */}
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>GitHub Stars</td>
                  {enriched.map(({ server: s }) => (
                    <td key={s.id} style={{ padding: '1rem 1.25rem', color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Star size={14} style={{ color: '#f5c518' }} /> {(s.githubStars || 0).toLocaleString()}
                      </span>
                    </td>
                  ))}
                </tr>

                {/* Config Snippet */}
                <tr>
                  <td style={{ padding: '1.25rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', verticalAlign: 'top' }}>
                    Install Config
                  </td>
                  {enriched.map(({ server: s, singleConfigJson }) => (
                    <td key={s.id} style={{ padding: '1.25rem', verticalAlign: 'top' }}>
                      <CopyBlock code={singleConfigJson} language="json" serverId={s.id} />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* COMBINED CONFIGURATION GENERATOR                     */}
      {/* ---------------------------------------------------- */}
      <section
        style={{
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid rgba(0, 229, 255, 0.3)',
          borderRadius: '16px',
          padding: '1.75rem',
          marginTop: '2rem',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--brand-cyan)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
              <Layers size={15} /> All-in-One Integration
            </div>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Combined Client Configuration (`mcpServers`)
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
              Use all {enriched.length} servers together in a single configuration file. Copy and paste into your AI client setup.
            </p>
          </div>

          {/* Client Tab Selector */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {(Object.keys(clientPaths) as Array<keyof typeof clientPaths>).map((key) => {
              const info = clientPaths[key];
              const isSelected = selectedClient === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedClient(key)}
                  style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: '8px',
                    border: isSelected ? '1px solid var(--brand-cyan)' : '1px solid var(--border-color)',
                    backgroundColor: isSelected ? 'rgba(0, 229, 255, 0.12)' : 'var(--bg-color)',
                    color: isSelected ? 'var(--brand-cyan)' : 'var(--text-secondary)',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  {info.title}
                </button>
              );
            })}
          </div>
        </div>

        {/* Client File Location Hint */}
        <div
          style={{
            padding: '0.65rem 0.85rem',
            borderRadius: '8px',
            backgroundColor: 'var(--bg-color)',
            border: '1px solid var(--border-color)',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Code2 size={15} style={{ color: 'var(--brand-cyan)', flexShrink: 0 }} />
          <span>
            Target file: <code style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{clientPaths[selectedClient].file}</code> ({clientPaths[selectedClient].hint})
          </span>
        </div>

        {/* Combined JSON Block */}
        <CopyBlock code={combinedConfigJson} language="json" snippetType="combined_mcp_config" toastMessage={`Copied combined config for ${enriched.length} servers`} />
      </section>
    </div>
  );
}
