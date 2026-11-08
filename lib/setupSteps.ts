/**
 * Setup steps: the project's own install/connect commands, shown verbatim.
 *
 * The install panel publishes a generated mcpServers config only for a
 * confirmed runner + package (lib/installConfig.ts). Plenty of real servers
 * don't fit that shape: a vendor installer script, `brew install` then a
 * binary, a release download, "install our CLI, log in, then
 * `claude mcp add …`". Turning those into JSON breaks them (no shell, so `~`
 * never expands; the installer never ran), so the panel showed nothing.
 *
 * Setup steps are the alternative: an ordered list of commands copied from the
 * project's README or docs page, rendered as-is with a link to the source and
 * never converted into a client config. Every command must exist in that
 * source — extraction only ever *selects* among commands lifted from code
 * blocks (extractCommandCandidates), it never writes one.
 */

export type SetupStep = {
  /** Short human label ("Install", "Sign in"). Null when none applies. */
  label: string | null;
  /** The command exactly as the source shows it (may span lines). */
  command: string;
};

/** Who wrote the steps. Extraction never overwrites an owner's or admin's. */
export type SetupStepsSource = 'extracted' | 'owner' | 'admin';

const SETUP_LIMITS = {
  maxSteps: 8,
  maxCommandChars: 1200,
  maxLabelChars: 60,
  maxNoteChars: 400,
} as const;

function clampStep(label: unknown, command: unknown): SetupStep | null {
  if (typeof command !== 'string') return null;
  const cmd = command.replace(/\r\n?/g, '\n').trim();
  if (!cmd || cmd.length > SETUP_LIMITS.maxCommandChars) return null;
  const lbl =
    typeof label === 'string'
      ? label.trim().slice(0, SETUP_LIMITS.maxLabelChars)
      : '';
  return { label: lbl || null, command: cmd };
}

/** The `setup_steps` JSON column → steps, tolerating bad data (→ []). */
export function parseSetupSteps(raw: unknown): SetupStep[] {
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  const steps: SetupStep[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const s = item as { label?: unknown; command?: unknown };
    const step = clampStep(s.label, s.command);
    if (step) steps.push(step);
    if (steps.length >= SETUP_LIMITS.maxSteps) break;
  }
  return steps;
}

/** Steps → the `setup_steps` column value (null when there are none). */
export function serializeSetupSteps(steps: SetupStep[]): string | null {
  const clean = parseSetupSteps(steps);
  return clean.length > 0 ? JSON.stringify(clean) : null;
}

/**
 * The owner/admin text format: one command per block, an optional `# Label`
 * line naming the command that follows, blank lines between steps. A command
 * may span lines (a `bash -c '…'` wrapper); a blank line ends it.
 *
 *   # Install
 *   curl -fsSL https://example.com/install.sh | bash
 *
 *   # Sign in
 *   example login
 */
export function setupStepsFromText(text: string): SetupStep[] {
  const steps: SetupStep[] = [];
  let label: string | null = null;
  let lines: string[] = [];
  const flush = () => {
    const step = clampStep(label, lines.join('\n'));
    if (step) steps.push(step);
    label = null;
    lines = [];
  };
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) {
      if (lines.length > 0) flush();
      continue;
    }
    // A label line only starts a step; inside a command, # is the command's.
    const labelMatch = lines.length === 0 && /^#\s+(.+)$/.exec(line.trim());
    if (labelMatch) {
      label = labelMatch[1].trim();
      continue;
    }
    lines.push(line);
  }
  if (lines.length > 0) flush();
  return steps.slice(0, SETUP_LIMITS.maxSteps);
}

/** Inverse of setupStepsFromText, for pre-filling an edit form. */
export function setupStepsToText(steps: SetupStep[]): string {
  return steps
    .map((s) => (s.label ? `# ${s.label}\n${s.command}` : s.command))
    .join('\n\n');
}

// --- Candidate extraction ------------------------------------------------

/**
 * First words a setup command plausibly starts with. A candidate must start
 * with one (after env assignments and `sudo`), or with a path (`./x`,
 * `~/x`, `"$HOME/x"`), so code samples in other languages and JSON configs
 * never reach the picker.
 */
