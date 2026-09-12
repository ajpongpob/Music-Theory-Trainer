-- M1.6 Pre-test Experience & Efficient Placement
-- Resumable stage-by-stage diagnostic, mathematically safe early stopping,
-- explicit pre-test journey state, and resume-aware recommendation copy.

create or replace function public.evaluate_my_pretest_progress(p_session_id uuid)
returns table(
  session_id uuid,
  exercise_code text,
  stage_code text,
  completed_questions integer,
  planned_questions integer,
  remaining_questions integer,
  overall_score numeric,
  overall_threshold numeric,
  max_possible_overall numeric,
  can_still_pass boolean,
  decision text,
  blocking_criteria text[],
  skill_results jsonb,
  placement_stage_code text,
  exercise_mastered boolean
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_session record;
  v_completed integer := 0;
  v_planned integer := 0;
  v_remaining integer := 0;
  v_score_sum numeric := 0;
  v_overall numeric := null;
  v_max_overall numeric := 100;
  v_covered integer := 0;
  v_required integer := 0;
  v_coverage_possible boolean := true;
  v_skills jsonb := '[]'::jsonb;
  v_skills_possible boolean := true;
  v_blockers text[] := '{}'::text[];
  v_possible boolean := true;
  v_decision text := 'continue';
  v_ev record;
  v_place record;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  select ps.id, ps.user_id, ps.mode, ps.exercise_id, ps.stage_id,
         ps.planned_questions, ps.completed_at,
         e.code as exercise_code, es.code as stage_code,
         smr.overall_threshold
    into v_session
  from public.practice_sessions ps
  join public.exercises e on e.id=ps.exercise_id and e.active=true
  join public.exercise_stages es on es.id=ps.stage_id and es.active=true
  join public.stage_mastery_rules smr on smr.stage_id=ps.stage_id and smr.active=true
  where ps.id=p_session_id and ps.user_id=v_user_id and ps.mode='pretest';

  if v_session.id is null then raise exception 'Pre-test session not found'; end if;

  select count(*)::integer,
         coalesce(sum(a.score),0)::numeric,
         round(avg(a.score)::numeric,2)
    into v_completed,v_score_sum,v_overall
  from public.attempts a
  where a.practice_session_id=v_session.id;

  select count(*)::integer
    into v_required
  from public.stage_required_items sri
  where sri.stage_id=v_session.stage_id and sri.active=true;

  v_planned := greatest(coalesce(v_session.planned_questions,v_required),v_required,1);
  v_remaining := greatest(v_planned-v_completed,0);
  v_max_overall := round(((v_score_sum + (v_remaining*100)) / v_planned)::numeric,2);

  select count(*)::integer
    into v_covered
  from public.stage_required_items sri
  where sri.stage_id=v_session.stage_id and sri.active=true
    and exists(
      select 1 from public.attempts a
      where a.practice_session_id=v_session.id and a.item_code=sri.item_code
    );
  v_coverage_possible := (v_covered + v_remaining >= v_required);

  with skill_agg as (
    select ssr.skill_code, ssr.threshold,
           coalesce(sum(asr.correct_count),0)::numeric as correct_count,
           coalesce(sum(asr.total_count),0)::numeric as total_count,
           coalesce(max(asr.total_count),0)::numeric as units_per_future_question
    from public.stage_skill_requirements ssr
    left join public.attempts a
      on a.practice_session_id=v_session.id
    left join public.attempt_skill_results asr
      on asr.attempt_id=a.id and asr.skill_code=ssr.skill_code
    where ssr.stage_id=v_session.stage_id and ssr.active=true
    group by ssr.skill_code,ssr.threshold
  ), scored as (
    select skill_code,threshold,correct_count,total_count,units_per_future_question,
           case when total_count>0
             then round((correct_count/total_count*100)::numeric,2)
             else null end as score,
           case
             when units_per_future_question<=0 then 100::numeric
             else round(((correct_count + v_remaining*units_per_future_question)
               / nullif(total_count + v_remaining*units_per_future_question,0) * 100)::numeric,2)
           end as max_possible_score
    from skill_agg
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'skill_code',skill_code,
           'score',score,
           'threshold',threshold,
           'max_possible_score',max_possible_score,
           'can_still_pass',(max_possible_score>=threshold)
         ) order by skill_code),'[]'::jsonb),
         coalesce(bool_and(max_possible_score>=threshold),true),
         coalesce(array_agg(skill_code order by skill_code) filter(where max_possible_score<threshold),'{}'::text[])
    into v_skills,v_skills_possible,v_blockers
  from scored;

  if v_max_overall < v_session.overall_threshold then
    v_blockers := array_append(v_blockers,'OVERALL');
  end if;
  if not v_coverage_possible then
    v_blockers := array_append(v_blockers,'COVERAGE');
  end if;

  v_possible := (v_max_overall>=v_session.overall_threshold)
                and v_coverage_possible
                and v_skills_possible;

  update public.practice_sessions
  set completed_questions=v_completed,
      overall_score=v_overall,
      last_activity_at=now()
  where id=v_session.id and user_id=v_user_id;

  if v_completed>=v_planned then
    update public.practice_sessions
    set completed_at=coalesce(completed_at,now()),
        completed_questions=v_completed,
        overall_score=v_overall,
        last_activity_at=now()
    where id=v_session.id and user_id=v_user_id;

    select * into v_ev
    from public.get_my_stage_evidence(v_session.exercise_code,v_session.stage_code,'pretest',true);

    select * into v_place
    from public.apply_my_diagnostic_placement(v_session.exercise_code)
    limit 1;

    v_decision := case when v_ev.mastery_passed=true then 'stage_passed' else 'stage_failed' end;
  elsif not v_possible then
    update public.practice_sessions
    set completed_at=coalesce(completed_at,now()),
        completed_questions=v_completed,
        overall_score=v_overall,
        last_activity_at=now()
    where id=v_session.id and user_id=v_user_id;

    select * into v_place
    from public.apply_my_diagnostic_placement(v_session.exercise_code)
    limit 1;

    v_decision := 'early_stop';
  end if;

  return query select
    v_session.id,
    v_session.exercise_code,
    v_session.stage_code,
    v_completed,
    v_planned,
    v_remaining,
    v_overall,
    v_session.overall_threshold,
    v_max_overall,
    v_possible,
    v_decision,
    v_blockers,
    v_skills,
    v_place.placement_stage_code,
    coalesce(v_place.exercise_mastered,false);
