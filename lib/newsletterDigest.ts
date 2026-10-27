/**
 * Weekly "This week on AllMCPs" digest: candidate ranking and email layout.
 *
 * The route (app/api/cron/newsletter-digest) owns the D1 queries, the LLM call and
 * the Sequenzy API; everything here is pure so ranking and rendering are testable.
 *
 * Why the ranking looks like this: ~500 listings land each week, mostly auto-ingested,
 * so "the 6 newest" was effectively random, and "trending" ranked by all-time upvotes
 * and copies, so it showed the same six listings every Monday. Opens held at ~40%
 * while clicks sat at 0-2%. New listings are now ranked by adoption and quality, and
 * trending by this week's unique views, with a per-category cap so one busy category
 * can't take a whole section.
 */

import { cleanListingDescription } from './description';

const APP_URL = 'https://allmcps.com';

export type DigestCandidate = {
  id: string;
  name: string;
  url: string;
  description: string;
  category: string;
  logoUrl: string | null;
  aiSummary: string | null;
  /** JSON string array, as stored in servers.ai_use_cases. */
  aiUseCases: string | null;
  githubStars: number | null;
  npmDownloads: number | null;
  isOfficial: boolean;
  toolsSource: string | null;
  /** JSON array, as stored in servers.tools. */
  tools: string | null;
  pricingModel: string | null;
  authType: string | null;
  installKind: string | null;
  listingQuality: number | null;
  /** Unique views in the digest window (trending candidates only). */
  weeklyViews?: number;
  /** Upvotes in the digest window (trending candidates only). */
  weeklyUpvotes?: number;
};

export type DigestBlogPost = { slug: string; title: string; excerpt: string };

export type DigestEditorial = {
  intro: string;
  pickWriteup: string;
  blurbs: Record<string, string>;
};

type SequenzyBlock = Record<string, any>;

// --- Ranking ---------------------------------------------------------------

const log10p = (n: number | null | undefined) =>
  Math.log10(1 + Math.max(0, n || 0));

/**
 * A new listing worth a reader's click: real adoption (stars, downloads) first, then
 * our own quality signals. Downloads are capped because a few listings are matched
 * to the wrong npm package and carry millions of downloads that aren't theirs.
 */
export function newListingScore(c: DigestCandidate): number {
  return (
    log10p(c.githubStars) +
    0.25 * log10p(Math.min(c.npmDownloads || 0, 1_000_000)) +
    0.6 * (c.listingQuality ?? 1) +
    (c.isOfficial ? 0.75 : 0) +
    (c.toolsSource === 'introspected' ? 0.3 : 0) +
    (c.logoUrl ? 0.2 : 0)
  );
}

/** Attention this week, with stars as a tie-break between equally viewed listings. */
export function trendingScore(c: DigestCandidate): number {
  return (
    (c.weeklyViews || 0) +
    5 * (c.weeklyUpvotes || 0) +
    0.5 * log10p(c.githubStars)
  );
}

/** Highest-scoring first, at most `maxPerCategory` from any one category. */
export function pickDiverse(
  candidates: DigestCandidate[],
  score: (c: DigestCandidate) => number,
  count: number,
  exclude: Set<string> = new Set(),
  maxPerCategory = 2,
): DigestCandidate[] {
  const perCategory = new Map<string, number>();
  const picked: DigestCandidate[] = [];
  const ranked = candidates
    .filter((c) => !exclude.has(c.id))
    .map((c) => ({ c, s: score(c) }))
    .sort((a, b) => b.s - a.s);
  for (const { c } of ranked) {
    if (picked.length >= count) break;
    const n = perCategory.get(c.category) || 0;
    if (n >= maxPerCategory) continue;
    perCategory.set(c.category, n + 1);
    picked.push(c);
  }
  return picked;
}

/**
 * `owner/repo` (lowercased) for a GitHub URL, ignoring any `/tree/...` subpath, so a
 * monorepo sub-package listing and the repo's own listing count as the same project.
 */
export function githubRepoKey(url: string): string | null {
  const m = url.match(
    /^https?:\/\/(?:www\.)?github\.com\/([^/\s?#]+)\/([^/\s?#]+)/i,
  );
  if (!m) return null;
  return `${m[1]}/${m[2].replace(/\.git$/i, '')}`.toLowerCase();
}

// --- Copy helpers ------------------------------------------------------------

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function escapeHtml(text: string): string {
  return (
    text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Also used inside quoted attributes (alt/src/href), where an unescaped
      // quote in a listing name would end the attribute early.
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  );
}

function parseStringArray(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed)
      ? parsed.filter((s): s is string => typeof s === 'string' && !!s.trim())
      : [];
  } catch {
    return [];
  }
}

