/*
# Super Admin & Security Migration

1. Support 'superadmin' role in profiles table.
2. Update is_spv() function so SPV & Super Admin have full management permissions.
3. Add is_superadmin() function for administrative operations.
4. Support all operational expense categories including 'BBM'.
5. Restrict profile deletion to Super Admin.
*/

-- 1. Profiles role check
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('kasir', 'spv', 'superadmin'));

-- 2. is_spv() function update (SPV & Super Admin)
CREATE OR REPLACE FUNCTION is_spv()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('spv', 'superadmin')
  );
$$;

-- 3. is_superadmin() function
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'superadmin'
  );
$$;

-- 4. Expenses category check update
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_category_check;
ALTER TABLE expenses ADD CONSTRAINT expenses_category_check CHECK (category IN (
  'Gaji Karyawan',
  'Biaya Operasional',
  'Barang Retur',
  'Biaya Sewa',
  'Biaya Perbaikan',
  'BBM',
  'Bagi-bagi / Lain-lain'
));

-- 5. Delete policy on profiles
DROP POLICY IF EXISTS "profiles_delete_superadmin" ON profiles;
CREATE POLICY "profiles_delete_superadmin" ON profiles
FOR DELETE TO authenticated
USING (is_superadmin());
