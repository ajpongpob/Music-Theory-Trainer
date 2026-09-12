'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const ROOT=path.resolve(__dirname,'..');
const migration=fs.readFileSync(path.join(ROOT,'supabase/migrations/20260912140316_m1_diagnostic_recovery.sql'),'utf8');
const trainer=fs.readFileSync(path.join(ROOT,'src/trainer.js'),'utf8');

assert(migration.includes('v_latest_pretest_planned'),'diagnostic recovery must inspect the latest pre-test plan');
assert(migration.includes('v_latest_pretest_completed'),'diagnostic recovery must inspect completed pre-test questions');
assert(migration.includes("v_practice_count=0 and v_pretest_count>0"),'recovery must be limited to learners who have not started practice');
assert(migration.includes('coalesce(v_latest_pretest_completed,0)<v_latest_pretest_planned'),'partial pre-test must be detected from completed versus planned questions');
assert(migration.includes("'INCOMPLETE_DIAGNOSTIC'::text"),'partial diagnostic must have a deterministic reason code');
assert(migration.includes("'diagnostic'::text"),'partial diagnostic must stay in diagnostic mode');
assert(migration.includes('แบบประเมินก่อนเรียนครั้งก่อนยังไม่ครบ'),'learner must be told why diagnostic is being restarted');
assert(migration.includes('ผลประเมินก่อนเรียนได้ %s%% ยังไม่ถึงเกณฑ์ %s%%'),'completed diagnostic failure must explain score versus threshold');
assert(migration.includes('from public.get_my_exercise_diagnostic(v_exercise_code)'),'diagnostic result must come from configured diagnostic evidence');
assert(!migration.includes('create or replace function public.apply_my_diagnostic_placement'),'M1.3 recovery must not change placement authority/rules');
assert(!/update\s+public\.stage_mastery_rules/i.test(migration),'M1.3 recovery must not change mastery thresholds');
assert(!/update\s+public\.stage_skill_requirements/i.test(migration),'M1.3 recovery must not change skill thresholds');

assert(trainer.includes('masteryLearningCore.diagnosticComplete(completedQuestions,state.sessionLength)'),'Trainer must apply placement only after the planned diagnostic is complete');
assert(trainer.includes('learningRepository.applyDiagnosticPlacement(majorScaleConfig.exerciseCode)'),'Trainer must invoke authoritative placement after diagnostic completion');
assert(trainer.includes('setQuestionResultAction({disabled:false,text:"ดูแผนการเรียนที่แนะนำ"})'),'completed diagnostic must route learner back to the recommended plan');

console.log('PASS M1.3 diagnostic recovery: incomplete pre-tests restart diagnostic, completed failures explain score/threshold, placement rules unchanged');