end;
$$;

revoke all on function public.evaluate_my_pretest_progress(uuid) from public, anon;
grant execute on function public.evaluate_my_pretest_progress(uuid) to authenticated, service_role;

create or replace function public.get_my_pretest_journey(p_exercise_code text)
returns table(
  exercise_code text,
  pretest_status text,
  current_stage_code text,
  current_stage_name text,
  active_session_id uuid,
  completed_questions integer,
  planned_questions integer,
  remaining_questions integer,
  placement_stage_code text,
  stages jsonb
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_exercise_id uuid;
  v_rec record;
  v_open record;
  v_place record;
  v_any_pretest boolean := false;
  v_status text := 'not_started';
  v_stages jsonb := '[]'::jsonb;
  v_current_code text := null;
  v_current_name text := null;
  v_completed integer := 0;
  v_planned integer := 0;
  v_remaining integer := 0;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  select e.id into v_exercise_id
  from public.exercises e
  where e.code=p_exercise_code and e.active=true;
  if v_exercise_id is null then raise exception 'Exercise not found: %',p_exercise_code; end if;

  select exists(
    select 1 from public.practice_sessions ps
    where ps.user_id=v_user_id and ps.exercise_id=v_exercise_id and ps.mode='pretest'
  ) into v_any_pretest;

  select * into v_rec
  from public.get_my_recommended_next_action(null)
  where exercise_code=p_exercise_code
  limit 1;

  select ps.id,ps.stage_id,es.code as stage_code,es.name_th as stage_name,
         coalesce(ps.completed_questions,0)::integer as completed_questions,
         coalesce(ps.planned_questions,0)::integer as planned_questions
    into v_open
  from public.practice_sessions ps
  join public.exercise_stages es on es.id=ps.stage_id
  where ps.user_id=v_user_id and ps.exercise_id=v_exercise_id
    and ps.mode='pretest' and ps.completed_at is null
  order by ps.started_at desc,ps.id desc
  limit 1;

  select es.code,es.name_th into v_place
  from public.student_stage_progress ssp
  join public.exercise_stages es on es.id=ssp.stage_id
  where ssp.user_id=v_user_id and es.exercise_id=v_exercise_id and ssp.status='in_progress'
  order by es.sequence_order limit 1;

  if v_rec.action_type='diagnostic' then
    v_status := case when v_any_pretest then 'in_progress' else 'not_started' end;
  elsif v_any_pretest then
    v_status := 'completed';
  end if;

  if v_open.id is not null then
    v_current_code:=v_open.stage_code;
    v_current_name:=v_open.stage_name;
    v_completed:=v_open.completed_questions;
    v_planned:=v_open.planned_questions;
  elsif v_rec.action_type='diagnostic' then
    v_current_code:=v_rec.stage_code;
    select es.name_th,
           (select count(*)::integer from public.stage_required_items sri where sri.stage_id=es.id and sri.active=true)
      into v_current_name,v_planned
    from public.exercise_stages es
    where es.exercise_id=v_exercise_id and es.code=v_rec.stage_code and es.active=true;
    v_completed:=0;
  else
    v_current_code:=v_place.code;
    v_current_name:=v_place.name_th;
  end if;
  v_remaining:=greatest(v_planned-v_completed,0);

  with diagnostics as (
    select * from public.get_my_exercise_diagnostic(p_exercise_code)
  ), stage_rows as (
    select es.id,es.code,es.name_th,es.sequence_order,
           coalesce(ssp.status,'locked') as progress_status,
           d.diagnostic_passed,
           d.overall_score,
           d.overall_threshold,
           d.attempts_found,
           d.required_items,
           d.covered_items,
           latest.id as latest_session_id,
           latest.completed_at as latest_completed_at,
           coalesce(latest.completed_questions,0)::integer as session_completed_questions,
           coalesce(latest.planned_questions,d.required_items,0)::integer as session_planned_questions
    from public.exercise_stages es
    left join public.student_stage_progress ssp
      on ssp.user_id=v_user_id and ssp.stage_id=es.id
    left join diagnostics d on d.stage_id=es.id
    left join lateral (
      select ps.id,ps.completed_at,ps.completed_questions,ps.planned_questions
      from public.practice_sessions ps
      where ps.user_id=v_user_id and ps.exercise_id=v_exercise_id
        and ps.stage_id=es.id and ps.mode='pretest'
      order by ps.started_at desc,ps.id desc limit 1
    ) latest on true
    where es.exercise_id=v_exercise_id and es.active=true
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'stage_code',code,
           'stage_name',name_th,
           'sequence',sequence_order,
           'progress_status',progress_status,
           'diagnostic_status',case
             when diagnostic_passed=true then 'passed'
             when latest_session_id is not null and latest_completed_at is null then 'active'
             when latest_session_id is not null and latest_completed_at is not null then 'stopped'
             else 'pending' end,
           'diagnostic_passed',coalesce(diagnostic_passed,false),
           'overall_score',overall_score,
           'overall_threshold',overall_threshold,
           'attempts_found',coalesce(attempts_found,0),
           'required_items',coalesce(required_items,0),
           'covered_items',coalesce(covered_items,0),
           'latest_session_id',latest_session_id,
           'completed_questions',session_completed_questions,
           'planned_questions',session_planned_questions,
           'remaining_questions',greatest(session_planned_questions-session_completed_questions,0)
         ) order by sequence_order),'[]'::jsonb)
    into v_stages
  from stage_rows;

  return query select p_exercise_code,v_status,v_current_code,v_current_name,
    v_open.id,v_completed,v_planned,v_remaining,v_place.code,v_stages;
