'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

const ui=read('src/m16-pretest-flow.js');
const learning=read('src/data/learning.repository.js');
const dashboard=read('src/data/dashboard.repository.js');
const core=read('src/domain/mastery/mastery-learning-core.js');
const migration=read('supabase/migrations/20260912172210_m16_pretest_resume_early_stop.sql');

// Historical M1.6 implementation and authoritative RPC contracts remain in the
// repository so past evidence is readable and the migration history stays
// reproducible. The current learner-facing application must not load or route
// into this retired pretest flow.
assert(learning.includes('evaluatePretestProgress(sessionId)'),'historical learning repository must retain authoritative pretest evaluation access');
assert(learning.includes("rpc('evaluate_my_pretest_progress'"),'historical pretest evaluation remains database-authoritative');
assert(dashboard.includes('getPretestJourney(exerciseCode)'),'historical dashboard repository access remains available for old records');
assert(!dashboard.includes('m16-pretest-flow.js'),'retired M1.6 UI layer must not load in the current learner flow');
assert(core.includes('const PRETEST_ENABLED=false'),'current mastery core must explicitly keep pretest disabled');
assert(core.includes("return 'practice';"),'legacy session modes must fall back to practice');

// Preserve historical M1.6 implementation contracts without activating them.
assert(ui.includes("row.mode!=='pretest'"),'historical stale-session cleanup contract must remain reproducible');
assert(ui.includes('getRequiredStageItems(stageId)'),'historical resume logic must remain reproducible');
assert(ui.includes('adjusted.question_number=Number(payload.question_number||0)+activePretest.offset'),'historical attempt numbering contract must remain reproducible');
assert(ui.includes("activePretest?.sessionId===sessionId&&!activePretest.terminal"),'historical unfinished-session behavior must remain reproducible');
assert(ui.includes("button.dataset.m16NextStage"),'historical next-stage behavior must remain reproducible');
assert(ui.includes('เหลือ ${remaining} ข้อเพื่อสรุปขั้นนี้'),'historical diagnostic progress copy must remain reproducible');
assert(ui.includes('ประเมินก่อนเรียน'),'historical pretest copy may remain in the archived implementation');
assert(ui.includes('ผลที่มีอยู่เพียงพอสำหรับจัดจุดเริ่มต้นแล้ว'),'historical early-stop placement copy must remain reproducible');

assert(migration.includes('evaluate_my_pretest_progress'),'migration history must retain trusted early-stop evaluation');
assert(/evaluate_my_pretest_progress[\s\S]*security invoker/i.test(migration),'historical pretest evaluator must remain SECURITY INVOKER');
assert(migration.includes('max_possible_overall'),'historical early stopping used a best-case ceiling');
assert(migration.includes('max_possible_score'),'historical skill-level early stopping used best-case ceilings');
assert(migration.includes("v_decision := 'early_stop'"),'historical database rule terminated only when passing was mathematically impossible');
assert(migration.includes("'RESUME_DIAGNOSTIC'::text"),'migration history must preserve the former resume rule');
assert(migration.includes('v_latest_pretest_completed_at is null'),'migration history must preserve former open-pretest detection');
assert(!migration.includes('กรุณาเริ่มใหม่และทำให้ครบทุกข้อ'),'historical M1.6 removed restart-from-zero diagnostic copy');
assert(migration.includes('get_my_pretest_journey'),'migration history must preserve the former pretest path model');

// Sanity-check the historical ceiling principle retained in migration history.
const maxOverall=(sum,completed,total)=>(sum+(total-completed)*100)/total;
assert(maxOverall(160,2,5)===92,'a learner can still recover from 80,80 with three perfect answers');
assert(maxOverall(120,2,5)===84,'a learner at 60,60 cannot recover to a 90% threshold');

console.log('PASS M1.6 historical contracts retained while current pretest UI/route stays disabled');
