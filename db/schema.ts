import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core';

export const servers = sqliteTable('servers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(),
  /** Optional product/marketing website (separate from the repo `url`). */
  websiteUrl: text('website_url'),
  /** Email the submitter gave at submit time. Used for status notices and the submission upsell sequence. */
  submitterEmail: text('submitter_email'),
  /** Paid/premium listings get dofollow website backlinks; free listings use nofollow. */
  isPremium: integer('is_premium', { mode: 'boolean' }).notNull().default(false),
  /** True when the owner proved control of `websiteUrl` (DNS TXT or site badge). */
  websiteVerified: integer('website_verified', { mode: 'boolean' }).notNull().default(false),
  /** Claimed/verified ownership (GitHub README, site badge, or DNS). */
  isOfficial: integer('is_official', { mode: 'boolean' }).notNull().default(false),
  claimedAt: integer('claimed_at', { mode: 'timestamp' }),
  /** Auth.js user id after claim (optional until owners sign in). */
  ownerUserId: text('owner_user_id'),
  /** Set when a website/DNS claim proves control of a *new* site (not already on file) — awaits admin approval before ownerUserId/isOfficial/websiteUrl take effect. */
  pendingClaimUserId: text('pending_claim_user_id'),
  /** The site the pending claimant proved control of. */
  pendingClaimWebsiteUrl: text('pending_claim_website_url'),
  /** Timed featured placement (e.g. 7-day boost). */
  featuredUntil: integer('featured_until', { mode: 'timestamp' }),
  /** Timed #1-in-category pin from a category_sponsor_7d purchase. Distinct from featuredUntil so a category sponsorship doesn't get confused with a plain featured boost — category ranking checks this field specifically. Scoped to `category` as of purchase time. */
  categorySponsorUntil: integer('category_sponsor_until', { mode: 'timestamp' }),
  /** Paid priority in the admin review queue. */
  reviewPriority: integer('review_priority', { mode: 'boolean' }).notNull().default(false),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  /** free | active | past_due | canceled */
  premiumStatus: text('premium_status').notNull().default('free'),
  /** JSON blob of pending owner edits awaiting admin approval. */
  pendingRevision: text('pending_revision'),
  /** Live, admin-approved logo URL (e.g. `/logos/<id>`). Null = use the generated gradient avatar. */
  logoUrl: text('logo_url'),
  /** Source of logo: 'readme' | 'website_favicon' | 'github_org' | 'github_user' | 'manual' */
  logoSource: text('logo_source'),
  /** R2 key of an uploaded logo awaiting admin approval (e.g. `pending/<id>.png`). Null = nothing pending. */
  pendingLogoKey: text('pending_logo_key'),
  status: text('status').notNull().default('pending'),
  lastCheckedAt: integer('last_checked_at', { mode: 'timestamp' }),
  isVerifiedActive: integer('is_verified_active', { mode: 'boolean' }).notNull().default(false),
  healthStatus: text('health_status').notNull().default('unknown'),
  /** Whether the periodic recheck last found our badge/link still live (README or site). Drives dofollow for non-premium claimed listings. */
  reciprocalBadgeOk: integer('reciprocal_badge_ok', { mode: 'boolean' }).notNull().default(false),
  /** Last time the reciprocal-badge recheck ran for this listing (set alongside lastCheckedAt by the health cron). */
  badgeLastCheckedAt: integer('badge_last_checked_at', { mode: 'timestamp' }),
  /** GitHub stargazers, refreshed by the health cron. Null = not measured yet. */
  githubStars: integer('github_stars'),
  /** Repo's `pushed_at` from the GitHub API (last commit/push), refreshed by the health cron. Null = not a GitHub-linked listing or not measured yet. Surfaced so visitors can judge staleness without cloning the repo. */
  lastCommitAt: integer('last_commit_at', { mode: 'timestamp' }),
  /** npm last-month downloads for the package, refreshed by the health cron. Null = not an npm package or not measured. */
  npmDownloads: integer('npm_downloads'),
  /** JSON array of {name, description} captured when a listing exposes a callable MCP endpoint. Null = tools not introspected. */
  tools: text('tools'),
  /** Last time we attempted MCP tool introspection for this listing. */
  toolsCheckedAt: integer('tools_checked_at', { mode: 'timestamp' }),
  /** Error from the last tools/list attempt (e.g. "Connection timed out."). Null on success or before first attempt — lets us see *why* introspection is failing instead of just that `tools` is empty. */
  toolsError: text('tools_error'),
  /** How `tools` was obtained: 'introspected' (live MCP tools/list handshake) or 'readme' (best-effort static parse of the repo README, for the vast majority of listings that are npx/uvx/pip stdio packages, not a live HTTP endpoint). Null = not yet attempted. */
  toolsSource: text('tools_source'),
  /**
   * LLM-generated, human-readable content that turns a scraped README-mirror page into a
   * unique, useful listing (see /api/cron/ai-content). All nullable — absence means the
   * page falls back to the raw description/README. This is the content layer that makes
   * each /mcp/[id] page distinct from the upstream repo for both readers and search.
   */
  /** One clean sentence — replaces scraped chrome in cards, meta descriptions, and the digest. */
  aiSummary: text('ai_summary'),
  /** 2-4 sentence plain-language overview: what it does and when you'd reach for it. */
  aiOverview: text('ai_overview'),
  /** JSON string array of concrete use cases ("Let an agent query your Postgres database"). */
  aiUseCases: text('ai_use_cases'),
  /** JSON string array of key capabilities/features surfaced from the README. */
  aiFeatures: text('ai_features'),
  /** When the AI content was last generated. Null = never enriched. */
  aiEnrichedAt: integer('ai_enriched_at', { mode: 'timestamp' }),
  /** JSON array of {q, a} grounded Q&A pairs for the /mcp/[id] FAQ section and its
   * FAQPage schema (see /api/cron/ai-faq, /api/cron/ai-content). Null = not
   * generated yet — the page falls back to generic boilerplate questions. */
  aiFaq: text('ai_faq'),
  /** When the FAQ was last generated. Deliberately separate from aiEnrichedAt so
   * the already-enriched backlog can be backfilled without re-running the rest
   * of the content pipeline. */
  aiFaqAt: integer('ai_faq_at', { mode: 'timestamp' }),
  /**
   * When the LLM last extracted/validated install_kind/install_command/
   * install_args/install_package for this listing (see lib/aiContent.ts,
   * /api/cron/ai-content). Deliberately separate from aiEnrichedAt so the
   * already-enriched backlog can be backfilled for install-field re-checks
   * without re-running the rest of the content pipeline — same pattern as
   * aiFaqAt. The regex/heuristic README parser this replaces as the primary
   * source routinely mistook mentioned third-party tools (installer CLIs,
   * debugging utilities, generic framework/library dependencies) for the
   * listing's own install command; an LLM reading the README with context
   * can tell those apart. Null = not yet LLM-validated, still on the
   * heuristic-parsed value.
   */
  installExtractedAt: integer('install_extracted_at', { mode: 'timestamp' }),
  /** JSON array of UPPER_SNAKE_CASE env var names (API keys, tokens) the README/setup
   * instructions say are required to run this server. Generated alongside the rest of
   * the AI content layer (see lib/aiContent.ts) — used to add env placeholders to
   * generated mcpServers configs instead of silently omitting required secrets. */
  aiEnvVars: text('ai_env_vars'),
  /** When this listing's semantic embedding was last pushed to Cloudflare Vectorize
   * (see /api/cron/vector-index, lib/vectorSearch.ts). Null = never indexed. Lets
   * the cron atomically claim a bounded batch per tick instead of walking the
   * full catalog every run — same shape as aiFaqAt above. */
  vectorSyncedAt: integer('vector_synced_at', { mode: 'timestamp' }),
  /**
   * Optional secondary connection method: a live hosted MCP endpoint offered
   * *in addition to* the primary stdio/remote install already described by
   * installKind/installCommand/etc. Common when a server ships both a hosted
   * endpoint and a stdio wrapper/bridge package for clients without native
   * remote-MCP support. When set, the health cron prefers a live tools/list
   * handshake against this URL over README-parsing.
   */
  remoteEndpointUrl: text('remote_endpoint_url'),
  /**
   * Live health of remoteEndpointUrl specifically, from the same handshake the
   * health cron already runs to verify its tools (see the cron's remoteEndpointUrl
   * block). Deliberately separate from healthStatus/isVerifiedActive, which track
   * the *primary* url (for allmcps-server that's the GitHub repo, not this
   * endpoint) — conflating the two would mean a transient remote-endpoint outage
   * could trip the primary-url unpublish logic, which only makes sense for a
   * genuinely archived/dead repo. Null = never checked (no remoteEndpointUrl, or
   * not yet reached by the cron).
   */
  remoteEndpointHealthy: integer('remote_endpoint_healthy', { mode: 'boolean' }),
  remoteEndpointCheckedAt: integer('remote_endpoint_checked_at', { mode: 'timestamp' }),
  /** stdio | remote — cached install transport from README/description parse. */
  installKind: text('install_kind'),
  /** Runner binary for stdio installs (npx, uvx, bunx). */
  installCommand: text('install_command'),
  /** JSON string array of CLI args for stdio installs. */
  installArgs: text('install_args'),
  /** Package name or remote URL used in install configs. */
  installPackage: text('install_package'),
  /** high | medium | low — how trustworthy the cached install hint is. */
  installConfidence: text('install_confidence'),
  views: integer('views').notNull().default(0),
  copies: integer('copies').notNull().default(0),
  upvotes: integer('upvotes').notNull().default(0),
  /** Last time this listing was posted to X/Twitter (highlight cron or new-listing announce). Drives least-recently-posted rotation so highlights don't repeat. */
  lastTweetedAt: integer('last_tweeted_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  /** JSON string array of freeform submitter-chosen keywords (max 5, ≤30 chars each). Distinct from the single curated `category`. */
  tags: text('tags'),
  /** free | freemium | paid | byok — self-declared cost model of *using* this MCP server (not directory pricing). */
  pricingModel: text('pricing_model'),
  /** Optional free-text elaboration on pricing, e.g. "Free tier: 100 req/day". */
  pricingNotes: text('pricing_notes'),
  /** none | api_key | oauth | other — self-declared auth requirement. */
  authType: text('auth_type'),
  /** Free-text license identifier, e.g. "MIT", "Apache-2.0". */
  license: text('license'),
  /** JSON string array of MCP_CLIENTS slugs this server is confirmed compatible with. */
  compatibleClients: text('compatible_clients'),
  /** active | stable | experimental | archived — self-declared maintenance status, distinct from the auto `healthStatus`. */
  maintenanceStatus: text('maintenance_status'),
  /** Support/community link (Discord, docs site), distinct from `url` (repo) and `websiteUrl`. */
  supportUrl: text('support_url'),
  /** Live, admin-approved screenshot URL (e.g. `/screenshots/<id>`). Null = no screenshot shown. */
  screenshotUrl: text('screenshot_url'),
  /** R2 key of an uploaded screenshot awaiting admin approval (e.g. `screenshots/pending/<id>.png`). Null = nothing pending. */
  pendingScreenshotKey: text('pending_screenshot_key'),
  /** Submitter-suggested install command (e.g. "npx"), used as a hint only when the auto-detected `installConfidence` is low or absent. */
  suggestedInstallCommand: text('suggested_install_command'),
  /** JSON string array of args paired with `suggestedInstallCommand`. */
  suggestedInstallArgs: text('suggested_install_args'),
}, (table) => ({
  // `status = 'active'` is the base filter on nearly every catalog read (browse,
  // category pages, related/featured lookups, sitemap) — at 10k+ rows this was an
  // unindexed full table scan on every request. The composite indexes below cover
  // the (status + category) and (status + createdAt) shapes used by
  // getCategoryServers/getNewestActiveServers so D1 can seek+range-scan instead of
  // scanning the whole table and sorting in memory; the popularity one similarly
  // covers getPopularServers' `ORDER BY views DESC, copies DESC, upvotes DESC`.
  statusIdx: index('idx_servers_status').on(table.status),
  statusCategoryIdx: index('idx_servers_status_category').on(table.status, table.category),
  statusCreatedIdx: index('idx_servers_status_created').on(table.status, table.createdAt),
  statusPopularityIdx: index('idx_servers_status_popularity').on(
    table.status,
    table.views,
    table.copies,
    table.upvotes
  ),
}));

