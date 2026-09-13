'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..'),read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const teacher=read('src/dashboard/teacher-dashboard.js');
const repo=read('src/data/dashboard.repository.js');
const trainer=read('src/trainer.js');
const core=read('src/domain/mastery/mastery-learning-core.js');
const css=read('styles/teacher-dashboard-v2.css');

for(const marker of [
  "const ALL_CLASSES='__ALL__'",
  'data-teacher-search',
  'data-teacher-stage-filter',
  'data-teacher-status-filter',
  'data-teacher-sort="mastery"',
  'data-teacher-student',
  'Class Learning Overview',
  'Needs Attention',
  'Teaching Tools',
  "sessionMode:'teacher_demo'",
  'createTeacherClass',
  'addStudentToTeacherClass'
]) assert(teacher.includes(marker), 'Teacher Dashboard V2 missing '+marker);

assert(repo.includes("rpc('create_my_class'"),'class creation must use secured RPC');
assert(repo.includes("rpc('add_student_to_my_class'"),'student enrollment must use secured RPC');
assert(repo.includes('getTeacherClassDashboards'),'All Classes repository aggregator missing');
assert(!teacher.includes('.from(') && !teacher.includes('.rpc('),'teacher UI must not directly query Supabase');

assert(core.includes("'teacher_demo'"),'teacher_demo must be an explicit session mode');
assert(/if\(state\.sessionMode===["']teacher_demo["']\)\{[\s\S]{0,120}return null;/.test(trainer),'teacher demo must skip practice session creation');
assert(/if\(state\.sessionMode===["']teacher_demo["']\)\{[\s\S]{0,220}teacherDemo:true/.test(trainer),'teacher demo must skip attempt persistence');
assert(trainer.includes('ไม่บันทึกความก้าวหน้า'),'teacher demo must disclose non-persistent behavior');

assert(css.includes('.teacher-student-table'),'teacher table styling missing');
assert(css.includes('@media (max-width:620px)'),'mobile teacher layout missing');
assert(css.includes('.teacher-student-table thead{display:none}'),'mobile rows should avoid desktop horizontal table UX');

console.log('PASS Teacher Dashboard V2: all-class analytics, sortable learner list, learner detail, class management, and non-persistent teaching tools contracts');
