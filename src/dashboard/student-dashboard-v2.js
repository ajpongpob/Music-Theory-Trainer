(() => {
'use strict';

const app=window.MajorScaleApp=window.MajorScaleApp || {};
const repo=app.dashboardRepository;
const learningRepo=app.learningRepository;
const authRepo=app.authRepository;
const masteryCore=app.masteryLearningCore;
const $=id=>document.getElementById(id);
const PROFILE_NAME_SEPARATOR='\u001f';

const SKILL_ORDER=['BN01_TREBLE_PITCH','BN06_STEM_DIRECTION','RH01_DURATION_VALUE','GR02_PRIMARY_BEAM','MS03_SCALE_ACCIDENTAL'];
const SKILL_LABELS=Object.freeze({
  BN01_TREBLE_PITCH:'Pitch Name',
  BN06_STEM_DIRECTION:'Stem Direction',
  RH01_DURATION_VALUE:'Duration Value',
  GR02_PRIMARY_BEAM:'Primary Beam',
  MS03_SCALE_ACCIDENTAL:'Scale Accidental'
});

const NAV_TARGETS=Object.freeze({dashboard:'dashboardContent',practice:'sd2PracticePage',progress:'sd2ProgressPage',profile:'sd2ProfilePanel'});
let revision=0,initialized=false,trendSkill='ALL',refreshTimer=null,legacyObserver=null;
let profileState={data:null,user:null,message:'',error:false,busy:false};
let activeSkillMeta=new Map();

const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[char]));
const first=data=>Array.isArray(data)?(data[0]||null):(data||null);
const clampPercent=value=>Number.isFinite(Number(value))?Math.max(0,Math.min(100,Number(value))):0;
const percentText=value=>Number.isFinite(Number(value))?`${Number(value).toFixed(1).replace(/\.0$/,'')}%`:'—';
const average=values=>{const nums=values.map(Number).filter(Number.isFinite);return nums.length?nums.reduce((sum,value)=>sum+value,0)/nums.length:null;};
function resolveWithin(promise,timeoutMs,label){
  const request=Promise.resolve(promise).then(value=>({value,timedOut:false}),error=>({value:{data:null,error},timedOut:false}));
  const timeout=new Promise(resolve=>setTimeout(()=>resolve({value:{data:null,error:new Error(`${label} timeout`)},timedOut:true}),timeoutMs));
  return Promise.race([request,timeout]);
}
const currentLanguage=()=>app.i18n?.getLanguage?.()==='en'?'en':'th';

function skillDisplayName(code,meta=activeSkillMeta.get(code)||{}){
  if(currentLanguage()==='en') return meta.short_name||SKILL_LABELS[code]||'Skill';
  return meta.name_th||meta.short_name||SKILL_LABELS[code]||'ทักษะ';
}

function ensureStylesheet(){
  if(document.querySelector('link[data-student-dashboard-v2-style]')) return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='./styles/student-dashboard-v2.css?v=20260915-readiness-1';
  link.setAttribute('data-student-dashboard-v2-style','true');
  document.head.appendChild(link);
}

function navLinks(){
  const link=(label,action)=>`<a class="sd2-nav-button" href="#${NAV_TARGETS[action]}" data-sd2-nav="${action}">${label}</a>`;
  return [link('Dashboard','dashboard'),link('Practice','practice'),link('Progress','progress'),link('Profile','profile')].join('');
}

function currentAction(){
  const hash=window.location.hash;
  if(hash==='#sd2PracticePage') return 'practice';
  if(hash==='#sd2ProgressPage') return 'progress';
  if(hash==='#sd2ProfilePanel') return 'profile';
  return 'dashboard';
}

function syncNavigation(){
  const action=currentAction();
  document.querySelectorAll('#sd2TopNav a').forEach(link=>{
    if(link.dataset.sd2Nav===action) link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  });
  const dashboard=$('dashboardContent'),practice=$('sd2PracticePage'),progress=$('sd2ProgressPage'),profile=$('sd2ProfilePanel');
  if(dashboard) dashboard.hidden=action!=='dashboard';
  if(practice) practice.hidden=action!=='practice';
  if(progress) progress.hidden=action!=='progress';
  if(profile) profile.hidden=action!=='profile';
  app.navigationDrawer?.sync?.();
}

function syncLegacyFallbackAction(){
  const body=$('sd2ContinueBody');
  const legacy=$('dashboardRecommendation')?.querySelector('.dashboard-continue[data-exercise-code]');
  if(!body || !legacy || body.querySelector('.dashboard-continue')) return false;
  body.className='sd2-continue-layout';
  body.innerHTML=`<div class="sd2-continue-main"><div class="sd2-eyebrow">Continue Learning · Next Recommended Activity</div><h2 id="sd2ContinueHeading">${escapeHtml($('dashboardFocusTitle')?.textContent||'เรียนต่อจาก Stage ปัจจุบัน')}</h2><div class="sd2-subtle">${escapeHtml($('dashboardFocusExercise')?.textContent||'ระบบกำลังเตรียมรายละเอียด Mastery เพิ่มเติม')}</div></div><div class="sd2-continue-side"><button type="button" class="dashboard-continue sd2-continue-action" data-exercise-code="${escapeHtml(legacy.dataset.exerciseCode||'')}" data-stage-code="${escapeHtml(legacy.dataset.stageCode||'')}" data-session-mode="${escapeHtml(legacy.dataset.sessionMode||'practice')}">${escapeHtml(legacy.textContent?.trim()||'ฝึกต่อ')}</button></div>`;
  return true;
}

