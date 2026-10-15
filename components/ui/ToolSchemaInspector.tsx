'use client';

import { ChevronDown, FileText, Search, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CollapsibleText } from '../CollapsibleText';

interface ToolItem {
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
  const properties = (
    parameters as { properties?: Record<string, SchemaProperty> }
  ).properties;
  if (!properties || typeof properties !== 'object') return null;
  const required = new Set(
    Array.isArray((parameters as { required?: unknown }).required)
      ? ((parameters as { required?: string[] }).required as string[])
      : [],
  );
  return Object.entries(properties).map(([name, schema]) => ({
    name,
    type:
      typeof schema?.type === 'string'
        ? schema.type
        : Array.isArray(schema?.type)
          ? schema.type.join(' | ')
          : undefined,
    description:
      typeof schema?.description === 'string' ? schema.description : undefined,
    required: required.has(name),
  }));
}

interface ToolSchemaInspectorProps {
  tools?: ToolItem[];
  /** 'introspected' (live MCP handshake) | 'readme' (best-effort static parse) | null/undefined. */
  toolsSource?: string | null;
}

const TOOLS_SOURCE_BADGE: Record<
  string,
  { label: string; icon: typeof ShieldCheck; tone: string; title: string }
> = {
  introspected: {
    label: 'Verified live',
    icon: ShieldCheck,
    tone: 'ok',
    title: 'Captured by calling this server’s live tools/list endpoint.',
  },
  readme: {
    label: 'Self-reported',
    icon: FileText,
    tone: 'muted',
    title:
      'Parsed from the repository README, not verified against a live server — may be incomplete or out of date.',
  },
};

const TOOL_PREVIEW_COUNT = 8;

/**
 * Tools list for /mcp/[id]: one row per tool (name + description), expanding
 * in place to the parameter list, raw JSON schema, and a JSON-RPC call
 * preview. The section heading lives on the page; this renders the toolbar
 * (source + context-cost signal + search) and the list.
 */