function toolCount(c: DigestCandidate): number {
  if (!c.tools) return 0;
  try {
    const parsed = JSON.parse(c.tools);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

export function listingUseCases(c: DigestCandidate): string[] {
  return parseStringArray(c.aiUseCases);
}

/** The listing's one-liner: the LLM-written summary, else the cleaned scrape. */
export function listingSummary(c: DigestCandidate): string {
  return (c.aiSummary || cleanListingDescription(c.description) || '').trim();
}

/**
 * Ingested listings are often named `owner/repo`. In a card that reads like a URL,
 * so show the repo as the title and the owner as a byline.
 */
export function displayName(name: string): {
  title: string;
  by: string | null;
} {
  const m = name.match(/^@?([^/\s]+)\/([^/\s]+)$/);
  if (!m) return { title: name, by: null };
  return { title: m[2], by: m[1] };
}

function compactNumber(n: number): string {
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

const PRICING_SHORT: Record<string, string> = {
  free: 'Free',
  freemium: 'Freemium',
  paid: 'Paid',
  byok: 'Bring your own key',
};
const AUTH_SHORT: Record<string, string> = {
  none: 'No API key',
  api_key: 'API key',
  oauth: 'OAuth',
};

/** Strip the category's leading emoji ("🗄️ Databases" -> "Databases"). */
export function plainCategory(category: string): string {
  return category.replace(/^[^\p{L}\p{N}]+/u, '').trim() || category;
}

/**
 * The quick-decision facts under a listing's name: category, stars, cost, auth,
 * hosted vs local, tool count. Each answers "is this for me?" before the click.
 */
export function factsLine(c: DigestCandidate): string[] {
  const facts = [plainCategory(c.category)];
  if (c.githubStars && c.githubStars >= 10)
    facts.push(`★ ${compactNumber(c.githubStars)}`);
  if (c.pricingModel && PRICING_SHORT[c.pricingModel])
    facts.push(PRICING_SHORT[c.pricingModel]);
  if (c.authType && AUTH_SHORT[c.authType]) facts.push(AUTH_SHORT[c.authType]);
  if (c.installKind === 'remote') facts.push('Hosted');
  const tools = toolCount(c);
  if (tools > 0) facts.push(`${tools} tool${tools === 1 ? '' : 's'}`);
  return facts;
}

// --- Links -------------------------------------------------------------------

/**
 * Absolutize a site-relative path. Logos are stored as `/logos/<id>`, which in an
 * email client resolves against the mail client's own domain and 404s.
 */
function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${APP_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

/** Tag a link with the digest week and its slot, so analytics show which slot gets the clicks. */
export function withUtm(path: string, campaign: string, slot: string): string {
  const url = new URL(absoluteUrl(path));
  url.searchParams.set('utm_source', 'newsletter');
  url.searchParams.set('utm_medium', 'email');
  url.searchParams.set('utm_campaign', campaign);
  url.searchParams.set('utm_content', slot);
  return url.toString();
}

// --- Layout --------------------------------------------------------------------

// Solid-color counterparts of DirectoryGrid.tsx's getGradient() palette (the darker
// stop of each gradient, for contrast with white text) — CSS gradients aren't
// reliably supported in email clients, but using the same hash keeps a given
// listing's fallback color consistent between the site and this email.
const FALLBACK_COLORS = [
  '#007bff',
  '#0f172a',
  '#0369a1',
  '#1e3a8a',
  '#164e63',
  '#1d4ed8',
];

function fallbackColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

function initialLetter(name: string): string {
  const match = name.match(/[\p{L}\p{N}]/u);
  return (match ? match[0] : 'M').toUpperCase();
}

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif";
const BLUE = '#007bff';

function iconHtml(c: DigestCandidate, size: number): string {
  if (c.logoUrl) {
    return `<img src="${escapeHtml(absoluteUrl(c.logoUrl))}" width="${size}" height="${size}" alt="${escapeHtml(c.name)}" style="display:block;width:${size}px;height:${size}px;border-radius:10px;object-fit:cover" />`;
  }
  return `<table role="presentation" width="${size}" height="${size}" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr><td width="${size}" height="${size}" align="center" valign="middle" style="width:${size}px;height:${size}px;border-radius:10px;background-color:${fallbackColor(c.name)};color:#ffffff;font-family:${FONT};font-size:${Math.round(size * 0.42)}px;font-weight:800">${escapeHtml(initialLetter(c.name))}</td></tr></table>`;
}

function headerHtml(c: DigestCandidate, size: number, titlePx: number): string {
  const { title, by } = displayName(c.name);
  const byline = by
    ? ` <span style="font-weight:400;color:#64748b;font-size:13px">by ${escapeHtml(by)}</span>`
    : '';
  const official = c.isOfficial
    ? ` <span style="display:inline-block;background-color:#dcfce7;color:#166534;border-radius:4px;padding:1px 6px;font-size:11px;font-weight:700;vertical-align:middle">OFFICIAL</span>`
    : '';
  const facts = factsLine(c)
    .map((f) => escapeHtml(f))
    .join(' &nbsp;·&nbsp; ');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr><td width="${size}" valign="top" style="width:${size}px;padding-right:14px">${iconHtml(c, size)}</td><td valign="middle" style="font-family:${FONT}"><div style="font-weight:700;font-size:${titlePx}px;color:#020617;line-height:1.3">${escapeHtml(truncate(title, 48))}${byline}${official}</div><div style="margin-top:4px;font-size:12px;line-height:1.5;color:#64748b">${facts}</div></td></tr></table>`;
}

const kicker = (text: string, color = BLUE) =>
  `<div style="font-family:${FONT};font-size:11px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:${color};margin-bottom:12px">${escapeHtml(text)}</div>`;

const CARD_STYLES = {
  backgroundColor: '#ffffff',
  borderColor: '#e2e8f0',
  borderWidth: 1,
  borderRadius: 12,
  paddingTop: 18,
  paddingBottom: 18,
  paddingLeft: 20,
  paddingRight: 20,
};

const PICK_STYLES = {
  ...CARD_STYLES,
  backgroundColor: '#f0f7ff',
  borderColor: '#bfdbfe',
  borderWidth: 2,
  paddingTop: 24,
  paddingBottom: 24,
  paddingLeft: 24,
  paddingRight: 24,
};

function pickBlocks(
  c: DigestCandidate,
  writeup: string | undefined,
  link: string,
): SequenzyBlock[] {
  const copy =
    writeup && /[\p{L}\p{N}]/u.test(writeup)
      ? truncate(writeup.trim(), 420)
      : truncate(listingSummary(c), 260);
  let content = kicker('Pick of the week') + headerHtml(c, 56, 20);
  content += `<p style="margin:16px 0 0;font-family:${FONT};font-size:15px;line-height:1.65;color:#1e293b">${escapeHtml(copy)}</p>`;

  const cases = listingUseCases(c).slice(0, 3);
  if (cases.length > 0) {
    content += `<div style="margin-top:14px;font-family:${FONT};font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.6px">Try asking your agent to</div>`;
    content += cases
      .map(
        (u) =>
          `<div style="margin-top:6px;font-family:${FONT};font-size:14px;line-height:1.5;color:#334155"><span style="color:${BLUE};font-weight:700">→</span>&nbsp; ${escapeHtml(truncate(u, 120))}</div>`,
      )
      .join('');
  }

  content += `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;border-collapse:separate"><tr><td style="background-color:${BLUE};border-radius:8px"><a href="${escapeHtml(link)}" style="display:inline-block;padding:11px 20px;font-family:${FONT};font-size:14px;font-weight:700;color:#ffffff;text-decoration:none">See setup &amp; tools →</a></td></tr></table>`;

  return [{ type: 'text', variant: 'html', content, styles: PICK_STYLES }];
}

function cardBlocks(
  c: DigestCandidate,
  blurb: string | undefined,
  link: string,
): SequenzyBlock[] {
  const copy =
    blurb && /[\p{L}\p{N}]/u.test(blurb)
      ? truncate(blurb.trim(), 180)
      : truncate(listingSummary(c), 160);
  let content = headerHtml(c, 44, 16);
  if (/[\p{L}\p{N}]/u.test(copy)) {
    content += `<p style="margin:12px 0 0;font-family:${FONT};font-size:14px;line-height:1.6;color:#334155">${escapeHtml(copy)}</p>`;
  }
  // A text link, not a button: a full-width button per card read as a wall of chrome.
  content += `<a href="${escapeHtml(link)}" style="display:inline-block;margin-top:10px;font-family:${FONT};font-size:13px;font-weight:700;color:${BLUE};text-decoration:none">View setup →</a>`;
  return [
    { type: 'text', variant: 'html', content, styles: CARD_STYLES },
    { type: 'spacer', height: 10 },
  ];
}

function sectionHeading(title: string, note: string): SequenzyBlock {
  return {
    type: 'text',
    variant: 'html',
    content: `<div style="font-family:${FONT};font-size:18px;font-weight:800;color:#020617">${escapeHtml(title)}</div><div style="margin-top:2px;font-family:${FONT};font-size:13px;color:#64748b">${escapeHtml(note)}</div>`,
  };
}

function blogBlocks(post: DigestBlogPost, link: string): SequenzyBlock[] {
  const content =
    kicker('From the blog', '#64748b') +
    `<a href="${escapeHtml(link)}" style="font-family:${FONT};font-size:17px;font-weight:700;line-height:1.35;color:#020617;text-decoration:none">${escapeHtml(post.title)}</a>` +
    `<p style="margin:8px 0 0;font-family:${FONT};font-size:14px;line-height:1.6;color:#475569">${escapeHtml(truncate(post.excerpt, 200))}</p>` +
    `<a href="${escapeHtml(link)}" style="display:inline-block;margin-top:10px;font-family:${FONT};font-size:13px;font-weight:700;color:${BLUE};text-decoration:none">Read the guide →</a>`;
  return [
    {
      type: 'text',
      variant: 'html',
      content,
      styles: { ...CARD_STYLES, backgroundColor: '#f8fafc' },
    },
  ];
}

export function buildDigestBlocks(input: {
  pick: DigestCandidate | null;
  newListings: DigestCandidate[];
  trending: DigestCandidate[];
  blogPost: DigestBlogPost | null;
  editorial: DigestEditorial;
  /** utm_campaign value, e.g. `digest-2026-w44`. */
  campaign: string;
}): SequenzyBlock[] {
  const { pick, newListings, trending, blogPost, editorial, campaign } = input;
  const listingLink = (c: DigestCandidate, slot: string) =>
    withUtm(`/mcp/${c.id}`, campaign, slot);

  const blocks: SequenzyBlock[] = [
    { type: 'logo', alt: 'AllMCPs Logo', align: 'center', width: 64 },
    { type: 'heading', content: 'This week on AllMCPs', level: 1 },
    {
      type: 'text',
      variant: 'paragraph',
      content: `<p>${escapeHtml(editorial.intro)}</p>`,
    },
    { type: 'spacer', height: 8 },
  ];

  if (pick) {
    blocks.push(
      ...pickBlocks(pick, editorial.pickWriteup, listingLink(pick, 'pick')),
    );
    blocks.push({ type: 'spacer', height: 24 });
  }

  if (newListings.length > 0) {
    blocks.push(
      sectionHeading('New & notable', 'The strongest servers added this week'),
    );
    blocks.push({ type: 'spacer', height: 8 });
    newListings.forEach((c, i) => {
      blocks.push(
        ...cardBlocks(
          c,
          editorial.blurbs[c.id],
          listingLink(c, `new-${i + 1}`),
        ),
      );
    });
    blocks.push({ type: 'spacer', height: 14 });
  }

  if (trending.length > 0) {
    blocks.push(
      sectionHeading(
        'Trending this week',
        'What developers are looking at right now',
      ),
    );
    blocks.push({ type: 'spacer', height: 8 });
    trending.forEach((c, i) => {
      blocks.push(
        ...cardBlocks(
          c,
          editorial.blurbs[c.id],
          listingLink(c, `trending-${i + 1}`),
        ),
      );
    });
    blocks.push({ type: 'spacer', height: 14 });
  }

  if (blogPost) {
    blocks.push(
      ...blogBlocks(
        blogPost,
        withUtm(`/blog/${blogPost.slug}`, campaign, 'blog'),
      ),
    );
    blocks.push({ type: 'spacer', height: 16 });
  }

  blocks.push({
    type: 'button',
    text: 'Browse all MCP servers →',
    url: withUtm('/browse', campaign, 'browse'),
    variant: 'primary',
  });
  blocks.push({
    type: 'footer',
    address: 'Jackalope Digital \n1500 N GRANT ST # 7225 \nDENVER, CO 80203',
    variant: 'full',
    companyName: 'AllMCPs',
    privacyPolicyUrl: 'https://allmcps.com/privacy',
  });

  return blocks;
}
