ALTER TABLE `servers` ADD `review_flagged` integer DEFAULT false NOT NULL;--> statement-breakpoint
-- Intake used to overload review_priority for auto-flagged listings; move those
-- (priority set with no Stripe customer) over to review_flagged.
UPDATE `servers` SET `review_flagged` = 1, `review_priority` = 0 WHERE `review_priority` = 1 AND `stripe_customer_id` IS NULL;
