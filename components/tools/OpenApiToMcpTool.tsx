'use client';

import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { CopyBlock } from '../ui/CopyBlock';
import { Download, Code2, Sparkles, CheckCircle2, AlertCircle, FileText } from 'lucide-react';

type TargetLanguage = 'typescript' | 'python';
type AuthType = 'none' | 'bearer' | 'apiKey';

interface SamplePreset {
  name: string;
  desc: string;
  spec: string;
  baseUrl: string;
}

const SAMPLE_PRESETS: SamplePreset[] = [
  {
    name: 'Petstore API (OpenAPI 3.0)',
    desc: 'Sample Petstore endpoints for querying pets by status, getting pet details, and adding pets.',
    baseUrl: 'https://petstore.swagger.io/v2',
    spec: JSON.stringify(
      {
        openapi: '3.0.0',
        info: {
          title: 'Swagger Petstore',
          version: '1.0.0',
          description: 'A sample petstore server',
        },
        servers: [{ url: 'https://petstore.swagger.io/v2' }],
        paths: {
          '/pet/findByStatus': {
            get: {
              operationId: 'findPetsByStatus',
              summary: 'Finds Pets by status',
              description: 'Multiple status values can be provided with comma separated strings',
              parameters: [
                {
                  name: 'status',
                  in: 'query',
                  description: 'Status values that need to be considered for filter',
                  required: true,
                  schema: { type: 'string', default: 'available' },
                },
              ],
            },
          },
          '/pet/{petId}': {
            get: {
              operationId: 'getPetById',
              summary: 'Find pet by ID',
              description: 'Returns a single pet',
              parameters: [
                {
                  name: 'petId',
                  in: 'path',
                  description: 'ID of pet to return',
                  required: true,
                  schema: { type: 'integer' },
                },
              ],
            },
            delete: {
              operationId: 'deletePet',
              summary: 'Deletes a pet',
              parameters: [
                {
                  name: 'petId',
                  in: 'path',
                  description: 'Pet id to delete',
                  required: true,
                  schema: { type: 'integer' },
                },
              ],
            },
          },
        },
      },
      null,
      2
    ),
  },
  {
    name: 'Weather API (Minimal REST)',
    desc: 'Lightweight current weather and forecast lookup endpoints.',
    baseUrl: 'https://api.weatherapi.com/v1',
    spec: JSON.stringify(
      {
        openapi: '3.0.1',
        info: {
          title: 'Weather Service API',
          version: '1.0',
        },
        servers: [{ url: 'https://api.weatherapi.com/v1' }],
        paths: {
          '/current.json': {
            get: {
              operationId: 'getCurrentWeather',
              summary: 'Get current weather conditions by city or coordinates',
              parameters: [
                {
                  name: 'q',
                  in: 'query',
                  description: 'City name or lat,long coordinates',
                  required: true,
                  schema: { type: 'string' },
                },
                {
                  name: 'units',
                  in: 'query',
                  description: 'Temperature units (metric or imperial)',
                  required: false,
                  schema: { type: 'string', default: 'metric' },
                },
              ],
            },
          },
        },
      },
      null,
      2
    ),
  },
];

interface ExtractedParam {
  name: string;
  in: 'query' | 'path' | 'header' | 'body';
  description: string;
  required: boolean;
  type: string;
}

interface ExtractedTool {
  name: string;
  method: string;
  path: string;
  description: string;
  parameters: ExtractedParam[];
}

function cleanToolName(name: string): string {
  let cleaned = name.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  if (!cleaned) cleaned = 'mcp_tool';
  return cleaned;
}

