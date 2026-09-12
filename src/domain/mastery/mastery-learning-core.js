(() => {
'use strict';
const app=window.MajorScaleApp=window.MajorScaleApp || {};

const MODES=Object.freeze(['practice','pretest','mastery_test']);

function normalizeSessionMode(value,{allowMasteryTest=false}={}){
  const mode=String(value || 'practice').trim().toLowerCase();
  if(mode==='pretest') return 'pretest';
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
  return Object.freeze({
    pathCode:row.learning_path_code || null,
    exerciseCode:row.exercise_code || null,
    stageCode:row.stage_code || null,
    actionType:row.action_type || 'continue',
    targetSkillCode:row.target_skill_code || null,
    targetItemCode:row.target_item_code || null,
    reasonCode:row.reason_code || null,
    reasonTh:row.reason_th || '',
    overallScore:row.overall_score==null ? null : Number(row.overall_score),
    overallThreshold:row.overall_threshold==null ? null : Number(row.overall_threshold),
    attemptsFound:Number(row.attempts_found || 0),
    rollingWindow:Number(row.rolling_window || 0)
  });
}

function recommendationActionLabel(recommendation){
  switch(recommendation?.actionType){
    case 'diagnostic': return 'เริ่มแบบประเมินก่อนเรียน';
    case 'target_item': return recommendation.targetItemCode ? `ฝึกโจทย์ ${recommendation.targetItemCode}` : 'ฝึกโจทย์ที่ยังขาด';
    case 'target_skill': return 'ฝึกทักษะที่ยังอ่อน';
    case 'advance': return 'ไปขั้นถัดไป';
    case 'completed': return 'สำเร็จแล้ว';
    default: return 'เรียนต่อ';
  }
}

function diagnosticComplete(completedQuestions,plannedQuestions){
  const planned=Number(plannedQuestions || 0);
  return planned>0 && Number(completedQuestions || 0)>=planned;
}

app.masteryLearningCore=Object.freeze({
  MODES,
  normalizeSessionMode,
  buildDiagnosticItemCodes,
  firstResult,
  normalizeRecommendation,
  recommendationActionLabel,
  diagnosticComplete
});
})();
