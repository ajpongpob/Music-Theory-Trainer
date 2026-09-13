-- Structured learner profile schema for Major Scale Notation Trainer.
-- Applied to project ptksuomvpuiesbwrzzif on 2026-09-13.

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists nickname text;

update public.profiles
set
  first_name = coalesce(
    nullif(btrim(first_name), ''),
    case
      when nullif(btrim(full_name), '') is null then null
      when strpos(btrim(full_name), ' ') > 0 then split_part(btrim(full_name), ' ', 1)
      else btrim(full_name)
    end
  ),
  last_name = coalesce(
    nullif(btrim(last_name), ''),
    case
      when nullif(btrim(full_name), '') is null then null
      when strpos(btrim(full_name), ' ') > 0 then nullif(btrim(substr(btrim(full_name), strpos(btrim(full_name), ' ') + 1)), '')
      else null
    end
  ),
  nickname = coalesce(nullif(btrim(nickname), ''), nullif(btrim(display_name), ''));

create or replace function public.sync_profile_name_fields()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_name text;
  v_space integer;
  v_structured_changed boolean;
  v_legacy_changed boolean;
  v_nickname_changed boolean;
  v_display_changed boolean;
begin
  if tg_op = 'INSERT' then
    if nullif(btrim(coalesce(new.first_name, '')), '') is not null
       or nullif(btrim(coalesce(new.last_name, '')), '') is not null then
      new.first_name := nullif(btrim(coalesce(new.first_name, '')), '');
      new.last_name := nullif(btrim(coalesce(new.last_name, '')), '');
      new.full_name := nullif(btrim(concat_ws(' ', new.first_name, new.last_name)), '');
    else
      v_name := btrim(coalesce(new.full_name, ''));
      if v_name <> '' then
        v_space := strpos(v_name, ' ');
        if v_space > 0 then
          new.first_name := nullif(btrim(substr(v_name, 1, v_space - 1)), '');
          new.last_name := nullif(btrim(substr(v_name, v_space + 1)), '');
        else
          new.first_name := v_name;
          new.last_name := null;
        end if;
      end if;
    end if;

    if nullif(btrim(coalesce(new.nickname, '')), '') is not null then
      new.nickname := nullif(btrim(new.nickname), '');
      new.display_name := new.nickname;
    else
      new.nickname := nullif(btrim(coalesce(new.display_name, '')), '');
      new.display_name := new.nickname;
    end if;
    return new;
  end if;

  v_structured_changed := new.first_name is distinct from old.first_name
    or new.last_name is distinct from old.last_name;
  v_legacy_changed := new.full_name is distinct from old.full_name;

  if v_structured_changed then
    new.first_name := nullif(btrim(coalesce(new.first_name, '')), '');
    new.last_name := nullif(btrim(coalesce(new.last_name, '')), '');
    new.full_name := nullif(btrim(concat_ws(' ', new.first_name, new.last_name)), '');
  elsif v_legacy_changed then
    v_name := btrim(coalesce(new.full_name, ''));
    if v_name = '' then
      new.first_name := null;
      new.last_name := null;
      new.full_name := null;
    else
      v_space := strpos(v_name, ' ');
      if v_space > 0 then
        new.first_name := nullif(btrim(substr(v_name, 1, v_space - 1)), '');
        new.last_name := nullif(btrim(substr(v_name, v_space + 1)), '');
      else
        new.first_name := v_name;
        new.last_name := null;
      end if;
      new.full_name := nullif(btrim(concat_ws(' ', new.first_name, new.last_name)), '');
    end if;
  end if;

  v_nickname_changed := new.nickname is distinct from old.nickname;
  v_display_changed := new.display_name is distinct from old.display_name;
  if v_nickname_changed then
    new.nickname := nullif(btrim(coalesce(new.nickname, '')), '');
    new.display_name := new.nickname;
  elsif v_display_changed then
    new.display_name := nullif(btrim(coalesce(new.display_name, '')), '');
    new.nickname := new.display_name;
  end if;

  return new;
end;
$function$;

drop trigger if exists a_profiles_sync_names on public.profiles;
create trigger a_profiles_sync_names
before insert or update of first_name, last_name, nickname, full_name, display_name
on public.profiles
for each row execute function public.sync_profile_name_fields();

create or replace function public.mark_profile_onboarding_completed()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.role = 'student'
     and new.onboarding_completed_at is null
     and nullif(btrim(coalesce(new.first_name, '')), '') is not null
     and nullif(btrim(coalesce(new.last_name, '')), '') is not null
     and nullif(btrim(coalesce(new.student_id, '')), '') is not null
     and nullif(btrim(coalesce(new.program, '')), '') is not null then
    new.onboarding_completed_at := now();
  end if;
  return new;
end;
$function$;

drop trigger if exists mark_profile_onboarding_completed on public.profiles;
create trigger mark_profile_onboarding_completed
before update of first_name, last_name, full_name, student_id, program
on public.profiles
for each row execute function public.mark_profile_onboarding_completed();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      ''
    ),
    'student'
  );
  return new;
end;
$function$;

comment on column public.profiles.first_name is 'Student given name used by the profile and dashboard.';
comment on column public.profiles.last_name is 'Student family name used by the profile and dashboard.';
comment on column public.profiles.nickname is 'Student nickname. Replaces display_name in the current profile model.';
comment on column public.profiles.full_name is 'Compatibility field synchronized from first_name and last_name for existing dashboard/RPC code.';
comment on column public.profiles.display_name is 'Compatibility field synchronized with nickname for existing dashboard code.';
comment on column public.profiles.year_level is 'Deprecated: no longer collected by profile onboarding.';
comment on column public.profiles.section is 'Deprecated: no longer collected by profile onboarding.';