function parseOpenApiToTools(specJson: any): ExtractedTool[] {
  const tools: ExtractedTool[] = [];
  if (!specJson || typeof specJson !== 'object' || !specJson.paths) return tools;

  const paths = specJson.paths;
  for (const pathKey of Object.keys(paths)) {
    const pathItem = paths[pathKey];
    if (!pathItem || typeof pathItem !== 'object') continue;

    const methods = ['get', 'post', 'put', 'delete', 'patch'];
    for (const m of methods) {
      if (!pathItem[m]) continue;
      const op = pathItem[m];
      const methodUpper = m.toUpperCase();

      let name = op.operationId || `${m}_${pathKey.replace(/[\/\{\}]/g, '_')}`;
      name = cleanToolName(name);

      const description = op.summary || op.description || `${methodUpper} ${pathKey}`;

      const parameters: ExtractedParam[] = [];

      // Extract path & query parameters
      const rawParams = [...(pathItem.parameters || []), ...(op.parameters || [])];
      for (const p of rawParams) {
        if (!p || !p.name) continue;
        parameters.push({
          name: p.name,
          in: p.in || 'query',
          description: p.description || `${p.name} parameter`,
          required: Boolean(p.required || p.in === 'path'),
          type: p.schema?.type || 'string',
        });
      }

      // Extract JSON request body if present
      if (op.requestBody?.content?.['application/json']?.schema) {
        const bodySchema = op.requestBody.content['application/json'].schema;
        if (bodySchema.properties) {
          for (const propKey of Object.keys(bodySchema.properties)) {
            const prop = bodySchema.properties[propKey];
            parameters.push({
              name: propKey,
              in: 'body',
              description: prop.description || `${propKey} body property`,
              required: Array.isArray(bodySchema.required) && bodySchema.required.includes(propKey),
              type: prop.type || 'string',
            });
          }
        }
      }

      tools.push({
        name,
        method: methodUpper,
        path: pathKey,
        description,
        parameters,
      });
    }
  }

  return tools;
}

function generateTypeScriptCode(tools: ExtractedTool[], baseUrl: string, authType: AuthType, apiKeyHeader: string): string {
  const serverName = 'mcp-api-server';

  let code = `import { Server } from "@modelcontextprotocol/sdk/server/index.js";\n`;
  code += `import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";\n`;
  code += `import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";\n`;
  code += `import { z } from "zod";\n\n`;

  code += `const BASE_URL = process.env.API_BASE_URL || "${baseUrl.replace(/\/$/, '')}";\n`;
  if (authType === 'bearer') {
    code += `const API_TOKEN = process.env.API_TOKEN || "";\n\n`;
  } else if (authType === 'apiKey') {
    code += `const API_KEY = process.env.API_KEY || "";\n`;
    code += `const API_KEY_HEADER = "${apiKeyHeader || 'X-API-Key'}";\n\n`;
  } else {
    code += `\n`;
  }

  code += `const server = new Server(\n`;
  code += `  { name: "${serverName}", version: "1.0.0" },\n`;
  code += `  { capabilities: { tools: {} } }\n`;
  code += `);\n\n`;

  // List Tools Handler
  code += `// --- Expose MCP Tools ---\n`;
  code += `server.setRequestHandler(ListToolsRequestSchema, async () => ({\n`;
  code += `  tools: [\n`;

  tools.forEach((tool) => {
    code += `    {\n`;
    code += `      name: ${JSON.stringify(tool.name)},\n`;
    code += `      description: ${JSON.stringify(tool.description)},\n`;
    code += `      inputSchema: {\n`;
    code += `        type: "object",\n`;
    code += `        properties: {\n`;
    tool.parameters.forEach((p) => {
      const typeStr = p.type === 'integer' || p.type === 'number' ? 'number' : p.type === 'boolean' ? 'boolean' : 'string';
      code += `          ${JSON.stringify(p.name)}: { type: ${JSON.stringify(typeStr)}, description: ${JSON.stringify(p.description)} },\n`;
    });
    code += `        },\n`;
    const reqList = tool.parameters.filter((p) => p.required).map((p) => JSON.stringify(p.name));
    code += `        required: [${reqList.join(', ')}],\n`;
    code += `      },\n`;
    code += `    },\n`;
  });

  code += `  ],\n`;
  code += `}));\n\n`;

  // Call Tool Handler
  code += `// --- Tool Execution Handlers ---\n`;
  code += `server.setRequestHandler(CallToolRequestSchema, async (request) => {\n`;
  code += `  const { name, arguments: args = {} } = request.params;\n\n`;
  code += `  const headers: Record<string, string> = {\n`;
  code += `    "Content-Type": "application/json",\n`;
  code += `    "User-Agent": "MCP-OpenAPI-Client/1.0",\n`;
  if (authType === 'bearer') {
    code += `    "Authorization": \`Bearer \${API_TOKEN}\`,\n`;
  } else if (authType === 'apiKey') {
    code += `    [API_KEY_HEADER]: API_KEY,\n`;
  }
  code += `  };\n\n`;

  code += `  switch (name) {\n`;
  tools.forEach((tool) => {
    code += `    case ${JSON.stringify(tool.name)}: {\n`;

    // Path replacements
    let pathExpr = `\`${tool.path}\``;
    tool.parameters.filter(p => p.in === 'path').forEach(p => {
      pathExpr = pathExpr.replace(`{${p.name}}`, `\${encodeURIComponent(String(args.${p.name} ?? ""))}`);
    });

    code += `      let targetPath = ${pathExpr};\n`;
    
    // Query params
    const queryParams = tool.parameters.filter(p => p.in === 'query');
    if (queryParams.length > 0) {
      code += `      const queryParams = new URLSearchParams();\n`;
      queryParams.forEach(qp => {
        code += `      if (args.${qp.name} !== undefined) queryParams.append(${JSON.stringify(qp.name)}, String(args.${qp.name}));\n`;
      });
      code += `      if (queryParams.toString()) targetPath += "?" + queryParams.toString();\n`;
    }

    const hasBody = tool.parameters.some(p => p.in === 'body');
    const fetchOptions = hasBody
      ? `{ method: "${tool.method}", headers, body: JSON.stringify(args) }`
      : `{ method: "${tool.method}", headers }`;

    code += `      const response = await fetch(\`\${BASE_URL}\${targetPath}\`, ${fetchOptions});\n`;
    code += `      const responseText = await response.text();\n`;
    code += `      return {\n`;
    code += `        content: [\n`;
    code += `          { type: "text", text: \`HTTP Status: \${response.status}\\n\${responseText}\` }\n`;
    code += `        ],\n`;
    code += `        isError: !response.ok,\n`;
    code += `      };\n`;
    code += `    }\n`;
  });

  code += `    default:\n`;
  code += `      throw new Error(\`Unknown tool: \${name}\`);\n`;
  code += `  }\n`;
  code += `});\n\n`;

  code += `async function main() {\n`;
  code += `  const transport = new StdioServerTransport();\n`;
  code += `  await server.connect(transport);\n`;
  code += `  console.error("MCP OpenAPI Server listening over stdio...");\n`;
  code += `}\n\n`;
  code += `main().catch((err) => {\n`;
  code += `  console.error("Server error:", err);\n`;
  code += `  process.exit(1);\n`;
  code += `});\n`;

  return code;
}

