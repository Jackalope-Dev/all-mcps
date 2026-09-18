-- Canonical server id to 308-redirect to when this listing is retired or merged as a duplicate.
ALTER TABLE `servers` ADD `redirect_to` text;

