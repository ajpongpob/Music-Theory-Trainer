(() => {
'use strict';

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

syncPrimaryFallback();
requestAnimationFrame(syncPrimaryFallback);
setTimeout(syncPrimaryFallback,50);
setTimeout(syncPrimaryFallback,200);
observeLegacyActions();

window.MajorScaleApp=window.MajorScaleApp || {};
window.MajorScaleApp.studentDashboardV2Compat=Object.freeze({
  legacyPrimaryAction,
  syncPrimaryFallback
});
})();
