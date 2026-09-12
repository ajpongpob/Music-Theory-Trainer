'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const ROOT=path.resolve(__dirname,'..');

const migration=fs.readFileSync(path.join(ROOT,'supabase/migrations/20260912135651_m1_learning_flow_copy_alignment.sql'),'utf8');
assert(migration.includes("short_name='Pitch Name'"),'BN01 short name must match v0.9.2 pitch-name semantics');
assert(migration.includes('ชื่อระดับเสียง (Pitch Name — ไม่จำกัด Octave)'),'BN01 Thai label must explicitly state octave independence');
assert(migration.includes('ทำแบบฝึกเพิ่มอีก %s ข้อ'),'recommendation must tell learner how many more attempts are needed');
assert(migration.includes('ยังมีบันไดเสียงที่ต้องฝึกให้ครบ'),'coverage recommendation must use learner language');
assert(migration.includes('ทักษะนี้ยังต่ำกว่าเกณฑ์'),'skill recommendation must use learner language');
assert(migration.includes('คะแนนรวมยังไม่ถึงเกณฑ์ %s%%'),'overall recommendation must state the target threshold');
assert(!/update\s+public\.stage_mastery_config/i.test(migration),'M1.2 copy migration must not change mastery thresholds');
assert(!/update\s+public\.exercise_stages/i.test(migration),'M1.2 copy migration must not change Stage progression');

const calls=[];
const client={
  rpc(name,args){calls.push({name,args});return Promise.resolve({data:[],error:null});},
  from(){throw new Error('not used in this contract');}
};
const repoContext={window:{MajorScaleApp:{supabaseClient:client}},console,Promise,Error,Object};
vm.createContext(repoContext);
vm.runInContext(fs.readFileSync(path.join(ROOT,'src/data/dashboard.repository.js'),'utf8'),repoContext,{filename:'dashboard.repository.js'});
const dashboardRepository=repoContext.window.MajorScaleApp.dashboardRepository;
assert.equal(typeof dashboardRepository.getStageEvidence,'function','Dashboard repository must expose detailed Stage evidence');
(async()=>{
  await dashboardRepository.getStageEvidence({exerciseCode:'MAJOR_SCALE_NOTATION',stageCode:'STAGE_1'});
  assert.deepStrictEqual(JSON.parse(JSON.stringify(calls[0])),{
    name:'get_my_stage_evidence',
    args:{
      p_exercise_code:'MAJOR_SCALE_NOTATION',
      p_stage_code:'STAGE_1',
      p_mode:'practice',
      p_latest_session_only:false
    }
  });

  const masteryContext={window:{MajorScaleApp:{}},console,Object,Set,Number,String,Array};
  vm.createContext(masteryContext);
  vm.runInContext(fs.readFileSync(path.join(ROOT,'src/domain/mastery/mastery-learning-core.js'),'utf8'),masteryContext,{filename:'mastery-learning-core.js'});
  const core=masteryContext.window.MajorScaleApp.masteryLearningCore;
  assert.equal(core.recommendationActionLabel({actionType:'target_item',targetItemCode:'Bb'}),'ฝึกบันไดเสียง Bb');
  assert.equal(core.recommendationActionLabel({actionType:'target_skill'}),'ฝึกทักษะที่ควรพัฒนา');
  assert.equal(core.recommendationActionLabel({actionType:'diagnostic'}),'เริ่มแบบประเมินก่อนเรียน');
  assert.equal(core.recommendationActionLabel({actionType:'advance'}),'ไปขั้นถัดไป');
  console.log('PASS M1.2 learning-flow UX: Pitch Name terminology, actionable recommendation copy, detailed Stage evidence repository, unchanged mastery/progression rules');
})().catch(error=>{console.error(error);process.exitCode=1;});
