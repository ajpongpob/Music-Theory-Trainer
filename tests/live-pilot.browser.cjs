'use strict';

// M1.1 live production verification.
// This suite is intentionally NOT part of automatic pull-request QA because it
// writes disposable evidence for a dedicated QA learner in the live project.
// Run only with dedicated QA credentials and LIVE_TEST_CONFIRM=YES.

const assert=require('assert');
const path=require('path');
const {pathToFileURL}=require('url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const APP_URL=process.env.LIVE_APP_URL || 'https://ajpongpob.github.io/Music-Theory-Trainer/';
const STUDENT_EMAIL=process.env.QA_STUDENT_EMAIL || '';
const STUDENT_PASSWORD=process.env.QA_STUDENT_PASSWORD || '';
const TEACHER_EMAIL=process.env.QA_TEACHER_EMAIL || '';
const TEACHER_PASSWORD=process.env.QA_TEACHER_PASSWORD || '';
const QA_CLASS_ID=process.env.QA_CLASS_ID || '';
const EXPECT_TEACHER_STUDENT=process.env.QA_EXPECT_STUDENT_IN_TEACHER === 'YES';

function requireLiveGuard(){
  assert.equal(process.env.LIVE_TEST_CONFIRM,'YES','Refusing live QA without LIVE_TEST_CONFIRM=YES');
  assert(STUDENT_EMAIL && STUDENT_PASSWORD,'QA_STUDENT_EMAIL and QA_STUDENT_PASSWORD are required');
  assert(/^https:\/\//.test(APP_URL),'LIVE_APP_URL must be HTTPS');
}

function safeError(error){
  return String(error?.message || error || 'Unknown error').replace(STUDENT_EMAIL,'<qa-student>');
}

async function waitForStudentDashboard(page){
  await page.waitForFunction(()=>{
    const el=document.getElementById('studentDashboard');
    return el && !el.hidden;
  },{timeout:30000});
  await page.waitForFunction(()=>{
    const el=document.getElementById('dashboardContent');
    return el && !el.hidden;
  },{timeout:30000});
}

async function waitForLearningPathStageLock(page){
  await page.waitForFunction(()=>{
    const select=document.getElementById('levelSelect');
    return !!select && select.disabled===true;
  },{timeout:30000});
}

async function loginStudent(page){
  await page.goto(APP_URL,{waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('#loginEmail').fill(STUDENT_EMAIL);
  await page.locator('#loginPassword').fill(STUDENT_PASSWORD);
  await page.locator('#loginButton').click();
  await waitForStudentDashboard(page);
}

async function logoutFromStudent(page){
  await page.locator('#dashboardLogoutButton').click();
  await page.waitForFunction(()=>{
    const el=document.getElementById('authScreen');
    return el && !el.hidden;
  },{timeout:30000});
}

async function getLiveStudentContext(page){
  return page.evaluate(async()=>{
    const app=window.MajorScaleApp;
    if(!app?.authRepository || !app?.learningRepository || !app?.dashboardRepository){
      throw new Error('Application repositories are not ready');
    }

    const userResult=await app.authRepository.getUser();
    if(userResult.error) throw userResult.error;
    const user=userResult.data?.user;
    if(!user) throw new Error('No authenticated QA student');

    const ensureResult=await app.learningRepository.ensureProgression();
    if(ensureResult?.error) throw ensureResult.error;

    const [recommendationResult,dashboardResult]=await Promise.all([
      app.learningRepository.getRecommendedNextAction(),
      app.dashboardRepository.getStudentDashboard()
    ]);
    if(recommendationResult?.error) throw recommendationResult.error;
    if(dashboardResult?.error) throw dashboardResult.error;

    const recommendation=app.masteryLearningCore?.normalizeRecommendation(recommendationResult.data) || null;
    const rows=Array.isArray(dashboardResult.data) ? dashboardResult.data : [];
    const activeRow=rows.find(row=>row.stage_status==='in_progress') || null;
    const exerciseCode=recommendation?.exerciseCode || activeRow?.exercise_code || null;
    const stageCode=recommendation?.stageCode || activeRow?.stage_code || null;

    return {
      userId:user.id,
      exerciseCode,
      stageCode,
      actionType:recommendation?.actionType || null,
      pathCode:recommendation?.pathCode || activeRow?.learning_path_code || null,
      dashboardRowCount:rows.length
    };
  });
}

async function exerciseRoutingSmoke(page,context){
  const selector=`.dashboard-continue[data-exercise-code="${context.exerciseCode}"][data-stage-code="${context.stageCode}"]`;
  const button=page.locator(selector).first();
  assert(await button.count(),'Dashboard must expose a launch action for the active Stage');
  await button.click();
  await page.waitForFunction(()=>{
    const trainer=document.getElementById('trainerApp');
    return trainer && !trainer.hidden && window.MajorScaleApp?.exerciseHost?.getCurrentContext?.();
  },{timeout:30000});
  await waitForLearningPathStageLock(page);
  assert.equal(await page.locator('#levelSelect').isDisabled(),true,'Learning Path launch must lock Stage/Level');
  const hostContext=await page.evaluate(()=>window.MajorScaleApp.exerciseHost.getCurrentContext());
  assert.equal(hostContext.exerciseCode,context.exerciseCode,'Exercise Host must preserve live exercise code');
  assert.equal(hostContext.stageCode,context.stageCode,'Exercise Host must preserve live Stage code');
  await page.locator('#dashboardButton').click();
  await waitForStudentDashboard(page);
}

async function resolveStageData(page,context){
  return page.evaluate(async({exerciseCode,stageCode})=>{
    const app=window.MajorScaleApp;
    const exerciseResult=await app.practiceRepository.getRequiredActiveExerciseByCode(exerciseCode);
    if(exerciseResult.error) throw exerciseResult.error;
    const stageResult=await app.practiceRepository.getRequiredActiveStageByCode(exerciseResult.data.id,stageCode);
    if(stageResult.error) throw stageResult.error;
    const itemsResult=await app.masteryRepository.getRequiredStageItems(stageResult.data.id);
    if(itemsResult.error) throw itemsResult.error;
    const items=Array.isArray(itemsResult.data) ? itemsResult.data : [];
    if(!items.length) throw new Error('Active Stage has no required items');
    return {exerciseId:exerciseResult.data.id,stageId:stageResult.data.id,itemCode:items[0].item_code};
  },context);
}

async function createLiveQaSession(page,studentContext,stageData){
  return page.evaluate(async({userId,exerciseId,stageId})=>{
    const app=window.MajorScaleApp;
    const result=await app.practiceRepository.createPracticeSession({
      user_id:userId,
      exercise_id:exerciseId,
      stage_id:stageId,
      mode:'practice',
      planned_questions:1,
      completed_questions:0
    });
    if(result.error) throw result.error;
    return result.data.id;
  },{userId:studentContext.userId,...stageData});
}

async function submitTrustedAttempt(page,{sessionId,itemCode,responseJson,questionNumber=1}){
  return page.evaluate(async payload=>{
    const result=await window.MajorScaleApp.practiceRepository.createAttempt({
      practice_session_id:payload.sessionId,
      question_number:payload.questionNumber,
      item_code:payload.itemCode,
      response_json:payload.responseJson,
      // Deliberately untrusted values: repository/Edge must ignore these.
      score:0,
      skill_results:[{skill_code:'BN01_TREBLE_PITCH',score:0}]
    });
    if(result.error) throw result.error;
    return result.data;
  },{sessionId,itemCode,responseJson,questionNumber});
}

async function verifyDirectEvidenceWritesDenied(page,{sessionId,attemptId,itemCode}){
  return page.evaluate(async payload=>{
    const client=window.MajorScaleApp.supabaseClient;
    const directAttempt=await client.from('attempts').insert({
      practice_session_id:payload.sessionId,
      question_number:2,
      item_code:payload.itemCode,
      score:100,
      response_json:{qa_forged:true}
    });
    const directSkill=await client.from('attempt_skill_results').insert({
      attempt_id:payload.attemptId,
      skill_code:'BN01_TREBLE_PITCH',
      correct_count:1,
      total_count:1,
      score:100,
      evidence_flags:[true]
    });
    return {
      attemptDenied:!!directAttempt.error,
      skillDenied:!!directSkill.error
    };
  },{sessionId,attemptId,itemCode});
}

async function verifyPersistedEvidence(page,{attemptId,sessionId}){
  return page.evaluate(async payload=>{
    const client=window.MajorScaleApp.supabaseClient;
    const attemptResult=await client.from('attempts')
      .select('id,practice_session_id,question_number,item_code,score,response_json')
      .eq('id',payload.attemptId)
      .single();
    if(attemptResult.error) throw attemptResult.error;
    const skillsResult=await client.from('attempt_skill_results')
      .select('skill_code,correct_count,total_count,score,evidence_flags')
      .eq('attempt_id',payload.attemptId);
    if(skillsResult.error) throw skillsResult.error;
    const sessionResult=await client.from('practice_sessions')
      .select('id,app_version,completed_questions,exercise_id,stage_id')
      .eq('id',payload.sessionId)
      .single();
    if(sessionResult.error) throw sessionResult.error;
    return {attempt:attemptResult.data,skills:skillsResult.data,session:sessionResult.data};
  },{attemptId,sessionId});
}

async function closeQaSession(page,sessionId){
  const completedAt=new Date().toISOString();
  await page.evaluate(async({sessionId,completedAt})=>{
    const result=await window.MajorScaleApp.practiceRepository.closePracticeSession({sessionId,completedAt,onlyIfOpen:true});
    if(result.error) throw result.error;
  },{sessionId,completedAt});
}

async function teacherSmoke(browser,studentId){
  if(!TEACHER_EMAIL || !TEACHER_PASSWORD){
    return {status:'SKIPPED',reason:'QA teacher credentials not configured'};
  }
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await context.newPage();
  try{
    await page.goto(APP_URL,{waitUntil:'domcontentloaded',timeout:30000});
    await page.locator('#loginEmail').fill(TEACHER_EMAIL);
    await page.locator('#loginPassword').fill(TEACHER_PASSWORD);
    await page.locator('#loginButton').click();
    await page.waitForFunction(()=>{
      const el=document.getElementById('teacherDashboard');
      return el && !el.hidden;
    },{timeout:30000});
    await page.waitForFunction(()=>{
      const msg=document.getElementById('teacherDashboardMessage');
      const content=document.getElementById('teacherDashboardContent');
      return (content && !content.hidden) || (msg && /ยังไม่มีชั้นเรียน/.test(msg.textContent || ''));
    },{timeout:30000});

    if(QA_CLASS_ID){
      const option=page.locator(`#teacherClassSelect option[value="${QA_CLASS_ID}"]`);
      assert(await option.count(),`QA_CLASS_ID ${QA_CLASS_ID} must be visible to the QA teacher`);
      await page.locator('#teacherClassSelect').selectOption(QA_CLASS_ID);
      await page.waitForTimeout(300);
    }

    if(EXPECT_TEACHER_STUDENT){
      const text=await page.locator('#teacherStudentList').innerText();
      assert(text.includes(studentId),'Teacher Dashboard must contain the dedicated QA student');
    }
    return {status:'PASS'};
  }finally{
    await context.close();
  }
}

(async()=>{
  requireLiveGuard();
  const scoring=await import(pathToFileURL(path.join(__dirname,'..','supabase','functions','submit-major-scale-attempt','scoring.mjs')).href);
  const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL || 'chrome'});
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await context.newPage();
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(error.message));
  page.on('console',message=>{if(message.type()==='error') console.error('LIVE-BROWSER',message.text());});

  try{
    await loginStudent(page);
    const studentContext=await getLiveStudentContext(page);
    assert(studentContext.userId,'QA student user id is required');
    assert(studentContext.dashboardRowCount>0,'QA student must have an assigned Learning Path');
    assert(studentContext.exerciseCode && studentContext.stageCode,'QA student must have an active Stage; reset the dedicated QA account if its Path is already completed');

    await exerciseRoutingSmoke(page,studentContext);

    const stageData=await resolveStageData(page,studentContext);
    assert(scoring.SUPPORTED_TONICS.includes(stageData.itemCode),`Required item ${stageData.itemCode} must be a supported Major key`);
    const responseJson={notes:scoring.buildExpected(stageData.itemCode).map(note=>({
      letter:note.letter,
      octave:note.octave,
      accidental:note.accidental || '',
      rhythm:note.rhythm,
      stem:note.stem,
      beamGroup:note.beamGroup ?? null
    }))};

    const sessionId=await createLiveQaSession(page,studentContext,stageData);
    assert(sessionId,'Live QA practice session must be created');

    const attempt=await submitTrustedAttempt(page,{sessionId,itemCode:stageData.itemCode,responseJson});
    assert(attempt.id,'Authoritative server attempt id is required');
    assert.equal(attempt.scoring_authority,'server','Live attempt must be server-authoritative');
    assert.equal(Number(attempt.score),100,'Correct live response must score 100');

    const denied=await verifyDirectEvidenceWritesDenied(page,{sessionId,attemptId:attempt.id,itemCode:stageData.itemCode});
    assert.equal(denied.attemptDenied,true,'Authenticated browser must not directly insert attempts');
    assert.equal(denied.skillDenied,true,'Authenticated browser must not directly insert attempt_skill_results');

    const tampered=JSON.parse(JSON.stringify(responseJson));
    tampered.notes[0].letter=tampered.notes[0].letter==='C'?'D':'C';
    const retry=await submitTrustedAttempt(page,{sessionId,itemCode:stageData.itemCode,responseJson:tampered});
    assert.equal(retry.id,attempt.id,'Retry must preserve the immutable attempt id');
    assert.equal(Number(retry.score),100,'Retry must preserve the original persisted score');

    const persisted=await verifyPersistedEvidence(page,{attemptId:attempt.id,sessionId});
    assert.equal(persisted.attempt.id,attempt.id,'Persisted attempt must match server response');
    assert.equal(Number(persisted.attempt.score),100,'Persisted score must remain authoritative');
    assert.equal(persisted.skills.length,5,'Exactly five trusted skill evidence rows are required');
    assert(persisted.skills.every(row=>Number(row.score)===100),'Correct response must persist 100 for all five skills');
    assert.equal(persisted.session.app_version,'0.9.3','Live session provenance must record v0.9.3');
    assert.equal(Number(persisted.session.completed_questions),1,'Server persistence must advance completed_questions');

    const mastery=await page.evaluate(async({exerciseCode,stageCode})=>{
      const result=await window.MajorScaleApp.masteryRepository.getStageMastery({exerciseCode,stageCode});
      if(result.error) throw result.error;
      return window.MajorScaleApp.masteryLearningCore.firstResult(result.data);
    },studentContext);
    assert(mastery,'Live Mastery RPC must return a result');
    assert(Number(mastery.attempts_found)>=1,'Live Mastery must see the authoritative attempt');

    await closeQaSession(page,sessionId);

    await page.reload({waitUntil:'domcontentloaded'});
    await waitForStudentDashboard(page);
    await logoutFromStudent(page);
    await page.locator('#loginEmail').fill(STUDENT_EMAIL);
    await page.locator('#loginPassword').fill(STUDENT_PASSWORD);
    await page.locator('#loginButton').click();
    await waitForStudentDashboard(page);

    const teacherResult=await teacherSmoke(browser,studentContext.userId);
    assert.deepEqual(pageErrors,[],'Live browser must not raise uncaught page errors');

    console.log(JSON.stringify({
      status:'PASS',
      appUrl:APP_URL,
      student:{
        exerciseCode:studentContext.exerciseCode,
        stageCode:studentContext.stageCode,
        actionType:studentContext.actionType,
        itemCode:stageData.itemCode,
        score:attempt.score,
        evidenceRows:persisted.skills.length,
        appVersion:persisted.session.app_version
      },
      security:{directAttemptInsertDenied:true,directSkillInsertDenied:true,immutableRetry:true},
      persistence:{reload:true,logoutLogin:true,masteryVisible:true},
      teacher:teacherResult
    },null,2));
  }catch(error){
    console.error('LIVE PILOT QA FAILED:',safeError(error));
    process.exitCode=1;
  }finally{
    await context.close();
    await browser.close();
  }
})();