/**
 * Server names are usually the literal package/repo identifier (e.g.
 * "moxiespirit/oathscore", "@modelcontextprotocol/server-filesystem") — accurate
 * for install snippets, but noisy as a page title. Splits off the org/scope
 * prefix and humanizes the remainder for display; install snippets etc. should
 * keep using the raw `server.name`, not this.
 */
export function parseServerName(name: string): { displayName: string; org: string | null } {
  const idx = name.lastIndexOf('/');
  if (idx === -1) {
    return { displayName: humanize(name), org: null };
  }
  return { displayName: humanize(name.slice(idx + 1)), org: name.slice(0, idx) };
}

function humanize(base: string): string {
  const words = base.split(/[-_]+/).filter(Boolean);
  if (words.length === 0) return base;
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}
