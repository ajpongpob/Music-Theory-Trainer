-- Keep one explicit read policy after the profile-system migration.
drop policy if exists "Users can read own profile" on public.profiles;
