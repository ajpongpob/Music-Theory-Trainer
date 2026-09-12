'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..');
const live=fs.readFileSync(path.join(root,'tests/live-pilot.browser.cjs'),'utf8');

assert(live.includes("LIVE_TEST_CONFIRM=YES"),'live suite must require an explicit destructive-test guard');
assert(live.includes('QA_STUDENT_EMAIL')&&live.includes('QA_STUDENT_PASSWORD'),'live suite must require dedicated QA student credentials');
assert(live.includes("scoring_authority,'server'"),'live suite must assert server-authoritative scoring');
assert(live.includes('directly insert attempts'),'live suite must assert direct attempt INSERT denial');
assert(live.includes('directly insert attempt_skill_results'),'live suite must assert direct skill INSERT denial');
assert(live.includes("app_version,'0.9.3'"),'live suite must assert release provenance');
assert(live.includes('immutable attempt id'),'live suite must cover idempotent retry behavior');
assert(live.includes('getStageMastery'),'live suite must verify that Mastery sees trusted evidence');
assert(live.includes('logoutFromStudent'),'live suite must cover logout/login recovery');
assert(live.includes('teacherSmoke'),'live suite must support Teacher Dashboard verification');
assert(!/SUPABASE_SERVICE_ROLE_KEY\s*=/.test(live),'live browser suite must never embed a service-role secret');
assert(!/['\"]eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./.test(live),'live suite must not hardcode JWT-like credentials');
console.log('PASS M1.1 live-pilot contract: guarded QA account, live server evidence, RLS denial, persistence, mastery and optional teacher verification');
