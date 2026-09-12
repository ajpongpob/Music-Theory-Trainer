(() => {
'use strict';

const app=window.MajorScaleApp=window.MajorScaleApp || {};
const repo=app.dashboardRepository;
const learningRepo=app.learningRepository;
const masteryCore=app.masteryLearningCore;
const $=id=>document.getElementById(id);

const SKILL_ORDER=['BN01_TREBLE_PITCH','BN06_STEM_DIRECTION','RH01_DURATION_VALUE','GR02_PRIMARY_BEAM','MS03_SCALE_ACCIDENTAL'];
const SKILL_LABELS=Object.freeze({
  BN01_TREBLE_PITCH:'Treble Pitch',
  BN06_STEM_DIRECTION:'Stem Direction',
  RH01_DURATION_VALUE:'Duration Value',
  GR02_PRIMARY_BEAM:'Primary Beam',
  MS03_SCALE_ACCIDENTAL:'Scale Accidental'
});

let revision=0,initialized=false,showAllRecent=false,trendSkill='ALL',refreshTimer=null,profileOpen=false,legacyObserver=null;
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const first=data=>Array.isArray(data)?(data[0]||null):(data||null);
const clampPercent=value=>Number.isFinite(Number(value))?Math.max(0,Math.min(100,Number(value))):0;
const percentText=value=>Number.isFinite(Number(value))?`${Number(value).toFixed(1).replace(/\.0$/,'')}%`:'—';

function ensureStylesheet(){
  if(document.querySelector('link[data-student-dashboard-v2-style]')) return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='./styles/student-dashboard-v2.css';
  link.setAttribute('data-student-dashboard-v2-style','true');
  document.head.appendChild(link);
}

function navButtons(mobile){
  const button=(symbol,label,action,classes='')=>`<button type="button" class="sd2-nav-button ${classes}" data-sd2-nav="${action}">${mobile?`<b aria-hidden="true">${symbol}</b>`:''}<span>${label}</span></button>`;
  return [
    button('⌂','Dashboard','dashboard','is-active'),
    button('▶','Practice','practice','is-primary'),
    button('↗','Progress','progress'),
    button('●','Profile','profile')
  ].join('');
}

function syncLegacyFallbackAction(){
  const body=$('sd2ContinueBody');
  const legacy=$('dashboardRecommendation')?.querySelector('.dashboard-continue[data-exercise-code]');
  if(!body || !legacy || body.querySelector('.dashboard-continue')) return false;
  body.className='sd2-continue-layout';
  body.innerHTML=`
    <div class="sd2-continue-main">
      <div class="sd2-eyebrow">Continue Learning · Next Recommended Activity</div>
      <h2 id="sd2ContinueHeading">${escapeHtml($('dashboardFocusTitle')?.textContent || 'เรียนต่อจาก Stage ปัจจุบัน')}</h2>
      <div class="sd2-subtle">${escapeHtml($('dashboardFocusExercise')?.textContent || 'ระบบกำลังเตรียมรายละเอียด Mastery เพิ่มเติม')}</div>
    </div>
    <div class="sd2-continue-side">
      <button type="button" class="dashboard-continue sd2-continue-action" data-exercise-code="${escapeHtml(legacy.dataset.exerciseCode||'')}" data-stage-code="${escapeHtml(legacy.dataset.stageCode||'')}" data-session-mode="${escapeHtml(legacy.dataset.sessionMode||'practice')}">${escapeHtml(legacy.textContent?.trim() || 'ฝึกต่อ')}</button>
    </div>`;
  return true;
}

function ensureStructure(){
  const shell=$('studentDashboard'),content=$('dashboardContent');
  if(!shell||!content) return false;
  shell.classList.add('dashboard-v2-enabled');

  const brand=shell.querySelector('.student-dashboard-brand');
  if(brand){
    const kicker=brand.querySelector('.student-dashboard-kicker'),title=brand.querySelector('h1'),description=brand.querySelector('p');
    if(kicker) kicker.textContent='Major Scale Learning Dashboard';
    if(title) title.textContent='เรียนต่อจากจุดที่สำคัญที่สุด';
    if(description) description.textContent='ติดตาม Stage, Mastery รายทักษะ และกิจกรรมที่ควรทำต่อจากหลักฐานการฝึกของคุณ';
  }

  if(!$('sd2TopNav')){
    const nav=document.createElement('nav');
    nav.id='sd2TopNav';nav.className='sd2-top-nav';nav.setAttribute('aria-label','เมนูผู้เรียน');nav.innerHTML=navButtons(false);
    shell.querySelector('.student-dashboard-header')?.insertAdjacentElement('afterend',nav);
  }
  if(!$('sd2ProfilePanel')){
    const panel=document.createElement('section');
    panel.id='sd2ProfilePanel';panel.className='sd2-profile-panel';panel.setAttribute('aria-label','โปรไฟล์ผู้เรียน');
    panel.innerHTML='<div><strong id="sd2ProfileName">ผู้เรียน</strong><span>บัญชีผู้เรียน · Major Scale Notation Trainer</span></div><button type="button" class="btn" data-sd2-nav="logout">ออกจากระบบ</button>';
    $('sd2TopNav')?.insertAdjacentElement('afterend',panel);
  }

  if(!content.classList.contains('sd2-dashboard')){
    // Preserve the exact legacy nodes because the original controller keeps
    // references to them. Recreating matching ids would break later refreshes.
    const legacyPath=$('dashboardPathList');
    const legacyFocus=$('dashboardCurrentFocus');
    const legacyAction=legacyFocus?.querySelector('.dashboard-continue[data-exercise-code]') || null;
    const legacySnapshot=legacyAction?{
      exerciseCode:legacyAction.dataset.exerciseCode||'',
      stageCode:legacyAction.dataset.stageCode||'',
      sessionMode:legacyAction.dataset.sessionMode||'practice',
      text:legacyAction.textContent?.trim()||'ฝึกต่อ',
      title:$('dashboardFocusTitle')?.textContent||'',
      exercise:$('dashboardFocusExercise')?.textContent||''
    }:null;

    content.className='sd2-dashboard';
    content.innerHTML=`
      <section id="sd2Continue" class="sd2-card sd2-continue" aria-labelledby="sd2ContinueHeading"><div id="sd2ContinueBody" class="sd2-empty">กำลังเตรียมกิจกรรมถัดไป...</div></section>
      <section id="sd2Summary" class="sd2-summary-grid" aria-label="ภาพรวมความก้าวหน้า"></section>
      <div class="sd2-primary-grid">
        <section id="sd2Skills" class="sd2-card" aria-labelledby="sd2SkillsHeading"><div class="sd2-section-head"><div><div class="sd2-eyebrow">Skill Mastery</div><h2 id="sd2SkillsHeading">ทักษะที่ทำได้ดีและทักษะที่ควรพัฒนา</h2></div></div><div id="sd2SkillList" class="sd2-skill-list"></div></section>
        <section id="sd2LearningPath" class="sd2-card" aria-labelledby="sd2PathHeading"><div class="sd2-section-head"><div><div class="sd2-eyebrow">Learning Path</div><h2 id="sd2PathHeading">ตำแหน่งปัจจุบันในเส้นทางการเรียน</h2></div></div><div id="sd2StageList" class="sd2-stage-list"></div></section>
      </div>
      <section id="sd2Trend" class="sd2-card" aria-labelledby="sd2TrendHeading"><div class="sd2-section-head"><div><div class="sd2-eyebrow">Learning Trend</div><h2 id="sd2TrendHeading">แนวโน้มผลการฝึกล่าสุด</h2></div><select id="sd2TrendFilter" class="sd2-filter" aria-label="เลือกทักษะสำหรับกราฟ"></select></div><div id="sd2TrendChart" class="sd2-chart-wrap"></div></section>
      <section id="sd2Recent" class="sd2-card" aria-labelledby="sd2RecentHeading"><div class="sd2-section-head"><div><div class="sd2-eyebrow">Recent Activity</div><h2 id="sd2RecentHeading">กิจกรรมการฝึกล่าสุด</h2></div><button id="sd2ViewAll" type="button" class="sd2-view-all">ดูทั้งหมด</button></div><div id="sd2RecentList" class="sd2-recent-list"></div></section>
      <section id="sd2Achievements" class="sd2-card" aria-labelledby="sd2AchievementsHeading"><div class="sd2-section-head"><div><div class="sd2-eyebrow">Achievements</div><h2 id="sd2AchievementsHeading">ความสำเร็จระหว่างการเรียน</h2></div></div><div id="sd2AchievementList" class="sd2-achievement-list"></div></section>
      <div id="sd2Compat" class="sd2-compat" aria-hidden="true"></div>`;

    const compat=$('sd2Compat');
    if(legacyPath) compat?.appendChild(legacyPath);
    if(legacyFocus) compat?.appendChild(legacyFocus);

    if(legacySnapshot && !$('sd2ContinueBody')?.querySelector('.dashboard-continue')){
      $('sd2ContinueBody').className='sd2-continue-layout';
      $('sd2ContinueBody').innerHTML=`<div class="sd2-continue-main"><div class="sd2-eyebrow">Continue Learning · Next Recommended Activity</div><h2 id="sd2ContinueHeading">${escapeHtml(legacySnapshot.title||'เรียนต่อ')}</h2><div class="sd2-subtle">${escapeHtml(legacySnapshot.exercise||'กำลังโหลดรายละเอียด Mastery')}</div></div><div class="sd2-continue-side"><button type="button" class="dashboard-continue sd2-continue-action" data-exercise-code="${escapeHtml(legacySnapshot.exerciseCode)}" data-stage-code="${escapeHtml(legacySnapshot.stageCode)}" data-session-mode="${escapeHtml(legacySnapshot.sessionMode)}">${escapeHtml(legacySnapshot.text)}</button></div>`;
    }
  }

  if(!$('sd2BottomNav')){
    const nav=document.createElement('nav');
    nav.id='sd2BottomNav';nav.className='sd2-bottom-nav';nav.setAttribute('aria-label','เมนูผู้เรียนบนมือถือ');nav.innerHTML=navButtons(true);shell.appendChild(nav);
  }
  return true;
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
    if(seen.has(key)) return;seen.add(key);unique.push({...row,ordinal:unique.length+1});
  });
  const current=unique.find(row=>row.stage_status==='in_progress')||null;
  const mastered=unique.filter(row=>row.stage_status==='mastered');
  const latestMastered=[...mastered].sort((a,b)=>Number(b.stage_sequence||0)-Number(a.stage_sequence||0))[0]||null;
  const active=current||latestMastered||unique[0]||null;
  return {rows:list,stages:unique,current,active,masteredCount:mastered.length,totalStages:unique.length,overallProgress:unique.length?Math.round(mastered.length/unique.length*100):0,pathMastered:unique.length>0&&mastered.length===unique.length,pathName:ordered[0]?.learning_path_name||ordered[0]?.learning_path_code||'Learning Path',exerciseName:active?.exercise_name||active?.exercise_code||'Major Scale Notation'};
}

