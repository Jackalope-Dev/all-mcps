/**
 * What a user should know about a server's reach before installing it, built
 * from what we actually observed: the tool definitions it returned over MCP,
 * plus what the E2B sandbox saw while it installed and started.
 *
 * Like the vuln signal (lib/vulnScan.ts), this is descriptive, not a verdict.
 * A server that can run shell commands is not dangerous by being able to — a
 * terminal server is supposed to — so capabilities are listed plainly and only
 * tool-description injection patterns are called out as findings.
 */

export type ToolDefinition = {
  name: string;
  description?: string;
  parameters?: unknown;
  /** MCP tool annotations, when the server provides them. */
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    openWorldHint?: boolean;
  };
};

export type Capability =
  | 'read_only'
  | 'file_write'
  | 'shell_exec'
  | 'network'
  | 'destructive'
  | 'credentials';

export type PoisoningFinding = {
  tool: string;
  pattern: string;
  excerpt: string;
};

/** What the sandbox observed while installing and starting the server. */
export type SandboxObservations = {
  /** Remote host:port pairs with an established connection during startup. */
  connections?: string[];
  /** Files created outside package caches and temp dirs during startup. */
  filesWritten?: string[];
  /** npm lifecycle scripts the package declares (preinstall/install/postinstall). */
  installScripts?: string[];
  /** npm provenance attestation present on the published version. */
  hasProvenance?: boolean | null;
  /** Days since the package was first published. */
  packageAgeDays?: number | null;
  maintainerCount?: number | null;
};

export type SecurityProfile = {
  version: 1;
  toolCount: number;
  capabilities: Capability[];
  /** Tool names per capability, for the detail view. */
  toolsByCapability: Partial<Record<Capability, string[]>>;
  /** How many tools carry MCP annotations — servers that declare intent are easier to trust. */
  annotatedTools: number;
  poisoning: PoisoningFinding[];
  toolsHash: string;
  sandbox?: SandboxObservations;
  profiledAt: string;
};

const RULES: { cap: Capability; re: RegExp }[] = [
  {
    cap: 'shell_exec',
    re: /\b(shell|bash|exec(ute)?[_ ]?(command|cmd|script)?|run[_ ]?(command|cmd|script|terminal)|terminal|subprocess|spawn|eval)\b/i,
  },
  {
    cap: 'destructive',
    re: /\b(delete|remove|drop|destroy|purge|truncate|wipe|kill|terminate|revoke|uninstall)\b/i,
  },
  {
    cap: 'file_write',
    re: /\b(write|create|save|edit|modify|update|append|move|rename|upload)[_ ]?(file|dir|directory|folder|path)s?\b|\bfs[_.]write|\bwrite[_ ]?to[_ ]?disk\b/i,
  },
  {
    cap: 'network',
    re: /\b(fetch|http|url|request|browse|download|crawl|scrape|webhook|api[_ ]?call|navigate)\b/i,
  },
  {
    cap: 'credentials',
    re: /\b(password|secret|credential|api[_ ]?key|token|private[_ ]?key|ssh|keychain|cookie)s?\b/i,
  },
];

/**
 * Phrases that try to steer the *model* from inside a tool description —
 * "tool poisoning". A legitimate description explains what the tool does; it
 * never tells the assistant to hide things or reach for unrelated secrets.
 */
