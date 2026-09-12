'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib'),crypto=require('crypto'),cp=require('child_process');
const read=f=>fs.readFileSync(f,'utf8');
const write=(f,s)=>{fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s);};
const replaceOnce=(s,b,a,label)=>{const n=s.split(b).length-1;if(n!==1)throw new Error(`${label}: expected 1 match, found ${n}`);return s.replace(b,a);};

let trainer=read('src/trainer.js');
trainer=replaceOnce(trainer,
` sessionMode:"practice",\n diagnosticItemCodes:[]\n};`,
` sessionMode:"practice",\n diagnosticItemCodes:[],\n pathStageEnforced:false,\n authoritativeStageCode:null,\n authoritativeLevel:null\n};`,
'stage authority state');

trainer=replaceOnce(trainer,'};\n\nfunction autoStem',`};\n\nfunction stageContextFromCode(stageCode){
  const match=/^STAGE_(\\d+)$/.exec(String(stageCode || '').trim());
  if(!match) return {stageCode:null,level:null};
  const level=Number(match[1]);
  if(!Number.isInteger(level) || !LEVEL_KEYS[level]) return {stageCode:null,level:null};
  return {stageCode:\`STAGE_\${level}\`,level};
}

function configurePathStageAuthority(stageCode){
  const resolved=stageContextFromCode(stageCode);
  state.pathStageEnforced=resolved.level!==null;
  state.authoritativeStageCode=resolved.stageCode;
  state.authoritativeLevel=resolved.level;
  return resolved;
}

function effectiveSessionLevel(candidate=state.level){
  if(state.pathStageEnforced && Number.isInteger(state.authoritativeLevel)) return state.authoritativeLevel;
  const parsed=Number(candidate);
  if(Number.isInteger(parsed) && LEVEL_KEYS[parsed]) return parsed;
  return Number.isInteger(state.level) && LEVEL_KEYS[state.level] ? state.level : 1;
}

function enforceAuthoritativeLevelControl(){
  const select=document.getElementById("levelSelect");
  if(!select) return;
  if(state.pathStageEnforced && Number.isInteger(state.authoritativeLevel)){
    select.value=String(state.authoritativeLevel);
    select.disabled=true;
    select.setAttribute("aria-disabled","true");
    select.title="ระดับนี้กำหนดโดย Learning Path";
    return;
  }
  select.disabled=state.sessionMode==="pretest";
  if(!select.disabled) select.removeAttribute("aria-disabled");
}

function acceptTrustedAdvancedLevel(nextLevel){
  const parsed=Number(nextLevel);
  if(!state.pathStageEnforced || !Number.isInteger(parsed) || !LEVEL_KEYS[parsed]) return;
  state.authoritativeLevel=parsed;
  state.authoritativeStageCode=\`STAGE_\${parsed}\`;
}

function autoStem`,'stage authority helpers');

trainer=replaceOnce(trainer,
`async function createPracticeSessionRecord(generation, level){\n\n  const app=window.MajorScaleApp || {};`,
`async function createPracticeSessionRecord(generation, level){\n\n  const sessionLevel=effectiveSessionLevel(level);\n  const app=window.MajorScaleApp || {};`,
'authoritative persistence level');

const createStart=trainer.indexOf('async function createPracticeSessionRecord');
const createEnd=trainer.indexOf('\nasync function ',createStart+20);
if(createStart<0||createEnd<0) throw new Error('createPracticeSessionRecord block not found');
let createBlock=trainer.slice(createStart,createEnd);
createBlock=replaceOnce(createBlock,'resolveMajorScaleExerciseStage(level)','resolveMajorScaleExerciseStage(sessionLevel)','resolve stage from authoritative level');
trainer=trainer.slice(0,createStart)+createBlock+trainer.slice(createEnd);

trainer=replaceOnce(trainer,
`async function startTrainerForAuthenticatedUser(levelOverride=null,sessionMode="practice"){\n  await closeStalePracticeSessionsForCurrentUser();\n  state.sessionMode=masteryLearningCore?.normalizeSessionMode(sessionMode) || "practice";`,
`async function startTrainerForAuthenticatedUser(levelOverride=null,sessionMode="practice",stageCode=null){\n  await closeStalePracticeSessionsForCurrentUser();\n  state.sessionMode=masteryLearningCore?.normalizeSessionMode(sessionMode) || "practice";\n  configurePathStageAuthority(stageCode);`,
'start signature and authority');

