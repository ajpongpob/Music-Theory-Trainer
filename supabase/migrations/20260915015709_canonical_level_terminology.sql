-- Canonicalize learner-facing terminology from Stage to Level without breaking
-- historical data or legacy RPC/table dependencies.

update public.exercise_stages
set
  name_th = case
    when code ~ '^STAGE_[0-9]+$' then 'ระดับที่ ' || substring(code from '[0-9]+$')
    else replace(name_th, 'ขั้นที่', 'ระดับที่')
  end,
  name_en = case
    when code ~ '^STAGE_[0-9]+$' then 'Level ' || substring(code from '[0-9]+$')
    else replace(name_en, 'Stage', 'Level')
  end,
  updated_at = now()
where coalesce(name_th,'') like '%ขั้น%'
   or coalesce(name_en,'') ilike '%stage%'
   or code ~ '^STAGE_[0-9]+$';

-- Canonical Level-named read models. Legacy stage_* tables remain the
-- compatibility storage layer so historical migrations/functions keep working.
create or replace view public.exercise_levels
with (security_invoker = true)
as
select
  es.id,
  es.exercise_id,
  regexp_replace(es.code, '^STAGE_', 'LEVEL_') as code,
  es.name_th,
  es.name_en,
  es.sequence_order,
  es.active,
  es.created_at,
  es.updated_at
from public.exercise_stages es;

create or replace view public.level_mastery_rules
with (security_invoker = true)
as
select
  smr.stage_id as level_id,
  regexp_replace(es.code, '^STAGE_', 'LEVEL_') as level_code,
  smr.rolling_window,
  smr.overall_threshold,
  smr.active,
  smr.created_at,
  smr.updated_at
from public.stage_mastery_rules smr
join public.exercise_stages es on es.id = smr.stage_id;

create or replace view public.level_required_items
with (security_invoker = true)
as
select
  sri.stage_id as level_id,
  regexp_replace(es.code, '^STAGE_', 'LEVEL_') as level_code,
  sri.item_code,
  sri.sequence_order,
  sri.active,
  sri.created_at
from public.stage_required_items sri
join public.exercise_stages es on es.id = sri.stage_id;

create or replace view public.level_skill_requirements
with (security_invoker = true)
as
select
  ssr.stage_id as level_id,
  regexp_replace(es.code, '^STAGE_', 'LEVEL_') as level_code,
  ssr.skill_code,
  ssr.threshold,
  ssr.active,
  ssr.created_at,
  ssr.updated_at
from public.stage_skill_requirements ssr
join public.exercise_stages es on es.id = ssr.stage_id;

create or replace view public.student_level_progress
with (security_invoker = true)
as
select
  ssp.user_id,
  ssp.stage_id as level_id,
  regexp_replace(es.code, '^STAGE_', 'LEVEL_') as level_code,
  ssp.status,
  ssp.last_mastery_score,
  ssp.started_at,
  ssp.mastered_at,
  ssp.updated_at
from public.student_stage_progress ssp
join public.exercise_stages es on es.id = ssp.stage_id;

grant select on public.exercise_levels,
  public.level_mastery_rules,
  public.level_required_items,
  public.level_skill_requirements to authenticated;
grant select on public.student_level_progress to authenticated;

