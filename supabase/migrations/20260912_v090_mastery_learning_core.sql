-- v0.9.0 Mastery Learning Core
-- Applied to Supabase project major-scale-trainer (ptksuomvpuiesbwrzzif).
-- Uses the existing stage_mastery_rules, stage_skill_requirements,
-- stage_required_items, path_exercises and sequence_order configuration.

create or replace function public.get_my_stage_evidence(
  p_exercise_code text,
  p_stage_code text,
  p_mode text default 'practice',
  p_latest_session_only boolean default false
)
returns table(
  exercise_id uuid, stage_id uuid, exercise_code text, stage_code text,
  evidence_mode text, rolling_window integer, attempts_found integer,
  required_items integer, covered_items integer, overall_threshold numeric,
  overall_score numeric, enough_attempts boolean, coverage_passed boolean,
  skills_passed boolean, mastery_passed boolean, skill_results jsonb,
  missing_item_codes text[]
)
language plpgsql stable security definer
set search_path=public,pg_temp
as $$
declare
  v_user_id uuid:=auth.uid(); v_exercise_id uuid; v_stage_id uuid;
  v_window integer; v_overall_threshold numeric; v_attempt_limit integer;
  v_mode text:=lower(coalesce(nullif(btrim(p_mode),''),'practice'));
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if v_mode not in ('practice','pretest','mastery_test') then raise exception 'Unsupported evidence mode: %',v_mode; end if;
  select e.id,es.id into v_exercise_id,v_stage_id
  from public.exercises e join public.exercise_stages es on es.exercise_id=e.id
  where e.code=p_exercise_code and es.code=p_stage_code and e.active=true and es.active=true;
  if v_stage_id is null then raise exception 'Exercise/stage not found: % / %',p_exercise_code,p_stage_code; end if;
  select smr.rolling_window,smr.overall_threshold into v_window,v_overall_threshold
  from public.stage_mastery_rules smr where smr.stage_id=v_stage_id and smr.active=true;
  if v_window is null then raise exception 'No active mastery rule for stage %',p_stage_code; end if;
  v_attempt_limit:=case when v_mode='practice' then v_window else 2147483647 end;
  return query
  with ranked_sessions as (
    select ps.id,ps.started_at,row_number() over(order by ps.started_at desc,ps.id desc) rn
    from public.practice_sessions ps
    where ps.user_id=v_user_id and ps.mode=v_mode and ps.exercise_id=v_exercise_id and ps.stage_id=v_stage_id
  ), selected_sessions as (
    select rs.id from ranked_sessions rs where (not p_latest_session_only) or rs.rn=1
  ), attempt_pool as (
    select a.id,a.item_code,a.score,a.checked_at from public.attempts a
    join selected_sessions ss on ss.id=a.practice_session_id
    order by a.checked_at desc,a.id desc limit v_attempt_limit
  ), attempt_stats as (
    select count(*)::integer attempts_found,round(avg(ap.score)::numeric,2) overall_score from attempt_pool ap
  ), item_stats as (
    select count(*)::integer required_items,
      count(*) filter(where exists(select 1 from attempt_pool ap where ap.item_code=sri.item_code))::integer covered_items,
      coalesce(array_agg(sri.item_code order by sri.sequence_order) filter(where not exists(select 1 from attempt_pool ap where ap.item_code=sri.item_code)),'{}'::text[]) missing_item_codes
    from public.stage_required_items sri where sri.stage_id=v_stage_id and sri.active=true
  ), skill_scores as (
    select ssr.skill_code,ssr.threshold,
      case when coalesce(sum(asr.total_count),0)>0 then round((sum(asr.correct_count)::numeric/sum(asr.total_count)::numeric)*100,2) else null end score
    from public.stage_skill_requirements ssr
    left join public.attempt_skill_results asr on asr.skill_code=ssr.skill_code
      and exists(select 1 from attempt_pool ap where ap.id=asr.attempt_id)
    where ssr.stage_id=v_stage_id and ssr.active=true group by ssr.skill_code,ssr.threshold
  ), skill_summary as (
    select coalesce(bool_and(score is not null and score>=threshold),true) skills_passed,
      coalesce(jsonb_agg(jsonb_build_object('skill_code',skill_code,'score',score,'threshold',threshold,'passed',(score is not null and score>=threshold)) order by skill_code),'[]'::jsonb) skill_results
    from skill_scores
  ), combined as (
    select ast.attempts_found,ast.overall_score,ist.required_items,ist.covered_items,ist.missing_item_codes,
      ss.skills_passed,ss.skill_results,
      case when v_mode='practice' then ast.attempts_found>=v_window else ast.attempts_found>=greatest(ist.required_items,1) end enough_attempts,
      (ist.required_items=0 or ist.covered_items=ist.required_items) coverage_passed
    from attempt_stats ast cross join item_stats ist cross join skill_summary ss
  )
  select v_exercise_id,v_stage_id,p_exercise_code,p_stage_code,v_mode,v_window,c.attempts_found,c.required_items,c.covered_items,
    v_overall_threshold,c.overall_score,c.enough_attempts,c.coverage_passed,c.skills_passed,
    (c.enough_attempts and c.coverage_passed and c.overall_score>=v_overall_threshold and c.skills_passed),c.skill_results,c.missing_item_codes
  from combined c;
