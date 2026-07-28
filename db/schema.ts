import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

export const servers = sqliteTable('servers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(),
  /** Optional product/marketing website (separate from the repo `url`). */
  websiteUrl: text('website_url'),
  /** Paid/premium listings get dofollow website backlinks; free listings use nofollow. */
  isPremium: integer('is_premium', { mode: 'boolean' }).notNull().default(false),
  /** True when the owner proved control of `websiteUrl` (DNS TXT or site badge). */
  websiteVerified: integer('website_verified', { mode: 'boolean' }).notNull().default(false),
  /** Claimed/verified ownership (GitHub README, site badge, or DNS). */
  isOfficial: integer('is_official', { mode: 'boolean' }).notNull().default(false),
  claimedAt: integer('claimed_at', { mode: 'timestamp' }),
  /** Auth.js user id after claim (optional until owners sign in). */
  ownerUserId: text('owner_user_id'),
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
