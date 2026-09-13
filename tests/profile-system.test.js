'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const repo=read('src/data/dashboard.repository.js');
const student=read('src/dashboard/student-dashboard-v2.js');
const teacher=read('src/dashboard/teacher-dashboard.js');
const profileUi=read('src/profile-onboarding-v2.js');
const legacyMigration=read('supabase/migrations/20260913110000_profile_system.sql');
const structuredMigration=read('supabase/migrations/20260913_profile_structured_names.sql');
const grantsMigration=read('supabase/migrations/20260913_profile_structured_name_grants.sql');

for(const field of ['first_name','last_name','nickname']) assert(structuredMigration.includes(field),`structured migration must add ${field}`);
for(const field of ['student_id','program','avatar_url']) assert(legacyMigration.includes(field),`base profile migration must retain ${field}`);
assert(legacyMigration.includes('revoke update on public.profiles from anon, authenticated'));
assert(grantsMigration.includes('grant update (first_name, last_name, nickname)'));
assert(grantsMigration.includes('revoke update (year_level, section)'));
assert(legacyMigration.includes("teacher.membership_role = 'teacher'"));
assert(legacyMigration.includes('target.user_id = profiles.id'));

assert(repo.includes('updateStudentProfile'));
assert(repo.includes('getTeacherStudentProfile'));
assert(repo.includes('first_name,last_name,nickname,full_name,display_name,student_id,program,avatar_url'));
assert(repo.includes('first_name: firstName') && repo.includes('last_name: lastName') && repo.includes('nickname: displayName || null'));
assert(!/updateStudentProfile\([\s\S]{0,1800}year_level:/.test(repo),'current dashboard profile update must not write year_level');
assert(!/updateStudentProfile\([\s\S]{0,1800}section:/.test(repo),'current dashboard profile update must not write section');

assert(student.includes('id="sd2ProfileForm"'));
assert(student.includes('repo.updateStudentProfile'));
assert(profileUi.includes("fullInput.name='first_name'"));
assert(profileUi.includes("lastInput.name='last_name'"));
assert(profileUi.includes("node.textContent='ชื่อเล่น'"));
assert(profileUi.includes("for(const obsoleteName of ['year_level','section'])"));
assert(!student.match(/updateStudentProfile[\s\S]{0,1500}role/), 'student update payload must not include role');
assert(teacher.includes('getTeacherStudentProfile'));
assert(teacher.includes('teacher-profile-summary'));
assert(teacher.includes('Learning Progress'));
assert(profileUi.includes("if(label==='Section') row.remove()"),'teacher profile summary must omit section');

console.log('PASS profile system contract: structured first/last name + nickname, retained student id/program, deprecated year/section, teacher detail boundary');
