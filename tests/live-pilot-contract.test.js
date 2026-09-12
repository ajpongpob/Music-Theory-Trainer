'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..');
const live=fs.readFileSync(path.join(root,'tests/live-pilot.browser.cjs'),'utf8');
const dashboardMastery=fs.readFileSync(path.join(root,'tests/live-dashboard-mastery.browser.cjs'),'utf8');
const workflow=fs.readFileSync(path.join(root,'.github/workflows/live-pilot.yml'),'utf8');

assert(live.includes("LIVE_TEST_CONFIRM=YES"),'live suite must require an explicit destructive-test guard');
assert(live.includes('QA_STUDENT_EMAIL')&&live.includes('QA_STUDENT_PASSWORD'),'live suite must require dedicated QA student credentials');
assert(live.includes('waitForLearningPathStageLock'),'live suite must wait for asynchronous Learning Path Stage authority before asserting the lock');
assert(live.includes("select.disabled===true"),'live suite must wait for the actual disabled Stage/Level state');
assert(live.includes("scoring_authority,'server'"),'live suite must assert server-authoritative scoring');
assert(live.includes('directly insert attempts'),'live suite must assert direct attempt INSERT denial');
assert(live.includes('directly insert attempt_skill_results'),'live suite must assert direct skill INSERT denial');
assert(live.includes("app_version,'0.9.3'"),'live suite must assert release provenance');
assert(live.includes('immutable attempt id'),'live suite must cover idempotent retry behavior');
assert(live.includes('getStageMastery'),'live suite must verify that Mastery sees trusted evidence');
assert(live.includes('logoutFromStudent'),'live suite must cover logout/login recovery');
assert(live.includes('teacherSmoke'),'live suite must support Teacher Dashboard verification');

assert(workflow.includes('node tests/live-dashboard-mastery.browser.cjs'),'Live Pilot QA workflow must include the learner-facing Dashboard Mastery gate');
assert(dashboardMastery.includes("LIVE_TEST_CONFIRM=YES"),'Dashboard Mastery live gate must require the explicit live-test guard');
assert(dashboardMastery.includes('dashboardMasteryBody'),'Dashboard Mastery live gate must inspect the learner-facing Mastery panel');
assert(dashboardMastery.includes('โหลดผลการเรียนไม่สำเร็จ'),'Dashboard Mastery live gate must reject the learner-facing load-error state');
assert(/get_my_stage_mastery\|blocked by CORS\|Failed to fetch/i.test(dashboardMastery),'Dashboard Mastery live gate must detect Mastery transport/CORS failures');
assert(dashboardMastery.includes('page.reload'),'Dashboard Mastery live gate must verify reload recovery');

for(const source of [live,dashboardMastery]){
  assert(!/SUPABASE_SERVICE_ROLE_KEY\s*=/.test(source),'live browser suites must never embed a service-role secret');
  assert(!/['\"]eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./.test(source),'live browser suites must not hardcode JWT-like credentials');
}

console.log('PASS M1.1 live-pilot contract: guarded QA account, async Stage authority, trusted evidence, RLS denial, persistence, mastery, teacher verification and learner-facing Dashboard Mastery gate');