export function ToolSchemaInspector({
  tools = [],
  toolsSource,
}: ToolSchemaInspectorProps) {
  const sourceBadge = toolsSource ? TOOLS_SOURCE_BADGE[toolsSource] : undefined;
  const [searchQuery, setSearchQuery] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tools;
    return tools.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q),
    );
  }, [tools, searchQuery]);

  const visible =
    searchQuery.trim() || showAll
      ? filtered
      : filtered.slice(0, TOOL_PREVIEW_COUNT);
  const hiddenCount = Math.max(0, filtered.length - visible.length);

  const toggle = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  /**
   * Rough context-budget signal: ~4 chars/token is the standard back-of-envelope
   * estimate (no tokenizer dependency needed for a directory-wide approximation).
   * Counts name + description + full parameter schema, since all three get sent
   * to the model on every tool-enabled request, not just the visible summary.
   */
  const approxTokens = useMemo(() => {
    const chars = tools.reduce((sum, t) => {
      const paramsChars = t.parameters
        ? JSON.stringify(t.parameters).length
        : 0;
      return sum + t.name.length + (t.description?.length ?? 0) + paramsChars;
    }, 0);
    return Math.round(chars / 4);
  }, [tools]);

  if (tools.length === 0) return null;

  const tokenLabel =
    approxTokens >= 1000
      ? `${(approxTokens / 1000).toFixed(1)}k`
      : String(approxTokens);

  return (
    <div className="lst-tools">
      <div className="lst-tools-bar">
        <div className="lst-tools-meta">
          {sourceBadge && (
            <span
              className={`lst-pill lst-pill--${sourceBadge.tone}`}
              title={sourceBadge.title}
            >
              <sourceBadge.icon size={12} aria-hidden="true" />
              {sourceBadge.label}
            </span>
          )}
          {approxTokens > 0 && (
            <span
              className="lst-pill"
              title="Approximate context cost of these tool schemas (~4 chars/token), before any tool is called. Actual usage depends on your client and model."
            >
              ~{tokenLabel} tokens of context
            </span>
          )}
        </div>
        {tools.length > 4 && (
          <label className="lst-tools-search">
            <Search size={14} aria-hidden="true" />
            <input
              type="search"
              placeholder="Filter tools"
              aria-label="Filter tools"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>
        )}
      </div>

      <ul className="lst-tool-list">
        {visible.map((tool) => {
          const isOpen = !!expanded[tool.name];
          const hasParams =
            tool.parameters && Object.keys(tool.parameters).length > 0;
          const props = hasParams ? getSchemaProperties(tool.parameters) : null;
          const rawKey = `${tool.name}__raw`;
          const showRaw = !!expanded[rawKey];
          const panelId = `tool-${tool.name.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
          return (
            <li
              key={tool.name}
              className={`lst-tool${isOpen ? ' is-open' : ''}`}
            >
              <button
                type="button"
                className="lst-tool-row"
                onClick={() => hasParams && toggle(tool.name)}
                aria-expanded={hasParams ? isOpen : undefined}
                aria-controls={hasParams ? panelId : undefined}
                disabled={!hasParams}
              >
                <span className="lst-tool-text">
                  <code className="lst-tool-name">{tool.name}</code>
                  <span className="lst-tool-desc">
                    {tool.description || 'Callable MCP tool'}
                  </span>
                </span>
                {hasParams && (
                  <span className="lst-tool-meta">
                    {props
                      ? `${props.length} param${props.length === 1 ? '' : 's'}`
                      : 'schema'}
                    <ChevronDown size={14} aria-hidden="true" />
                  </span>
                )}
              </button>

              {hasParams && isOpen && (
                <div id={panelId} className="lst-tool-panel">
                  <div className="lst-tool-panel-head">
                    <span className="lst-mono-label">Parameters</span>
                    {props && props.length > 0 && (
                      <button
                        type="button"
                        className="lst-textbtn"
                        onClick={() => toggle(rawKey)}
                      >
                        {showRaw ? 'View as list' : 'View raw JSON'}
                      </button>
                    )}
                  </div>
                  {props && props.length > 0 && !showRaw ? (
                    <dl className="lst-params">
                      {props.map((prop) => (
                        <div key={prop.name} className="lst-param">
                          <dt>
                            <code>{prop.name}</code>
                            {prop.type && (
                              <span className="lst-param-type">
                                {prop.type}
                              </span>
                            )}
                            {prop.required && (
                              <span className="lst-param-req">required</span>
                            )}
                          </dt>
                          <dd>
                            {prop.description ? (
                              <CollapsibleText collapsedLines={2}>
                                {prop.description}
                              </CollapsibleText>
                            ) : (
                              <span className="lst-muted-sm">
                                No description
                              </span>
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <pre className="lst-tool-json">
                      {JSON.stringify(tool.parameters, null, 2)}
                    </pre>
                  )}
                  <div className="lst-tool-panel-head">
                    <span className="lst-mono-label">JSON-RPC request</span>
                    <a href="/tools/playground" className="lst-textbtn">
                      Test in Playground &rarr;
                    </a>
                  </div>
                  <pre className="lst-tool-json lst-tool-json--rpc">
                    {JSON.stringify(
                      {
                        jsonrpc: '2.0',
                        id: 1,
                        method: 'tools/call',
                        params: {
                          name: tool.name,
                          arguments: props
                            ? Object.fromEntries(
                                props.map((p) => [
                                  p.name,
                                  `<${p.type || 'value'}>`,
                                ]),
                              )
                            : {},
                        },
                      },
                      null,
                      2,
                    )}
                  </pre>
                </div>
              )}
            </li>
          );
        })}
        {visible.length === 0 && (
          <li className="lst-tool-empty">
            No tools match &ldquo;{searchQuery}&rdquo;.
          </li>
        )}
      </ul>

      {hiddenCount > 0 && (
        <button
          type="button"
          className="btn btn-ghost btn-sm lst-tools-more"
          onClick={() => setShowAll(true)}
        >
          Show all {filtered.length} tools
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
