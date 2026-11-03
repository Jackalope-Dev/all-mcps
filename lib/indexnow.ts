/**
 * IndexNow — notify Bing/Yandex/etc. when a URL is new or updated.
 * Key file lives at public/{KEY}.txt and is served at https://allmcps.com/{KEY}.txt
 */

import { isServerRowIndexable } from './listingIndexability';

const INDEXNOW_KEY = 'c7fa82e1d09b4f658a2e3f4b5c6d7e8f';
const HOST = 'allmcps.com';
const KEY_LOCATION = `https://${HOST}/${INDEXNOW_KEY}.txt`;
const ENDPOINT = 'https://api.indexnow.org/indexnow';

/**
 * Best-effort IndexNow ping. Never throws; logs failures.
 * Safe to fire-and-forget on approve/republish.
 */
export async function submitIndexNowUrls(urls: string[]): Promise<boolean> {
  const urlList = [
    ...new Set(
      urls.filter((u) => typeof u === 'string' && u.startsWith('https://')),
    ),
  ].slice(0, 100);
  if (urlList.length === 0) return false;

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: HOST,
        key: INDEXNOW_KEY,
        keyLocation: KEY_LOCATION,
        urlList,
      }),
    });
    if (res.status === 200 || res.status === 202) return true;
    const text = await res.text().catch(() => '');
    // 429 is an expected outcome of firing one ping per admin approve/republish
    // with no shared rate limiting — a burst of admin actions can exceed
    // IndexNow's per-key limit. Best-effort by design (see submitIndexNowUrls
    // doc comment); the daily indexnow cron re-submits recent listings anyway,
    // so a dropped ping here isn't a lasting problem worth error-level noise.
    if (res.status === 429) {
      console.warn(`IndexNow rate-limited (429):`, text.slice(0, 200));
    } else {
      console.error(`IndexNow failed (${res.status}):`, text.slice(0, 200));
    }
    return false;
  } catch (e) {
    console.error('IndexNow network error:', e);
    return false;
  }
}

/**
 * Ping IndexNow for a listing page (and optional extra paths), but only when
 * the page is indexable. A fresh listing has no writeup yet, so it is noindexed
 * and left out of the listings sitemap; pinging it anyway is what made Bing
 * flag "important pages missing in sitemaps". The daily indexnow cron pings it
 * once its writeup lands and it enters the sitemap.
 */
export async function notifyListingIndexed(
  row: Parameters<typeof isServerRowIndexable>[0] & { id: string },
  extraPaths: string[] = [],
): Promise<void> {
  if (!isServerRowIndexable(row)) return;
  const base = `https://${HOST}/mcp/${row.id}`;
  const urls = [
    base,
    ...extraPaths.map((p) =>
      p.startsWith('http') ? p : `https://${HOST}${p}`,
    ),
  ];
  await submitIndexNowUrls(urls);
}