end;$$;

create or replace function public.get_my_stage_mastery(p_exercise_code text,p_stage_code text)
returns table(exercise_id uuid,stage_id uuid,exercise_code text,stage_code text,rolling_window integer,attempts_found integer,required_items integer,covered_items integer,overall_threshold numeric,overall_score numeric,enough_attempts boolean,coverage_passed boolean,skills_passed boolean,mastery_passed boolean,skill_results jsonb)
language sql stable security definer set search_path=public,pg_temp as $$
select e.exercise_id,e.stage_id,e.exercise_code,e.stage_code,e.rolling_window,e.attempts_found,e.required_items,e.covered_items,e.overall_threshold,e.overall_score,e.enough_attempts,e.coverage_passed,e.skills_passed,e.mastery_passed,e.skill_results
from public.get_my_stage_evidence(p_exercise_code,p_stage_code,'practice',false) e;$$;

create or replace function public.get_my_exercise_diagnostic(p_exercise_code text)
returns table(exercise_id uuid,stage_id uuid,exercise_code text,stage_code text,stage_name text,stage_sequence integer,attempts_found integer,required_items integer,covered_items integer,overall_threshold numeric,overall_score numeric,enough_evidence boolean,coverage_passed boolean,skills_passed boolean,diagnostic_passed boolean,skill_results jsonb,missing_item_codes text[],latest_session_id uuid,latest_session_completed_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
select es.exercise_id,es.id,e.code,es.code,es.name_th,es.sequence_order,ev.attempts_found,ev.required_items,ev.covered_items,ev.overall_threshold,ev.overall_score,ev.enough_attempts,ev.coverage_passed,ev.skills_passed,ev.mastery_passed,ev.skill_results,ev.missing_item_codes,latest.id,latest.completed_at
from public.exercises e join public.exercise_stages es on es.exercise_id=e.id and es.active=true
cross join lateral public.get_my_stage_evidence(e.code,es.code,'pretest',true) ev
left join lateral(select ps.id,ps.completed_at from public.practice_sessions ps where ps.user_id=auth.uid() and ps.exercise_id=e.id and ps.stage_id=es.id and ps.mode='pretest' order by ps.started_at desc,ps.id desc limit 1) latest on true
where e.code=p_exercise_code and e.active=true order by es.sequence_order,es.id;$$;

create or replace function public.ensure_my_learning_path_progression()
returns table(learning_path_id uuid,learning_path_code text,path_status text,current_exercise_code text,current_stage_code text)
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user_id uuid:=auth.uid(); r_path record; v_exercise_id uuid; v_exercise_code text; v_stage_id uuid; v_stage_code text; v_required_remaining integer;
begin
if v_user_id is null then raise exception 'Authentication required'; end if;
for r_path in select slpp.path_id,lp.code from public.student_learning_path_progress slpp join public.learning_paths lp on lp.id=slpp.path_id and lp.active=true where slpp.user_id=v_user_id order by lp.sort_order,lp.id loop
  insert into public.student_exercise_progress(user_id,exercise_id,status,started_at)
  select v_user_id,pe.exercise_id,'not_started',null from public.path_exercises pe join public.exercises e on e.id=pe.exercise_id and e.active=true where pe.path_id=r_path.path_id and pe.active=true on conflict(user_id,exercise_id) do nothing;
  insert into public.student_stage_progress(user_id,stage_id,status,started_at)
  select v_user_id,es.id,'locked',null from public.path_exercises pe join public.exercises e on e.id=pe.exercise_id and e.active=true join public.exercise_stages es on es.exercise_id=e.id and es.active=true where pe.path_id=r_path.path_id and pe.active=true on conflict(user_id,stage_id) do nothing;
  select count(*) into v_required_remaining from public.path_exercises pe left join public.student_exercise_progress sep on sep.user_id=v_user_id and sep.exercise_id=pe.exercise_id where pe.path_id=r_path.path_id and pe.active=true and pe.required_for_completion=true and coalesce(sep.status,'not_started')<>'mastered';
  if v_required_remaining=0 and exists(select 1 from public.path_exercises pe where pe.path_id=r_path.path_id and pe.active=true and pe.required_for_completion=true) then
    update public.student_learning_path_progress set status='mastered',mastered_at=coalesce(mastered_at,now()),updated_at=now() where user_id=v_user_id and path_id=r_path.path_id;
    return query select r_path.path_id,r_path.code,'mastered'::text,null::text,null::text; continue;
  end if;
  select pe.exercise_id,e.code into v_exercise_id,v_exercise_code from public.path_exercises pe join public.exercises e on e.id=pe.exercise_id and e.active=true left join public.student_exercise_progress sep on sep.user_id=v_user_id and sep.exercise_id=pe.exercise_id where pe.path_id=r_path.path_id and pe.active=true and coalesce(sep.status,'not_started')<>'mastered' order by pe.sequence_order,pe.exercise_id limit 1;
  if v_exercise_id is null then return query select r_path.path_id,r_path.code,'in_progress'::text,null::text,null::text; continue; end if;
  update public.student_learning_path_progress set status='in_progress',started_at=coalesce(started_at,now()),updated_at=now() where user_id=v_user_id and path_id=r_path.path_id and status<>'mastered';
  update public.student_exercise_progress set status='in_progress',started_at=coalesce(started_at,now()),updated_at=now() where user_id=v_user_id and exercise_id=v_exercise_id and status<>'mastered';
  select es.id,es.code into v_stage_id,v_stage_code from public.exercise_stages es left join public.student_stage_progress ssp on ssp.user_id=v_user_id and ssp.stage_id=es.id where es.exercise_id=v_exercise_id and es.active=true and coalesce(ssp.status,'locked')<>'mastered' order by es.sequence_order,es.id limit 1;
  if v_stage_id is not null then update public.student_stage_progress set status='in_progress',started_at=coalesce(started_at,now()),updated_at=now() where user_id=v_user_id and stage_id=v_stage_id and status<>'mastered'; end if;
  return query select r_path.path_id,r_path.code,'in_progress'::text,v_exercise_code,v_stage_code;
end loop; end;$$;

create or replace function public.apply_my_diagnostic_placement(p_exercise_code text)
returns table(applied boolean,exercise_code text,placement_stage_code text,diagnostic_mastered_stages integer,exercise_mastered boolean,reason_code text)
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user_id uuid:=auth.uid();v_exercise_id uuid;r record;v_any_evidence boolean:=false;v_blocked boolean:=false;v_placement_stage_id uuid:=null;v_placement_stage_code text:=null;v_mastered_count integer:=0;v_total_stages integer:=0;
begin
if v_user_id is null then raise exception 'Authentication required'; end if;
select e.id into v_exercise_id from public.exercises e where e.code=p_exercise_code and e.active=true;if v_exercise_id is null then raise exception 'Exercise not found: %',p_exercise_code;end if;
select count(*) into v_total_stages from public.exercise_stages es where es.exercise_id=v_exercise_id and es.active=true;
for r in select * from public.get_my_exercise_diagnostic(p_exercise_code) order by stage_sequence,stage_id loop
 if r.attempts_found>0 then v_any_evidence:=true;end if;
 if exists(select 1 from public.student_stage_progress ssp where ssp.user_id=v_user_id and ssp.stage_id=r.stage_id and ssp.status='mastered') then v_mastered_count:=v_mastered_count+1;continue;end if;
 if not v_blocked and r.diagnostic_passed=true then
   insert into public.student_stage_progress(user_id,stage_id,status,last_mastery_score,started_at,mastered_at,updated_at) values(v_user_id,r.stage_id,'mastered',r.overall_score,now(),now(),now()) on conflict(user_id,stage_id) do update set status='mastered',last_mastery_score=excluded.last_mastery_score,started_at=coalesce(student_stage_progress.started_at,excluded.started_at),mastered_at=coalesce(student_stage_progress.mastered_at,excluded.mastered_at),updated_at=now();v_mastered_count:=v_mastered_count+1;
 elsif not v_blocked then v_blocked:=true;v_placement_stage_id:=r.stage_id;v_placement_stage_code:=r.stage_code;
   insert into public.student_stage_progress(user_id,stage_id,status,started_at,updated_at) values(v_user_id,r.stage_id,'in_progress',now(),now()) on conflict(user_id,stage_id) do update set status=case when student_stage_progress.status='mastered' then 'mastered' else 'in_progress' end,started_at=coalesce(student_stage_progress.started_at,excluded.started_at),updated_at=now();
 end if;
end loop;
if not v_any_evidence then return query select false,p_exercise_code,null::text,0,false,'NO_DIAGNOSTIC_EVIDENCE'::text;return;end if;
insert into public.student_exercise_progress(user_id,exercise_id,status,started_at,mastered_at,updated_at) values(v_user_id,v_exercise_id,case when v_placement_stage_id is null and v_mastered_count>=v_total_stages then 'mastered' else 'in_progress' end,now(),case when v_placement_stage_id is null and v_mastered_count>=v_total_stages then now() else null end,now()) on conflict(user_id,exercise_id) do update set status=case when student_exercise_progress.status='mastered' then 'mastered' else excluded.status end,started_at=coalesce(student_exercise_progress.started_at,excluded.started_at),mastered_at=coalesce(student_exercise_progress.mastered_at,excluded.mastered_at),updated_at=now();
perform * from public.ensure_my_learning_path_progression();
return query select true,p_exercise_code,v_placement_stage_code,v_mastered_count,(v_placement_stage_id is null and v_mastered_count>=v_total_stages),case when v_placement_stage_id is null and v_mastered_count>=v_total_stages then 'DIAGNOSTIC_EXERCISE_MASTERED' else 'DIAGNOSTIC_PLACED' end;
end;$$;

create or replace function public.get_my_recommended_next_action(p_path_code text default null)
returns table(learning_path_code text,exercise_code text,stage_code text,action_type text,target_skill_code text,target_item_code text,reason_code text,reason_th text,overall_score numeric,overall_threshold numeric,attempts_found integer,rolling_window integer)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_user_id uuid:=auth.uid();v_path_id uuid;v_path_code text;v_path_status text;v_exercise_id uuid;v_exercise_code text;v_stage_id uuid;v_stage_code text;v_practice_count integer:=0;v_pretest_count integer:=0;v_ev record;v_weak_skill text;v_target_item text;
begin
if v_user_id is null then raise exception 'Authentication required';end if;
select slpp.path_id,lp.code,slpp.status into v_path_id,v_path_code,v_path_status from public.student_learning_path_progress slpp join public.learning_paths lp on lp.id=slpp.path_id and lp.active=true where slpp.user_id=v_user_id and (p_path_code is null or lp.code=p_path_code) order by case slpp.status when 'in_progress' then 0 when 'not_started' then 1 else 2 end,lp.sort_order,lp.id limit 1;
if v_path_id is null then return;end if;
if v_path_status='mastered' then return query select v_path_code,null::text,null::text,'completed'::text,null::text,null::text,'PATH_MASTERED'::text,'สำเร็จเส้นทางการเรียนรู้แล้ว'::text,null::numeric,null::numeric,0,0;return;end if;
select pe.exercise_id,e.code into v_exercise_id,v_exercise_code from public.path_exercises pe join public.exercises e on e.id=pe.exercise_id and e.active=true left join public.student_exercise_progress sep on sep.user_id=v_user_id and sep.exercise_id=pe.exercise_id where pe.path_id=v_path_id and pe.active=true and coalesce(sep.status,'not_started')<>'mastered' order by pe.sequence_order,pe.exercise_id limit 1;
if v_exercise_id is null then return query select v_path_code,null::text,null::text,'completed'::text,null::text,null::text,'PATH_REQUIREMENTS_COMPLETE'::text,'แบบฝึกหัดที่กำหนดในเส้นทางนี้สำเร็จแล้ว'::text,null::numeric,null::numeric,0,0;return;end if;
select es.id,es.code into v_stage_id,v_stage_code from public.exercise_stages es left join public.student_stage_progress ssp on ssp.user_id=v_user_id and ssp.stage_id=es.id where es.exercise_id=v_exercise_id and es.active=true and coalesce(ssp.status,'locked')<>'mastered' order by case when ssp.status='in_progress' then 0 else 1 end,es.sequence_order,es.id limit 1;
if v_stage_id is null then return query select v_path_code,v_exercise_code,null::text,'advance'::text,null::text,null::text,'EXERCISE_READY_TO_ADVANCE'::text,'พร้อมไปยังแบบฝึกหัดถัดไป'::text,null::numeric,null::numeric,0,0;return;end if;
select count(*) into v_practice_count from public.attempts a join public.practice_sessions ps on ps.id=a.practice_session_id where ps.user_id=v_user_id and ps.exercise_id=v_exercise_id and ps.stage_id=v_stage_id and ps.mode='practice';
select count(*) into v_pretest_count from public.attempts a join public.practice_sessions ps on ps.id=a.practice_session_id where ps.user_id=v_user_id and ps.exercise_id=v_exercise_id and ps.stage_id=v_stage_id and ps.mode='pretest';
if v_practice_count=0 and v_pretest_count=0 then return query select v_path_code,v_exercise_code,v_stage_code,'diagnostic'::text,null::text,null::text,'NO_STAGE_EVIDENCE'::text,'เริ่มแบบประเมินก่อนเรียนเพื่อดูว่าขั้นนี้สามารถข้ามได้หรือไม่'::text,null::numeric,null::numeric,0,0;return;end if;
select * into v_ev from public.get_my_stage_evidence(v_exercise_code,v_stage_code,'practice',false);
if v_ev.mastery_passed=true then return query select v_path_code,v_exercise_code,v_stage_code,'advance'::text,null::text,null::text,'STAGE_MASTERY_READY'::text,'หลักฐานล่าสุดผ่านเกณฑ์ Mastery แล้ว พร้อมเลื่อนไปขั้นถัดไป'::text,v_ev.overall_score,v_ev.overall_threshold,v_ev.attempts_found,v_ev.rolling_window;return;end if;
if v_practice_count=0 and v_pretest_count>0 then return query select v_path_code,v_exercise_code,v_stage_code,'continue'::text,null::text,null::text,'DIAGNOSTIC_NEEDS_PRACTICE'::text,'ผลประเมินก่อนเรียนชี้ว่าควรฝึกขั้นนี้ต่อ'::text,v_ev.overall_score,v_ev.overall_threshold,v_ev.attempts_found,v_ev.rolling_window;return;end if;
if v_ev.enough_attempts is not true then return query select v_path_code,v_exercise_code,v_stage_code,'continue'::text,null::text,null::text,'MORE_EVIDENCE_REQUIRED'::text,'ทำแบบฝึกต่อเพื่อสะสมหลักฐานให้ครบตามช่วงประเมิน'::text,v_ev.overall_score,v_ev.overall_threshold,v_ev.attempts_found,v_ev.rolling_window;return;end if;
if v_ev.coverage_passed is not true then v_target_item:=case when coalesce(array_length(v_ev.missing_item_codes,1),0)>0 then v_ev.missing_item_codes[1] else null end;return query select v_path_code,v_exercise_code,v_stage_code,'target_item'::text,null::text,v_target_item,'ITEM_COVERAGE_GAP'::text,'ฝึกโจทย์ที่ยังขาดเพื่อให้หลักฐานครบทุกหัวข้อที่กำหนด'::text,v_ev.overall_score,v_ev.overall_threshold,v_ev.attempts_found,v_ev.rolling_window;return;end if;
if v_ev.skills_passed is not true then select x->>'skill_code' into v_weak_skill from jsonb_array_elements(v_ev.skill_results) x where coalesce((x->>'passed')::boolean,false)=false order by ((x->>'score')::numeric-(x->>'threshold')::numeric) asc nulls first,x->>'skill_code' limit 1;return query select v_path_code,v_exercise_code,v_stage_code,'target_skill'::text,v_weak_skill,null::text,'SKILL_THRESHOLD_GAP'::text,'มุ่งฝึกทักษะที่ยังต่ำกว่าเกณฑ์ก่อนประเมิน Mastery อีกครั้ง'::text,v_ev.overall_score,v_ev.overall_threshold,v_ev.attempts_found,v_ev.rolling_window;return;end if;
return query select v_path_code,v_exercise_code,v_stage_code,'continue'::text,null::text,null::text,'OVERALL_THRESHOLD_GAP'::text,'ทำแบบฝึกต่อเพื่อยกระดับคะแนนรวมให้ถึงเกณฑ์ Mastery'::text,v_ev.overall_score,v_ev.overall_threshold,v_ev.attempts_found,v_ev.rolling_window;
end;$$;

-- Generic advancement still delegates mastery to the DB-configured stage rule and
-- chooses the next stage/exercise by sequence_order; no fixed stage count is used.
-- The deployed function public.advance_my_stage_if_mastered(text,text) was replaced
-- in this release to call ensure_my_learning_path_progression() when an exercise completes.

revoke execute on function public.get_my_stage_evidence(text,text,text,boolean) from anon;
revoke execute on function public.get_my_exercise_diagnostic(text) from anon;
revoke execute on function public.ensure_my_learning_path_progression() from anon;
revoke execute on function public.apply_my_diagnostic_placement(text) from anon;
revoke execute on function public.get_my_recommended_next_action(text) from anon;
revoke execute on function public.get_my_stage_evidence(text,text,text,boolean) from public;
revoke execute on function public.get_my_exercise_diagnostic(text) from public;
revoke execute on function public.ensure_my_learning_path_progression() from public;
revoke execute on function public.apply_my_diagnostic_placement(text) from public;
revoke execute on function public.get_my_recommended_next_action(text) from public;
grant execute on function public.get_my_stage_evidence(text,text,text,boolean) to authenticated;
grant execute on function public.get_my_exercise_diagnostic(text) to authenticated;
grant execute on function public.ensure_my_learning_path_progression() to authenticated;
grant execute on function public.apply_my_diagnostic_placement(text) to authenticated;
grant execute on function public.get_my_recommended_next_action(text) to authenticated;
