-- v0.9.3 Authoritative Attempt Submission
-- Mastery evidence is now persisted only through the server-side scoring path.
-- Browser clients retain SELECT access to their own evidence but lose direct INSERT.

create or replace function public.persist_scored_major_scale_attempt(
  p_user_id uuid,
  p_practice_session_id uuid,
  p_question_number integer,
  p_item_code text,
  p_score integer,
  p_response_json jsonb,
  p_skill_results jsonb
)
returns table(
  attempt_id uuid,
  score integer,
  completed_questions integer
)
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  v_attempt_id uuid;
  v_existing_score integer;
  v_exercise_id uuid;
  v_stage_id uuid;
  v_mode text;
  v_planned_questions integer;
  v_completed_questions integer;
  v_completed_at timestamptz;
  v_skill_count integer;
  v_distinct_skill_count integer;
  v_skill_rows_valid boolean;
begin
  if p_user_id is null then
    raise exception 'User ID is required' using errcode='22023';
  end if;
  if p_practice_session_id is null then
    raise exception 'Practice session ID is required' using errcode='22023';
  end if;
  if p_question_number is null or p_question_number < 1 then
    raise exception 'Question number must be positive' using errcode='22023';
  end if;
  if p_item_code is null or btrim(p_item_code) = '' then
    raise exception 'Item code is required' using errcode='22023';
  end if;
  if p_score is null or p_score < 0 or p_score > 100 then
    raise exception 'Server score must be between 0 and 100' using errcode='22023';
  end if;
  if p_response_json is null or jsonb_typeof(p_response_json) <> 'object' then
    raise exception 'Response JSON must be an object' using errcode='22023';
  end if;
  if p_skill_results is null or jsonb_typeof(p_skill_results) <> 'array' then
    raise exception 'Skill results must be an array' using errcode='22023';
  end if;

  select
    ps.exercise_id,
    ps.stage_id,
    ps.mode,
    ps.planned_questions,
    ps.completed_questions,
    ps.completed_at
  into
    v_exercise_id,
    v_stage_id,
    v_mode,
    v_planned_questions,
    v_completed_questions,
    v_completed_at
  from public.practice_sessions ps
  where ps.id = p_practice_session_id
    and ps.user_id = p_user_id
  for update;

  if not found then
    raise exception 'Practice session not found for authenticated learner' using errcode='42501';
  end if;

  -- Idempotent retry: once a question slot exists, return its immutable result.
  select a.id,a.score
  into v_attempt_id,v_existing_score
  from public.attempts a
  where a.practice_session_id = p_practice_session_id
    and a.question_number = p_question_number;

  if v_attempt_id is not null then
    return query select v_attempt_id,v_existing_score,v_completed_questions;
    return;
  end if;

  if v_completed_at is not null then
    raise exception 'Practice session is already completed' using errcode='22023';
  end if;

  if v_exercise_id is null or v_stage_id is null then
    raise exception 'Practice session has no exercise/stage scope' using errcode='22023';
  end if;

  if p_question_number <> v_completed_questions + 1 then
    raise exception 'Question number must be the next sequential slot' using errcode='22023';
  end if;

  if v_planned_questions is not null and p_question_number > v_planned_questions then
    raise exception 'Question number exceeds the session plan' using errcode='22023';
  end if;

  if not exists (
    select 1
    from public.exercises e
    join public.exercise_stages es
      on es.exercise_id=e.id
     and es.id=v_stage_id
     and es.active=true
    where e.id=v_exercise_id
      and e.code='MAJOR_SCALE_NOTATION'
      and e.active=true
  ) then
    raise exception 'Session is not an active Major Scale stage' using errcode='22023';
  end if;

  if not exists (
    select 1
    from public.student_stage_progress ssp
    where ssp.user_id=p_user_id
      and ssp.stage_id=v_stage_id
      and ssp.status in ('in_progress','mastered')
  ) then
    raise exception 'Stage is not available to this learner' using errcode='42501';
  end if;

  if not exists (
    select 1
    from public.stage_required_items sri
    where sri.stage_id=v_stage_id
      and sri.item_code=p_item_code
      and sri.active=true
  ) then
    raise exception 'Item is not valid for this Stage' using errcode='22023';
  end if;

  with skill_rows as (
    select *
    from jsonb_to_recordset(p_skill_results) as x(
      skill_code text,
      correct_count integer,
      total_count integer,
      score integer,
      evidence_flags jsonb
    )
  )
  select
    count(*)::integer,
    count(distinct skill_code)::integer,
    coalesce(bool_and(
      skill_code in (
        'BN01_TREBLE_PITCH',
        'BN06_STEM_DIRECTION',
        'RH01_DURATION_VALUE',
        'GR02_PRIMARY_BEAM',
        'MS03_SCALE_ACCIDENTAL'
      )
      and correct_count >= 0
      and total_count > 0
      and correct_count <= total_count
      and score between 0 and 100
      and jsonb_typeof(evidence_flags)='array'
      and jsonb_array_length(evidence_flags)=total_count
    ),false)
  into v_skill_count,v_distinct_skill_count,v_skill_rows_valid
  from skill_rows;

  if v_skill_count <> 5 or v_distinct_skill_count <> 5 or v_skill_rows_valid is not true then
    raise exception 'Server skill evidence is incomplete or invalid' using errcode='22023';
  end if;

  -- Require exactly the five configured Major Scale skills, no omissions.
  if exists (
    select required.skill_code
    from (values
      ('BN01_TREBLE_PITCH'::text),
      ('BN06_STEM_DIRECTION'::text),
      ('RH01_DURATION_VALUE'::text),
      ('GR02_PRIMARY_BEAM'::text),
      ('MS03_SCALE_ACCIDENTAL'::text)
    ) required(skill_code)
    where not exists (
      select 1
      from jsonb_to_recordset(p_skill_results) as x(skill_code text)
      where x.skill_code=required.skill_code
    )
  ) then
    raise exception 'Required Major Scale skill evidence is missing' using errcode='22023';
  end if;

  insert into public.attempts(
    practice_session_id,
    question_number,
    item_code,
    score,
    response_json
  ) values (
    p_practice_session_id,
    p_question_number,
    p_item_code,
    p_score,
    p_response_json
  )
  returning id into v_attempt_id;

  insert into public.attempt_skill_results(
    attempt_id,
    skill_code,
    correct_count,
    total_count,
    score,
    evidence_flags
  )
  select
    v_attempt_id,
    x.skill_code,
    x.correct_count,
    x.total_count,
    x.score,
    x.evidence_flags
  from jsonb_to_recordset(p_skill_results) as x(
    skill_code text,
    correct_count integer,
    total_count integer,
    score integer,
    evidence_flags jsonb
  );

  update public.practice_sessions
  set completed_questions=p_question_number,
      last_activity_at=now()
  where id=p_practice_session_id;

  return query select v_attempt_id,p_score,p_question_number;
end;
$$;

-- This RPC is an internal persistence primitive for the Edge Function only.
revoke execute on function public.persist_scored_major_scale_attempt(uuid,uuid,integer,text,integer,jsonb,jsonb) from public;
revoke execute on function public.persist_scored_major_scale_attempt(uuid,uuid,integer,text,integer,jsonb,jsonb) from anon;
revoke execute on function public.persist_scored_major_scale_attempt(uuid,uuid,integer,text,integer,jsonb,jsonb) from authenticated;
grant execute on function public.persist_scored_major_scale_attempt(uuid,uuid,integer,text,integer,jsonb,jsonb) to service_role;

-- Learners may read their own evidence, but can no longer author score/evidence rows.
drop policy if exists "Users can insert own attempts" on public.attempts;
drop policy if exists "Users can insert own attempt skill results" on public.attempt_skill_results;
revoke insert on public.attempts from public,anon,authenticated;
revoke insert on public.attempt_skill_results from public,anon,authenticated;
