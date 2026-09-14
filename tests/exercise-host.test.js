'use strict';
const fs=require('fs'), path=require('path'), vm=require('vm'), assert=require('assert');
const root=path.resolve(__dirname,'..');
const elements=new Map();
const get=id=>{if(!elements.has(id))elements.set(id,{hidden:false,inert:false,value:''});return elements.get(id);};
let launches=[],closes=0,release=null,fail=false;
const ctx={window:{},document:{getElementById:get},console,requestAnimationFrame:fn=>fn(),Event:class{constructor(type){this.type=type;}},Object,Array,Map,Set,WeakSet,Error,TypeError};
ctx.window.dispatchEvent=()=>{};
ctx.window.majorScaleTrainerStartForAuthenticatedUser=async (level,mode)=>{
  launches.push({level,mode});
  if(release) await new Promise(resolve=>{release=resolve;});
  if(fail) throw new Error('runtime failed');
};
ctx.window.majorScaleTrainerClosePracticeSession=async()=>{closes++;};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root,'src/domain/notation/notation-core.js'),'utf8'),ctx);
vm.runInContext(fs.readFileSync(path.join(root,'src/domain/mastery/mastery-learning-core.js'),'utf8'),ctx);
for(const file of ['exercise-contract.js','exercise-registry.js','exercise-host.js','major-scale/major-scale.config.js','major-scale/major-scale.domain.js','major-scale/runtime-adapter.js','major-scale/exercise.definition.js']){
  vm.runInContext(fs.readFileSync(path.join(root,'src/exercises',file),'utf8'),ctx,{filename:file});
}
const app=ctx.window.MajorScaleApp,host=app.exerciseHost;
(async()=>{
  for(const code of ['MAJOR_SCALE_NOTATION','major_scale_notation',' MAJOR_SCALE_NOTATION ']){
    const result=await host.launch({exerciseCode:code,stageCode:'STAGE_2',userId:'student',supabaseClient:{secret:true}});
    assert(result.ok);assert.equal(result.context.exerciseCode,'MAJOR_SCALE_NOTATION');
    assert.equal(result.context.stageCode,'STAGE_2');assert.equal(result.context.userId,'student');
    assert(!('supabaseClient' in result.context));assert(Object.isFrozen(result.context));
    assert.equal(launches.at(-1).level,2);assert.equal(launches.at(-1).mode,'practice');assert.equal(get('trainerApp').hidden,false);
    const count=launches.length;
    assert.equal((await host.launch({exerciseCode:code})).reason,'active');assert.equal(launches.length,count);
    await host.close();assert.equal(host.getCurrentContext(),null);
  }
  const before=launches.length;
  for(const code of ['UNKNOWN_EXERCISE','INTERVAL_WRITING','../../trainer.js','',null]){
    const result=await host.launch({exerciseCode:code});assert.equal(result.reason,'unavailable');assert(result.message);
  }
  assert.equal(launches.length,before,'unknown codes never call legacy runtime');
  const runtime=app.exerciseRegistry.get('major_scale_notation').runtime;
  assert(Object.isFrozen(runtime));
  for(const value of ['code',{}, {launch(){}}])assert.throws(()=>app.exerciseContract.normalize({code:'X',name:{th:'x'},runtime:value}),/runtime requires/);
  app.exerciseRegistry.register({code:'METADATA_ONLY',name:{th:'not installed'}});
  assert.equal((await host.launch({exerciseCode:'METADATA_ONLY'})).reason,'unavailable');
  release=true;
  const first=host.launch({exerciseCode:'major_scale_notation',stageCode:'STAGE_3',sessionMode:'pretest'});
  const second=host.launch({exerciseCode:'major_scale_notation',stageCode:'STAGE_3'});
  assert.strictEqual(first,second);await Promise.resolve();
  const closing=host.close();assert.strictEqual(host.close(),closing);
  assert.equal((await host.launch({exerciseCode:'major_scale_notation'})).reason,'closing');
  release();release=null;await first;await closing;
  assert.equal(launches.length,before+1);assert.equal(launches.at(-1).mode,'practice','legacy pretest requests must normalize to practice');assert.equal(host.getCurrentContext(),null);
  assert((await host.launch({exerciseCode:'major_scale_notation',stageCode:'STAGE_4'})).ok);
  await host.close();
  fail=true;
  const failure=await host.launch({exerciseCode:'major_scale_notation'});
  assert.equal(failure.reason,'launch-failed');assert.equal(host.getCurrentContext(),null);
  assert.equal(get('studentDashboard').hidden,false);assert.equal(get('trainerApp').hidden,true);
  fail=false;
  assert((await host.launch({exerciseCode:'major_scale_notation'})).ok);await host.close();
  assert(closes>=6);
  console.log('PASS Exercise Host routing, context, practice-only normalization, single/double launch, unavailable, close/reopen, race and rollback');
})().catch(error=>{console.error(error);process.exitCode=1;});
