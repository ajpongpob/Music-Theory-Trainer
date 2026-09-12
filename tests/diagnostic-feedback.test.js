'use strict';

const fs=require('fs');
const path=require('path');
const vm=require('vm');
const assert=require('assert');
const ROOT=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(ROOT,'src/diagnostic-feedback.js'),'utf8');
const trainer=fs.readFileSync(path.join(ROOT,'src/trainer.js'),'utf8');
const m15=fs.readFileSync(path.join(ROOT,'src/m15-learning-feedback.js'),'utf8');

const listeners={};
const context={
  window:null,
  console,
  Object,Array,String,Number,Boolean,RegExp,Math,JSON,Date,Map,Set,
};
context.window=context;
context.addEventListener=(type,cb)=>{(listeners[type] ||= []).push(cb);};
context.dispatchEvent=()=>true;
context.MajorScaleApp={
  majorScaleConfig:{
    LO_META:{
      BN01_TREBLE_PITCH:{short:'Treble Pitch'},
      BN06_STEM_DIRECTION:{short:'Stem Direction'},
      RH01_DURATION_VALUE:{short:'Duration Value'},
      GR02_PRIMARY_BEAM:{short:'Primary Beam'},
      MS03_SCALE_ACCIDENTAL:{short:'Scale Accidental'}
    }
  }
};
vm.createContext(context);
vm.runInContext(source,context,{filename:'diagnostic-feedback.js'});
const api=context.MajorScaleApp.diagnosticFeedback;
assert(api,'diagnostic feedback API should register');

assert.equal(api.statusForSkill({score:92,threshold:90,passed:true}),'mastered');
assert.equal(api.statusForSkill({score:82,threshold:85,passed:false}),'strong');
assert.equal(api.statusForSkill({score:70,threshold:85,passed:false}),'developing');
assert.equal(api.statusForSkill({score:40,threshold:85,passed:false}),'needs-practice');

api.resetSession({stageCode:'STAGE_2',exerciseCode:'MAJOR_SCALE_NOTATION',plannedQuestions:5});
const makeQuestion=(questionNumber,keyLabel,score,skillScores)=>({
  questionNumber,itemCode:keyLabel.split(' ')[0],keyLabel,score,
  skills:Object.entries(skillScores).map(([skillCode,value])=>({skillCode,score:value,correct:value,total:100,threshold:skillCode.includes('PITCH')||skillCode.includes('ACCIDENTAL')?90:85,status:value===100?'correct':'incorrect'})),
  errors:Object.entries(skillScores).filter(([,value])=>value<100).map(([skillCode])=>({skillCode,message:`error ${skillCode}`}))
});
const questions=[
  makeQuestion(1,'C Major',90,{BN01_TREBLE_PITCH:100,BN06_STEM_DIRECTION:100,RH01_DURATION_VALUE:100,GR02_PRIMARY_BEAM:80,MS03_SCALE_ACCIDENTAL:70}),
  makeQuestion(2,'G Major',80,{BN01_TREBLE_PITCH:100,BN06_STEM_DIRECTION:90,RH01_DURATION_VALUE:100,GR02_PRIMARY_BEAM:70,MS03_SCALE_ACCIDENTAL:60}),
  makeQuestion(3,'D Major',70,{BN01_TREBLE_PITCH:90,BN06_STEM_DIRECTION:90,RH01_DURATION_VALUE:100,GR02_PRIMARY_BEAM:60,MS03_SCALE_ACCIDENTAL:50}),
  makeQuestion(4,'A Major',80,{BN01_TREBLE_PITCH:100,BN06_STEM_DIRECTION:100,RH01_DURATION_VALUE:90,GR02_PRIMARY_BEAM:70,MS03_SCALE_ACCIDENTAL:60}),
  makeQuestion(5,'E Major',90,{BN01_TREBLE_PITCH:100,BN06_STEM_DIRECTION:100,RH01_DURATION_VALUE:100,GR02_PRIMARY_BEAM:80,MS03_SCALE_ACCIDENTAL:70})
];
questions.forEach(q=>assert(api.captureQuestionResult(q)));
assert.equal(api.getQuestionCount(),5);

