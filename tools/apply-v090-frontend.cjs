'use strict';
const fs=require('fs');

function read(file){return fs.readFileSync(file,'utf8');}
function write(file,source){fs.mkdirSync(require('path').dirname(file),{recursive:true});fs.writeFileSync(file,source);}
function replaceOnce(source,before,after,label){
  const count=source.split(before).length-1;
  if(count!==1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(before,after);
}
function patch(file,fn){const source=read(file);write(file,fn(source));}

patch('index.html',source=>{
  source=source.replace('<title>Major Scale Notation Trainer — v0.8.1-a</title>','<title>Major Scale Notation Trainer — v0.9.0</title>');
  source=replaceOnce(source,
    '        <div id="dashboardMasteryBody" class="dashboard-message" style="margin-top:14px;">กำลังโหลดผลการเรียน...</div>',
    '        <div id="dashboardRecommendation" class="dashboard-recommendation" aria-live="polite"></div>\n        <div id="dashboardMasteryBody" class="dashboard-message" style="margin-top:14px;">กำลังโหลดผลการเรียน...</div>',
    'dashboard recommendation slot');
  source=replaceOnce(source,
    '<script src="./src/data/mastery.repository.js"></script>\n<script src="./src/domain/notation/notation-core.js"></script>',
    '<script src="./src/data/mastery.repository.js"></script>\n<script src="./src/data/learning.repository.js"></script>\n<script src="./src/domain/mastery/mastery-learning-core.js"></script>\n<script src="./src/domain/notation/notation-core.js"></script>',
    'learning scripts');
  return source;
});

patch('src/data/practice.repository.js',source=>replaceOnce(source,
`  getOpenPracticeSessions(userId) {
    return getClient()
      .from('practice_sessions')
      .select('id,started_at,last_activity_at')
      .eq('user_id', userId)
      .eq('mode', 'practice')
      .is('completed_at', null);
  },`,
`  getOpenPracticeSessions(userId) {
    return getClient()
      .from('practice_sessions')
      .select('id,started_at,last_activity_at')
      .eq('user_id', userId)
      .eq('mode', 'practice')
      .is('completed_at', null);
  },

  getOpenLearningSessions(userId) {
    return getClient()
      .from('practice_sessions')
      .select('id,started_at,last_activity_at,mode')
      .eq('user_id', userId)
      .in('mode', ['practice','pretest'])
      .is('completed_at', null);
  },`,
'open learning sessions'));

patch('src/dashboard/student-dashboard.js',source=>{
  source=replaceOnce(source,
    'const dashboardRepository = app.dashboardRepository;\nconst dashboard =',
    'const dashboardRepository = app.dashboardRepository;\nconst learningRepository = app.learningRepository;\nconst masteryLearningCore = app.masteryLearningCore;\nconst dashboard =',
    'student deps');

  const marker='async function loadStudentDashboard() {';
  const recommendation=`function renderDashboardRecommendation(rawRecommendation,skillNameMap){
  const box=$('dashboardRecommendation');
  if(!box) return;
  const recommendation=masteryLearningCore?.normalizeRecommendation(rawRecommendation);
  if(!recommendation){
    box.innerHTML='';
    box.hidden=true;
    return;
  }
  box.hidden=false;
  const skillName=recommendation.targetSkillCode
    ? (skillNameMap.get(recommendation.targetSkillCode) || recommendation.targetSkillCode)
    : null;
  const target=skillName
    ? \`<div class="dashboard-recommendation-target">เป้าหมาย: \${escapeDashboardHtml(skillName)}</div>\`
    : recommendation.targetItemCode
      ? \`<div class="dashboard-recommendation-target">โจทย์เป้าหมาย: \${escapeDashboardHtml(recommendation.targetItemCode)}</div>\`
      : '';
  const canLaunch=!!(recommendation.exerciseCode && recommendation.stageCode && recommendation.actionType!=='completed');
  const sessionMode=recommendation.actionType==='diagnostic' ? 'pretest' : 'practice';
  const label=masteryLearningCore?.recommendationActionLabel(recommendation) || 'เรียนต่อ';
  const action=canLaunch
    ? \`<button type="button" class="dashboard-continue dashboard-recommendation-action" data-exercise-code="\${escapeDashboardHtml(recommendation.exerciseCode)}" data-stage-code="\${escapeDashboardHtml(recommendation.stageCode)}" data-session-mode="\${sessionMode}">\${escapeDashboardHtml(label)} →</button>\`
    : '';
  box.innerHTML=\`
    <div class="dashboard-focus-label">คำแนะนำถัดไป</div>
    <div class="dashboard-recommendation-title">\${escapeDashboardHtml(label)}</div>
    <div class="dashboard-stage-meta">\${escapeDashboardHtml(recommendation.reasonTh || '')}</div>
    \${target}
    \${action}\`;
}

`;
  source=replaceOnce(source,marker,recommendation+marker,'recommendation renderer');

  source=replaceOnce(source,
`    const [dashboardResult,profileResult,skillsResult]=await Promise.all([
      dashboardRepository.getStudentDashboard(),
      dashboardRepository.getStudentProfile(user.id),
      dashboardRepository.getActiveSkills()
    ]);`,
`    if(learningRepository){
      const progression=await learningRepository.ensureProgression();
      if(progression?.error) console.warn('ENSURE LEARNING PROGRESSION WARNING:',progression.error);
    }

    const [dashboardResult,profileResult,skillsResult,recommendationResult]=await Promise.all([
      dashboardRepository.getStudentDashboard(),
      dashboardRepository.getStudentProfile(user.id),
      dashboardRepository.getActiveSkills(),
      learningRepository ? learningRepository.getRecommendedNextAction() : Promise.resolve({data:null,error:null})
    ]);`,
'load recommendation');

  source=replaceOnce(source,
`    const currentRow=renderDashboardRows(rows);

    messageBox.hidden=true;`,
`    const currentRow=renderDashboardRows(rows);
    if(recommendationResult?.error){
      console.warn('LOAD RECOMMENDATION WARNING:',recommendationResult.error);
      renderDashboardRecommendation(null,skillNameMap);
    }else{
      renderDashboardRecommendation(recommendationResult?.data,skillNameMap);
    }

    messageBox.hidden=true;`,
'render recommendation');

  source=replaceOnce(source,
`async function openExerciseFromDashboard(exerciseCode,stageCode) {`,
`async function openExerciseFromDashboard(exerciseCode,stageCode,sessionMode='practice') {`,
'open signature');
  source=replaceOnce(source,
`    const result=await host.launch({exerciseCode,stageCode,userId:activeUser});`,
`    const result=await host.launch({exerciseCode,stageCode,userId:activeUser,sessionMode});`,
'host launch mode');
  source=replaceOnce(source,
`  openExercise(exerciseCode, stageCode) {
    return openExerciseFromDashboard(exerciseCode, stageCode);
  },`,
`  openExercise(exerciseCode, stageCode, sessionMode='practice') {
    return openExerciseFromDashboard(exerciseCode, stageCode, sessionMode);
  },`,
'public open mode');
  return source;
});

patch('src/auth-dashboard.js',source=>replaceOnce(source,
`  studentDashboardController?.openExercise?.(button.dataset.exerciseCode,button.dataset.stageCode);`,
`  studentDashboardController?.openExercise?.(button.dataset.exerciseCode,button.dataset.stageCode,button.dataset.sessionMode || 'practice');`,
'dashboard delegated mode'));

patch('src/trainer.js',source=>{
  source=replaceOnce(source,
    'const notationCore=window.MajorScaleApp.notationCore;',
    'const masteryLearningCore=window.MajorScaleApp.masteryLearningCore;\nconst learningRepository=window.MajorScaleApp.learningRepository;\nconst notationCore=window.MajorScaleApp.notationCore;',
    'trainer learning deps');
  source=replaceOnce(source,
    ' masteryPriorityItemCodes:[]\n};',
    ' masteryPriorityItemCodes:[],\n sessionMode:"practice",\n diagnosticItemCodes:[]\n};',
    'trainer state mode');

  source=replaceOnce(source,
`function takeNextQuestionFromBag(){
  const next=majorScaleModule.takeNextQuestion({`,
`function takeNextQuestionFromBag(){
  if(state.sessionMode==="pretest"){
    return state.sessionBag.shift() || null;
  }
  const next=majorScaleModule.takeNextQuestion({`,
'diagnostic bag');

  source=replaceOnce(source,
`        mode:"practice",
        completed_questions:0,
        app_version:"0.8.1-a"`,
`        mode:state.sessionMode,
        planned_questions:Number.isInteger(state.sessionLength) ? state.sessionLength : null,
        completed_questions:0,
        app_version:"0.9.0"`,
'session payload');

  source=replaceOnce(source,
`    const {data:sessions,error:sessionError}=
      await practiceRepository.getOpenPracticeSessions(
        user.id
      );`,
`    const loadOpen=practiceRepository.getOpenLearningSessions
      ? practiceRepository.getOpenLearningSessions.bind(practiceRepository)
      : practiceRepository.getOpenPracticeSessions.bind(practiceRepository);
    const {data:sessions,error:sessionError}=await loadOpen(user.id);`,
'close open learning sessions');

  source=replaceOnce(source,
`async function startTrainerForAuthenticatedUser(levelOverride=null){
  await closeStalePracticeSessionsForCurrentUser();`,
`async function startTrainerForAuthenticatedUser(levelOverride=null,sessionMode="practice"){
  await closeStalePracticeSessionsForCurrentUser();
  state.sessionMode=masteryLearningCore?.normalizeSessionMode(sessionMode) || "practice";`,
'start signature');

  source=replaceOnce(source,
`  console.log(
    "CURRENT LEARNING LEVEL:",
    level
  );

  startSession();

  const mastery=
    await refreshMasteryProgress(level);`,
`  console.log(
    "CURRENT LEARNING LEVEL:",
    level,
    "MODE:",
    state.sessionMode
  );

  state.diagnosticItemCodes=[];
  if(state.sessionMode==="pretest"){
    const masteryRepository=window.MajorScaleApp?.masteryRepository;
    const {stageId}=await resolveMajorScaleExerciseStage(level);
    const required=masteryRepository
      ? await masteryRepository.getRequiredStageItems(stageId)
      : {data:[],error:null};
    if(required?.error) throw required.error;
    state.diagnosticItemCodes=masteryLearningCore.buildDiagnosticItemCodes(
      required?.data || [],
      LEVEL_KEYS[level] || []
    );
    if(!state.diagnosticItemCodes.length){
      throw new Error("ไม่มีโจทย์ Diagnostic สำหรับ Stage นี้");
    }
  }

  const levelSelect=document.getElementById("levelSelect");
  if(levelSelect) levelSelect.disabled=state.sessionMode==="pretest";
  startSession();

  const mastery=state.sessionMode==="practice"
    ? await refreshMasteryProgress(level)
    : null;`,
'prepare diagnostic');

  source=replaceOnce(source,
`  state.sessionQueue=[];
  state.sessionBag=[];
  state.sessionLength=null;
  state.masteryPriorityItemCodes=[];`,
`  state.sessionQueue=[];
  state.sessionBag=[];
  state.sessionLength=state.sessionMode==="pretest" ? state.diagnosticItemCodes.length : null;
  state.masteryPriorityItemCodes=[];`,
'session diagnostic length');

  source=replaceOnce(source,
`  refillSessionBag();
  startQuestion(takeNextQuestionFromBag());`,
`  if(state.sessionMode==="pretest"){
    state.sessionBag=state.diagnosticItemCodes
      .map(code=>KEYS.find(key=>key.tonic===code))
      .filter(Boolean);
  }else{
    refillSessionBag();
  }
  const firstQuestion=takeNextQuestionFromBag();
  if(firstQuestion) startQuestion(firstQuestion);`,
'session diagnostic start');

  source=replaceOnce(source,
`    let mastery=null;

    if(skillResultsSaved){`,
`    let mastery=null;
    let diagnosticPlacement=null;

    if(skillResultsSaved){`,
'placement result variable');

  source=replaceOnce(source,
`      if(progressSaved){
        mastery=await advanceLevelIfMastered({
          generation,
          level,
          practiceSessionId
        });
      }`,
`      if(progressSaved){
        if(state.sessionMode==="pretest"){
          if(masteryLearningCore.diagnosticComplete(completedQuestions,state.sessionLength)){
            const sessionOverall=state.sessionResults.length
              ? Math.round(state.sessionResults.reduce((sum,item)=>sum+Number(item.score || 0),0)/state.sessionResults.length)
              : null;
            await completePracticeSessionRecord(practiceSessionId,sessionOverall);
            const placementResponse=await learningRepository.applyDiagnosticPlacement(majorScaleConfig.exerciseCode);
            if(placementResponse?.error) throw placementResponse.error;
            diagnosticPlacement=masteryLearningCore.firstResult(placementResponse?.data);
          }
        }else{
          mastery=await advanceLevelIfMastered({
            generation,
            level,
            practiceSessionId
          });
        }
      }`,
'practice vs diagnostic persistence');

  source=replaceOnce(source,
`    return {
      attemptId:data.id,
      mastery
    };`,
`    return {
      attemptId:data.id,
      mastery,
      diagnosticPlacement
    };`,
'save result placement');

  source=replaceOnce(source,
`let pendingLevelMasteryTransition=null;
let questionResultHideTimer=0;`,
`let pendingLevelMasteryTransition=null;
let pendingDiagnosticPlacement=null;
let questionResultHideTimer=0;`,
'pending diagnostic');

  source=replaceOnce(source,
`        const mastery=saveResult?.mastery;

        await refreshMasteryProgress(attemptLevel);

        if(mastery?.advanced){`,
`        const mastery=saveResult?.mastery;
        const diagnosticPlacement=saveResult?.diagnosticPlacement;

        if(state.sessionMode==="practice") await refreshMasteryProgress(attemptLevel);

        if(diagnosticPlacement){
          pendingDiagnosticPlacement=diagnosticPlacement;
          const nextButton=document.getElementById("nextQuestion");
          if(nextButton){nextButton.disabled=true;nextButton.hidden=true;}
          setQuestionResultAction({disabled:false,text:"ดูแผนการเรียนที่แนะนำ"});
        }else if(mastery?.advanced){`,
'post-save diagnostic transition');

  source=replaceOnce(source,
`document.getElementById("questionResultContinue").onclick=()=>{
  const mastery=pendingLevelMasteryTransition;`,
`document.getElementById("questionResultContinue").onclick=()=>{
  if(pendingDiagnosticPlacement){
    pendingDiagnosticPlacement=null;
    hideQuestionResultTransition({immediate:true});
    document.getElementById("dashboardButton")?.click();
    return;
  }
  const mastery=pendingLevelMasteryTransition;`,
'diagnostic result return');

  source=replaceOnce(source,
`  return \`
    <strong>เขียนบันไดเสียง \${state.key.name}</strong>
    <span>ขาขึ้น–ขาลงตาม Rhythm Pattern โดยใส่ accidental, stem และ beam ให้ถูกต้อง</span>
    \${fontWarning}
  \`;`,
`  const diagnostic=state.sessionMode==="pretest";
  return \`
    <strong>\${diagnostic ? "แบบประเมินก่อนเรียน • " : "เขียนบันไดเสียง "}\${state.key.name}</strong>
    <span>\${diagnostic ? "ใช้คำตอบนี้เพื่อวิเคราะห์จุดเริ่มต้น โดยยังใช้เกณฑ์การเขียนเดียวกับแบบฝึก" : "ขาขึ้น–ขาลงตาม Rhythm Pattern โดยใส่ accidental, stem และ beam ให้ถูกต้อง"}</span>
    \${fontWarning}
  \`;`,
'task diagnostic label');

  return source;
});

patch('styles/app.css',source=>source+`\n/* v0.9.0 Mastery Learning Core */\n.dashboard-recommendation{margin-top:14px;padding:14px;border:1px solid #d0d5dd;border-radius:12px;background:#f8fafc}.dashboard-recommendation-title{font-weight:800;font-size:1.05rem;margin:4px 0}.dashboard-recommendation-target{margin-top:6px;font-weight:700}.dashboard-recommendation-action{margin-top:10px}\n`);

console.log('Applied v0.9.0 frontend integration');