const COMMAND_STARTERS = new Set([
  // fetch-and-run installers
  'curl',
  'wget',
  'irm',
  'iwr',
  'invoke-restmethod',
  'invoke-webrequest',
  'powershell',
  'pwsh',
  'bash',
  'sh',
  'zsh',
  // package managers
  'brew',
  'apt',
  'apt-get',
  'dnf',
  'yum',
  'pacman',
  'snap',
  'nix',
  'nix-env',
  'winget',
  'scoop',
  'choco',
  'npm',
  'npx',
  'pnpm',
  'pnpx',
  'yarn',
  'bun',
  'bunx',
  'deno',
  'pip',
  'pip3',
  'pipx',
  'uv',
  'uvx',
  'poetry',
  'conda',
  'go',
  'cargo',
  'gem',
  'dotnet',
  'mvn',
  'gradle',
  'java',
  'docker',
  'podman',
  'kubectl',
  'helm',
  'git',
  'gh',
  'make',
  'python',
  'python3',
  'node',
  // MCP clients' own add commands
  'claude',
  'codex',
  'gemini',
  'grok',
  'goose',
  'opencode',
  'amp',
  'cursor',
  'code',
  'code-insiders',
  'mcp',
]);

/** A shell prompt someone pasted in front of the command. */
const PROMPT_RE = /^(?:\$|>|%|PS>|PS [^>]*>)\s+/;

/** Splits off leading `FOO=bar` env assignments and `sudo`. */
function commandHead(line: string): string {
  let rest = line.trim();
  for (;;) {
    const env = /^[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|\S*)\s+/.exec(rest);
    if (env) {
      rest = rest.slice(env[0].length);
      continue;
    }
    if (/^sudo\s+/.test(rest)) {
      rest = rest.replace(/^sudo\s+/, '');
      continue;
    }
    return rest;
  }
}

/** Shell syntax that starts a line without being a command a user runs. */
const SHELL_NOISE = new Set([
  'for',
  'while',
  'until',
  'if',
  'then',
  'else',
  'elif',
  'fi',
  'do',
  'done',
  'case',
  'esac',
  'echo',
  'printf',
  'export',
  'set',
  'unset',
  'source',
  'alias',
  'function',
  '}',
  ')',
]);

/**
 * Whether a logical command line looks like something a user runs. In a block
 * tagged as shell (```bash, <pre class="language-sh">) any line counts, so a
 * project's own CLI (`brainscanner login`) gets through; elsewhere (untagged
 * fences, inline code) it must start with a known tool or a path.
 */
