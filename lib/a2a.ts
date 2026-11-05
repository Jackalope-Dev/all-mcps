/**
 * Agent2Agent (A2A, https://a2a-protocol.org) front door for AllMCPs.
 *
 * Every A2A skill is one of our MCP tools, run by the same handler that serves
 * /api/mcp, so A2A and MCP agents get identical answers. A message picks a
 * skill with a data part `{ "skill": "<id>", "arguments": { ... } }`; a plain
 * text message is treated as a directory search.
 *
 * Speaks A2A 1.0 (PascalCase methods, ProtoJSON enums) and 0.3 (slash methods,
 * `kind` discriminators), chosen by the A2A-Version header as the spec says.
 * Every call finishes in one round trip, so we answer with a Message and keep
 * no tasks: task lookups get TaskNotFound.
 */

const A2A_ENDPOINT = 'https://allmcps.com/api/a2a';
const DEFAULT_SKILL = 'search_mcp_servers';

export type McpTool = { name: string; description: string };

type McpCallResult = {
  content?: { type: string; text?: string }[];
  structuredContent?: unknown;
  isError?: boolean;
};

/** Runs one MCP tool; resolves to the JSON-RPC response body from /api/mcp. */
export type McpCall = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ result?: McpCallResult; error?: { message?: string } }>;

const TAGS: [RegExp, string][] = [
  [/search|alternatives|compare|recommend|categories/, 'discovery'],
  [/install/, 'install'],
  [/boost|ad|pricing/, 'commerce'],
  [/submit/, 'submission'],
  [/claim|agent/, 'identity'],
];

/** `search_mcp_servers` → `Search MCP servers`. */
function skillName(tool: McpTool): string {
  return tool.name
    .replace(/_/g, ' ')
    .split(' ')
    .map((w) => (w === 'mcp' ? 'MCP' : w))
    .join(' ')
    .replace(/^./, (c) => c.toUpperCase());
}

/** The public Agent Card (A2A 1.0), one skill per MCP tool. */
export function buildAgentCard(tools: McpTool[]) {
  return {
    name: 'AllMCPs',
    description:
      'The AllMCPs directory of Model Context Protocol servers, as an agent: search and compare MCP servers, get install configs for any client, submit and claim listings, and buy listing boosts and sponsor ads. Send a data part {"skill": "<skill id>", "arguments": {...}}; plain text runs a directory search.',
    version: '1.0.0',
    provider: { organization: 'AllMCPs', url: 'https://allmcps.com' },
    documentationUrl: 'https://allmcps.com/docs/api',
    iconUrl: 'https://allmcps.com/icon.png',
    supportedInterfaces: [
      { url: A2A_ENDPOINT, protocolBinding: 'JSONRPC', protocolVersion: '1.0' },
      { url: A2A_ENDPOINT, protocolBinding: 'JSONRPC', protocolVersion: '0.3' },
    ],
    capabilities: {
      streaming: false,
      pushNotifications: false,
      extendedAgentCard: false,
    },
    defaultInputModes: ['text/plain', 'application/json'],
    defaultOutputModes: ['text/plain', 'application/json'],
    skills: tools.map((tool) => ({
      id: tool.name,
      name: skillName(tool),
      description: `${tool.description} Arguments follow this tool's inputSchema at https://allmcps.com/api/mcp (tools/list).`,
      tags: [
        ...new Set(
          TAGS.filter(([re]) => re.test(tool.name)).map(([, tag]) => tag),
        ),
        'mcp',
      ],
      inputModes: ['application/json', 'text/plain'],
      outputModes: ['text/plain', 'application/json'],
    })),
  };
}

type Version = '1.0' | '0.3';

/** Spec: an empty A2A-Version means 0.3. Patch numbers are ignored. */
export function negotiateVersion(
  header: string | null,
  method: unknown,
): Version | null {
  const v = (header || '').trim();
  if (!v) {
    // Lenient: a 1.0 method name without the header is still clearly 1.0.
    return typeof method === 'string' && /^[A-Z]/.test(method) ? '1.0' : '0.3';
  }
  const majorMinor = v.split('.').slice(0, 2).join('.');
  if (majorMinor === '1.0' || majorMinor === '1') return '1.0';
  if (majorMinor === '0.3') return '0.3';
  return null;
}

const ERR = {
  parse: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internal: -32603,
  taskNotFound: -32001,
  pushNotSupported: -32003,
  unsupported: -32004,
  extendedCardNotConfigured: -32007,
  versionNotSupported: -32009,
} as const;

const METHODS: Record<Version, Record<string, string>> = {
  '1.0': {
    SendMessage: 'send',
    SendStreamingMessage: 'stream',
    GetTask: 'task',
    CancelTask: 'task',
    SubscribeToTask: 'task',
    ListTasks: 'list',
    CreateTaskPushNotificationConfig: 'push',
    GetTaskPushNotificationConfig: 'push',
    ListTaskPushNotificationConfigs: 'push',
    DeleteTaskPushNotificationConfig: 'push',
    GetExtendedAgentCard: 'extended',
  },
  '0.3': {
    'message/send': 'send',
    'message/stream': 'stream',
    'tasks/get': 'task',
    'tasks/cancel': 'task',
    'tasks/resubscribe': 'task',
    'tasks/pushNotificationConfig/set': 'push',
    'tasks/pushNotificationConfig/get': 'push',
    'tasks/pushNotificationConfig/list': 'push',
    'tasks/pushNotificationConfig/delete': 'push',
    'agent/getAuthenticatedExtendedCard': 'extended',
  },
};

type Part = Record<string, unknown>;

