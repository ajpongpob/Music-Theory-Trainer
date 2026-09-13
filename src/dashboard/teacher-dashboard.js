(() => {
'use strict';

const app = window.MajorScaleApp = window.MajorScaleApp || {};
const $ = id => document.getElementById(id);
const authRepository = app.authRepository;
const dashboardRepository = app.dashboardRepository;
const utils = app.dashboardUtils || {};
const escapeHtml = utils.escapeDashboardHtml || (value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])));
const dashboardScore = utils.dashboardScore || (value => value == null ? '—' : Math.round(Number(value)) + '%');
const dashboardCompletionDate = utils.dashboardCompletionDate || (() => '');

const SKILL_LABELS = Object.freeze({
  BN01_TREBLE_PITCH:'Treble Pitch',
  BN06_STEM_DIRECTION:'Stem Direction',
  RH01_DURATION_VALUE:'Duration Value',
  GR02_PRIMARY_BEAM:'Primary Beam',
  MS03_SCALE_ACCIDENTAL:'Scale Accidental'
});
const ALL_CLASSES='__ALL__';

let activeUser=null;
let teacherDashboardLoadToken=0;
let teacherDashboardSummaryRows=[];
let teacherClassData=[];
let selectedScope=null;
let selectedStudentKey=null;
let filters={search:'',stage:'all',status:'all'};
let sortState={key:'name',dir:'asc'};
let panelState={createClass:false,addStudent:false,busy:false,message:'',error:false};

function finite(value){
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}
function pct(value){
  return finite(value) ? Math.round(Number(value)) + '%' : '—';
}
function dateValue(value){
  const n=Date.parse(value || '');
  return Number.isFinite(n) ? n : 0;
}
function latestIso(a,b){
  return dateValue(a) >= dateValue(b) ? a : b;
}
function statusMeta(status){
  if(status==='mastered' || status==='completed') return {label:'สำเร็จแล้ว',className:'mastered'};
  if(status==='in_progress' || status==='studying') return {label:'กำลังเรียน',className:'in-progress'};
  return {label:'ยังไม่เริ่ม',className:'not-started'};
}