function buildHistoryModel(history,pathModel){
  const source=history||{},sessions=Array.isArray(source.sessions)?source.sessions:[],attempts=Array.isArray(source.attempts)?source.attempts:[],skillResults=Array.isArray(source.skillResults)?source.skillResults:[];
  const stageById=new Map(pathModel.stages.map(row=>[String(row.stage_id||''),row]));
  const exerciseById=new Map(pathModel.rows.map(row=>[String(row.exercise_id||''),row]));
  const attemptsBySession=new Map(),skillByAttempt=new Map();
  attempts.forEach(attempt=>{const key=String(attempt.practice_session_id||'');if(!attemptsBySession.has(key)) attemptsBySession.set(key,[]);attemptsBySession.get(key).push(attempt);});
  skillResults.forEach(skill=>{const key=String(skill.attempt_id||'');if(!skillByAttempt.has(key)) skillByAttempt.set(key,[]);skillByAttempt.get(key).push(skill);});
  const enriched=sessions.map(session=>{
    const sessionAttempts=attemptsBySession.get(String(session.id||''))||[];
    const scores=sessionAttempts.map(a=>Number(a.score)).filter(Number.isFinite);
    const fallback=scores.length?scores.reduce((sum,v)=>sum+v,0)/scores.length:null;
    const score=session.overall_score==null?fallback:(Number.isFinite(Number(session.overall_score))?Number(session.overall_score):fallback);
    const bySkill={};SKILL_ORDER.forEach(code=>{bySkill[code]={correct:0,total:0,score:null};});
    sessionAttempts.forEach(attempt=>(skillByAttempt.get(String(attempt.id||''))||[]).forEach(skill=>{const code=skill.skill_code;if(!bySkill[code]) bySkill[code]={correct:0,total:0,score:null};bySkill[code].correct+=Number(skill.correct_count||0);bySkill[code].total+=Number(skill.total_count||0);}));
    Object.values(bySkill).forEach(value=>{value.score=value.total>0?value.correct/value.total*100:null;});
    const stage=stageById.get(String(session.stage_id||'')),exercise=exerciseById.get(String(session.exercise_id||''));
    return {...session,score,skillScores:bySkill,stageName:stage?.stage_name||stage?.stage_code||'Stage',stageCode:stage?.stage_code||'',exerciseName:exercise?.exercise_name||exercise?.exercise_code||'Major Scale Notation',status:session.completed_at||Number(session.completed_questions||0)>=Number(session.planned_questions||0)?'completed':'in_progress'};
  });
  return {sessions:enriched,totalPracticeSessions:Number.isFinite(Number(source.totalPracticeSessions))?Number(source.totalPracticeSessions):enriched.filter(s=>s.mode==='practice').length};
}

