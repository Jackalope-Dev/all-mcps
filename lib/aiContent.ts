/**
 * LLM authorship of the per-listing content layer.
 *
 * A directory page that only mirrors a repo's README is thin, duplicate content in
 * Google's eyes — it ranks the upstream repo above us. This turns the raw scrape
 * (description + README + introspected tools) into original, human-useful copy:
 * a clean one-liner, a plain-language overview, concrete use cases, and key features.
 *
 * Everything here is fail-soft: `generateListingContent` returns null on any budget /
 * timeout / parse failure so the enrich cron simply tries again next tick and the page
 * keeps falling back to the raw description/README. See app/api/cron/ai-content.
 */

import { chatJson } from './openai';
import { cleanListingDescription } from './description';
import { DIRECTORY_CATEGORIES } from './categories';
import {
  isPricingModel,
  isAuthType,
  normalizeTags,
  normalizeCompatibleClients,
  type PricingModel,
  type AuthType,
} from './serverEnums';

export type AiFaqItem = { q: string; a: string };

export type AiListingContent = {
  /** One clean sentence, no trailing period stripping — used in cards, meta, digest. */
  summary: string;
  /** 2-4 sentences: what it does and when you'd reach for it. */
  overview: string;
  /** Concrete, specific use cases. */
  useCases: string[];
  /** Key capabilities / features. */
  features: string[];
  /** 3-5 grounded Q&A pairs for the /mcp/[id] FAQ section and its FAQPage schema. */
  faq: AiFaqItem[];
  /**
   * UPPER_SNAKE_CASE environment variable names the README/setup instructions say are
   * required to run this server (API keys, tokens, connection strings). Surfaced as
   * empty-value placeholders in generated mcpServers configs so an install snippet never
   * silently omits a secret the server actually needs — see toClaudeConfigSnippet.
   */
  envVars: string[];
  /** Inferred pricing model ('free' | 'freemium' | 'paid' | 'byok' | null). */
  pricingModel?: PricingModel | null;
  /** Inferred auth requirement ('none' | 'api_key' | 'oauth' | 'other' | null). */
  authType?: AuthType | null;
  /** Short license name (e.g. 'MIT', 'Apache-2.0') or null. */
  license?: string | null;
  /** 2-5 relevant keyword tags. */
  tags?: string[];
  /** Compatible MCP client slugs (e.g. ['claude-desktop', 'cursor']). */
  compatibleClients?: string[];
  /**
   * Best-fit category from the directory's allowed list, or null when the
   * model isn't confident. Callers should only apply this when the listing's
   * current category is still the generic default — see the caller-side
   * DEFAULT_SUBMIT_CATEGORY guard in app/api/cron/ai-content — so a category
   * a human or a source list already set deliberately is never overwritten.
   */
  category?: string | null;
  /**
   * LLM-validated install command, replacing the regex/heuristic README parser
   * as the source of truth (see installExtractedAt in db/schema.ts for why).
   * Null when the model isn't confident — callers must void any stale cached
   * install fields in that case rather than keep a heuristic guess.
   */
  install?: {
    kind: 'stdio' | 'remote';
    /** stdio only: the runner, e.g. "npx", "uvx", "bunx", "pipx", "docker". */
    command?: string | null;
    /** stdio only: full CLI args including the package name, e.g. ["-y", "the-real-pkg"]. */
    args?: string[];
    /** stdio: package/image name. remote: the endpoint URL. */
    package?: string | null;
    confidence: 'high' | 'medium';
  } | null;
};

/**
 * Discriminated outcome so the caller can react to the spend cap:
 * - 'ok'     — usable content.
 * - 'budget' — spend cap / rate limit / auth / no key. The caller should STOP the run
 *              (every further call would fail the same way) and leave rows for a later retry.
 * - 'skip'   — transient error or unusable output for this one listing; retry it later.
 */
export type ListingContentOutcome =
  | { status: 'ok'; content: AiListingContent }
  | { status: 'budget'; reason: string }
  | { status: 'skip'; reason: string };

/** Parse a stored JSON string-array column tolerantly (bad data → []). */
export function parseStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim());
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => typeof x === 'string' && x.trim()).map((x) => String(x).trim());
  } catch {
    return [];
  }
}