export const upvoteRecords = sqliteTable('upvote_records', {
  serverId: text('server_id').notNull(),
  ipHash: text('ip_hash').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  pk: primaryKey({ columns: [table.serverId, table.ipHash] }),
}));

/** One unique view per (server, hashed IP) — same gate model as upvote_records. */
export const viewRecords = sqliteTable('view_records', {
  serverId: text('server_id').notNull(),
  ipHash: text('ip_hash').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  pk: primaryKey({ columns: [table.serverId, table.ipHash] }),
}));

// Auth.js (NextAuth) Drizzle adapter tables — see lib/auth.ts.
// Column/table shape follows @auth/drizzle-adapter's SQLite defaults
// (https://authjs.dev/getting-started/adapters/drizzle), renamed to
// snake_case columns to match this project's convention.
export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: integer('email_verified', { mode: 'timestamp_ms' }),
  image: text('image'),
});

export const accounts = sqliteTable('accounts', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: text('token_type'),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
}, (table) => ({
  pk: primaryKey({ columns: [table.provider, table.providerAccountId] }),
}));

export const sessions = sqliteTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
});

export const verificationTokens = sqliteTable('verification_tokens', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull(),
  expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.identifier, table.token] }),
}));

/**
 * Short-lived email confirmation codes for POST /api/v1/agent/register —
 * proves the registering agent controls `email`'s inbox before a bearer
 * token is issued for it. One pending code per email; a fresh /register
 * call overwrites any unused one. Deliberately separate from Auth.js's own
 * `verificationTokens` table (a different flow with its own lifecycle
 * managed by the DrizzleAdapter) so agent auth can't interfere with the
 * human magic-link login path.
 */
