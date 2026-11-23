import {
  hostBrandLabel,
  isGenericListingName,
  isGenericNameTail,
  ownerBrandSlug,
} from './genericName';

/**
 * Server names are usually the literal package/repo identifier (e.g.
 * "moxiespirit/oathscore", "@modelcontextprotocol/server-filesystem") — accurate
 * for install snippets, but noisy as a page title. Splits off the org/scope
 * prefix and humanizes the remainder for display; install snippets etc. should
 * keep using the raw `server.name`, not this.
 */
export function parseServerName(
  name: string,
  url?: string,
): { displayName: string; org: string | null } {
  const idx = name.lastIndexOf('/');
  if (idx === -1) {
    // A bare label ("mcp", "cli", "core") says nothing on its own. Recover the
    // org/repo from the GitHub URL, else the website's domain, when the caller
    // has a URL, so these don't all render as page title/H1 "MCP".
    if (isGenericListingName(name) && url) {
      const m = url.match(/github\.com\/([^/]+)\/([^/#?]+)/i);
      if (m) {
        const org = m[1];
        const repo = m[2].replace(/\.git$/i, '');
        // A generic repo ("acme/mcp") is folded into "Acme MCP" below.
        return parseServerName(`${org}/${repo}`);
      }
      const label = hostBrandLabel(url);
      if (label) {
        return { displayName: `${humanize(label)} MCP`, org: null };
      }
    }
    return { displayName: humanize(name), org: null };
  }
  const org = name.slice(0, idx);
  const base = name.slice(idx + 1);
  let displayName = humanize(base);
  // "snowflake-labs/mcp" used to become just "Mcp", then the listing template
  // appended "MCP Server" → "Mcp MCP Server", and "@memlab/mcp-server" rendered
  // as "MCP Server". When the repo/package part is a bare label, the org is the
  // product name, so fold it in front.
  if (isGenericNameTail(base)) {
    const orgLeaf = ownerBrandSlug(org.split('/').pop() || org);
    const orgName = humanize(orgLeaf);
    if (displayName === 'MCP' || displayName === 'MCP Server') {
      displayName = /\bMCP\b/.test(orgName) ? orgName : `${orgName} MCP`;
    } else {
      displayName = `${orgName} ${displayName}`;
    }
  }
  return { displayName, org };
}

/** Words that read as acronyms in a title: "figma-ui-mcp" -> "Figma UI MCP". */
const TITLE_ACRONYMS = new Set([
  'mcp',
  'ai',
  'api',
  'io',
  'cli',
  'sdk',
  'ui',
  'ux',
  'seo',
  'sql',
  'db',
  'llm',
  'pdf',
  'css',
  'html',
  'crm',
  'aws',
  'gcp',
]);

function titleCaseWord(word: string): string {
  if (TITLE_ACRONYMS.has(word.toLowerCase())) return word.toUpperCase();
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function humanize(base: string): string {
  const words = base.split(/[-_]+/).filter(Boolean);
  if (words.length === 0) return base;
  return words.map(titleCaseWord).join(' ');
}
