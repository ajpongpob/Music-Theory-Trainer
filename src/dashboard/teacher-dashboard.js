(() => {
'use strict';
const app = window.MajorScaleApp = window.MajorScaleApp || {};
const $ = id => document.getElementById(id);
const client = app.supabaseClient;
const authRepository = app.authRepository;
const utils = app.dashboardUtils || {};
const {escapeDashboardHtml,dashboardStatusMeta,dashboardPercent,dashboardScore,dashboardCompletionDate} = utils;
let activeUser = null;
let teacherDashboardLoadToken = 0;
let teacherDashboardSummaryRows = [];

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


async function selectTeacherClass(classId) {
  if(!classId) return;
  const token=++teacherDashboardLoadToken;
  const messageBox=$('teacherDashboardMessage');
  const content=$('teacherDashboardContent');
  messageBox.hidden=false;
  messageBox.className='dashboard-message';
  messageBox.textContent='กำลังโหลดข้อมูลชั้นเรียน...';
  content.hidden=true;
  try {
    await loadTeacherClassDashboard(classId,token);
    if(token!==teacherDashboardLoadToken) return;
    messageBox.hidden=true;
    content.hidden=false;
  } catch(error) {
    console.error('CHANGE TEACHER CLASS ERROR:',error);
    if(token!==teacherDashboardLoadToken) return;
    content.hidden=true;
    messageBox.hidden=false;
    messageBox.className='dashboard-message error';
    messageBox.textContent='โหลดข้อมูลชั้นเรียนไม่สำเร็จ: '+(error.message || 'กรุณาลองใหม่');
  }
}

app.teacherDashboard = Object.freeze({
  async load({activeUser: userId, preferredClassId=null} = {}) {
    activeUser = userId || null;
    return loadTeacherDashboard({preferredClassId});
  },
  async refresh({activeUser: userId, preferredClassId=null} = {}) {
    activeUser = userId || null;
    return loadTeacherDashboard({preferredClassId});
  },
  selectClass(classId) {
    return selectTeacherClass(classId);
  },
  invalidate() {
    activeUser = null;
    teacherDashboardLoadToken++;
    teacherDashboardSummaryRows=[];
  }
});
})();
