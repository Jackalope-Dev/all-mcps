/**
 * Stable 32-bit string hash (Java-style). Listing pages are ISR-cached, so a
 * per-page pick must be deterministic: hashing the listing id spreads picks
 * evenly across the catalog instead of freezing one random roll per page.
 */
export function listingIdHash(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (Math.imul(hash, 31) + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * `count` entries of `pool` for the listing `id`, starting at a hash-chosen
 * offset and wrapping, skipping ids in `exclude` (the listing itself and
 * anything the page already links). Each listing shows a different window of
 * the pool, so across a category every pool entry gets inbound links: this is
 * what gives newly added long-tail listings a crawl path besides the sitemap.
 */
export function pickRotatingLinks<T extends { id: string }>(
  pool: T[],
  id: string,
  count: number,
  exclude: Iterable<string> = [],
): T[] {
  const skip = new Set(exclude);
  skip.add(id);
  const eligible = pool.filter((p) => !skip.has(p.id));
  if (eligible.length <= count) return eligible;
  const start = listingIdHash(id) % eligible.length;
  return Array.from(
    { length: count },
    (_, i) => eligible[(start + i) % eligible.length],
  );
}