function buildSkillModel(activeSkills,mastery){
  const activeMap=new Map((activeSkills||[]).map(skill=>[skill.code,skill])),resultMap=new Map((mastery?.skill_results||[]).map(skill=>[skill.skill_code,skill]));
  const codes=[...SKILL_ORDER.filter(code=>activeMap.has(code)||resultMap.has(code)),...Array.from(activeMap.keys()).filter(code=>!SKILL_ORDER.includes(code))];
  return codes.map(code=>{
    const meta=activeMap.get(code)||{},result=resultMap.get(code)||{};
    const score=result.score==null?null:Number(result.score),threshold=result.threshold==null?null:Number(result.threshold),hasScore=Number.isFinite(score),passed=result.passed===true;
    return {code,label:SKILL_LABELS[code]||meta.short_name||code,description:meta.name_th||meta.short_name||code,score:hasScore?score:null,threshold:Number.isFinite(threshold)?threshold:null,passed,status:passed?'mastered':hasScore&&Number.isFinite(threshold)&&score<threshold?'needs-practice':'developing'};
  });
}

function weakestSkill(skills){return [...(skills||[])].filter(skill=>!skill.passed&&Number.isFinite(skill.score)).sort((a,b)=>a.score-b.score)[0]||null;}
function buildDashboardViewModel({rows,activeSkills,recommendation,mastery,history}){
  const path=buildPathModel(rows),skills=buildSkillModel(activeSkills,mastery),historyModel=buildHistoryModel(history,path),rec=normalizeRecommendation(recommendation);
  const focusCode=rec?.targetSkillCode||weakestSkill(skills)?.code||null,focusSkill=skills.find(skill=>skill.code===focusCode)||null,active=path.current||path.active;
  const currentOrdinal=active?path.stages.findIndex(stage=>(stage.stage_id||stage.stage_code)===(active.stage_id||active.stage_code))+1:0;
  return {path,skills,history:historyModel,recommendation:rec,focusSkill,currentStage:active,currentOrdinal,stageMastery:mastery?.overall_score==null?null:Number(mastery.overall_score),stageThreshold:mastery?.overall_threshold==null?null:Number(mastery.overall_threshold),masteredSkills:skills.filter(skill=>skill.passed).length};
}
function statusLabel(status){return status==='mastered'?'Mastered':status==='needs-practice'?'Needs Practice':'Developing';}

