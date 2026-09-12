'use strict';

const fs=require('fs');
const path=require('path');
const vm=require('vm');
const assert=require('assert');
const ROOT=path.resolve(__dirname,'..');

class MockElement{
  constructor(id=''){this.id=id;this.listeners={};this.style={};this.dataset={};this.classList={add(){},remove(){}};this.children=[];this.hidden=false;this.value='';this.textContent='';this.innerHTML='';}
  addEventListener(type,cb){(this.listeners[type] ||= []).push(cb);}
  appendChild(n){this.children.push(n);return n;}
  setAttribute(){} removeAttribute(){} querySelectorAll(){return [];} focus(){} click(){} setPointerCapture(){}
  getBoundingClientRect(){return {left:0,top:0,width:1200,height:300};}
  getScreenCTM(){return null;} createSVGPoint(){return {matrixTransform(){return {x:0,y:0};}};}
}

function loadWithRepositories({authRepository,practiceRepository,masteryRepository,errors}){
  const elements=new Map();
  const get=id=>{if(!elements.has(id))elements.set(id,new MockElement(id));return elements.get(id);};
  const document={
    activeElement:null, documentElement:{classList:{add(){},remove(){}}}, fonts:null,
    getElementById:get, querySelectorAll(){return [];}, querySelector(sel){return get('q:'+sel);},
    createElementNS(){return new MockElement();}, addEventListener(){}
  };
  const context={
    console:{log(){},warn(){},error(...a){errors.push(a.map(String).join(' '));}},
    document,ResizeObserver:class{observe(){}},requestAnimationFrame:cb=>setTimeout(cb,0),cancelAnimationFrame:clearTimeout,
    setTimeout,clearTimeout,Promise,Object,Array,String,Number,Boolean,RegExp,Math,JSON,Date,Map,Set,WeakMap,WeakSet,Intl,
    confirm(){return true;}
  };
  context.window=context;context.globalThis=context;
  context.addEventListener=()=>{};context.removeEventListener=()=>{};
  context.MajorScaleApp={authRepository,practiceRepository,masteryRepository};
  let source=fs.readFileSync(path.join(ROOT,'src/trainer.js'),'utf8');
  const old='initializeTrainerAfterMusicFont();\n})();';
  const replacement=`window.__hooks={state,createPracticeSessionRecord,saveAttemptRecord,advanceLevelIfMastered};\n})();`;
  assert(source.includes(old));
  source=source.replace(old,replacement);
  vm.createContext(context);for(const rel of ['src/domain/notation/notation-core.js','src/exercises/major-scale/major-scale.config.js','src/exercises/major-scale/major-scale.domain.js']) vm.runInContext(fs.readFileSync(path.join(ROOT,rel),'utf8'),context,{filename:rel});
  vm.runInContext(source,context,{filename:'trainer.js'});
  return context.__hooks;
}

(async()=>{
  // 1) Stale generation: no session or attempt write is allowed.
  {
    const errors=[];const calls=[];
    const hooks=loadWithRepositories({
      errors,
      authRepository:{async getUser(){calls.push('getUser');return {data:{user:{id:'u1'}},error:null};}},
      practiceRepository:{
        async getRequiredActiveExerciseByCode(){calls.push('exercise');return {data:{id:'e1'},error:null};},
        async getRequiredActiveStageByCode(){calls.push('stage');return {data:{id:'s1'},error:null};},
        async createPracticeSession(){calls.push('createSession');return {data:{id:'ps1'},error:null};},
        async createAttempt(){calls.push('createAttempt');return {data:{id:'a1'},error:null};}
      },
      masteryRepository:{}
    });
    hooks.state.practiceSessionGeneration=5;hooks.state.practiceSessionId=null;hooks.state.practiceSessionPromise=null;
    const result=await hooks.saveAttemptRecord({generation:4,questionNumber:1,itemCode:'C',score:100,responseJson:{},loResults:{},completedQuestions:1,level:1});
    assert.strictEqual(result,null);
    assert(!calls.includes('createSession'),'stale generation must not create a session');
    assert(!calls.includes('createAttempt'),'stale generation must not create an attempt');
  }

  // 2) Skill evidence failure: attempt may exist, but progress and advancement must stop.
  {
    const errors=[];const calls=[];
    const hooks=loadWithRepositories({
      errors,
      authRepository:{async getUser(){return {data:{user:{id:'u1'}},error:null};}},
      practiceRepository:{
        async createAttempt(payload){calls.push(['attempt',payload]);return {data:{id:'a1'},error:null};},
        async createAttemptSkillResults(){calls.push(['skills']);return {data:null,error:new Error('skill write failed')};},
        async updatePracticeSession(){calls.push(['updateSession']);return {error:null};}
      },
      masteryRepository:{async advanceStageIfMastered(){calls.push(['advance']);return {data:[],error:null};}}
    });
    hooks.state.practiceSessionGeneration=6;hooks.state.practiceSessionId='ps-existing';hooks.state.practiceSessionPromise=Promise.resolve('ps-existing');
    const result=await hooks.saveAttemptRecord({generation:6,questionNumber:1,itemCode:'C',score:90,responseJson:{},loResults:{SKILL:{correct:1,total:1,score:100,flags:{}}},completedQuestions:1,level:1});
    assert.strictEqual(result.attemptId,'a1');
    assert.strictEqual(result.mastery,null);
    assert(!calls.some(c=>c[0]==='updateSession'),'session progress must not update after skill evidence failure');
    assert(!calls.some(c=>c[0]==='advance'),'mastery progression must not run after skill evidence failure');
    assert(errors.some(e=>e.includes('CREATE ATTEMPT SKILL RESULTS ERROR')),'skill write failure should be logged');
  }

  // 3) Progression RPC failure: must report error and must not complete session.
  {
    const errors=[];const calls=[];
    const hooks=loadWithRepositories({
      errors,
      authRepository:{},
      practiceRepository:{async updatePracticeSession(){calls.push(['complete']);return {error:null};}},
      masteryRepository:{async advanceStageIfMastered(){calls.push(['advance']);return {data:null,error:new Error('rpc failed')};}}
    });
    hooks.state.practiceSessionGeneration=7;
    const result=await hooks.advanceLevelIfMastered({generation:7,level:2,practiceSessionId:'ps1'});
    assert.deepStrictEqual(JSON.parse(JSON.stringify(result)),{advanced:false,error:true,stale:false});
    assert(!calls.some(c=>c[0]==='complete'),'failed progression must not mark session complete');
    assert(errors.some(e=>e.includes('STAGE MASTERY CHECK ERROR')),'progression failure should be logged');
  }

  // 4) No authenticated user: session record must not be created.
  {
    const errors=[];const calls=[];
    const hooks=loadWithRepositories({
      errors,
      authRepository:{async getUser(){return {data:{user:null},error:null};}},
      practiceRepository:{async createPracticeSession(){calls.push('createSession');return {data:{id:'ps1'},error:null};}},
      masteryRepository:{}
    });
    hooks.state.practiceSessionGeneration=8;
    const result=await hooks.createPracticeSessionRecord(8,1);
    assert.strictEqual(result,undefined);
    assert(!calls.includes('createSession'),'anonymous user must not create practice session');
  }

  console.log('PASS trainer practice/mastery error-path safeguards');
})().catch(e=>{console.error(e);process.exitCode=1;});
