-- v0.9.1 Path Stage Enforcement
-- Only in-progress or already-mastered stages may receive learner sessions.
-- This prevents a learner from persisting work into a higher locked stage by
-- manipulating the Level control or client payload.

drop policy if exists "Users can create own practice sessions" on public.practice_sessions;
create policy "Users can create own practice sessions"
on public.practice_sessions
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exercise_id is not null
  and stage_id is not null
  and exists (
    select 1
    from public.student_stage_progress ssp
    join public.exercise_stages es on es.id = ssp.stage_id
    where ssp.user_id = auth.uid()
      and ssp.stage_id = practice_sessions.stage_id
      and ssp.status in ('in_progress','mastered')
      and es.exercise_id = practice_sessions.exercise_id
      and es.active = true
  )
);

drop policy if exists "Users can update own practice sessions" on public.practice_sessions;
create policy "Users can update own practice sessions"
on public.practice_sessions
for update
to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exercise_id is not null
  and stage_id is not null
  and exists (
    select 1
    from public.student_stage_progress ssp
    join public.exercise_stages es on es.id = ssp.stage_id
    where ssp.user_id = auth.uid()
      and ssp.stage_id = practice_sessions.stage_id
      and ssp.status in ('in_progress','mastered')
      and es.exercise_id = practice_sessions.exercise_id
      and es.active = true
  )
);
