(() => {
'use strict';
const app = window.MajorScaleApp = window.MajorScaleApp || {};
const $ = id => document.getElementById(id);
const authRepository = app.authRepository;
const dashboardRepository = app.dashboardRepository;
const learningRepository = app.learningRepository;
const masteryLearningCore = app.masteryLearningCore;
const dashboard = $('studentDashboard');
const teacherDashboard = $('teacherDashboard');
const trainer = $('trainerApp');
const utils = app.dashboardUtils || {};
const {escapeDashboardHtml,dashboardStatusMeta,dashboardPercent,dashboardScore,dashboardCompletionDate} = utils;
let activeUser = null;
let dashboardLoadToken = 0;
let dashboardOpening = false;

function buildDashboardPaths(rows) {
  const paths=new Map();
  for(const row of rows || []){
    const pathKey=row.learning_path_id || row.learning_path_code || 'path';
    if(!paths.has(pathKey)){
      paths.set(pathKey,{
        id:row.learning_path_id,
        code:row.learning_path_code,
        name:row.learning_path_name,
        status:row.learning_path_status,
        startedAt:row.path_started_at,
        masteredAt:row.path_mastered_at,
        exercises:new Map()
      });
    }
    const path=paths.get(pathKey);
    const exerciseKey=row.exercise_id || row.exercise_code || 'exercise';
    if(!path.exercises.has(exerciseKey)){
      path.exercises.set(exerciseKey,{
        id:row.exercise_id,
        code:row.exercise_code,
        name:row.exercise_name,
        sequence:Number(row.exercise_sequence || 0),
        required:row.required_for_completion===true,
        status:row.exercise_status,
        startedAt:row.exercise_started_at,
        masteredAt:row.exercise_mastered_at,
        stages:[]
      });
    }
    if(row.stage_id || row.stage_code){
      path.exercises.get(exerciseKey).stages.push({
        id:row.stage_id,
        code:row.stage_code,
        name:row.stage_name,
        sequence:Number(row.stage_sequence || 0),
        status:row.stage_status,
        lastMasteryScore:row.last_mastery_score,
        startedAt:row.stage_started_at,
        masteredAt:row.stage_mastered_at
      });
    }
  }
  return [...paths.values()].map(path=>({
    ...path,
    exercises:[...path.exercises.values()]
      .sort((a,b)=>a.sequence-b.sequence)
      .map(exercise=>({
        ...exercise,
        stages:exercise.stages.sort((a,b)=>a.sequence-b.sequence)
      }))
  }));
}
function renderDashboardRows(rows) {
  const paths=buildDashboardPaths(rows);
  const pathList=$('dashboardPathList');
  const allRows=Array.isArray(rows) ? rows : [];
  const currentRow=allRows.find(row=>row.stage_status==='in_progress') || null;

  if(!paths.length){
    pathList.innerHTML='<div class="dashboard-card"><div class="dashboard-message">ยังไม่มี Learning Path ที่ลงทะเบียนไว้</div></div>';
  }else{
    pathList.innerHTML=paths.map(path=>{
      const pathStatus=dashboardStatusMeta(path.status);
      const requiredExercises=path.exercises.filter(exercise=>exercise.required);
      const progressExercises=requiredExercises.length ? requiredExercises : path.exercises;
      const pathStages=progressExercises.flatMap(exercise=>exercise.stages);
      const pathMastered=pathStages.filter(stage=>stage.status==='mastered').length;
      const pathTotal=pathStages.length;
      const pathPct=dashboardPercent(pathMastered,pathTotal);
      const pathCompletedDate=dashboardCompletionDate(path.masteredAt);

      const exerciseHtml=path.exercises.map(exercise=>{
        const exerciseStatus=dashboardStatusMeta(exercise.status);
        const mastered=exercise.stages.filter(stage=>stage.status==='mastered').length;
        const total=exercise.stages.length;
        const pct=dashboardPercent(mastered,total);
        const currentStage=exercise.stages.find(stage=>stage.status==='in_progress');
        const reviewStage=[...exercise.stages].reverse().find(stage=>stage.status==='mastered') || null;
        const exerciseCompletedDate=dashboardCompletionDate(exercise.masteredAt);
        const stageHtml=exercise.stages.map(stage=>{
          const meta=dashboardStatusMeta(stage.status);
          const stageCompletedDate=dashboardCompletionDate(stage.masteredAt);
          const detail=stage.status==='mastered'
            ? `คะแนนเมื่อผ่าน ${dashboardScore(stage.lastMasteryScore)}${stageCompletedDate ? ` · ${stageCompletedDate}` : ''}`
            : meta.label;
          return `<div class="dashboard-stage ${meta.className}">
            <div class="dashboard-stage-title">${meta.icon} ${escapeDashboardHtml(stage.name || stage.code || 'Stage')}</div>
            <div class="dashboard-stage-meta">${escapeDashboardHtml(detail)}</div>
          </div>`;
        }).join('');
        const canContinue=!!currentStage;
        const canReview=exercise.status==='mastered' && !!reviewStage;
        const action=canContinue
          ? `<button type="button" class="dashboard-continue" data-exercise-code="${escapeDashboardHtml(exercise.code)}" data-stage-code="${escapeDashboardHtml(currentStage.code)}">เรียนต่อ →</button>`
          : canReview
            ? `<button type="button" class="dashboard-continue" data-exercise-code="${escapeDashboardHtml(exercise.code)}" data-stage-code="${escapeDashboardHtml(reviewStage.code)}" data-review="true">ทบทวน</button>`
            : `<button type="button" class="dashboard-continue" disabled>ยังไม่เปิด</button>`;

        return `<section class="dashboard-exercise">
          <div class="dashboard-exercise-head">
            <div>
              <h3 class="dashboard-exercise-name">${escapeDashboardHtml(exercise.name || exercise.code || 'Exercise')}</h3>
              <div class="dashboard-code">${escapeDashboardHtml(exercise.code || '')}</div>
              ${exerciseCompletedDate ? `<div class="dashboard-stage-meta">สำเร็จเมื่อ ${escapeDashboardHtml(exerciseCompletedDate)}</div>` : ''}
            </div>
            <span class="dashboard-status-badge ${exerciseStatus.className}">${exerciseStatus.icon} ${exerciseStatus.label}</span>
          </div>
          <div class="dashboard-progress-wrap">
            <div class="dashboard-progress-label"><span>ความก้าวหน้าของแบบฝึกหัด</span><span>ผ่าน ${mastered} จาก ${total} ขั้น</span></div>
            <div class="dashboard-progress-track"><div class="dashboard-progress-fill" style="width:${pct}%"></div></div>
          </div>
          <div class="dashboard-stage-rail">${stageHtml || '<div class="dashboard-message">ยังไม่มีขั้นการเรียน</div>'}</div>
          <div class="dashboard-exercise-actions">${action}</div>
        </section>`;
      }).join('');

      return `<section class="dashboard-card">
        <div class="dashboard-path-head">
          <div>
            <div class="dashboard-focus-label">เส้นทางการเรียนรู้</div>
            <h2 class="dashboard-path-name">${escapeDashboardHtml(path.name || path.code || 'Learning Path')}</h2>
            <div class="dashboard-code">${escapeDashboardHtml(path.code || '')}</div>
            ${pathCompletedDate ? `<div class="dashboard-stage-meta">สำเร็จเมื่อ ${escapeDashboardHtml(pathCompletedDate)}</div>` : ''}
          </div>
          <span class="dashboard-status-badge ${pathStatus.className}">${pathStatus.icon} ${pathStatus.label}</span>
        </div>
        <div class="dashboard-progress-wrap">
          <div class="dashboard-progress-label"><span>ความก้าวหน้า</span><span>ผ่าน ${pathMastered} จาก ${pathTotal} ขั้น · ${pathPct}%</span></div>
          <div class="dashboard-progress-track"><div class="dashboard-progress-fill" style="width:${pathPct}%"></div></div>
        </div>
        <div class="dashboard-exercise-list">${exerciseHtml}</div>
      </section>`;
    }).join('');
  }

  if(currentRow){
    $('dashboardFocusLabel').textContent='ขั้นที่กำลังเรียน';
    $('dashboardFocusTitle').textContent=currentRow.stage_name || currentRow.stage_code || 'ขั้นที่กำลังเรียน';
    $('dashboardFocusExercise').textContent=currentRow.exercise_name || currentRow.exercise_code || '';
    const status=dashboardStatusMeta(currentRow.stage_status);
    $('dashboardFocusStatus').className=`dashboard-status-badge ${status.className}`;
    $('dashboardFocusStatus').textContent=`${status.icon} ${status.label}`;
  }else{
    const completedPath=paths.find(path=>path.status==='mastered') || null;
    const completedExercise=[...paths]
      .flatMap(path=>path.exercises)
      .find(exercise=>exercise.status==='mastered') || null;

    if(completedPath){
      const completedDate=dashboardCompletionDate(completedPath.masteredAt);
      $('dashboardFocusLabel').textContent='สถานะการเรียน';
      $('dashboardFocusTitle').textContent='เรียนจบเส้นทางนี้แล้ว';
      $('dashboardFocusExercise').textContent=completedPath.name || completedPath.code || '';
      $('dashboardFocusStatus').className='dashboard-status-badge mastered';
      $('dashboardFocusStatus').textContent='✓ สำเร็จแล้ว';
      $('dashboardMasteryBody').className='';
      $('dashboardMasteryBody').innerHTML=`
        <div class="dashboard-mastery-summary">
          <div class="dashboard-mastery-stat"><strong>ครบทุกขั้น</strong><span>ผ่านแบบฝึกหัดที่กำหนดในเส้นทางนี้แล้ว</span></div>
          <div class="dashboard-mastery-stat"><strong>${completedDate ? escapeDashboardHtml(completedDate) : 'สำเร็จแล้ว'}</strong><span>วันที่สำเร็จเส้นทางการเรียนรู้</span></div>
        </div>`;
    }else if(completedExercise){
      const completedDate=dashboardCompletionDate(completedExercise.masteredAt);
      $('dashboardFocusLabel').textContent='สถานะการเรียน';
      $('dashboardFocusTitle').textContent='แบบฝึกหัดสำเร็จแล้ว';
      $('dashboardFocusExercise').textContent=completedExercise.name || completedExercise.code || '';
      $('dashboardFocusStatus').className='dashboard-status-badge mastered';
      $('dashboardFocusStatus').textContent='✓ ผ่านแล้ว';
      $('dashboardMasteryBody').className='dashboard-message';
      $('dashboardMasteryBody').textContent=completedDate
        ? `สำเร็จเมื่อ ${completedDate}`
        : 'แบบฝึกหัดนี้ผ่านครบทุกขั้นแล้ว';
    }else{
      $('dashboardFocusLabel').textContent='สถานะการเรียน';
      $('dashboardFocusTitle').textContent='ไม่มีขั้นที่กำลังเรียน';
      $('dashboardFocusExercise').textContent='';
      $('dashboardFocusStatus').className='dashboard-status-badge not-started';
      $('dashboardFocusStatus').textContent='—';
      $('dashboardMasteryBody').className='dashboard-message';
      $('dashboardMasteryBody').textContent='ยังไม่มีขั้นที่ต้องแสดงผลการเรียน';
    }
  }

  return currentRow;
}
async function loadDashboardCurrentMastery(currentRow,skillNameMap,token) {
  if(!currentRow || !currentRow.exercise_code || !currentRow.stage_code) return;
  const body=$('dashboardMasteryBody');
  body.className='dashboard-message';
  body.textContent='กำลังโหลดผลการเรียน...';
  try{
    const {data,error}=await dashboardRepository.getStageMastery({
      exerciseCode:currentRow.exercise_code,
      stageCode:currentRow.stage_code
    });
    if(error) throw error;
    if(token!==dashboardLoadToken) return;
    const mastery=Array.isArray(data) ? data[0] : data;
    if(!mastery) throw new Error('ไม่พบข้อมูลความก้าวหน้าของขั้นที่กำลังเรียน');

    const overall=Number(mastery.overall_score);
    const threshold=Number(mastery.overall_threshold);
    const attempts=Number(mastery.attempts_found || 0);
    const windowSize=Number(mastery.rolling_window || 0);
    const skills=Array.isArray(mastery.skill_results) ? mastery.skill_results : [];
    const stateText=mastery.mastery_passed===true
      ? 'ผ่านเกณฑ์ของขั้นนี้'
      : mastery.enough_attempts!==true
        ? 'กำลังสะสมผลการฝึก'
        : mastery.coverage_passed!==true
          ? 'ยังทำโจทย์ที่กำหนดไม่ครบ'
          : mastery.skills_passed!==true
            ? 'ยังมีทักษะที่ต้องพัฒนา'
            : 'กำลังพัฒนา';

    const skillHtml=skills.map(skill=>{
      const score=Number(skill.score);
      const target=Number(skill.threshold);
      const hasScore=Number.isFinite(score);
      const passed=skill.passed===true;
      const name=skillNameMap.get(skill.skill_code) || skill.skill_code || 'ทักษะ';
      return `<div class="dashboard-skill-row">
        <div>
          <div class="dashboard-skill-name">${escapeDashboardHtml(name)}</div>
          <div class="dashboard-skill-threshold">เกณฑ์ ${Number.isFinite(target) ? `${target}%` : '—'}</div>
        </div>
        <div class="dashboard-skill-score ${passed ? 'pass' : 'needs-work'}">${hasScore ? `${score.toFixed(2).replace(/\.00$/,'')}%` : '—'} ${passed ? '✓' : ''}</div>
      </div>`;
    }).join('');

    body.className='';
    body.innerHTML=`
      <div class="dashboard-mastery-summary">
        <div class="dashboard-mastery-stat"><strong>${Number.isFinite(overall) ? `${overall.toFixed(2).replace(/\.00$/,'')}%` : '—'}</strong><span>คะแนนรวม · เกณฑ์ ${Number.isFinite(threshold) ? `${threshold}%` : '—'}</span></div>
        <div class="dashboard-mastery-stat"><strong>${attempts} / ${windowSize || '—'} ข้อ</strong><span>ผลการฝึกล่าสุดที่ใช้ประเมิน</span></div>
      </div>
      <div class="dashboard-progress-wrap">
        <div class="dashboard-progress-label"><span>${escapeDashboardHtml(stateText)}</span><span>${mastery.coverage_passed===true ? 'ทำโจทย์ที่กำหนดครบ ✓' : 'ทำโจทย์ที่กำหนดยังไม่ครบ'}</span></div>
        <div class="dashboard-progress-track"><div class="dashboard-progress-fill" style="width:${Number.isFinite(overall) ? Math.max(0,Math.min(100,overall)) : 0}%"></div></div>
      </div>
      <div class="dashboard-skill-list">${skillHtml || '<div class="dashboard-message">ยังไม่มีผลรายทักษะ</div>'}</div>`;
  }catch(error){
    console.error('LOAD DASHBOARD MASTERY ERROR:',error);
    if(token!==dashboardLoadToken) return;
    body.className='dashboard-message error';
    body.textContent='โหลดผลการเรียนไม่สำเร็จ กรุณาลองใหม่';
  }
}
function renderDashboardRecommendation(rawRecommendation,skillNameMap){
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
    ? `<div class="dashboard-recommendation-target">เป้าหมาย: ${escapeDashboardHtml(skillName)}</div>`
    : recommendation.targetItemCode
      ? `<div class="dashboard-recommendation-target">โจทย์เป้าหมาย: ${escapeDashboardHtml(recommendation.targetItemCode)}</div>`
      : '';
  const canLaunch=!!(recommendation.exerciseCode && recommendation.stageCode && recommendation.actionType!=='completed');
  const sessionMode=recommendation.actionType==='diagnostic' ? 'pretest' : 'practice';
  const label=masteryLearningCore?.recommendationActionLabel(recommendation) || 'เรียนต่อ';
  const action=canLaunch
    ? `<button type="button" class="dashboard-continue dashboard-recommendation-action" data-exercise-code="${escapeDashboardHtml(recommendation.exerciseCode)}" data-stage-code="${escapeDashboardHtml(recommendation.stageCode)}" data-session-mode="${sessionMode}">${escapeDashboardHtml(label)} →</button>`
    : '';
  box.innerHTML=`
    <div class="dashboard-focus-label">คำแนะนำถัดไป</div>
    <div class="dashboard-recommendation-title">${escapeDashboardHtml(label)}</div>
    <div class="dashboard-stage-meta">${escapeDashboardHtml(recommendation.reasonTh || '')}</div>
    ${target}
    ${action}`;
}

async function loadStudentDashboard() {
  if(!dashboardRepository || !activeUser) return;
  const token=++dashboardLoadToken;
  const messageBox=$('dashboardMessage');
  const content=$('dashboardContent');
  messageBox.hidden=false;
  messageBox.className='dashboard-message';
  messageBox.textContent='กำลังโหลดความก้าวหน้า...';
  content.hidden=true;

  try{
    const {data:{user},error:userError}=await authRepository.getUser();
    if(userError) throw userError;
    if(!user) throw new Error('Authentication required');

    if(learningRepository){
      const progression=await learningRepository.ensureProgression();
      if(progression?.error) console.warn('ENSURE LEARNING PROGRESSION WARNING:',progression.error);
    }

    const [dashboardResult,profileResult,skillsResult,recommendationResult]=await Promise.all([
      dashboardRepository.getStudentDashboard(),
      dashboardRepository.getStudentProfile(user.id),
      dashboardRepository.getActiveSkills(),
      learningRepository ? learningRepository.getRecommendedNextAction() : Promise.resolve({data:null,error:null})
    ]);
    if(dashboardResult.error) throw dashboardResult.error;
    if(token!==dashboardLoadToken) return;

    const profileName=profileResult?.data?.full_name || user.user_metadata?.full_name || user.email || 'ผู้เรียน';
    $('dashboardUserName').textContent=profileName;

    if(profileResult?.error) console.warn('LOAD DASHBOARD PROFILE WARNING:',profileResult.error);
    if(skillsResult?.error) console.warn('LOAD DASHBOARD SKILLS WARNING:',skillsResult.error);

    const skillNameMap=new Map((skillsResult?.data || []).map(skill=>[
      skill.code,
      skill.name_th || skill.short_name || skill.code
    ]));
    const rows=Array.isArray(dashboardResult.data) ? dashboardResult.data : [];
    const currentRow=renderDashboardRows(rows);
    if(recommendationResult?.error){
      console.warn('LOAD RECOMMENDATION WARNING:',recommendationResult.error);
      renderDashboardRecommendation(null,skillNameMap);
    }else{
      renderDashboardRecommendation(recommendationResult?.data,skillNameMap);
    }

    messageBox.hidden=true;
    content.hidden=false;
    await loadDashboardCurrentMastery(currentRow,skillNameMap,token);
  }catch(error){
    console.error('LOAD STUDENT DASHBOARD ERROR:',error);
    if(token!==dashboardLoadToken) return;
    content.hidden=true;
    messageBox.hidden=false;
    messageBox.className='dashboard-message error';
    messageBox.textContent='โหลด Dashboard ไม่สำเร็จ: '+(error.message || 'กรุณาลองใหม่');
  }
}


async function openExerciseFromDashboard(exerciseCode,stageCode,sessionMode='practice') {
  if(dashboardOpening) return;
  dashboardOpening=true;
  try{
    const host=app.exerciseHost;
    if(!host) throw new Error('Exercise Host ยังไม่พร้อมใช้งาน');
    const result=await host.launch({exerciseCode,stageCode,userId:activeUser,sessionMode});
    if(!result.ok && result.message) alert(result.message);
    return result;
  }catch(error){
    console.error('OPEN EXERCISE FROM DASHBOARD ERROR:',error);
    trainer.hidden=true;
    trainer.inert=true;
    dashboard.hidden=false;
    dashboard.inert=false;
    alert('เปิดแบบฝึกหัดไม่สำเร็จ: '+(error.message || 'กรุณาลองใหม่'));
  }finally{
    dashboardOpening=false;
  }
}


app.studentDashboard = Object.freeze({
  async load({activeUser: userId} = {}) {
    activeUser = userId || null;
    return loadStudentDashboard();
  },
  openExercise(exerciseCode, stageCode, sessionMode='practice') {
    return openExerciseFromDashboard(exerciseCode, stageCode, sessionMode);
  },
  invalidate() {
    app.exerciseHost?.close();
    activeUser = null;
    dashboardLoadToken++;
    dashboardOpening = false;
  }
});
})();