function teacherGroupSummaryRows(rows){
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
    const classInfo=classes.get(row.class_id);
    if(row.learning_path_id && !classInfo.paths.has(row.learning_path_id)){
      classInfo.paths.set(row.learning_path_id,{
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

function teacherGroupDetailRows(rows,classInfo){
  const students=new Map();
  for(const row of rows || []){
    if(!row?.student_id) continue;
    if(!students.has(row.student_id)){
      students.set(row.student_id,{
        id:row.student_id,
        name:row.student_name || 'ผู้เรียน',
        classId:classInfo.id,
        classCode:classInfo.code,
        className:classInfo.name,
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
        latestScore:row.latest_mastery_score,
        feedback:row.learning_feedback || null
      });
    }
  }
  return [...students.values()];
}

function deriveStudent(student){
  let sessions=0,attempts=0,latestActivity=null,currentStage=null,latestScore=null;
  const skillBuckets=new Map();
  const overallScores=[];
  const paths=[...student.paths.values()];
  let completedPaths=0;
  for(const path of paths){
    if(path.learningStatus==='completed') completedPaths++;
    for(const exercise of path.exercises.values()){
      if(exercise.currentStageCode && !currentStage){
        currentStage={
          code:exercise.currentStageCode,
          name:exercise.currentStageName || exercise.currentStageCode,
          sequence:Number(exercise.currentStageSequence || 0)
        };
      }
      if(finite(exercise.latestScore)) latestScore=Number(exercise.latestScore);
      const feedback=exercise.feedback || {};
      sessions+=Number(feedback.practice_session_count || 0);
      attempts+=Number(feedback.attempt_count || 0);
      latestActivity=latestIso(feedback.latest_activity_at,latestActivity);
      if(finite(feedback.overall_score)) overallScores.push(Number(feedback.overall_score));
      const skillResults=Array.isArray(feedback.skill_results) ? feedback.skill_results : [];
      for(const skill of skillResults){
        const code=skill.skill_code;
        if(!code || !finite(skill.score)) continue;
        if(!skillBuckets.has(code)) skillBuckets.set(code,[]);
        skillBuckets.get(code).push(Number(skill.score));
      }
    }
  }
  const skills=[...skillBuckets.entries()].map(([code,scores])=>({
    code,
    label:SKILL_LABELS[code] || code,
    score:scores.reduce((a,b)=>a+b,0)/scores.length
  })).sort((a,b)=>a.score-b.score);
  const weakest=skills[0] || null;
  const masteryScore=overallScores.length
    ? overallScores.reduce((a,b)=>a+b,0)/overallScores.length
    : latestScore;
  const completed=paths.length>0 && completedPaths===paths.length;
  const learningStatus=completed ? 'mastered' : (sessions>0 || currentStage ? 'in-progress' : 'not-started');
  return {
    ...student,
    key:student.classId + ':' + student.id,
    sessions,
    attempts,
    latestActivity,
    currentStage,
    latestScore,
    masteryScore,
    skills,
    weakest,
    completedPaths,
    totalPaths:paths.length,
    learningStatus
  };
}

function buildStudentRecords(classData=teacherClassData){
  const records=[];
  for(const entry of classData){
    records.push(...teacherGroupDetailRows(entry.rows,entry.classInfo).map(deriveStudent));
  }
  return records;
}

function classLabel(classInfo){
  const bits=[classInfo.code,classInfo.name];
  if(classInfo.academicYear) bits.push('ปีการศึกษา ' + classInfo.academicYear);
  if(classInfo.term) bits.push('ภาคเรียน ' + classInfo.term);
  return bits.filter(Boolean).join(' · ');
}

function renderTeacherClassSelector(classes,preferred){
  const select=$('teacherClassSelect');
  const previous=preferred || select.value;
  const allOption=classes.length>1 ? '<option value="' + ALL_CLASSES + '">ภาพรวมทุกห้องเรียน</option>' : '';
  select.innerHTML=allOption + classes.map(c=>
    '<option value="' + escapeHtml(c.id) + '">' + escapeHtml((c.code || '') + ' · ' + (c.name || 'ชั้นเรียน')) + '</option>'
  ).join('');
  const valid=previous && (previous===ALL_CLASSES ? classes.length>1 : classes.some(c=>c.id===previous));
  if(valid) select.value=previous;
  else if(classes.length>1) select.value=ALL_CLASSES;
  else if(classes[0]) select.value=classes[0].id;
  select.disabled=classes.length===0;
  return select.value || null;
}

function aggregateSkillOverview(records){
  const buckets=new Map();
  for(const student of records){
    for(const skill of student.skills){
      if(!buckets.has(skill.code)) buckets.set(skill.code,[]);
      buckets.get(skill.code).push(Number(skill.score));
    }
  }
  return [...buckets.entries()].map(([code,scores])=>({
    code,
    label:SKILL_LABELS[code] || code,
    score:scores.reduce((a,b)=>a+b,0)/scores.length,
    count:scores.length
  })).sort((a,b)=>a.score-b.score);
}

function filterAndSortRecords(records){
  const search=filters.search.trim().toLowerCase();
  const filtered=records.filter(student=>{
    if(search){
      const hay=(student.name + ' ' + student.classCode + ' ' + student.className).toLowerCase();
      if(!hay.includes(search)) return false;
    }
    if(filters.stage!=='all'){
      if((student.currentStage?.code || 'none')!==filters.stage) return false;
    }
    if(filters.status!=='all' && student.learningStatus!==filters.status) return false;
    return true;
  });
  const dir=sortState.dir==='desc' ? -1 : 1;
  const compare=(a,b)=>{
    switch(sortState.key){
      case 'class': return String(a.classCode).localeCompare(String(b.classCode),'th')*dir;
      case 'stage': return ((a.currentStage?.sequence || 999)-(b.currentStage?.sequence || 999))*dir;
      case 'mastery': return ((finite(a.masteryScore)?Number(a.masteryScore):-1)-(finite(b.masteryScore)?Number(b.masteryScore):-1))*dir;
      case 'weak': return ((a.weakest?.score ?? 999)-(b.weakest?.score ?? 999))*dir;
      case 'sessions': return (a.sessions-b.sessions)*dir;
      case 'activity': return (dateValue(a.latestActivity)-dateValue(b.latestActivity))*dir;
      default: return String(a.name).localeCompare(String(b.name),'th')*dir;
    }
  };
  return filtered.sort(compare);
}

function renderClassMeta(classes){
  const selected=selectedScope;
  let label='ภาพรวมทุกห้องเรียน';
  if(selected!==ALL_CLASSES){
    const info=classes.find(c=>c.id===selected);
    if(info) label=classLabel(info);
  }
  const addStudentDisabled=selected===ALL_CLASSES || !selected;
  $('teacherClassMeta').innerHTML=
    '<span class="teacher-meta-copy">' + escapeHtml(label) + '</span>' +
    '<button type="button" class="btn small teacher-v2-action" data-teacher-action="toggle-create-class">+ เพิ่มห้องเรียน</button>' +
    '<button type="button" class="btn small teacher-v2-action" data-teacher-action="toggle-add-student"' + (addStudentDisabled ? ' disabled title="เลือกห้องเรียนก่อนเพิ่มผู้เรียน"' : '') + '>+ เพิ่มผู้เรียน</button>';
}

function skillOverviewHtml(records){
  const skills=aggregateSkillOverview(records);
  if(!skills.length) return '<div class="teacher-empty">ยังไม่มี Skill evidence ในขอบเขตที่เลือก</div>';
  return '<div class="teacher-skill-overview">' + skills.map(skill=>
    '<div class="teacher-skill-overview-row">' +
      '<strong>' + escapeHtml(skill.label) + '</strong>' +
      '<div class="teacher-skill-track" role="progressbar" aria-label="' + escapeHtml(skill.label + ' ' + pct(skill.score)) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(skill.score) + '"><i style="width:' + Math.max(0,Math.min(100,skill.score)) + '%"></i></div>' +
      '<span>' + pct(skill.score) + '</span>' +
    '</div>'
  ).join('') + '</div>';
}

function attentionHtml(records,limit=5){
  const attention=[...records].filter(s=>s.weakest && s.weakest.score<85)
    .sort((a,b)=>a.weakest.score-b.weakest.score)
    .slice(0,limit);
  if(!attention.length) return '<div class="teacher-empty">ยังไม่พบผู้เรียนที่มี Skill score ต่ำกว่า 85% ในข้อมูลปัจจุบัน</div>';
  return '<div class="teacher-attention-list">' + attention.map(s=>
    '<button type="button" class="teacher-attention-item" data-teacher-student="' + escapeHtml(s.key) + '">' +
      '<span><strong>' + escapeHtml(s.name) + '</strong><span class="teacher-student-sub">' + escapeHtml(s.classCode + ' · ' + s.weakest.label) + '</span></span>' +
      '<span>' + pct(s.weakest.score) + '</span>' +
    '</button>'
  ).join('') + '</div>';
}

function managementFormsHtml(){
  const createForm=panelState.createClass
    ? '<form class="teacher-inline-form" data-teacher-form="create-class">' +
        '<label>รหัสห้อง<input name="code" required maxlength="40" placeholder="เช่น MUS101-01"></label>' +
        '<label>ชื่อห้อง<input name="name" required maxlength="120" placeholder="Music Theory I"></label>' +
        '<label>ปีการศึกษา<input name="academicYear" maxlength="20" placeholder="2569"></label>' +
        '<label>ภาคเรียน<input name="term" maxlength="20" placeholder="1"></label>' +
        '<p class="teacher-form-status ' + (panelState.error ? 'error' : '') + '">' + escapeHtml(panelState.message || '') + '</p>' +
        '<div class="teacher-inline-form-actions"><button type="button" class="btn small" data-teacher-action="toggle-create-class">ยกเลิก</button><button type="submit" class="btn primary" ' + (panelState.busy?'disabled':'') + '>สร้างห้องเรียน</button></div>' +
      '</form>'
    : '';
  const addForm=panelState.addStudent && selectedScope!==ALL_CLASSES
    ? '<form class="teacher-inline-form" data-teacher-form="add-student">' +
        '<label class="full">อีเมลบัญชีนักศึกษา<input name="email" type="email" required placeholder="student@example.com"></label>' +
        '<p class="teacher-form-status ' + (panelState.error ? 'error' : '') + '">' + escapeHtml(panelState.message || 'นักศึกษาต้องสมัครบัญชีในระบบแล้ว') + '</p>' +
        '<div class="teacher-inline-form-actions"><button type="button" class="btn small" data-teacher-action="toggle-add-student">ยกเลิก</button><button type="submit" class="btn primary" ' + (panelState.busy?'disabled':'') + '>เพิ่มเข้าห้องเรียน</button></div>' +
      '</form>'
    : '';
  return createForm + addForm;
}

function assignedPathsHtml(classes){
  const scoped=selectedScope===ALL_CLASSES ? classes : classes.filter(c=>c.id===selectedScope);
  if(!scoped.length) return '<div class="teacher-empty">ยังไม่มีข้อมูลห้องเรียน</div>';
  return '<div class="teacher-path-list-v2">' + scoped.map(classInfo=>{
    const paths=[...classInfo.paths.values()].sort((a,b)=>a.sortOrder-b.sortOrder);
    if(!paths.length) return '<article class="teacher-path-item"><div><strong>' + escapeHtml(classInfo.code + ' · ' + classInfo.name) + '</strong><div class="dashboard-code">ยังไม่มี Learning Path ที่ active</div></div></article>';
    return paths.map(path=>{
      const date=dashboardCompletionDate(path.assignedAt);
      return '<article class="teacher-path-item"><div><strong>' + escapeHtml(path.name || path.code || 'Learning Path') + '</strong><div class="dashboard-code">' + escapeHtml(classInfo.code + ' · ' + (path.code || '')) + '</div></div><span>' + escapeHtml(date ? 'มอบหมาย ' + date : 'มอบหมายแล้ว') + '</span></article>';
    }).join('');
  }).join('') + '</div>';
}

function renderOverview(classes,records){
  const uniqueStudents=new Set(records.map(s=>s.id)).size;
  const uniquePaths=new Set();
  for(const entry of teacherClassData) for(const id of entry.classInfo.paths.keys()) uniquePaths.add(id);
  const completed=records.filter(s=>s.learningStatus==='mastered').length;
  $('teacherStudentCount').textContent=String(uniqueStudents);
  $('teacherPathCount').textContent=String(uniquePaths.size);
  $('teacherCompletedCount').textContent=String(completed);

  const pathsTarget=$('teacherAssignedPaths');
  pathsTarget.innerHTML=
    '<div class="teacher-v2-panel">' +
      '<section class="teacher-v2-section">' +
        '<div class="teacher-v2-title-row"><div><span class="teacher-v2-eyebrow">Teaching Tools</span><h3>เปิดแบบฝึกหัดเพื่อใช้สอน</h3></div></div>' +
        '<div class="teacher-demo-tools">' +
          '<label>แบบฝึกหัด<select data-teacher-demo-exercise><option value="MAJOR_SCALE_NOTATION">Major Scale Notation</option></select></label>' +
          '<label>ระดับ<select data-teacher-demo-stage><option value="STAGE_1">Stage 1</option><option value="STAGE_2">Stage 2</option><option value="STAGE_3">Stage 3</option><option value="STAGE_4">Stage 4</option></select></label>' +
          '<button type="button" class="btn primary teacher-v2-action" data-teacher-action="launch-demo">เปิดแบบฝึกหัด</button>' +
          '<p class="teacher-demo-note">Teacher Demo ใช้ notation และ scoring เดียวกับผู้เรียน แต่ไม่สร้าง Practice Session, Attempt หรือ Mastery progress</p>' +
        '</div>' +
      '</section>' +
      '<section class="teacher-v2-section"><div class="teacher-v2-title-row"><div><span class="teacher-v2-eyebrow">Class Learning Overview</span><h3>ผลการเรียนรู้ภาพรวม</h3></div></div>' + skillOverviewHtml(records) + '</section>' +
      '<section class="teacher-v2-section"><div class="teacher-v2-title-row"><div><span class="teacher-v2-eyebrow">Learning Paths</span><h3>เส้นทางการเรียนรู้ที่มอบหมาย</h3></div></div>' + assignedPathsHtml(classes) + '</section>' +
      managementFormsHtml() +
    '</div>';

  if(typeof document.querySelector==='function'){
    const guide=document.querySelector('.teacher-guide-card');
    if(guide){
      guide.innerHTML=
        '<div class="dashboard-focus-head"><div><div class="dashboard-focus-label">Needs Attention</div><h2 class="dashboard-focus-title">ผู้เรียนที่ควรติดตาม</h2></div><span class="dashboard-status-badge in-progress">' + records.filter(s=>s.weakest && s.weakest.score<85).length + ' คน</span></div>' +
        '<div class="teacher-guide-summary"><p>เรียงจาก Skill mastery ที่ต่ำที่สุดในข้อมูล Rolling Mastery ปัจจุบัน</p>' + attentionHtml(records,5) + '</div>';
    }
  }
}

function stageOptions(records){
  const map=new Map();
  for(const r of records){
    if(r.currentStage?.code) map.set(r.currentStage.code,r.currentStage.name || r.currentStage.code);
  }
  return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([code,name])=>'<option value="' + escapeHtml(code) + '">' + escapeHtml(name) + '</option>').join('');
}

function detailHtml(student){
  if(!student) return '';
  const skills=student.skills.length ? '<div class="teacher-skill-overview">' + student.skills.slice().sort((a,b)=>b.score-a.score).map(skill=>
    '<div class="teacher-skill-overview-row"><strong>' + escapeHtml(skill.label) + '</strong><div class="teacher-skill-track"><i style="width:' + Math.max(0,Math.min(100,skill.score)) + '%"></i></div><span>' + pct(skill.score) + '</span></div>'
  ).join('') + '</div>' : '<div class="teacher-empty">ยังไม่มีข้อมูล Skill mastery</div>';
  const paths=[...student.paths.values()].map(path=>{
    const status=statusMeta(path.learningStatus);
    const exercises=[...path.exercises.values()].sort((a,b)=>a.sequence-b.sequence).map(ex=>{
      const stage=ex.currentStageName || ex.currentStageCode || (ex.status==='mastered'?'ผ่านทุก Stage แล้ว':'ยังไม่เริ่ม');
      return '<div class="teacher-detail-path"><strong>' + escapeHtml(ex.name || ex.code) + '</strong><span class="teacher-student-sub">' + escapeHtml(stage) + ' · Mastery ล่าสุด ' + dashboardScore(ex.latestScore) + '</span></div>';
    }).join('');
    return '<div class="teacher-detail-path"><strong>' + escapeHtml(path.name || path.code) + '</strong><span class="teacher-learning-pill ' + escapeHtml(status.className) + '">' + escapeHtml(status.label) + '</span>' + exercises + '</div>';
  }).join('');
  return '<section class="teacher-student-detail" aria-label="รายละเอียดผู้เรียน">' +
    '<div class="teacher-detail-head"><div><h3>' + escapeHtml(student.name) + '</h3><div class="teacher-detail-meta">' + escapeHtml(student.classCode + ' · ' + student.className) + '</div></div><button type="button" class="btn small" data-teacher-action="close-student-detail">ปิดรายละเอียด</button></div>' +
    '<div class="teacher-detail-stat-grid" style="margin-top:12px">' +
      '<div class="teacher-detail-stat"><strong>' + pct(student.masteryScore) + '</strong><span>Current Mastery</span></div>' +
      '<div class="teacher-detail-stat"><strong>' + student.sessions + '</strong><span>Practice Sessions</span></div>' +
      '<div class="teacher-detail-stat"><strong>' + student.attempts + '</strong><span>Attempts</span></div>' +
    '</div>' +
    '<div class="teacher-detail-grid"><article class="teacher-detail-card"><h4>Skill Performance</h4>' + skills + '</article><article class="teacher-detail-card"><h4>Learning Progress</h4>' + (paths || '<div class="teacher-empty">ยังไม่มี Learning Path progress</div>') + '</article></div>' +
  '</section>';
}

function studentRowsHtml(records){
  if(!records.length) return '<tr><td colspan="7"><div class="teacher-empty">ไม่พบผู้เรียนตามเงื่อนไขที่เลือก</div></td></tr>';
  return records.map(s=>{
    const status=statusMeta(s.learningStatus);
    const selected=s.key===selectedStudentKey ? ' is-selected' : '';
    return '<tr class="teacher-student-row' + selected + '" tabindex="0" data-teacher-student="' + escapeHtml(s.key) + '">' +
      '<td data-label="Student"><span class="teacher-student-name">' + escapeHtml(s.name) + '</span><span class="teacher-student-sub">' + escapeHtml(s.id) + '</span></td>' +
      '<td data-label="Class">' + escapeHtml(s.classCode) + '</td>' +
      '<td data-label="Current Stage"><span class="teacher-stage-pill">' + escapeHtml(s.currentStage?.name || '—') + '</span></td>' +
      '<td data-label="Mastery"><strong>' + pct(s.masteryScore) + '</strong></td>' +
      '<td data-label="Weakest Skill">' + (s.weakest ? '<span class="teacher-weak-skill">' + escapeHtml(s.weakest.label) + ' · ' + pct(s.weakest.score) + '</span>' : '—') + '</td>' +
      '<td data-label="Sessions">' + s.sessions + '</td>' +
      '<td data-label="Status"><span class="teacher-learning-pill ' + escapeHtml(status.className) + '">' + escapeHtml(status.label) + '</span></td>' +
    '</tr>';
  }).join('');
}

function renderStudents(records){
  const filtered=filterAndSortRecords(records);
  $('teacherStudentListCount').textContent=filtered.length + ' / ' + records.length + ' รายการ';
  const target=$('teacherStudentList');
  const selected=records.find(r=>r.key===selectedStudentKey) || null;
  target.innerHTML=
    '<div class="teacher-student-controls">' +
      '<input type="search" data-teacher-search value="' + escapeHtml(filters.search) + '" placeholder="ค้นหาชื่อหรือห้องเรียน" aria-label="ค้นหาผู้เรียน">' +
      '<select data-teacher-stage-filter aria-label="กรองตาม Stage"><option value="all">ทุก Stage</option>' + stageOptions(records) + '</select>' +
      '<select data-teacher-status-filter aria-label="กรองตามสถานะ"><option value="all">ทุกสถานะ</option><option value="in-progress">กำลังเรียน</option><option value="mastered">สำเร็จแล้ว</option><option value="not-started">ยังไม่เริ่ม</option></select>' +
    '</div>' +
    '<div class="teacher-student-table-wrap"><table class="teacher-student-table"><thead><tr>' +
      '<th><button data-teacher-sort="name">Student</button></th>' +
      '<th><button data-teacher-sort="class">Class</button></th>' +
      '<th><button data-teacher-sort="stage">Stage</button></th>' +
      '<th><button data-teacher-sort="mastery">Mastery</button></th>' +
      '<th><button data-teacher-sort="weak">Weakest Skill</button></th>' +
      '<th><button data-teacher-sort="sessions">Sessions</button></th>' +
      '<th>Status</th>' +
    '</tr></thead><tbody>' + studentRowsHtml(filtered) + '</tbody></table></div>' +
    detailHtml(selected);
  if(typeof target.querySelector==='function'){
    const stage=target.querySelector('[data-teacher-stage-filter]');
    const status=target.querySelector('[data-teacher-status-filter]');
    if(stage) stage.value=filters.stage;
    if(status) status.value=filters.status;
  }
}

function renderAll(){
  const classes=teacherGroupSummaryRows(teacherDashboardSummaryRows);
  const records=buildStudentRecords();
  renderClassMeta(classes);
  renderOverview(classes,records);
  renderStudents(records);
}

async function loadScope(scope,token){
  const classes=teacherGroupSummaryRows(teacherDashboardSummaryRows);
  selectedScope=scope;
  if(scope===ALL_CLASSES){
    const result=await dashboardRepository.getTeacherClassDashboards(classes.map(c=>c.id));
    if(result.error) throw result.error;
    teacherClassData=(result.data || []).map(entry=>({
      classInfo:classes.find(c=>c.id===entry.classId),
      rows:entry.data || []
    })).filter(entry=>entry.classInfo);
  }else{
    const classInfo=classes.find(c=>c.id===scope);
    if(!classInfo) throw new Error('ไม่พบชั้นเรียนที่เลือก');
    const result=await dashboardRepository.getTeacherClassDashboard(scope);
    if(result.error) throw result.error;
    teacherClassData=[{classInfo,rows:Array.isArray(result.data)?result.data:[]}];
  }
  if(token!==teacherDashboardLoadToken) return;
  renderAll();
}

async function loadTeacherDashboard({preferredClassId=null}={}){
  if(!dashboardRepository || !activeUser) return;
  const token=++teacherDashboardLoadToken;
  const messageBox=$('teacherDashboardMessage');
  const content=$('teacherDashboardContent');
  messageBox.hidden=false;
  messageBox.className='dashboard-message';
  messageBox.textContent='กำลังโหลดข้อมูลชั้นเรียน...';
  content.hidden=true;
  try{
    const auth=await authRepository.getUser();
    if(auth.error) throw auth.error;
    const user=auth.data?.user;
    if(!user) throw new Error('Authentication required');
    const [summaryResult,profileResult]=await Promise.all([
      dashboardRepository.getTeacherDashboard(),
      dashboardRepository.getTeacherProfile(user.id)
    ]);
    if(summaryResult.error) throw summaryResult.error;
    if(token!==teacherDashboardLoadToken) return;
    teacherDashboardSummaryRows=Array.isArray(summaryResult.data)?summaryResult.data:[];
    $('teacherDashboardUserName').textContent=profileResult?.data?.full_name || user.user_metadata?.full_name || user.email || 'ผู้สอน';
    const classes=teacherGroupSummaryRows(teacherDashboardSummaryRows);
    if(!classes.length){
      $('teacherClassSelect').innerHTML='';
      $('teacherClassSelect').disabled=true;
      $('teacherClassMeta').innerHTML='<span class="teacher-meta-copy">ยังไม่มีชั้นเรียน</span><button type="button" class="btn small teacher-v2-action" data-teacher-action="toggle-create-class">+ เพิ่มห้องเรียน</button>';
      $('teacherAssignedPaths').innerHTML=managementFormsHtml();
      $('teacherStudentList').innerHTML='<div class="teacher-empty">สร้างห้องเรียนก่อนเพื่อเริ่มจัดการผู้เรียน</div>';
      $('teacherStudentCount').textContent='0'; $('teacherPathCount').textContent='0'; $('teacherCompletedCount').textContent='0';
      messageBox.hidden=true; content.hidden=false; return;
    }
    const selected=renderTeacherClassSelector(classes,preferredClassId);
    await loadScope(selected,token);
    if(token!==teacherDashboardLoadToken) return;
    messageBox.hidden=true;
    content.hidden=false;
  }catch(error){
    console.error('LOAD TEACHER DASHBOARD ERROR:',error);
    if(token!==teacherDashboardLoadToken) return;
    content.hidden=true;
    messageBox.hidden=false;
    messageBox.className='dashboard-message error';
    messageBox.textContent='โหลด Teacher Dashboard ไม่สำเร็จ: ' + (error.message || 'กรุณาลองใหม่');
  }
}

async function selectTeacherClass(scope){
  if(!scope) return;
  const token=++teacherDashboardLoadToken;
  const messageBox=$('teacherDashboardMessage');
  messageBox.hidden=false;
  messageBox.className='dashboard-message';
  messageBox.textContent='กำลังโหลดข้อมูลชั้นเรียน...';
  try{
    await loadScope(scope,token);
    if(token!==teacherDashboardLoadToken) return;
    messageBox.hidden=true;
    $('teacherDashboardContent').hidden=false;
  }catch(error){
    console.error('CHANGE TEACHER CLASS ERROR:',error);
    if(token!==teacherDashboardLoadToken) return;
    messageBox.hidden=false;
    messageBox.className='dashboard-message error';
    messageBox.textContent='โหลดข้อมูลชั้นเรียนไม่สำเร็จ: ' + (error.message || 'กรุณาลองใหม่');
  }
}

function resetPanelMessage(){
  panelState.message='';
  panelState.error=false;
}
async function createClass(form){
  if(panelState.busy) return;
  const data=new FormData(form);
  panelState.busy=true; panelState.message='กำลังสร้างห้องเรียน...'; panelState.error=false; renderAll();
  try{
    const result=await dashboardRepository.createTeacherClass({
      code:String(data.get('code') || '').trim(),
      name:String(data.get('name') || '').trim(),
      academicYear:String(data.get('academicYear') || '').trim() || null,
      term:String(data.get('term') || '').trim() || null
    });
    if(result.error) throw result.error;
    const row=Array.isArray(result.data)?result.data[0]:result.data;
    panelState={createClass:false,addStudent:false,busy:false,message:'',error:false};
    await loadTeacherDashboard({preferredClassId:row?.class_id || null});
  }catch(error){
    panelState.busy=false; panelState.error=true; panelState.message=error.message || 'สร้างห้องเรียนไม่สำเร็จ'; renderAll();
  }
}
async function addStudent(form){
  if(panelState.busy || selectedScope===ALL_CLASSES) return;
  const data=new FormData(form);
  panelState.busy=true; panelState.message='กำลังเพิ่มผู้เรียน...'; panelState.error=false; renderAll();
  try{
    const result=await dashboardRepository.addStudentToTeacherClass({classId:selectedScope,email:String(data.get('email') || '').trim()});
    if(result.error) throw result.error;
    panelState={createClass:false,addStudent:false,busy:false,message:'',error:false};
    await loadTeacherDashboard({preferredClassId:selectedScope});
  }catch(error){
    panelState.busy=false; panelState.error=true; panelState.message=error.message || 'เพิ่มผู้เรียนไม่สำเร็จ'; renderAll();
  }
}

async function launchTeacherDemo(button){
  const host=app.exerciseHost;
  if(!host) return;
  const box=button.closest('.teacher-demo-tools');
  const exerciseCode=box?.querySelector('[data-teacher-demo-exercise]')?.value || 'MAJOR_SCALE_NOTATION';
  const stageCode=box?.querySelector('[data-teacher-demo-stage]')?.value || 'STAGE_1';
  if(host.getCurrentContext()) await host.close();
  const result=await host.launch({exerciseCode,stageCode,userId:activeUser,sessionMode:'teacher_demo'});
  if(!result?.ok){
    const message=$('teacherDashboardMessage');
    message.hidden=false; message.className='dashboard-message error'; message.textContent=result?.message || 'เปิดแบบฝึกหัดไม่สำเร็จ';
  }
}

const dashboard=$('teacherDashboard');
dashboard?.addEventListener('click',event=>{
  const sortButton=event.target.closest?.('[data-teacher-sort]');
  if(sortButton){
    const key=sortButton.dataset.teacherSort;
    sortState=sortState.key===key ? {key,dir:sortState.dir==='asc'?'desc':'asc'} : {key,dir:'asc'};
    renderStudents(buildStudentRecords());
    return;
  }
  const studentTarget=event.target.closest?.('[data-teacher-student]');
  if(studentTarget){
    selectedStudentKey=studentTarget.dataset.teacherStudent;
    renderStudents(buildStudentRecords());
    return;
  }
  const action=event.target.closest?.('[data-teacher-action]');
  if(!action) return;
  const name=action.dataset.teacherAction;
  if(name==='toggle-create-class'){
    panelState.createClass=!panelState.createClass; panelState.addStudent=false; resetPanelMessage(); renderAll();
  }else if(name==='toggle-add-student'){
    if(selectedScope===ALL_CLASSES) return;
    panelState.addStudent=!panelState.addStudent; panelState.createClass=false; resetPanelMessage(); renderAll();
  }else if(name==='close-student-detail'){
    selectedStudentKey=null; renderStudents(buildStudentRecords());
  }else if(name==='launch-demo'){
    launchTeacherDemo(action).catch(error=>console.error('TEACHER DEMO ERROR:',error));
  }
});
dashboard?.addEventListener('input',event=>{
  if(event.target.matches?.('[data-teacher-search]')){
    filters.search=event.target.value || '';
    const records=buildStudentRecords();
    const filtered=filterAndSortRecords(records);
    const target=$('teacherStudentList');
    const tbody=typeof target.querySelector==='function' ? target.querySelector('tbody') : null;
    if(tbody) tbody.innerHTML=studentRowsHtml(filtered);
    $('teacherStudentListCount').textContent=filtered.length + ' / ' + records.length + ' รายการ';
  }
});
dashboard?.addEventListener('change',event=>{
  if(event.target.matches?.('[data-teacher-stage-filter]')){filters.stage=event.target.value;renderStudents(buildStudentRecords());}
  if(event.target.matches?.('[data-teacher-status-filter]')){filters.status=event.target.value;renderStudents(buildStudentRecords());}
});
dashboard?.addEventListener('submit',event=>{
  const form=event.target;
  if(!form?.matches?.('[data-teacher-form]')) return;
  event.preventDefault();
  if(form.dataset.teacherForm==='create-class') createClass(form);
  if(form.dataset.teacherForm==='add-student') addStudent(form);
});
dashboard?.addEventListener('keydown',event=>{
  const row=event.target.closest?.('.teacher-student-row[data-teacher-student]');
  if(row && (event.key==='Enter' || event.key===' ')){
    event.preventDefault(); selectedStudentKey=row.dataset.teacherStudent; renderStudents(buildStudentRecords());
  }
});

app.teacherDashboard=Object.freeze({
  async load({activeUser:userId,preferredClassId=null}={}){
    activeUser=userId || null;
    return loadTeacherDashboard({preferredClassId});
  },
  async refresh({activeUser:userId,preferredClassId=null}={}){
    activeUser=userId || null;
    return loadTeacherDashboard({preferredClassId});
  },
  selectClass(classId){return selectTeacherClass(classId);},
  invalidate(){
    activeUser=null;
    teacherDashboardLoadToken++;
    teacherDashboardSummaryRows=[];
    teacherClassData=[];
    selectedScope=null;
    selectedStudentKey=null;
    filters={search:'',stage:'all',status:'all'};
    sortState={key:'name',dir:'asc'};
    panelState={createClass:false,addStudent:false,busy:false,message:'',error:false};
  }
});
})();