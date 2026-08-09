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

