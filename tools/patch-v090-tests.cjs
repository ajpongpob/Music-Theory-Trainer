'use strict';
const fs=require('fs'),path=require('path');
const read=f=>fs.readFileSync(f,'utf8');
const write=(f,s)=>{fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s);};
function replaceOnce(source,before,after,label){const n=source.split(before).length-1;if(n!==1)throw new Error(`${label}: ${n}`);return source.replace(before,after);}
function patch(file,fn){write(file,fn(read(file)));}

write('tests/mastery-learning-core.test.js',`'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const ctx={window:{}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/domain/mastery/mastery-learning-core.js'),'utf8'),ctx);
const api=ctx.window.MajorScaleApp.masteryLearningCore;
assert(api && Object.isFrozen(api));
assert.equal(api.normalizeSessionMode('PRETEST'),'pretest');
assert.equal(api.normalizeSessionMode('mastery_test'),'practice');
assert.equal(api.normalizeSessionMode('mastery_test',{allowMasteryTest:true}),'mastery_test');
assert.deepStrictEqual(JSON.parse(JSON.stringify(api.buildDiagnosticItemCodes([{item_code:'G',sequence_order:2},{item_code:'C',sequence_order:1},{item_code:'C',sequence_order:3}],[]))),['C','G']);
assert.deepStrictEqual(JSON.parse(JSON.stringify(api.buildDiagnosticItemCodes([],['D','D','A']))),['D','A']);
const r=api.normalizeRecommendation([{learning_path_code:'P',exercise_code:'E',stage_code:'S',action_type:'target_skill',target_skill_code:'BN01',reason_code:'WEAK',reason_th:'ฝึก',overall_score:'81',overall_threshold:'90',attempts_found:10,rolling_window:10}]);
assert.equal(r.actionType,'target_skill');assert.equal(r.overallScore,81);assert.equal(api.recommendationActionLabel(r),'ฝึกทักษะที่ยังอ่อน');
assert(api.diagnosticComplete(5,5));assert(!api.diagnosticComplete(4,5));
console.log('PASS mastery learning core: modes, diagnostic plan, normalized recommendation and completion');
`);

write('tests/mastery-learning-sql-contract.test.js',`'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20260912_v090_mastery_learning_core.sql'),'utf8');
for(const token of ['stage_mastery_rules','stage_skill_requirements','stage_required_items','path_exercises','sequence_order','get_my_stage_evidence','get_my_exercise_diagnostic','apply_my_diagnostic_placement','get_my_recommended_next_action','ensure_my_learning_path_progression']) assert(sql.includes(token),token);
assert(!/STAGE_4|=\s*4\s*(?:;|then)/.test(sql),'generic progression must not assume exactly four stages');
assert(sql.includes("p_mode text default 'practice'"));assert(sql.includes("'pretest'"));
assert(sql.includes('revoke execute on function public.get_my_stage_evidence(text,text,text,boolean) from anon'));
console.log('PASS mastery learning SQL contract: configurable rules, diagnostic, generic sequence progression, recommendations, authenticated-only RPCs');
`);

patch('tests/architecture-boundary.test.js',source=>{
  source=replaceOnce(source,"const masteryRepo = read('src/data/mastery.repository.js');\nconst html =", "const masteryRepo = read('src/data/mastery.repository.js');\nconst learningRepo = read('src/data/learning.repository.js');\nconst masteryCore = read('src/domain/mastery/mastery-learning-core.js');\nconst html =",'arch deps');
  source=replaceOnce(source,"for (const [name, source] of [['practice.repository.js',practiceRepo],['mastery.repository.js',masteryRepo]]) {", "for (const [name, source] of [['practice.repository.js',practiceRepo],['mastery.repository.js',masteryRepo],['learning.repository.js',learningRepo]]) {",'repo dom boundary');
  source=replaceOnce(source,"assert(masteryRepo.includes(\"'advance_my_stage_if_mastered'\"), 'mastery repository missing progression RPC');", "assert(masteryRepo.includes(\"'advance_my_stage_if_mastered'\"), 'mastery repository missing progression RPC');\nfor(const rpc of ['get_my_exercise_diagnostic','apply_my_diagnostic_placement','get_my_recommended_next_action','ensure_my_learning_path_progression','get_my_stage_evidence']) assert(learningRepo.includes(`'${rpc}'`),`learning repository missing ${rpc}`);\nassert(!/\\bdocument\\b|\\bsupabase\\b|\\bfetch\\s*\\(/i.test(masteryCore),'mastery core must stay pure');",'learning rpc boundary');
  source=replaceOnce(source,"assert(indexOf('src/data/mastery.repository.js') < indexOf('src/trainer.js'));", "assert(indexOf('src/data/mastery.repository.js') < indexOf('src/data/learning.repository.js'));\nassert(indexOf('src/data/learning.repository.js') < indexOf('src/domain/mastery/mastery-learning-core.js'));\nassert(indexOf('src/domain/mastery/mastery-learning-core.js') < indexOf('src/exercises/exercise-host.js'));\nassert(indexOf('src/data/learning.repository.js') < indexOf('src/dashboard/student-dashboard.js'));\nassert(indexOf('src/data/learning.repository.js') < indexOf('src/trainer.js'));\nassert(indexOf('src/data/mastery.repository.js') < indexOf('src/trainer.js'));",'script order');
  return source;
});

