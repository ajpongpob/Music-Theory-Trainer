-- M1.5 Learning Feedback & Visibility
-- Add trusted learner-facing summaries without changing scoring/mastery semantics.

create or replace function public.finalize_my_practice_set(
  p_session_id uuid,
  p_expected_questions integer default 5
)
returns table(
  session_id uuid,
  exercise_code text,
  stage_code text,
  session_questions integer,
  session_overall_score numeric,
  session_skill_results jsonb,
  question_scores jsonb,
  session_item_codes text[],
  rolling_window integer,
  attempts_found integer,
  required_items integer,
  covered_items integer,
  missing_item_codes text[],
  overall_threshold numeric,
  overall_score numeric,
  enough_attempts boolean,
  coverage_passed boolean,
  skills_passed boolean,
  mastery_passed boolean,
  rolling_skill_results jsonb,
  stage_status text,
  next_action_type text,
  next_target_skill_code text,
  next_target_item_code text,
  next_reason_code text,
  next_reason_th text
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_session record;
  v_count integer;
  v_session_score numeric;
  v_session_skills jsonb;
  v_questions jsonb;
  v_items text[];
  v_ev record;
  v_rec record;
  v_stage_status text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_expected_questions < 1 or p_expected_questions > 50 then raise exception 'Invalid expected question count'; end if;

  select ps.id, ps.exercise_id, ps.stage_id, e.code as exercise_code, es.code as stage_code
  into v_session
  from public.practice_sessions ps
  join public.exercises e on e.id=ps.exercise_id
  join public.exercise_stages es on es.id=ps.stage_id
  where ps.id=p_session_id and ps.user_id=v_user_id and ps.mode='practice';

  if v_session.id is null then raise exception 'Practice session not found'; end if;

  select count(*)::integer, round(avg(a.score)::numeric,2),
         coalesce(jsonb_agg(jsonb_build_object('question_number',a.question_number,'item_code',a.item_code,'score',a.score) order by a.question_number),'[]'::jsonb),
         coalesce(array_agg(a.item_code order by a.question_number),'{}'::text[])
  into v_count,v_session_score,v_questions,v_items
  from public.attempts a where a.practice_session_id=v_session.id;

  if v_count <> p_expected_questions then
    raise exception 'Practice set requires exactly % trusted attempts; found %', p_expected_questions, v_count;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'skill_code',q.skill_code,
    'score',q.score,
    'threshold',q.threshold,
    'passed',(q.score is not null and q.score>=q.threshold)
  ) order by q.skill_code),'[]'::jsonb)
  into v_session_skills
  from (
    select ssr.skill_code,ssr.threshold,
      case when coalesce(sum(asr.total_count),0)>0
        then round(sum(asr.correct_count)::numeric/sum(asr.total_count)::numeric*100,2)
        else null end as score
    from public.stage_skill_requirements ssr
    left join public.attempts a on a.practice_session_id=v_session.id
    left join public.attempt_skill_results asr on asr.attempt_id=a.id and asr.skill_code=ssr.skill_code
    where ssr.stage_id=v_session.stage_id and ssr.active=true
    group by ssr.skill_code,ssr.threshold
  ) q;

  update public.practice_sessions
  set planned_questions=p_expected_questions,
      completed_questions=v_count,
      overall_score=v_session_score,
      completed_at=coalesce(completed_at,now()),
      last_activity_at=now()
  where id=v_session.id and user_id=v_user_id;

  select * into v_ev
  from public.get_my_stage_evidence(v_session.exercise_code,v_session.stage_code,'practice',false);

  select ssp.status into v_stage_status
  from public.student_stage_progress ssp
  where ssp.user_id=v_user_id and ssp.stage_id=v_session.stage_id;

  select * into v_rec from public.get_my_recommended_next_action(null) limit 1;

  return query select
    v_session.id,v_session.exercise_code,v_session.stage_code,v_count,v_session_score,
    v_session_skills,v_questions,v_items,
    v_ev.rolling_window,v_ev.attempts_found,v_ev.required_items,v_ev.covered_items,v_ev.missing_item_codes,
    v_ev.overall_threshold,v_ev.overall_score,v_ev.enough_attempts,v_ev.coverage_passed,v_ev.skills_passed,v_ev.mastery_passed,v_ev.skill_results,
    v_stage_status,
    v_rec.action_type,v_rec.target_skill_code,v_rec.target_item_code,v_rec.reason_code,v_rec.reason_th;