function ensureStructure(){
  const shell=$('studentDashboard'),content=$('dashboardContent');
  if(!shell||!content) return false;
  shell.classList.add('dashboard-v2-enabled');

  const brand=shell.querySelector('.student-dashboard-brand');
  if(brand){
    const kicker=brand.querySelector('.student-dashboard-kicker'),title=brand.querySelector('h1'),description=brand.querySelector('p');
    if(kicker) kicker.textContent='Student Dashboard';
    if(title) title.textContent='Major Scale Notation Trainer';
    if(description) description.textContent='เรียนต่อจากจุดที่เหมาะสม และตรวจหลักฐานพัฒนาการเมื่อคุณต้องการ';
  }

  if(!$('sd2TopNav')){
    const nav=document.createElement('nav');
    nav.id='sd2TopNav';
    nav.className='sd2-top-nav';
    nav.setAttribute('aria-label','Main');
    nav.innerHTML=navLinks();
    brand?.insertAdjacentElement('afterend',nav);
  }

  if(!content.classList.contains('sd2-dashboard')){
    const legacyPath=$('dashboardPathList');
    const legacyFocus=$('dashboardCurrentFocus');
    const legacyAction=legacyFocus?.querySelector('.dashboard-continue[data-exercise-code]')||null;
    const legacySnapshot=legacyAction?{
      exerciseCode:legacyAction.dataset.exerciseCode||'',stageCode:legacyAction.dataset.stageCode||'',sessionMode:legacyAction.dataset.sessionMode||'practice',text:legacyAction.textContent?.trim()||'ฝึกต่อ',title:$('dashboardFocusTitle')?.textContent||'',exercise:$('dashboardFocusExercise')?.textContent||''
    }:null;

    content.className='sd2-dashboard sd2-page';
    content.innerHTML=`
      <section id="sd2Continue" class="sd2-card sd2-continue" aria-labelledby="sd2ContinueHeading"><div id="sd2ContinueBody" class="sd2-empty">กำลังเตรียมกิจกรรมถัดไป...</div></section>
      <section id="sd2Summary" class="sd2-summary-grid" aria-label="Overall Progress Summary"></section>
      <section id="sd2SkillSnapshot" class="sd2-card" aria-labelledby="sd2SkillSnapshotHeading"><div class="sd2-section-head"><div><div class="sd2-eyebrow">Skill Snapshot</div><h2 id="sd2SkillSnapshotHeading">ภาพรวม 5 ทักษะปัจจุบัน</h2></div><button type="button" class="sd2-link-button" data-sd2-nav="progress">View Progress</button></div><div id="sd2SkillList" class="sd2-skill-list"></div></section>
      <section id="sd2LearningPath" class="sd2-card" aria-labelledby="sd2PathHeading"><div class="sd2-section-head"><div><div class="sd2-eyebrow">Learning Path</div><h2 id="sd2PathHeading">ตำแหน่งปัจจุบันในเส้นทางการเรียน</h2></div></div><ol id="sd2StageList" class="sd2-stage-list" role="list" aria-labelledby="sd2PathHeading"></ol></section>
      <section id="sd2Recent" class="sd2-card" aria-labelledby="sd2RecentHeading"><div class="sd2-section-head"><div><div class="sd2-eyebrow">Recent Activity</div><h2 id="sd2RecentHeading">กิจกรรมล่าสุด</h2></div><button type="button" class="sd2-link-button" data-sd2-nav="progress">View Progress</button></div><div id="sd2RecentList" class="sd2-recent-list"></div></section>
      <div id="sd2Compat" class="sd2-compat" aria-hidden="true"></div>`;

    const compat=$('sd2Compat');
    if(legacyPath) compat?.appendChild(legacyPath);
    if(legacyFocus) compat?.appendChild(legacyFocus);
    if(legacySnapshot && !$('sd2ContinueBody')?.querySelector('.dashboard-continue')){
      $('sd2ContinueBody').className='sd2-continue-layout';
      $('sd2ContinueBody').innerHTML=`<div class="sd2-continue-main"><div class="sd2-eyebrow">Continue Learning · Next Recommended Activity</div><h2 id="sd2ContinueHeading">${escapeHtml(legacySnapshot.title||'เรียนต่อ')}</h2><div class="sd2-subtle">${escapeHtml(legacySnapshot.exercise||'กำลังโหลดรายละเอียด Mastery')}</div></div><div class="sd2-continue-side"><button type="button" class="dashboard-continue sd2-continue-action" data-exercise-code="${escapeHtml(legacySnapshot.exerciseCode)}" data-stage-code="${escapeHtml(legacySnapshot.stageCode)}" data-session-mode="${escapeHtml(legacySnapshot.sessionMode)}">${escapeHtml(legacySnapshot.text)}</button></div>`;
    }
  }

  if(!$('sd2ProgressPage')){
    const practice=document.createElement('main');
    practice.id='sd2PracticePage';
    practice.className='sd2-practice-page sd2-page';
    practice.hidden=true;
    practice.tabIndex=-1;
    practice.innerHTML='<section class="sd2-card" aria-labelledby="sd2PracticeHeading"><div id="sd2PracticeBody" class="sd2-empty">กำลังเตรียมแบบฝึกหัด...</div></section>';
    content.insertAdjacentElement('afterend',practice);

    const progress=document.createElement('main');
    progress.id='sd2ProgressPage';
    progress.className='sd2-progress-page sd2-page';
    progress.hidden=true;
    progress.tabIndex=-1;
    progress.innerHTML=`
      <section id="sd2ProgressOverall" class="sd2-card" aria-labelledby="sd2ProgressOverallHeading"><div class="sd2-section-head"><div><div class="sd2-eyebrow">Overall Learning Progress</div><h2 id="sd2ProgressOverallHeading">ภาพรวมความก้าวหน้าทั้งระบบ</h2></div></div><div id="sd2ProgressOverallBody" class="sd2-summary-grid"></div></section>
      <section id="sd2ProgressSkills" class="sd2-card" aria-labelledby="sd2ProgressSkillsHeading"><div class="sd2-section-head"><div><div class="sd2-eyebrow">Skill Mastery Detail</div><h2 id="sd2ProgressSkillsHeading">หลักฐานรายทักษะ</h2></div></div><div id="sd2ProgressSkillList" class="sd2-progress-skill-list"></div></section>
      <section id="sd2ProgressTrend" class="sd2-card" aria-labelledby="sd2ProgressTrendHeading"><div class="sd2-section-head"><div><div class="sd2-eyebrow">Learning Trend</div><h2 id="sd2ProgressTrendHeading">แนวโน้มตามเวลา</h2></div><select id="sd2ProgressTrendFilter" class="sd2-filter" aria-label="เลือกทักษะสำหรับกราฟ"></select></div><div id="sd2ProgressTrendChart" class="sd2-chart-wrap"></div></section>
      <section id="sd2ProgressStages" class="sd2-card" aria-labelledby="sd2ProgressStagesHeading"><div class="sd2-section-head"><div><div class="sd2-eyebrow">Stage Progress / History</div><h2 id="sd2ProgressStagesHeading">สถานะและหลักฐานของแต่ละ Stage</h2></div></div><div id="sd2ProgressStageList" class="sd2-stage-history"></div></section>
      <section id="sd2SessionHistory" class="sd2-card" aria-labelledby="sd2SessionHistoryHeading"><div class="sd2-section-head"><div><div class="sd2-eyebrow">Session History</div><h2 id="sd2SessionHistoryHeading">ประวัติ Practice Session</h2></div></div><div id="sd2SessionHistoryList" class="sd2-session-history"></div></section>`;
    practice.insertAdjacentElement('afterend',progress);
  }

  if(!$('sd2ProfilePanel')){
    const panel=document.createElement('main');
    panel.id='sd2ProfilePanel';
    panel.className='sd2-profile-panel sd2-page';
    panel.setAttribute('aria-label','โปรไฟล์ผู้เรียน');
    panel.hidden=true;
    panel.tabIndex=-1;
    $('sd2ProgressPage')?.insertAdjacentElement('afterend',panel);
  }

  syncNavigation();
  return true;
}