const fallback=api.aggregateSessionResults();
assert.equal(fallback.source,'session-cache');
assert.equal(fallback.questionCount,5);
assert.equal(fallback.overallScore,82,'fallback overall must average structured question scores');
assert.equal(fallback.recommendation.skillCode,'MS03_SCALE_ACCIDENTAL','lowest skill should drive recommendation');

const serverPayload={
  session_id:'session-1',exercise_code:'MAJOR_SCALE_NOTATION',stage_code:'STAGE_2',session_questions:5,session_overall_score:86,
  session_skill_results:[
    {skill_code:'BN01_TREBLE_PITCH',score:98,threshold:90,passed:true},
    {skill_code:'BN06_STEM_DIRECTION',score:92,threshold:85,passed:true},
    {skill_code:'RH01_DURATION_VALUE',score:100,threshold:85,passed:true},
    {skill_code:'GR02_PRIMARY_BEAM',score:72,threshold:85,passed:false},
    {skill_code:'MS03_SCALE_ACCIDENTAL',score:63,threshold:90,passed:false}
  ],
  question_scores:questions.map(q=>({question_number:q.questionNumber,item_code:q.itemCode,score:q.score})),
  stage_status:'in_progress',mastery_passed:false,next_target_skill_code:'MS03_SCALE_ACCIDENTAL',next_reason_th:'ฝึกจุดอ่อนก่อน'
};
const session=api.buildSessionResult(serverPayload);
assert.equal(session.source,'supabase');
assert.equal(session.overallScore,86);
assert.equal(session.questionCount,5);
assert.equal(session.skillResults.find(x=>x.skillCode==='BN01_TREBLE_PITCH').status,'mastered');
assert.equal(session.skillResults.find(x=>x.skillCode==='GR02_PRIMARY_BEAM').status,'developing');
assert.equal(session.skillResults.find(x=>x.skillCode==='MS03_SCALE_ACCIDENTAL').status,'needs-practice');
assert.deepStrictEqual(session.weakSkills.map(x=>x.skillCode),['MS03_SCALE_ACCIDENTAL','GR02_PRIMARY_BEAM']);
assert.equal(session.recommendation.skillCode,'MS03_SCALE_ACCIDENTAL');
assert.equal(session.recommendation.stageCode,'STAGE_2');
assert.equal(session.previousSessionScore,null,'no mock previous-session comparison');

const tie=api.recommendNextPractice({
  stageCode:'STAGE_3',exerciseCode:'MAJOR_SCALE_NOTATION',
  skillPerformance:[
    {skillCode:'GR02_PRIMARY_BEAM',label:'Primary Beam',score:70},
    {skillCode:'RH01_DURATION_VALUE',label:'Duration Value',score:70}
  ]
});
assert.equal(tie.skillCode,'RH01_DURATION_VALUE','stable pedagogical priority must break equal-score ties');

assert(source.includes('renderFallbackSessionResult'),'database failure must have a structured client fallback');
assert(source.includes('diagnosticRecommendedAction'),'recommended next action must expose a primary CTA');
assert(source.includes('df-question-review'),'detailed review must be expandable');
assert(trainer.includes('function buildQuestionResult(result)'),'Trainer must expose a structured Question Result builder');
assert(trainer.includes('major-scale-question-result'),'Trainer must publish structured question feedback');
assert(trainer.includes('diagnostic:questionResult'),'session state should retain structured question feedback without DOM parsing');
assert(m15.includes('app.diagnosticFeedback?.getQuestionCount?.()'),'session trigger must use structured results rather than DOM score strips');
assert(!m15.includes("alert('สรุปชุดฝึกไม่สำเร็จ"),'session-finalization failure must not block the learner with an alert');

console.log('PASS diagnostic feedback: structured question results, skill performance, weak-skill priority, recommendation, DB fallback and review contracts');
