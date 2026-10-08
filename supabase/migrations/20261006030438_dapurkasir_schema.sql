/*
# DapurKasir Pro - Database Schema & Auth Setup

Creates the full database schema for the kitchen cashier, inventory, and finance management system.

## Tables
1. profiles - extends auth.users with role (kasir/spv) for role-based access control
2. purchases - daily shopping / stock-in records with unique codes
3. sales - sales transaction line items grouped by transaction_code
4. expenses - operational business expenses (Gaji, Operasional, Retur, Sewa, Perbaikan, Lain-lain)

## Pre-created Auth Users
- kasir@dapurkasir.com / kasir12345 (role: kasir) — can view everything, create sales, but CANNOT create/edit purchases or expenses
- spv@dapurkasir.com / spv12345 (role: spv) — full access to all modules

## Security (RLS)
- RLS enabled on all tables
- profiles: each authenticated user can read their own profile
- purchases: SELECT for all authenticated; INSERT/UPDATE/DELETE only for spv
- sales: SELECT/INSERT for all authenticated; UPDATE/DELETE only for spv
- expenses: SELECT for all authenticated; INSERT/UPDATE/DELETE only for spv
*/

-- Ensure pgcrypto is available for crypt() / gen_salt()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================
-- PROFILES TABLE
-- =============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'kasir' CHECK (role IN ('kasir', 'spv')),
  full_name text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles
FOR SELECT TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles
FOR UPDATE TO authenticated
USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- =============================================================
-- PURCHASES TABLE (Belanja Harian / Stock In)
-- =============================================================
CREATE TABLE IF NOT EXISTS purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  item_name text NOT NULL,
  category text NOT NULL CHECK (category IN ('Sembako & Bumbu', 'Sayur & Buah')),
  qty numeric NOT NULL CHECK (qty > 0),
  unit text NOT NULL,
  buy_price numeric NOT NULL CHECK (buy_price >= 0),
  total_modal numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current user is spv
DROP FUNCTION IF EXISTS is_spv();
CREATE OR REPLACE FUNCTION is_spv()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'spv'
  );
$$;

DROP POLICY IF EXISTS "purchases_select_all" ON purchases;
CREATE POLICY "purchases_select_all" ON purchases
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "purchases_insert_spv" ON purchases;
CREATE POLICY "purchases_insert_spv" ON purchases
FOR INSERT TO authenticated
WITH CHECK (is_spv());

DROP POLICY IF EXISTS "purchases_update_spv" ON purchases;
CREATE POLICY "purchases_update_spv" ON purchases
FOR UPDATE TO authenticated
USING (is_spv()) WITH CHECK (is_spv());

DROP POLICY IF EXISTS "purchases_delete_spv" ON purchases;
CREATE POLICY "purchases_delete_spv" ON purchases
FOR DELETE TO authenticated
USING (is_spv());

-- =============================================================
-- SALES TABLE (Penjualan / Stock Out)
-- =============================================================
CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_code text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  item_name text NOT NULL,
  qty numeric NOT NULL CHECK (qty > 0),
  unit text NOT NULL,
  buy_price numeric NOT NULL DEFAULT 0,
  sell_price numeric NOT NULL CHECK (sell_price >= 0),
  buyer text NOT NULL CHECK (buyer IN ('Dapur SK', 'Dapur WK')),
  total_omset numeric NOT NULL DEFAULT 0,
  total_laba numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
CREATE INDEX IF NOT EXISTS idx_sales_transaction_code ON sales(transaction_code);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(date);
CREATE INDEX IF NOT EXISTS idx_purchases_item_name ON purchases(item_name);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_select_all" ON sales;
CREATE POLICY "sales_select_all" ON sales
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "sales_insert_all" ON sales;
CREATE POLICY "sales_insert_all" ON sales
FOR INSERT TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "sales_update_spv" ON sales;
CREATE POLICY "sales_update_spv" ON sales
FOR UPDATE TO authenticated
USING (is_spv()) WITH CHECK (is_spv());

DROP POLICY IF EXISTS "sales_delete_spv" ON sales;
CREATE POLICY "sales_delete_spv" ON sales
FOR DELETE TO authenticated
USING (is_spv());

-- =============================================================
-- EXPENSES TABLE (Biaya Operasional / Usaha)
-- =============================================================
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL DEFAULT CURRENT_DATE,
  category text NOT NULL CHECK (category IN ('Gaji Karyawan', 'Biaya Operasional', 'Barang Retur', 'Biaya Sewa', 'Biaya Perbaikan', 'Bagi-bagi / Lain-lain')),
  amount numeric NOT NULL CHECK (amount > 0),
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expenses_select_all" ON expenses;
CREATE POLICY "expenses_select_all" ON expenses
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "expenses_insert_spv" ON expenses;
CREATE POLICY "expenses_insert_spv" ON expenses
FOR INSERT TO authenticated
WITH CHECK (is_spv());

DROP POLICY IF EXISTS "expenses_update_spv" ON expenses;
CREATE POLICY "expenses_update_spv" ON expenses
FOR UPDATE TO authenticated
USING (is_spv()) WITH CHECK (is_spv());

DROP POLICY IF EXISTS "expenses_delete_spv" ON expenses;
CREATE POLICY "expenses_delete_spv" ON expenses
FOR DELETE TO authenticated
USING (is_spv());

-- =============================================================
-- CREATE PRE-DEFINED AUTH USERS + PROFILES
-- =============================================================
DO $$
DECLARE
  kasir_id uuid;
  spv_id uuid;
BEGIN
  -- Check / create kasir user
  SELECT id INTO kasir_id FROM auth.users WHERE email = 'kasir@dapurkasir.com';
  IF kasir_id IS NULL THEN
    INSERT INTO auth.users (
      id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    )
    VALUES (
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'kasir@dapurkasir.com',
      crypt('kasir12345', gen_salt('bf')),
      now(), now(), now(),
      '{"role": "kasir"}'::jsonb,
      '{"full_name": "Kasir"}'::jsonb
    )
    RETURNING id INTO kasir_id;
  END IF;

  -- Check / create spv user
  SELECT id INTO spv_id FROM auth.users WHERE email = 'spv@dapurkasir.com';
  IF spv_id IS NULL THEN
    INSERT INTO auth.users (
      id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    )
    VALUES (
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'spv@dapurkasir.com',
      crypt('spv12345', gen_salt('bf')),
      now(), now(), now(),
      '{"role": "spv"}'::jsonb,
      '{"full_name": "Supervisor"}'::jsonb
    )
    RETURNING id INTO spv_id;
  END IF;

  -- Create profiles for both users
  INSERT INTO profiles (id, role, full_name)
  VALUES (kasir_id, 'kasir', 'Kasir')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO profiles (id, role, full_name)
  VALUES (spv_id, 'spv', 'Supervisor')
  ON CONFLICT (id) DO NOTHING;
END $$;
