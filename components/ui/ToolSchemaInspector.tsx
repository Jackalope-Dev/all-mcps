'use client';

import React, { useState, useMemo } from 'react';
import { Wrench, Search, ChevronDown, ChevronUp, Code2, Sparkles, Terminal } from 'lucide-react';

export interface ToolItem {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

interface ToolSchemaInspectorProps {
  tools?: ToolItem[];
  aiFeatures?: string[];
  aiUseCases?: string[];
  serverName: string;
}

export function ToolSchemaInspector({
  tools = [],
  aiFeatures = [],
  aiUseCases = [],
  serverName,
}: ToolSchemaInspectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});

  const filteredTools = useMemo(() => {
    if (!searchQuery.trim()) return tools;
    const q = searchQuery.toLowerCase();
    return tools.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q))
    );
  }, [tools, searchQuery]);

  const toggleExpand = (name: string) => {
    setExpandedTools((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const hasTools = tools && tools.length > 0;
  const hasAiCapabilities = (aiFeatures && aiFeatures.length > 0) || (aiUseCases && aiUseCases.length > 0);

  if (!hasTools && !hasAiCapabilities) {
    return null;
  }

  return (
    <div style={{ marginBottom: '3rem' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '0.75rem',
        }}
      >
        <div>
          <h2
            style={{
              fontSize: '1.4rem',
              fontWeight: 700,
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Wrench size={22} style={{ color: 'var(--accent-color)' }} />
            Capabilities & Tool Schemas {hasTools ? `(${tools.length})` : ''}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
            Inspect callable tools, capabilities, and parameters exposed to AI agents by {serverName}.
          </p>
        </div>

        {hasTools && tools.length > 4 && (
          <div style={{ position: 'relative', width: '220px' }}>
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
                padding: '0.4rem 0.75rem 0.4rem 2.2rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'rgba(255, 255, 255, 0.04)',
                color: 'var(--text-primary)',
                fontSize: '0.8rem',
              }}
            />
          </div>
        )}
      </div>

      {hasTools ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.85rem' }}>
          {filteredTools.map((tool) => {
            const isExpanded = !!expandedTools[tool.name];
            const hasParams = tool.parameters && Object.keys(tool.parameters).length > 0;

            return (
              <div
                key={tool.name}
                className="surface"
                style={{
                  padding: '1.1rem',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  background: 'rgba(15, 23, 42, 0.6)',
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
                        color: '#00E5FF',
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
                      background: 'rgba(2, 6, 23, 0.9)',
                      borderRadius: '8px',
                      border: '1px solid rgba(0, 229, 255, 0.2)',
                      fontSize: '0.75rem',
                      fontFamily: 'monospace',
                      color: '#a5f3fc',
                    }}
                  >
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', marginBottom: '0.3rem', fontWeight: 600 }}>
                      INPUT SCHEMA / PARAMETERS
                    </div>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {JSON.stringify(tool.parameters, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Fallback: render AI-extracted tool capabilities if raw tool schemas aren't introspected yet */
        <div className="surface" style={{ padding: '1.25rem', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: 'var(--accent-color)', fontWeight: 600, fontSize: '0.9rem' }}>
            <Sparkles size={16} /> Extracted Tool Capabilities
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
            {aiFeatures.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <Terminal size={14} style={{ color: '#00E5FF', flexShrink: 0, marginTop: '0.2rem' }} />
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