/** Parse a stored JSON string-array-of-{q,a} column tolerantly (bad data → []). */
export function parseFaqArray(raw: unknown): AiFaqItem[] {
  const toItems = (arr: unknown[]): AiFaqItem[] =>
    arr
      .filter(
        (x): x is { q: string; a: string } =>
          !!x && typeof x === 'object' && typeof (x as any).q === 'string' && typeof (x as any).a === 'string'
      )
      .map((x) => ({ q: x.q.trim(), a: x.a.trim() }))
      .filter((x) => x.q && x.a);

  if (Array.isArray(raw)) return toItems(raw);
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return toItems(parsed);
  } catch {
    return [];
  }
}

function clampSentence(text: unknown, maxLen: number): string {
  if (typeof text !== 'string') return '';
  const t = text.trim().replace(/\s+/g, ' ');
  return t.length > maxLen ? `${t.slice(0, maxLen - 1).trimEnd()}…` : t;
}

function clampList(value: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const s = clampSentence(item, maxLen);
    if (s && /[\p{L}\p{N}]/u.test(s)) out.push(s);
    if (out.length >= maxItems) break;
  }
  return out;
}

/** Cap FAQ item count and per-field length (mirrors clampList, but for {q,a} pairs). */
export function clampFaq(value: unknown, maxItems: number, maxQLen: number, maxALen: number): AiFaqItem[] {
  if (!Array.isArray(value)) return [];
  const out: AiFaqItem[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const q = clampSentence((item as any).q, maxQLen);
    const a = clampSentence((item as any).a, maxALen);
    if (q && a) out.push({ q, a });
    if (out.length >= maxItems) break;
  }
  return out;
}

/** Real env var names look like OPENAI_API_KEY, not sentences — reject anything else the model returns. */
const ENV_VAR_NAME_PATTERN = /^[A-Z][A-Z0-9_]{1,49}$/;

function clampEnvVars(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const name = item.trim().toUpperCase().replace(/[\s-]+/g, '_');
    if (!ENV_VAR_NAME_PATTERN.test(name) || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
    if (out.length >= maxItems) break;
  }
  return out;
}

/**
 * Runners we actually recognize — anything else is almost certainly the
 * model hallucinating a command shape rather than reading one off the page.
 */
const INSTALL_COMMAND_ALLOWLIST = new Set([
  'npx', 'uvx', 'bunx', 'pipx', 'pip', 'pip3', 'python', 'python3', 'node', 'docker', 'deno', 'go', 'cargo',
]);

/**
 * Unfilled template text from a README example command — "the real value
 * goes here", not something that can actually run. Structural backstop
 * alongside the prompt instruction, since a confident-sounding model can
 * still copy an example verbatim including its placeholders.
 */
const PLACEHOLDER_PATTERN = /^[<[{]|[>\]}]$|^(your|my|insert|replace|example)[-_]|path\/to\//i;

/**
 * Defense in depth against the exact failure modes install extraction is
 * meant to fix — a bare CLI flag, an empty value, whitespace (real package/
 * image identifiers never contain it), or template placeholder text. This
 * can't catch every semantic mistake (that's what the prompt + confidence
 * gate are for), only structural nonsense a confident-sounding model could
 * still emit.
 */
function looksLikePackageToken(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  const s = v.trim();
  if (!s || s.startsWith('-') || /\s/.test(s)) return false;
  if (PLACEHOLDER_PATTERN.test(s)) return false;
  return true;
}

