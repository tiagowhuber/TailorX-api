-- Migration: Add payment fields to orders table
-- Date: 2025-11-06

-- Add payment-related columns to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS payment_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS payment_url TEXT,
ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS session_id VARCHAR(255);

-- Add index for payment_status for faster queries
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);

-- Add index for transaction_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_transaction_id ON orders(transaction_id);

-- Add index for session_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_session_id ON orders(session_id);

-- Comment on columns
COMMENT ON COLUMN orders.payment_status IS 'Status of the payment: pending, completed, failed, rejected, cancelled';
COMMENT ON COLUMN orders.payment_method IS 'Payment method used: webpay, etc.';
COMMENT ON COLUMN orders.payment_token IS 'Payment token from Transbank';
COMMENT ON COLUMN orders.payment_url IS 'Payment redirect URL from Transbank';
COMMENT ON COLUMN orders.transaction_id IS 'Transaction ID from payment provider';
COMMENT ON COLUMN orders.session_id IS 'Session ID for payment transaction';
