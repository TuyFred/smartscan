-- SMARTSCAN Supabase (PostgreSQL) Schema
-- Run this in the Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Roles
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO roles (name, description) VALUES
  ('ADMIN', 'Platform administrator'),
  ('MANAGER', 'Supermarket owner/manager'),
  ('CASHIER', 'Branch cashier'),
  ('CUSTOMER', 'Shopping customer')
ON CONFLICT (name) DO NOTHING;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(200) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50),
  address TEXT,
  national_id VARCHAR(100),
  password_hash TEXT NOT NULL,
  payment_pin_hash TEXT,
  payment_pin_status VARCHAR(40) DEFAULT 'NONE',
  -- NONE | PENDING_APPROVAL | APPROVED | REJECTED
  profile_image TEXT,
  role_id INT NOT NULL REFERENCES roles(id),
  email_verified BOOLEAN DEFAULT FALSE,
  account_status VARCHAR(40) DEFAULT 'PENDING_APPROVAL',
  -- PENDING_APPROVAL | APPROVED | REJECTED | SUSPENDED | ACTIVE
  is_active BOOLEAN DEFAULT TRUE,
  supermarket_id UUID,
  branch_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(account_status);

-- Email OTPs
CREATE TABLE IF NOT EXISTS email_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  otp_hash TEXT NOT NULL,
  purpose VARCHAR(40) NOT NULL DEFAULT 'REGISTER',
  -- REGISTER | LOGIN
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  attempts INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_otps_email ON email_otps(email);

-- Payment PIN create / reset requests (customer creates, OTP email, admin approves)
CREATE TABLE IF NOT EXISTS pin_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_type VARCHAR(40) NOT NULL DEFAULT 'CREATE',
  -- CREATE | RESET
  pin_hash TEXT NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'PENDING_OTP',
  -- PENDING_OTP | PENDING_APPROVAL | APPROVED | REJECTED | CANCELLED
  otp_verified_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pin_requests_user ON pin_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_pin_requests_status ON pin_requests(status);

-- Supermarkets
CREATE TABLE IF NOT EXISTS supermarkets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  logo TEXT,
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  owner_id UUID REFERENCES users(id),
  status VARCHAR(40) DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS fk_users_supermarket;
ALTER TABLE users
  ADD CONSTRAINT fk_users_supermarket
  FOREIGN KEY (supermarket_id) REFERENCES supermarkets(id);

