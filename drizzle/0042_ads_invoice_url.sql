-- Migration: store Stripe's hosted invoice URL for sponsor ad purchases
ALTER TABLE `sponsor_ads` ADD COLUMN `stripe_invoice_url` text;
