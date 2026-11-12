/**
 * Paths that have a real Markdown rendering for agents (Accept: text/markdown or
 * ?format=md). middleware.ts only rewrites these to /api/v1/markdown-renderer;
 * every other page falls through to its HTML.
 *
 * Why: the renderer used to answer any path, and for pages without a renderer
 * (e.g. /trust, /state-of-mcp, the guides) it returned a three-link stub. An
 * agent asking for Markdown then saw an empty page where the HTML has the full
 * content. HTML is a better answer than a stub.
 */
const AGENT_MARKDOWN_PATHS: RegExp[] = [
  /^\/$/,
  /^\/blog$/,
  /^\/blog\/[^/]+$/,
  /^\/categories$/,
  /^\/categories\/[^/]+$/,
  /^\/best$/,
  /^\/best\/[^/]+$/,
  /^\/clients$/,
  /^\/clients\/[^/]+$/,
  /^\/prompts$/,
  /^\/prompts\/[^/]+$/,
  /^\/mcp\/[^/]+\/vs\/[^/]+$/,
  /^\/mcp\/[^/]+\/alternatives$/,
];

/** Strips trailing slashes ("/" stays "/"). A loop, not /\/+$/, which backtracks. */
export function normalizeAgentPath(path: string): string {
  let end = path.length;
  while (end > 0 && path[end - 1] === '/') end--;
  return path.slice(0, end) || '/';
}

export function hasAgentMarkdown(path: string): boolean {
  const normalized = normalizeAgentPath(path);
  return AGENT_MARKDOWN_PATHS.some((re) => re.test(normalized));
}
