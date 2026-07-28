import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const servers = sqliteTable('servers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(),
  isOfficial: integer('is_official', { mode: 'boolean' }).notNull().default(false),
  status: text('status').notNull().default('pending'), // 'pending', 'active', 'rejected'
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});