function generatePythonCode(tools: ExtractedTool[], baseUrl: string, authType: AuthType, apiKeyHeader: string): string {
  let code = `from mcp.server.fastmcp import FastMCP\n`;
  code += `import httpx\n`;
  code += `import os\n\n`;

  code += `BASE_URL = os.environ.get("API_BASE_URL", "${baseUrl.replace(/\/$/, '')}")\n`;
  if (authType === 'bearer') {
    code += `API_TOKEN = os.environ.get("API_TOKEN", "")\n`;
  } else if (authType === 'apiKey') {
    code += `API_KEY = os.environ.get("API_KEY", "")\n`;
    code += `API_KEY_HEADER = "${apiKeyHeader || 'X-API-Key'}"\n`;
  }
  code += `\n`;

  code += `mcp = FastMCP("MCP OpenAPI Server")\n\n`;

  code += `def get_headers():\n`;
  code += `    headers = {"Content-Type": "application/json", "User-Agent": "MCP-OpenAPI-Client/1.0"}\n`;
  if (authType === 'bearer') {
    code += `    if API_TOKEN:\n`;
    code += `        headers["Authorization"] = f"Bearer {API_TOKEN}"\n`;
  } else if (authType === 'apiKey') {
    code += `    if API_KEY:\n`;
    code += `        headers[API_KEY_HEADER] = API_KEY\n`;
  }
  code += `    return headers\n\n`;

  tools.forEach((tool) => {
    code += `@mcp.tool(name="${tool.name}", description="""${tool.description}""")\n`;

    const paramArgs = tool.parameters.map((p) => {
      const pyType = p.type === 'integer' ? 'int' : p.type === 'number' ? 'float' : p.type === 'boolean' ? 'bool' : 'str';
      return p.required ? `${p.name}: ${pyType}` : `${p.name}: ${pyType} = None`;
    });

    code += `def ${tool.name}(${paramArgs.join(', ')}) -> str:\n`;
    code += `    """Execute ${tool.method} request to ${tool.path}."""\n`;
    
    let pathFString = `f"${tool.path}"`;
    tool.parameters.filter(p => p.in === 'path').forEach(p => {
      pathFString = pathFString.replace(`{${p.name}}`, `{${p.name}}`);
    });

    code += `    url = f"{BASE_URL}" + ${pathFString}\n`;
    
    const queryParams = tool.parameters.filter(p => p.in === 'query');
    if (queryParams.length > 0) {
      code += `    params = {}\n`;
      queryParams.forEach(qp => {
        code += `    if ${qp.name} is not None:\n`;
        code += `        params["${qp.name}"] = ${qp.name}\n`;
      });
    } else {
      code += `    params = None\n`;
    }

    const bodyParams = tool.parameters.filter(p => p.in === 'body');
    if (bodyParams.length > 0) {
      code += `    json_data = {}\n`;
      bodyParams.forEach(bp => {
        code += `    if ${bp.name} is not None:\n`;
        code += `        json_data["${bp.name}"] = ${bp.name}\n`;
      });
    } else {
      code += `    json_data = None\n`;
    }

    code += `    with httpx.Client() as client:\n`;
    code += `        res = client.request(\n`;
    code += `            method="${tool.method}",\n`;
    code += `            url=url,\n`;
    code += `            params=params,\n`;
    code += `            json=json_data,\n`;
    code += `            headers=get_headers(),\n`;
    code += `            timeout=15.0\n`;
    code += `        )\n`;
    code += `        return f"HTTP {res.status_code}\\n{res.text}"\n\n`;
  });

  code += `if __name__ == "__main__":\n`;
  code += `    mcp.run()\n`;

  return code;
}

