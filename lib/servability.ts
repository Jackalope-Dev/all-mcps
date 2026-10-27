/**
 * Whether a listing may be offered to people and agents: in search, browse,
 * category and best-of pages, the homepage, the public API, the MCP server and
 * the catalog exports (llms.txt, data.json).
 *
 * Active is not enough. A listing the stale sweep has flagged (lib/staleness.ts:
 * dead package, gone repo, broken install, not an MCP server, a security
 * finding) stays reachable at its own URL, with a banner and noindex, so its
 * owner and the triage queue can see it — but nothing recommends it while the
 * flag stands. The flag clears itself on the next sweep once the reason no
 * longer holds, so a fixed listing comes straight back.
 *
 * Health alone (archived, offline) is deliberately not a filter here: one
 * failed probe is not proof, and archived repos often still ship a working
 * package. Those rank lower instead (see qualityMultiplier in lib/search.ts);
 * the stale sweep turns a confirmed failure into a flag.
 */
export type ServabilityInput = {
  status?: string | null;
  staleFlaggedAt?: Date | string | number | null;
};

export function isServable(s: ServabilityInput): boolean {
  return s.status === 'active' && s.staleFlaggedAt == null;
}

/**
 * Taken down at its owner's request (a takedown email, a registry
 * withdrawal). Unlike 'removed', which keeps the page up with a banner, every
 * public URL for a withdrawn listing 404s: the page and its subpages, the OG
 * image, badge, markdown, public API and MCP tools. The row is kept on
 * purpose: ingest and the submit form count any existing row as already
 * listed, so the server is never re-added. Nothing moves a listing out of this
 * status on its own; the crons only touch active and pending rows.
 */
export const WITHDRAWN_STATUS = 'withdrawn';

export function isWithdrawn(s: ServabilityInput): boolean {
  return s.status === WITHDRAWN_STATUS;
}

/** The same rule as raw SQL, for hand-written queries over `servers` (optionally aliased). */
export function servableSql(alias?: string): string {
  const c = alias ? `${alias}.` : '';
  return `${c}status = 'active' AND ${c}stale_flagged_at IS NULL`;
}