-- Canonical Level RPCs. They translate LEVEL_n to the stable legacy STAGE_n
-- technical key only at the compatibility boundary.
create or replace function public.get_my_level_mastery(
  p_exercise_code text,
  p_level_code text
)
returns table(
  exercise_id uuid,
  level_id uuid,
  exercise_code text,
  level_code text,
  rolling_window integer,
  attempts_found integer,
  required_items integer,
  covered_items integer,
  overall_threshold numeric,
  overall_score numeric,
  enough_attempts boolean,
  coverage_passed boolean,
  skills_passed boolean,
  mastery_passed boolean,
  skill_results jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    g.exercise_id,
    g.stage_id as level_id,
    g.exercise_code,
    regexp_replace(g.stage_code, '^STAGE_', 'LEVEL_') as level_code,
    g.rolling_window,
    g.attempts_found,
    g.required_items,
    g.covered_items,
    g.overall_threshold,
    g.overall_score,
    g.enough_attempts,
    g.coverage_passed,
    g.skills_passed,
    g.mastery_passed,
    g.skill_results
  from public.get_my_stage_mastery(
    p_exercise_code,
    regexp_replace(p_level_code, '^LEVEL_', 'STAGE_')
  ) g;
$$;

create or replace function public.get_my_level_evidence(
  p_exercise_code text,
  p_level_code text,
  p_mode text default 'practice',
  p_latest_session_only boolean default false
)
returns table(
  exercise_id uuid,
  level_id uuid,
  exercise_code text,
  level_code text,
  evidence_mode text,
  rolling_window integer,
  attempts_found integer,
  required_items integer,
  covered_items integer,
  overall_threshold numeric,
  overall_score numeric,
  enough_attempts boolean,
  coverage_passed boolean,
  skills_passed boolean,
  mastery_passed boolean,
  skill_results jsonb,
  missing_item_codes text[]
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    g.exercise_id,
    g.stage_id as level_id,
    g.exercise_code,
    regexp_replace(g.stage_code, '^STAGE_', 'LEVEL_') as level_code,
    g.evidence_mode,
    g.rolling_window,
    g.attempts_found,
    g.required_items,
    g.covered_items,
    g.overall_threshold,
    g.overall_score,
    g.enough_attempts,
    g.coverage_passed,
    g.skills_passed,
    g.mastery_passed,
    g.skill_results,
    g.missing_item_codes
  from public.get_my_stage_evidence(
    p_exercise_code,
    regexp_replace(p_level_code, '^LEVEL_', 'STAGE_'),
    p_mode,
    p_latest_session_only
  ) g;
$$;

create or replace function public.advance_my_level_if_mastered(
  p_exercise_code text,
  p_level_code text
)
returns table(
  advanced boolean,
  completed_level_code text,
  next_level_code text,
  exercise_mastered boolean,
  overall_score numeric
)
language sql
volatile
security invoker
set search_path = public
as $$
  select
    g.advanced,
    regexp_replace(g.completed_stage_code, '^STAGE_', 'LEVEL_') as completed_level_code,
    case when g.next_stage_code is null then null
      else regexp_replace(g.next_stage_code, '^STAGE_', 'LEVEL_') end as next_level_code,
    g.exercise_mastered,
    g.overall_score
  from public.advance_my_stage_if_mastered(
    p_exercise_code,
    regexp_replace(p_level_code, '^LEVEL_', 'STAGE_')
  ) g;
$$;

create or replace function public.ensure_my_learning_path_level_progression()
returns table(
  learning_path_id uuid,
  learning_path_code text,
  path_status text,
  current_exercise_code text,
  current_level_code text
)
language sql
volatile
security invoker
set search_path = public
as $$
  select
    g.learning_path_id,
    g.learning_path_code,
    g.path_status,
    g.current_exercise_code,
    case when g.current_stage_code is null then null
      else regexp_replace(g.current_stage_code, '^STAGE_', 'LEVEL_') end as current_level_code
  from public.ensure_my_learning_path_progression() g;
$$;

create or replace function public.get_my_recommended_next_level_action(
  p_path_code text default null
)
returns table(
  learning_path_code text,
  exercise_code text,
  level_code text,
  action_type text,
  target_skill_code text,
  target_item_code text,
  reason_code text,
  reason_th text,
  overall_score numeric,
  overall_threshold numeric,
  attempts_found integer,
  rolling_window integer
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    g.learning_path_code,
    g.exercise_code,
    regexp_replace(g.stage_code, '^STAGE_', 'LEVEL_') as level_code,
    g.action_type,
    g.target_skill_code,
    g.target_item_code,
    g.reason_code,
    g.reason_th,
    g.overall_score,
    g.overall_threshold,
    g.attempts_found,
    g.rolling_window
  from public.get_my_recommended_next_action(p_path_code) g;
$$;

create or replace function public.get_my_student_dashboard_levels()
returns table(
  learning_path_id uuid,
  learning_path_code text,
  learning_path_name text,
  learning_path_status text,
  enrolled_at timestamptz,
  path_started_at timestamptz,
  path_mastered_at timestamptz,
  exercise_id uuid,
  exercise_code text,
  exercise_name text,
  exercise_sequence integer,
  required_for_completion boolean,
  exercise_status text,
  exercise_started_at timestamptz,
  exercise_mastered_at timestamptz,
  level_id uuid,
  level_code text,
  level_name text,
  level_sequence integer,
  level_status text,
  last_mastery_score numeric,
  level_started_at timestamptz,
  level_mastered_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    g.learning_path_id,
    g.learning_path_code,
    g.learning_path_name,
    g.learning_path_status,
    g.enrolled_at,
    g.path_started_at,
    g.path_mastered_at,
    g.exercise_id,
    g.exercise_code,
    g.exercise_name,
    g.exercise_sequence,
    g.required_for_completion,
    g.exercise_status,
    g.exercise_started_at,
    g.exercise_mastered_at,
    g.stage_id as level_id,
    regexp_replace(g.stage_code, '^STAGE_', 'LEVEL_') as level_code,
    g.stage_name as level_name,
    g.stage_sequence as level_sequence,
    g.stage_status as level_status,
    g.last_mastery_score,
    g.stage_started_at as level_started_at,
    g.stage_mastered_at as level_mastered_at
  from public.get_my_student_dashboard() g;
$$;

grant execute on function public.get_my_level_mastery(text,text) to authenticated;
grant execute on function public.get_my_level_evidence(text,text,text,boolean) to authenticated;
grant execute on function public.advance_my_level_if_mastered(text,text) to authenticated;
grant execute on function public.ensure_my_learning_path_level_progression() to authenticated;
grant execute on function public.get_my_recommended_next_level_action(text) to authenticated;
grant execute on function public.get_my_student_dashboard_levels() to authenticated;

comment on view public.exercise_levels is 'Canonical Level terminology. exercise_stages remains legacy compatibility storage.';
comment on view public.student_level_progress is 'Canonical Level terminology. student_stage_progress remains legacy compatibility storage.';
