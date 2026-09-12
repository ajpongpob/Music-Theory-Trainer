'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const repository=read('src/data/practice.repository.js');
const client=read('src/data/supabase-client.js');
const migration=read('supabase/migrations/20260912_v093_authoritative_attempt_submission.sql');
const edge=read('supabase/functions/submit-major-scale-attempt/index.ts');

assert(/functions\.invoke\(['"]submit-major-scale-attempt['"]/.test(repository),'browser repository must invoke the server scoring function');
assert(!/\.from\(['"]attempts['"]\)[\s\S]{0,160}\.insert\(/.test(repository),'browser repository must not insert attempts directly');
assert(!/\.from\(['"]attempt_skill_results['"]\)[\s\S]{0,160}\.insert\(/.test(repository),'browser repository must not insert skill evidence directly');
assert(repository.includes('app_version: CURRENT_APP_VERSION'),'repository must own current app version provenance');
assert(/CURRENT_APP_VERSION\s*=\s*app\.appVersion\s*\|\|\s*['"]0\.9\.3['"]/.test(repository),'repository must use the centralized v0.9.3 version with a safe fallback');
assert(/APP_VERSION\s*=\s*['"]0\.9\.3['"]/.test(client),'central runtime version must be 0.9.3');
assert(client.includes('app.appVersion = APP_VERSION'),'runtime version must be exposed to repositories');

for(const statement of [
  'revoke insert on public.attempts from public,anon,authenticated',
  'revoke insert on public.attempt_skill_results from public,anon,authenticated',
  'revoke execute on function public.persist_scored_major_scale_attempt(uuid,uuid,integer,text,integer,jsonb,jsonb) from authenticated',
  'grant execute on function public.persist_scored_major_scale_attempt(uuid,uuid,integer,text,integer,jsonb,jsonb) to service_role'
]) assert(migration.toLowerCase().includes(statement),`missing security statement: ${statement}`);

assert(migration.includes("ssp.status in ('in_progress','mastered')"),'persistence RPC must verify Stage authorization');
assert(/sri\.item_code\s*=\s*p_item_code/.test(migration),'persistence RPC must verify item belongs to Stage');
assert(/p_question_number\s*<>\s*v_completed_questions\s*\+\s*1/.test(migration),'persistence RPC must enforce sequential immutable question slots');
assert(/jsonb_array_length\(sr\.evidence_flags\)\s*=\s*sr\.total_count/.test(migration),'persistence RPC must validate evidence shape');
assert(!/security\s+definer/i.test(migration),'internal persistence RPC must stay SECURITY INVOKER');

assert(edge.includes('scoreMajorScaleAttempt(itemCode,body?.response_json)'),'Edge Function must derive score from raw response');
assert(!/body\?\.score|body\.score/.test(edge),'Edge Function must not trust a client score');
assert(!/body\?\.skill_results|body\.skill_results/.test(edge),'Edge Function must not trust client skill evidence');
assert(edge.includes("claims?.role!=='authenticated'"),'Edge Function must require an authenticated learner token');
assert(edge.includes("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')"),'privileged key may exist only in the server function');

console.log('PASS authoritative attempt security: raw response only, server scoring, service-only persistence RPC, direct evidence INSERT revoked');
