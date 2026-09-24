-- Blog content pipeline: dedupe corpus, keyword queue, and generated drafts (lib/blogPipeline).
CREATE TABLE `content_index` (
	`url` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`primary_keyword` text,
	`excerpt` text,
	`embedding` text,
	`content_hash` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_content_index_kind` ON `content_index` (`kind`);
--> statement-breakpoint
CREATE TABLE `blog_topics` (
	`id` text PRIMARY KEY NOT NULL,
	`keyword` text NOT NULL,
	`secondary_keywords` text,
	`intent` text NOT NULL,
	`angle` text NOT NULL,
	`cluster` text NOT NULL,
	`source` text NOT NULL,
	`priority` integer DEFAULT 50 NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`blocked_reason` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`claimed_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_blog_topics_keyword` ON `blog_topics` (`keyword`);
--> statement-breakpoint
CREATE INDEX `idx_blog_topics_status` ON `blog_topics` (`status`,`priority`);
--> statement-breakpoint
CREATE TABLE `blog_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`topic_id` text NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`excerpt` text NOT NULL,
	`primary_keyword` text NOT NULL,
	`tags` text NOT NULL,
	`faq` text NOT NULL,
	`content` text NOT NULL,
	`status` text NOT NULL,
	`iterations` integer DEFAULT 1 NOT NULL,
	`review` text,
	`backlink_suggestions` text,
	`model` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`exported_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_blog_drafts_slug` ON `blog_drafts` (`slug`);
--> statement-breakpoint
CREATE INDEX `idx_blog_drafts_status` ON `blog_drafts` (`status`);
