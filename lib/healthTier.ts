import { type SQL, sql } from 'drizzle-orm';
import { servers } from '../db/schema';

/**
 * How often the health cron rechecks a listing, by how much people use it.
 *
 * One cadence for everyone meant a listing thousands of people install was
 * checked no more often than a zero-traffic one, and a full pass took over a
 * week. Popular listings are now checked daily, the middle every three days
 * and the long tail weekly. The thresholds are deliberately low: a handful of
 * views or a few dozen stars already marks a listing someone is looking at.
 */
const HEALTH_TIER_MS = {
  hot: 24 * 60 * 60 * 1000,
  warm: 3 * 24 * 60 * 60 * 1000,
  cold: 7 * 24 * 60 * 60 * 1000,
} as const;

/**
 * True when a listing is due for a check at `now`. Paid, featured and
 * popular listings (200+ views, 5+ upvotes, 1000+ stars) are hot; some use
 * (10+ views, any install copy, 50+ stars) is warm; the rest is cold.
 * Walked with idx_servers_status_last_checked in last_checked_at order, so the
 * cron reads only until it has a batch.
 */
export function healthDueSql(now: Date): SQL {
  const t = Math.floor(now.getTime() / 1000);
  const hot = t - HEALTH_TIER_MS.hot / 1000;
  const warm = t - HEALTH_TIER_MS.warm / 1000;
  const cold = t - HEALTH_TIER_MS.cold / 1000;
  return sql`(${servers.lastCheckedAt} IS NULL OR ${servers.lastCheckedAt} < CASE
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