trainer=replaceOnce(trainer,
`  const requestedLevel=Number(levelOverride);\n  const level=(Number.isInteger(requestedLevel) && LEVEL_KEYS[requestedLevel])\n    ? requestedLevel\n    : await loadCurrentLevelFromProgress();`,
`  const requestedLevel=state.pathStageEnforced ? state.authoritativeLevel : Number(levelOverride);\n  const level=(Number.isInteger(requestedLevel) && LEVEL_KEYS[requestedLevel])\n    ? requestedLevel\n    : await loadCurrentLevelFromProgress();`,
'authoritative start level');

trainer=replaceOnce(trainer,
`  if(select){\n    select.value=String(level);\n  }`,
`  if(select){\n    select.value=String(level);\n  }\n  enforceAuthoritativeLevelControl();`,
'lock level control at launch');

trainer=replaceOnce(trainer,
`  const levelSelect=document.getElementById("levelSelect");\n  if(levelSelect) levelSelect.disabled=state.sessionMode==="pretest";`,
`  enforceAuthoritativeLevelControl();`,
'replace diagnostic-only lock');

trainer=replaceOnce(trainer,
`  state.level =\n    Number(\n      document.getElementById("levelSelect")?.value || 1\n    );`,
`  state.level=effectiveSessionLevel(\n    document.getElementById("levelSelect")?.value || 1\n  );\n  enforceAuthoritativeLevelControl();`,
'startSession authoritative level');

trainer=replaceOnce(trainer,
`  completedQuestions,\n  level\n}){\n  const practiceRepository=`,
`  completedQuestions,\n  level\n}){\n  level=effectiveSessionLevel(level);\n  const practiceRepository=`,
'saveAttempt authoritative level');

trainer=replaceOnce(trainer,
`document.getElementById("levelSelect").addEventListener("change",ev=>{\n  const select=ev.currentTarget;\n  const hasProgress=noteCount()>0 || state.sessionResults.length>0;`,
`document.getElementById("levelSelect").addEventListener("change",ev=>{\n  const select=ev.currentTarget;\n  if(state.pathStageEnforced){\n    enforceAuthoritativeLevelControl();\n    return;\n  }\n  const hasProgress=noteCount()>0 || state.sessionResults.length>0;`,
'block manual level change');

trainer=replaceOnce(trainer,
`  if(\n    Number.isInteger(nextLevel) &&\n    LEVEL_KEYS[nextLevel]\n  ){\n    const select=document.getElementById("levelSelect");`,
`  if(\n    Number.isInteger(nextLevel) &&\n    LEVEL_KEYS[nextLevel]\n  ){\n    acceptTrustedAdvancedLevel(nextLevel);\n    const select=document.getElementById("levelSelect");`,
'trust backend advancement');

trainer=trainer.replaceAll('app_version:"0.9.0"','app_version:"0.9.1"');
write('src/trainer.js',trainer);

let adapter=read('src/exercises/major-scale/runtime-adapter.js');
adapter=replaceOnce(adapter,
`    const match = /^STAGE_(\\d+)$/.exec(context.stageCode || '');\n    const level = match ? Number(match[1]) : null;`,
`    const match = /^STAGE_(\\d+)$/.exec(context.stageCode || '');\n    if (context.stageCode && !match) throw new Error('Stage context ไม่ถูกต้องสำหรับ Major Scale');\n    const level = match ? Number(match[1]) : null;`,
'validate adapter stage');
adapter=replaceOnce(adapter,
`      await start(level, context.sessionMode || 'practice');`,
`      await start(level, context.sessionMode || 'practice', context.stageCode || null);`,
'pass authoritative stage');
write('src/exercises/major-scale/runtime-adapter.js',adapter);

let html=read('index.html');
html=html.replace('<title>Major Scale Notation Trainer — v0.9.0</title>','<title>Major Scale Notation Trainer — v0.9.1</title>');
html=html.replace('<span class="pill">v0.9.0</span>','<span class="pill">v0.9.1</span>');
write('index.html',html);

let pkg=read('tests/package-static-integrity.test.js');
pkg=pkg.replaceAll('v0.9.0','v0.9.1');
write('tests/package-static-integrity.test.js',pkg);

