'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const calls = [];

function makeQuery(table) {
  const state = {table, select: null, eq: []};
  const query = {
    select(columns) { state.select = columns; return query; },
    eq(column, value) { state.eq.push([column, value]); return query; },
    maybeSingle() { calls.push({type: 'from', ...state, maybeSingle: true}); return Promise.resolve({data: {}, error: null}); },
    then(resolve, reject) { calls.push({type: 'from', ...state, maybeSingle: false}); return Promise.resolve({data: [], error: null}).then(resolve, reject); }
  };
  return query;
}

const client = {
  rpc(name, args) {
    calls.push({type: 'rpc', name, args: args || null});
    return Promise.resolve({data: [], error: null});
  },
  from(table) {
    return makeQuery(table);
  }
};

const context = {
  window: {MajorScaleApp: {supabaseClient: client}},
  console,
  Promise,
  Object,
  Error
};
context.globalThis = context.window;
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(path.join(ROOT, 'src/data/dashboard.repository.js'), 'utf8'),
  context,
  {filename: 'dashboard.repository.js'}
);

const normalize = value => JSON.parse(JSON.stringify(value));

const repo = context.window.MajorScaleApp.dashboardRepository;
assert(repo, 'dashboardRepository should be registered');
assert(Object.isFrozen(repo), 'dashboardRepository should be frozen');

(async () => {
  await repo.getStudentDashboard();
  await repo.getStageMastery({exerciseCode: 'EXERCISE_X', stageCode: 'STAGE_X'});
  await repo.getStudentProfile('student-1');
  await repo.getActiveSkills();
  await repo.getTeacherDashboard();
  await repo.getTeacherProfile('teacher-1');
  await repo.getTeacherClassDashboard('class-1');

  assert.deepStrictEqual(normalize(calls[0]), {
    type: 'rpc', name: 'get_my_student_dashboard', args: null
  });
  assert.deepStrictEqual(normalize(calls[1]), {
    type: 'rpc',
    name: 'get_my_stage_mastery',
    args: {p_exercise_code: 'EXERCISE_X', p_stage_code: 'STAGE_X'}
  });
  assert.deepStrictEqual(normalize(calls[2]), {
    type: 'from', table: 'profiles', select: 'full_name', eq: [['id', 'student-1']], maybeSingle: true
  });
  assert.deepStrictEqual(normalize(calls[3]), {
    type: 'from', table: 'skills', select: 'code,short_name,name_th', eq: [['active', true]], maybeSingle: false
  });
  assert.deepStrictEqual(normalize(calls[4]), {
    type: 'rpc', name: 'get_my_teacher_dashboard', args: null
  });
  assert.deepStrictEqual(normalize(calls[5]), {
    type: 'from', table: 'profiles', select: 'full_name,role', eq: [['id', 'teacher-1']], maybeSingle: true
  });
  assert.deepStrictEqual(normalize(calls[6]), {
    type: 'rpc', name: 'get_my_teacher_class_dashboard', args: {p_class_id: 'class-1'}
  });

  console.log('PASS dashboard repository contract (7 operations)');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
