/**
 * Star counts we can't take at face value.
 *
 * GitHub stars can be bought. In Nov 2026 the digest put "REA ★ 474.5k" in front
 * of subscribers: a repo created that April with ~2,100 stars a day, every day,
 * for seven months — more than the biggest open-source projects ever sustained.
 * The count was GitHub's own; the stars just weren't real. Pace since creation
 * catches that without a list of offenders.
 *
 * Viral launches run hot for a few weeks (DeepSeek-R1, gemini-cli peaked in the
 * low thousands a day), so the bar is a sustained average over at least a month,
 * well above anything organic for an MCP project.
 */

/** Sustained stars/day above this, averaged since creation, reads as bought. */
const MAX_ORGANIC_STARS_PER_DAY = 1000;
/** Below this many stars the pace test is noise. */
const MIN_STARS_TO_JUDGE = 10_000;
/** A repo younger than this can still be riding a real launch spike. */
const MIN_AGE_DAYS = 60;

export function starsLookInflated(
  stars: number | null | undefined,
  repoCreatedAt: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!stars || stars < MIN_STARS_TO_JUDGE || !repoCreatedAt) return false;
  const ageDays = (now.getTime() - repoCreatedAt.getTime()) / 86_400_000;
  if (!Number.isFinite(ageDays) || ageDays < MIN_AGE_DAYS) return false;
  return stars / ageDays > MAX_ORGANIC_STARS_PER_DAY;
}
