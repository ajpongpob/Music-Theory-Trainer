'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const calls = [];

const rowsByTable = {
  practice_sessions: [
    {id:'session-1',mode:'practice',planned_questions:5,completed_questions:5,overall_score:84,started_at:'2026-09-12T10:00:00Z',exercise_id:'exercise-1',stage_id:'stage-2'}
  ],
  attempts: [
    {id:'attempt-1',practice_session_id:'session-1',question_number:1,score:80,item_code:'C'}
  ],
  attempt_skill_results: [
    {attempt_id:'attempt-1',skill_code:'BN01_TREBLE_PITCH',correct_count:14,total_count:15,score:93}
  ]
};

function makeQuery(table) {
  const state = {table, select: null, selectOptions: null, eq: [], in: [], order: [], limit: null};
  const query = {
    select(columns, options) { state.select = columns; state.selectOptions = options || null; return query; },
    eq(column, value) { state.eq.push([column, value]); return query; },
    in(column, values) { state.in.push([column, values]); return query; },
    order(column, options) { state.order.push([column, options || null]); return query; },
    limit(value) { state.limit = value; return query; },
    maybeSingle() { calls.push({type: 'from', ...state, maybeSingle: true}); return Promise.resolve({data: {}, error: null}); },
    then(resolve, reject) {
      calls.push({type: 'from', ...state, maybeSingle: false});
      const data = state.selectOptions?.head ? null : (rowsByTable[table] || []);
      const count = state.selectOptions?.count === 'exact' ? (table === 'practice_sessions' ? 12 : null) : null;
      return Promise.resolve({data, count, error: null}).then(resolve, reject);
    }
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
  window: {MajorScaleApp: {supabaseClient: client}, addEventListener(){}},
  document: undefined,
  console,
  Promise,
  Object,
  Error,
  Number,
  Math,
  Array
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
    type: 'from', table: 'profiles', select: 'first_name,last_name,full_name', selectOptions: null, eq: [['id', 'student-1']], in: [], order: [], limit: null, maybeSingle: true
  });
  assert.deepStrictEqual(normalize(calls[3]), {
    type: 'from', table: 'skills', select: 'code,short_name,name_th', selectOptions: null, eq: [['active', true]], in: [], order: [], limit: null, maybeSingle: false
  });
  assert.deepStrictEqual(normalize(calls[4]), {
    type: 'rpc', name: 'get_my_teacher_dashboard', args: null
  });
  assert.deepStrictEqual(normalize(calls[5]), {
    type: 'from', table: 'profiles', select: 'first_name,last_name,full_name,role', selectOptions: null, eq: [['id', 'teacher-1']], in: [], order: [], limit: null, maybeSingle: true
  });
  assert.deepStrictEqual(normalize(calls[6]), {
    type: 'rpc', name: 'get_my_teacher_class_dashboard', args: {p_class_id: 'class-1'}
  });

  const history = await repo.getStudentLearningHistory({limit: 40});
  assert.ifError(history.error);
  assert.equal(history.data.totalPracticeSessions, 12, 'history should use exact practice session count');
  assert.equal(history.data.sessions.length, 1);
  assert.equal(history.data.attempts.length, 1);
  assert.equal(history.data.skillResults.length, 1);

  const historyCalls=normalize(calls.slice(7));
  const sessionRead=historyCalls.find(call=>call.table==='practice_sessions' && call.select?.includes('overall_score'));
  const countRead=historyCalls.find(call=>call.table==='practice_sessions' && call.selectOptions?.head===true);
  const attemptRead=historyCalls.find(call=>call.table==='attempts');
  const skillRead=historyCalls.find(call=>call.table==='attempt_skill_results');
  assert(sessionRead, 'history should read recent own practice_sessions');
  assert.deepStrictEqual(sessionRead.order,[['started_at',{ascending:false}]]);
  assert.equal(sessionRead.limit,40);
  assert(countRead, 'history should request exact practice session count');
  assert.deepStrictEqual(countRead.eq,[['mode','practice']]);
  assert(attemptRead && attemptRead.in[0][0]==='practice_session_id', 'history should read attempts by visible session ids');
  assert(skillRead && skillRead.in[0][0]==='attempt_id', 'history should read skill evidence by visible attempt ids');

  const beforeCachedReads=calls.length;
  await Promise.all([
    repo.getStudentDashboard(),
    repo.getStudentDashboard(),
    repo.getStageMastery({exerciseCode:'EXERCISE_X',stageCode:'STAGE_X'}),
    repo.getActiveSkills()
  ]);
  assert.equal(calls.length,beforeCachedReads,'Repeated dashboard metadata reads should reuse the recent response');

  const beforeTeacherWrites=calls.length;
  await repo.createTeacherClass({code:'MUS101-01',name:'Music Theory I',academicYear:'2569',term:'1'});
  await repo.addStudentToTeacherClass({classId:'class-1',email:'student@example.com'});
  const multi=await repo.getTeacherClassDashboards(['class-1','class-2','class-1']);
  assert.ifError(multi.error);
  assert.equal(multi.data.length,2,'multi-class read should de-duplicate class ids');
  const teacherCalls=normalize(calls.slice(beforeTeacherWrites));
  assert.deepStrictEqual(teacherCalls[0],{
    type:'rpc',name:'create_my_class',
    args:{p_code:'MUS101-01',p_name:'Music Theory I',p_academic_year:'2569',p_term:'1'}
  });
  assert.deepStrictEqual(teacherCalls[1],{
    type:'rpc',name:'add_student_to_my_class',
    args:{p_class_id:'class-1',p_student_email:'student@example.com'}
  });
  assert.equal(teacherCalls.filter(call=>call.name==='get_my_teacher_class_dashboard').length,2,'All Classes aggregation should use authorized class dashboard RPC once per class');

  console.log('PASS dashboard repository contract + structured profile reads + RLS-safe student learning history reads + Teacher Dashboard V2 operations');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
