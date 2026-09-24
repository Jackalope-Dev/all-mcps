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

import { DIRECTORY_CATEGORIES } from './categories';
import { cleanListingDescription } from './description';
import { chatJson } from './openai';
import {
  type AuthType,
  COMPATIBLE_CLIENT_SLUGS,
  isAuthType,
  isPricingModel,
  normalizeCompatibleClients,
  normalizeTags,
  type PricingModel,
} from './serverEnums';

export type AiFaqItem = { q: string; a: string };

export type AiListingContent = {
  /** One clean sentence, no trailing period stripping — used in cards, meta, digest. */
  summary: string;
  /** 3-5 sentences: what it does and when you'd reach for it. */
  overview: string;
  /**
   * Long-form, restructured markdown writeup (~350-800 words) under our own
   * `##` headings — original, paraphrased prose grounded strictly in the
   * README/description. This is the /mcp/[id] body content that replaced
   * mirroring the raw upstream README (which moved to the noindex
   * /mcp/[id]/readme route). Empty string when the model couldn't produce a
   * usable one — the page falls back to `overview` + a link to the README.
   */
  doc: string;
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
  if (Array.isArray(raw))
    return raw
      .filter((x) => typeof x === 'string' && x.trim())
      .map((x) => x.trim());
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => typeof x === 'string' && x.trim())
      .map((x) => String(x).trim());
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
          !!x &&
          typeof x === 'object' &&
          typeof (x as any).q === 'string' &&
          typeof (x as any).a === 'string',
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
export function clampFaq(
  value: unknown,
  maxItems: number,
  maxQLen: number,
  maxALen: number,
): AiFaqItem[] {
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
    const name = item
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, '_');
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
  'npx',
  'uvx',
  'bunx',
  'pipx',
  'pip',
  'pip3',
  'python',
  'python3',
  'node',
  'docker',
  'deno',
  'go',
  'cargo',
]);

/**
 * Unfilled template text from a README example command — "the real value
 * goes here", not something that can actually run. Structural backstop
 * alongside the prompt instruction, since a confident-sounding model can
 * still copy an example verbatim including its placeholders.
 */
const PLACEHOLDER_PATTERN =
  /^[<[{]|[>\]}]$|^(your|my|insert|replace|example)[-_]|path\/to\//i;

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

  const confidence =
    v.confidence === 'high' || v.confidence === 'medium' ? v.confidence : null;
  if (!confidence) return null;

  if (v.kind === 'remote') {
    const pkg = typeof v.package === 'string' ? v.package.trim() : '';
    if (!pkg || !/^https?:\/\//i.test(pkg)) return null;
    return { kind: 'remote', package: pkg.slice(0, 500), confidence };
  }

  if (v.kind === 'stdio') {
    const command =
      typeof v.command === 'string' ? v.command.trim().toLowerCase() : '';
    if (!INSTALL_COMMAND_ALLOWLIST.has(command)) return null;

    const args = Array.isArray(v.args)
      ? v.args
          .filter(looksLikePackageToken)
          .map((a) => a.slice(0, 200))
          .slice(0, 15)
      : [];
    const pkg = looksLikePackageToken(v.package)
      ? (v.package as string).slice(0, 200)
      : '';
    // Require both a real-looking package name AND real args — a command
    // guess with no identifiable package is exactly the "grabbed a flag or
    // a stray word" failure mode this replaces, not a usable result.
    if (!pkg || args.length === 0) return null;

    // Backstop for the model forgetting the confirmation flag (prompted for
    // explicitly, but don't rely on compliance alone) — without it, npx
    // prompts interactively when the package needs installing and hangs any
    // non-interactive caller, including our own E2B verification run.
    if (command === 'npx' && args[0] !== '-y') args.unshift('-y');

    return { kind: 'stdio', command, args, package: pkg, confidence };
  }

  return null;
}

export type ListingContentInput = {
  name: string;
  description: string;
  category: string;
  isCategoryConfirmed?: boolean;
  url: string;
  readme: string | null;
  tools?: { name: string; description?: string }[];
  /** Jev already filled category/auth/pricing/install — don't ask GPT again. */
  omitStructured?: boolean;
};

