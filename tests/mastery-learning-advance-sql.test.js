'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20260912_v090_generic_stage_advancement.sql'),'utf8');
assert(sql.includes('create or replace function public.advance_my_stage_if_mastered'));
assert(sql.includes('es.sequence_order>v_current_sequence'),'next stage must be selected by sequence order');
assert(sql.includes('order by es.sequence_order,es.id limit 1'));
assert(sql.includes('ensure_my_learning_path_progression()'),'exercise completion must resync generic path progression');
assert(!sql.includes('STAGE_4'),'advancement must not hardcode the final stage');
console.log('PASS generic stage advancement SQL: sequence-driven and path-synchronized');