function renderContinue(vm){
  const target=$('sd2ContinueBody');if(!target)return;
  const stage=vm.currentStage,rec=vm.recommendation;
  if(!stage){target.className='sd2-empty';target.textContent=vm.path.pathMastered?'คุณสำเร็จ Learning Path ที่กำหนดแล้ว':'ยังไม่พบ Stage ที่พร้อมสำหรับการฝึก';return;}
  const actionType=rec?.actionType||(stage.stage_status==='mastered'?'review':'practice'),sessionMode=actionType==='diagnostic'?'pretest':'practice';
  const actionLabel=actionType==='diagnostic'?'เริ่มประเมินก่อนเรียน':actionType==='completed'?'ทบทวนผลการเรียน':actionType==='review'?'ทบทวน':'ฝึกต่อ';
  const canLaunch=stage.exercise_code&&stage.stage_code&&actionType!=='completed',progress=Number.isFinite(vm.stageMastery)?clampPercent(vm.stageMastery):0;
  const focus=vm.focusSkill?.label||(rec?.targetItemCode?`โจทย์ ${rec.targetItemCode}`:'สะสมหลักฐานให้ครบเกณฑ์ของ Stage');
  target.className='sd2-continue-layout';
  target.innerHTML=`<div class="sd2-continue-main"><div class="sd2-eyebrow">Continue Learning · Next Recommended Activity</div><div class="sd2-stage-line">Stage ${vm.currentOrdinal||'—'} of ${vm.path.totalStages||'—'} · ${escapeHtml(stage.stage_name||stage.stage_code||'Current Stage')}</div><h2 id="sd2ContinueHeading">${escapeHtml(stage.exercise_name||vm.path.exerciseName)}</h2><div class="sd2-subtle">${escapeHtml(rec?.reasonTh||'เรียนต่อจาก Stage ปัจจุบันตามหลักฐาน Mastery ของคุณ')}</div><div class="sd2-focus-line">Focus: <strong>${escapeHtml(focus)}</strong></div></div><div class="sd2-continue-side"><div><div class="sd2-progress-meta"><span>Stage Mastery</span><strong>${percentText(vm.stageMastery)}${Number.isFinite(vm.stageThreshold)?` / เกณฑ์ ${percentText(vm.stageThreshold)}`:''}</strong></div><div class="sd2-progress-track" role="progressbar" aria-label="Stage Mastery" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><i class="sd2-progress-fill" style="width:${progress}%"></i></div></div>${canLaunch?`<button type="button" class="dashboard-continue sd2-continue-action" data-exercise-code="${escapeHtml(stage.exercise_code)}" data-stage-code="${escapeHtml(stage.stage_code)}" data-session-mode="${sessionMode}">${escapeHtml(actionLabel)}</button>`:''}</div>`;
}

