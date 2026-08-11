/**
 * Shared EU/UK detection — same signal CookieBanner uses to decide whether
 * consent must be opt-in (GDPR/PECR: no pre-ticked boxes). Anything that
 * defaults a marketing checkbox should reuse this rather than re-deriving it.
 */

export const EU_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU',
  'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES',
  'SE', 'GB', 'UK', 'IS', 'LI', 'NO', 'CH'
]);

/**
 * `countryProp` should be a real geo signal (e.g. the `cf-ipcountry` header)
 * when called server-side. Client-side callers can omit it — the Intl
 * timezone fallback only reflects the *browser's* locale, so it's a guess,
 * not authoritative.
 */
export function isUserInEU(countryProp?: string): boolean {
  if (countryProp) {
    return EU_COUNTRIES.has(countryProp.toUpperCase());
  }

  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (
      tz.startsWith('Europe/') ||
      tz.startsWith('Atlantic/Reykjavik') ||
      tz.startsWith('Atlantic/Faroe') ||
      tz.startsWith('Atlantic/Canary') ||
      tz.startsWith('Atlantic/Madeira') ||
      tz.startsWith('Atlantic/Azores')
    ) {
      return true;
    }
  } catch {
    // Ignore error
  }

  return false;
}
