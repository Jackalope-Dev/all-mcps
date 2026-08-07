export interface ParsedReadmeTool {
  name: string;
  description?: string;
}

const MAX_TOOLS = 80;
const MAX_DESCRIPTION_LEN = 300;
const MAX_NAME_LEN = 80;

// A tool/function identifier: letters/digits/underscore/dot/hyphen, must start with a letter
// (rules out stray numbers, punctuation-only cells, and JSON keys like "ok"/"data" from
// unrelated code blocks the section might quote).
const IDENTIFIER = /^[a-zA-Z][\w.-]*$/;

/**
 * Finds the "## Tools" (or "### Available Tools", "## Tools (12)", etc.) section of a
 * README and returns its body — everything up to the next heading of the same or
 * shallower level, so nested subsections (e.g. "### Free tier" under "## Tools") stay
 * included while a sibling "## Installation" section does not.
 */
function extractToolsSection(readme: string): string | null {
  const headingMatch = readme.match(/^(#{1,4})[ \t]*(?:available[ \t]+|mcp[ \t]+)*tools?\b.*$/im);
  if (!headingMatch) return null;
  const level = headingMatch[1].length;
  const start = (headingMatch.index ?? 0) + headingMatch[0].length;
  const rest = readme.slice(start);
  const nextHeading = rest.match(new RegExp(`^#{1,${level}}[ \\t]+\\S`, 'm'));
  return nextHeading ? rest.slice(0, nextHeading.index) : rest;
}

function cleanCell(raw: string): string {
  return raw
    .trim()
    .replace(/^`+|`+$/g, '')
    .replace(/^\*\*|\*\*$/g, '')
    .trim();
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/**
 * Strategy 1: one or more markdown tables in the section whose first column header reads
 * as a tool-name column (guards against picking up a *parameters* table for a single tool,
 * which real READMEs commonly nest right next to a genuine tools table — see
 * strategy 2's callers).
 */
function fromTables(section: string): ParsedReadmeTool[] {
  const lines = section.split('\n');
  const tools: ParsedReadmeTool[] = [];

  for (let i = 0; i < lines.length - 1; i++) {
    const header = lines[i];
    const separator = lines[i + 1];
    if (!/^\|.*\|\s*$/.test(header) || !/^\|(?:[\s:-]+\|)+\s*$/.test(separator)) continue;

    const headerCells = header.split('|').slice(1, -1).map(cleanCell);
    if (!/^(tool|tool name|function|function name|name)$/i.test(headerCells[0] || '')) continue;

    // The description isn't always the last column — a table can carry a trailing
    // "Cost"/"Auth required" column after it (see the x402 sample this was written
    // against) — so prefer a column whose header actually reads as a description,
    // and only fall back to "last column" when none does.
    const labeledDescIdx = headerCells.findIndex((h) => /^(description|desc|what it does|what does it do|summary|purpose)$/i.test(h));
    const descIdx = labeledDescIdx >= 0 ? labeledDescIdx : headerCells.length - 1;

    let row = i + 2;
    while (row < lines.length && /^\|.*\|\s*$/.test(lines[row])) {
      const cells = lines[row].split('|').slice(1, -1).map(cleanCell);
      const name = cleanCell((cells[0] || '').split('/')[0]); // "`read8` / `read16`" -> "read8"
      if (IDENTIFIER.test(name) && name.length <= MAX_NAME_LEN) {
        const description = cells.length > 1 ? cells[descIdx] : undefined;
        tools.push({
          name,
          description: description ? truncate(description, MAX_DESCRIPTION_LEN) : undefined,
        });
      }
      row++;
    }
    i = row - 1;
  }

  return tools;
}

/**
 * Strategy 2: a subheading per tool ("### `create_poll`") followed by its description
 * paragraph — common when each tool also gets its own parameters table, which strategy 1
 * deliberately ignores (header cell reads "Parameter", not "Tool").
 */
function fromSubheadings(section: string): ParsedReadmeTool[] {
  const lines = section.split('\n');
  const tools: ParsedReadmeTool[] = [];

  for (let i = 0; i < lines.length; i++) {
    const headingMatch = lines[i].match(/^#{2,6}[ \t]+`([a-zA-Z][\w.-]*)`[ \t]*$/);
    if (!headingMatch) continue;
    const name = headingMatch[1];
    if (name.length > MAX_NAME_LEN) continue;

    let description: string | undefined;
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j].trim();
      if (!line) continue;
      if (/^#{1,6}\s/.test(line) || /^\|.*\|\s*$/.test(line)) break;
      description = truncate(line.replace(/^>\s*/, ''), MAX_DESCRIPTION_LEN);
      break;
    }
    tools.push({ name, description });
  }

  return tools;
}

/**
 * Strategy 3: a bulleted or numbered list, one tool per line — "- `name`: description",
 * "- **name** - description", "1. **name** - description".
 */
function fromBulletList(section: string): ParsedReadmeTool[] {
  const tools: ParsedReadmeTool[] = [];
  const patterns = [
    /^\s*(?:\d+\.|[-*])\s+\*\*([a-zA-Z][\w.-]*)\*\*\s*[-–—:]\s*(.+)$/,
    /^\s*[-*]\s+`([a-zA-Z][\w.-]*)`\s*[-–—:]\s*(.+)$/,
  ];
  for (const line of section.split('\n')) {
    for (const pattern of patterns) {
      const m = line.match(pattern);
      if (m && m[1].length <= MAX_NAME_LEN) {
        tools.push({ name: m[1], description: truncate(m[2].trim(), MAX_DESCRIPTION_LEN) });
        break;
      }
    }
  }
  return tools;
}

// A subheading whose text reads as this is documenting one tool's mechanics (its
// response shape, error codes, a usage example) rather than listing more tools — a
// real README nests exactly this kind of thing right under a single "## Tool: `x`"
// heading (see the fixture this guard was written against), and without it strategy 4
// happily mines "`location_not_found`" out of an *Error Responses* bullet list as if
// it were a tool name.
const NON_TOOL_SUBHEADING = /\b(error|response|example|troubleshoot|usage|param)/i;

/**
 * Strategy 4 (last resort, name-only): bare `code`-wrapped identifiers inside bullet
 * lines, e.g. "- Discovery: `hol.stats`, `hol.capabilities`, `hol.search`". No per-tool
 * description is recoverable from this shape, but the real tool names still beat nothing.
 */
function fromInlineCodeInBullets(section: string): ParsedReadmeTool[] {
  const names: string[] = [];
  let suppressed = false;
  for (const line of section.split('\n')) {
    const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      suppressed = NON_TOOL_SUBHEADING.test(headingMatch[1]);
      continue;
    }
    if (suppressed || !/^\s*[-*]\s+/.test(line)) continue;
    for (const m of line.matchAll(/`([a-zA-Z][\w.-]*)`/g)) {
      if (m[1].length <= MAX_NAME_LEN) names.push(m[1]);
    }
  }
  return names.map((name) => ({ name }));
}

function dedupe(tools: ParsedReadmeTool[]): ParsedReadmeTool[] {
  const seen = new Map<string, ParsedReadmeTool>();
  for (const t of tools) {
    const key = t.name.toLowerCase();
    const existing = seen.get(key);
    // Prefer whichever occurrence has a description.
    if (!existing || (!existing.description && t.description)) seen.set(key, t);
  }
  return [...seen.values()];
}

/**
 * Best-effort extraction of a listing's MCP tools from its README, for repos that only
 * link a GitHub source (the vast majority — most MCP servers are run locally via
 * npx/uvx/pip, not a live HTTP endpoint, so `tools/list` introspection never applies).
 * This is deliberately conservative: it returns [] rather than guessing when the README
 * doesn't document tools in a recognizable shape, so callers must treat an empty result
 * as "not found," never "this listing has no tools."
 */
export function parseToolsFromReadme(readme: string | null | undefined): ParsedReadmeTool[] {
  if (!readme) return [];
  const section = extractToolsSection(readme);
  if (!section) return [];

  for (const strategy of [fromTables, fromSubheadings, fromBulletList]) {
    const found = dedupe(strategy(section));
    if (found.length > 0) return found.slice(0, MAX_TOOLS);
  }

  const fallback = dedupe(fromInlineCodeInBullets(section));
  return fallback.slice(0, MAX_TOOLS);
}