/** Picks the skill and arguments out of an A2A message. */
export function messageToToolCall(
  message: unknown,
): { name: string; args: Record<string, unknown> } | { error: string } {
  const m = (message ?? {}) as { parts?: unknown; metadata?: unknown };
  if (!Array.isArray(m.parts) || m.parts.length === 0) {
    return { error: 'message.parts must be a non-empty array' };
  }
  const parts = m.parts as Part[];
  const meta = (m.metadata ?? {}) as Record<string, unknown>;

  // 1.0: { data: {...} }; 0.3: { kind: "data", data: {...} }
  const data = parts
    .map((p) => p.data)
    .find((d): d is Record<string, unknown> =>
      Boolean(d && typeof d === 'object' && !Array.isArray(d)),
    );
  const text = parts
    .map((p) => (typeof p.text === 'string' ? p.text : ''))
    .join('\n')
    .trim();

  const named =
    (typeof data?.skill === 'string' && data.skill) ||
    (typeof data?.tool === 'string' && data.tool) ||
    (typeof meta.skill === 'string' && meta.skill) ||
    null;

  if (named) {
    const args =
      data?.arguments && typeof data.arguments === 'object'
        ? (data.arguments as Record<string, unknown>)
        : Object.fromEntries(
            Object.entries(data ?? {}).filter(
              ([k]) => k !== 'skill' && k !== 'tool',
            ),
          );
    return { name: named, args };
  }
  if (text) return { name: DEFAULT_SKILL, args: { query: text } };
  return {
    error:
      'Send a data part {"skill": "<skill id>", "arguments": {...}} or a text part to search the directory.',
  };
}

function randomId(): string {
  return crypto.randomUUID();
}

function agentMessage(
  version: Version,
  opts: {
    text: string;
    data?: unknown;
    contextId: string;
    metadata: Record<string, unknown>;
  },
) {
  if (version === '1.0') {
    return {
      message: {
        messageId: randomId(),
        contextId: opts.contextId,
        role: 'ROLE_AGENT',
        parts: [
          { text: opts.text, mediaType: 'text/markdown' },
          ...(opts.data !== undefined
            ? [{ data: opts.data, mediaType: 'application/json' }]
            : []),
        ],
        metadata: opts.metadata,
      },
    };
  }
  return {
    kind: 'message',
    messageId: randomId(),
    contextId: opts.contextId,
    role: 'agent',
    parts: [
      { kind: 'text', text: opts.text },
      ...(opts.data !== undefined ? [{ kind: 'data', data: opts.data }] : []),
    ],
    metadata: opts.metadata,
  };
}

/** Handles one A2A JSON-RPC request body. Always answers HTTP 200 with JSON-RPC. */
export async function handleA2aRequest(
  body: unknown,
  versionHeader: string | null,
  callTool: McpCall,
  knownSkills: ReadonlySet<string> | null,
): Promise<Record<string, unknown>> {
  const req = (body ?? {}) as {
    jsonrpc?: unknown;
    id?: unknown;
    method?: unknown;
    params?: unknown;
  };
  const id = req.id ?? null;
  const fail = (code: number, message: string, data?: unknown) => ({
    jsonrpc: '2.0',
    id,
    error: { code, message, ...(data !== undefined ? { data } : {}) },
  });
  const ok = (result: unknown) => ({ jsonrpc: '2.0', id, result });

  if (req.jsonrpc !== '2.0' || typeof req.method !== 'string') {
    return fail(ERR.invalidRequest, 'Invalid JSON-RPC 2.0 request');
  }
  const version = negotiateVersion(versionHeader, req.method);
  if (!version) {
    return fail(
      ERR.versionNotSupported,
      `A2A-Version ${versionHeader} is not supported`,
      { supportedVersions: ['1.0', '0.3'] },
    );
  }

  const kind = METHODS[version][req.method];
  switch (kind) {
    case undefined:
      return fail(ERR.methodNotFound, `Method not found: ${req.method}`);
    case 'stream':
      return fail(
        ERR.unsupported,
        'Streaming is not supported; use SendMessage (every skill answers in one response).',
      );
    case 'task':
      return fail(
        ERR.taskNotFound,
        'Task not found: this agent answers every message directly and keeps no tasks.',
      );
    case 'push':
      return fail(
        ERR.pushNotSupported,
        'Push notifications are not supported.',
      );
    case 'extended':
      return fail(
        ERR.extendedCardNotConfigured,
        'There is no extended agent card; the public card lists every skill.',
      );
    case 'list':
      return ok({ tasks: [], nextPageToken: '', pageSize: 0, totalSize: 0 });
  }

  const params = (req.params ?? {}) as { message?: Record<string, unknown> };
  const call = messageToToolCall(params.message);
  if ('error' in call) return fail(ERR.invalidParams, call.error);
  if (knownSkills && !knownSkills.has(call.name)) {
    return fail(ERR.invalidParams, `Unknown skill "${call.name}"`, {
      skills: [...knownSkills],
    });
  }

  const contextId =
    typeof params.message?.contextId === 'string'
      ? params.message.contextId
      : randomId();
  const response = await callTool(call.name, call.args);
  if (response.error || !response.result) {
    return fail(
      ERR.internal,
      response.error?.message || `Skill ${call.name} failed`,
    );
  }
  const r = response.result;
  const text =
    (r.content ?? [])
      .map((c) => c.text ?? '')
      .filter(Boolean)
      .join('\n\n') || '(no output)';
  return ok(
    agentMessage(version, {
      text,
      data: r.structuredContent,
      contextId,
      metadata: { skill: call.name, ...(r.isError ? { isError: true } : {}) },
    }),
  );
}