end;
$$;

revoke all on function public.finalize_my_practice_set(uuid,integer) from public, anon;
grant execute on function public.finalize_my_practice_set(uuid,integer) to authenticated, service_role;

create or replace function public.get_my_latest_diagnostic_feedback(p_exercise_code text)
returns table(
  session_id uuid,
  evaluated_stage_code text,
  evaluated_stage_name text,
  session_questions integer,
  session_overall_score numeric,
  diagnostic_passed boolean,
  overall_threshold numeric,
  skill_results jsonb,
  question_scores jsonb,
  placement_stage_code text,
  placement_stage_name text,
  mastered_stage_codes text[],
  recommendation_action_type text,
  recommendation_reason_code text,
  recommendation_reason_th text
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_session record;
  v_diag record;
  v_rec record;
  v_place record;
  v_questions jsonb;
  v_mastered text[];
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  select ps.id,ps.exercise_id,ps.stage_id,es.code as stage_code,es.name_th as stage_name
  into v_session
  from public.practice_sessions ps
  join public.exercises e on e.id=ps.exercise_id and e.code=p_exercise_code
  join public.exercise_stages es on es.id=ps.stage_id
  where ps.user_id=v_user_id and ps.mode='pretest' and ps.completed_at is not null
  order by ps.completed_at desc,ps.id desc limit 1;
  if v_session.id is null then return; end if;

  select * into v_diag from public.get_my_exercise_diagnostic(p_exercise_code) d
  where d.stage_id=v_session.stage_id limit 1;

  select coalesce(jsonb_agg(jsonb_build_object('question_number',a.question_number,'item_code',a.item_code,'score',a.score) order by a.question_number),'[]'::jsonb)
  into v_questions from public.attempts a where a.practice_session_id=v_session.id;

  select es.code,es.name_th into v_place
  from public.student_stage_progress ssp
  join public.exercise_stages es on es.id=ssp.stage_id
  where ssp.user_id=v_user_id and es.exercise_id=v_session.exercise_id and ssp.status='in_progress'
  order by es.sequence_order limit 1;

  select coalesce(array_agg(es.code order by es.sequence_order),'{}'::text[])
  into v_mastered
  from public.student_stage_progress ssp
  join public.exercise_stages es on es.id=ssp.stage_id
  where ssp.user_id=v_user_id and es.exercise_id=v_session.exercise_id and ssp.status='mastered';

  select * into v_rec from public.get_my_recommended_next_action(null) limit 1;

  return query select v_session.id,v_session.stage_code,v_session.stage_name,
    coalesce(v_diag.attempts_found,0),v_diag.overall_score,v_diag.diagnostic_passed,v_diag.overall_threshold,
    v_diag.skill_results,v_questions,v_place.code,v_place.name_th,v_mastered,
    v_rec.action_type,v_rec.reason_code,v_rec.reason_th;
end;
$$;

revoke all on function public.get_my_latest_diagnostic_feedback(text) from public, anon;
grant execute on function public.get_my_latest_diagnostic_feedback(text) to authenticated, service_role;

-- Teacher-only detail stays behind explicit class authorization. It complements,
-- rather than replaces, the existing read-only teacher dashboard RPC.
create or replace function public.get_my_teacher_class_learning_feedback(p_class_id uuid)
returns table(
  student_id uuid,
  exercise_code text,
  current_stage_code text,
  latest_activity_at timestamptz,
  practice_session_count integer,
  attempt_count integer,
  rolling_window integer,
  attempts_found integer,
  required_items integer,
  covered_items integer,
  missing_item_codes text[],
  overall_threshold numeric,
  overall_score numeric,
  skill_results jsonb
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_class_teacher(p_class_id) then raise exception 'Not authorized to view this class'; end if;

  return query
  with learners as (
    select cm.user_id
    from public.class_memberships cm
    where cm.class_id=p_class_id and cm.membership_role='student' and cm.active=true
  ),
  assigned as (
    select e.id as exercise_id,e.code as exercise_code
    from public.class_learning_paths clp
    join public.path_exercises pe on pe.path_id=clp.path_id and pe.active=true
    join public.exercises e on e.id=pe.exercise_id and e.active=true
    where clp.class_id=p_class_id and clp.active=true
    group by e.id,e.code
  ),
  current_stage as (
    select l.user_id,a.exercise_id,a.exercise_code,es.id as stage_id,es.code as stage_code
    from learners l cross join assigned a
    left join lateral (
      select es0.id,es0.code,es0.sequence_order
      from public.exercise_stages es0
      join public.student_stage_progress ssp on ssp.stage_id=es0.id and ssp.user_id=l.user_id
      where es0.exercise_id=a.exercise_id and es0.active=true and ssp.status='in_progress'
      order by es0.sequence_order limit 1
    ) es on true
  )
  select cs.user_id,cs.exercise_code,cs.stage_code,
    stats.latest_activity_at,stats.practice_session_count,stats.attempt_count,
    ev.rolling_window,ev.attempts_found,ev.required_items,ev.covered_items,ev.missing_item_codes,
    ev.overall_threshold,ev.overall_score,ev.skill_results
  from current_stage cs
  left join lateral (
    select max(ps.last_activity_at) as latest_activity_at,
      count(distinct ps.id) filter(where ps.mode='practice')::integer as practice_session_count,
      count(a.id) filter(where ps.mode='practice')::integer as attempt_count
    from public.practice_sessions ps
    left join public.attempts a on a.practice_session_id=ps.id
    where ps.user_id=cs.user_id and ps.exercise_id=cs.exercise_id
  ) stats on true
  left join lateral (
    with rule as (
      select smr.rolling_window,smr.overall_threshold
      from public.stage_mastery_rules smr where smr.stage_id=cs.stage_id and smr.active=true limit 1
    ), pool as (
      select a.id,a.item_code,a.score,a.checked_at
      from public.attempts a join public.practice_sessions ps on ps.id=a.practice_session_id
      where ps.user_id=cs.user_id and ps.exercise_id=cs.exercise_id and ps.stage_id=cs.stage_id and ps.mode='practice'
      order by a.checked_at desc,a.id desc
      limit coalesce((select rolling_window from rule),0)
    ), items as (
      select count(*)::integer required_items,
        count(*) filter(where exists(select 1 from pool p where p.item_code=sri.item_code))::integer covered_items,
        coalesce(array_agg(sri.item_code order by sri.sequence_order) filter(where not exists(select 1 from pool p where p.item_code=sri.item_code)),'{}'::text[]) missing_item_codes
      from public.stage_required_items sri where sri.stage_id=cs.stage_id and sri.active=true
    ), skills as (
      select coalesce(jsonb_agg(jsonb_build_object('skill_code',x.skill_code,'score',x.score,'threshold',x.threshold,'passed',(x.score is not null and x.score>=x.threshold)) order by x.skill_code),'[]'::jsonb) skill_results
      from (
        select ssr.skill_code,ssr.threshold,
          case when coalesce(sum(asr.total_count),0)>0 then round(sum(asr.correct_count)::numeric/sum(asr.total_count)::numeric*100,2) else null end score
        from public.stage_skill_requirements ssr
        left join public.attempt_skill_results asr on asr.skill_code=ssr.skill_code and exists(select 1 from pool p where p.id=asr.attempt_id)
        where ssr.stage_id=cs.stage_id and ssr.active=true group by ssr.skill_code,ssr.threshold
      ) x
    )
    select r.rolling_window,(select count(*)::integer from pool) attempts_found,i.required_items,i.covered_items,i.missing_item_codes,
      r.overall_threshold,(select round(avg(score)::numeric,2) from pool) overall_score,s.skill_results
    from rule r cross join items i cross join skills s
  ) ev on cs.stage_id is not null;
end;
$$;

revoke all on function public.get_my_teacher_class_learning_feedback(uuid) from public, anon;
grant execute on function public.get_my_teacher_class_learning_feedback(uuid) to authenticated, service_role;