export function looksLikeCommand(
  command: string,
  inShellBlock = false,
): boolean {
  const line = command.split('\n')[0].trim();
  // `X=$(mktemp -d)`, `ARR=()`, `ARR+=(…)`: setting a variable, not running anything.
  if (/^[A-Za-z_]\w*\+?=(?:\$\(.*\)|\(.*\)|\S*)$/.test(line)) return false;
  if (!isRunnableAsShown(command)) return false;
  const first = commandHead(line);
  if (!first) return false;
  if (inShellBlock) {
    const word = first.split(/\s+/)[0].toLowerCase();
    // Lowercase start: a capitalized line in a shell block is prose
    // ("Add --yes to …"), not a command. `$s = irm …`, `.\x.exe` still pass.
    if (!SHELL_NOISE.has(word) && /^(?:[a-z0-9_~./$-]|"\$)/.test(first)) {
      return true;
    }
  }
  if (/^(?:\.{1,2}\/|~\/|"?\$\{?HOME\}?\/|\/(?:usr|opt)\/)/.test(first)) {
    // A lone path is a file or folder to look at, unless it's clearly a
    // program (`./server`, `~/.tool/bin/tool`).
    const lone = command.trim();
    if (/\s/.test(lone)) return true;
    return /^\.{1,2}\//.test(lone) || /\/bin\/[^/]+$/.test(lone);
  }
  const word = first.split(/\s+/)[0].replace(/^["']|["']$/g, '');
  return COMMAND_STARTERS.has(word.toLowerCase());
}

/**
 * Rejects text that sits in a code block but can't be pasted and run: a line
 * of a JSON config (`"command": "npx",`, `{`), usage syntax with optional
 * flags (`start [--port=3000]`), an elided command (`curl … | sh`), or
 * markdown that leaked in (backticks).
 */
function isRunnableAsShown(command: string): boolean {
  const line = command.split('\n')[0].trim();
  if (/^[{}[\]]/.test(line)) return false;
  // A markdown list item that landed in a code block (`- clone the repo`).
  if (/^[-*•]\s/.test(line)) return false;
  // A quoted first word is fine only as a quoted path ("$HOME/…", "./x").
  if (/^["']/.test(line) && !/^["'](?:\$|~|\.{0,2}\/)/.test(line)) return false;
  if (/^"[^"]*"\s*:/.test(line)) return false;
  if (command.includes('…') || command.includes('`')) return false;
  if (/\s\[--?[\w-]/.test(command)) return false;
  return true;
}

/** True while a line run leaves a quote open (so the command continues). */
function quotesOpen(text: string): boolean {
  let single = false;
  let double = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '\\' && !single) {
      i++;
      continue;
    }
    if (c === "'" && !double) single = !single;
    else if (c === '"' && !single) double = !double;
  }
  return single || double;
}

/**
 * One code block → its logical commands. A command continues past a newline
 * while a quote is open, the line ends in `\`, or a heredoc is unterminated.
 * Comment lines and prompt markers are dropped; output lines simply never
 * match looksLikeCommand.
 */
export function splitBlockCommands(block: string): string[] {
  const out: string[] = [];
  let current: string[] = [];
  let heredoc: string | null = null;
  const flush = () => {
    const cmd = current.join('\n').trim();
    if (cmd) out.push(cmd);
    current = [];
  };
  for (const raw of block.replace(/\r\n?/g, '\n').split('\n')) {
    if (heredoc !== null) {
      current.push(raw);
      if (raw.trim() === heredoc) {
        heredoc = null;
        flush();
      }
      continue;
    }
    let line = raw.replace(/\s+$/, '');
    if (current.length === 0) {
      line = line.trim().replace(PROMPT_RE, '');
      if (!line || line.startsWith('#') || line.startsWith('//')) continue;
    }
    current.push(line);
    const joined = current.join('\n');
    const here = /<<-?\s*['"]?([A-Za-z_]+)['"]?/.exec(line);
    if (here) {
      heredoc = here[1];
      continue;
    }
    if (line.endsWith('\\') || quotesOpen(joined)) continue;
    flush();
  }
  flush();
  return out;
}

const FENCE_RE = /^(\s*)(`{3,}|~{3,})([^\n`]*)\n([\s\S]*?)\n\1\2[ \t]*$/gm;
/** Fence languages that are never shell commands. */
const SHELL_LANG =
  /^(?:bash|sh|shell|zsh|console|terminal|powershell|pwsh|ps1|cmd|bat|fish)$/i;
const NON_SHELL_LANG =
  /^(?:json|jsonc|json5|yaml|yml|toml|ini|xml|html|css|js|javascript|ts|typescript|tsx|jsx|py|python|go|rust|rs|java|kotlin|swift|c|cpp|csharp|cs|ruby|rb|php|sql|graphql|diff|mermaid|text|txt|markdown|md|env|dotenv)$/i;

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code =
        e[1] === 'x' || e[1] === 'X'
          ? Number.parseInt(e.slice(2), 16)
          : Number.parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

function stripTags(s: string): string {
  return decodeEntities(
    s.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''),
  );
}

/**
 * Code blocks and inline code from a markdown README, in document order.
 * READMEs are often HTML in places (<pre> install snippets), so each prose
 * run between fences is scanned for both backticks and HTML code.
 */
type CodeBlock = { text: string; shell: boolean };

function markdownBlocks(md: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const prose = (text: string) => {
    for (const m of text.matchAll(/`([^`\n]{4,400})`/g)) {
      blocks.push({ text: m[1], shell: false });
    }
    if (/<(?:pre|code)\b/i.test(text)) blocks.push(...htmlBlocks(text));
  };
  let last = 0;
  for (const m of md.matchAll(FENCE_RE)) {
    prose(md.slice(last, m.index));
    last = (m.index ?? 0) + m[0].length;
    const l = (m[3] ?? '').trim().split(/\s+/)[0] ?? '';
    if (!NON_SHELL_LANG.test(l)) {
      blocks.push({ text: m[4] ?? '', shell: SHELL_LANG.test(l) });
    }
  }
  prose(md.slice(last));
  return blocks;
}

/** <pre> blocks and inline <code> from an HTML docs page. */
function htmlBlocks(html: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  // Framework pages repeat their content as escaped JSON in <script> payloads.
  const markup = html.replace(
    /<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi,
    ' ',
  );
  // One pass so <pre> blocks and inline <code> keep document order.
  const re =
    /<pre\b([^>]*)>([\s\S]*?)<\/pre>|<code\b[^>]*>([\s\S]{4,600}?)<\/code>/gi;
  for (const m of markup.matchAll(re)) {
    if (m[3] !== undefined) {
      blocks.push({ text: stripTags(m[3]), shell: false });
      continue;
    }
    const attrs = m[1] ?? '';
    const body = m[2] ?? '';
    const lang =
      /(?:language-|lang(?:uage)?=["']?)([a-z0-9]+)/i.exec(
        `${attrs} ${body.slice(0, 200)}`,
      )?.[1] ??
      /aria-label=["']([a-z0-9]+) code/i.exec(attrs)?.[1] ??
      '';
    if (!NON_SHELL_LANG.test(lang)) {
      blocks.push({ text: stripTags(body), shell: SHELL_LANG.test(lang) });
    }
  }
  return blocks;
}

/** Most candidates handed to the picker (document order). */
const MAX_CANDIDATES = 20;

/**
 * Every command-looking line in a README (markdown) or docs page (HTML), in
 * document order, deduplicated. This is the whole universe extraction may
 * pick from, which is what keeps published steps verbatim.
 */
export function extractCommandCandidates(source: string): string[] {
  const isHtml = /<(?:html|body|main|article|pre)\b/i.test(source);
  const blocks = isHtml ? htmlBlocks(source) : markdownBlocks(source);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const block of blocks) {
    for (const cmd of splitBlockCommands(block.text)) {
      if (cmd.length > SETUP_LIMITS.maxCommandChars) continue;
      if (!looksLikeCommand(cmd, block.shell)) continue;
      const key = cmd.replace(/\s+/g, ' ');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(cmd);
      if (out.length >= MAX_CANDIDATES) return out;
    }
  }
  return out;
}

/** Readable text of an HTML page (for the picker's context), whitespace-collapsed. */
export function htmlToText(html: string): string {
  return stripTags(
    html
      .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, '\n'),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

/**
 * Steps as markdown for agent-facing outputs (the listing's .md file, MCP
 * tool results). Each command in its own fenced block, verbatim.
 */
export function setupStepsMarkdown(server: {
  setupSteps?: SetupStep[] | null;
  setupNote?: string | null;
  setupSourceUrl?: string | null;
}): string {
  const steps = server.setupSteps ?? [];
  if (steps.length === 0) return '';
  const source = server.setupSourceUrl
    ? ` (from ${server.setupSourceUrl})`
    : '';
  let md = `The project's own setup steps${source}, copied verbatim. Run them in order; they are not an mcpServers config.\n\n`;
  if (server.setupNote) md += `${server.setupNote}\n\n`;
  steps.forEach((s, i) => {
    md += `${i + 1}. ${s.label ?? 'Run'}:\n\n\`\`\`sh\n${s.command}\n\`\`\`\n\n`;
  });
  return md;
}

/**
 * Column values for an owner's or admin's setup-steps edit. Saving steps
 * marks them as theirs (extraction skips them); clearing the steps hands the
 * listing back to extraction on its next pass.
 */
export function setupStepsEditPatch(
  edit: { text: string; note?: string | null; sourceUrl?: string | null },
  who: Exclude<SetupStepsSource, 'extracted'>,
  now: Date,
) {
  const steps = setupStepsFromText(edit.text);
  if (steps.length === 0) {
    return {
      setupSteps: null,
      setupNote: null,
      setupSourceUrl: null,
      setupSource: null,
      setupExtractedAt: null,
    };
  }
  const note = (edit.note ?? '').trim().slice(0, SETUP_LIMITS.maxNoteChars);
  const sourceUrl = (edit.sourceUrl ?? '').trim();
  return {
    setupSteps: serializeSetupSteps(steps),
    setupNote: note || null,
    setupSourceUrl: sourceUrl || null,
    setupSource: who,
    setupExtractedAt: now,
  };
}