/** Validates the model's self-reported install guess; returns null on anything short of confident. */
function clampInstall(value: unknown): AiListingContent['install'] {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;

  const confidence = v.confidence === 'high' || v.confidence === 'medium' ? v.confidence : null;
  if (!confidence) return null;

  if (v.kind === 'remote') {
    const pkg = typeof v.package === 'string' ? v.package.trim() : '';
    if (!pkg || !/^https?:\/\//i.test(pkg)) return null;
    return { kind: 'remote', package: pkg.slice(0, 500), confidence };
  }

  if (v.kind === 'stdio') {
    const command = typeof v.command === 'string' ? v.command.trim().toLowerCase() : '';
    if (!INSTALL_COMMAND_ALLOWLIST.has(command)) return null;

    const args = Array.isArray(v.args)
      ? v.args.filter(looksLikePackageToken).map((a) => a.slice(0, 200)).slice(0, 15)
      : [];
    const pkg = looksLikePackageToken(v.package) ? (v.package as string).slice(0, 200) : '';
    // Require both a real-looking package name AND real args — a command
    // guess with no identifiable package is exactly the "grabbed a flag or
    // a stray word" failure mode this replaces, not a usable result.
    if (!pkg || args.length === 0) return null;

    // Backstop for the model forgetting the confirmation flag (prompted for
    // explicitly, but don't rely on compliance alone) — without it, npx
    // prompts interactively when the package needs installing and hangs any
    // non-interactive caller, including our own E2B verification pilot.
    if (command === 'npx' && args[0] !== '-y') args.unshift('-y');

    return { kind: 'stdio', command, args, package: pkg, confidence };
  }

  return null;
}

export type ListingContentInput = {
  name: string;
  description: string;
  category: string;
  url: string;
  readme: string | null;
  tools?: { name: string; description?: string }[];
};

const README_BUDGET = 6000;
const SYSTEM_PROMPT =
  'You are a senior technical writer for AllMCPs, a directory of Model Context Protocol (MCP) servers ' +
  'that give AI agents new tools. Given a listing, write original, accurate, concise reference copy. ' +
  'Rules: (1) Only state what the provided material supports — never invent tools, integrations, or claims. ' +
  '(2) Plain, specific language; no marketing filler ("powerful", "seamless", "game-changer"), no emoji. ' +
  '(3) Write for a developer deciding whether this server fits their use case. ' +
  'Return ONLY JSON with keys: "summary" (one sentence, <=150 chars, no name-dropping the directory), ' +
  '"overview" (2-4 sentences on what it does and when to use it), ' +
  '"useCases" (3-5 short concrete strings, each starting with a verb), ' +
  '"features" (3-6 short capability strings), ' +
  '"faq" (3-5 objects with "q" and "a" keys grounded in the provided material), ' +
  '"envVars" (0-8 UPPER_SNAKE_CASE environment variable names required to run this server), ' +
  '"pricingModel" ("free" if open source & no paid API key required; "byok" if requires user\'s own paid API key like OpenAI/GitHub; "freemium" if has free tier + paid upgrade; "paid" if paid service only; null if unknown), ' +
  '"authType" ("none" if no credentials needed; "api_key" if requires API key/token; "oauth" if uses OAuth; "other"; null if unknown), ' +
  '"license" (short license name like "MIT", "Apache-2.0", or null), ' +
  '"tags" (2-5 short lowercase keyword slugs like ["github", "developer-tools", "issues"]), ' +
  '"compatibleClients" (array of slugs from ["claude-desktop", "cursor", "windsurf", "cline"] mentioned or compatible), ' +
  '"category" (the single best-fit category name, copied EXACTLY as written from the "Allowed categories" list provided below — the current category shown may be an unreviewed placeholder, so judge fit from the actual name/description/README rather than assuming it\'s already correct; null only if genuinely none fit reasonably well), ' +
  '"install" (object or null — the command that runs THIS project\'s OWN MCP server, nothing else). ' +
  'This field feeds install instructions AI agents execute directly, so accuracy matters more than coverage — a wrong answer is worse than no answer. ' +
  'Set "install" to null unless you can identify the command with real confidence. Do NOT extract: ' +
  '(a) third-party installer CLIs the README mentions as ONE way to install (e.g. "@smithery/cli", "@modelcontextprotocol/inspector") — these need the real package name as an argument, which is what you must find instead; ' +
  '(b) generic debugging/proxy/bridge utilities unrelated to this specific server (e.g. "mcp-remote", "@modelcontextprotocol/inspector"); ' +
  '(c) framework or library dependencies this project is built WITH, not the project itself (e.g. a Python project built on "fastmcp" is not the "fastmcp" package; a project using psycopg2 is not the "psycopg2-binary" package); ' +
  '(d) other people\'s servers mentioned as examples, comparisons, or things this project can proxy to. ' +
  'When "install" is not null: "kind" is "stdio" (runs locally via a package manager) or "remote" (a hosted HTTP/SSE endpoint URL); ' +
  'for "stdio", "command" is the runner binary alone (e.g. "npx", "uvx", "bunx", "pipx", "docker" — never a flag), "args" is the full real argument list including the actual package/image name as it would be typed, "package" is that same package/image name alone. ' +
  'A stdio command must be directly runnable with no editing — this rules out two common README patterns: ' +
  '(i) a bare "npx <package>" with no confirmation flag will prompt interactively when run non-interactively and hang forever — always include "-y" as the first arg for npx (uvx/bunx/pipx do not need it); ' +
  '(ii) placeholder values in example commands (e.g. "/path/to/your/file", "<YOUR_API_KEY>", "your-project-id") are template text for the human reader to replace, not real arguments — omit them from "args" entirely rather than including the literal placeholder text, unless the exact real value is stated elsewhere in the material. ' +
  'for "remote", "package" is the endpoint URL and "command"/"args" are omitted; ' +
  '"confidence" is "high" only if the README states the exact command verbatim, "medium" if you inferred it from strong context (e.g. the npm/PyPI package name matches the repo unambiguously) — use "medium", or null the whole field, for anything less certain.';

/** Chat failure reasons that mean "stop spending" rather than "this one didn't work". */
const BUDGET_REASONS = new Set(['budget_or_rate_limit', 'auth', 'not_configured']);

/**
 * Generate the content layer for one listing. Never throws. Returns a discriminated
 * outcome so the caller can distinguish a spend-cap wall ('budget' → stop the run) from
 * a one-off failure ('skip' → retry this listing later) from success.
 */
export async function generateListingContent(
  input: ListingContentInput
): Promise<ListingContentOutcome> {
  const cleanedDesc = cleanListingDescription(input.description) || input.description || '';
  const toolLines = (input.tools || [])
    .slice(0, 30)
    .map((t) => `- ${t.name}${t.description ? `: ${t.description}` : ''}`)
    .join('\n');

  const userContent = [
    `Name: ${input.name}`,
    `Current category (may be an unreviewed default, not necessarily correct): ${input.category}`,
    `Repository/Source: ${input.url}`,
    `Current description: ${cleanedDesc || '(none)'}`,
    toolLines ? `Tools it exposes over MCP:\n${toolLines}` : '',
    input.readme ? `README (excerpt):\n${input.readme.slice(0, README_BUDGET)}` : 'README: (unavailable)',
    `Allowed categories (pick exactly one, copied verbatim, for the "category" field):\n${DIRECTORY_CATEGORIES.slice(0, 40).join('\n')}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const result = await chatJson<{
    summary?: string;
    overview?: string;
    useCases?: unknown;
    features?: unknown;
    faq?: unknown;
    envVars?: unknown;
    pricingModel?: unknown;
    authType?: unknown;
    license?: unknown;
    tags?: unknown;
    compatibleClients?: unknown;
    install?: unknown;
    category?: unknown;
  }>({
    model: 'gpt-5.6-luna',
    temperature: 0.3,
    // Bumped from 900 to give the new "install" object headroom — the existing
    // fields already used most of that budget, and a truncated response fails
    // JSON parsing entirely (loses every field, not just install).
    maxTokens: 1100,
    timeoutMs: 30_000,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
  });

  if (!result.ok) {
    return BUDGET_REASONS.has(result.reason)
      ? { status: 'budget', reason: result.reason }
      : { status: 'skip', reason: result.reason };
  }

  const summary = clampSentence(result.data.summary, 150);
  const overview = clampSentence(result.data.overview, 600);
  const useCases = clampList(result.data.useCases, 5, 120);
  const features = clampList(result.data.features, 6, 100);
  const faq = clampFaq(result.data.faq, 5, 150, 400);
  const envVars = clampEnvVars(result.data.envVars, 8);

  const pricingModel = isPricingModel(result.data.pricingModel) ? result.data.pricingModel : null;
  const authType = isAuthType(result.data.authType) ? result.data.authType : null;
  const rawLicense = typeof result.data.license === 'string' ? result.data.license.trim().slice(0, 30) : null;
  const license = rawLicense && /^[\w\.\-]+$/.test(rawLicense) ? rawLicense : null;
  const tags = normalizeTags(result.data.tags);
  const compatibleClients = normalizeCompatibleClients(result.data.compatibleClients);
  const install = clampInstall(result.data.install);
  // Exact-match only — the model was told to copy verbatim from the allowed list;
  // anything else is a hallucinated/malformed category name, safer to drop than store.
  const rawCategory = typeof result.data.category === 'string' ? result.data.category.trim() : '';
  const category = rawCategory && DIRECTORY_CATEGORIES.includes(rawCategory) ? rawCategory : null;

  // A usable summary is the minimum bar — without it the page gains nothing over the raw scrape.
  if (!summary || summary.length < 12) return { status: 'skip', reason: 'empty' };

  return {
    status: 'ok',
    content: {
      summary,
      overview,
      useCases,
      features,
      faq,
      envVars,
      pricingModel,
      authType,
      license,
      tags,
      compatibleClients,
      install,
      category,
    },
  };
}
