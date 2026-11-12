/** Compact "updated Nd/mo/y ago" from a repo's last-commit timestamp. Null when unknown. */
export function formatCommitAge(dateVal?: string | Date | null): string | null {
  if (!dateVal) return null;
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return null;
  const days = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return null;
  if (days < 1) return 'Today';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/** Formats a timestamp into a human-readable full date string for tooltips (e.g. "Oct 24, 2024"). */
export function formatFullDate(dateVal?: string | Date | null): string | null {
  if (!dateVal) return null;
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Age of one of our own checks (health, endpoint, sandbox), down to the hour:
 * "under an hour ago", "5h ago", "3d ago", "2mo ago". Null when unknown.
 * Listing pages are cached for up to an hour, so finer than that would mislead.
 */
export function formatCheckAge(
  dateVal?: string | Date | null,
  now: number = Date.now(),
): string | null {
  if (!dateVal) return null;
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return null;
  const hours = Math.floor((now - d.getTime()) / (1000 * 60 * 60));
  if (hours < 0) return null;
  if (hours < 1) return 'under an hour ago';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/** Exact UTC timestamp for tooltips, e.g. "Nov 11, 2026, 19:00 UTC". Null when unknown. */
export function formatUtcDateTime(
  dateVal?: string | Date | null,
): string | null {
  if (!dateVal) return null;
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return null;
  const date = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const time = d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
  return `${date}, ${time} UTC`;
}

/** A "YYYY-MM-DD" page date as "Nov 11, 2026" (UTC, so build and runtime agree). */
export function formatPageDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * The view count shown to visitors: every listing page load (totalViews).
 * `views` is the windowed ranking signal and is never displayed; it is only the
 * fallback for snapshot rows that predate totalViews.
 */
export function publicViewCount(s: {
  totalViews?: number | null;
  views?: number | null;
}): number {
  return s.totalViews ?? s.views ?? 0;
}

/**
 * Formats large numeric counts compactly for directory cards (e.g. 1.2k, 15k, 145k, 1.2M)
 * while full precision is preserved in tooltips and accessible labels.
 */
export function formatCompactNumber(num?: number | null): string {
  if (num == null || Number.isNaN(num) || num <= 0) return '0';
  if (num < 1000) return num.toString();
  if (num < 10000) {
    const formatted = (num / 1000).toFixed(1);
    return formatted.endsWith('.0')
      ? `${Math.floor(num / 1000)}k`
      : `${formatted}k`;
  }
  if (num < 1000000) {
    return `${Math.floor(num / 1000)}k`;
  }
  if (num < 10000000) {
    const formatted = (num / 1000000).toFixed(1);
    return formatted.endsWith('.0')
      ? `${Math.floor(num / 1000000)}M`
      : `${formatted}M`;
  }
  return `${Math.floor(num / 1000000)}M`;
}
