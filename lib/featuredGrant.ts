/**
 * Pure date math for the admin "grant N featured days" action. Stacks on top of
 * any remaining featured time rather than resetting it — a goodwill grant on a
 * listing that already has 5 days left should leave 5+N, not just N.
 */
export function computeFeaturedUntil(
  currentFeaturedUntil: Date | null,
  days: number,
  now: Date = new Date()
): Date {
  const base =
    currentFeaturedUntil && currentFeaturedUntil.getTime() > now.getTime()
      ? currentFeaturedUntil.getTime()
      : now.getTime();
  return new Date(base + days * 24 * 60 * 60 * 1000);
}
