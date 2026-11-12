import { formatCheckAge, formatUtcDateTime } from '@/lib/format';

/**
 * When one of our own checks last ran, in the one format listing pages use:
 * a relative age ("5h ago") with the exact UTC time on hover. Server-only
 * (the age is computed at render), so keep it out of client components.
 */
export function CheckedAt({ at }: { at: string | Date }) {
  const age = formatCheckAge(at);
  const exact = formatUtcDateTime(at);
  if (!age || !exact) return null;
  return (
    <time dateTime={new Date(at).toISOString()} title={exact}>
      {age}
    </time>
  );
}