export const agentRegistrationCodes = sqliteTable('agent_registration_codes', {
  email: text('email').primaryKey(),
  codeHash: text('code_hash').notNull(),
  agentName: text('agent_name'),
  attempts: integer('attempts').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
});

/**
 * Bearer tokens minted by POST /api/v1/agent/register/confirm — let an
 * unattended AI agent call POST /api/v1/agent/claim (DNS-TXT ownership
 * proof) without a human OAuth session. Each token is tied to a `users`
 * row (found-or-created by email at confirm time) so a claimed listing's
 * `ownerUserId` and notification email are the same regardless of whether
 * the owner signed in as a human or registered as an agent.
 */
export const agentTokens = sqliteTable('agent_tokens', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  tokenHash: text('token_hash').notNull().unique(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  agentName: text('agent_name'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  revokedAt: integer('revoked_at', { mode: 'timestamp' }),
  lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
}, (table) => ({
  userIdx: index('idx_agent_tokens_user').on(table.userId),
}));

/** API access logs — tracks which LLMs/agents call our programmatic endpoints. */
export const apiAccessLogs = sqliteTable('api_access_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  serverId: text('server_id'),
  endpoint: text('endpoint').notNull(),
  methodOrTool: text('method_or_tool'),
  userAgent: text('user_agent'),
  callerClass: text('caller_class').notNull().default('unknown'),
  ipCountry: text('ip_country'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  serverIdx: index('idx_access_server').on(table.serverId),
  createdIdx: index('idx_access_created').on(table.createdAt),
  callerIdx: index('idx_access_caller').on(table.callerClass),
}));