function renderSummary(vm){
  const target=$('sd2Summary');if(!target)return;
  target.innerHTML=`<article class="sd2-summary-card"><div class="sd2-eyebrow">Overall Learning Progress</div><strong>${vm.path.overallProgress}%</strong><span>ผ่าน ${vm.path.masteredCount} จาก ${vm.path.totalStages} Stage</span><div class="sd2-mini-progress"><div class="sd2-progress-track"><i class="sd2-progress-fill" style="width:${vm.path.overallProgress}%"></i></div></div></article><article class="sd2-summary-card"><div class="sd2-eyebrow">Current Stage</div><strong>${vm.currentOrdinal||'—'} / ${vm.path.totalStages||'—'}</strong><span>${escapeHtml(vm.currentStage?.stage_name||'ยังไม่เริ่ม')}</span></article><article class="sd2-summary-card"><div class="sd2-eyebrow">Mastered Skills</div><strong>${vm.masteredSkills} / ${vm.skills.length||SKILL_ORDER.length}</strong><span>นับจากเกณฑ์ Mastery ของ Stage ปัจจุบัน</span></article><article class="sd2-summary-card"><div class="sd2-eyebrow">Practice Sessions</div><strong>${vm.history.totalPracticeSessions}</strong><span>จำนวนชุดฝึกที่บันทึกในระบบ</span></article>`;
}

function renderSkills(vm){
  const target=$('sd2SkillList');if(!target)return;
  target.innerHTML=vm.skills.length?vm.skills.map(skill=>`<button type="button" class="sd2-skill" data-sd2-skill="${escapeHtml(skill.code)}" aria-label="ดูแนวโน้ม ${escapeHtml(skill.label)}"><div><div class="sd2-skill-name">${escapeHtml(skill.label)}</div><div class="sd2-skill-code">${escapeHtml(skill.code)}</div></div><div class="sd2-skill-score">${percentText(skill.score)}</div><div class="sd2-skill-bar"><i style="width:${clampPercent(skill.score)}%"></i></div><div class="sd2-skill-footer"><span>${escapeHtml(skill.description)}</span><span class="sd2-status ${skill.status}">${statusLabel(skill.status)}</span></div></button>`).join(''):'<div class="sd2-empty">ยังไม่มีข้อมูล Mastery รายทักษะสำหรับ Stage นี้</div>';
}