let flow=read('tests/trainer-data-flow-smoke.test.js');
flow=flow.replaceAll('0.9.0','0.9.1');
flow=replaceOnce(flow,
`    \`completePracticeSessionRecord,advanceLevelIfMastered,saveAttemptRecord,startTrainerForAuthenticatedUser,startSession};\\n})();\`;`,
`    \`completePracticeSessionRecord,advanceLevelIfMastered,saveAttemptRecord,startTrainerForAuthenticatedUser,startSession,configurePathStageAuthority,effectiveSessionLevel,enforceAuthoritativeLevelControl};\\n})();\`;`,
'expose stage hooks');
flow=replaceOnce(flow,
`  const resolved = await hooks.resolveMajorScaleExerciseStage(2);`,
`  hooks.configurePathStageAuthority('STAGE_2');\n  assert.strictEqual(hooks.effectiveSessionLevel(4),2,'path authority must override tampered candidate level');\n  context.__elements.get('levelSelect').value='4';\n  hooks.startSession();\n  assert.strictEqual(hooks.state.level,2,'startSession must keep authoritative path level');\n  assert.strictEqual(context.__elements.get('levelSelect').value,'2','level select must be restored to authoritative level');\n  assert.strictEqual(context.__elements.get('levelSelect').disabled,true,'path level control must be disabled');\n\n  const resolved = await hooks.resolveMajorScaleExerciseStage(2);`,
'flow authority assertions');
flow=replaceOnce(flow,
`  const sessionId = await hooks.createPracticeSessionRecord(7, 2);`,
`  const sessionId = await hooks.createPracticeSessionRecord(7, 4);`,
'persist tampered level');
flow=replaceOnce(flow,
`  assert.strictEqual(hooks.state.practiceSessionId, 'session-new');`,
`  assert.strictEqual(hooks.state.practiceSessionId, 'session-new');\n  assert(calls.some(call=>call[0]==='practice.getRequiredActiveStageByCode' && call[2]==='STAGE_2'),'persistence must resolve authoritative STAGE_2');\n  assert(!calls.some(call=>call[0]==='practice.getRequiredActiveStageByCode' && call[2]==='STAGE_4'),'persistence must never resolve tampered STAGE_4');`,
'flow persistence authority');
write('tests/trainer-data-flow-smoke.test.js',flow);

let browser=read('tests/exercise-routing.browser.cjs');
browser=replaceOnce(browser,
`    assert.equal(await page.evaluate(()=>__qaStarts),1,'one runtime start on double click');\n    assert.equal(await page.evaluate(()=>__qaCalls.filter(c=>c[0]==='practice.createPracticeSession').length),0,'legacy session is created lazily on first answer');`,
`    assert.equal(await page.evaluate(()=>__qaStarts),1,'one runtime start on double click');\n    assert.equal(await page.locator('#levelSelect').isDisabled(),true,'Learning Path launch must visibly lock Level');\n    const enforcedLevel=await page.evaluate(()=>__qa.state.level);\n    const tamper=await page.evaluate(()=>{\n      const select=document.getElementById('levelSelect');\n      select.disabled=false; select.value='4'; select.dispatchEvent(new Event('change',{bubbles:true}));\n      return {value:select.value,disabled:select.disabled,level:__qa.state.level};\n    });\n    assert.equal(tamper.level,enforcedLevel,'manual DOM change cannot alter active path level');\n    assert.equal(Number(tamper.value),enforcedLevel,'Level select snaps back after tamper');\n    assert.equal(tamper.disabled,true,'Level select relocks after tamper');\n    assert.equal(await page.evaluate(()=>__qaCalls.filter(c=>c[0]==='practice.createPracticeSession').length),0,'legacy session is created lazily on first answer');`,
'browser stage lock');
browser=replaceOnce(browser,
`    await page.waitForFunction(()=>__qaCalls.some(c=>c[0]==='practice.createAttempt'));`,
`    await page.waitForFunction(()=>__qaCalls.some(c=>c[0]==='practice.createAttempt'));\n    assert(!await page.evaluate(()=>__qaCalls.some(c=>c[0]==='practice.getRequiredActiveStageByCode' && c[2]==='STAGE_4')),'tampered higher Stage must never reach persistence');`,
'browser persistence guard');
browser=replaceOnce(browser,
`    assert.equal(await page.evaluate(()=>MajorScaleApp.exerciseHost.getCurrentContext().sessionMode),'pretest','Host carries diagnostic mode');`,
`    assert.equal(await page.evaluate(()=>MajorScaleApp.exerciseHost.getCurrentContext().sessionMode),'pretest','Host carries diagnostic mode');\n    assert.equal(await page.locator('#levelSelect').isDisabled(),true,'Diagnostic path Stage must also lock Level');`,
'browser diagnostic lock');
write('tests/exercise-routing.browser.cjs',browser);

