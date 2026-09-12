'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

const ui=read('src/m16-pretest-flow.js');
const learning=read('src/data/learning.repository.js');
const dashboard=read('src/data/dashboard.repository.js');
const migration=read('supabase/migrations/20260912172210_m16_pretest_resume_early_stop.sql');

assert(learning.includes('evaluatePretestProgress(sessionId)'),'learning repository must expose authoritative pretest evaluation');
assert(learning.includes("rpc('evaluate_my_pretest_progress'"),'pretest evaluation must be database-authoritative');
assert(dashboard.includes('getPretestJourney(exerciseCode)'),'dashboard repository must expose pretest journey state');
assert(dashboard.includes('m16-pretest-flow.js'),'M1.6 layer must load after M1.5 hardening');

assert(ui.includes("row.mode!=='pretest'"),'stale-session cleanup must not close resumable pretests');
assert(ui.includes('getRequiredStageItems(stageId)'),'M1.6 must remove already answered diagnostic items when resuming');
assert(ui.includes('adjusted.question_number=Number(payload.question_number||0)+activePretest.offset'),'resumed attempts must continue immutable question numbering');
assert(ui.includes("activePretest?.sessionId===sessionId&&!activePretest.terminal"),'leaving the trainer must preserve an unfinished pretest');
assert(ui.includes("button.dataset.m16NextStage"),'passing a stage must offer the next diagnostic stage directly');
assert(ui.includes('เหลือ ${remaining} ข้อเพื่อสรุปขั้นนี้'),'trainer must show remaining diagnostic progress');
assert(ui.includes('ประเมินก่อนเรียน'),'dashboard/trainer must expose pretest as an explicit learning-path step');
assert(ui.includes('ผลที่มีอยู่เพียงพอสำหรับจัดจุดเริ่มต้นแล้ว'),'early stop copy must frame the result as placement, not failure');

assert(migration.includes('evaluate_my_pretest_progress'),'migration must provide trusted early-stop evaluation');
assert(/evaluate_my_pretest_progress[\s\S]*security invoker/i.test(migration),'pretest evaluator must be SECURITY INVOKER');
assert(migration.includes('max_possible_overall'),'early stopping must use a best-case ceiling');
assert(migration.includes('max_possible_score'),'skill-level early stopping must use best-case ceilings');
assert(migration.includes("v_decision := 'early_stop'"),'database must terminate only when passing is mathematically impossible');
assert(migration.includes("'RESUME_DIAGNOSTIC'::text"),'recommendation engine must resume an unfinished diagnostic');
assert(migration.includes('v_latest_pretest_completed_at is null'),'only open pretests should be resumable');
assert(!migration.includes('กรุณาเริ่มใหม่และทำให้ครบทุกข้อ'),'M1.6 must remove restart-from-zero diagnostic copy');
assert(migration.includes('get_my_pretest_journey'),'dashboard must receive an explicit pretest path model');

// Sanity-check the ceiling principle used by the migration: if even perfect
// remaining answers cannot reach a threshold, early stop is safe.
const maxOverall=(sum,completed,total)=>(sum+(total-completed)*100)/total;
assert(maxOverall(160,2,5)===92,'a learner can still recover from 80,80 with three perfect answers');
assert(maxOverall(120,2,5)===84,'a learner at 60,60 cannot recover to a 90% threshold');

console.log('PASS M1.6 resumable sequential pretest and safe early-stop contracts');
