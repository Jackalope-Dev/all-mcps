import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

export const servers = sqliteTable('servers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(),
  isOfficial: integer('is_official', { mode: 'boolean' }).notNull().default(false),
  status: text('status').notNull().default('pending'),
  lastCheckedAt: integer('last_checked_at', { mode: 'timestamp' }),
  isVerifiedActive: integer('is_verified_active', { mode: 'boolean' }).notNull().default(false),
  healthStatus: text('health_status').notNull().default('unknown'),
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