/** Impression logs — tracks where listings appear on the site (homepage, search, sidebar, etc.). */
export const impressionLogs = sqliteTable('impression_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  serverId: text('server_id').notNull(),
  surface: text('surface').notNull(),
  sessionHash: text('session_hash'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  serverIdx: index('idx_impression_server').on(table.serverId),
  createdIdx: index('idx_impression_created').on(table.createdAt),
  surfaceIdx: index('idx_impression_surface').on(table.surface),
}));

/**
 * E2B sandbox verification pilot results for stdio listings — kept separate
 * from `servers.tools`/`tools_source` until the approach is validated (success
 * rate, timing, cost) rather than feeding unproven data into the live catalog.
 * Populated by the `e2b-stdio-pilot` GitHub Actions workflow via
 * /api/cron/stdio-pilot/result; batches are claimed via /api/cron/stdio-pilot/batch.
 */
export const stdioVerificationPilot = sqliteTable('stdio_verification_pilot', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  /**
   * Unique — one row per listing, mutated pending -> final in place. This is
   * what makes /batch's claim-by-insert atomic: a SELECT-then-INSERT gap
   * between two overlapping requests otherwise lets both claim the same
   * listing (confirmed in practice, not just theoretical) — only a DB-level
   * constraint closes that window.
   */
  serverId: text('server_id').notNull().unique(),
  /** ok | install_failed | handshake_failed | timeout | error */
  status: text('status').notNull(),
  toolCount: integer('tool_count'),
  /** JSON array of {name, description, parameters} on success. */
  tools: text('tools'),
  error: text('error'),
  durationMs: integer('duration_ms'),
  checkedAt: integer('checked_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  serverIdx: index('idx_stdio_pilot_server').on(table.serverId),
  checkedIdx: index('idx_stdio_pilot_checked').on(table.checkedAt),
}));

