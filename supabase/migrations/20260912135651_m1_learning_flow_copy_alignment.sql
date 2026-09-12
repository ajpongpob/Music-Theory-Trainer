-- M1.2 Learning Flow UX
-- Align BN01 learner-facing terminology with v0.9.2 semantics and replace
-- implementation-oriented recommendation copy with actionable learner language.
-- No scoring threshold, mastery, progression, Stage, RLS, or notation rule changes.

update public.skills
set short_name='Pitch Name',
    name_th='ชื่อระดับเสียง (Pitch Name — ไม่จำกัด Octave)'
where code='BN01_TREBLE_PITCH';

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
  v_ev record;
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

  if v_path_id is null then
    return;
  end if;

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

  if v_practice_count=0 and v_pretest_count=0 then
    return query select v_path_code,v_exercise_code,v_stage_code,'diagnostic'::text,null::text,null::text,
      'NO_STAGE_EVIDENCE'::text,'เริ่มแบบประเมินก่อนเรียน เพื่อดูว่าสามารถข้ามขั้นนี้ได้หรือไม่'::text,
      null::numeric,null::numeric,0,0;
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
      'DIAGNOSTIC_NEEDS_PRACTICE'::text,'ผลประเมินก่อนเรียนบอกว่าควรฝึกขั้นนี้ก่อน แล้วระบบจะประเมินอีกครั้งจากผลการฝึก'::text,
      v_ev.overall_score,v_ev.overall_threshold,v_ev.attempts_found,v_ev.rolling_window;
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
      'SKILL_THRESHOLD_GAP'::text,'ทักษะนี้ยังต่ำกว่าเกณฑ์ ลองเน้นทักษะนี้ในข้อถัดไป'::text,
      v_ev.overall_score,v_ev.overall_threshold,v_ev.attempts_found,v_ev.rolling_window;
    return;
  end if;

  return query select v_path_code,v_exercise_code,v_stage_code,'continue'::text,null::text,null::text,
    'OVERALL_THRESHOLD_GAP'::text,
    format('คะแนนรวมยังไม่ถึงเกณฑ์ %s%% ทำแบบฝึกต่อเพื่อเพิ่มความแม่นยำ',to_char(v_ev.overall_threshold,'FM999990.##')),
    v_ev.overall_score,v_ev.overall_threshold,v_ev.attempts_found,v_ev.rolling_window;
end;
$function$;