const README_BUDGET = 9000;

/** Headings the restructured writeup ("doc") is allowed to use. */
const DOC_HEADINGS = [
  'What ',
  'How it works',
  'Setup and configuration',
  'Tools and capabilities',
  'Limitations and notes',
];

/**
 * Boilerplate openers that make every listing's overview read the same (a real,
 * reported problem — "This MCP server connects…" recurs). Applied to `summary`
 * and the first sentence of `overview`.
 */
const BANNED_OPENER_RE =
  /^(this|the)\s+(mcp\s+)?(server|integration|project|package|tool)\b|^a\s+(model\s+context\s+protocol|mcp)\s+server\b|^this\s+is\s+an?\b/i;

/** Drop a leading banned clause ("This MCP server ") so the sentence still starts on the substance. */
export function stripBannedOpener(text: string): string {
  if (!text) return text;
  let t = text.trim();
  if (!BANNED_OPENER_RE.test(t)) return t;
  // Re-point to the first clause that carries a verb/object: cut up to the first
  // " that "/" which " or, failing that, drop the matched subject phrase.
  const rel = t.match(/^[^.]*?\b(?:that|which)\s+(.*)$/i);
  if (rel?.[1]) {
    t = rel[1].trim();
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  return t;
}

/**
 * Validates the model's restructured writeup. Returns '' (caller treats as
 * "none" and falls back to the short overview) on anything that isn't a
 * genuinely original, structured doc: too short, too few of our headings, or a
 * near-verbatim copy of the README we're trying to stop mirroring.
 */
export function clampDoc(
  raw: unknown,
  readme: string | null | undefined,
  focusKeyphrase: string,
): string {
  if (typeof raw !== 'string') return '';
  let doc = raw.trim().replace(/\r\n/g, '\n');
  if (doc.length < 400) return '';

  // Trim runaway length at a paragraph boundary (~6k chars ≈ 900-1000 words).
  const MAX = 6000;
  if (doc.length > MAX) {
    const cut = doc.lastIndexOf('\n\n', MAX);
    doc = (cut > MAX * 0.5 ? doc.slice(0, cut) : doc.slice(0, MAX)).trimEnd();
  }

  const headingLines = (doc.match(/^#{2,3}\s+.+$/gm) || []).map((h) =>
    h.replace(/^#{2,3}\s+/, '').trim(),
  );
  const matchedHeadings = headingLines.filter((h) =>
    DOC_HEADINGS.some((allowed) =>
      h.toLowerCase().startsWith(allowed.toLowerCase()),
    ),
  );
  if (matchedHeadings.length < 2) return '';

  // Verify SEO keyphrase presence
  const escapedKeyphrase = focusKeyphrase.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&',
  );
  const keyphraseRegex = new RegExp(escapedKeyphrase, 'i');
  if (!keyphraseRegex.test(doc)) {
    // LLM completely missed the keyphrase in the body, but instead of discarding
    // a good document, we append it as a safe fallback.
    doc += `\n\n## Using this ${focusKeyphrase}\nAlways refer to the official documentation for the most accurate and up-to-date information on how to configure and run this server.`;
  } else {
    // Check if it's in at least one heading. If not, append a heading fallback.
    const headingRegex = new RegExp(`^#{2,3}\\s+.*${escapedKeyphrase}`, 'im');
    if (!headingRegex.test(doc)) {
      doc += `\n\n## Getting started with this ${focusKeyphrase}\nAlways refer to the official documentation for the most accurate and up-to-date information.`;
    }
  }

  // Reject a doc that's mostly the README pasted back. Compare normalized
  // non-heading, non-blank lines against the README's line set.
  if (readme && readme.trim().length > 0) {
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
    const readmeLines = new Set(
      readme
        .split('\n')
        .map(norm)
        .filter((l) => l.length >= 40),
    );
    const bodyLines = doc
      .split('\n')
      .filter((l) => !/^#{1,6}\s/.test(l))
      .map(norm)
      .filter((l) => l.length >= 40);
    if (bodyLines.length >= 4) {
      const copied = bodyLines.filter((l) => readmeLines.has(l)).length;
      if (copied / bodyLines.length > 0.4) return '';
    }
  }

  return doc;
}

function buildSystemPrompt(
  name: string,
  focusKeyphrase: string,
  category: string,
  isCategoryConfirmed?: boolean,
  omitStructured?: boolean,
): string {
  let prompt =
    'You are a senior technical writer for AllMCPs, a directory of Model Context Protocol (MCP) servers ' +
    'that give AI agents new tools. Given a listing, write original, accurate, concise reference copy. ' +
    'Rules: (1) Only state what the provided material supports — never invent tools, integrations, or claims. ' +
    '(2) Plain, specific language; no marketing filler ("powerful", "seamless", "game-changer"), no emoji. ' +
    '(3) Write for a developer deciding whether this server fits their use case. ' +
    '(4) Do NOT open "summary" or "overview" with a generic subject phrase like "This MCP server...", "This server...", "This integration...", "This project...", or "A Model Context Protocol server that...". Lead with the concrete capability or the product/system it works with (e.g. "Queries and mutates a Postgres database over MCP..." or "Exposes the Linear API as agent tools..."). Vary sentence structure across the overview. ' +
    '(5) "doc" must be an ORIGINAL, RESTRUCTURED writeup in your own words — never reuse sentences verbatim from the README. ' +
    `\n\nFocus keyphrase: "${focusKeyphrase}".\n` +
    `(6) You MUST use this exact focus keyphrase naturally in the first sentence of the "overview".\n` +
    `(7) You MUST use the focus keyphrase 3-5 times across the "doc" writeup, and you MUST include the focus keyphrase in at least one of the level-2 headings in the "doc".\n`;

  if (isCategoryConfirmed && category) {
    prompt += `(8) This listing has been confirmed to belong to the "${category}" category. You MUST use this exact category name naturally in the "doc" writeup to build semantic relevance.\n`;
  }

  prompt +=
    'Return ONLY JSON with keys: "summary" (one sentence, <=150 chars, no name-dropping the directory), ' +
    '"overview" (3-5 sentences on what it does, how it works, and when to reach for it), ' +
    '"doc" (a markdown writeup of 350-800 words using ONLY these level-2 headings, and only the ones the material actually supports: ' +
    '"## What <name> does", "## How it works", "## Setup and configuration", "## Tools and capabilities", "## Limitations and notes". ' +
    'Paraphrase everything; do not copy README prose; omit any heading you cannot support from the provided material; plain paragraphs and short lists, no marketing language. Use "" if you cannot write a grounded one), ' +
    '"useCases" (3-5 short concrete strings, each starting with a verb), ' +
    '"features" (3-6 short capability strings), ' +
    `"faq" (3-5 objects with "q" and "a" keys. The FIRST item MUST be q: "What is the ${name} MCP server?" with a self-contained 40-60 word answer that opens "${name} is an MCP server that..." and names what it connects to and its main tools — answer engines quote this verbatim, so it must make sense with no surrounding context. Frame the remaining questions exactly how a developer would type them into Google to solve a problem with this tool, e.g. "How do I install the ${name} MCP server?" or "Does ${name} work with Cursor?". Every answer must lead with the direct answer in its first sentence, then add detail. Answers must be grounded strictly in the provided material.), ` +
    '"envVars" (0-8 UPPER_SNAKE_CASE environment variable names required to run this server), ' +
    '"license" (short license name like "MIT", "Apache-2.0", or null), ' +
    '"tags" (2-5 short lowercase keyword slugs like ["github", "developer-tools", "issues"]), ' +
    `"compatibleClients" (array of slugs from ${JSON.stringify(COMPATIBLE_CLIENT_SLUGS)}: include every client the README names, plus — for a standard stdio or streamable-HTTP server with no client-specific requirements — the general-purpose clients that support any MCP server)`;

  if (!omitStructured) {
    prompt +=
      ', "pricingModel" ("free" if open source & no paid API key required; "byok" if requires user\'s own paid API key like OpenAI/GitHub; "freemium" if has free tier + paid upgrade; "paid" if paid service only; null if unknown), ' +
      '"authType" ("none" if no credentials needed; "api_key" if requires API key/token; "oauth" if uses OAuth; "other"; null if unknown), ' +
      '"category" (the single best-fit category name, copied EXACTLY as written from the "Allowed categories" list provided below — the current category shown may be an unreviewed placeholder, so judge fit from the actual name/description/README rather than assuming it\'s already correct; null only if genuinely none fit reasonably well), ' +
      '"install" (object or null — the command that runs THIS project\'s OWN MCP server, nothing else). ' +
      'This field feeds install instructions AI agents execute directly, so accuracy matters more than coverage — a wrong answer is worse than no answer. ' +
      'Set "install" to null unless you can identify the command with real confidence. Do NOT extract: ' +
      '(a) third-party installer CLIs the README mentions as ONE way to install (e.g. "@smithery/cli", "@modelcontextprotocol/inspector") — these need the real package name as an argument, which is what you must find instead; ' +
      '(b) generic debugging/proxy/bridge utilities unrelated to this specific server (e.g. "mcp-remote", "@modelcontextprotocol/inspector"); ' +
      '(c) framework or library dependencies this project is built WITH, not the project itself (e.g. a Python project built on "fastmcp" is not the "fastmcp" package; a project using psycopg2 is not the "psycopg2-binary" package); ' +
      "(d) other people's servers mentioned as examples, comparisons, or things this project can proxy to. " +
      'When "install" is not null: "kind" is "stdio" (runs locally via a package manager) or "remote" (a hosted HTTP/SSE endpoint URL); ' +
      'for "stdio", "command" is the runner binary alone (e.g. "npx", "uvx", "bunx", "pipx", "docker" — never a flag), "args" is the full real argument list including the actual package/image name as it would be typed, "package" is that same package/image name alone. ' +
      'A stdio command must be directly runnable with no editing — this rules out two common README patterns: ' +
      '(i) a bare "npx <package>" with no confirmation flag will prompt interactively when run non-interactively and hang forever — always include "-y" as the first arg for npx (uvx/bunx/pipx do not need it); ' +
      '(ii) placeholder values in example commands (e.g. "/path/to/your/file", "<YOUR_API_KEY>", "your-project-id") are template text for the human reader to replace, not real arguments — omit them from "args" entirely rather than including the literal placeholder text, unless the exact real value is stated elsewhere in the material. ' +
      'for "remote", "package" is the endpoint URL and "command"/"args" are omitted; ' +
      '"confidence" is "high" only if the README states the exact command verbatim, "medium" if you inferred it from strong context (e.g. the npm/PyPI package name matches the repo unambiguously) — use "medium", or null the whole field, for anything less certain.';
  } else {
    prompt += '.';
  }

  return prompt;
}

/** Chat failure reasons that mean "stop spending" rather than "this one didn't work". */
const BUDGET_REASONS = new Set([
  'budget_or_rate_limit',
  'auth',
  'not_configured',
]);

/**
 * Generate the content layer for one listing. Never throws. Returns a discriminated
 * outcome so the caller can distinguish a spend-cap wall ('budget' → stop the run) from
 * a one-off failure ('skip' → retry this listing later) from success.
 */
export async function generateListingContent(
  input: ListingContentInput,
): Promise<ListingContentOutcome> {
  const cleanedDesc =
    cleanListingDescription(input.description) || input.description || '';
  const toolLines = (input.tools || [])
    .slice(0, 30)
    .map((t) => `- ${t.name}${t.description ? `: ${t.description}` : ''}`)
    .join('\n');

  const focusKeyphrase = `${input.name} MCP server`;
  const systemPrompt = buildSystemPrompt(
    input.name,
    focusKeyphrase,
    input.category,
    input.isCategoryConfirmed,
    input.omitStructured,
  );

  const userContent = [
    `Name: ${input.name}`,
    `Current category (may be an unreviewed default, not necessarily correct): ${input.category}`,
    `Repository/Source: ${input.url}`,
    `Current description: ${cleanedDesc || '(none)'}`,
    toolLines ? `Tools it exposes over MCP:\n${toolLines}` : '',
    input.readme
      ? `README (excerpt):\n${input.readme.slice(0, README_BUDGET)}`
      : 'README: (unavailable)',
    input.omitStructured
      ? ''
      : `Allowed categories (pick exactly one, copied verbatim, for the "category" field):\n${DIRECTORY_CATEGORIES.slice(0, 40).join('\n')}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const result = await chatJson<{
    summary?: string;
    overview?: string;
    doc?: unknown;
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
    // 1100 covered the short fields + "install" object; the "doc" writeup
    // (350-800 words) needs its own headroom on top. A truncated response fails
    // JSON parsing entirely (loses every field), so keep this comfortably above
    // the worst case.
    maxTokens: 2200,
    timeoutMs: 30_000,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
  });

  if (!result.ok) {
    return BUDGET_REASONS.has(result.reason)
      ? { status: 'budget', reason: result.reason }
      : { status: 'skip', reason: result.reason };
  }

  const summary = stripBannedOpener(clampSentence(result.data.summary, 150));
  const overview = stripBannedOpener(clampSentence(result.data.overview, 900));
  const doc = clampDoc(result.data.doc, input.readme, focusKeyphrase);
  const useCases = clampList(result.data.useCases, 5, 120);
  const features = clampList(result.data.features, 6, 100);
  const faq = clampFaq(result.data.faq, 5, 150, 400);
  const envVars = clampEnvVars(result.data.envVars, 8);

  const pricingModel = isPricingModel(result.data.pricingModel)
    ? result.data.pricingModel
    : null;
  const authType = isAuthType(result.data.authType)
    ? result.data.authType
    : null;
  const rawLicense =
    typeof result.data.license === 'string'
      ? result.data.license.trim().slice(0, 30)
      : null;
  const license =
    rawLicense && /^[\w.-]+$/.test(rawLicense) ? rawLicense : null;
  const tags = normalizeTags(result.data.tags);
  const compatibleClients = normalizeCompatibleClients(
    result.data.compatibleClients,
  );
  const install = clampInstall(result.data.install);
  // Exact-match only — the model was told to copy verbatim from the allowed list;
  // anything else is a hallucinated/malformed category name, safer to drop than store.
  const rawCategory =
    typeof result.data.category === 'string' ? result.data.category.trim() : '';
  const category =
    rawCategory && DIRECTORY_CATEGORIES.includes(rawCategory)
      ? rawCategory
      : null;

  // A usable summary is the minimum bar — without it the page gains nothing over the raw scrape.
  if (!summary || summary.length < 12)
    return { status: 'skip', reason: 'empty' };

  return {
    status: 'ok',
    content: {
      summary,
      overview,
      doc,
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

/** FAQ-only pass for the leftover backlog that predated ai-content writing faq. */
export async function generateListingFaq(
  input: ListingContentInput,
): Promise<ListingContentOutcome> {
  const cleanedDesc =
    cleanListingDescription(input.description) || input.description || '';
  const result = await chatJson<{ faq?: unknown }>({
    model: 'gpt-5.6-luna',
    temperature: 0.3,
    maxTokens: 900,
    timeoutMs: 20_000,
    messages: [
      {
        role: 'system',
        content: `Write FAQ pairs for an MCP server listing. Return ONLY JSON: {"faq":[{"q":"...","a":"..."}]} with 3-5 grounded Q&A pairs. The first pair MUST be q: "What is the ${input.name} MCP server?" with a self-contained 40-60 word answer opening "${input.name} is an MCP server that...". Other questions should match how a developer would search. Every answer leads with the direct answer in its first sentence. Do not invent facts.`,
      },
      {
        role: 'user',
        content: [
          `Name: ${input.name}`,
          `Description: ${cleanedDesc || '(none)'}`,
          input.readme
            ? `README (excerpt):\n${input.readme.slice(0, 4000)}`
            : '',
        ]
          .filter(Boolean)
          .join('\n\n'),
      },
    ],
  });
  if (!result.ok) {
    return BUDGET_REASONS.has(result.reason)
      ? { status: 'budget', reason: result.reason }
      : { status: 'skip', reason: result.reason };
  }
  const faq = clampFaq(result.data.faq, 5, 150, 400);
  if (faq.length === 0) return { status: 'skip', reason: 'empty' };
  return {
    status: 'ok',
    content: {
      summary: '',
      overview: '',
      doc: '',
      useCases: [],
      features: [],
      faq,
      envVars: [],
    },
  };
}