function renderProfile(profile,user){
  const panel=$('sd2ProfilePanel');
  if(!panel) return;
  const p=profile||{};
  const firstName=p.first_name||'';
  const lastName=p.last_name||'';
  const nickname=p.nickname||p.display_name||'';
  const fullName=[firstName,lastName].filter(Boolean).join(' ').trim()||p.full_name||user?.user_metadata?.full_name||'ผู้เรียน';
  const status=profileState.message?`<div class="sd2-profile-message ${profileState.error?'is-error':'is-success'}" role="status">${escapeHtml(profileState.message)}</div>`:'';
  const avatar=p.avatar_url?`<img class="sd2-profile-avatar" src="${escapeHtml(p.avatar_url)}" alt="Avatar ของ ${escapeHtml(fullName)}">`:'<div class="sd2-profile-avatar is-placeholder" aria-hidden="true">♪</div>';
  panel.innerHTML=`
    <section class="sd2-card sd2-profile-card">
      <div class="sd2-profile-head"><div class="sd2-profile-identity">${avatar}<div><div class="sd2-eyebrow">Profile</div><h2 id="sd2ProfileName">${escapeHtml(fullName)}</h2>${nickname?`<p>ชื่อเล่น: ${escapeHtml(nickname)}</p>`:''}</div></div><button type="button" class="btn" data-sd2-nav="logout">ออกจากระบบ</button></div>
      ${status}
      <form id="sd2ProfileForm" class="sd2-profile-form">
        <div class="sd2-profile-grid">
          <label>ชื่อ *<input name="first_name" maxlength="80" autocomplete="given-name" value="${escapeHtml(firstName)}" required></label>
          <label>นามสกุล *<input name="last_name" maxlength="100" autocomplete="family-name" value="${escapeHtml(lastName)}" required></label>
          <label>ชื่อเล่น<input name="nickname" maxlength="80" value="${escapeHtml(nickname)}" placeholder="เช่น ปิง"></label>
          <label>รหัสนักศึกษา<input name="student_id" maxlength="60" value="${escapeHtml(p.student_id||'')}"></label>
          <label class="sd2-profile-wide">หลักสูตร / สาขาวิชา<input name="program" maxlength="120" value="${escapeHtml(p.program||'')}"></label>
          <label class="sd2-profile-wide">Avatar URL<input type="url" name="avatar_url" maxlength="500" value="${escapeHtml(p.avatar_url||'')}" placeholder="https://..."></label>
        </div>
        <div class="sd2-profile-actions"><button type="button" class="btn" data-sd2-profile-cancel>ยกเลิก</button><button type="submit" class="btn primary" ${profileState.busy?'disabled':''}>${profileState.busy?'กำลังบันทึก…':'บันทึกข้อมูล'}</button></div>
      </form>
    </section>`;
}

function normalizeRecommendation(raw){
  const normalized=masteryCore?.normalizeRecommendation?.(raw);
  if(normalized) return normalized;
  const row=first(raw);
  if(!row) return null;
  return {exerciseCode:row.exercise_code,stageCode:row.stage_code,actionType:row.action_type,targetSkillCode:row.target_skill_code,targetItemCode:row.target_item_code,reasonTh:row.reason_th,overallScore:row.overall_score,overallThreshold:row.overall_threshold};
}

function buildPathModel(rows){
  const list=Array.isArray(rows)?rows:[];
  const ordered=[...list].sort((a,b)=>Number(a.exercise_sequence||0)-Number(b.exercise_sequence||0)||Number(a.stage_sequence||0)-Number(b.stage_sequence||0));
  const unique=[],seen=new Set();
  ordered.filter(row=>row.stage_id||row.stage_code).forEach(row=>{
    const key=row.stage_id||`${row.exercise_code}:${row.stage_code}`;
    if(seen.has(key)) return;
    seen.add(key);
    unique.push({...row,ordinal:unique.length+1});
  });
  const current=unique.find(row=>row.stage_status==='in_progress')||null;
  const mastered=unique.filter(row=>row.stage_status==='mastered');
  const latestMastered=[...mastered].sort((a,b)=>Number(b.stage_sequence||0)-Number(a.stage_sequence||0))[0]||null;
  const active=current||latestMastered||unique[0]||null;
  return {rows:list,stages:unique,current,active,masteredCount:mastered.length,totalStages:unique.length,overallProgress:unique.length?Math.round(mastered.length/unique.length*100):0,pathMastered:unique.length>0&&mastered.length===unique.length,pathName:ordered[0]?.learning_path_name||ordered[0]?.learning_path_code||'Learning Path',exerciseName:active?.exercise_name||active?.exercise_code||'Major Scale Notation'};
}

function buildHistoryModel(history,pathModel){
  const source=history||{};
  const sessions=Array.isArray(source.sessions)?source.sessions:[];
  const attempts=Array.isArray(source.attempts)?source.attempts:[];
  const skillResults=Array.isArray(source.skillResults)?source.skillResults:[];
  const stageById=new Map(pathModel.stages.map(row=>[String(row.stage_id||''),row]));
  const exerciseById=new Map(pathModel.rows.map(row=>[String(row.exercise_id||''),row]));
  const attemptsBySession=new Map(),skillByAttempt=new Map();
  attempts.forEach(attempt=>{const key=String(attempt.practice_session_id||'');if(!attemptsBySession.has(key)) attemptsBySession.set(key,[]);attemptsBySession.get(key).push(attempt);});
  skillResults.forEach(skill=>{const key=String(skill.attempt_id||'');if(!skillByAttempt.has(key)) skillByAttempt.set(key,[]);skillByAttempt.get(key).push(skill);});

  const enriched=sessions.map(session=>{
    const rawAttempts=(attemptsBySession.get(String(session.id||''))||[]).sort((a,b)=>Number(a.question_number||0)-Number(b.question_number||0));
    const sessionAttempts=rawAttempts.map(attempt=>({...attempt,skillResults:skillByAttempt.get(String(attempt.id||''))||[]}));
    const scores=sessionAttempts.map(a=>Number(a.score)).filter(Number.isFinite);
    const fallback=scores.length?average(scores):null;
    const score=session.overall_score==null?fallback:(Number.isFinite(Number(session.overall_score))?Number(session.overall_score):fallback);
    const bySkill={};
    SKILL_ORDER.forEach(code=>{bySkill[code]={correct:0,total:0,score:null};});
    sessionAttempts.forEach(attempt=>attempt.skillResults.forEach(skill=>{
      const code=skill.skill_code;
      if(!bySkill[code]) bySkill[code]={correct:0,total:0,score:null};
      bySkill[code].correct+=Number(skill.correct_count||0);
      bySkill[code].total+=Number(skill.total_count||0);
    }));
    Object.values(bySkill).forEach(value=>{value.score=value.total>0?value.correct/value.total*100:null;});
    const stage=stageById.get(String(session.stage_id||''));
    const exercise=exerciseById.get(String(session.exercise_id||''));
    return {...session,score,skillScores:bySkill,attempts:sessionAttempts,stageName:stage?.stage_name||stage?.stage_code||'Stage',stageCode:stage?.stage_code||'',exerciseName:exercise?.exercise_name||exercise?.exercise_code||'Major Scale Notation',status:session.completed_at||Number(session.completed_questions||0)>=Number(session.planned_questions||0)?'completed':'in_progress'};
  });
  return {sessions:enriched,totalPracticeSessions:Number.isFinite(Number(source.totalPracticeSessions))?Number(source.totalPracticeSessions):enriched.filter(s=>s.mode==='practice').length};
}