function stageState(stage,current){
  if(stage.stage_status==='mastered')return{cls:'is-mastered',status:'mastered',icon:'✓',label:'Mastered'};
  if(current&&(stage.stage_id||stage.stage_code)===(current.stage_id||current.stage_code))return{cls:'is-current',status:'current',icon:'●',label:'Current'};
  if(stage.stage_status==='locked')return{cls:'is-locked',status:'locked',icon:'🔒',label:'Locked'};
  return{cls:'',status:'available',icon:'○',label:stage.stage_status==='in_progress'?'Current':'Available'};
}
function renderLearningPath(vm){
  const target=$('sd2StageList');if(!target)return;
  target.innerHTML=vm.path.stages.length?vm.path.stages.map(stage=>{
    const state=stageState(stage,vm.path.current),current=(stage.stage_id||stage.stage_code)===(vm.currentStage?.stage_id||vm.currentStage?.stage_code);
    const score=current?vm.stageMastery:(stage.last_mastery_score==null?null:Number(stage.last_mastery_score));
    return `<div class="sd2-stage ${state.cls}"><div class="sd2-stage-icon" aria-hidden="true">${state.icon}</div><div><div class="sd2-stage-title">Stage ${stage.ordinal} — ${escapeHtml(stage.stage_name||stage.stage_code||'')}</div><div class="sd2-stage-meta">${escapeHtml(stage.exercise_name||stage.exercise_code||'')}</div></div><div><span class="sd2-status ${state.status}">${state.label}</span>${Number.isFinite(score)?`<div class="sd2-stage-score">${percentText(score)}</div>`:''}</div></div>`;
  }).join(''):'<div class="sd2-empty">ยังไม่มี Stage ใน Learning Path นี้</div>';
}

