/*
# Allow self-registration profile insert

Currently profiles INSERT policy requires auth.uid() = id which works
for the authenticated session. But on signUp, the user is immediately
authenticated so this should work. We're updating the policy to be
more permissive for insert since the profile is created by the user
themselves right after signup.
*/

-- The existing profiles_insert_own policy already allows users to insert their own profile.
-- We just need to make sure the is_spv() function also allows spv to be selected during profile creation.
-- No schema changes needed - just verifying.

-- But we need to allow the profile to be created with a role that's not just default.
-- The current policy checks auth.uid() = id which is correct.

-- Let's add a policy that allows users to insert their own profile with any role
-- (since the role is set in user_metadata during signup)
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);
