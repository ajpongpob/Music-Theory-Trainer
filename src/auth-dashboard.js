
(() => {
'use strict';
const $ = id => document.getElementById(id);
const screen = $('authScreen'), dashboard = $('studentDashboard'), teacherDashboard = $('teacherDashboard'), trainer = $('trainerApp');
const app = window.MajorScaleApp || {};
const authRepository = app.authRepository;
const client = app.supabaseClient;
let busy = false, ready = false, revision = 0, activeUser = null;
const PASSWORD_RESET_REDIRECT = 'https://ajpongpob.github.io/Music-Theory-Trainer/?mode=reset-password';
const passwordRecoveryIntentFromUrl = (() => {
  try{
    const url=new URL(window.location.href);
    const hashParams=new URLSearchParams((url.hash || '').replace(/^#/,''));
    return url.searchParams.get('mode')==='reset-password' || hashParams.get('type')==='recovery';
  }catch(_error){
    return false;
  }
})();
let dashboardLoadToken = 0, teacherDashboardLoadToken = 0, dashboardOpening = false, currentUserRole = null, teacherDashboardSummaryRows = [], passwordRecoveryMode = passwordRecoveryIntentFromUrl;
function message(id, text = '', error = false) {
  $(id).textContent = text;
  $(id).className = 'auth-message' + (error ? ' error' : '');
}
function controls() {
  [
    'loginButton','registerButton','showLoginButton','showRegisterButton',
    'showForgotPasswordButton','forgotPasswordButton','showLoginFromForgotButton',
    'resetPasswordButton','cancelResetPasswordButton',
    'logoutButton','dashboardLogoutButton','teacherDashboardLogoutButton',
    'teacherDashboardRefreshButton','dashboardButton'
  ].forEach(id => {
    const control=$(id);
    if(control) control.disabled = busy || !ready;
  });
}
function showAuthPanel(name) {
  const panels={
    login:$('loginPanel'),
    register:$('registerPanel'),
    forgot:$('forgotPasswordPanel'),
    reset:$('resetPasswordPanel')
  };
  Object.entries(panels).forEach(([key,element])=>{
    if(element) element.hidden=key!==name;
  });
}
function panel(register) {
  showAuthPanel(register ? 'register' : 'login');
  message('loginMessage');
  message('registerMessage');
  message('forgotMessage');
  message('resetPasswordMessage');
}
function showForgotPasswordPanel() {
  const loginEmail=$('loginEmail')?.value.trim();
  if(loginEmail) $('forgotEmail').value=loginEmail;
  showAuthPanel('forgot');
  message('forgotMessage');
}
function showResetPasswordPanel() {
  screen.hidden=false;
  dashboard.hidden=true; dashboard.inert=true;
  teacherDashboard.hidden=true; teacherDashboard.inert=true;
  trainer.hidden=true; trainer.inert=true;
  showAuthPanel('reset');
  message('resetPasswordMessage');
}
function escapeDashboardHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[ch]);
}
function dashboardStatusMeta(status) {
  const map={
    mastered:{label:'ผ่านแล้ว',icon:'✓',className:'mastered'},
    in_progress:{label:'กำลังเรียน',icon:'●',className:'in-progress'},
    locked:{label:'ยังไม่เปิด',icon:'🔒',className:'locked'},
    not_started:{label:'ยังไม่เริ่ม',icon:'○',className:'not-started'}
  };
  return map[status] || {label:status || '—',icon:'○',className:'not-started'};
}
function dashboardPercent(mastered,total) {
  if(!total) return 0;
  return Math.max(0,Math.min(100,Math.round((mastered/total)*100)));
}
function dashboardScore(value) {
  const n=Number(value);
  return Number.isFinite(n) ? `${n.toFixed(2).replace(/\.00$/,'')}%` : '—';
}
function dashboardCompletionDate(value) {
  if(!value) return '';
  const date=new Date(value);
  if(Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('th-TH',{
    day:'numeric',
    month:'short',
    year:'numeric'
  }).format(date);
}
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
    const {data,error}=await client.rpc('get_my_stage_mastery',{
      p_exercise_code:currentRow.exercise_code,
      p_stage_code:currentRow.stage_code
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
async function loadStudentDashboard() {
  if(!client || !activeUser) return;
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

    const [dashboardResult,profileResult,skillsResult]=await Promise.all([
      client.rpc('get_my_student_dashboard'),
      client.from('profiles').select('full_name').eq('id',user.id).maybeSingle(),
      client.from('skills').select('code,short_name,name_th').eq('active',true)
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

function teacherLearningStatusMeta(status) {
  const map={
    completed:{label:'สำเร็จแล้ว',className:'mastered'},
    studying:{label:'กำลังเรียน',className:'in-progress'},
    not_started:{label:'ยังไม่เริ่ม',className:'not-started'}
  };
  return map[status] || {label:status || '—',className:'not-started'};
}
function teacherGroupSummaryRows(rows) {
  const classes=new Map();
  for(const row of rows || []){
    if(!row?.class_id) continue;
    if(!classes.has(row.class_id)){
      classes.set(row.class_id,{
        id:row.class_id,
        code:row.class_code,
        name:row.class_name,
        academicYear:row.academic_year,
        term:row.term,
        active:row.class_active===true,
        studentCount:Number(row.student_count || 0),
        paths:new Map()
      });
    }
    const classRow=classes.get(row.class_id);
    if(row.learning_path_id && !classRow.paths.has(row.learning_path_id)){
      classRow.paths.set(row.learning_path_id,{
        id:row.learning_path_id,
        code:row.learning_path_code,
        name:row.learning_path_name,
        sortOrder:Number(row.learning_path_sort_order || 0),
        assignedAt:row.assigned_at
      });
    }
  }
  return [...classes.values()];
}
function teacherGroupDetailRows(rows) {
  const students=new Map();
  for(const row of rows || []){
    if(!row?.student_id) continue;
    if(!students.has(row.student_id)){
      students.set(row.student_id,{
        id:row.student_id,
        name:row.student_name || 'ผู้เรียน',
        paths:new Map()
      });
    }
    const student=students.get(row.student_id);
    if(!row.learning_path_id) continue;
    if(!student.paths.has(row.learning_path_id)){
      student.paths.set(row.learning_path_id,{
        id:row.learning_path_id,
        code:row.learning_path_code,
        name:row.learning_path_name,
        status:row.learning_path_status || 'not_started',
        learningStatus:row.learning_status || 'not_started',
        startedAt:row.path_started_at,
        masteredAt:row.path_mastered_at,
        exercises:new Map()
      });
    }
    const path=student.paths.get(row.learning_path_id);
    if(!row.exercise_id) continue;
    if(!path.exercises.has(row.exercise_id)){
      path.exercises.set(row.exercise_id,{
        id:row.exercise_id,
        code:row.exercise_code,
        name:row.exercise_name,
        sequence:Number(row.exercise_sequence || 0),
        required:row.required_for_completion===true,
        status:row.exercise_status || 'not_started',
        mastered:Number(row.stages_mastered || 0),
        total:Number(row.stages_total || 0),
        currentStageCode:row.current_stage_code,
        currentStageName:row.current_stage_name,
        currentStageSequence:row.current_stage_sequence,
        latestScore:row.latest_mastery_score
      });
    }
  }
  return [...students.values()];
}
function teacherClassLabel(classInfo) {
  const bits=[];
  if(classInfo.academicYear) bits.push(`ปีการศึกษา ${classInfo.academicYear}`);
  if(classInfo.term) bits.push(`ภาคเรียน ${classInfo.term}`);
  return bits.join(' · ');
}
function renderTeacherClassSelector(classes,preferredClassId) {
  const select=$('teacherClassSelect');
  const current=preferredClassId || select.value;
  select.innerHTML=classes.map(classInfo=>
    `<option value="${escapeDashboardHtml(classInfo.id)}">${escapeDashboardHtml(classInfo.code || '')} · ${escapeDashboardHtml(classInfo.name || 'ชั้นเรียน')}</option>`
  ).join('');
  if(current && classes.some(classInfo=>classInfo.id===current)) select.value=current;
  else if(classes[0]) select.value=classes[0].id;
  select.disabled=classes.length===0;
  return select.value || null;
}
function renderTeacherAssignedPaths(classInfo) {
  const target=$('teacherAssignedPaths');
  const paths=[...classInfo.paths.values()].sort((a,b)=>a.sortOrder-b.sortOrder);
  if(!paths.length){
    target.innerHTML='<div class="dashboard-message">ชั้นเรียนนี้ยังไม่มี Learning Path ที่ active</div>';
    return;
  }
  target.innerHTML=paths.map(path=>{
    const date=dashboardCompletionDate(path.assignedAt);
    return `<article class="teacher-path-item">
      <div>
        <strong>${escapeDashboardHtml(path.name || path.code || 'Learning Path')}</strong>
        <div class="dashboard-code">${escapeDashboardHtml(path.code || '')}</div>
      </div>
      <span>${date ? `มอบหมาย ${escapeDashboardHtml(date)}` : 'มอบหมายแล้ว'}</span>
    </article>`;
  }).join('');
}
function renderTeacherStudents(classInfo,rows) {
  const students=teacherGroupDetailRows(rows);
  $('teacherStudentListCount').textContent=`${students.length} คน`;
  $('teacherStudentCount').textContent=String(classInfo.studentCount);
  $('teacherPathCount').textContent=String(classInfo.paths.size);

  const assignedPathCount=classInfo.paths.size;
  const completedCount=students.filter(student=>{
    if(!assignedPathCount) return false;
    const assignedPathIds=[...classInfo.paths.keys()];
    return assignedPathIds.every(pathId=>student.paths.get(pathId)?.learningStatus==='completed');
  }).length;
  $('teacherCompletedCount').textContent=String(completedCount);

  const target=$('teacherStudentList');
  if(!students.length){
    target.innerHTML='<div class="dashboard-message">ยังไม่มีนักศึกษา active ในชั้นเรียนนี้</div>';
    return;
  }

  target.innerHTML=students.map(student=>{
    const pathHtml=[...student.paths.values()].map(path=>{
      const pathMeta=teacherLearningStatusMeta(path.learningStatus);
      const exercises=[...path.exercises.values()].sort((a,b)=>a.sequence-b.sequence);
      const exerciseHtml=exercises.map(exercise=>{
        const status=dashboardStatusMeta(exercise.status);
        const percent=dashboardPercent(exercise.mastered,exercise.total);
        const currentStage=exercise.currentStageName || exercise.currentStageCode;
        return `<div class="teacher-exercise-row">
          <div class="teacher-exercise-main">
            <div class="teacher-exercise-title-row">
              <strong>${escapeDashboardHtml(exercise.name || exercise.code || 'Exercise')}</strong>
              <span class="dashboard-status-badge ${escapeDashboardHtml(status.className)}">${escapeDashboardHtml(status.icon)} ${escapeDashboardHtml(status.label)}</span>
            </div>
            <div class="dashboard-code">${escapeDashboardHtml(exercise.code || '')}${exercise.required ? ' · Required' : ''}</div>
            <div class="teacher-exercise-progress">
              <div class="dashboard-progress-label"><span>Stage ${exercise.mastered} / ${exercise.total}</span><span>${percent}%</span></div>
              <div class="dashboard-progress-track"><div class="dashboard-progress-fill" style="width:${percent}%"></div></div>
            </div>
            <div class="teacher-exercise-meta">
              <span>${currentStage ? `กำลังเรียน: ${escapeDashboardHtml(currentStage)}` : (exercise.status==='mastered' ? 'ผ่านทุก Stage แล้ว' : 'ยังไม่มี Stage ที่กำลังเรียน')}</span>
              <span>Mastery ล่าสุด: <strong>${dashboardScore(exercise.latestScore)}</strong></span>
            </div>
          </div>
        </div>`;
      }).join('');
      return `<section class="teacher-student-path">
        <div class="teacher-student-path-head">
          <div>
            <strong>${escapeDashboardHtml(path.name || path.code || 'Learning Path')}</strong>
            <div class="dashboard-code">${escapeDashboardHtml(path.code || '')}</div>
          </div>
          <span class="dashboard-status-badge ${escapeDashboardHtml(pathMeta.className)}">${escapeDashboardHtml(pathMeta.label)}</span>
        </div>
        <div class="teacher-exercise-list">${exerciseHtml || '<div class="dashboard-message">ยังไม่มี Exercise ที่ active ใน Path นี้</div>'}</div>
      </section>`;
    }).join('');

    return `<article class="teacher-student-card">
      <div class="teacher-student-head">
        <div class="teacher-student-avatar" aria-hidden="true">${escapeDashboardHtml((student.name || 'ผ').trim().charAt(0) || 'ผ')}</div>
        <div>
          <h3>${escapeDashboardHtml(student.name || 'ผู้เรียน')}</h3>
          <div class="dashboard-code">${escapeDashboardHtml(student.id)}</div>
        </div>
      </div>
      <div class="teacher-student-paths">${pathHtml || '<div class="dashboard-message">ยังไม่มี Learning Path progress สำหรับผู้เรียนคนนี้</div>'}</div>
    </article>`;
  }).join('');
}
async function loadTeacherClassDashboard(classId,token) {
  const classes=teacherGroupSummaryRows(teacherDashboardSummaryRows);
  const classInfo=classes.find(item=>item.id===classId);
  if(!classInfo) throw new Error('ไม่พบชั้นเรียนที่เลือก');

  $('teacherClassMeta').textContent=[classInfo.code,classInfo.name,teacherClassLabel(classInfo)].filter(Boolean).join(' · ');
  renderTeacherAssignedPaths(classInfo);

  const {data,error}=await client.rpc('get_my_teacher_class_dashboard',{p_class_id:classId});
  if(error) throw error;
  if(token!==teacherDashboardLoadToken) return;
  renderTeacherStudents(classInfo,Array.isArray(data) ? data : []);
}
async function loadTeacherDashboard({preferredClassId=null}={}) {
  if(!client || !activeUser) return;
  const token=++teacherDashboardLoadToken;
  const messageBox=$('teacherDashboardMessage');
  const content=$('teacherDashboardContent');
  messageBox.hidden=false;
  messageBox.className='dashboard-message';
  messageBox.textContent='กำลังโหลดข้อมูลชั้นเรียน...';
  content.hidden=true;

  try{
    const {data:{user},error:userError}=await authRepository.getUser();
    if(userError) throw userError;
    if(!user) throw new Error('Authentication required');

    const [summaryResult,profileResult]=await Promise.all([
      client.rpc('get_my_teacher_dashboard'),
      client.from('profiles').select('full_name,role').eq('id',user.id).maybeSingle()
    ]);
    if(summaryResult.error) throw summaryResult.error;
    if(token!==teacherDashboardLoadToken) return;

    teacherDashboardSummaryRows=Array.isArray(summaryResult.data) ? summaryResult.data : [];
    const profileName=profileResult?.data?.full_name || user.user_metadata?.full_name || user.email || 'ผู้สอน';
    $('teacherDashboardUserName').textContent=profileName;
    if(profileResult?.error) console.warn('LOAD TEACHER PROFILE WARNING:',profileResult.error);

    const classes=teacherGroupSummaryRows(teacherDashboardSummaryRows);
    if(!classes.length){
      $('teacherClassSelect').innerHTML='';
      $('teacherClassSelect').disabled=true;
      $('teacherClassMeta').textContent='';
      content.hidden=true;
      messageBox.hidden=false;
      messageBox.className='dashboard-message';
      messageBox.textContent='ยังไม่มีชั้นเรียนที่คุณเป็นผู้สอน';
      return;
    }

    const selectedClassId=renderTeacherClassSelector(classes,preferredClassId);
    await loadTeacherClassDashboard(selectedClassId,token);
    if(token!==teacherDashboardLoadToken) return;
    messageBox.hidden=true;
    content.hidden=false;
  }catch(error){
    console.error('LOAD TEACHER DASHBOARD ERROR:',error);
    if(token!==teacherDashboardLoadToken) return;
    content.hidden=true;
    messageBox.hidden=false;
    messageBox.className='dashboard-message error';
    messageBox.textContent='โหลด Teacher Dashboard ไม่สำเร็จ: '+(error.message || 'กรุณาลองใหม่');
  }
}
async function resolveAuthenticatedRole() {
  if(!client || !activeUser) return 'student';
  const {data,error}=await authRepository.getUserRole(activeUser);
  if(error) throw error;
  return data?.role || 'student';
}
async function showTeacherDashboardForAuthenticatedUser({closeSession=false}={}) {
  if(!activeUser) return;
  if(closeSession){
    const closeTrainerSession=window.majorScaleTrainerClosePracticeSession;
    if(typeof closeTrainerSession==='function') await closeTrainerSession();
  }
  screen.hidden=true;
  dashboard.hidden=true; dashboard.inert=true;
  teacherDashboard.hidden=false; teacherDashboard.inert=false;
  trainer.hidden=true; trainer.inert=true;
  $('sessionSummary').hidden=true;
  $('levelMasteryOverlay').hidden=true;
  await loadTeacherDashboard({preferredClassId:$('teacherClassSelect')?.value || null});
}

async function showDashboardForAuthenticatedUser({closeSession=false}={}) {
  if(!activeUser) return;
  try{
    currentUserRole=await resolveAuthenticatedRole();
  }catch(error){
    console.error('RESOLVE USER ROLE ERROR:',error);
    currentUserRole='student';
  }
  if(currentUserRole==='teacher' || currentUserRole==='admin'){
    await showTeacherDashboardForAuthenticatedUser({closeSession});
    return;
  }
  if(closeSession){
    const closeTrainerSession=window.majorScaleTrainerClosePracticeSession;
    if(typeof closeTrainerSession==='function') await closeTrainerSession();
  }
  screen.hidden=true;
  teacherDashboard.hidden=true; teacherDashboard.inert=true;
  dashboard.hidden=false;
  dashboard.inert=false;
  trainer.hidden=true;
  trainer.inert=true;
  $('sessionSummary').hidden=true;
  $('levelMasteryOverlay').hidden=true;
  await loadStudentDashboard();
}
async function openExerciseFromDashboard(exerciseCode,stageCode) {
  if(dashboardOpening) return;
  if(exerciseCode!=='MAJOR_SCALE_NOTATION'){
    alert('แบบฝึกหัดนี้ยังไม่มีหน้าฝึกในเวอร์ชันปัจจุบัน');
    return;
  }
  dashboardOpening=true;
  try{
    const match=/^STAGE_(\d+)$/.exec(stageCode || '');
    const select=$('levelSelect');
    if(match && select) select.value=String(Number(match[1]));

    dashboard.hidden=true;
    dashboard.inert=true;
    teacherDashboard.hidden=true;
    teacherDashboard.inert=true;
    trainer.hidden=false;
    trainer.inert=false;

    const startTrainer=window.majorScaleTrainerStartForAuthenticatedUser;
    const requestedLevel=match ? Number(match[1]) : null;
    if(typeof startTrainer==='function') await startTrainer(requestedLevel);
    else $('restartSession').click();

    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    requestAnimationFrame(() => window.dispatchEvent(new Event('major-scale-trainer-visible')));
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
function sessionView(session) {
  const user = session?.user?.id || null;
  const changed = user !== activeUser;
  activeUser = user;
  if(passwordRecoveryMode){
    showResetPasswordPanel();
    return;
  }
  screen.hidden = !!user;
  if (!user) {
    dashboardLoadToken++;
    teacherDashboardLoadToken++;
    currentUserRole=null;
    teacherDashboardSummaryRows=[];
    dashboard.hidden = true; dashboard.inert = true;
    teacherDashboard.hidden = true; teacherDashboard.inert = true;
    trainer.hidden = true; trainer.inert = true;
    $('sessionSummary').hidden = true;
    $('levelMasteryOverlay').hidden = true;
    panel(false);
  }
  if (changed) {
    $('loginPassword').value = ''; $('registerPassword').value = '';
    if (user) {
      Promise.resolve(showDashboardForAuthenticatedUser()).catch(error=>{
        console.error('SHOW DASHBOARD ERROR:',error);
      });
    }
  }
}
// Prevent document-level notation shortcuts while the authentication screen is open.
for (const type of ['keydown','keyup']) window.addEventListener(type, event => {
  if (screen.hidden && dashboard.hidden && teacherDashboard.hidden) return;
  if (type === 'keydown' && event.key === 'Enter' && !event.isComposing) {
    event.preventDefault();
    if (event.target.tagName === 'BUTTON') event.target.click();
    else {
      const button=!$('resetPasswordPanel').hidden
        ? $('resetPasswordButton')
        : !$('forgotPasswordPanel').hidden
          ? $('forgotPasswordButton')
          : !$('registerPanel').hidden
            ? $('registerButton')
            : $('loginButton');
      button?.click();
    }
  }
  event.stopImmediatePropagation();
}, true);
$('showRegisterButton').addEventListener('click', () => panel(true));
$('showLoginButton').addEventListener('click', () => panel(false));
$('showForgotPasswordButton').addEventListener('click', showForgotPasswordPanel);
$('showLoginFromForgotButton').addEventListener('click', () => panel(false));

async function sendPasswordResetEmail(){
  if(busy || !ready) return;
  const email=$('forgotEmail').value.trim();
  if(!email) return message('forgotMessage','กรุณากรอกอีเมล',true);
  if(!$('forgotEmail').checkValidity()) return message('forgotMessage','กรุณากรอกอีเมลให้ถูกต้อง',true);

  busy=true; controls();
  message('forgotMessage','กำลังส่งลิงก์ตั้งรหัสผ่านใหม่...');
  try{
    const {error}=await authRepository.resetPasswordForEmail(email,PASSWORD_RESET_REDIRECT);
    if(error) throw error;
    message('forgotMessage','หากอีเมลนี้มีบัญชี ระบบได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่แล้ว กรุณาตรวจสอบกล่องจดหมายและโฟลเดอร์สแปม');
  }catch(error){
    message('forgotMessage','ส่งลิงก์ไม่สำเร็จ: '+(error.message || 'กรุณาลองใหม่ภายหลัง'),true);
  }finally{
    busy=false; controls();
  }
}

async function saveRecoveredPassword(){
  if(busy || !ready) return;
  const password=$('resetPassword').value;
  const confirmPassword=$('resetPasswordConfirm').value;
  if(!password || !confirmPassword) return message('resetPasswordMessage','กรุณากรอกรหัสผ่านใหม่ให้ครบทั้งสองช่อง',true);
  if(password!==confirmPassword) return message('resetPasswordMessage','รหัสผ่านทั้งสองช่องไม่ตรงกัน',true);

  busy=true; controls();
  message('resetPasswordMessage','กำลังบันทึกรหัสผ่านใหม่...');
  try{
    const {error}=await authRepository.updatePassword(password);
    if(error) throw error;

    $('resetPassword').value='';
    $('resetPasswordConfirm').value='';
    if(window.history?.replaceState){
      window.history.replaceState({},document.title,window.location.pathname);
    }

    const {error:signOutError}=await authRepository.signOutLocal();
    if(signOutError) throw signOutError;

    passwordRecoveryMode=false;
    sessionView(null);
    panel(false);
    message('loginMessage','ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่');
  }catch(error){
    message('resetPasswordMessage','ตั้งรหัสผ่านใหม่ไม่สำเร็จ: '+(error.message || 'ลิงก์อาจหมดอายุ กรุณาขอลิงก์ใหม่'),true);
  }finally{
    busy=false; controls();
  }
}

$('forgotPasswordButton').addEventListener('click', sendPasswordResetEmail);
$('resetPasswordButton').addEventListener('click', saveRecoveredPassword);
$('cancelResetPasswordButton').addEventListener('click', async()=>{
  if(busy || !ready) return;
  busy=true; controls();
  try{
    await authRepository.signOutLocal();
  }finally{
    passwordRecoveryMode=false;
    if(window.history?.replaceState){
      window.history.replaceState({},document.title,window.location.pathname);
    }
    sessionView(null);
    panel(false);
    busy=false; controls();
  }
});

async function submit(register) {
  if (busy || !ready) return;
  const prefix = register ? 'register' : 'login';
  const email = $(prefix+'Email').value.trim(), password = $(prefix+'Password').value;
  const name = register ? $('registerName').value.trim() : '';
  if (!email || !password || (register && !name)) return message(prefix+'Message','กรุณากรอกข้อมูลให้ครบ',true);
  if (!$(prefix+'Email').checkValidity()) return message(prefix+'Message','กรุณากรอกอีเมลให้ถูกต้อง',true);
  busy = true; controls(); message(prefix+'Message', register ? 'กำลังสมัครสมาชิก...' : 'กำลังเข้าสู่ระบบ...');
  try {
    const {data, error} = register
      ? await authRepository.signUp({email,password,fullName:name})
      : await authRepository.signInWithPassword({email,password});
    if (error) throw error;
    if (data.session?.user) sessionView(data.session);
    else if (register) {
      $('registerPassword').value = ''; $('loginEmail').value = email;
      message('registerMessage','สมัครสำเร็จ กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชี แล้วกลับมาเข้าสู่ระบบ');
    } else throw new Error('ยังไม่ได้รับ session กรุณาลองเข้าสู่ระบบอีกครั้ง');
  } catch (error) {
    message(prefix+'Message',(register ? 'สมัครไม่สำเร็จ: ' : 'เข้าสู่ระบบไม่สำเร็จ: ')+(error.message || 'กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่'),true);
  } finally { busy = false; controls(); }
}
$('loginButton').addEventListener('click', () => submit(false));
$('registerButton').addEventListener('click', () => submit(true));
$('dashboardLogoutButton').addEventListener('click', () => $('logoutButton').click());
$('teacherDashboardLogoutButton').addEventListener('click', () => $('logoutButton').click());
$('teacherDashboardRefreshButton').addEventListener('click', () => {
  Promise.resolve(loadTeacherDashboard({preferredClassId:$('teacherClassSelect')?.value || null})).catch(error=>{
    console.error('REFRESH TEACHER DASHBOARD ERROR:',error);
  });
});
$('teacherClassSelect').addEventListener('change', () => {
  const classId=$('teacherClassSelect').value;
  if(!classId) return;
  const token=++teacherDashboardLoadToken;
  const messageBox=$('teacherDashboardMessage');
  const content=$('teacherDashboardContent');
  messageBox.hidden=false;
  messageBox.className='dashboard-message';
  messageBox.textContent='กำลังโหลดข้อมูลชั้นเรียน...';
  content.hidden=true;
  Promise.resolve(loadTeacherClassDashboard(classId,token)).then(()=>{
    if(token!==teacherDashboardLoadToken) return;
    messageBox.hidden=true;
    content.hidden=false;
  }).catch(error=>{
    console.error('CHANGE TEACHER CLASS ERROR:',error);
    if(token!==teacherDashboardLoadToken) return;
    content.hidden=true;
    messageBox.hidden=false;
    messageBox.className='dashboard-message error';
    messageBox.textContent='โหลดข้อมูลชั้นเรียนไม่สำเร็จ: '+(error.message || 'กรุณาลองใหม่');
  });
});
$('dashboardButton').addEventListener('click', () => {
  Promise.resolve(showDashboardForAuthenticatedUser({closeSession:true})).catch(error=>{
    console.error('RETURN TO DASHBOARD ERROR:',error);
  });
});
dashboard.addEventListener('click', event => {
  const button=event.target.closest('.dashboard-continue[data-exercise-code]');
  if(!button) return;
  openExerciseFromDashboard(button.dataset.exerciseCode,button.dataset.stageCode);
});
$('logoutButton').addEventListener('click', async () => {
  if (busy || !ready) return;
  busy = true; controls();
  try {
    const closeTrainerSession=
      window.majorScaleTrainerClosePracticeSession;

    if(typeof closeTrainerSession==="function"){
      await closeTrainerSession();
    }

    const {error} = await authRepository.signOutLocal();
    if (error) throw error;
    sessionView(null);
  } catch (error) { alert('ออกจากระบบไม่สำเร็จ: '+(error.message || 'กรุณาลองใหม่')); }
  finally { busy = false; controls(); }
});
async function initializeAuth() {
  controls(); message('loginMessage','กำลังตรวจสอบการเข้าสู่ระบบ...');
  try {
    if (!client || !authRepository) {
      throw app.supabaseClientError || new Error('โหลดระบบเข้าสู่ระบบไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วรีเฟรชหน้า');
    }
    authRepository.onAuthStateChange((event, session) => {
      revision++;
      if(event==='PASSWORD_RECOVERY') passwordRecoveryMode=true;
      if(passwordRecoveryMode){
        if(event==='SIGNED_OUT'){
          passwordRecoveryMode=false;
          sessionView(null);
          return;
        }
        activeUser=session?.user?.id || activeUser;
        showResetPasswordPanel();
        return;
      }
      sessionView(session);
    });
    const start = revision;
    const {data,error} = await authRepository.getSession();
    if (error) throw error;
    if(passwordRecoveryMode){
      activeUser=data.session?.user?.id || activeUser;
      showResetPasswordPanel();
    }else if (start === revision){
      sessionView(data.session);
    }
    ready = true;
  } catch (error) {
    sessionView(null);
    ready = !!client;
    message('loginMessage',error.message || 'ตรวจสอบ session ไม่สำเร็จ กรุณาลองใหม่',true);
  } finally { controls(); }
}
// Wait until the existing trainer has installed its event handlers.
document.addEventListener('DOMContentLoaded', initializeAuth, {once:true});
})();