function buildSkillModel(activeSkills,mastery){
  const activeMap=new Map((activeSkills||[]).map(skill=>[skill.code,skill]));
  activeSkillMeta=activeMap;
  const resultMap=new Map((mastery?.skill_results||[]).map(skill=>[skill.skill_code,skill]));
  return SKILL_ORDER.map(code=>{
    const meta=activeMap.get(code)||{},result=resultMap.get(code)||{};
    const score=result.score==null?null:Number(result.score);
    const threshold=result.threshold==null?null:Number(result.threshold);
    const hasScore=Number.isFinite(score),passed=result.passed===true;
    const status=passed?'mastered':!hasScore?'no-data':Number.isFinite(threshold)&&score<threshold?'needs-practice':'developing';
    return {code,label:skillDisplayName(code,meta),description:meta.name_th||meta.short_name||'',score:hasScore?score:null,threshold:Number.isFinite(threshold)?threshold:null,passed,status};
  });
}

function weakestSkill(skills){return [...(skills||[])].filter(skill=>!skill.passed&&Number.isFinite(skill.score)).sort((a,b)=>a.score-b.score)[0]||null;}

function buildDashboardViewModel({rows,activeSkills,recommendation,mastery,history}){
  const path=buildPathModel(rows),skills=buildSkillModel(activeSkills,mastery),historyModel=buildHistoryModel(history,path),rec=normalizeRecommendation(recommendation);
  const focusCode=rec?.targetSkillCode||weakestSkill(skills)?.code||null;
  const focusSkill=skills.find(skill=>skill.code===focusCode)||null;
  const active=path.current||path.active;
  const currentOrdinal=active?path.stages.findIndex(stage=>(stage.stage_id||stage.stage_code)===(active.stage_id||active.stage_code))+1:0;
  const scoredSkills=skills.filter(skill=>Number.isFinite(skill.score));
  const skillAverage=scoredSkills.length?Math.round(scoredSkills.reduce((sum,skill)=>sum+skill.score,0)/scoredSkills.length*100)/100:null;
  const skillAverageThreshold=skills.filter(skill=>Number.isFinite(skill.threshold)).length
    ? Math.round(skills.filter(skill=>Number.isFinite(skill.threshold)).reduce((sum,skill)=>sum+skill.threshold,0)/skills.filter(skill=>Number.isFinite(skill.threshold)).length*100)/100
    : null;
  const attemptCount=Number(mastery?.attempts_found),attemptTarget=Number(mastery?.rolling_window);
  const itemCount=Number(mastery?.covered_items),itemTarget=Number(mastery?.required_items);
  const evidenceRatio=Number.isFinite(attemptCount)&&attemptTarget>0?Math.min(1,attemptCount/attemptTarget):null;
  const coverageRatio=Number.isFinite(itemCount)&&itemTarget>0?Math.min(1,itemCount/itemTarget):null;
  const skillRatios=scoredSkills.filter(skill=>Number.isFinite(skill.threshold)&&skill.threshold>0).map(skill=>Math.min(1,skill.score/skill.threshold));
  const readinessParts=[evidenceRatio,coverageRatio,...skillRatios].filter(Number.isFinite);
  const masteryReadiness=readinessParts.length?Math.round(readinessParts.reduce((sum,value)=>sum+value,0)/readinessParts.length*10000)/100:null;
  const readinessStatus=[];
  if(Number.isFinite(attemptCount)&&attemptTarget>0&&attemptCount<attemptTarget) readinessStatus.push(`ทำแบบฝึกอีก ${attemptTarget-attemptCount} ครั้ง`);
  if(Number.isFinite(itemCount)&&itemTarget>0&&itemCount<itemTarget) readinessStatus.push(`ทำโจทย์ให้ครบอีก ${itemTarget-itemCount} คีย์`);
  skills.filter(skill=>Number.isFinite(skill.score)&&Number.isFinite(skill.threshold)&&skill.score<skill.threshold).slice(0,2).forEach(skill=>readinessStatus.push(`${skill.label} อีก ${Math.ceil(skill.threshold-skill.score)}%`));
  return {path,skills,history:historyModel,recommendation:rec,focusSkill,currentStage:active,currentOrdinal,stageMastery:mastery?.overall_score==null?null:Number(mastery.overall_score),stageThreshold:mastery?.overall_threshold==null?null:Number(mastery.overall_threshold),skillAverage,skillAverageThreshold,masteryReadiness,readinessStatus,masteredSkills:skills.filter(skill=>skill.passed).length};
}

function statusLabel(status){
  if(status==='mastered') return 'Mastered';
  if(status==='needs-practice') return 'Needs Practice';
  if(status==='no-data') return 'No Data';
  return 'Developing';
}

function skillSeries(vm,skillCode){
  return [...vm.history.sessions]
    .filter(session=>session.mode==='practice')
    .sort((a,b)=>new Date(a.started_at)-new Date(b.started_at))
    .map(session=>({date:session.started_at,value:skillCode==='ALL'?session.score:session.skillScores?.[skillCode]?.score,session}))
    .filter(point=>Number.isFinite(Number(point.value)));
}

function skillTrend(vm,skillCode){
  const points=skillSeries(vm,skillCode);
  const values=points.map(point=>Number(point.value));
  const recent=average(values.slice(-3));
  if(values.length<2) return {label:'Not enough data',direction:'neutral',recent,points};
  const recentPair=average(values.slice(-2));
  const previousPair=values.length>=4?average(values.slice(-4,-2)):values[0];
  const delta=Number.isFinite(recentPair)&&Number.isFinite(previousPair)?recentPair-previousPair:0;
  return {label:delta>3?'Improving':delta<-3?'Declining':'Stable',direction:delta>3?'up':delta<-3?'down':'neutral',recent,points};
}

