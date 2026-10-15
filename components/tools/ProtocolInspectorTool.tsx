'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { trackFeatureUse } from '../../lib/gtag';
import { EditorPane } from './CodePanel';

interface PresetPayload {
  name: string;
  desc: string;
  json: string;
}

const PRESET_PAYLOADS: PresetPayload[] = [
  {
    name: 'Tool Execution (Text Output)',
    desc: 'Standard success response for callTool returning plain text.',
    json: JSON.stringify(
      {
        jsonrpc: '2.0',
        id: 1,
        result: {
          content: [
            {
              type: 'text',
              text: 'Successfully processed 42 records. Database migration completed in 140ms.',
            },
          ],
          isError: false,
        },
      },
      null,
      2,
    ),
  },
  {
    name: 'Tool Execution (Image Payload)',
    desc: 'MCP tool response returning a generated PNG diagram or chart in base64.',
    json: JSON.stringify(
      {
        jsonrpc: '2.0',
        id: 2,
        result: {
          content: [
            {
              type: 'text',
              text: 'Generated architecture diagram below:',
            },
            {
              type: 'image',
              data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
              mimeType: 'image/png',
            },
          ],
        },
      },
      null,
      2,
    ),
  },
  {
    name: 'Tool List (tools/list schema)',
    desc: 'List of tools returned by an MCP server to the client on handshake.',
    json: JSON.stringify(
      {
        jsonrpc: '2.0',
        id: 3,
        result: {
          tools: [
            {
              name: 'execute_query',
              description:
                'Execute a read-only SQL query against the Postgres database.',
              inputSchema: {
                type: 'object',
                properties: {
                  query: { type: 'string', description: 'SQL query to run' },
                },
                required: ['query'],
              },
            },
          ],
        },
      },
      null,
      2,
    ),
  },
  {
    name: 'Broken Payload (Common Syntax & Spec Errors)',
    desc: 'Payload with missing JSON-RPC version, missing content type, and invalid mimeType.',
    json: JSON.stringify(
      {
        id: 4,
        result: {
          content: [
            {
              text: 'Here is some raw data without a type property',
            },
            {
              type: 'image',
              data: 'invalid_base64_string',
            },
          ],
        },
      },
      null,
      2,
    ),
  },
];

interface AuditCheck {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
}

interface InspectionResult {
  isValidJson: boolean;
  jsonRpcValid: boolean;
  checks: AuditCheck[];
  extractedContent: Array<{
    type: string;
    text?: string;
    data?: string;
    mimeType?: string;
    raw: any;
  }>;
  isErrorState: boolean;
  toolsCount?: number;
}

