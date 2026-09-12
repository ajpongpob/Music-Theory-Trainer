'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const repository=read('src/data/practice.repository.js');
const migration=read('supabase/migrations/20260912_v093_authoritative_attempt_submission.sql');
const edge=read('supabase/functions/submit-major-scale-attempt/index.ts');

assert(repository.includes("functions.invoke(\n      'submit-major-scale-attempt'"),'browser repository must invoke the server scoring function');
assert(!/\.from\(['"]attempts['"]\)[\s\S]{0,160}\.insert\(/.test(repository),'browser repository must not insert attempts directly');
assert(!/\.from\(['"]attempt_skill_results['"]\)[\s\S]{0,160}\.insert\(/.test(repository),'browser repository must not insert skill evidence directly');
assert(repository.includes("app_version: CURRENT_APP_VERSION"),'repository must own current app version provenance');
assert(repository.includes("CURRENT_APP_VERSION = '0.9.3'"),'current release version must be 0.9.3');

for(const statement of [
  'revoke insert on public.attempts from public,anon,authenticated',
  'revoke insert on public.attempt_skill_results from public,anon,authenticated',
  'revoke execute on function public.persist_scored_major_scale_attempt(uuid,uuid,integer,text,integer,jsonb,jsonb) from authenticated',
  'grant execute on function public.persist_scored_major_scale_attempt(uuid,uuid,integer,text,integer,jsonb,jsonb) to service_role'
]) assert(migration.toLowerCase().includes(statement),`missing security statement: ${statement}`);

assert(migration.includes("ssp.status in ('in_progress','mastered')"),'persistence RPC must verify Stage authorization');
assert(migration.includes('sri.item_code=p_item_code'),'persistence RPC must verify item belongs to Stage');
assert(migration.includes('p_question_number <> v_completed_questions + 1'),'persistence RPC must enforce sequential immutable question slots');
assert(migration.includes('jsonb_array_length(evidence_flags)=total_count'),'persistence RPC must validate evidence shape');
assert(!migration.match(/security\s+definer/i),'internal persistence RPC must stay SECURITY INVOKER');

assert(edge.includes('scoreMajorScaleAttempt(itemCode,body?.response_json)'),'Edge Function must derive score from raw response');
assert(!/body\?\.score|body\.score/.test(edge),'Edge Function must not trust a client score');
assert(!/body\?\.skill_results|body\.skill_results/.test(edge),'Edge Function must not trust client skill evidence');
assert(edge.includes("claims?.role!=='authenticated'"),'Edge Function must require an authenticated learner token');
assert(edge.includes("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')"),'privileged key may exist only in the server function');

console.log('PASS authoritative attempt security: raw response only, server scoring, service-only persistence RPC, direct evidence INSERT revoked');
