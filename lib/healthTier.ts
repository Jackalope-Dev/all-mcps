import { type SQL, sql } from 'drizzle-orm';
import { servers } from '../db/schema';

/**
 * How often the health cron rechecks a listing, by how much people use it.
 *
 * One cadence for everyone meant a listing thousands of people install was
 * checked no more often than a zero-traffic one, and a full pass took over a
 * week. Popular listings are checked twice a day, the middle every two days
 * and the long tail every four. The thresholds are deliberately low: a
 * handful of views or a few dozen stars already marks a listing someone is
 * looking at.
 *
 * A listing that is failing (offline) or has no verdict yet (unknown) is
 * rechecked every few hours whatever its tier, so a blip clears quickly and a
 * real outage builds the run of failed checks the stale sweep's 'site-down'
 * rule needs (lib/staleness.ts).
 *
 * Budget: the cron takes 150 per 15-min tick, ~14k/day; ~33k active listings
 * at these tiers need roughly 10-11k.
 */
const HEALTH_TIER_MS = {
  failing: 6 * 60 * 60 * 1000,
  hot: 12 * 60 * 60 * 1000,
  warm: 2 * 24 * 60 * 60 * 1000,
  cold: 4 * 24 * 60 * 60 * 1000,
} as const;

/**
 * True when a listing is due for a check at `now`. Failing or unchecked
 * listings are due every few hours. Otherwise paid, featured and
 * popular listings (200+ views, 5+ upvotes, 1000+ stars) are hot; some use
 * (10+ views, any install copy, 50+ stars) is warm; the rest is cold.
 * The cron orders the due set by healthPrioritySql, then last_checked_at.
 */
export function healthDueSql(now: Date): SQL {
  const t = Math.floor(now.getTime() / 1000);
  const failing = t - HEALTH_TIER_MS.failing / 1000;
  const hot = t - HEALTH_TIER_MS.hot / 1000;
  const warm = t - HEALTH_TIER_MS.warm / 1000;
  const cold = t - HEALTH_TIER_MS.cold / 1000;
  return sql`(${servers.lastCheckedAt} IS NULL OR ${servers.lastCheckedAt} < CASE
    WHEN coalesce(${servers.healthStatus}, 'unknown') IN ('offline', 'unknown') THEN ${failing}
    WHEN ${servers.isPremium} = 1
      OR coalesce(${servers.featuredUntil}, 0) > ${t}
      OR coalesce(${servers.views}, 0) >= 200
      OR coalesce(${servers.upvotes}, 0) >= 5
      OR coalesce(${servers.githubStars}, 0) >= 1000 THEN ${hot}
    WHEN coalesce(${servers.views}, 0) >= 10
      OR coalesce(${servers.copies}, 0) >= 1
      OR coalesce(${servers.githubStars}, 0) >= 50 THEN ${warm}
    ELSE ${cold} END)`;
}

/**
 * Sort key that puts failing and never-checked listings ahead of routine
 * rechecks. Without it a tier change (or a backlog) that makes thousands of
 * healthy listings due at once queues them ahead of the ones that need a
 * verdict, since those were stamped more recently. Costs a sort over the due
 * set instead of an index walk, which D1 handles at catalog size.
 */
export function healthPrioritySql(): SQL {
  return sql`CASE WHEN coalesce(${servers.healthStatus}, 'unknown') IN ('offline', 'unknown') THEN 0 ELSE 1 END`;
}
