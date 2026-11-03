-- The rejection text a submitter was emailed, so their dashboard can show it
-- next to a rejected submission they can edit and resubmit.
ALTER TABLE `moderation_decisions` ADD `feedback` text;