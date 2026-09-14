(() => {
'use strict';

const masteryCache=new Map();
let progressObserver=null;
let progressSyncTimer=null;
let lastProgressModel=null;

function legacyPrimaryAction(){
  const path=document.getElementById('dashboardPathList');
  const recommendation=document.getElementById('dashboardRecommendation');
  return path?.querySelector('.dashboard-continue[data-exercise-code]')
    || recommendation?.querySelector('.dashboard-continue[data-exercise-code]')
    || null;
}

function syncPrimaryFallback(){
  // Once V2 has a complete data-backed model, its recommended activity is
  // authoritative for the new presentation. This compatibility layer exists
  // only for the loading/error window so the legacy primary practice action
  // never disappears or silently turns into a different session mode.
  if(window.__studentDashboardV2Model) return false;

  const body=document.getElementById('sd2ContinueBody');
  const legacy=legacyPrimaryAction();
  if(!body || !legacy) return false;

  const current=body.querySelector('.dashboard-continue[data-exercise-code]');
  const desired={
    exerciseCode:legacy.dataset.exerciseCode || '',
    stageCode:legacy.dataset.stageCode || '',
    sessionMode:legacy.dataset.sessionMode || 'practice',
    text:legacy.textContent?.trim() || 'ฝึกต่อ'
  };

  if(current
    && current.dataset.exerciseCode===desired.exerciseCode
    && current.dataset.stageCode===desired.stageCode
    && (current.dataset.sessionMode || 'practice')===desired.sessionMode){
    return true;
  }

  if(current){
    current.dataset.exerciseCode=desired.exerciseCode;
    current.dataset.stageCode=desired.stageCode;
    current.dataset.sessionMode=desired.sessionMode;
    current.textContent=desired.text;
    return true;
  }

  body.className='sd2-continue-layout';
  body.innerHTML=`
    <div class="sd2-continue-main">
      <div class="sd2-eyebrow">Continue Learning · Next Recommended Activity</div>
      <h2 id="sd2ContinueHeading">เรียนต่อจาก Stage ปัจจุบัน</h2>
      <div class="sd2-subtle">กำลังโหลดรายละเอียด Mastery เพิ่มเติม</div>
    </div>
    <div class="sd2-continue-side">
      <button type="button" class="dashboard-continue sd2-continue-action"
        data-exercise-code="${desired.exerciseCode}"
        data-stage-code="${desired.stageCode}"
        data-session-mode="${desired.sessionMode}">${desired.text}</button>
    </div>`;
  return true;
}

function observeLegacyActions(){
  const targets=[
    document.getElementById('dashboardPathList'),
    document.getElementById('dashboardRecommendation')
  ].filter(Boolean);
  if(!targets.length) return;
  const observer=new MutationObserver(()=>syncPrimaryFallback());
  targets.forEach(target=>observer.observe(target,{childList:true,subtree:true,characterData:true}));
}

function ensureProgressRingStyles(){
  if(document.querySelector('link[data-student-dashboard-progress-rings]')) return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='./styles/student-dashboard-progress-rings.css?v=20260914-2';
  link.setAttribute('data-student-dashboard-progress-rings','true');
  document.head.appendChild(link);
}

function first(data){
  return Array.isArray(data)?(data[0]||null):(data||null);
}

function clampPercent(value){
  const n=Number(value);
  return Number.isFinite(n)?Math.max(0,Math.min(100,n)):0;
}

function stageProgressFromMastery(stage,mastery){
  if(stage?.stage_status==='mastered'){
    return {locked:false,progress:100,completed:null,total:null};
  }
  if(stage?.stage_status==='locked'){
    return {locked:true,progress:null,completed:null,total:null};
  }
  const total=Number(mastery?.rolling_window);
  const completed=Number(mastery?.attempts_found);
  const safeTotal=Number.isFinite(total)&&total>0?total:0;
  const safeCompleted=Number.isFinite(completed)&&completed>0?completed:0;
  return {
    locked:false,
    progress:safeTotal?clampPercent(Math.round(Math.min(safeCompleted,safeTotal)/safeTotal*100)):0,
    completed:safeCompleted,
    total:safeTotal
  };
}

function decorateStageIcon(stage,item,progress){
  const icon=item?.querySelector('.sd2-stage-icon');
  if(!icon) return;
  icon.classList.add('sd2-stage-progress-ring');
  icon.removeAttribute('aria-hidden');

  if(progress.locked){
    icon.classList.add('is-locked-ring');
    icon.style.setProperty('--sd2-stage-progress','100%');
    icon.dataset.progressLabel='';
    icon.removeAttribute('role');
    icon.removeAttribute('aria-valuemin');
    icon.removeAttribute('aria-valuemax');
    icon.removeAttribute('aria-valuenow');
    icon.setAttribute('aria-label',`${stage?.stage_name||stage?.stage_code||'Stage'} ยังไม่ปลดล็อก`);
    icon.title='ยังไม่ปลดล็อก';
    return;
  }

  icon.classList.remove('is-locked-ring');
  const value=Math.round(clampPercent(progress.progress));
  icon.style.setProperty('--sd2-stage-progress',`${value}%`);
  icon.dataset.progressLabel=`${value}%`;
  icon.setAttribute('role','progressbar');
  icon.setAttribute('aria-valuemin','0');
  icon.setAttribute('aria-valuemax','100');
  icon.setAttribute('aria-valuenow',String(value));
  icon.setAttribute('aria-label',`${stage?.stage_name||stage?.stage_code||'Stage'} ความคืบหน้า ${value}%`);
  if(Number.isFinite(progress.completed)&&Number.isFinite(progress.total)&&progress.total>0){
    icon.dataset.progressCompleted=String(progress.completed);
    icon.dataset.progressTotal=String(progress.total);
    icon.title=`${progress.completed} / ${progress.total} แบบฝึกหัด`;
  }else{
    delete icon.dataset.progressCompleted;
    delete icon.dataset.progressTotal;
    icon.title=value===100?'ผ่านขั้นนี้แล้ว':`${value}%`;
  }
}

function masteryForStage(stage){
  const app=window.MajorScaleApp || {};
  const repo=app.dashboardRepository;
  if(!repo?.getStageMastery || !stage?.exercise_code || !stage?.stage_code){
    return Promise.resolve(null);
  }
  const key=`${stage.exercise_code}:${stage.stage_code}`;
  if(!masteryCache.has(key)){
    const request=Promise.resolve(repo.getStageMastery({exerciseCode:stage.exercise_code,stageCode:stage.stage_code}))
      .then(result=>result?.error?null:first(result?.data))
      .catch(()=>null);
    masteryCache.set(key,request);
  }
  return masteryCache.get(key);
}

async function syncProgressRings(){
  ensureProgressRingStyles();
  const model=window.__studentDashboardV2Model;
  const list=document.getElementById('sd2StageList');
  if(!model || !list) return false;

  if(model!==lastProgressModel){
    masteryCache.clear();
    lastProgressModel=model;
  }

  const stages=Array.isArray(model.path?.stages)?model.path.stages:[];
  const items=[...list.querySelectorAll(':scope > .sd2-stage')];
  if(!stages.length || !items.length) return false;

  await Promise.all(stages.map(async(stage,index)=>{
    const item=items[index];
    if(!item) return;
    if(stage.stage_status==='mastered' || stage.stage_status==='locked'){
      decorateStageIcon(stage,item,stageProgressFromMastery(stage,null));
      return;
    }
    const mastery=await masteryForStage(stage);
    if(window.__studentDashboardV2Model!==model) return;
    decorateStageIcon(stage,item,stageProgressFromMastery(stage,mastery));
  }));
  return true;
}

function scheduleProgressRingSync(delay=20){
  clearTimeout(progressSyncTimer);
  progressSyncTimer=setTimeout(()=>syncProgressRings(),delay);
}

function observeProgressRings(){
  const list=document.getElementById('sd2StageList');
  if(!list || progressObserver) return;
  progressObserver=new MutationObserver(()=>scheduleProgressRingSync(10));
  progressObserver.observe(list,{childList:true,subtree:true});
}

syncPrimaryFallback();
requestAnimationFrame(syncPrimaryFallback);
setTimeout(syncPrimaryFallback,50);
setTimeout(syncPrimaryFallback,200);
observeLegacyActions();

ensureProgressRingStyles();
observeProgressRings();
requestAnimationFrame(()=>scheduleProgressRingSync(0));
setTimeout(()=>{observeProgressRings();scheduleProgressRingSync(0);},80);
setTimeout(()=>{observeProgressRings();scheduleProgressRingSync(0);},250);

window.MajorScaleApp=window.MajorScaleApp || {};
window.MajorScaleApp.studentDashboardV2Compat=Object.freeze({
  legacyPrimaryAction,
  syncPrimaryFallback,
  stageProgressFromMastery,
  syncProgressRings
});
})();