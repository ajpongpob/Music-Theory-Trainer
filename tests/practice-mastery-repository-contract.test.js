'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const ROOT=path.resolve(__dirname,'..');
const calls=[];

function snapshot(state,terminal){calls.push(JSON.parse(JSON.stringify({...state,terminal})));}
function makeQuery(table){
  const state={type:'from',table,select:null,insert:null,update:null,eq:[],is:[],in:[],not:[],order:[],limit:null};
  const query={
    select(columns){state.select=columns;return query;},
    insert(payload){state.insert=payload;return query;},
    update(payload){state.update=payload;return query;},
    eq(column,value){state.eq.push([column,value]);return query;},
    is(column,value){state.is.push([column,value]);return query;},
    in(column,values){state.in.push([column,values]);return query;},
    not(column,operator,value){state.not.push([column,operator,value]);return query;},
    order(column,options){state.order.push([column,options]);return query;},
    limit(value){state.limit=value;return query;},
    single(){snapshot(state,'single');return Promise.resolve({data:{id:'row-1'},error:null});},
    maybeSingle(){snapshot(state,'maybeSingle');return Promise.resolve({data:{id:'row-1'},error:null});},
    then(resolve,reject){snapshot(state,'await');return Promise.resolve({data:[],error:null}).then(resolve,reject);}
  };
  return query;
}

const client={
  from(table){return makeQuery(table);},
  rpc(name,args){calls.push({type:'rpc',name,args:args||null,terminal:'rpc'});return Promise.resolve({data:[],error:null});},
  functions:{
    invoke(name,options){
      calls.push({type:'function',name,body:options?.body||null,terminal:'invoke'});
      return Promise.resolve({
        data:{
          attempt_id:'attempt-server-1',score:100,scoring_authority:'server',
          skill_results:[{skill_code:'BN01_TREBLE_PITCH',score:100}]
        },
        error:null
      });
    }
  }
};

const context={window:{MajorScaleApp:{supabaseClient:client}},console,Promise,Object,Error,Number,JSON};
context.globalThis=context.window;
vm.createContext(context);
for(const file of ['practice.repository.js','mastery.repository.js']){
  vm.runInContext(fs.readFileSync(path.join(ROOT,'src/data',file),'utf8'),context,{filename:file});
}
const normalize=value=>JSON.parse(JSON.stringify(value));
const {practiceRepository:practice,masteryRepository:mastery}=context.window.MajorScaleApp;
assert(practice&&mastery);
assert(Object.isFrozen(practice)&&Object.isFrozen(mastery));