/**
 * Bounded per-listing health-check history — the health cron's existing
 * healthy/unhealthy verdict (primary URL reachability), persisted per pass
 * instead of only overwriting servers.healthStatus/isVerifiedActive. Lets the
 * detail page show a trend ("29/30 checks healthy this week") instead of a
 * single point-in-time badge, which reads as a false alarm on one transient
 * blip (confirmed in practice: our own listing showed "Unreachable" from a
 * one-off Worker memory spike, not a real outage).
 *
 * Deliberately NOT unbounded: /api/cron/health trims each server_id to the
 * most recent HEALTH_HISTORY_LIMIT rows right after inserting, so this stays
 * flat-sized forever rather than growing with total checks performed.
 */
export const serverHealthChecks = sqliteTable('server_health_checks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  serverId: text('server_id').notNull(),
  checkedAt: integer('checked_at', { mode: 'timestamp' }).notNull(),
  healthy: integer('healthy', { mode: 'boolean' }).notNull(),
  /** Short reason on failure (e.g. "HTTP 522"). Null on success. */
  detail: text('detail'),
  /**
   * The remote-endpoint reading from this same check pass, alongside the
   * primary `healthy` signal above — lets the quality score's "Server
   * availability" component use a rolling window instead of a single live
   * snapshot (see lib/qualityScore.ts). Null when this listing has no
   * remoteEndpointUrl, or on rows predating this column.
   */
  remoteHealthy: integer('remote_healthy', { mode: 'boolean' }),
}, (table) => ({
  serverIdx: index('idx_health_checks_server').on(table.serverId),
  checkedIdx: index('idx_health_checks_checked').on(table.checkedAt),
}));

/** Outbound social queue items (RSS-backed tweet pipeline). */
export const socialPosts = sqliteTable('social_posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** Stable per-item id exposed in RSS <guid>. */
  guid: text('guid').notNull().unique(),
  /** Target channel (currently: twitter). */
  channel: text('channel').notNull().default('twitter'),
  /** queued | sent | failed */
  status: text('status').notNull().default('queued'),
  /** Related listing (when applicable). */
  serverId: text('server_id'),
  /** Full tweet body that downstream automation should post. */
  tweetText: text('tweet_text').notNull(),
  /** producer source: highlight_cron | approval | ... */
  source: text('source'),
  /** Optional idempotency key (e.g. one item per cron slot). */
  dedupeKey: text('dedupe_key').unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  sentAt: integer('sent_at', { mode: 'timestamp' }),
}, (table) => ({
  createdIdx: index('idx_social_posts_created').on(table.createdAt),
  statusCreatedIdx: index('idx_social_posts_status_created').on(table.status, table.createdAt),
  serverIdx: index('idx_social_posts_server').on(table.serverId),
}));