-- Branches
CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supermarket_id UUID NOT NULL REFERENCES supermarkets(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  address TEXT,
  phone VARCHAR(50),
  qr_payload TEXT UNIQUE NOT NULL,
  status VARCHAR(40) DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS fk_users_branch;
ALTER TABLE users
  ADD CONSTRAINT fk_users_branch
  FOREIGN KEY (branch_id) REFERENCES branches(id);

CREATE INDEX IF NOT EXISTS idx_branches_supermarket ON branches(supermarket_id);
CREATE INDEX IF NOT EXISTS idx_branches_qr ON branches(qr_payload);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supermarket_id UUID NOT NULL REFERENCES supermarkets(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id),
  name VARCHAR(200) NOT NULL,
  sku VARCHAR(100),
  category VARCHAR(100),
  description TEXT,
  image TEXT,
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  weight NUMERIC(10,3) DEFAULT 0,
  unit VARCHAR(40) DEFAULT 'pcs',
  quantity_available INT DEFAULT 0,
  product_code VARCHAR(50) UNIQUE NOT NULL,
  qr_payload TEXT UNIQUE NOT NULL,
  status VARCHAR(40) DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_supermarket ON products(supermarket_id);
CREATE INDEX IF NOT EXISTS idx_products_qr ON products(qr_payload);
CREATE INDEX IF NOT EXISTS idx_products_code ON products(product_code);

-- Customer RFID cards
CREATE TABLE IF NOT EXISTS customer_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_uid VARCHAR(100) UNIQUE NOT NULL,
  balance NUMERIC(12,2) DEFAULT 0 CHECK (balance >= 0),
  status VARCHAR(40) DEFAULT 'ACTIVE',
  -- ACTIVE | BLOCKED | LOST | EXPIRED
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cards_uid ON customer_cards(card_uid);

-- Card transactions
CREATE TABLE IF NOT EXISTS card_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES customer_cards(id),
  customer_id UUID NOT NULL REFERENCES users(id),
  type VARCHAR(40) NOT NULL,
  -- DEPOSIT | PURCHASE | REFUND | ADJUSTMENT
  amount NUMERIC(12,2) NOT NULL,
  balance_before NUMERIC(12,2) NOT NULL,
  balance_after NUMERIC(12,2) NOT NULL,
  reference VARCHAR(100),
  performed_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shopping sessions
CREATE TABLE IF NOT EXISTS shopping_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_code VARCHAR(50) UNIQUE NOT NULL,
  customer_id UUID NOT NULL REFERENCES users(id),
  supermarket_id UUID NOT NULL REFERENCES supermarkets(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  status VARCHAR(40) DEFAULT 'ACTIVE',
  -- ACTIVE | CHECKOUT | PAID | COMPLETED | CANCELLED
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  subtotal NUMERIC(12,2) DEFAULT 0,
  total_amount NUMERIC(12,2) DEFAULT 0,
  payment_status VARCHAR(40) DEFAULT 'UNPAID',
  -- UNPAID | PENDING | PAID | FAILED
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_customer ON shopping_sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON shopping_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_supermarket ON shopping_sessions(supermarket_id);

-- Cart items
CREATE TABLE IF NOT EXISTS cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES shopping_sessions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  product_name VARCHAR(200) NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  weight NUMERIC(10,3) DEFAULT 0,
  unit VARCHAR(40) DEFAULT 'pcs',
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  subtotal NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, product_id)
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code VARCHAR(50) UNIQUE NOT NULL,
  session_id UUID UNIQUE NOT NULL REFERENCES shopping_sessions(id),
  customer_id UUID NOT NULL REFERENCES users(id),
  supermarket_id UUID NOT NULL REFERENCES supermarkets(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  subtotal NUMERIC(12,2) NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL,
  status VARCHAR(40) DEFAULT 'PENDING',
  -- PENDING | PAID | CANCELLED
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_name VARCHAR(200) NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  weight NUMERIC(10,3) DEFAULT 0,
  quantity INT NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_code VARCHAR(50) UNIQUE NOT NULL,
  order_id UUID UNIQUE NOT NULL REFERENCES orders(id),
  session_id UUID NOT NULL REFERENCES shopping_sessions(id),
  customer_id UUID NOT NULL REFERENCES users(id),
  card_id UUID REFERENCES customer_cards(id),
  amount NUMERIC(12,2) NOT NULL,
  method VARCHAR(40) DEFAULT 'RFID_CARD',
  status VARCHAR(40) DEFAULT 'COMPLETED',
  paid_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Receipts
CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number VARCHAR(50) UNIQUE NOT NULL,
  verification_token VARCHAR(100) UNIQUE NOT NULL,
  qr_payload TEXT UNIQUE NOT NULL,
  payment_id UUID UNIQUE NOT NULL REFERENCES payments(id),
  order_id UUID NOT NULL REFERENCES orders(id),
  session_id UUID NOT NULL REFERENCES shopping_sessions(id),
  customer_id UUID NOT NULL REFERENCES users(id),
  supermarket_id UUID NOT NULL REFERENCES supermarkets(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  total_amount NUMERIC(12,2) NOT NULL,
  status VARCHAR(40) DEFAULT 'ISSUED',
  -- ISSUED | VERIFIED | CANCELLED
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receipts_token ON receipts(verification_token);
CREATE INDEX IF NOT EXISTS idx_receipts_qr ON receipts(qr_payload);

-- Exit verifications
CREATE TABLE IF NOT EXISTS exit_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID REFERENCES receipts(id),
  device_id UUID,
  status VARCHAR(40) NOT NULL,
  -- SUCCESS | FAILED
  reason TEXT,
  scanned_payload TEXT,
  verified_at TIMESTAMPTZ DEFAULT NOW()
);

-- IoT devices
CREATE TABLE IF NOT EXISTS iot_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(200),
  type VARCHAR(40) NOT NULL,
  -- RFID_READER | EXIT_SCANNER
  supermarket_id UUID REFERENCES supermarkets(id),
  branch_id UUID REFERENCES branches(id),
  api_key VARCHAR(100) UNIQUE NOT NULL,
  status VARCHAR(40) DEFAULT 'ACTIVE',
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pending RFID payment authorizations
CREATE TABLE IF NOT EXISTS payment_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id),
  card_id UUID NOT NULL REFERENCES customer_cards(id),
  session_id UUID NOT NULL REFERENCES shopping_sessions(id),
  amount NUMERIC(12,2) NOT NULL,
  status VARCHAR(40) DEFAULT 'PENDING',
  -- PENDING | AUTHORIZED | CANCELLED | EXPIRED
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  message TEXT,
  type VARCHAR(40) DEFAULT 'INFO',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id VARCHAR(100),
  details JSONB,
  ip_address VARCHAR(60),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Updated_at helper
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_supermarkets_updated BEFORE UPDATE ON supermarkets
    FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_branches_updated BEFORE UPDATE ON branches
    FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_products_updated BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_sessions_updated BEFORE UPDATE ON shopping_sessions
    FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