function sessionTrendPoints(vm,skillCode){return [...vm.history.sessions].filter(session=>session.mode==='practice').sort((a,b)=>new Date(a.started_at)-new Date(b.started_at)).slice(-8).map(session=>({date:session.started_at,value:skillCode==='ALL'?session.score:session.skillScores?.[skillCode]?.score})).filter(point=>Number.isFinite(Number(point.value)));}
function renderTrendChart(vm){
  const filter=$('sd2TrendFilter'),target=$('sd2TrendChart');if(!filter||!target)return;
  const options=[['ALL','All Skills'],...vm.skills.map(skill=>[skill.code,skill.label])];
  if(!options.some(([value])=>value===trendSkill))trendSkill='ALL';
  filter.innerHTML=options.map(([value,label])=>`<option value="${escapeHtml(value)}"${value===trendSkill?' selected':''}>${escapeHtml(label)}</option>`).join('');filter.value=trendSkill;
  const points=sessionTrendPoints(vm,trendSkill);if(points.length<2){target.innerHTML='<div class="sd2-empty">ต้องมีผลการฝึกอย่างน้อย 2 session จึงจะแสดงแนวโน้มตามเวลาได้</div>';return;}
  const width=760,height=220,pad={l:34,r:20,t:22,b:34},x=index=>pad.l+(width-pad.l-pad.r)*(points.length===1?0:index/(points.length-1)),y=value=>pad.t+(height-pad.t-pad.b)*(1-clampPercent(value)/100),coords=points.map((p,i)=>[x(i),y(p.value)]);
  const line=coords.map(([cx,cy],i)=>`${i?'L':'M'} ${cx.toFixed(1)} ${cy.toFixed(1)}`).join(' '),area=`${line} L ${coords.at(-1)[0].toFixed(1)} ${(height-pad.b).toFixed(1)} L ${coords[0][0].toFixed(1)} ${(height-pad.b).toFixed(1)} Z`;
  const grid=[0,25,50,75,100].map(v=>`<line class="sd2-chart-grid" x1="${pad.l}" x2="${width-pad.r}" y1="${y(v)}" y2="${y(v)}"></line><text class="sd2-chart-label" x="4" y="${y(v)+3}">${v}%</text>`).join('');
  const dots=coords.map(([cx,cy],i)=>`<circle class="sd2-chart-dot" cx="${cx}" cy="${cy}" r="4"></circle><text class="sd2-chart-value" text-anchor="middle" x="${cx}" y="${cy-9}">${Math.round(points[i].value)}%</text>`).join('');
  const dates=points.map((point,i)=>{const d=new Date(point.date),label=Number.isNaN(d.getTime())?'':new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short'}).format(d);return `<text class="sd2-chart-label" text-anchor="middle" x="${x(i)}" y="${height-9}">${escapeHtml(label)}</text>`;}).join('');
  target.innerHTML=`<svg class="sd2-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="แนวโน้มผลการฝึก"><path class="sd2-chart-area" d="${area}"></path>${grid}<path class="sd2-chart-line" d="${line}"></path>${dots}${dates}</svg><div class="sd2-chart-legend"><span>แสดง ${points.length} session ล่าสุดที่มีข้อมูล</span><span>คะแนนสูงขึ้นด้านบน</span></div>`;
}

function dateTime(value){const d=new Date(value);return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'short'}).format(d);}
function renderRecent(vm){
  const target=$('sd2RecentList'),button=$('sd2ViewAll');if(!target||!button)return;
  const sorted=[...vm.history.sessions].sort((a,b)=>new Date(b.started_at)-new Date(a.started_at)),visible=showAllRecent?sorted:sorted.slice(0,5);
  target.innerHTML=visible.length?visible.map(session=>`<article class="sd2-recent-item" data-session-id="${escapeHtml(session.id||'')}"><div class="sd2-recent-main"><div class="sd2-recent-title">${escapeHtml(session.stageName)} · ${escapeHtml(session.exerciseName)}</div><div class="sd2-recent-meta">${escapeHtml(dateTime(session.started_at))} · ${session.mode==='pretest'?'ประเมินก่อนเรียน':'ฝึกปฏิบัติ'} · ${Number(session.completed_questions||0)} / ${Number(session.planned_questions||0)||'—'} ข้อ</div></div><div class="sd2-recent-stats"><span class="sd2-recent-score">${percentText(session.score)}</span><span class="sd2-status ${session.status==='completed'?'mastered':'developing'}">${session.status==='completed'?'Completed':'In progress'}</span></div></article>`).join(''):'<div class="sd2-empty">ยังไม่มี Practice Session ที่บันทึกไว้</div>';
  button.hidden=sorted.length<=5;button.textContent=showAllRecent?'แสดง 5 รายการล่าสุด':'ดูทั้งหมด';
}
function renderAchievements(vm){
  const target=$('sd2AchievementList');if(!target)return;const achievements=[];
  if(vm.history.totalPracticeSessions>=1)achievements.push(['1','First Practice','เริ่มต้นการฝึกครั้งแรกแล้ว']);
  if(vm.history.totalPracticeSessions>=10)achievements.push(['10','10 Sessions','ฝึกสะสมครบ 10 session']);
  vm.skills.filter(skill=>skill.passed).forEach(skill=>achievements.push(['✓',`${skill.label} Mastered`,'ผ่านเกณฑ์ของ Stage ปัจจุบัน']));
  if(vm.path.pathMastered)achievements.push(['★','Major Scale Master','สำเร็จทุก Stage ใน Learning Path']);
  target.innerHTML=achievements.length?achievements.map(([icon,title,detail])=>`<div class="sd2-achievement"><span class="sd2-achievement-icon" aria-hidden="true">${icon}</span><div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span></div></div>`).join(''):'<div class="sd2-empty">Achievement จะปรากฏเมื่อคุณเริ่มฝึกและผ่านเกณฑ์ Mastery</div>';
}
function renderAll(vm){renderContinue(vm);renderSummary(vm);renderSkills(vm);renderLearningPath(vm);renderTrendChart(vm);renderRecent(vm);renderAchievements(vm);const name=$('dashboardUserName')?.textContent?.trim()||'ผู้เรียน';if($('sd2ProfileName'))$('sd2ProfileName').textContent=name;window.__studentDashboardV2Model=vm;}

