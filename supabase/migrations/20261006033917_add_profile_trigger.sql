/*
# Auto-create profile on user signup

Creates a database trigger that automatically inserts a row into the
profiles table whenever a new user is created in auth.users. This
replaces the client-side profile insert which could fail due to RLS
timing issues (the session may not be fully established when the
insert runs).

## Changes
- New function: handle_new_user() — reads role and full_name from
  raw_user_meta_data and inserts a profiles row.
- New trigger: on_auth_user_created — fires AFTER INSERT on auth.users.
- The trigger runs as SECURITY DEFINER so it bypasses RLS on profiles.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'kasir'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