function inspectPayload(rawJson: string): InspectionResult {
  const checks: AuditCheck[] = [];
  let parsed: any = null;

  try {
    parsed = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('expected a JSON object');
    }
  } catch (err: any) {
    return {
      isValidJson: false,
      jsonRpcValid: false,
      checks: [
        {
          id: 'json_syntax',
          label: 'JSON Syntax',
          status: 'fail',
          message: `JSON parse error: ${err?.message || 'Invalid syntax'}`,
        },
      ],
      extractedContent: [],
      isErrorState: false,
    };
  }

  checks.push({
    id: 'json_syntax',
    label: 'JSON Syntax',
    status: 'pass',
    message: 'Valid JSON format.',
  });

  // Check JSON-RPC 2.0 standard
  const hasJsonRpc = parsed.jsonrpc === '2.0';
  if (hasJsonRpc) {
    checks.push({
      id: 'jsonrpc_ver',
      label: 'JSON-RPC Specification',
      status: 'pass',
      message: 'Header contains jsonrpc: "2.0".',
    });
  } else {
    checks.push({
      id: 'jsonrpc_ver',
      label: 'JSON-RPC Specification',
      status: 'warn',
      message:
        'Missing jsonrpc: "2.0" field. MCP protocol transport requires standard JSON-RPC 2.0 wrappers.',
    });
  }

  const payloadRoot = parsed.result || parsed;
  const extractedContent: Array<{
    type: string;
    text?: string;
    data?: string;
    mimeType?: string;
    raw: any;
  }> = [];
  let isErrorState = false;
  let toolsCount: number | undefined;

  // Check tools list
  if (Array.isArray(payloadRoot.tools)) {
    toolsCount = payloadRoot.tools.length;
    checks.push({
      id: 'tools_list',
      label: 'Tools Listing (tools/list)',
      status: 'pass',
      message: `Found ${toolsCount} tool schema definition(s).`,
    });

    payloadRoot.tools.forEach((tool: any, idx: number) => {
      if (!tool.name || typeof tool.name !== 'string') {
        checks.push({
          id: `tool_name_${idx}`,
          label: `Tool #${idx + 1} Name`,
          status: 'fail',
          message: `Tool at index ${idx} is missing a string "name" property.`,
        });
      }
      if (!tool.inputSchema || typeof tool.inputSchema !== 'object') {
        checks.push({
          id: `tool_schema_${idx}`,
          label: `Tool #${idx + 1} Input Schema`,
          status: 'fail',
          message: `Tool "${tool.name || idx}" is missing an "inputSchema" object.`,
        });
      }
    });
  }

  // Check CallTool content block
  if (payloadRoot.content !== undefined) {
    if (!Array.isArray(payloadRoot.content)) {
      checks.push({
        id: 'content_array',
        label: 'Content Block Structure',
        status: 'fail',
        message: '"content" property must be an array of content objects.',
      });
    } else {
      checks.push({
        id: 'content_array',
        label: 'Content Block Structure',
        status: 'pass',
        message: `Found array of ${payloadRoot.content.length} content item(s).`,
      });

      payloadRoot.content.forEach((item: any, idx: number) => {
        if (!item || typeof item !== 'object') {
          checks.push({
            id: `content_item_${idx}`,
            label: `Content Item #${idx + 1}`,
            status: 'fail',
            message: `Content item #${idx + 1} is not a valid object.`,
          });
          return;
        }

        if (!item.type) {
          checks.push({
            id: `content_type_${idx}`,
            label: `Content Item #${idx + 1} Type`,
            status: 'fail',
            message: `Missing required "type" string (expected "text", "image", or "resource").`,
          });
        } else {
          extractedContent.push({
            type: item.type,
            text: item.text,
            data: item.data,
            mimeType: item.mimeType,
            raw: item,
          });

          if (item.type === 'text' && typeof item.text !== 'string') {
            checks.push({
              id: `text_content_${idx}`,
              label: `Text Item #${idx + 1}`,
              status: 'fail',
              message:
                'Text content object must contain a string "text" property.',
            });
          } else if (item.type === 'image') {
            if (!item.data || typeof item.data !== 'string') {
              checks.push({
                id: `image_data_${idx}`,
                label: `Image Item #${idx + 1} Data`,
                status: 'fail',
                message:
                  'Image content object must contain a base64 encoded "data" string.',
              });
            }
            if (!item.mimeType) {
              checks.push({
                id: `image_mime_${idx}`,
                label: `Image Item #${idx + 1} MIME Type`,
                status: 'warn',
                message:
                  'Missing "mimeType" (e.g. "image/png"). AI clients need mimeType to render images.',
              });
            }
          }
        }
      });
    }
  }

  // Check isError flag
  if (payloadRoot.isError !== undefined) {
    isErrorState = Boolean(payloadRoot.isError);
    if (isErrorState) {
      checks.push({
        id: 'is_error_flag',
        label: 'Execution Status',
        status: 'warn',
        message:
          'Payload contains isError: true. The AI client will treat this result as a tool execution error.',
      });
    } else {
      checks.push({
        id: 'is_error_flag',
        label: 'Execution Status',
        status: 'pass',
        message: 'isError is set to false (Clean execution).',
      });
    }
  }

  return {
    isValidJson: true,
    jsonRpcValid: hasJsonRpc,
    checks,
    extractedContent,
    isErrorState,
    toolsCount,
  };
}

const PRESET_SHORT = [
  'Text result',
  'Image result',
  'tools/list',
  'Broken payload',
];