(async()=>{
  await practice.getRequiredActiveExerciseByCode('EXERCISE_X');
  await practice.getRequiredActiveStageByCode('exercise-1','STAGE_X');
  await practice.createPracticeSession({user_id:'student-1',mode:'practice',app_version:'0.9.1'});
  await practice.getOpenPracticeSessions('student-1');
  await practice.closePracticeSession({sessionId:'session-1',completedAt:'T1',onlyIfOpen:false});
  await practice.closePracticeSession({sessionId:'session-2',completedAt:'T2',onlyIfOpen:true});

  const attempt=await practice.createAttempt({
    practice_session_id:'session-1',question_number:1,item_code:'C',score:13,
    response_json:{notes:[{letter:'C'}]}
  });
  assert.equal(attempt.error,null);
  assert.deepStrictEqual(normalize(attempt.data),{
    id:'attempt-server-1',score:100,
    skill_results:[{skill_code:'BN01_TREBLE_PITCH',score:100}],
    scoring_authority:'server'
  });
  const compatibility=await practice.createAttemptSkillResults([{attempt_id:'attempt-server-1',score:0}]);
  assert.equal(compatibility.error,null);
  assert.equal(compatibility.data.length,1);

  await practice.updatePracticeSession('session-1',{completed_questions:1});
  await mastery.getOptionalActiveExerciseByCode('EXERCISE_X');
  await mastery.getActiveStagesForExercise('exercise-1');
  await mastery.getInProgressStageProgress('student-1',['stage-1','stage-2']);
  await mastery.getRequiredStageItems('stage-1');
  await mastery.getPracticeSessionsForStage({userId:'student-1',exerciseId:'exercise-1',stageId:'stage-1'});
  await mastery.getRecentAttemptItems(['session-1','session-2'],10);
  await mastery.getStageMastery({exerciseCode:'EXERCISE_X',stageCode:'STAGE_X'});
  await mastery.advanceStageIfMastered({exerciseCode:'EXERCISE_X',stageCode:'STAGE_X'});

  const expected=[
    {type:'from',table:'exercises',select:'id',insert:null,update:null,eq:[['code','EXERCISE_X'],['active',true]],is:[],in:[],not:[],order:[],limit:null,terminal:'single'},
    {type:'from',table:'exercise_stages',select:'id',insert:null,update:null,eq:[['exercise_id','exercise-1'],['code','STAGE_X'],['active',true]],is:[],in:[],not:[],order:[],limit:null,terminal:'single'},
    {type:'from',table:'practice_sessions',select:'id',insert:{user_id:'student-1',mode:'practice',app_version:'0.9.3'},update:null,eq:[],is:[],in:[],not:[],order:[],limit:null,terminal:'single'},
    {type:'from',table:'practice_sessions',select:'id,started_at,last_activity_at',insert:null,update:null,eq:[['user_id','student-1'],['mode','practice']],is:[['completed_at',null]],in:[],not:[],order:[],limit:null,terminal:'await'},
    {type:'from',table:'practice_sessions',select:null,insert:null,update:{completed_at:'T1'},eq:[['id','session-1']],is:[],in:[],not:[],order:[],limit:null,terminal:'await'},
    {type:'from',table:'practice_sessions',select:null,insert:null,update:{completed_at:'T2'},eq:[['id','session-2']],is:[['completed_at',null]],in:[],not:[],order:[],limit:null,terminal:'await'},
    {type:'function',name:'submit-major-scale-attempt',body:{practice_session_id:'session-1',question_number:1,item_code:'C',response_json:{notes:[{letter:'C'}]}},terminal:'invoke'},
    {type:'from',table:'practice_sessions',select:null,insert:null,update:{completed_questions:1},eq:[['id','session-1']],is:[],in:[],not:[],order:[],limit:null,terminal:'await'},
    {type:'from',table:'exercises',select:'id',insert:null,update:null,eq:[['code','EXERCISE_X'],['active',true]],is:[],in:[],not:[],order:[],limit:null,terminal:'maybeSingle'},
    {type:'from',table:'exercise_stages',select:'id,code',insert:null,update:null,eq:[['exercise_id','exercise-1'],['active',true]],is:[],in:[],not:[],order:[],limit:null,terminal:'await'},
    {type:'from',table:'student_stage_progress',select:'stage_id,status',insert:null,update:null,eq:[['user_id','student-1'],['status','in_progress']],is:[],in:[['stage_id',['stage-1','stage-2']]],not:[],order:[],limit:null,terminal:'await'},
    {type:'from',table:'stage_required_items',select:'item_code,sequence_order',insert:null,update:null,eq:[['stage_id','stage-1'],['active',true]],is:[],in:[],not:[],order:[['sequence_order',{ascending:true}]],limit:null,terminal:'await'},
    {type:'from',table:'practice_sessions',select:'id',insert:null,update:null,eq:[['user_id','student-1'],['mode','practice'],['exercise_id','exercise-1'],['stage_id','stage-1']],is:[],in:[],not:[],order:[],limit:null,terminal:'await'},
    {type:'from',table:'attempts',select:'item_code,checked_at',insert:null,update:null,eq:[],is:[],in:[['practice_session_id',['session-1','session-2']]],not:[['item_code','is',null]],order:[['checked_at',{ascending:false}]],limit:10,terminal:'await'},
    {type:'rpc',name:'get_my_stage_mastery',args:{p_exercise_code:'EXERCISE_X',p_stage_code:'STAGE_X'},terminal:'rpc'},
    {type:'rpc',name:'advance_my_stage_if_mastered',args:{p_exercise_code:'EXERCISE_X',p_stage_code:'STAGE_X'},terminal:'rpc'}
  ];
  assert.deepStrictEqual(normalize(calls),expected);
  assert(!calls.some(call=>call.type==='from'&&['attempts','attempt_skill_results'].includes(call.table)&&call.insert!==null),'browser repository must never insert evidence tables');
  console.log('PASS practice/mastery repository contract: app_version 0.9.3, server scoring Edge Function, no client evidence inserts');
})().catch(error=>{console.error(error);process.exitCode=1;});
