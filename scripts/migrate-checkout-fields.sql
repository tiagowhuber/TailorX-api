-- ============================================================
-- Migration: Checkout Fields (checkout-fields)
-- Description: Adds phone/rut to users and shipping_address_id,
--              contact_phone, rut to orders for checkout flow.
-- Created:     2026-03-27
-- Safe to run: YES (uses IF NOT EXISTS / idempotent)
-- ============================================================

BEGIN;

-- 1. Add phone and rut to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS rut   VARCHAR(12);

-- 2. Add checkout fields to orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipping_address_id INTEGER REFERENCES user_addresses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contact_phone       VARCHAR(20),
  ADD COLUMN IF NOT EXISTS rut                 VARCHAR(12);

-- 3. Optional index for faster order lookups by shipping address
CREATE INDEX IF NOT EXISTS idx_orders_shipping_address_id ON orders(shipping_address_id);

COMMIT;

-- Verify
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('phone', 'rut')
ORDER BY column_name;

SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'orders'
  AND column_name IN ('shipping_address_id', 'contact_phone', 'rut')
ORDER BY column_name;
