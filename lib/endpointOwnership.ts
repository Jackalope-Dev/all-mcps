import { and, ne, or, type SQL, sql } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/d1';
import { servers } from '../db/schema';

/** `https://x.dev/mcp` and `https://x.dev/mcp/` are one endpoint. */
function endpointVariants(url: string): string[] {
  const bare = url.trim().replace(/\/+$/, '');
  return [bare, `${bare}/`];
}

/**
 * For discoverRemoteEndpoint's `isClaimedElsewhere`: does a listing other than
 * `selfId` (still listed, not retired) already use this URL as its primary URL,
 * its remote endpoint, or its cached remote install? Then a sibling listing on
 * the same domain that merely guessed or found it linked must not take it.
 *
 * Neither column is indexed, so this is a scan; discovery asks only for an
 * answering linked/guessed candidate, which is rare.
 */
export function endpointClaimedElsewhere(
  db: ReturnType<typeof drizzle>,
  selfId?: string,
): (url: string) => Promise<boolean> {
  return async (url) => {
    const variants = endpointVariants(url);
    const inList = sql.join(
      variants.map((v) => sql`${v}`),
      sql`, `,
    );
    const conditions: SQL[] = [
      ne(servers.status, 'removed'),
      or(
        sql`${servers.url} IN (${inList})`,
        sql`${servers.remoteEndpointUrl} IN (${inList})`,
        sql`(${servers.installKind} = 'remote' AND ${servers.installPackage} IN (${inList}))`,
      ) as SQL,
    ];
    if (selfId) conditions.push(ne(servers.id, selfId));
    const rows = await db
      .select({ id: servers.id })
      .from(servers)
      .where(and(...conditions))
      .limit(1);
    return rows.length > 0;
  };
}
