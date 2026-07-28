/** Custom DOM event admin components dispatch after a mutation so StatsBar can refresh without a full page reload. */
export const ADMIN_STATS_REFRESH_EVENT = 'admin:stats-refresh';

export function notifyAdminStatsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(ADMIN_STATS_REFRESH_EVENT));
  }
}
