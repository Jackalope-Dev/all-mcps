'use client';

import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Sparkles, CheckCircle2, AlertTriangle, XCircle, Code, Eye, Bug, ShieldCheck } from 'lucide-react';

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
      2
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
      2
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
              description: 'Execute a read-only SQL query against the Postgres database.',
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
      2
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
      2
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
  extractedContent: Array<{ type: string; text?: string; data?: string; mimeType?: string; raw: any }>;
  isErrorState: boolean;
  toolsCount?: number;
}

function inspectPayload(rawJson: string): InspectionResult {
  const checks: AuditCheck[] = [];
  let parsed: any = null;

  try {
    parsed = JSON.parse(rawJson);
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
      message: 'Missing jsonrpc: "2.0" field. MCP protocol transport requires standard JSON-RPC 2.0 wrappers.',
    });
  }

  const payloadRoot = parsed.result || parsed;
  const extractedContent: Array<{ type: string; text?: string; data?: string; mimeType?: string; raw: any }> = [];
  let isErrorState = false;
  let toolsCount: number | undefined = undefined;

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
              message: 'Text content object must contain a string "text" property.',
            });
          } else if (item.type === 'image') {
            if (!item.data || typeof item.data !== 'string') {
              checks.push({
                id: `image_data_${idx}`,
                label: `Image Item #${idx + 1} Data`,
                status: 'fail',
                message: 'Image content object must contain a base64 encoded "data" string.',
              });
            }
            if (!item.mimeType) {
              checks.push({
                id: `image_mime_${idx}`,
                label: `Image Item #${idx + 1} MIME Type`,
                status: 'warn',
                message: 'Missing "mimeType" (e.g. "image/png"). AI clients need mimeType to render images.',
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
        message: 'Payload contains isError: true. The AI client will treat this result as a tool execution error.',
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

export function ProtocolInspectorTool() {
  const [jsonInput, setJsonInput] = useState<string>(PRESET_PAYLOADS[0].json);

  const result = inspectPayload(jsonInput);
  const failCount = result.checks.filter((c) => c.status === 'fail').length;
  const warnCount = result.checks.filter((c) => c.status === 'warn').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Preset Banner */}
      <Card style={{ padding: '1.25rem', background: 'rgba(0, 229, 255, 0.03)', borderColor: 'rgba(0, 229, 255, 0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Sparkles size={18} style={{ color: 'var(--brand-cyan)' }} />
          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Load Sample Protocol Payloads</span>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {PRESET_PAYLOADS.map((preset) => (
            <Button
              key={preset.name}
              variant="secondary"
              size="sm"
              onClick={() => setJsonInput(preset.json)}
              style={{ fontSize: '0.85rem' }}
            >
              {preset.name}
            </Button>
          ))}
        </div>
      </Card>

      {/* Editor & Diagnostic Output Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* Left Column: JSON Editor */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem' }}>
            Paste MCP JSON-RPC Payload / Tool Response
          </label>
          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder="Paste raw JSON-RPC response or request object..."
            rows={16}
            style={{
              width: '100%',
              padding: '0.875rem',
              borderRadius: '8px',
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              outline: 'none',
              resize: 'vertical',
            }}
          />
        </div>

        {/* Right Column: Diagnostic Inspection Report */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Card style={{ padding: '1.25rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={18} style={{ color: 'var(--accent-color)' }} />
                Protocol Diagnostic Report
              </h3>
              <div>
                {failCount > 0 ? (
                  <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontWeight: 600 }}>
                    {failCount} Error(s)
                  </span>
                ) : warnCount > 0 ? (
                  <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', fontWeight: 600 }}>
                    {warnCount} Warning(s)
                  </span>
                ) : (
                  <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 600 }}>
                    Valid Protocol Format
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', maxHeight: '380px' }}>
              {result.checks.map((check) => (
                <div
                  key={check.id}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '6px',
                    background: 'rgba(0,0,0,0.25)',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.6rem',
                  }}
                >
                  {check.status === 'pass' && <CheckCircle2 size={16} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />}
                  {check.status === 'warn' && <AlertTriangle size={16} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />}
                  {check.status === 'fail' && <XCircle size={16} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />}
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.15rem' }}>
                      {check.label}
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                      {check.message}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Visual AI Client Simulator (Preview Box) */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Eye size={20} style={{ color: 'var(--accent-color)' }} />
          <h2 className="text-section" style={{ margin: 0 }}>Visual AI Client Preview</h2>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Simulates how Claude Desktop, Cursor, and Windsurf render this tool output in their chat stream.
        </p>

        <Card style={{ padding: '1.5rem', background: '#090d16', border: '1px solid rgba(255,255,255,0.12)' }}>
          {/* Client Header Mock */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: result.isErrorState ? '#ef4444' : '#10b981' }} />
              <span>AI Client Tool Execution Window</span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
              MCP Transport: Stdio / SSE
            </span>
          </div>

          {/* Content Rendering Box */}
          {result.isErrorState && (
            <div style={{ padding: '0.875rem 1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', color: '#ef4444', fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={18} />
              Tool Executed with Error (isError: true)
            </div>
          )}

          {result.extractedContent.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', padding: '1.5rem', textAlign: 'center' }}>
              No visual tool execution content found in payload.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {result.extractedContent.map((item, idx) => (
                <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--brand-cyan)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: '0.5rem' }}>
                    Content Block #{idx + 1} — [{item.type}]
                  </div>

                  {item.type === 'text' && (
                    <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '0.875rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {item.text || '(empty text block)'}
                    </pre>
                  )}

                  {item.type === 'image' && (
                    <div>
                      {item.mimeType && item.data && item.data.length > 20 && !item.data.includes('invalid') ? (
                        <div>
                          <img
                            src={`data:${item.mimeType};base64,${item.data}`}
                            alt="MCP Tool Output Preview"
                            style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                          />
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                            Rendered Base64 {item.mimeType}
                          </div>
                        </div>
                      ) : (
                        <div style={{ padding: '0.75rem', background: 'rgba(245, 158, 11, 0.1)', border: '1px dashed #f59e0b', borderRadius: '4px', color: '#f59e0b', fontSize: '0.8rem' }}>
                          [Image Content Block] MIME Type: {item.mimeType || 'none'} &mdash; Base64 data string placeholder
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
