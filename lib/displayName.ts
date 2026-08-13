/**
 * Server names are usually the literal package/repo identifier (e.g.
 * "moxiespirit/oathscore", "@modelcontextprotocol/server-filesystem") — accurate
 * for install snippets, but noisy as a page title. Splits off the org/scope
 * prefix and humanizes the remainder for display; install snippets etc. should
 * keep using the raw `server.name`, not this.
 */
export function parseServerName(name: string, url?: string): { displayName: string; org: string | null } {
  const idx = name.lastIndexOf('/');
  if (idx === -1) {
    // Some ~200 catalog entries have a bare, uninformative `name` of literally
    // "mcp" with no org prefix — the org-folding fix below never fires for
    // them since there's no slash to split on. Recover the org/repo from the
    // GitHub URL instead, when the caller has one, so these don't all render
    // as page title/H1 "MCP".
    if (/^mcp$/i.test(name) && url) {
      const m = url.match(/github\.com\/([^/]+)\/([^/#?]+)/i);
      if (m) {
        const org = m[1];
        const repo = m[2].replace(/\.git$/i, '');
        return parseServerName(`${org}/${repo}`);
      }
    }
    return { displayName: humanize(name), org: null };
  }
  const org = name.slice(0, idx);
  const base = name.slice(idx + 1);
  let displayName = humanize(base);
  // "snowflake-labs/mcp" used to become just "Mcp", then the listing template
  // appended "MCP Server" → "Mcp MCP Server". Fold the org in when the repo
  // name is only "mcp" (or humanizes to only "MCP").
  if (/^mcp$/i.test(base) || displayName === 'MCP') {
    const orgLeaf = org.split('/').pop() || org;
    displayName = `${humanize(orgLeaf)} MCP`;
  }
  return { displayName, org };
}

function titleCaseWord(word: string): string {
  if (/^mcp$/i.test(word)) return 'MCP';
  if (word.toLowerCase() === 'ai') return 'AI';
  if (word.toLowerCase() === 'api') return 'API';
  if (word.toLowerCase() === 'io') return 'IO';
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function humanize(base: string): string {
  const words = base.split(/[-_]+/).filter(Boolean);
  if (words.length === 0) return base;
  return words.map(titleCaseWord).join(' ');
}