function renderContinue(vm){
  const target=$('sd2ContinueBody');
  if(!target) return;
  const stage=vm.currentStage,rec=vm.recommendation;
  if(!stage){target.className='sd2-empty';target.textContent=vm.path.pathMastered?'คุณสำเร็จ Learning Path ที่กำหนดแล้ว':'ยังไม่พบ Stage ที่พร้อมสำหรับการฝึก';return;}
  const actionType=rec?.actionType||(stage.stage_status==='mastered'?'review':'practice');
  const sessionMode=actionType==='diagnostic'?'pretest':'practice';
  const actionLabel=actionType==='diagnostic'?'เริ่มประเมินก่อนเรียน':actionType==='completed'?'ทบทวนผลการเรียน':actionType==='review'?'ทบทวน':'ฝึกต่อ';
  const canLaunch=stage.exercise_code&&stage.stage_code&&actionType!=='completed';
  const readinessProgress=Number.isFinite(vm.masteryReadiness)?clampPercent(vm.masteryReadiness):0;
  const focus=vm.focusSkill?.label||(rec?.targetItemCode?`โจทย์ ${rec.targetItemCode}`:'สะสมหลักฐานให้ครบเกณฑ์ของ Stage');
  target.className='sd2-continue-layout';
  const readinessText=vm.readinessStatus.length?`ยังไม่ผ่าน: ${vm.readinessStatus.join(' • ')}`:'ผ่านเกณฑ์ครบทุกด้านแล้ว';
  target.innerHTML=`<div class="sd2-continue-main"><div class="sd2-eyebrow">Continue Learning</div><div class="sd2-stage-line">Stage ${vm.currentOrdinal||'—'} of ${vm.path.totalStages||'—'} · ${escapeHtml(stage.stage_name||stage.stage_code||'Current Stage')}</div><h2 id="sd2ContinueHeading">${escapeHtml(stage.exercise_name||vm.path.exerciseName)}</h2><div class="sd2-subtle">${escapeHtml(rec?.reasonTh||'เรียนต่อจาก Stage ปัจจุบันตามหลักฐาน Mastery ของคุณ')}</div><div class="sd2-focus-line">Skill Focus: <strong>${escapeHtml(focus)}</strong></div></div><div class="sd2-continue-side"><div class="sd2-progress-stack"><div class="sd2-progress-block sd2-readiness-block"><div class="sd2-progress-meta"><span>ความพร้อมผ่านระดับ · เฉลี่ยทุกเกณฑ์</span><strong>${percentText(vm.masteryReadiness)} / 100%</strong></div><div class="sd2-progress-track sd2-readiness-track" role="progressbar" aria-label="ความพร้อมผ่านระดับ เฉลี่ยทุกเกณฑ์" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${readinessProgress}"><i class="sd2-progress-fill" style="width:${readinessProgress}%"></i></div><div class="sd2-readiness-status">${escapeHtml(readinessText)}</div></div></div>${canLaunch?`<button type="button" class="dashboard-continue sd2-continue-action" data-exercise-code="${escapeHtml(stage.exercise_code)}" data-stage-code="${escapeHtml(stage.stage_code)}" data-session-mode="${sessionMode}">${escapeHtml(actionLabel)}</button>`:''}</div>`;
}

function renderPractice(vm){
  const target=$('sd2PracticeBody');
  if(!target) return;
  const stage=vm.currentStage,rec=vm.recommendation;
  if(!stage){target.className='sd2-empty';target.textContent=vm.path.pathMastered?'คุณสำเร็จ Learning Path ที่กำหนดแล้ว':'ยังไม่พบแบบฝึกหัดที่พร้อมเริ่ม';return;}
  const actionType=rec?.actionType||(stage.stage_status==='mastered'?'review':'practice');
  const sessionMode=actionType==='diagnostic'?'pretest':'practice';
  const actionLabel=actionType==='diagnostic'?'เริ่มประเมินก่อนเรียน':actionType==='completed'?'ทบทวนผลการเรียน':actionType==='review'?'ทบทวน':'เริ่มฝึก';
  const canLaunch=stage.exercise_code&&stage.stage_code&&actionType!=='completed';
  target.className='sd2-practice-layout';
  target.innerHTML=`<div><div class="sd2-eyebrow">Practice</div><h2 id="sd2PracticeHeading">${escapeHtml(stage.exercise_name||vm.path.exerciseName)}</h2><p class="sd2-subtle">Stage ${vm.currentOrdinal||'—'} of ${vm.path.totalStages||'—'} · ${escapeHtml(stage.stage_name||stage.stage_code||'Current Stage')}</p><p class="sd2-focus-line">${escapeHtml(rec?.reasonTh||'เลือกแบบฝึกหัดนี้ตาม Stage ปัจจุบันของคุณ')}</p></div>${canLaunch?`<button type="button" class="dashboard-continue sd2-continue-action" data-exercise-code="${escapeHtml(stage.exercise_code)}" data-stage-code="${escapeHtml(stage.stage_code)}" data-session-mode="${escapeHtml(sessionMode)}">${actionLabel}</button>`:'<div class="sd2-empty">ยังไม่มีแบบฝึกหัดที่เปิดให้เริ่มในขณะนี้</div>'}`;
}

function summaryMarkup(vm){
  return `<article class="sd2-summary-card"><div class="sd2-eyebrow">Current Stage</div><strong>${vm.currentOrdinal||'—'} / ${vm.path.totalStages||'—'}</strong><span>${escapeHtml(vm.currentStage?.stage_name||'ยังไม่เริ่ม')}</span></article><article class="sd2-summary-card"><div class="sd2-eyebrow">Mastered Skills</div><strong>${vm.masteredSkills} / ${SKILL_ORDER.length}</strong><span>ตามเกณฑ์ Mastery ของ Stage ปัจจุบัน</span></article><article class="sd2-summary-card"><div class="sd2-eyebrow">Practice Sessions</div><strong>${vm.history.totalPracticeSessions}</strong><span>จำนวน session ที่บันทึกในระบบ</span></article><article class="sd2-summary-card"><div class="sd2-eyebrow">Overall Progress</div><strong>${vm.path.overallProgress}%</strong><span>ผ่าน ${vm.path.masteredCount} จาก ${vm.path.totalStages} Stage</span><div class="sd2-mini-progress"><div class="sd2-progress-track"><i class="sd2-progress-fill" style="width:${vm.path.overallProgress}%"></i></div></div></article>`;
}

function renderSummary(vm){const target=$('sd2Summary');if(target)target.innerHTML=summaryMarkup(vm);}

