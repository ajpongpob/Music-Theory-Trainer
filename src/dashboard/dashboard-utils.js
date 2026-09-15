(() => {
'use strict';
const app = window.MajorScaleApp = window.MajorScaleApp || {};
let startStateObserver=null;
let startStateSyncTimer=null;
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
function dashboardLanguage(){
  return app.i18n?.getLanguage?.()==='en' ? 'en' : 'th';
}
function currentStageHasStarted(viewModel){
  const vm=viewModel || {};
  const stage=vm.currentStage;
  if(!stage) return false;
  if(stage.stage_status==='mastered') return true;
  if(stage.stage_started_at || stage.started_at) return true;
  const stageId=String(stage.stage_id || '');
  const stageCode=String(stage.stage_code || '');
  const sessions=Array.isArray(vm.history?.sessions) ? vm.history.sessions : [];
  return sessions.some(session=>{
    if(stageId && String(session.stage_id || '')===stageId) return true;
    const sessionStageCode=String(session.stageCode || session.stage_code || '');
    return !!(stageCode && sessionStageCode===stageCode);
  });
}
function startCriterionText(value,language){
  const text=String(value || '').trim();
  if(language!=='en'){
    return text
      .replace(/^ทำแบบฝึกอีก\s+/, 'ทำแบบฝึก ')
      .replace(/^ทำโจทย์ให้ครบอีก\s+/, 'ทำโจทย์ให้ครบ ');
  }
  let match=text.match(/^ทำแบบฝึกอีก\s+(\d+)\s+ครั้ง/);
  if(match) return `Complete ${match[1]} practice attempts`;
  match=text.match(/^ทำโจทย์ให้ครบอีก\s+(\d+)\s+คีย์/);
  if(match) return `Cover ${match[1]} keys`;
  match=text.match(/^(.+?)\s+อีก\s+(\d+)%$/);
  if(match) return `Improve ${match[1]} by ${match[2]}%`;
  return text;
}
function setDashboardText(element,text){
  if(element && element.textContent!==text) element.textContent=text;
}
function syncDashboardStartStateCopy(){
  const vm=window.__studentDashboardV2Model;
  const body=document.getElementById('sd2ContinueBody');
  const stage=vm?.currentStage;
  if(!vm || !body || !stage) return false;

  const actionType=vm.recommendation?.actionType || (stage.stage_status==='mastered' ? 'review' : 'practice');
  if(actionType==='diagnostic' || actionType==='completed' || actionType==='review' || stage.stage_status==='mastered') return false;

  const language=dashboardLanguage();
  const started=currentStageHasStarted(vm);
  const button=body.querySelector('.dashboard-continue.sd2-continue-action');
  const eyebrow=body.querySelector('.sd2-eyebrow');
  if(button) setDashboardText(button,started ? (language==='en'?'Continue Practice':'ฝึกต่อ') : (language==='en'?'Start Practice':'เริ่มฝึก'));
  if(eyebrow) setDashboardText(eyebrow,started ? (language==='en'?'Continue Learning':'เรียนต่อ') : (language==='en'?'Start Learning':'เริ่มฝึก'));

  if(started) return true;

  const subtitle=body.querySelector('.sd2-subtle');
  const focus=body.querySelector('.sd2-focus-line');
  const readiness=body.querySelector('.sd2-readiness-status');
  setDashboardText(subtitle,language==='en'
    ? 'Start this level to build evidence toward the required criteria.'
    : 'เริ่มทำแบบฝึกของระดับนี้เพื่อสะสมหลักฐานตามเกณฑ์ที่กำหนด');
  setDashboardText(focus,language==='en'
    ? 'Starting goal: Build enough evidence to meet the level requirements.'
    : 'เป้าหมายเริ่มต้น: สะสมหลักฐานให้ครบเกณฑ์ของระดับ');

  if(readiness){
    const criteria=(Array.isArray(vm.readinessStatus)?vm.readinessStatus:[])
      .map(item=>startCriterionText(item,language))
      .filter(Boolean);
    const copy=criteria.length
      ? `${language==='en'?'Level requirements':'เกณฑ์ของระดับ'}: ${criteria.join(' • ')}`
      : (language==='en'?'Start practicing to build evidence for this level.':'เริ่มฝึกเพื่อสะสมหลักฐานตามเกณฑ์ของระดับ');
    setDashboardText(readiness,copy);
  }
  return true;
}
function scheduleDashboardStartStateCopySync(delay=0){
  clearTimeout(startStateSyncTimer);
  startStateSyncTimer=setTimeout(syncDashboardStartStateCopy,delay);
}
function installDashboardStartStateCopySync(){
  if(startStateObserver || typeof MutationObserver==='undefined') return;
  const dashboard=document.getElementById('studentDashboard');
  if(!dashboard) return;
  startStateObserver=new MutationObserver(()=>scheduleDashboardStartStateCopySync(0));
  startStateObserver.observe(dashboard,{childList:true,subtree:true,characterData:true});
  window.addEventListener('major-scale:languagechange',()=>scheduleDashboardStartStateCopySync(0));
  requestAnimationFrame(()=>scheduleDashboardStartStateCopySync(0));
}

app.dashboardUtils = Object.freeze({
  escapeDashboardHtml,
  dashboardStatusMeta,
  dashboardPercent,
  dashboardScore,
  dashboardCompletionDate,
  currentStageHasStarted,
  syncDashboardStartStateCopy
});
installDashboardStartStateCopySync();
})();
