'use client';

import React, { useState, useMemo } from 'react';
import { Wrench, Search, ChevronDown, ChevronUp, Code2, Sparkles, Terminal, ShieldCheck, FileText } from 'lucide-react';
import { IconTooltip } from './IconTooltip';
import { CollapsibleText } from '../CollapsibleText';

export interface ToolItem {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

interface SchemaProperty {
  type?: string | string[];
  description?: string;
  [key: string]: unknown;
}

/** Recognizes a standard JSON Schema object shape so params can render as a readable list instead of raw JSON. */
function getSchemaProperties(parameters: Record<string, unknown> | undefined) {
  if (!parameters || typeof parameters !== 'object') return null;
  const properties = (parameters as { properties?: Record<string, SchemaProperty> }).properties;
  if (!properties || typeof properties !== 'object') return null;
  const required = new Set(
    Array.isArray((parameters as { required?: unknown }).required)
      ? ((parameters as { required?: string[] }).required as string[])
      : []
  );
  return Object.entries(properties).map(([name, schema]) => ({
    name,
    type: typeof schema?.type === 'string' ? schema.type : Array.isArray(schema?.type) ? schema.type.join(' | ') : undefined,
    description: typeof schema?.description === 'string' ? schema.description : undefined,
    required: required.has(name),
  }));
}

interface ToolSchemaInspectorProps {
  tools?: ToolItem[];
  aiFeatures?: string[];
  aiUseCases?: string[];
  serverName: string;
  /** 'introspected' (live MCP handshake) | 'readme' (best-effort static parse) | null/undefined. */
  toolsSource?: string | null;
}

const TOOLS_SOURCE_BADGE: Record<
  string,
  { label: string; icon: typeof ShieldCheck; color: string; background: string; border: string; title: string }
> = {
  introspected: {
    label: 'Verified live',
    icon: ShieldCheck,
    // Themed via var() — matches .badge-verified, and stays readable in light
    // mode (the dark-mode #34d399 is low-contrast on a light background).
    color: 'var(--verified-green)',
    background: 'var(--verified-green-bg)',
    border: 'var(--verified-green-border)',
    title: 'Captured by calling this server’s live tools/list endpoint.',
  },
  readme: {
    label: 'Self-reported',
    icon: FileText,
    color: '#94a3b8',
    background: 'rgba(148, 163, 184, 0.12)',
    border: 'rgba(148, 163, 184, 0.25)',
    title: 'Parsed from the repository README, not verified against a live server — may be incomplete or out of date.',
  },
};

export function ToolSchemaInspector({
  tools = [],
  aiFeatures = [],
  aiUseCases = [],
  serverName,
  toolsSource,
}: ToolSchemaInspectorProps) {
  const sourceBadge = toolsSource ? TOOLS_SOURCE_BADGE[toolsSource] : undefined;
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});
  /** Collapse long tool lists so install stays above the fold on mobile. */
  const [showAllTools, setShowAllTools] = useState(false);
  const TOOL_PREVIEW_COUNT = 6;

  const filteredTools = useMemo(() => {
    if (!searchQuery.trim()) return tools;
    const q = searchQuery.toLowerCase();
    return tools.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q))
    );
  }, [tools, searchQuery]);

  const visibleTools = useMemo(() => {
    if (searchQuery.trim() || showAllTools) return filteredTools;
    return filteredTools.slice(0, TOOL_PREVIEW_COUNT);
  }, [filteredTools, searchQuery, showAllTools]);
  const hiddenToolCount = Math.max(0, filteredTools.length - visibleTools.length);

  const toggleExpand = (name: string) => {
    setExpandedTools((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const hasTools = tools && tools.length > 0;
  const hasAiCapabilities = (aiFeatures && aiFeatures.length > 0) || (aiUseCases && aiUseCases.length > 0);

  /**
   * Rough context-budget signal: ~4 chars/token is the standard back-of-envelope
   * estimate (no tokenizer dependency needed for a directory-wide approximation).
   * Counts name + description + full parameter schema, since all three get sent
   * to the model on every tool-enabled request, not just the visible summary.
   */
  const approxTokens = useMemo(() => {
    if (!hasTools) return 0;
    const chars = tools.reduce((sum, t) => {
      const paramsChars = t.parameters ? JSON.stringify(t.parameters).length : 0;
      return sum + t.name.length + (t.description?.length ?? 0) + paramsChars;
    }, 0);
    return Math.round(chars / 4);
  }, [tools, hasTools]);

  if (!hasTools && !hasAiCapabilities) {
    return null;
  }

  return (
    <div style={{ marginBottom: '3rem', minWidth: 0, maxWidth: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '0.75rem',
          minWidth: 0,
        }}
      >
        <div style={{ minWidth: 0, flex: '1 1 12rem' }}>
          <h2
            style={{
              fontSize: 'clamp(1.15rem, 4vw, 1.4rem)',
              fontWeight: 700,
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              flexWrap: 'wrap',
            }}
          >
            <Wrench size={22} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
            Capabilities & Tool Schemas {hasTools ? `(${tools.length})` : ''}
            {hasTools && approxTokens > 0 && (
              <IconTooltip
                label={`Approximate context cost: ~${approxTokens} tokens`}
                trigger={
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      background: 'var(--bg-muted)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '999px',
                      padding: '0.2rem 0.6rem',
                    }}
                  >
                    ~{approxTokens >= 1000 ? `${(approxTokens / 1000).toFixed(1)}k` : approxTokens} tokens
                  </span>
                }
              >
                <span className="mcp-icon-tooltip-title">
                  <Sparkles size={14} style={{ color: 'var(--accent-color)' }} /> ~{approxTokens >= 1000 ? `${(approxTokens / 1000).toFixed(1)}k` : approxTokens} tokens
                </span>
                <span className="mcp-icon-tooltip-body">
                  Approximate context cost of this server&rsquo;s tool schemas (~4 chars/token), before any tool is called. Actual usage depends on your client and model.
                </span>
              </IconTooltip>
            )}
            {hasTools && sourceBadge && (
              <span
                title={sourceBadge.title}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: sourceBadge.color,
                  background: sourceBadge.background,
                  border: `1px solid ${sourceBadge.border}`,
                  borderRadius: '999px',
                  padding: '0.2rem 0.6rem',
                }}
              >
                <sourceBadge.icon size={11} />
                {sourceBadge.label}
              </span>
            )}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
            Inspect callable tools, capabilities, and parameters exposed to AI agents by {serverName}.
          </p>
        </div>

        {hasTools && tools.length > 4 && (
          <div style={{ position: 'relative', width: '100%', maxWidth: '220px', minWidth: 0 }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-secondary)',
              }}
            />
            <input
              type="text"
              placeholder="Search tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                maxWidth: '100%',
                boxSizing: 'border-box',
                padding: '0.4rem 0.75rem 0.4rem 2.2rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-muted)',
                color: 'var(--text-primary)',
                fontSize: '0.8rem',
              }}
            />
          </div>
        )}
      </div>

      {hasTools ? (
        <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '0.85rem', minWidth: 0 }}>
          {visibleTools.map((tool) => {
            const isExpanded = !!expandedTools[tool.name];
            const hasParams = tool.parameters && Object.keys(tool.parameters).length > 0;
            const schemaProps = hasParams ? getSchemaProperties(tool.parameters) : null;
            const showRawKey = `${tool.name}__raw`;
            const showRaw = !!expandedTools[showRawKey];

            return (
              <div
                key={tool.name}
                className="surface"
                style={{
                  padding: '1.1rem',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-elevated)',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                    <Code2 size={15} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
                    <code
                      style={{
                        fontSize: '0.875rem',
                        fontWeight: 700,
                        color: 'var(--accent-color)',
                        wordBreak: 'break-word',
                        fontFamily: 'monospace',
                      }}
                    >
                      {tool.name}
                    </code>
                  </div>
                  {hasParams && (
                    <button
                      type="button"
                      onClick={() => toggleExpand(tool.name)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                        fontSize: '0.72rem',
                        padding: '0.1rem 0.3rem',
                        borderRadius: '4px',
                      }}
                    >
                      <span>Schema</span>
                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  )}
                </div>

                {tool.description ? (
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                    {tool.description}
                  </p>
                ) : (
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, fontStyle: 'italic', opacity: 0.7 }}>
                    Callable MCP tool function
                  </p>
                )}

                {hasParams && isExpanded && (
                  <div
                    style={{
                      marginTop: '0.5rem',
                      padding: '0.65rem 0.85rem',
                      background: 'var(--bg-muted)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      fontSize: '0.75rem',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', fontWeight: 600, fontFamily: 'monospace' }}>
                        INPUT SCHEMA / PARAMETERS
                      </div>
                      {schemaProps && schemaProps.length > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleExpand(showRawKey)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--accent-color)',
                            cursor: 'pointer',
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            padding: 0,
                            textDecoration: 'underline',
                            textUnderlineOffset: '2px',
                          }}
                        >
                          {showRaw ? 'View as list' : 'View raw JSON'}
                        </button>
                      )}
                    </div>

                    {schemaProps && schemaProps.length > 0 && !showRaw ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                        {schemaProps.map((prop) => (
                          <div key={prop.name} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.2rem' }}>
                              <code style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)' }}>{prop.name}</code>
                              {prop.type && (
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '0.05rem 0.4rem' }}>
                                  {prop.type}
                                </span>
                              )}
                              {prop.required && (
                                <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--accent-color)' }}>required</span>
                              )}
                            </div>
                            {prop.description ? (
                              <div style={{ color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                                <CollapsibleText collapsedLines={2}>{prop.description}</CollapsibleText>
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic', opacity: 0.7 }}>No description provided</span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                        {JSON.stringify(tool.parameters, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {hiddenToolCount > 0 && (
          <button
            type="button"
            className="collapsible-text-toggle"
            style={{ marginTop: '0.85rem' }}
            onClick={() => setShowAllTools(true)}
          >
            Show all {filteredTools.length} tools
          </button>
        )}
        {showAllTools && filteredTools.length > TOOL_PREVIEW_COUNT && !searchQuery.trim() && (
          <button
            type="button"
            className="collapsible-text-toggle"
            style={{ marginTop: '0.5rem' }}
            onClick={() => setShowAllTools(false)}
          >
            Show fewer tools
          </button>
        )}
        </>
      ) : (
        /* Fallback: render AI-extracted tool capabilities if raw tool schemas aren't introspected yet */
        <div className="surface" style={{ padding: '1.25rem', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: 'var(--accent-color)', fontWeight: 600, fontSize: '0.9rem' }}>
            <Sparkles size={16} /> Extracted Tool Capabilities
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '0.75rem' }}>
            {aiFeatures.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <Terminal size={14} style={{ color: 'var(--accent-color)', flexShrink: 0, marginTop: '0.2rem' }} />
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