function renderSkills(vm){
  const target=$('sd2SkillList');
  if(!target) return;
  target.innerHTML=vm.skills.map(skill=>`<button type="button" class="sd2-skill" data-sd2-skill-filter="${escapeHtml(skill.code)}" aria-label="${currentLanguage()==='en'?'Open progress for':'เปิดความก้าวหน้าของ'} ${escapeHtml(skill.label)}"><div><div class="sd2-skill-name">${escapeHtml(skill.label)}</div></div><div class="sd2-skill-score">${percentText(skill.score)}</div><div class="sd2-skill-bar"><i style="width:${clampPercent(skill.score)}%"></i></div><div class="sd2-skill-footer"><span>${Number.isFinite(skill.threshold)?`เกณฑ์ ${percentText(skill.threshold)}`:'ยังไม่มีคะแนนเพียงพอ'}</span><span class="sd2-status ${skill.status}">${statusLabel(skill.status)}</span></div></button>`).join('');
}

function stageState(stage,current){
  if(stage.stage_status==='mastered') return {cls:'is-mastered completed',status:'mastered',icon:'✓',label:'Completed'};
  if(current&&(stage.stage_id||stage.stage_code)===(current.stage_id||current.stage_code)) return {cls:'is-current current',status:'current',icon:stage.ordinal,label:'Current'};
  if(stage.stage_status==='locked') return {cls:'is-locked locked',status:'locked',icon:stage.ordinal,label:'Locked'};
  return {cls:'upcoming',status:'upcoming',icon:stage.ordinal,label:'Upcoming'};
}

function renderLearningPath(vm){
  const target=$('sd2StageList');
  if(!target) return;
  target.innerHTML=vm.path.stages.length?vm.path.stages.map(stage=>{
    const state=stageState(stage,vm.path.current);
    return `<li class="sd2-stage ${state.cls}"${state.status==='current'?' aria-current="step"':''}><div class="sd2-stage-icon" aria-hidden="true">${state.icon}</div><div><div class="sd2-stage-title">${escapeHtml(stage.stage_name||stage.stage_code||`Stage ${stage.ordinal}`)}</div><span class="sd2-status ${state.status}">${state.label}</span></div></li>`;
  }).join(''):'<li class="sd2-empty">ยังไม่มี Stage ใน Learning Path นี้</li>';
}

function dateTime(value){const d=new Date(value);return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'short'}).format(d);}

function renderRecent(vm){
  const target=$('sd2RecentList');
  if(!target) return;
  const sorted=[...vm.history.sessions].sort((a,b)=>new Date(b.started_at)-new Date(a.started_at)).slice(0,3);
  target.innerHTML=sorted.length?sorted.map(session=>`<article class="sd2-recent-item"><div class="sd2-recent-main"><div class="sd2-recent-title">${escapeHtml(session.stageName)}</div><div class="sd2-recent-meta">${escapeHtml(dateTime(session.started_at))} · ${escapeHtml(session.exerciseName)}</div></div><div class="sd2-recent-stats"><span class="sd2-recent-score">${percentText(session.score)}</span><span class="sd2-status ${session.status==='completed'?'mastered':'developing'}">${session.status==='completed'?'Completed':'In progress'}</span></div></article>`).join(''):'<div class="sd2-empty">ยังไม่มี Practice Session ที่บันทึกไว้</div>';
}

function renderProgressOverall(vm){const target=$('sd2ProgressOverallBody');if(target)target.innerHTML=summaryMarkup(vm);}

function renderProgressSkills(vm){
  const target=$('sd2ProgressSkillList');
  if(!target) return;
  target.innerHTML=vm.skills.map(skill=>{
    const trend=skillTrend(vm,skill.code);
    return `<article class="sd2-progress-skill" data-progress-skill="${escapeHtml(skill.code)}"><div class="sd2-progress-skill-head"><div><div class="sd2-skill-name">${escapeHtml(skill.label)}</div></div><div class="sd2-skill-score">${percentText(skill.score)}</div></div><div class="sd2-skill-bar"><i style="width:${clampPercent(skill.score)}%"></i></div><div class="sd2-progress-skill-metrics"><div><span>Status</span><strong class="sd2-status ${skill.status}">${statusLabel(skill.status)}</strong></div><div><span>Trend</span><strong class="sd2-trend ${trend.direction}">${escapeHtml(trend.label)}</strong></div><div><span>Recent performance</span><strong>${percentText(trend.recent)}</strong></div><div><span>Mastery threshold</span><strong>${percentText(skill.threshold)}</strong></div></div></article>`;
  }).join('');
}

