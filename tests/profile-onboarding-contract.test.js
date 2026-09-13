'use strict';

const fs=require('fs');
const path=require('path');
const assert=require('assert');

const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const authRepo=read('src/data/auth.repository.js');
const authUi=read('src/auth-dashboard.js');
const profileUi=read('src/profile-onboarding-v2.js');
const onboardingMigration=read('supabase/migrations/20260913121500_profile_onboarding_state.sql');
const structuredMigration=read('supabase/migrations/20260913_profile_structured_names.sql');
const grantsMigration=read('supabase/migrations/20260913_profile_structured_name_grants.sql');

assert(authUi.includes('profileOnboardingPanel'),'onboarding panel missing');
assert(authUi.includes('profileOnboardingSaveButton'),'onboarding save action missing');
assert(authUi.includes('profileOnboardingLogoutButton'),'onboarding must allow sign-out without bypassing completion');
assert(authUi.includes('data?.onboarding_completed_at') || authUi.includes('data.onboarding_completed_at'),'authenticated routing must gate incomplete new profiles');
assert(authUi.includes("currentUserRole==='teacher' || currentUserRole==='admin'"),'teacher/admin routing must bypass learner onboarding');
assert(authUi.includes('metadata.avatar_url') && authUi.includes('metadata.picture'),'Google avatar metadata should be preserved when available');
assert(authUi.includes('authProviderLabel(user)'),'onboarding must show the authentication provider');

for(const field of ['first_name','last_name','nickname','student_id','program']){
  assert(authRepo.includes(field),`auth repository missing structured field ${field}`);
  assert(structuredMigration.includes(field),`structured profile migration missing ${field}`);
}
assert(authRepo.includes('getRegistrationProfile(userId)'),'auth repository missing onboarding read');
assert(authRepo.includes('updateRegistrationProfile({userId'),'auth repository missing onboarding update');
assert(authRepo.includes('onboarding_completed_at'),'auth repository must read server completion state');
assert(!/service[_-]?role/i.test(authRepo),'browser auth repository must not contain service-role credentials');

assert(profileUi.includes("fullLabel.textContent='ชื่อ *'"),'onboarding must label given name as ชื่อ');
assert(profileUi.includes("labelText:'นามสกุล *'"),'onboarding must include required surname');
assert(profileUi.includes("displayLabel.textContent='ชื่อเล่น'"),'display-name field must be presented as ชื่อเล่น');
assert(profileUi.includes("yearField?.classList.add('profile-v2-hidden')"),'year level must be hidden from onboarding');
assert(profileUi.includes("sectionInput.closest('.auth-field')?.classList.add('profile-v2-hidden')"),'section must be hidden from onboarding');
assert(profileUi.includes('min-width:190px') && profileUi.includes('white-space:nowrap'),'save button must remain wide enough for a single-line label');

assert(onboardingMigration.includes('add column if not exists onboarding_completed_at timestamptz'),'base migration missing onboarding state');
assert(onboardingMigration.includes('set onboarding_completed_at = coalesce(onboarding_completed_at, now())'),'existing profiles must be grandfathered');
assert(structuredMigration.includes("new.role = 'student'"),'completion trigger must apply to student profiles');
assert(structuredMigration.includes('new.first_name') && structuredMigration.includes('new.last_name'),'completion trigger must require structured first and last name');
assert(structuredMigration.includes('new.student_id') && structuredMigration.includes('new.program'),'completion trigger must require student id and program');
assert(!/new\.year_level[\s\S]{0,500}onboarding_completed_at := now\(\)/.test(structuredMigration),'year level must not be required for onboarding completion');
assert(!/new\.section[\s\S]{0,500}onboarding_completed_at := now\(\)/.test(structuredMigration),'section must not be required for onboarding completion');
assert(grantsMigration.includes('grant update (first_name, last_name, nickname)'),'authenticated learners must be able to update structured names');
assert(grantsMigration.includes('revoke update (year_level, section)'),'deprecated year/section fields must not remain client-editable');

console.log('PASS profile onboarding contract: split first/last name, nickname, student id/program only, simplified completion gate and usable save action');
