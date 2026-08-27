/** Shared featured / premium helpers for browse UI and ranking. */

export type FeaturedFields = {
  isPremium?: boolean | null;
  featuredUntil?: Date | string | number | null;
};

export function isFeaturedListing(
  server: FeaturedFields,
  now = new Date(),
): boolean {
  if (server.isPremium) return true;
  if (!server.featuredUntil) return false;
  const until =
    server.featuredUntil instanceof Date
      ? server.featuredUntil
      : new Date(server.featuredUntil);
  return !Number.isNaN(until.getTime()) && until.getTime() > now.getTime();
}

export function isVerifiedListing(server: {
  isOfficial?: boolean | null;
  isPremium?: boolean | null;
}): boolean {
  return !!(server.isOfficial || server.isPremium);
}