export function OpenApiToMcpTool() {
  const [specInput, setSpecInput] = useState<string>(SAMPLE_PRESETS[0].spec);
  const [baseUrl, setBaseUrl] = useState<string>(SAMPLE_PRESETS[0].baseUrl);
  const [targetLang, setTargetLang] = useState<TargetLanguage>('typescript');
  const [authType, setAuthType] = useState<AuthType>('none');
  const [apiKeyHeader, setApiKeyHeader] = useState<string>('X-API-Key');
  const [parseError, setParseError] = useState<string | null>(null);

  // Parse OpenAPI JSON
  let tools: ExtractedTool[] = [];
  try {
    const parsedJson = JSON.parse(specInput);
    tools = parseOpenApiToTools(parsedJson);
    if (parseError) setParseError(null);
  } catch (err: any) {
    tools = [];
    if (!parseError) {
      setParseError('Invalid JSON format. Please ensure your spec is valid OpenAPI JSON.');
    }
  }

  const generatedCode = targetLang === 'typescript'
    ? generateTypeScriptCode(tools, baseUrl, authType, apiKeyHeader)
    : generatePythonCode(tools, baseUrl, authType, apiKeyHeader);

  function loadPreset(preset: SamplePreset) {
    setSpecInput(preset.spec);
    setBaseUrl(preset.baseUrl);
    setParseError(null);
  }

  function handleDownload() {
    const ext = targetLang === 'typescript' ? 'ts' : 'py';
    const filename = `mcp-server.${ext}`;
    const blob = new Blob([generatedCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Quick Presets Banner */}
      <Card style={{ padding: '1.25rem', background: 'var(--bg-muted)', borderColor: 'var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Sparkles size={18} style={{ color: 'var(--brand-cyan)' }} />
          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Load Sample OpenAPI Specifications</span>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {SAMPLE_PRESETS.map((preset) => (
            <Button
              key={preset.name}
              variant="secondary"
              size="sm"
              onClick={() => loadPreset(preset)}
              style={{ fontSize: '0.85rem' }}
            >
              {preset.name}
            </Button>
          ))}
        </div>
      </Card>

      {/* Inputs Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '1.5rem' }}>
        {/* Left Column: Spec & Configuration */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label htmlFor="openapi-spec-input" style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              OpenAPI 3.0 / 3.1 JSON Specification
            </label>
            <textarea
              id="openapi-spec-input"
              value={specInput}
              onChange={(e) => {
                setSpecInput(e.target.value);
                setParseError(null);
              }}
              placeholder="Paste your OpenAPI JSON spec here..."
              rows={12}
              style={{
                width: '100%',
                padding: '0.875rem',
                borderRadius: '8px',
                background: 'var(--bg-muted)',
                border: parseError ? '1px solid #ef4444' : '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
            {parseError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#ef4444', fontSize: '0.8rem', marginTop: '0.35rem' }}>
                <AlertCircle size={14} />
                <span>{parseError}</span>
              </div>
            )}
          </div>

          <Input
            label="API Base URL (Endpoint Prefix)"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.example.com/v1"
          />

          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              Authentication Header Strategy
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`btn btn-sm ${authType === 'none' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setAuthType('none')}
              >
                No Auth
              </button>
              <button
                type="button"
                className={`btn btn-sm ${authType === 'bearer' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setAuthType('bearer')}
              >
                Bearer Token
              </button>
              <button
                type="button"
                className={`btn btn-sm ${authType === 'apiKey' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setAuthType('apiKey')}
              >
                Custom API Key Header
              </button>
            </div>
          </div>

          {authType === 'apiKey' && (
            <Input
              label="Header Name"
              value={apiKeyHeader}
              onChange={(e) => setApiKeyHeader(e.target.value)}
              placeholder="X-API-Key"
            />
          )}
        </div>

        {/* Right Column: Parsed Tool Preview */}
        <div>
          <Card style={{ padding: '1.25rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Code2 size={18} style={{ color: 'var(--accent-color)' }} />
                Parsed MCP Tools ({tools.length})
              </h2>
              {tools.length > 0 && (
                <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 600 }}>
                  Ready to compile
                </span>
              )}
            </div>

            {tools.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 1rem', margin: 'auto' }}>
                Paste a valid OpenAPI spec on the left to extract tool schemas automatically.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', maxHeight: '420px', paddingRight: '0.25rem' }}>
                {tools.map((t, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '0.875rem',
                      borderRadius: '6px',
                      background: 'var(--bg-muted)',
                      border: '1px solid var(--border-color)',
                      fontSize: '0.85rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.35rem' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-color)', wordBreak: 'break-all' }}>
                        {t.name}
                      </span>
                      <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '3px', background: 'var(--bg-muted)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                        {t.method} {t.path}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                      {t.description}
                    </p>
                    {t.parameters.length > 0 && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', wordBreak: 'break-word' }}>
                        <strong>Params:</strong> {t.parameters.map((p) => `${p.name} (${p.type}${p.required ? '*' : ''})`).join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Generated Code Section */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <h2 className="text-section" style={{ margin: 0 }}>Generated MCP Server Code</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
              Copy or download your complete, runnable MCP server file.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`btn btn-sm ${targetLang === 'typescript' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTargetLang('typescript')}
            >
              TypeScript SDK
            </button>
            <button
              type="button"
              className={`btn btn-sm ${targetLang === 'python' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTargetLang('python')}
            >
              Python FastMCP
            </button>
            <Button variant="secondary" size="sm" onClick={handleDownload} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Download size={15} />
              Download .{targetLang === 'typescript' ? 'ts' : 'py'}
            </Button>
          </div>
        </div>

        {/* Required dependencies notice */}
        <div style={{ marginBottom: '0.75rem', padding: '0.75rem 1rem', background: 'var(--bg-muted)', borderRadius: '6px', fontSize: '0.85rem', border: '1px solid var(--border-color)', wordBreak: 'break-word', overflowX: 'auto' }}>
          <strong>Install dependencies:</strong>{' '}
          <code style={{ color: 'var(--accent-color)' }}>
            {targetLang === 'typescript' ? 'npm install @modelcontextprotocol/sdk zod' : 'pip install "mcp[cli]" httpx'}
          </code>
        </div>

        <CopyBlock code={generatedCode} />
      </section>
    </div>
  );
}
