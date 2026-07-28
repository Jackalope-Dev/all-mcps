import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

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
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});
