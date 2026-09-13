-- Profile system: editable learner metadata stays separate from Supabase Auth.
alter table public.profiles
  add column if not exists display_name text,
  add column if not exists student_id text,
  add column if not exists program text,
  add column if not exists year_level text,
  add column if not exists section text,
  add column if not exists avatar_url text;

create or replace function public.set_profiles_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_profiles_updated_at();

drop policy if exists "Users can read permitted profiles" on public.profiles;
create policy "Users can read permitted profiles" on public.profiles
for select to authenticated using (
  id = (select auth.uid())
  or exists (
    select 1 from public.class_memberships target
    join public.classes c on c.id = target.class_id and target.active = true
    where target.user_id = profiles.id
      and (c.created_by = (select auth.uid()) or exists (
        select 1 from public.class_memberships teacher
        where teacher.class_id = target.class_id
          and teacher.user_id = (select auth.uid())
          and teacher.membership_role = 'teacher' and teacher.active = true
      ))
  )
);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
for update to authenticated using (id = (select auth.uid()))
with check (id = (select auth.uid()));

revoke update on public.profiles from anon, authenticated;
grant update (full_name, display_name, student_id, program, year_level, section, avatar_url)
  on public.profiles to authenticated;
