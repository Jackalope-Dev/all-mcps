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
  views: integer('views').notNull().default(0),
  copies: integer('copies').notNull().default(0),
  upvotes: integer('upvotes').notNull().default(0),
  /** Last time this listing was posted to X/Twitter (highlight cron or new-listing announce). Drives least-recently-posted rotation so highlights don't repeat. */
  lastTweetedAt: integer('last_tweeted_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

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