patch('tests/exercise-host.test.js',source=>{
  source=replaceOnce(source,"ctx.window.majorScaleTrainerStartForAuthenticatedUser=async level=>{\n  launches.push(level);", "ctx.window.majorScaleTrainerStartForAuthenticatedUser=async (level,mode)=>{\n  launches.push({level,mode});",'host stub');
  source=replaceOnce(source,"for(const file of ['exercise-contract.js','exercise-registry.js','exercise-host.js','major-scale/major-scale.config.js'", "vm.runInContext(fs.readFileSync(path.join(root,'src/domain/mastery/mastery-learning-core.js'),'utf8'),ctx);\nfor(const file of ['exercise-contract.js','exercise-registry.js','exercise-host.js','major-scale/major-scale.config.js'",'load mastery core');
  source=source.replace("assert.equal(launches.at(-1),2);", "assert.equal(launches.at(-1).level,2);assert.equal(launches.at(-1).mode,'practice');");
  source=source.replace("const first=host.launch({exerciseCode:'major_scale_notation',stageCode:'STAGE_3'});", "const first=host.launch({exerciseCode:'major_scale_notation',stageCode:'STAGE_3',sessionMode:'pretest'});");
  source=source.replace("assert.equal(launches.length,before+1);assert.equal(host.getCurrentContext(),null);", "assert.equal(launches.length,before+1);assert.equal(launches.at(-1).mode,'pretest');assert.equal(host.getCurrentContext(),null);");
  return source;
});

patch('tests/dashboard-runtime-smoke.test.js',source=>{
  source=replaceOnce(source,"if(name==='get_my_stage_mastery') return {data:mastery,error:null}; return {data:null,error:null};", "if(name==='get_my_stage_mastery') return {data:mastery,error:null}; if(name==='ensure_my_learning_path_progression') return {data:[{learning_path_code:'MUSIC_THEORY_FOUNDATIONS',current_exercise_code:'MAJOR_SCALE_NOTATION',current_stage_code:'STAGE_2'}],error:null}; if(name==='get_my_recommended_next_action') return {data:[{learning_path_code:'MUSIC_THEORY_FOUNDATIONS',exercise_code:'MAJOR_SCALE_NOTATION',stage_code:'STAGE_2',action_type:'diagnostic',target_skill_code:null,target_item_code:null,reason_code:'NO_STAGE_EVIDENCE',reason_th:'เริ่มแบบประเมินก่อนเรียน',overall_score:null,overall_threshold:null,attempts_found:0,rolling_window:10}],error:null}; if(name==='get_my_exercise_diagnostic') return {data:[],error:null}; if(name==='apply_my_diagnostic_placement') return {data:[{applied:true,exercise_code:'MAJOR_SCALE_NOTATION',placement_stage_code:'STAGE_2',diagnostic_mastered_stages:1,exercise_mastered:false,reason_code:'DIAGNOSTIC_PLACED'}],error:null}; if(name==='get_my_stage_evidence') return {data:mastery,error:null}; return {data:null,error:null};",'mock learning rpcs');
  source=replaceOnce(source,"check('mastery rendered',get('dashboardMasteryBody').innerHTML.includes('80%'),get('dashboardMasteryBody').innerHTML.slice(0,200));", "check('mastery rendered',get('dashboardMasteryBody').innerHTML.includes('80%'),get('dashboardMasteryBody').innerHTML.slice(0,200));\n    check('recommended next action rendered',get('dashboardRecommendation').innerHTML.includes('แบบประเมินก่อนเรียน'),get('dashboardRecommendation').innerHTML);",'dashboard rec check');
  source=replaceOnce(source,"ctx.majorScaleTrainerStartForAuthenticatedUser=async level=>{launchCount++;lastLevel=level;};", "let lastMode=null;ctx.majorScaleTrainerStartForAuthenticatedUser=async (level,mode)=>{launchCount++;lastLevel=level;lastMode=mode;};",'runtime mode mock');
  source=replaceOnce(source,"check('Host receives stage and user',ctx.MajorScaleApp.exerciseHost.getCurrentContext()?.stageCode==='STAGE_2' && ctx.MajorScaleApp.exerciseHost.getCurrentContext()?.userId==='student-1');", "check('Host receives stage and user',ctx.MajorScaleApp.exerciseHost.getCurrentContext()?.stageCode==='STAGE_2' && ctx.MajorScaleApp.exerciseHost.getCurrentContext()?.userId==='student-1' && lastMode==='practice');",'host practice mode check');
  return source;
});