end;
$$;

revoke all on function public.get_my_pretest_journey(text) from public, anon;
grant execute on function public.get_my_pretest_journey(text) to authenticated, service_role;

create or replace function public.get_my_recommended_next_action(p_path_code text default null::text)
returns table(
  learning_path_code text,
  exercise_code text,
  stage_code text,
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
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_path_id uuid;
  v_path_code text;
  v_path_status text;
  v_exercise_id uuid;
  v_exercise_code text;
  v_stage_id uuid;
  v_stage_code text;
  v_practice_count integer := 0;
  v_pretest_count integer := 0;
  v_latest_pretest_planned integer := null;
  v_latest_pretest_completed integer := null;
  v_latest_pretest_completed_at timestamptz := null;
  v_ev record;
  v_diag record;
  v_weak_skill text;
  v_target_item text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  select slpp.path_id,lp.code,slpp.status
  into v_path_id,v_path_code,v_path_status
  from public.student_learning_path_progress slpp
  join public.learning_paths lp on lp.id=slpp.path_id and lp.active=true
  where slpp.user_id=v_user_id
    and (p_path_code is null or lp.code=p_path_code)
  order by case slpp.status when 'in_progress' then 0 when 'not_started' then 1 else 2 end,
           lp.sort_order,lp.id
  limit 1;

  if v_path_id is null then return; end if;

  if v_path_status='mastered' then
    return query select v_path_code,null::text,null::text,'completed'::text,null::text,null::text,
      'PATH_MASTERED'::text,'คุณเรียนจบเส้นทางนี้แล้ว'::text,null::numeric,null::numeric,0,0;
    return;
  end if;

  select pe.exercise_id,e.code into v_exercise_id,v_exercise_code
  from public.path_exercises pe
  join public.exercises e on e.id=pe.exercise_id and e.active=true
  left join public.student_exercise_progress sep on sep.user_id=v_user_id and sep.exercise_id=pe.exercise_id
  where pe.path_id=v_path_id and pe.active=true and coalesce(sep.status,'not_started')<>'mastered'
  order by pe.sequence_order,pe.exercise_id
  limit 1;

  if v_exercise_id is null then
    return query select v_path_code,null::text,null::text,'completed'::text,null::text,null::text,
      'PATH_REQUIREMENTS_COMPLETE'::text,'คุณทำแบบฝึกหัดที่กำหนดในเส้นทางนี้ครบแล้ว'::text,null::numeric,null::numeric,0,0;
    return;
  end if;

  select es.id,es.code into v_stage_id,v_stage_code
  from public.exercise_stages es
  left join public.student_stage_progress ssp on ssp.user_id=v_user_id and ssp.stage_id=es.id
  where es.exercise_id=v_exercise_id and es.active=true and coalesce(ssp.status,'locked')<>'mastered'
  order by case when ssp.status='in_progress' then 0 else 1 end,es.sequence_order,es.id
  limit 1;

  if v_stage_id is null then
    return query select v_path_code,v_exercise_code,null::text,'advance'::text,null::text,null::text,
      'EXERCISE_READY_TO_ADVANCE'::text,'แบบฝึกหัดนี้ผ่านครบแล้ว ไปแบบฝึกหัดถัดไปได้'::text,null::numeric,null::numeric,0,0;
    return;
  end if;

  select count(*) into v_practice_count
  from public.attempts a join public.practice_sessions ps on ps.id=a.practice_session_id
  where ps.user_id=v_user_id and ps.exercise_id=v_exercise_id and ps.stage_id=v_stage_id and ps.mode='practice';

  select count(*) into v_pretest_count
  from public.attempts a join public.practice_sessions ps on ps.id=a.practice_session_id
  where ps.user_id=v_user_id and ps.exercise_id=v_exercise_id and ps.stage_id=v_stage_id and ps.mode='pretest';

  select ps.planned_questions,ps.completed_questions,ps.completed_at
  into v_latest_pretest_planned,v_latest_pretest_completed,v_latest_pretest_completed_at
  from public.practice_sessions ps
  where ps.user_id=v_user_id and ps.exercise_id=v_exercise_id and ps.stage_id=v_stage_id and ps.mode='pretest'
  order by ps.started_at desc,ps.id desc
  limit 1;

  if v_pretest_count>0 then
    select * into v_diag
    from public.get_my_exercise_diagnostic(v_exercise_code) d
    where d.stage_id=v_stage_id
    limit 1;
  end if;

  if v_practice_count=0 and v_pretest_count=0 then
    return query select v_path_code,v_exercise_code,v_stage_code,'diagnostic'::text,null::text,null::text,
      'NO_STAGE_EVIDENCE'::text,'เริ่มแบบประเมินก่อนเรียน เพื่อค้นหาขั้นที่เหมาะสมสำหรับเริ่มฝึก'::text,
      null::numeric,null::numeric,0,0;
    return;
  end if;

  if v_practice_count=0 and v_pretest_count>0 and v_latest_pretest_completed_at is null then
    return query select v_path_code,v_exercise_code,v_stage_code,'diagnostic'::text,null::text,null::text,
      'RESUME_DIAGNOSTIC'::text,
      case when coalesce(v_latest_pretest_planned,0)>0 then
        format('ทำแบบประเมินก่อนเรียนต่อจากเดิม (%s/%s ข้อ) เหลืออีก %s ข้อเพื่อสรุปขั้นนี้',
          coalesce(v_latest_pretest_completed,0),v_latest_pretest_planned,
          greatest(v_latest_pretest_planned-coalesce(v_latest_pretest_completed,0),0))
      else 'มีแบบประเมินก่อนเรียนที่ยังทำไม่เสร็จ สามารถทำต่อจากตำแหน่งเดิมได้' end,
      v_diag.overall_score,v_diag.overall_threshold,coalesce(v_diag.attempts_found,0),coalesce(v_latest_pretest_planned,0);
    return;
  end if;

  select * into v_ev
  from public.get_my_stage_evidence(v_exercise_code,v_stage_code,'practice',false);

  if v_ev.mastery_passed=true then
    return query select v_path_code,v_exercise_code,v_stage_code,'advance'::text,null::text,null::text,
      'STAGE_MASTERY_READY'::text,'คุณผ่านเกณฑ์ของขั้นนี้แล้ว ไปขั้นถัดไปได้'::text,
      v_ev.overall_score,v_ev.overall_threshold,v_ev.attempts_found,v_ev.rolling_window;
    return;
  end if;

  if v_practice_count=0 and v_pretest_count>0 then
    return query select v_path_code,v_exercise_code,v_stage_code,'continue'::text,null::text,null::text,
      'DIAGNOSTIC_NEEDS_PRACTICE'::text,
      case when v_diag.overall_score is not null and v_diag.overall_threshold is not null
        then format('ผลประเมินก่อนเรียนเพียงพอสำหรับจัดจุดเริ่มต้นแล้ว โดยขั้นนี้ได้ %s%% และเกณฑ์คือ %s%% จึงแนะนำให้เริ่มฝึกขั้นนี้',to_char(v_diag.overall_score,'FM999990.##'),to_char(v_diag.overall_threshold,'FM999990.##'))
        else 'ผลประเมินก่อนเรียนเพียงพอสำหรับจัดจุดเริ่มต้นแล้ว จึงแนะนำให้เริ่มฝึกขั้นนี้' end,
      v_diag.overall_score,v_diag.overall_threshold,coalesce(v_diag.attempts_found,0),coalesce(v_diag.attempts_found,0);
    return;
  end if;

  if v_ev.enough_attempts is not true then
    return query select v_path_code,v_exercise_code,v_stage_code,'continue'::text,null::text,null::text,
      'MORE_EVIDENCE_REQUIRED'::text,
      format('ทำแบบฝึกเพิ่มอีก %s ข้อ เพื่อให้ระบบมีผลการฝึกเพียงพอสำหรับประเมินขั้นนี้',greatest(v_ev.rolling_window-v_ev.attempts_found,0)),
      v_ev.overall_score,v_ev.overall_threshold,v_ev.attempts_found,v_ev.rolling_window;
    return;
  end if;

  if v_ev.coverage_passed is not true then
    v_target_item:=case when coalesce(array_length(v_ev.missing_item_codes,1),0)>0 then v_ev.missing_item_codes[1] else null end;
    return query select v_path_code,v_exercise_code,v_stage_code,'target_item'::text,null::text,v_target_item,
      'ITEM_COVERAGE_GAP'::text,
      format('ยังมีบันไดเสียงที่ต้องฝึกให้ครบ%s',case when v_target_item is not null then format(' ลองฝึก %s ต่อ',v_target_item) else '' end),
      v_ev.overall_score,v_ev.overall_threshold,v_ev.attempts_found,v_ev.rolling_window;
    return;
  end if;

  if v_ev.skills_passed is not true then
    select x->>'skill_code' into v_weak_skill
    from jsonb_array_elements(v_ev.skill_results) x
    where coalesce((x->>'passed')::boolean,false)=false
    order by ((x->>'score')::numeric - (x->>'threshold')::numeric) asc nulls first, x->>'skill_code'
    limit 1;

    return query select v_path_code,v_exercise_code,v_stage_code,'target_skill'::text,v_weak_skill,null::text,
      'SKILL_THRESHOLD_GAP'::text,'ทักษะนี้ยังต่ำกว่าเกณฑ์ ควรระวังเป็นพิเศษในการฝึกข้อถัดไป'::text,
      v_ev.overall_score,v_ev.overall_threshold,v_ev.attempts_found,v_ev.rolling_window;
    return;
  end if;

  return query select v_path_code,v_exercise_code,v_stage_code,'continue'::text,null::text,null::text,
    'OVERALL_THRESHOLD_GAP'::text,
    format('คะแนนรวมยังไม่ถึงเกณฑ์ %s%% ทำแบบฝึกต่อเพื่อเพิ่มความแม่นยำ',to_char(v_ev.overall_threshold,'FM999990.##')),
    v_ev.overall_score,v_ev.overall_threshold,v_ev.attempts_found,v_ev.rolling_window;
end;
$function$;