const POISONING_PATTERNS: { label: string; re: RegExp }[] = [
  {
    label: 'overrides prior instructions',
    re: /\b(ignore|disregard|forget)\b.{0,40}\b(previous|prior|above|earlier|other)\b.{0,20}\b(instructions?|rules?|prompts?)\b/i,
  },
  {
    label: 'asks the assistant to hide something from the user',
    re: /\b(do not|don't|never)\b.{0,30}\b(tell|inform|mention|reveal|show)\b.{0,20}\b(the )?user\b/i,
  },
  {
    label: 'hidden instruction block',
    re: /<\s*(important|system|instructions?|secret|hidden)\s*>/i,
  },
  {
    label: 'reaches for local secrets',
    re: /(~\/\.ssh|id_rsa|\.aws\/credentials|\.env\b|mcp\.json|claude_desktop_config|\/etc\/passwd)/i,
  },
  {
    label: 'tries to chain into other tools',
    re: /\b(before|after) (using|calling) (this|any other) tool\b.{0,60}\b(must|always|first)\b/i,
  },
];

function toolText(t: ToolDefinition): string {
  // Tool names are snake/camel case; split so `delete_file` matches \bdelete\b.
  // Parameter names are left out on purpose: a "url" argument would otherwise
  // turn every lookup tool into a network tool.
  const name = t.name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ');
  return `${name} ${t.description ?? ''}`;
}

export function classifyTool(t: ToolDefinition): Capability[] {
  const caps = new Set<Capability>();
  const a = t.annotations;
  if (a?.destructiveHint) caps.add('destructive');
  if (a?.openWorldHint) caps.add('network');
  const text = toolText(t);
  for (const { cap, re } of RULES) {
    if (re.test(text)) caps.add(cap);
  }
  // An explicit read-only hint is the server's own declaration and wins over
  // our keyword guesses for the write-ish classes.
  if (a?.readOnlyHint) {
    caps.delete('destructive');
    caps.delete('file_write');
  }
  if (
    !caps.has('destructive') &&
    !caps.has('file_write') &&
    !caps.has('shell_exec')
  ) {
    caps.add('read_only');
  }
  return [...caps];
}

export function scanToolPoisoning(tools: ToolDefinition[]): PoisoningFinding[] {
  const findings: PoisoningFinding[] = [];
  for (const t of tools) {
    const text = t.description ?? '';
    for (const { label, re } of POISONING_PATTERNS) {
      const m = re.exec(text);
      if (!m) continue;
      const start = Math.max(0, m.index - 30);
      findings.push({
        tool: t.name,
        pattern: label,
        excerpt: text.slice(start, m.index + m[0].length + 30).trim(),
      });
    }
  }
  return findings;
}

/**
 * Stable fingerprint of the tool surface. Order-independent, and keyed on
 * name + description + schema so a quietly rewritten description (the
 * "rug pull" pattern) changes it just as an added tool does.
 */
export function hashTools(tools: ToolDefinition[]): string {
  const canonical = JSON.stringify(
    [...tools]
      .map((t) => [t.name, t.description ?? '', stableStringify(t.parameters)])
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)),
  );
  // Two independent 32-bit FNV-1a passes: synchronous (Workers' SubtleCrypto
  // is async) and plenty for change detection, which is all this is for.
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193 ^ canonical.length;
  for (let i = 0; i < canonical.length; i++) {
    const c = canonical.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? '';
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  const keys = Object.keys(v as object).sort();
  return `{${keys
    .map(
      (k) =>
        `${JSON.stringify(k)}:${stableStringify((v as Record<string, unknown>)[k])}`,
    )
    .join(',')}}`;
}

export function buildSecurityProfile(
  tools: ToolDefinition[],
  sandbox: SandboxObservations | undefined,
  now: Date,
): SecurityProfile {
  const toolsByCapability: Partial<Record<Capability, string[]>> = {};
  for (const t of tools) {
    for (const cap of classifyTool(t)) {
      const list = toolsByCapability[cap] ?? [];
      list.push(t.name);
      toolsByCapability[cap] = list;
    }
  }
  const order: Capability[] = [
    'shell_exec',
    'destructive',
    'file_write',
    'credentials',
    'network',
    'read_only',
  ];
  return {
    version: 1,
    toolCount: tools.length,
    capabilities: order.filter((c) => toolsByCapability[c]?.length),
    toolsByCapability,
    annotatedTools: tools.filter((t) => t.annotations).length,
    poisoning: scanToolPoisoning(tools),
    toolsHash: hashTools(tools),
    ...(sandbox ? { sandbox } : {}),
    profiledAt: now.toISOString(),
  };
}

/**
 * Whether a new profile's tool surface differs from the previous one. False
 * when there was no previous profile — a first sighting is not a change.
 */
export function toolsChanged(
  previous: SecurityProfile | null,
  next: SecurityProfile,
): boolean {
  return previous != null && previous.toolsHash !== next.toolsHash;
}

export function parseSecurityProfile(
  raw: string | null | undefined,
): SecurityProfile | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as SecurityProfile;
    return p && p.version === 1 && typeof p.toolsHash === 'string' ? p : null;
  } catch {
    return null;
  }
}

export const CAPABILITY_LABEL: Record<Capability, string> = {
  shell_exec: 'Runs commands',
  destructive: 'Can delete or modify data',
  file_write: 'Writes files',
  credentials: 'Handles credentials',
  network: 'Makes network requests',
  read_only: 'Read-only tools',
};
