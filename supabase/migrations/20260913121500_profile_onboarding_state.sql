-- Registration profile onboarding gate.
-- Existing profiles are grandfathered; profiles created after this migration
-- remain incomplete until the required learner fields are saved.

alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz;

update public.profiles
set onboarding_completed_at = coalesce(onboarding_completed_at, now());

create or replace function public.mark_profile_onboarding_completed()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.role = 'student'
     and new.onboarding_completed_at is null
     and nullif(btrim(coalesce(new.full_name, '')), '') is not null
     and nullif(btrim(coalesce(new.student_id, '')), '') is not null
     and nullif(btrim(coalesce(new.program, '')), '') is not null
     and nullif(btrim(coalesce(new.year_level, '')), '') is not null then
    new.onboarding_completed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists mark_profile_onboarding_completed on public.profiles;
create trigger mark_profile_onboarding_completed
before update of full_name, student_id, program, year_level on public.profiles
for each row
execute function public.mark_profile_onboarding_completed();
