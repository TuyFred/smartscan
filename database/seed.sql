-- SMARTSCAN seed data
-- Run AFTER schema.sql
-- Default password for all test accounts: Password123!
-- Default customer payment PIN: 1234
-- Password hash generated with bcrypt (cost 10)

-- NOTE: Replace password hashes by running backend seed script if needed.
-- These are placeholders — prefer `npm run seed` in backend.

INSERT INTO roles (name, description) VALUES
  ('ADMIN', 'Platform administrator'),
  ('MANAGER', 'Supermarket owner/manager'),
  ('CASHIER', 'Branch cashier'),
  ('CUSTOMER', 'Shopping customer')
ON CONFLICT (name) DO NOTHING;
