-- Fold M1.5 teacher learning detail into the existing authorized dashboard RPC
-- so Security Advisor remains at the pre-M1.5 SECURITY DEFINER baseline.

drop function if exists public.get_my_teacher_class_learning_feedback(uuid);
drop function if exists public.get_my_teacher_class_dashboard(uuid);

create function public.get_my_teacher_class_dashboard(p_class_id uuid)
returns table(
  class_id uuid, class_code text, class_name text, academic_year text, term text,
  student_id uuid, student_name text,
  learning_path_id uuid, learning_path_code text, learning_path_name text,
  learning_path_status text, learning_status text,
  path_started_at timestamptz, path_mastered_at timestamptz,
  exercise_id uuid, exercise_code text, exercise_name text, exercise_sequence integer,
  required_for_completion boolean, exercise_status text,
  stages_mastered integer, stages_total integer,
  current_stage_id uuid, current_stage_code text, current_stage_name text, current_stage_sequence integer,
  latest_mastery_score numeric, learning_feedback jsonb
)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_class_teacher(p_class_id) then raise exception 'Not authorized to view this class'; end if;

  return query
  with class_info as (
    select c.id,c.code,c.name,c.academic_year,c.term from public.classes c where c.id=p_class_id
  ),
  class_students as (
    select cm.user_id,p.full_name from public.class_memberships cm
    join public.profiles p on p.id=cm.user_id
    where cm.class_id=p_class_id and cm.membership_role='student' and cm.active=true
  ),
  assigned_paths as (
    select clp.path_id,lp.code,lp.name_th,lp.sort_order
    from public.class_learning_paths clp join public.learning_paths lp on lp.id=clp.path_id and lp.active=true
    where clp.class_id=p_class_id and clp.active=true
  ),
  assigned_exercises as (
    select ap.path_id,ap.code path_code,ap.name_th path_name,ap.sort_order path_sort_order,
      e.id exercise_id,e.code exercise_code,e.name_th exercise_name,pe.sequence_order exercise_sequence,pe.required_for_completion
    from assigned_paths ap join public.path_exercises pe on pe.path_id=ap.path_id and pe.active=true
    join public.exercises e on e.id=pe.exercise_id and e.active=true
  )
  select ci.id,ci.code,ci.name,ci.academic_year,ci.term,
    cs.user_id,cs.full_name,ae.path_id,ae.path_code,ae.path_name,slpp.status,
    case when ae.path_id is null then null when slpp.status='mastered' then 'completed' when slpp.status='in_progress' then 'studying' else 'not_started' end,
    slpp.started_at,slpp.mastered_at,
    ae.exercise_id,ae.exercise_code,ae.exercise_name,ae.exercise_sequence,ae.required_for_completion,
    coalesce(sep.status,case when ae.exercise_id is not null then 'not_started' else null end),
    case when ae.exercise_id is null then null else (
      select count(*)::integer from public.exercise_stages es_count
      join public.student_stage_progress ssp_count on ssp_count.stage_id=es_count.id and ssp_count.user_id=cs.user_id and ssp_count.status='mastered'
      where es_count.exercise_id=ae.exercise_id and es_count.active=true
    ) end,
    case when ae.exercise_id is null then null else (
      select count(*)::integer from public.exercise_stages es_total where es_total.exercise_id=ae.exercise_id and es_total.active=true
    ) end,
    current_stage.stage_id,current_stage.stage_code,current_stage.stage_name,current_stage.stage_sequence,
    latest_score.last_mastery_score,
    case when ae.exercise_id is null then null else jsonb_build_object(
      'latest_activity_at',activity.latest_activity_at,
      'practice_session_count',coalesce(activity.practice_session_count,0),
      'attempt_count',coalesce(activity.attempt_count,0),
      'rolling_window',ev.rolling_window,'attempts_found',ev.attempts_found,
      'required_items',ev.required_items,'covered_items',ev.covered_items,
      'missing_item_codes',coalesce(ev.missing_item_codes,'{}'::text[]),
      'overall_threshold',ev.overall_threshold,'overall_score',ev.overall_score,
      'skill_results',coalesce(ev.skill_results,'[]'::jsonb)
    ) end
  from class_info ci
  join class_students cs on true
  left join assigned_exercises ae on true
  left join public.student_learning_path_progress slpp on slpp.user_id=cs.user_id and slpp.path_id=ae.path_id
  left join public.student_exercise_progress sep on sep.user_id=cs.user_id and sep.exercise_id=ae.exercise_id
  left join lateral (
    select es.id stage_id,es.code stage_code,es.name_th stage_name,es.sequence_order stage_sequence
    from public.exercise_stages es join public.student_stage_progress ssp on ssp.stage_id=es.id and ssp.user_id=cs.user_id
    where es.exercise_id=ae.exercise_id and es.active=true and ssp.status='in_progress'
    order by es.sequence_order limit 1
  ) current_stage on true
  left join lateral (
    select ssp.last_mastery_score from public.student_stage_progress ssp
    join public.exercise_stages es on es.id=ssp.stage_id and es.active=true
    where ssp.user_id=cs.user_id and es.exercise_id=ae.exercise_id and ssp.last_mastery_score is not null
    order by ssp.updated_at desc,es.sequence_order desc limit 1
  ) latest_score on true
  left join lateral (
    select max(ps.last_activity_at) latest_activity_at,
      count(distinct ps.id) filter(where ps.mode='practice')::integer practice_session_count,
      count(a.id) filter(where ps.mode='practice')::integer attempt_count
    from public.practice_sessions ps left join public.attempts a on a.practice_session_id=ps.id
    where ps.user_id=cs.user_id and ps.exercise_id=ae.exercise_id
  ) activity on true
  left join lateral (
    with rule as (
      select smr.rolling_window,smr.overall_threshold from public.stage_mastery_rules smr
      where smr.stage_id=current_stage.stage_id and smr.active=true limit 1
    ), pool as (
      select a.id,a.item_code,a.score,a.checked_at from public.attempts a
      join public.practice_sessions ps on ps.id=a.practice_session_id
      where ps.user_id=cs.user_id and ps.exercise_id=ae.exercise_id and ps.stage_id=current_stage.stage_id and ps.mode='practice'
      order by a.checked_at desc,a.id desc limit coalesce((select rolling_window from rule),0)
    ), items as (
      select count(*)::integer required_items,
        count(*) filter(where exists(select 1 from pool p where p.item_code=sri.item_code))::integer covered_items,
        coalesce(array_agg(sri.item_code order by sri.sequence_order) filter(where not exists(select 1 from pool p where p.item_code=sri.item_code)),'{}'::text[]) missing_item_codes
      from public.stage_required_items sri where sri.stage_id=current_stage.stage_id and sri.active=true
    ), skills as (
      select coalesce(jsonb_agg(jsonb_build_object('skill_code',x.skill_code,'score',x.score,'threshold',x.threshold,'passed',(x.score is not null and x.score>=x.threshold)) order by x.skill_code),'[]'::jsonb) skill_results
      from (
        select ssr.skill_code,ssr.threshold,
          case when coalesce(sum(asr.total_count),0)>0 then round(sum(asr.correct_count)::numeric/sum(asr.total_count)::numeric*100,2) else null end score
        from public.stage_skill_requirements ssr
        left join public.attempt_skill_results asr on asr.skill_code=ssr.skill_code and exists(select 1 from pool p where p.id=asr.attempt_id)
        where ssr.stage_id=current_stage.stage_id and ssr.active=true
        group by ssr.skill_code,ssr.threshold
      ) x
    )
    select r.rolling_window,(select count(*)::integer from pool) attempts_found,
      i.required_items,i.covered_items,i.missing_item_codes,r.overall_threshold,
      (select round(avg(score)::numeric,2) from pool) overall_score,s.skill_results
    from rule r cross join items i cross join skills s
  ) ev on current_stage.stage_id is not null
  order by cs.full_name nulls last,cs.user_id,ae.path_sort_order nulls last,ae.exercise_sequence nulls last;
end;
$$;

revoke all on function public.get_my_teacher_class_dashboard(uuid) from public, anon;
grant execute on function public.get_my_teacher_class_dashboard(uuid) to authenticated, service_role;
