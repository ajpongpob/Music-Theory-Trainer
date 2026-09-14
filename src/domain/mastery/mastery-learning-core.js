(() => {
'use strict';
const app=window.MajorScaleApp=window.MajorScaleApp || {};

// Pre-test is intentionally disabled. Any legacy request for pretest is
// normalized to the main practice flow so the learner always follows the
// standard mastery exercise conditions.
const PRETEST_ENABLED=false;
const MODES=Object.freeze(['practice','mastery_test','teacher_demo']);

function normalizeSessionMode(value,{allowMasteryTest=false}={}){
  const mode=String(value || 'practice').trim().toLowerCase();
  if(mode==='teacher_demo') return 'teacher_demo';
  if(allowMasteryTest && mode==='mastery_test') return 'mastery_test';
  return 'practice';
}

function buildDiagnosticItemCodes(requiredItems,fallbackCodes=[]){
  const rows=Array.isArray(requiredItems) ? [...requiredItems] : [];
  rows.sort((a,b)=>Number(a?.sequence_order || 0)-Number(b?.sequence_order || 0));
  const source=rows.length ? rows.map(row=>row?.item_code) : fallbackCodes;
  const seen=new Set();
  return (source || []).map(value=>String(value || '').trim()).filter(code=>{
    if(!code || seen.has(code)) return false;
    seen.add(code);
    return true;
  });
}

function firstResult(data){
  return Array.isArray(data) ? (data[0] || null) : (data || null);
}

function normalizeRecommendation(data){
  const row=firstResult(data);
  if(!row) return null;
  const rawActionType=row.action_type || 'continue';
  const diagnosticSuppressed=rawActionType==='diagnostic';
  return Object.freeze({
    pathCode:row.learning_path_code || null,
    exerciseCode:row.exercise_code || null,
    stageCode:row.stage_code || null,
    actionType:diagnosticSuppressed ? 'continue' : rawActionType,
    targetSkillCode:row.target_skill_code || null,
    targetItemCode:row.target_item_code || null,
    reasonCode:diagnosticSuppressed ? 'PRETEST_DISABLED' : (row.reason_code || null),
    reasonTh:diagnosticSuppressed
      ? 'เริ่มทำแบบฝึกของขั้นนี้ตามเงื่อนไขหลักของระบบ'
      : (row.reason_th || ''),
    overallScore:row.overall_score==null ? null : Number(row.overall_score),
    overallThreshold:row.overall_threshold==null ? null : Number(row.overall_threshold),
    attemptsFound:Number(row.attempts_found || 0),
    rollingWindow:Number(row.rolling_window || 0)
  });
}

function recommendationActionLabel(recommendation){
  switch(recommendation?.actionType){
    // Defensive fallback for stale callers that bypass normalizeRecommendation.
    case 'diagnostic': return 'เริ่มฝึก';
    case 'target_item': return recommendation.targetItemCode ? `ฝึกบันไดเสียง ${recommendation.targetItemCode}` : 'ฝึกบันไดเสียงที่ยังขาด';
    case 'target_skill': return 'ฝึกทักษะที่ควรพัฒนา';
    case 'advance': return 'ไปขั้นถัดไป';
    case 'completed': return 'สำเร็จแล้ว';
    default: return 'เรียนต่อ';
  }
}

function diagnosticComplete(completedQuestions,plannedQuestions){
  const planned=Number(plannedQuestions || 0);
  return planned>0 && Number(completedQuestions || 0)>=planned;
}

function suppressLegacyPretestUi(){
  if(typeof document==='undefined') return;

  document.querySelectorAll('.m16-pretest-step,#m16PretestPath,.m15-diag').forEach(node=>node.remove());
  document.querySelectorAll('[data-session-mode="pretest"]').forEach(node=>{
    node.setAttribute('data-session-mode','practice');
  });
}

function clearWrongNoteHighlights(){
  if(typeof document==='undefined') return;
  const snapshot=document.querySelector('#questionResultNotation .question-result-score-snapshot');
  if(!snapshot) return;

  snapshot.querySelectorAll('.feedback-wrong-note').forEach(node=>node.classList.remove('feedback-wrong-note'));
  snapshot.querySelectorAll('[fill="#c62828"],[fill="#C62828"]').forEach(node=>node.setAttribute('fill','#111'));
  snapshot.querySelectorAll('[stroke="#c62828"],[stroke="#C62828"]').forEach(node=>node.setAttribute('stroke','#111'));
  snapshot.setAttribute('aria-label','คำตอบของผู้เรียนข้อนี้');
}

function enforceDisabledFeatures(){
  suppressLegacyPretestUi();
  clearWrongNoteHighlights();
}

function bindDisabledFeatureGuards(){
  enforceDisabledFeatures();
  if(typeof MutationObserver==='undefined' || !document.body) return;
  const observer=new MutationObserver(enforceDisabledFeatures);
  observer.observe(document.body,{
    childList:true,
    subtree:true,
    attributes:true,
    attributeFilter:['data-session-mode','hidden','class','fill','stroke']
  });
}

if(typeof document!=='undefined'){
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',bindDisabledFeatureGuards,{once:true});
  }else{
    bindDisabledFeatureGuards();
  }
}

app.masteryLearningCore=Object.freeze({
  PRETEST_ENABLED,
  MODES,
  normalizeSessionMode,
  buildDiagnosticItemCodes,
  firstResult,
  normalizeRecommendation,
  recommendationActionLabel,
  diagnosticComplete,
  suppressLegacyPretestUi,
  clearWrongNoteHighlights
});
})();
