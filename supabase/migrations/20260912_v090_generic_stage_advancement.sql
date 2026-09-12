-- v0.9.0 generic stage advancement
-- This is the exact generic advancement behavior deployed with the Mastery Learning Core.
-- It replaces the earlier exercise-finalization implementation without assuming a fixed stage count.

create or replace function public.advance_my_stage_if_mastered(p_exercise_code text,p_stage_code text)
returns table(advanced boolean,completed_stage_code text,next_stage_code text,exercise_mastered boolean,overall_score numeric)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_exercise_id uuid;
  v_stage_id uuid;
  v_current_sequence integer;
  v_next_stage_id uuid;
  v_next_stage_code text;
  v_mastery_passed boolean;
  v_overall_score numeric;
  v_remaining_stages integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  select e.id,es.id,es.sequence_order into v_exercise_id,v_stage_id,v_current_sequence
  from public.exercises e join public.exercise_stages es on es.exercise_id=e.id
  where e.code=p_exercise_code and es.code=p_stage_code and e.active=true and es.active=true;
  if v_stage_id is null then raise exception 'Exercise/stage not found: % / %',p_exercise_code,p_stage_code; end if;

  select m.mastery_passed,m.overall_score into v_mastery_passed,v_overall_score
  from public.get_my_stage_mastery(p_exercise_code,p_stage_code) m;

  if coalesce(v_mastery_passed,false)=false then
    return query select false,p_stage_code,p_stage_code,false,v_overall_score;
    return;
  end if;

  insert into public.student_stage_progress(user_id,stage_id,status,last_mastery_score,started_at,mastered_at,updated_at)
  values(v_user_id,v_stage_id,'mastered',v_overall_score,now(),now(),now())
  on conflict(user_id,stage_id) do update set
    status='mastered',last_mastery_score=excluded.last_mastery_score,
    started_at=coalesce(student_stage_progress.started_at,excluded.started_at),
    mastered_at=coalesce(student_stage_progress.mastered_at,excluded.mastered_at),updated_at=now();

  select es.id,es.code into v_next_stage_id,v_next_stage_code
  from public.exercise_stages es
  where es.exercise_id=v_exercise_id and es.active=true and es.sequence_order>v_current_sequence
  order by es.sequence_order,es.id limit 1;

  if v_next_stage_id is not null then
    insert into public.student_stage_progress(user_id,stage_id,status,started_at,updated_at)
    values(v_user_id,v_next_stage_id,'in_progress',now(),now())
    on conflict(user_id,stage_id) do update set
      status=case when student_stage_progress.status='mastered' then 'mastered' else 'in_progress' end,
      started_at=coalesce(student_stage_progress.started_at,excluded.started_at),updated_at=now();
    return query select true,p_stage_code,v_next_stage_code,false,v_overall_score;
    return;
  end if;

  select count(*) into v_remaining_stages
  from public.exercise_stages es
  left join public.student_stage_progress ssp on ssp.stage_id=es.id and ssp.user_id=v_user_id
  where es.exercise_id=v_exercise_id and es.active=true and coalesce(ssp.status,'locked')<>'mastered';

  if v_remaining_stages=0 then
    insert into public.student_exercise_progress(user_id,exercise_id,status,started_at,mastered_at,updated_at)
    values(v_user_id,v_exercise_id,'mastered',now(),now(),now())
    on conflict(user_id,exercise_id) do update set
      status='mastered',started_at=coalesce(student_exercise_progress.started_at,excluded.started_at),
      mastered_at=coalesce(student_exercise_progress.mastered_at,excluded.mastered_at),updated_at=now();

    perform * from public.ensure_my_learning_path_progression();
    return query select true,p_stage_code,null::text,true,v_overall_score;
    return;
  end if;

  return query select true,p_stage_code,null::text,false,v_overall_score;
end;
$$;
