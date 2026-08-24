-- Replaces Cloudflare Access as the /admin gate with an app-level role check
-- (see lib/adminAuth.ts). Everyone defaults to 'user'; the one existing admin
-- is promoted here. This UPDATE only affects a row that already exists — if
-- that person hasn't signed in yet, run it again (or by hand) after they do.
ALTER TABLE `users` ADD `role` text DEFAULT 'user' NOT NULL;
--> statement-breakpoint
UPDATE `users` SET `role` = 'admin' WHERE `email` = 'caden@allmcps.com';
