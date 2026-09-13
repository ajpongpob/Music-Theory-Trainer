'use strict';

const fs=require('fs');
const path=require('path');
const assert=require('assert');

const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const authRepo=read('src/data/auth.repository.js');
const authUi=read('src/auth-dashboard.js');
const migration=read('supabase/migrations/20260913121500_profile_onboarding_state.sql');

for(const field of ['full_name','student_id','program','year_level']){
  assert(authUi.includes(`name=\"${field}\"`) || authUi.includes(`name="${field}"`),`onboarding UI missing ${field}`);
  assert(migration.includes(`new.${field}`),`completion trigger missing ${field}`);
}
assert(authUi.includes('profileOnboardingPanel'),'onboarding panel missing');
assert(authUi.includes('profileOnboardingSaveButton'),'onboarding save action missing');
assert(authUi.includes('profileOnboardingLogoutButton'),'onboarding must allow sign-out without bypassing completion');
assert(authUi.includes('data?.onboarding_completed_at') || authUi.includes('data.onboarding_completed_at'),'authenticated routing must gate incomplete new profiles');
assert(authUi.includes("currentUserRole==='teacher' || currentUserRole==='admin'"),'teacher/admin routing must bypass learner onboarding');
assert(authUi.includes('metadata.avatar_url') && authUi.includes('metadata.picture'),'Google avatar metadata should be preserved when available');
assert(authUi.includes('authProviderLabel(user)'),'onboarding must show the authentication provider');

assert(authRepo.includes('getRegistrationProfile(userId)'),'auth repository missing onboarding read');
assert(authRepo.includes('updateRegistrationProfile({userId'),'auth repository missing onboarding update');
assert(authRepo.includes('onboarding_completed_at'),'auth repository must read server completion state');
assert(!/service[_-]?role/i.test(authRepo),'browser auth repository must not contain service-role credentials');

assert(migration.includes('add column if not exists onboarding_completed_at timestamptz'),'migration missing onboarding state');
assert(migration.includes('set onboarding_completed_at = coalesce(onboarding_completed_at, now())'),'existing profiles must be grandfathered');
assert(migration.includes("new.role = 'student'"),'completion trigger must apply to student profiles');
assert(migration.includes('new.onboarding_completed_at := now()'),'completion timestamp must be server-generated');
assert(/before update of full_name, student_id, program, year_level/.test(migration),'trigger must run only on required profile field updates');

console.log('PASS profile onboarding contract: required learner fields, server completion gate, Google/email shared flow, existing-account grandfathering and role-safe routing');