write('tests/path-stage-enforcement.test.js',`'use strict';\nconst fs=require('fs'),assert=require('assert');\nconst trainer=fs.readFileSync('src/trainer.js','utf8');\nconst adapter=fs.readFileSync('src/exercises/major-scale/runtime-adapter.js','utf8');\nconst migration=fs.readFileSync('supabase/migrations/20260912_v091_path_stage_enforcement.sql','utf8');\nassert(trainer.includes('pathStageEnforced:false'));\nassert(trainer.includes('function effectiveSessionLevel'));\nassert(trainer.includes('if(state.pathStageEnforced){\\n    enforceAuthoritativeLevelControl();\\n    return;'));\nassert(trainer.includes('level=effectiveSessionLevel(level);'));\nassert(adapter.includes("await start(level, context.sessionMode || 'practice', context.stageCode || null);"));\nassert(/student_stage_progress[\\s\\S]*in_progress[\\s\\S]*mastered/.test(migration));\nassert(/Users can create own practice sessions/.test(migration));\nconsole.log('PASS path stage enforcement: UI/runtime/persistence authority + RLS contract');\n`);

// v0.9.1 historical-boundary restore layer: record only files that changed after v0.9.0.
const fixture={baseline:'v0.9.0',checkpoint:'v0.9.1',files:{}};
for(const file of ['src/trainer.js','src/exercises/major-scale/runtime-adapter.js','index.html']){
  const before=cp.execFileSync('git',['show',`origin/main:${file}`],{encoding:'utf8'});
  const after=read(file);
  fixture.files[file]={afterSha256:crypto.createHash('sha256').update(after).digest('hex'),beforeGzipBase64:zlib.gzipSync(Buffer.from(before)).toString('base64')};
}
write('tests/fixtures/v091-path-stage-boundary.json',JSON.stringify(fixture));
write('tests/helpers/restore-v091-path-stage.cjs',`'use strict';\nconst fs=require('fs'),path=require('path'),zlib=require('zlib'),crypto=require('crypto'),assert=require('assert');\nconst fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/v091-path-stage-boundary.json'),'utf8'));\nmodule.exports=function restoreV091(source,file){const r=fixture.files[file];if(!r)return source;const h=crypto.createHash('sha256').update(source).digest('hex');assert.equal(h,r.afterSha256,'unexpected v0.9.1 edit in '+file);return zlib.gunzipSync(Buffer.from(r.beforeGzipBase64,'base64')).toString('utf8');};\n`);

let domain=read('tests/major-scale-domain.test.js');
domain=domain.replace("const restoreV090=require('./helpers/restore-v090-master-core.cjs');","const restoreV090=require('./helpers/restore-v090-master-core.cjs');\nconst restoreV091=require('./helpers/restore-v091-path-stage.cjs');");
domain=domain.replace("restoreBeaming(restoreV090(trainer,'src/trainer.js'),'src/trainer.js')","restoreBeaming(restoreV090(restoreV091(trainer,'src/trainer.js'),'src/trainer.js'),'src/trainer.js')");
write('tests/major-scale-domain.test.js',domain);

let boundary=read('tests/notation-boundary.test.js');
boundary=boundary.replace("const restoreV090=require('./helpers/restore-v090-master-core.cjs');","const restoreV090=require('./helpers/restore-v090-master-core.cjs');\nconst restoreV091=require('./helpers/restore-v091-path-stage.cjs');");
boundary=boundary.replaceAll('restoreV090(read(file),file)','restoreV090(restoreV091(read(file),file),file)');
write('tests/notation-boundary.test.js',boundary);

console.log('Applied v0.9.1 Path Stage Enforcement');