async function refresh(){
  const shell=$('studentDashboard'),content=$('dashboardContent');if(!repo||!learningRepo||!shell||shell.hidden||!content||content.hidden)return;if(!ensureStructure())return;const token=++revision;
  try{
    const [dashboardResult,skillsResult,recommendationResult,historyResult]=await Promise.all([repo.getStudentDashboard(),repo.getActiveSkills(),learningRepo.getRecommendedNextAction(),repo.getStudentLearningHistory({limit:40})]);
    if(token!==revision)return;if(dashboardResult.error)throw dashboardResult.error;if(skillsResult.error)throw skillsResult.error;
    if(recommendationResult.error)console.warn('STUDENT DASHBOARD V2 RECOMMENDATION:',recommendationResult.error);
    if(historyResult.error)console.warn('STUDENT DASHBOARD V2 HISTORY:',historyResult.error);
    const rows=Array.isArray(dashboardResult.data)?dashboardResult.data:[],path=buildPathModel(rows);let mastery=null;
    if(path.active?.exercise_code&&path.active?.stage_code){const masteryResult=await repo.getStageMastery({exerciseCode:path.active.exercise_code,stageCode:path.active.stage_code});if(token!==revision)return;if(masteryResult.error)console.warn('STUDENT DASHBOARD V2 MASTERY:',masteryResult.error);else mastery=first(masteryResult.data);}
    renderAll(buildDashboardViewModel({rows,activeSkills:skillsResult.data||[],recommendation:recommendationResult.data,mastery,history:historyResult.data||{sessions:[],attempts:[],skillResults:[],totalPracticeSessions:0}}));
  }catch(error){
    console.warn('STUDENT DASHBOARD V2:',error);
    if(!syncLegacyFallbackAction()){
      const target=$('sd2ContinueBody');if(target){target.className='sd2-empty';target.textContent='ไม่สามารถโหลด Dashboard แบบละเอียดได้ แต่ข้อมูลพื้นฐานยังพร้อมใช้งานเมื่อระบบรีเฟรช';}
    }
  }
}
function scheduleRefresh(delay=80){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>refresh(),delay);}
function handleNavigation(action){
  if(action==='dashboard')$('sd2Continue')?.scrollIntoView({behavior:'smooth',block:'start'});
  if(action==='progress')$('sd2Skills')?.scrollIntoView({behavior:'smooth',block:'start'});
  if(action==='practice')($('sd2Continue')?.querySelector('.dashboard-continue')||$('dashboardRecommendation')?.querySelector('.dashboard-continue'))?.click();
  if(action==='profile'){profileOpen=!profileOpen;$('sd2ProfilePanel')?.classList.toggle('is-open',profileOpen);if(profileOpen)$('sd2ProfilePanel')?.scrollIntoView({behavior:'smooth',block:'nearest'});}
  if(action==='logout')$('dashboardLogoutButton')?.click();
}
function bind(){
  if(initialized)return;initialized=true;
  document.addEventListener('click',event=>{
    const nav=event.target.closest?.('[data-sd2-nav]');if(nav){event.preventDefault();handleNavigation(nav.dataset.sd2Nav);return;}
    const skill=event.target.closest?.('[data-sd2-skill]');if(skill){trendSkill=skill.dataset.sd2Skill||'ALL';const vm=window.__studentDashboardV2Model;if(vm)renderTrendChart(vm);$('sd2Trend')?.scrollIntoView({behavior:'smooth',block:'start'});}
    if(event.target?.id==='sd2ViewAll'){showAllRecent=!showAllRecent;const vm=window.__studentDashboardV2Model;if(vm)renderRecent(vm);}
  });
  document.addEventListener('change',event=>{if(event.target?.id==='sd2TrendFilter'){trendSkill=event.target.value||'ALL';const vm=window.__studentDashboardV2Model;if(vm)renderTrendChart(vm);}});
  const shell=$('studentDashboard'),content=$('dashboardContent');
  const observer=new MutationObserver(()=>{if(shell&&!shell.hidden&&content&&!content.hidden)scheduleRefresh(100);});
  if(shell)observer.observe(shell,{attributes:true,attributeFilter:['hidden']});if(content)observer.observe(content,{attributes:true,attributeFilter:['hidden']});
  const legacy=$('dashboardCurrentFocus');
  if(legacy){legacyObserver=new MutationObserver(()=>syncLegacyFallbackAction());legacyObserver.observe(legacy,{childList:true,subtree:true,characterData:true});syncLegacyFallbackAction();}
}

ensureStylesheet();ensureStructure();bind();
if($('studentDashboard')&&!$('studentDashboard').hidden&&$('dashboardContent')&&!$('dashboardContent').hidden)scheduleRefresh(30);
app.studentDashboardV2=Object.freeze({refresh,buildPathModel,buildHistoryModel,buildSkillModel,buildDashboardViewModel,sessionTrendPoints,syncLegacyFallbackAction});
})();
