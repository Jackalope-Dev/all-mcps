import type { ZodError } from 'zod';

/**
 * Renders a ZodError as one human-readable sentence for an API `error` field.
 *
 * Routes used to hand back `result.error.issues` — a raw array of issue
 * objects. Clients do `new Error(data.error)`, which stringifies an array of
 * objects to a literally unactionable "[object Object]" in the failure toast
 * (that string is what a listing owner saw instead of "details: too long").
 * Anything returned as `error` has to be a string a person can act on.
 */
export function formatZodError(error: ZodError): string {
  const seen = new Set<string>();
  const parts: string[] = [];

  for (const issue of error.issues) {
    const field = issue.path
      .filter((seg) => typeof seg === 'string' || typeof seg === 'number')
      .join('.');
    const line = field ? `${field}: ${issue.message}` : issue.message;
    if (seen.has(line)) continue;
    seen.add(line);
    parts.push(line);
    // More than a few and the toast stops being readable; the first offending
    // fields are what the person needs to fix anyway.
    if (parts.length === 3) break;
  }

  if (parts.length === 0) return 'Invalid request.';
  const more = error.issues.length - parts.length;
  return parts.join('; ') + (more > 0 ? ` (and ${more} more)` : '');
}