patch('tests/trainer-data-flow-smoke.test.js',source=>{
  source=replaceOnce(source,"    async getOpenPracticeSessions(userId) {", "    async getOpenLearningSessions(userId) {\n      calls.push(['practice.getOpenLearningSessions', userId]);\n      return {data:[{id:'stale-1',started_at:'2026-09-01T00:00:00Z',last_activity_at:'2026-09-01T00:10:00Z',mode:'practice'}],error:null};\n    },\n    async getOpenPracticeSessions(userId) {",'learning sessions mock');
  source=replaceOnce(source,"  const windowListeners = {};", "  const learningRepository={\n    async applyDiagnosticPlacement(code){calls.push(['learning.applyDiagnosticPlacement',code]);return {data:[{applied:true,exercise_code:code,placement_stage_code:'STAGE_3',diagnostic_mastered_stages:2,exercise_mastered:false,reason_code:'DIAGNOSTIC_PLACED'}],error:null};}\n  };\n\n  const windowListeners = {};",'learning repo mock');
  source=replaceOnce(source,"context.window.MajorScaleApp = {authRepository, practiceRepository, masteryRepository};", "context.window.MajorScaleApp = {authRepository, practiceRepository, masteryRepository,learningRepository};",'context learning repo');
  source=replaceOnce(source,"for(const rel of ['src/domain/notation/notation-core.js'", "for(const rel of ['src/domain/mastery/mastery-learning-core.js','src/domain/notation/notation-core.js'",'load mastery core trainer smoke');
  source=replaceOnce(source,"`completePracticeSessionRecord,advanceLevelIfMastered,saveAttemptRecord};\\n})();`;", "`completePracticeSessionRecord,advanceLevelIfMastered,saveAttemptRecord,startTrainerForAuthenticatedUser,startSession};\\n})();`;",'expose trainer diagnostic hooks');
  return source;
});

patch('tests/exercise-routing.browser.cjs',source=>{
  source=replaceOnce(source,"    await page.locator('.dashboard-continue').first().click();\n    await page.waitForFunction(()=>!document.getElementById('trainerApp').hidden);\n    assert.equal(await page.evaluate(()=>__qa.state.notes.filter(Boolean).length),0,'reopen clears answer');", `    // Diagnostic recommendation uses the same exercise runtime with an explicit pretest mode.
    const diagnostic=page.locator('#dashboardRecommendation .dashboard-continue');
    await diagnostic.click();
    await page.waitForFunction(()=>!document.getElementById('trainerApp').hidden && __qa.state.sessionMode==='pretest');
    assert.equal(await page.evaluate(()=>MajorScaleApp.exerciseHost.getCurrentContext().sessionMode),'pretest','Host carries diagnostic mode');
    assert.equal(await page.evaluate(()=>__qa.state.sessionLength),2,'diagnostic plan uses required Stage items');
    for(let q=0;q<2;q++){
      await page.evaluate(()=>{__qa.state.notes=__qa.buildExpected(__qa.state.key).map((n,i)=>({...n,id:'diag'+q+'-'+i}));__qa.render();});
      await page.locator('#checkAnswer').click();
      await page.locator('#questionResultOverlay').waitFor({state:'visible'});
      await page.waitForFunction(()=>!document.getElementById('questionResultContinue').disabled);
      await page.locator('#questionResultContinue').click();
      if(q===0) await page.waitForFunction(()=>document.getElementById('questionResultOverlay').hidden && __qa.state.questionIndex===1);
    }
    await page.waitForFunction(()=>!document.getElementById('studentDashboard').hidden);
    assert(await page.evaluate(()=>__qaCalls.some(c=>c[0]==='learning.applyDiagnosticPlacement')),'diagnostic placement persisted after final pretest item');
    assert(await page.evaluate(()=>__qaCalls.some(c=>c[0]==='practice.createPracticeSession' && c[1]?.mode==='pretest')),'pretest session persisted with explicit mode');
    await page.locator('.dashboard-continue').first().click();
    await page.waitForFunction(()=>!document.getElementById('trainerApp').hidden);
    assert.equal(await page.evaluate(()=>__qa.state.notes.filter(Boolean).length),0,'reopen clears answer');`, 'browser diagnostic flow');
  source=source.replace("console.log('PASS browser: HTTP subpath, Dashboard double click → Host → legacy runtime,", "console.log('PASS browser: HTTP subpath, Dashboard recommendation → diagnostic persistence/placement, double click → Host → legacy runtime,");
  return source;
});

console.log('Patched v0.9.0 regression coverage');