function renderTrendChart(vm){
  const filter=$('sd2ProgressTrendFilter'),target=$('sd2ProgressTrendChart');
  if(!filter||!target) return;
  const options=[['ALL','All Skills'],...vm.skills.map(skill=>[skill.code,skill.label])];
  if(!options.some(([value])=>value===trendSkill)) trendSkill='ALL';
  filter.innerHTML=options.map(([value,label])=>`<option value="${escapeHtml(value)}"${value===trendSkill?' selected':''}>${escapeHtml(label)}</option>`).join('');
  filter.value=trendSkill;
  const points=skillSeries(vm,trendSkill).slice(-12);
  if(points.length<2){target.innerHTML='<div class="sd2-empty">ต้องมีผลการฝึกอย่างน้อย 2 session จึงจะแสดงแนวโน้มตามเวลาได้</div>';return;}
  const width=760,height=220,pad={l:34,r:20,t:22,b:34};
  const x=index=>pad.l+(width-pad.l-pad.r)*(points.length===1?0:index/(points.length-1));
  const y=value=>pad.t+(height-pad.t-pad.b)*(1-clampPercent(value)/100);
  const coords=points.map((point,index)=>[x(index),y(point.value)]);
  const line=coords.map(([cx,cy],index)=>`${index?'L':'M'} ${cx.toFixed(1)} ${cy.toFixed(1)}`).join(' ');
  const area=`${line} L ${coords.at(-1)[0].toFixed(1)} ${(height-pad.b).toFixed(1)} L ${coords[0][0].toFixed(1)} ${(height-pad.b).toFixed(1)} Z`;
  const grid=[0,25,50,75,100].map(value=>`<line class="sd2-chart-grid" x1="${pad.l}" x2="${width-pad.r}" y1="${y(value)}" y2="${y(value)}"></line><text class="sd2-chart-label" x="4" y="${y(value)+3}">${value}%</text>`).join('');
  const dots=coords.map(([cx,cy],index)=>`<circle class="sd2-chart-dot" cx="${cx}" cy="${cy}" r="4"></circle><text class="sd2-chart-value" text-anchor="middle" x="${cx}" y="${cy-9}">${Math.round(points[index].value)}%</text>`).join('');
  const dates=points.map((point,index)=>{const d=new Date(point.date),label=Number.isNaN(d.getTime())?'':new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short'}).format(d);return `<text class="sd2-chart-label" text-anchor="middle" x="${x(index)}" y="${height-9}">${escapeHtml(label)}</text>`;}).join('');
  target.innerHTML=`<svg class="sd2-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="แนวโน้มผลการฝึก"><path class="sd2-chart-area" d="${area}"></path>${grid}<path class="sd2-chart-line" d="${line}"></path>${dots}${dates}</svg><div class="sd2-chart-legend"><span>ข้อมูลจริงจาก Practice Sessions / Attempts</span><span>${points.length} จุดล่าสุดที่มีคะแนน</span></div>`;
}

function stageEvidenceDate(vm,stage){
  const matches=vm.history.sessions.filter(session=>session.stageCode&&session.stageCode===stage.stage_code&&session.status==='completed').sort((a,b)=>new Date(b.completed_at||b.started_at)-new Date(a.completed_at||a.started_at));
  return matches[0]?.completed_at||matches[0]?.started_at||null;
}

function renderProgressStages(vm){
  const target=$('sd2ProgressStageList');
  if(!target) return;
  target.innerHTML=vm.path.stages.length?vm.path.stages.map(stage=>{
    const state=stageState(stage,vm.path.current);
    const current=(stage.stage_id||stage.stage_code)===(vm.currentStage?.stage_id||vm.currentStage?.stage_code);
    const score=current?vm.stageMastery:(stage.last_mastery_score==null?null:Number(stage.last_mastery_score));
    const evidenceDate=stageEvidenceDate(vm,stage);
    return `<article class="sd2-stage-history-item ${state.cls}"${state.status==='current'?' aria-current="step"':''}><div class="sd2-stage-history-index">${state.icon}</div><div><div class="sd2-stage-title">${escapeHtml(stage.stage_name||stage.stage_code||`Stage ${stage.ordinal}`)}</div><div class="sd2-stage-meta">${escapeHtml(stage.exercise_name||stage.exercise_code||'')}</div>${evidenceDate?`<div class="sd2-stage-meta">หลักฐาน session ล่าสุด: ${escapeHtml(dateTime(evidenceDate))}</div>`:''}</div><div class="sd2-stage-history-status"><span class="sd2-status ${state.status}">${state.label}</span>${Number.isFinite(score)?`<strong>${percentText(score)}</strong>`:''}</div></article>`;
  }).join(''):'<div class="sd2-empty">ยังไม่มี Stage ใน Learning Path นี้</div>';
}

function renderAttempt(attempt){
  const skills=Array.isArray(attempt.skillResults)?attempt.skillResults:[];
  const skillHtml=skills.length?skills.map(skill=>`<span class="sd2-attempt-skill"><strong>${escapeHtml(skillDisplayName(skill.skill_code))}</strong> ${Number(skill.correct_count||0)}/${Number(skill.total_count||0)} · ${percentText(skill.score==null?(Number(skill.total_count)>0?Number(skill.correct_count)/Number(skill.total_count)*100:null):skill.score)}</span>`).join(''):'<span class="sd2-subtle">ไม่มี skill result รายข้อที่บันทึกไว้</span>';
  return `<article class="sd2-attempt"><div class="sd2-attempt-head"><strong>ข้อ ${Number(attempt.question_number||0)||'—'}</strong><span>${escapeHtml(attempt.item_code||'ไม่ระบุ item')}</span><b>${percentText(attempt.score)}</b></div><div class="sd2-attempt-skills">${skillHtml}</div></article>`;
}

function renderSessionHistory(vm){
  const target=$('sd2SessionHistoryList');
  if(!target) return;
  const sessions=[...vm.history.sessions].sort((a,b)=>new Date(b.started_at)-new Date(a.started_at));
  target.innerHTML=sessions.length?sessions.map(session=>{
    const attempts=session.attempts||[];
    return `<details class="sd2-session" data-session-id="${escapeHtml(session.id||'')}"><summary><div><strong>${escapeHtml(session.stageName)} · ${escapeHtml(session.exerciseName)}</strong><span>${escapeHtml(dateTime(session.started_at))}</span></div><div class="sd2-session-summary-stats"><b>${percentText(session.score)}</b><span>${Number(session.completed_questions||0)} / ${Number(session.planned_questions||0)||'—'} ข้อ</span><span class="sd2-status ${session.status==='completed'?'mastered':'developing'}">${session.status==='completed'?'Completed':'In progress'}</span></div></summary><div class="sd2-session-detail"><div class="sd2-session-detail-head">Attempt / Detailed Review</div>${attempts.length?attempts.map(renderAttempt).join(''):'<div class="sd2-empty">Session นี้ยังไม่มี attempt detail ที่ระบบส่งกลับมา</div>'}</div></details>`;
  }).join(''):'<div class="sd2-empty">ยังไม่มี Session History</div>';
}

function renderAll(vm){
  renderContinue(vm);
  renderPractice(vm);
  renderSummary(vm);
  renderSkills(vm);
  renderLearningPath(vm);
  renderRecent(vm);
  renderProgressOverall(vm);
  renderProgressSkills(vm);
  renderTrendChart(vm);
  renderProgressStages(vm);
  renderSessionHistory(vm);
  renderProfile(profileState.data,profileState.user);
  window.__studentDashboardV2Model=vm;
  syncNavigation();
}

async function refresh(){
  const shell=$('studentDashboard');
  if(!repo||!learningRepo||!shell||shell.hidden) return;
  if(!ensureStructure()) return;
  const token=++revision;
  try{
    const authLoad=await resolveWithin(Promise.resolve().then(()=>authRepo?.getUser?.()),2000,'auth');
    const authResult=authLoad.value||{data:{user:null},error:null};
    const authUser=authResult?.data?.user||null;
    profileState.user=authUser;
    const historyPromise=Promise.resolve(repo.getStudentLearningHistory({limit:12})).catch(error=>({data:null,error}));
    const profilePromise=authUser?Promise.resolve(repo.getStudentProfileDetails(authUser.id)).catch(error=>({data:null,error})):Promise.resolve({data:null,error:null});
    const dashboardRequest=Promise.resolve().then(()=>repo.getStudentDashboard());
    const skillsRequest=Promise.resolve().then(()=>repo.getActiveSkills());
    const recommendationRequest=Promise.resolve().then(()=>learningRepo.getRecommendedNextAction());
    const [dashboardLoad,skillsLoad,recommendationLoad]=await Promise.all([
      resolveWithin(dashboardRequest,2500,'dashboard'),resolveWithin(skillsRequest,2000,'skills'),resolveWithin(recommendationRequest,2000,'recommendation')
    ]);
    if(token!==revision) return;
    const dashboardResult=dashboardLoad.value||{data:[],error:null};
    const skillsResult=skillsLoad.value||{data:[],error:null};
    const recommendationResult=recommendationLoad.value||{data:null,error:null};
    if(dashboardLoad.timedOut) dashboardRequest.then(()=>{if(token===revision)scheduleRefresh(0);}).catch(()=>{});
    if(skillsLoad.timedOut) skillsRequest.then(()=>{if(token===revision)scheduleRefresh(0);}).catch(()=>{});
    if(recommendationLoad.timedOut) recommendationRequest.then(()=>{if(token===revision)scheduleRefresh(0);}).catch(()=>{});
    if(dashboardResult.error) console.warn('STUDENT DASHBOARD V2:',dashboardResult.error);
    if(skillsResult.error) console.warn('STUDENT DASHBOARD V2 SKILLS:',skillsResult.error);
    if(recommendationResult.error) console.warn('STUDENT DASHBOARD V2 RECOMMENDATION:',recommendationResult.error);
    const rows=Array.isArray(dashboardResult.data)?dashboardResult.data:[];
    const path=buildPathModel(rows);
    let mastery=null;
    const basicHistory={sessions:[],attempts:[],skillResults:[],totalPracticeSessions:0};
    renderAll(buildDashboardViewModel({rows,activeSkills:skillsResult.data||[],recommendation:recommendationResult.data,mastery,history:basicHistory}));
    const masteryPromise=path.active?.exercise_code&&path.active?.stage_code
      ? Promise.resolve().then(()=>repo.getStageMastery({exerciseCode:path.active.exercise_code,stageCode:path.active.stage_code})).then(masteryResult=>{
        if(token!==revision)return;
        if(masteryResult.error) console.warn('STUDENT DASHBOARD V2 MASTERY:',masteryResult.error); else mastery=first(masteryResult.data);
        renderAll(buildDashboardViewModel({rows,activeSkills:skillsResult.data||[],recommendation:recommendationResult.data,mastery,history:basicHistory}));
      }).catch(error=>console.warn('STUDENT DASHBOARD V2 MASTERY:',error))
      : Promise.resolve();
    Promise.all([historyPromise,profilePromise]).then(([historyResult,profileResult])=>{
      if(token!==revision)return;
      if(historyResult.error)console.warn('STUDENT DASHBOARD V2 HISTORY:',historyResult.error);
      if(profileResult.error)console.warn('STUDENT DASHBOARD V2 PROFILE:',profileResult.error);else profileState.data=profileResult.data||{};
      renderAll(buildDashboardViewModel({rows,activeSkills:skillsResult.data||[],recommendation:recommendationResult.data,mastery,history:historyResult.data||basicHistory}));
    }).catch(error=>console.warn('STUDENT DASHBOARD V2 DEFERRED DATA:',error));
  }catch(error){
    console.warn('STUDENT DASHBOARD V2:',error);
    if(!syncLegacyFallbackAction()){
      const target=$('sd2ContinueBody');
      if(target){target.className='sd2-empty';target.textContent='ไม่สามารถโหลด Dashboard แบบละเอียดได้ แต่ข้อมูลพื้นฐานยังพร้อมใช้งานเมื่อระบบรีเฟรช';}
    }
  }
}

function scheduleRefresh(delay=80){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>refresh(),delay);}

function handleNavigation(action){
  if(action==='logout'){$('dashboardLogoutButton')?.click();return;}
  const target=$(NAV_TARGETS[action]);
  if(!target) return;
  window.location.hash=NAV_TARGETS[action];
  syncNavigation();
  target.focus({preventScroll:true});
  target.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
}

async function saveProfile(form){
  if(profileState.busy||!profileState.user?.id) return;
  const data=new FormData(form),value=name=>String(data.get(name)||'').trim();
  const firstName=value('first_name'),lastName=value('last_name');
  if(!firstName||!lastName){profileState.error=true;profileState.message='กรุณาระบุชื่อและนามสกุล';renderProfile(profileState.data,profileState.user);return;}
  profileState={...profileState,busy:true,message:'',error:false};
  renderProfile(profileState.data,profileState.user);
  const result=await repo.updateStudentProfile({userId:profileState.user.id,fullName:`${firstName}${PROFILE_NAME_SEPARATOR}${lastName}`,displayName:value('nickname')||null,studentId:value('student_id')||null,program:value('program')||null,avatarUrl:value('avatar_url')||null});
  if(result.error) profileState={...profileState,busy:false,error:true,message:'บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่'};
  else profileState={...profileState,busy:false,error:false,message:'บันทึกข้อมูลโปรไฟล์แล้ว',data:result.data};
  renderProfile(profileState.data,profileState.user);
  app.navigationDrawer?.sync?.();
}

function bind(){
  if(initialized) return;
  initialized=true;
  window.addEventListener('hashchange',syncNavigation);
  window.addEventListener('major-scale:languagechange',()=>scheduleRefresh(0));
  document.addEventListener('click',event=>{
    const nav=event.target.closest?.('[data-sd2-nav]');
    if(nav){if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();handleNavigation(nav.dataset.sd2Nav);return;}
    if(event.target.closest?.('[data-sd2-profile-cancel]')){profileState={...profileState,message:'',error:false};renderProfile(profileState.data,profileState.user);return;}
    const skill=event.target.closest?.('[data-sd2-skill-filter]');
    if(skill){
      trendSkill=skill.dataset.sd2SkillFilter||'ALL';
      const vm=window.__studentDashboardV2Model;
      if(vm){renderProgressSkills(vm);renderTrendChart(vm);}
      handleNavigation('progress');
      requestAnimationFrame(()=>document.querySelector(`[data-progress-skill="${CSS.escape(trendSkill)}"]`)?.scrollIntoView({behavior:'smooth',block:'center'}));
    }
  });
  document.addEventListener('submit',event=>{if(event.target?.id==='sd2ProfileForm'){event.preventDefault();saveProfile(event.target);}});
  document.addEventListener('change',event=>{if(event.target?.id==='sd2ProgressTrendFilter'){trendSkill=event.target.value||'ALL';const vm=window.__studentDashboardV2Model;if(vm)renderTrendChart(vm);}});
  const shell=$('studentDashboard');
  const observer=new MutationObserver(()=>{if(shell&&!shell.hidden)scheduleRefresh(100);});
  if(shell) observer.observe(shell,{attributes:true,attributeFilter:['hidden']});
  const legacy=$('dashboardCurrentFocus');
  if(legacy){legacyObserver=new MutationObserver(()=>syncLegacyFallbackAction());legacyObserver.observe(legacy,{childList:true,subtree:true,characterData:true});syncLegacyFallbackAction();}
}

ensureStylesheet();
ensureStructure();
bind();
if($('studentDashboard')&&!$('studentDashboard').hidden) scheduleRefresh(30);
app.studentDashboardV2=Object.freeze({refresh,buildPathModel,buildHistoryModel,buildSkillModel,buildDashboardViewModel,skillSeries,skillTrend,syncLegacyFallbackAction,syncNavigation});
})();