export function ProtocolInspectorTool() {
  const [jsonInput, setJsonInput] = useState<string>(PRESET_PAYLOADS[0].json);

  const result = inspectPayload(jsonInput);
  const failCount = result.checks.filter((c) => c.status === 'fail').length;
  const warnCount = result.checks.filter((c) => c.status === 'warn').length;
  const hasInput = !!jsonInput.trim();

  return (
    <div className="tl-workspace">
      <section className="tl-pane" aria-labelledby="pi-in">
        <div className="tl-pane-head">
          <h2 id="pi-in" className="tl-pane-title">
            <span className="tl-step">1</span> Paste a payload
          </h2>
        </div>
        <fieldset className="tl-toolbar" aria-label="Sample payloads">
          <span className="tl-hint">Samples:</span>
          {PRESET_PAYLOADS.map((preset, i) => (
            <button
              key={preset.name}
              type="button"
              className="chip"
              title={preset.desc}
              aria-pressed={jsonInput === preset.json}
              onClick={() => {
                trackFeatureUse('protocol_inspector', {
                  action: 'load_preset',
                  preset: preset.name,
                });
                setJsonInput(preset.json);
              }}
            >
              {PRESET_SHORT[i] ?? preset.name}
            </button>
          ))}
        </fieldset>
        <EditorPane
          title="JSON-RPC message"
          value={jsonInput}
          onChange={setJsonInput}
          ariaLabel="Paste MCP JSON-RPC payload or tool response"
          placeholder="Paste raw JSON-RPC response or request object…"
          rows={20}
          invalid={hasInput && !result.isValidJson}
          status={
            !hasInput ? null : failCount > 0 ? (
              <span className="tl-status tl-status--err">
                {failCount} error{failCount === 1 ? '' : 's'}
              </span>
            ) : warnCount > 0 ? (
              <span className="tl-status tl-status--warn">
                {warnCount} warning{warnCount === 1 ? '' : 's'}
              </span>
            ) : (
              <span className="tl-status tl-status--ok">Spec-compliant</span>
            )
          }
          actions={
            <button
              type="button"
              className="tl-code-btn"
              onClick={() => setJsonInput('')}
              disabled={!jsonInput}
            >
              Clear
            </button>
          }
        />
      </section>

      <div className="tl-pane tl-pane--flush tl-sticky">
        <section
          className="tl-pane"
          aria-labelledby="pi-report"
          aria-live="polite"
        >
          <div className="tl-pane-head">
            <h2 id="pi-report" className="tl-pane-title">
              <span className="tl-step">2</span> Diagnostic report
            </h2>
            {hasInput ? (
              <span
                className={`tl-tag ${failCount ? 'tl-tag--err' : warnCount ? 'tl-tag--warn' : 'tl-tag--ok'}`}
              >
                {failCount
                  ? `${failCount} error${failCount === 1 ? '' : 's'}`
                  : warnCount
                    ? `${warnCount} warning${warnCount === 1 ? '' : 's'}`
                    : 'Valid'}
              </span>
            ) : null}
          </div>
          {!hasInput ? (
            <div className="tl-empty">
              <ShieldCheck size={22} aria-hidden="true" />
              <p style={{ margin: 0 }}>
                Paste a payload or pick a sample to see the checks.
              </p>
            </div>
          ) : (
            <ul className="tl-findings">
              {result.checks.map((check, i) => {
                const Icon =
                  check.status === 'pass'
                    ? CheckCircle2
                    : check.status === 'warn'
                      ? AlertTriangle
                      : XCircle;
                return (
                  <li
                    key={check.id}
                    className={`pi-check pi-check--${check.status}`}
                    style={{ '--i': i } as React.CSSProperties}
                  >
                    <Icon size={16} aria-hidden="true" />
                    <div>
                      <p className="pi-check-label">{check.label}</p>
                      <p className="pi-check-msg">{check.message}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="tl-pane" aria-labelledby="pi-preview">
          <div className="tl-pane-head">
            <h2 id="pi-preview" className="tl-pane-title">
              <Eye size={16} aria-hidden="true" /> Client preview
            </h2>
            <span className="tl-hint">How a chat client renders it</span>
          </div>
          <div className="pi-preview">
            <div className="pi-preview-bar">
              <span
                className={`pi-dot ${result.isErrorState ? 'is-err' : ''}`}
                aria-hidden="true"
              />
              Tool result
            </div>
            {result.isErrorState ? (
              <div className="tl-alert tl-alert--err">
                <AlertTriangle size={16} aria-hidden="true" />
                <p>Tool executed with an error (isError: true)</p>
              </div>
            ) : null}
            {result.extractedContent.length === 0 ? (
              <p className="tl-hint pi-preview-empty">
                No renderable content blocks in this payload.
              </p>
            ) : (
              result.extractedContent.map((item, idx) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: content blocks are positional.
                <div key={idx} className="pi-block">
                  <span className="pi-block-type">
                    #{idx + 1} · {item.type}
                  </span>
                  {item.type === 'text' ? (
                    <pre className="pi-block-text">
                      {item.text || '(empty text block)'}
                    </pre>
                  ) : null}
                  {item.type === 'image' ? (
                    item.mimeType &&
                    item.data &&
                    item.data.length > 20 &&
                    !item.data.includes('invalid') ? (
                      <div>
                        {/* biome-ignore lint/performance/noImgElement: base64 data-URI preview, not an optimizable asset. */}
                        <img
                          src={`data:${item.mimeType};base64,${item.data}`}
                          alt="MCP tool output preview"
                          className="pi-block-img"
                        />
                        <span className="tl-hint">
                          Rendered base64 {item.mimeType}
                        </span>
                      </div>
                    ) : (
                      <div className="tl-alert tl-alert--warn">
                        <AlertTriangle size={16} aria-hidden="true" />
                        <p>
                          Image block can&apos;t render — MIME type:{' '}
                          {item.mimeType || 'none'}, data is not valid base64.
                        </p>
                      </div>
                    )
                  ) : null}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
