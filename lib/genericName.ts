/**
 * Bare technical labels ("mcp", "mcp-server", "reference-data") that a
 * scraped import can leave as `servers.name` instead of an actual product
 * title — usually because the source was an npm/package name rather than a
 * human-written title. A name is generic when every one of its words (split
 * on whitespace/hyphen/underscore) is one of these, and there are few enough
 * words that it reads as a label rather than a real title — "Kai AGI -
 * Autonomous AI Agent" has "agent" in the set but enough other words that
 * it's clearly a real name, not a placeholder.
 */
const GENERIC_NAME_WORDS = new Set([
  'mcp',
  'server',
  'servers',
  'tool',
  'tools',
  'toolkit',
  'toolset',
  'api',
  'client',
  'service',
  'services',
  'app',
  'core',
  'cli',
  'sdk',
  'docs',
  'doc',
  'documentation',
  'gateway',
  'assistant',
  'agent',
  'agents',
  'memory',
  'registry',
  'catalog',
  'marketplace',
  'monitoring',
  'audit',
  'booking',
  'library',
  'libraries',
  'reference',
  'data',
  'hub',
  'kit',
  'connector',
  'connectors',
  'integration',
  'integrations',
  'bridge',
  'proxy',
  'wrapper',
  'adapter',
  'util',
  'utils',
  'utility',
  'utilities',
  'backend',
  'frontend',
  'platform',
  'system',
  'framework',
  'plugin',
  'plugins',
  'extension',
  'module',
]);

/** Letters outside ASCII: a Korean, Cyrillic or CJK name is a real title, not a label. */
const NON_ASCII_LETTER = /[^\p{ASCII}]/u;

function nameWords(name: string): string[] {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean);
}

/** Words too generic to carry a fetched title/repo-slug/hostname as a listing name. */
export function isGenericServerName(name: string | null | undefined): boolean {
  if (NON_ASCII_LETTER.test(name || '')) return false;
  const words = nameWords(name || '');
  if (words.length === 0) return true;
  if (words.length > 3) return false;
  return words.every((w) => GENERIC_NAME_WORDS.has(w));
}

/** The words that only say "this is an MCP server". */
const MCP_LABEL_WORDS = new Set([
  'mcp',
  'server',
  'servers',
  'remote',
  'official',
  'model',
  'context',
  'protocol',
]);

/** The words of a name beyond "mcp"/"server": "mcp-gateway" -> ["gateway"]. */
export function meaningfulNameWords(name: string): string[] {
  return nameWords(name).filter((w) => !MCP_LABEL_WORDS.has(w));
}

/**
 * The part of a listing name that names the product: the repo/package after an
 * `owner/` or `@scope/` prefix, else the whole name.
 */
export function nameTail(name: string): string {
  const trimmed = name.trim();
  const idx = trimmed.lastIndexOf('/');
  return idx === -1 ? trimmed : trimmed.slice(idx + 1);
}

/**
 * Whether the repo/package part of an `owner/repo` id says nothing without its
 * owner: only "mcp"/"server" words ("mcp", "mcp-server") or one generic word
 * ("cli", "core", "sdk"). "mcp-cli" or "agent-memory" stay: they describe the
 * product, and the owner shows as a byline.
 */
export function isGenericNameTail(tail: string): boolean {
  if (NON_ASCII_LETTER.test(tail)) return false;
  const words = nameWords(tail);
  if (words.length === 0) return true;
  if (words.every((w) => MCP_LABEL_WORDS.has(w))) return true;
  return words.length === 1 && GENERIC_NAME_WORDS.has(words[0]);
}

/**
 * Generic as a listing title. A bare name (no owner to lean on) is generic when
 * at most one word beyond "mcp"/"server" is left and it is a generic one ("mcp",
 * "mcp-gateway", "memory"). An `owner/repo` or `@scope/pkg` id is generic when its
 * repo part is (see isGenericNameTail): "corsair-dev/mcp" reads as just "MCP"
 * once the owner is dropped.
 */
export function isGenericListingName(name: string | null | undefined): boolean {
  const trimmed = (name || '').trim();
  if (!trimmed) return true;
  if (NON_ASCII_LETTER.test(trimmed)) return false;
  if (trimmed.includes('/')) return isGenericNameTail(nameTail(trimmed));
  const meaningful = meaningfulNameWords(trimmed);
  return (
    meaningful.length === 0 ||
    (meaningful.length === 1 && GENERIC_NAME_WORDS.has(meaningful[0]))
  );
}

/** Domain-style suffixes that are not part of a brand: "grovs-io" -> "grovs". */
const OWNER_SUFFIXES = new Set([
  'io',
  'sh',
  'com',
  'org',
  'net',
  'co',
  'so',
  'gg',
  'hq',
  'dev',
  'app',
  'inc',
  'team',
  'official',
  'oss',
]);

/** Second-level labels that are part of the TLD: "shop.com.br", "acme.co.uk". */
const TLD_LABELS = new Set(['com', 'co', 'org', 'net', 'gov', 'ac', 'edu']);

/** Hosting platforms whose subdomain, not the platform, is the brand. */
const PLATFORM_HOSTS = [
  'workers.dev',
  'pages.dev',
  'vercel.app',
  'netlify.app',
  'github.io',
  'onrender.com',
  'fly.dev',
  'herokuapp.com',
  'railway.app',
  'replit.app',
];

/**
 * The brand in a URL's host: "www.instantreply.co" -> "instantreply",
 * "shop.acme.com.br" -> "acme", "doormat.someone.workers.dev" -> "doormat".
 * Null when there is none (bad URL, generic label).
 */
export function hostBrandLabel(url: string): string | null {
  let host: string;
  try {
    host = new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return null;
  }
  const parts = host.split('.').filter(Boolean);
  let label: string | undefined;
  if (PLATFORM_HOSTS.some((p) => host.endsWith(`.${p}`))) {
    label = parts[0];
  } else {
    const rest = parts.slice(0, -1);
    while (rest.length > 1 && TLD_LABELS.has(rest[rest.length - 1])) rest.pop();
    label = rest[rest.length - 1] ?? parts[0];
  }
  if (!label || label.length < 2 || isGenericServerName(label)) return null;
  return label;
}

/** A GitHub owner or npm scope as a brand slug: "@grovs-io" -> "grovs", "getAlby" stays. */
export function ownerBrandSlug(owner: string): string {
  const parts = owner
    .replace(/^@/, '')
    .split(/[-_.]+/)
    .filter(Boolean);
  while (
    parts.length > 1 &&
    OWNER_SUFFIXES.has(parts[parts.length - 1].toLowerCase())
  ) {
    parts.pop();
  }
  return parts.join('-');
}
