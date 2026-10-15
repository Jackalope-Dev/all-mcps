'use client';

import { AlertCircle, Code2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { trackFeatureUse } from '../../lib/gtag';
import { CodePanel, CopyButton, EditorPane } from './CodePanel';

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
              description:
                'Multiple status values can be provided with comma separated strings',
              parameters: [
                {
                  name: 'status',
                  in: 'query',
                  description:
                    'Status values that need to be considered for filter',
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
      2,
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
      2,
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
  let cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!cleaned) cleaned = 'mcp_tool';
  return cleaned;
}

function parseOpenApiToTools(specJson: any): ExtractedTool[] {
  const tools: ExtractedTool[] = [];
  if (!specJson || typeof specJson !== 'object' || !specJson.paths)
    return tools;

  const paths = specJson.paths;
  for (const pathKey of Object.keys(paths)) {
    const pathItem = paths[pathKey];
    if (!pathItem || typeof pathItem !== 'object') continue;

    const methods = ['get', 'post', 'put', 'delete', 'patch'];
    for (const m of methods) {
      if (!pathItem[m]) continue;
      const op = pathItem[m];
      const methodUpper = m.toUpperCase();

      let name = op.operationId || `${m}_${pathKey.replace(/[/{}]/g, '_')}`;
      name = cleanToolName(name);

      const description =
        op.summary || op.description || `${methodUpper} ${pathKey}`;

      const parameters: ExtractedParam[] = [];

      // Extract path & query parameters
      const rawParams = [
        ...(pathItem.parameters || []),
        ...(op.parameters || []),
      ];
      for (const p of rawParams) {
        if (!p?.name) continue;
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
              required:
                Array.isArray(bodySchema.required) &&
                bodySchema.required.includes(propKey),
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

function generateTypeScriptCode(
  tools: ExtractedTool[],
  baseUrl: string,
  authType: AuthType,
  apiKeyHeader: string,
): string {
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
      const typeStr =
        p.type === 'integer' || p.type === 'number'
          ? 'number'
          : p.type === 'boolean'
            ? 'boolean'
            : 'string';
      code += `          ${JSON.stringify(p.name)}: { type: ${JSON.stringify(typeStr)}, description: ${JSON.stringify(p.description)} },\n`;
    });
    code += `        },\n`;
    const reqList = tool.parameters
      .filter((p) => p.required)
      .map((p) => JSON.stringify(p.name));
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
    tool.parameters
      .filter((p) => p.in === 'path')
      .forEach((p) => {
        pathExpr = pathExpr.replace(
          `{${p.name}}`,
          `\${encodeURIComponent(String(args.${p.name} ?? ""))}`,
        );
      });

    code += `      let targetPath = ${pathExpr};\n`;

    // Query params
    const queryParams = tool.parameters.filter((p) => p.in === 'query');
    if (queryParams.length > 0) {
      code += `      const queryParams = new URLSearchParams();\n`;
      queryParams.forEach((qp) => {
        code += `      if (args.${qp.name} !== undefined) queryParams.append(${JSON.stringify(qp.name)}, String(args.${qp.name}));\n`;
      });
      code += `      if (queryParams.toString()) targetPath += "?" + queryParams.toString();\n`;
    }

    const hasBody = tool.parameters.some((p) => p.in === 'body');
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

function generatePythonCode(
  tools: ExtractedTool[],
  baseUrl: string,
  authType: AuthType,
  apiKeyHeader: string,
): string {
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
      const pyType =
        p.type === 'integer'
          ? 'int'
          : p.type === 'number'
            ? 'float'
            : p.type === 'boolean'
              ? 'bool'
              : 'str';
      return p.required
        ? `${p.name}: ${pyType}`
        : `${p.name}: ${pyType} = None`;
    });

    code += `def ${tool.name}(${paramArgs.join(', ')}) -> str:\n`;
    code += `    """Execute ${tool.method} request to ${tool.path}."""\n`;

    let pathFString = `f"${tool.path}"`;
    tool.parameters
      .filter((p) => p.in === 'path')
      .forEach((p) => {
        pathFString = pathFString.replace(`{${p.name}}`, `{${p.name}}`);
      });

    code += `    url = f"{BASE_URL}" + ${pathFString}\n`;

    const queryParams = tool.parameters.filter((p) => p.in === 'query');
    if (queryParams.length > 0) {
      code += `    params = {}\n`;
      queryParams.forEach((qp) => {
        code += `    if ${qp.name} is not None:\n`;
        code += `        params["${qp.name}"] = ${qp.name}\n`;
      });
    } else {
      code += `    params = None\n`;
    }

    const bodyParams = tool.parameters.filter((p) => p.in === 'body');
    if (bodyParams.length > 0) {
      code += `    json_data = {}\n`;
      bodyParams.forEach((bp) => {
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

  // Derived, not stored: parse errors used to be set during render.
  const { tools, parseError } = useMemo(() => {
    if (!specInput.trim()) {
      return { tools: [] as ExtractedTool[], parseError: null };
    }
    try {
      return {
        tools: parseOpenApiToTools(JSON.parse(specInput)),
        parseError: null as string | null,
      };
    } catch {
      return {
        tools: [] as ExtractedTool[],
        parseError:
          'Invalid JSON. Paste an OpenAPI 3.0/3.1 or Swagger spec in JSON form.',
      };
    }
  }, [specInput]);

  const generatedCode = useMemo(
    () =>
      targetLang === 'typescript'
        ? generateTypeScriptCode(tools, baseUrl, authType, apiKeyHeader)
        : generatePythonCode(tools, baseUrl, authType, apiKeyHeader),
    [tools, baseUrl, authType, apiKeyHeader, targetLang],
  );

  function loadPreset(preset: SamplePreset) {
    trackFeatureUse('openapi_converter', {
      action: 'load_preset',
      preset: preset.name,
    });
    setSpecInput(preset.spec);
    setBaseUrl(preset.baseUrl);
  }

  const ext = targetLang === 'typescript' ? 'ts' : 'py';
  const installCmd =
    targetLang === 'typescript'
      ? 'npm install @modelcontextprotocol/sdk zod'
      : 'pip install "mcp[cli]" httpx';

  return (
    <div className="tl-workspace">
      <section className="tl-pane" aria-labelledby="oa-in">
        <div className="tl-pane-head">
          <h2 id="oa-in" className="tl-pane-title">
            <span className="tl-step">1</span> Your API spec
          </h2>
        </div>
        <fieldset className="tl-toolbar" aria-label="Sample specs">
          <span className="tl-hint">Samples:</span>
          {SAMPLE_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              className="chip"
              title={preset.desc}
              aria-pressed={specInput === preset.spec}
              onClick={() => loadPreset(preset)}
            >
              {preset.name.replace(/\s*\(.*\)\s*$/, '')}
            </button>
          ))}
        </fieldset>
        <EditorPane
          title="openapi.json"
          value={specInput}
          onChange={setSpecInput}
          ariaLabel="OpenAPI 3.0 / 3.1 JSON specification"
          placeholder="Paste your OpenAPI JSON spec here…"
          rows={14}
          invalid={!!parseError}
          status={
            parseError ? (
              <span className="tl-status tl-status--err">Invalid JSON</span>
            ) : specInput.trim() ? (
              <span className="tl-status tl-status--ok">
                {tools.length} operation{tools.length === 1 ? '' : 's'}
              </span>
            ) : null
          }
          actions={
            <button
              type="button"
              className="tl-code-btn"
              onClick={() => setSpecInput('')}
              disabled={!specInput}
            >
              Clear
            </button>
          }
        />
        {parseError ? (
          <div className="tl-alert tl-alert--err" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <p>{parseError}</p>
          </div>
        ) : null}

        <label className="tl-field">
          <span className="tl-label">API base URL</span>
          <input
            type="url"
            className="tl-input"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.example.com/v1"
            spellCheck={false}
          />
        </label>

        <div className="tl-field">
          <span className="tl-label" id="oa-auth">
            Authentication
          </span>
          <div className="tl-toolbar">
            <fieldset className="segmented" aria-labelledby="oa-auth">
              <button
                type="button"
                aria-pressed={authType === 'none'}
                onClick={() => setAuthType('none')}
              >
                None
              </button>
              <button
                type="button"
                aria-pressed={authType === 'bearer'}
                onClick={() => setAuthType('bearer')}
              >
                Bearer token
              </button>
              <button
                type="button"
                aria-pressed={authType === 'apiKey'}
                onClick={() => setAuthType('apiKey')}
              >
                API key header
              </button>
            </fieldset>
          </div>
        </div>

        {authType === 'apiKey' ? (
          <label className="tl-field">
            <span className="tl-label">Header name</span>
            <input
              className="tl-input is-mono"
              value={apiKeyHeader}
              onChange={(e) => setApiKeyHeader(e.target.value)}
              placeholder="X-API-Key"
            />
          </label>
        ) : null}

        <div className="tl-field">
          <span className="tl-label">
            Parsed tools <span className="tl-label-opt">({tools.length})</span>
          </span>
          {tools.length === 0 ? (
            <div className="tl-empty">
              <Code2 size={22} aria-hidden="true" />
              <p style={{ margin: 0 }}>
                {parseError
                  ? 'Fix the JSON above to extract tools.'
                  : 'No operations found. Make sure the spec has a "paths" object.'}
              </p>
            </div>
          ) : (
            <ul className="oa-tools">
              {tools.map((t) => (
                <li key={`${t.method}-${t.path}-${t.name}`} className="oa-tool">
                  <div className="oa-tool-head">
                    <code className="oa-tool-name">{t.name}</code>
                    <span
                      className={`oa-method oa-method--${t.method.toLowerCase()}`}
                    >
                      {t.method}
                    </span>
                    <code className="oa-tool-path">{t.path}</code>
                  </div>
                  {t.description ? (
                    <p className="oa-tool-desc">{t.description}</p>
                  ) : null}
                  {t.parameters.length > 0 ? (
                    <p className="oa-tool-params">
                      {t.parameters.map((p) => (
                        <code key={p.name}>
                          {p.name}
                          {p.required ? '*' : ''}: {p.type}
                        </code>
                      ))}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="tl-pane tl-sticky" aria-labelledby="oa-out">
        <div className="tl-pane-head">
          <h2 id="oa-out" className="tl-pane-title">
            <span className="tl-step">2</span> Generated server
          </h2>
        </div>
        <fieldset className="segmented" aria-label="Language">
          <button
            type="button"
            aria-pressed={targetLang === 'typescript'}
            onClick={() => setTargetLang('typescript')}
          >
            TypeScript SDK
          </button>
          <button
            type="button"
            aria-pressed={targetLang === 'python'}
            onClick={() => setTargetLang('python')}
          >
            Python FastMCP
          </button>
        </fieldset>
        <div className="oa-install">
          <span className="tl-label">Install</span>
          <code>{installCmd}</code>
          <CopyButton text={installCmd} variant="secondary" />
        </div>
        <CodePanel
          title={`mcp-server.${ext}`}
          code={generatedCode}
          language={targetLang}
          downloadName={`mcp-server.${ext}`}
          downloadMime="text/plain;charset=utf-8"
          maxHeight="34rem"
          wrap={false}
          snippetType="install_command"
          onDownloaded={() =>
            trackFeatureUse('openapi_converter', {
              action: 'download_code',
              language: targetLang,
            })
          }
        />
      </section>
    </div>
  );
}
