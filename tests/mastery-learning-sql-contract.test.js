'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20260912_v090_mastery_learning_core.sql'),'utf8');
for(const token of ['stage_mastery_rules','stage_skill_requirements','stage_required_items','path_exercises','sequence_order','get_my_stage_evidence','get_my_exercise_diagnostic','apply_my_diagnostic_placement','get_my_recommended_next_action','ensure_my_learning_path_progression']) assert(sql.includes(token),token);
assert(!/STAGE_4|=s*4s*(?:;|then)/.test(sql),'generic progression must not assume exactly four stages');
assert(sql.includes("p_mode text default 'practice'"));assert(sql.includes("'pretest'"));
assert(sql.includes('revoke execute on function public.get_my_stage_evidence(text,text,text,boolean) from anon'));
console.log('PASS mastery learning SQL contract: configurable rules, diagnostic, generic sequence progression, recommendations, authenticated-only RPCs');
