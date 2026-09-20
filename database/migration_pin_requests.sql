-- Run in Supabase SQL Editor if schema was already applied earlier
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS payment_pin_status VARCHAR(40) DEFAULT 'NONE';

CREATE TABLE IF NOT EXISTS pin_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_type VARCHAR(40) NOT NULL DEFAULT 'CREATE',
  pin_hash TEXT NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'PENDING_OTP',
  otp_verified_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pin_requests_user ON pin_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_pin_requests_status ON pin_requests(status);

-- Existing seeded customers with a PIN become APPROVED
UPDATE users
SET payment_pin_status = 'APPROVED'
WHERE payment_pin_hash IS NOT NULL
  AND (payment_pin_status IS NULL OR payment_pin_status = 'NONE');
