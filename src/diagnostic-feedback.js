(() => {
'use strict';

const app=window.MajorScaleApp=window.MajorScaleApp||{};
const config=app.majorScaleConfig||{};
const SKILL_ORDER=['BN01_TREBLE_PITCH','MS03_SCALE_ACCIDENTAL','RH01_DURATION_VALUE','GR02_PRIMARY_BEAM','BN06_STEM_DIRECTION'];
const STATUS_META=Object.freeze({
  mastered:{label:'Mastered',icon:'✓'},
  strong:{label:'Strong',icon:'✓'},
  developing:{label:'Developing',icon:'△'},
  'needs-practice':{label:'Needs Practice',icon:'!'},
  'not-assessed':{label:'Not Assessed',icon:'—'}
});
const FALLBACK_LABELS=Object.freeze({
  BN01_TREBLE_PITCH:'Treble Pitch',
  BN06_STEM_DIRECTION:'Stem Direction',
  RH01_DURATION_VALUE:'Duration Value',
  GR02_PRIMARY_BEAM:'Primary Beam',
  MS03_SCALE_ACCIDENTAL:'Scale Accidental'
});

let sessionContext={};
let questionResults=[];

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const finite=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));
const numberOrNull=value=>finite(value)?Number(value):null;
const clamp=value=>Math.max(0,Math.min(100,Number(value)||0));
const pct=value=>finite(value)?`${Number(value).toFixed(1).replace(/\.0$/,'')}%`:'—';
const skillLabel=code=>FALLBACK_LABELS[code]||config.LO_META?.[code]?.short||code||'Skill';
const priorityOf=code=>{const index=SKILL_ORDER.indexOf(code);return index<0?999:index;};
const stageLabel=code=>{const match=/^STAGE_(\d+)$/.exec(String(code||''));return match?`Stage ${match[1]}`:(code||'Current Stage');};

function statusForSkill({score,threshold,passed}){
  if(!finite(score)) return 'not-assessed';
  const numericScore=Number(score);
  const numericThreshold=numberOrNull(threshold);
  if(passed===true || (numericThreshold!==null && numericScore>=numericThreshold)) return 'mastered';
  if(numericThreshold!==null){
    const gap=numericThreshold-numericScore;
    if(gap<=5) return 'strong';
    if(gap<=20) return 'developing';
    return 'needs-practice';
  }
  if(numericScore>=90) return 'mastered';
  if(numericScore>=80) return 'strong';
  if(numericScore>=65) return 'developing';
  return 'needs-practice';
}

function normalizeQuestion(question){
  if(!question||typeof question!=='object') return null;
  const questionNumber=Number(question.questionNumber||question.question_number||0);
  if(!Number.isInteger(questionNumber)||questionNumber<1) return null;
  return {
    questionNumber,
    itemCode:question.itemCode||question.item_code||'',
    keyLabel:question.keyLabel||question.key||question.itemCode||question.item_code||'Major Scale',
    score:numberOrNull(question.score),
    skills:Array.isArray(question.skills)?question.skills.map(item=>({...item})):[],
    errors:Array.isArray(question.errors)?question.errors.map(item=>({...item})):[],
    checkedAt:question.checkedAt||question.checked_at||null
  };
}

function resetSession(detail={}){
  sessionContext={...(detail||{})};
  questionResults=[];
  app.diagnosticQuestionResults=[];
  const panel=typeof document!=='undefined'?document.querySelector('#sessionSummary .summary-panel'):null;
  panel?.classList.remove('diagnostic-session-result-active');
  if(typeof document!=='undefined') document.getElementById('diagnosticSessionResult')?.remove();
}

function captureQuestionResult(question){
  const normalized=normalizeQuestion(question);
  if(!normalized) return false;
  const index=questionResults.findIndex(item=>item.questionNumber===normalized.questionNumber);
  if(index>=0) questionResults[index]=normalized;
  else questionResults.push(normalized);
  questionResults.sort((a,b)=>a.questionNumber-b.questionNumber);
  app.diagnosticQuestionResults=questionResults.map(item=>({...item,skills:item.skills.map(skill=>({...skill})),errors:item.errors.map(error=>({...error}))}));
  return true;
}

function getQuestionResults(){
  return questionResults.map(item=>({...item,skills:item.skills.map(skill=>({...skill})),errors:item.errors.map(error=>({...error}))}));
}
function getQuestionCount(){return questionResults.length;}

function aggregateQuestionSkills(questions){
  const bySkill=new Map();
  for(const question of questions||[]){
    for(const skill of question.skills||[]){
      const code=skill.skillCode||skill.skill_code;
      if(!code) continue;
      if(!bySkill.has(code)) bySkill.set(code,{skillCode:code,correct:0,total:0,threshold:numberOrNull(skill.threshold)});
      const bucket=bySkill.get(code);
      bucket.correct+=Number(skill.correct??skill.correct_count??0)||0;
      bucket.total+=Number(skill.total??skill.total_count??0)||0;
      if(bucket.threshold===null&&finite(skill.threshold)) bucket.threshold=Number(skill.threshold);
    }
  }
  return [...bySkill.values()].map(item=>{
    const score=item.total>0?Math.round((item.correct/item.total)*10000)/100:null;
    const passed=item.threshold!==null&&score!==null?score>=item.threshold:false;
    return {...item,score,passed};
  });
}

function calculateSkillPerformance(serverSkillResults,questions=getQuestionResults()){
  const source=Array.isArray(serverSkillResults)&&serverSkillResults.length
    ? serverSkillResults.map(item=>({
        skillCode:item.skill_code||item.skillCode,
        score:numberOrNull(item.score),
        threshold:numberOrNull(item.threshold),
        passed:item.passed===true,
        correct:item.correct_count??item.correct??null,
        total:item.total_count??item.total??null
      }))
    : aggregateQuestionSkills(questions);

  return source
    .filter(item=>item.skillCode)
    .map(item=>({
      ...item,
      label:skillLabel(item.skillCode),
      status:statusForSkill(item)
    }))
    .sort((a,b)=>priorityOf(a.skillCode)-priorityOf(b.skillCode));
}

function identifyWeakSkills(skillPerformance,limit=3){
  return [...(skillPerformance||[])]
    .filter(item=>finite(item.score)&&item.status!=='mastered')
    .sort((a,b)=>Number(a.score)-Number(b.score)||priorityOf(a.skillCode)-priorityOf(b.skillCode))
    .slice(0,Math.max(1,Math.min(3,Number(limit)||3)));
}

function questionCodesForSkill(skillCode,questions=getQuestionResults()){
  return (questions||[])
    .filter(question=>(question.skills||[]).some(skill=>(skill.skillCode||skill.skill_code)===skillCode&&finite(skill.score)&&Number(skill.score)<100))
    .map(question=>question.keyLabel||question.itemCode)
    .filter(Boolean);
}

function errorCountForSkill(skillCode,questions=getQuestionResults()){
  return (questions||[]).reduce((sum,question)=>sum+(question.errors||[]).filter(error=>(error.skillCode||error.skill_code)===skillCode).length,0);
}

function recommendNextPractice({skillPerformance,stageCode,exerciseCode='MAJOR_SCALE_NOTATION',serverRecommendation=null,stageMastered=false}={}){
  const ordered=[...(skillPerformance||[])].filter(item=>finite(item.score)).sort((a,b)=>Number(a.score)-Number(b.score)||priorityOf(a.skillCode)-priorityOf(b.skillCode));
  const lowest=ordered[0]||null;
  const serverSkill=serverRecommendation?.targetSkillCode||serverRecommendation?.target_skill_code||null;
  const focus=(serverSkill&&(skillPerformance||[]).find(item=>item.skillCode===serverSkill))||lowest;
  return {
    exerciseCode,
    stageCode:stageCode||sessionContext.stageCode||sessionContext.stage_code||null,
    skillCode:focus?.skillCode||null,
    skillLabel:focus?.label||'Major Scale Practice',
    actionType:stageMastered?'continue-path':'practice',
    title:focus?`${focus.label} Practice`:'Major Scale Practice',
    reason:focus
      ? `${focus.label} เป็นทักษะที่ควรให้ความสำคัญก่อนในการฝึกรอบถัดไป`
      : 'ทำแบบฝึกต่อเพื่อสะสมหลักฐาน Mastery เพิ่มเติม',
    serverReason:serverRecommendation?.reasonTh||serverRecommendation?.reason_th||null
  };
}

function mergeQuestionScores(serverQuestions,localQuestions=getQuestionResults()){
  const local=new Map((localQuestions||[]).map(question=>[Number(question.questionNumber),question]));
  const server=Array.isArray(serverQuestions)?serverQuestions:[];
  const merged=server.map(row=>{
    const number=Number(row.question_number||row.questionNumber||0);
    const cached=local.get(number);
    return cached?{...cached,score:numberOrNull(row.score)??cached.score,itemCode:row.item_code||cached.itemCode,keyLabel:cached.keyLabel||row.item_code}:normalizeQuestion({questionNumber:number,itemCode:row.item_code,keyLabel:row.item_code,score:row.score,skills:[],errors:[]});
  }).filter(Boolean);
  for(const question of localQuestions||[]){if(!merged.some(item=>item.questionNumber===question.questionNumber)) merged.push(question);}
  return merged.sort((a,b)=>a.questionNumber-b.questionNumber);
}

function aggregateSessionResults(questions=getQuestionResults(),context=sessionContext){
  const normalized=(questions||[]).map(normalizeQuestion).filter(Boolean);
  const scored=normalized.filter(question=>finite(question.score));
  const overallScore=scored.length?Math.round(scored.reduce((sum,item)=>sum+Number(item.score),0)/scored.length*100)/100:null;
  const skillResults=calculateSkillPerformance(null,normalized);
  const weakSkills=identifyWeakSkills(skillResults);
  return {
    source:'session-cache',
    sessionId:context.sessionId||null,
    exerciseCode:context.exerciseCode||'MAJOR_SCALE_NOTATION',
    stageCode:context.stageCode||context.stage_code||null,
    overallScore,
    questionCount:normalized.length,
    expectedQuestionCount:Number(context.plannedQuestions||context.planned_questions||normalized.length)||normalized.length,
    skillResults,
    weakSkills,
    recommendation:recommendNextPractice({skillPerformance:skillResults,stageCode:context.stageCode||context.stage_code,exerciseCode:context.exerciseCode||'MAJOR_SCALE_NOTATION'}),
    questions:normalized,
    persistenceStatus:'unavailable',
    persistenceMessage:null,
    stageMastered:false,
    previousSessionScore:null
  };
}

function buildSessionResult(serverPayload,options={}){
  if(!serverPayload) return aggregateSessionResults(options.questions||getQuestionResults(),options.context||sessionContext);
  const questions=mergeQuestionScores(serverPayload.question_scores,options.questions||getQuestionResults());
  const skillResults=calculateSkillPerformance(serverPayload.session_skill_results,questions);
  const weakSkills=identifyWeakSkills(skillResults);
  const stageMastered=serverPayload.stage_status==='mastered'||serverPayload.mastery_passed===true;
  const serverRecommendation={
    targetSkillCode:serverPayload.next_target_skill_code,
    reasonTh:serverPayload.next_reason_th,
    actionType:serverPayload.next_action_type
  };
  return {
    source:'supabase',
    sessionId:serverPayload.session_id||null,
    exerciseCode:serverPayload.exercise_code||'MAJOR_SCALE_NOTATION',
    stageCode:serverPayload.stage_code||sessionContext.stageCode||null,
    overallScore:numberOrNull(serverPayload.session_overall_score),
    questionCount:Number(serverPayload.session_questions||questions.length)||questions.length,
    expectedQuestionCount:Number(serverPayload.session_questions||questions.length)||questions.length,
    skillResults,
    weakSkills,
    recommendation:recommendNextPractice({skillPerformance:skillResults,stageCode:serverPayload.stage_code,exerciseCode:serverPayload.exercise_code,serverRecommendation,stageMastered}),
    questions,
    persistenceStatus:'saved',
    persistenceMessage:null,
    stageMastered,
    previousSessionScore:numberOrNull(serverPayload.previous_session_overall_score),
    rollingMastery:{
      overallScore:numberOrNull(serverPayload.overall_score),
      overallThreshold:numberOrNull(serverPayload.overall_threshold),
      masteryPassed:serverPayload.mastery_passed===true
    }
  };
}

function comparisonText(result){
  if(!finite(result.previousSessionScore)||!finite(result.overallScore)) return '';
  const diff=Number(result.overallScore)-Number(result.previousSessionScore);
  if(Math.abs(diff)<0.01) return '<span class="df-comparison">No change from previous session</span>';
  return `<span class="df-comparison">${diff>0?'↑ Improved':'↓ Lower'} from previous session</span>`;
}

function statusMarkup(status){
  const meta=STATUS_META[status]||STATUS_META['not-assessed'];
  return `<span class="df-status ${esc(status)}"><span aria-hidden="true">${meta.icon}</span><span>${meta.label}</span></span>`;
}

function renderSkillPerformance(skills){
  return (skills||[]).map(skill=>`<article class="df-skill-card"><div class="df-skill-head"><div><strong>${esc(skill.label)}</strong><small>${esc(skill.skillCode)}</small></div><b>${pct(skill.score)}</b></div><div class="df-progress" role="progressbar" aria-label="${esc(skill.label)} ${pct(skill.score)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${finite(skill.score)?clamp(skill.score):0}"><i style="width:${clamp(skill.score)}%"></i></div><div class="df-skill-foot">${statusMarkup(skill.status)}${finite(skill.threshold)?`<span>เกณฑ์ ${pct(skill.threshold)}</span>`:''}</div></article>`).join('');
}

function renderWeakAreas(result){
  if(!result.weakSkills.length) return '<div class="df-empty">ทุกทักษะใน Session นี้อยู่ในสถานะ Mastered ตามเกณฑ์ที่ใช้ประเมิน</div>';
  return result.weakSkills.map(skill=>{
    const keys=questionCodesForSkill(skill.skillCode,result.questions).slice(0,4);
    const errors=errorCountForSkill(skill.skillCode,result.questions);
    const detail=keys.length?`พบจุดที่ควรทบทวนใน: ${keys.map(esc).join(' · ')}`:(errors?`พบข้อผิดพลาด ${errors} จุด`:'ควรฝึกทักษะนี้เพิ่ม');
    return `<article class="df-weak-card"><div><strong>${esc(skill.label)}</strong><span>${pct(skill.score)} · ${esc(STATUS_META[skill.status]?.label||skill.status)}</span></div><p>${detail}</p></article>`;
  }).join('');
}

function renderQuestionReview(question){
  const skills=(question.skills||[]).map(skill=>{
    const code=skill.skillCode||skill.skill_code;
    const score=numberOrNull(skill.score);
    const correct=finite(skill.correct)?Number(skill.correct):Number(skill.correct_count||0);
    const total=finite(skill.total)?Number(skill.total):Number(skill.total_count||0);
    const ok=score===100||(total>0&&correct===total);
    return `<span class="df-review-skill ${ok?'is-correct':'is-review'}"><span aria-hidden="true">${ok?'✓':'✕'}</span> ${esc(skillLabel(code))}</span>`;
  }).join('');
  const errors=(question.errors||[]).length
    ? `<ul>${question.errors.map(error=>`<li><b>${esc(skillLabel(error.skillCode||error.skill_code))}</b> — ${esc(error.message||error.unitLabel||'ควรทบทวน')}</li>`).join('')}</ul>`
    : '<p class="df-review-ok">✓ ไม่พบข้อผิดพลาดในเกณฑ์ที่ประเมิน</p>';
  return `<details class="df-question-review"><summary><span>ข้อ ${question.questionNumber} — ${esc(question.keyLabel||question.itemCode)}</span><strong>${pct(question.score)}</strong></summary><div class="df-review-body"><div class="df-review-skills">${skills||'<span>ไม่มีข้อมูลรายทักษะใน memory ของ Session นี้</span>'}</div><div class="df-review-errors"><h4>Detailed Errors</h4>${errors}</div><div class="df-notation-placeholder"><strong>Notation Review</strong><span>Your Notation ใช้ใน Immediate Feedback หลังตรวจแต่ละข้อ; รอบนี้ยังไม่บันทึก snapshot ซ้ำใน Session Result เพื่อไม่เพิ่ม state/ข้อมูลโดยไม่จำเป็น</span></div></div></details>`;
}

function ensureResultContainer(){
  const panel=document.querySelector('#sessionSummary .summary-panel');
  if(!panel) return null;
  let container=document.getElementById('diagnosticSessionResult');
  if(!container){
    container=document.createElement('div');
    container.id='diagnosticSessionResult';
    container.className='df-session-result';
    const restart=document.getElementById('restartSession');
    panel.insertBefore(container,restart||null);
  }
  panel.classList.add('diagnostic-session-result-active');
  return container;
}

function bindRecommendedAction(result){
  const button=document.getElementById('diagnosticRecommendedAction');
  if(!button) return;
  button.onclick=()=>{
    if(result.stageMastered){
      const dashboard=document.getElementById('m15Dashboard')||document.getElementById('dashboardButton');
      dashboard?.click();
      return;
    }
    document.getElementById('restartSession')?.click();
  };
}

function renderSessionResult(result){
  if(typeof document==='undefined'||!result) return false;
  const overlay=document.getElementById('sessionSummary');
  const container=ensureResultContainer();
  if(!overlay||!container) return false;
  const title=document.getElementById('summaryTitle');
  const overall=document.getElementById('summaryOverall');
  const kicker=overlay.querySelector('.summary-kicker');
  if(kicker) kicker.textContent='Session Result';
  if(title) title.textContent='Session Complete';
  if(overall) overall.textContent=pct(result.overallScore);

  const persistence=result.persistenceStatus==='saved'
    ? ''
    : `<div class="df-notice" role="status">ผลด้านล่างคำนวณจาก structured results ใน Session นี้ เนื่องจากการสรุปจากฐานข้อมูลไม่สำเร็จ${result.persistenceMessage?`: ${esc(result.persistenceMessage)}`:''}</div>`;
  container.innerHTML=`
    <div class="df-session-meta"><strong>${result.questionCount} / ${result.expectedQuestionCount||result.questionCount} Questions</strong>${comparisonText(result)}</div>
    ${persistence}
    <div class="df-result-grid">
      <section class="df-section" aria-labelledby="dfSkillHeading"><div class="df-section-head"><div><span>Skill Performance</span><h3 id="dfSkillHeading">ผลรายทักษะ</h3></div></div><div class="df-skill-list">${renderSkillPerformance(result.skillResults)}</div></section>
      <section class="df-section" aria-labelledby="dfWeakHeading"><div class="df-section-head"><div><span>Areas to Improve</span><h3 id="dfWeakHeading">ทักษะที่ควรพัฒนาก่อน</h3></div></div><div class="df-weak-list">${renderWeakAreas(result)}</div></section>
    </div>
    <section class="df-section df-recommendation" aria-labelledby="dfRecommendationHeading"><div><span class="df-eyebrow">Recommended Next Step</span><h3 id="dfRecommendationHeading">${esc(result.recommendation.title)}</h3><p>${esc(stageLabel(result.recommendation.stageCode))} · ${esc(result.recommendation.exerciseCode)}</p><p>${esc(result.recommendation.reason)}</p>${result.recommendation.serverReason?`<small>${esc(result.recommendation.serverReason)}</small>`:''}</div><button type="button" class="btn primary df-primary-cta" id="diagnosticRecommendedAction">ฝึกต่อ</button></section>
    <section class="df-section df-detailed" aria-labelledby="dfDetailedHeading"><div class="df-section-head"><div><span>Detailed Review</span><h3 id="dfDetailedHeading">ทบทวนทั้ง Session</h3></div></div><details class="df-review-all"><summary>ดูรายละเอียดทั้ง ${result.questionCount} ข้อ</summary><div class="df-review-list">${result.questions.map(renderQuestionReview).join('')||'<div class="df-empty">ไม่มีรายละเอียดรายข้อใน memory ของ Session นี้</div>'}</div></details></section>`;

  const restart=document.getElementById('restartSession');
  if(restart) restart.hidden=true;
  const dashboard=document.getElementById('m15Dashboard');
  if(dashboard){dashboard.hidden=false;dashboard.classList.remove('primary');}
  overlay.hidden=false;
  bindRecommendedAction(result);
  document.getElementById('diagnosticRecommendedAction')?.focus();
  return true;
}

function renderServerSession(serverPayload){
  return renderSessionResult(buildSessionResult(serverPayload));
}

function renderFallbackSessionResult({error=null}={}){
  const result=aggregateSessionResults();
  if(!result.questionCount) return false;
  result.persistenceStatus='unavailable';
  result.persistenceMessage=error?.message||null;
  return renderSessionResult(result);
}

function installStyles(){
  if(document.getElementById('diagnosticFeedbackStyles')) return;
  const style=document.createElement('style');
  style.id='diagnosticFeedbackStyles';
  style.textContent=`
  .df-diagnostic-item ul{margin:6px 0 0;padding-left:22px;color:#4b5565;font-size:.76rem;line-height:1.65;overflow-wrap:anywhere}
  .df-diagnostic-item li{margin:4px 0}
  .df-question-skills{display:grid;gap:7px;margin:10px 0}.df-question-skill{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:9px;align-items:center;padding:9px 10px;border:1px solid #d9dee8;border-radius:11px;background:#fff;color:#172033}.df-question-skill .df-icon{width:28px;height:28px;display:grid;place-items:center;border-radius:50%;font-weight:900}.df-question-skill.is-correct .df-icon{background:#e9f6ef;color:#12663e}.df-question-skill.is-review .df-icon{background:#fff0ed;color:#a52b20}.df-question-skill strong{display:block;font-size:.82rem}.df-question-skill small{display:block;color:#667085;font-size:.65rem}.df-question-skill .df-result-text{font-size:.72rem;font-weight:800}.df-question-skill.is-correct .df-result-text{color:#12663e}.df-question-skill.is-review .df-result-text{color:#a52b20}.df-question-diagnostic{margin-top:12px;padding:12px;border:1px solid #e0d9c9;border-radius:12px;background:#fffdf7}.df-question-diagnostic h3{margin:0 0 8px;font-size:.9rem}.df-diagnostic-item{padding:8px 0;border-top:1px solid #ece7da}.df-diagnostic-item:first-of-type{border-top:0}.df-diagnostic-item strong{display:block;font-size:.78rem}.df-diagnostic-item span{display:block;margin-top:3px;font-size:.76rem;line-height:1.45;color:#4b5565}.df-question-good{padding:10px;border-radius:10px;background:#edf8f2;color:#12663e;font-size:.8rem;font-weight:750}.df-session-result{display:grid;gap:14px;margin:14px 0}.diagnostic-session-result-active>#summaryMasteryStatus,.diagnostic-session-result-active>.summary-insight-grid,.diagnostic-session-result-active>#loSummaryList,.diagnostic-session-result-active>#questionScoreStrip,.diagnostic-session-result-active>#m15Roll{display:none!important}.df-session-meta{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:11px 13px;border:1px solid #d9dee8;border-radius:12px;background:#f8fafc}.df-session-meta strong{font-size:.9rem}.df-comparison{font-size:.75rem;color:#475467}.df-notice{padding:10px 12px;border-radius:10px;background:#fff7e7;color:#704c00;font-size:.76rem;line-height:1.5}.df-result-grid{display:grid;gap:14px}.df-section{border:1px solid #d9dee8;border-radius:16px;background:#fff;padding:14px}.df-section-head{display:flex;justify-content:space-between;gap:10px;margin-bottom:11px}.df-section-head span,.df-eyebrow{font-size:.68rem;letter-spacing:.07em;text-transform:uppercase;color:#667085;font-weight:850}.df-section h3{margin:2px 0 0;font-size:1rem;color:#172033}.df-skill-list,.df-weak-list{display:grid;gap:8px}.df-skill-card{padding:10px 11px;border:1px solid #e0e4eb;border-radius:12px}.df-skill-head,.df-skill-foot{display:flex;align-items:center;justify-content:space-between;gap:10px}.df-skill-head strong{display:block;font-size:.82rem}.df-skill-head small{display:block;font-size:.62rem;color:#667085;margin-top:2px}.df-progress{height:8px;overflow:hidden;border-radius:999px;background:#e9edf3;margin:8px 0}.df-progress i{display:block;height:100%;border-radius:inherit;background:#2456d6}.df-skill-foot{font-size:.67rem;color:#667085}.df-status{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:4px 8px;font-weight:800}.df-status.mastered{background:#edf8f2;color:#12663e}.df-status.strong{background:#eef6f3;color:#25634a}.df-status.developing{background:#fff7e7;color:#805b08}.df-status.needs-practice{background:#fff0ed;color:#a52b20}.df-status.not-assessed{background:#f2f4f7;color:#667085}.df-weak-card{padding:10px 11px;border-left:4px solid #c67b18;border-radius:10px;background:#fffaf1}.df-weak-card>div{display:flex;justify-content:space-between;gap:10px}.df-weak-card strong{font-size:.8rem}.df-weak-card span{font-size:.7rem;color:#805b08}.df-weak-card p{margin:5px 0 0;font-size:.72rem;color:#5b6370;line-height:1.45}.df-empty{padding:12px;border:1px dashed #ccd3df;border-radius:10px;color:#667085;font-size:.76rem}.df-recommendation{display:grid;gap:12px;border-color:#b9c9f2;background:linear-gradient(135deg,#fff,#f3f6ff)}.df-recommendation p{margin:5px 0 0;color:#475467;font-size:.77rem;line-height:1.45}.df-recommendation small{display:block;margin-top:5px;color:#667085}.df-primary-cta{min-height:48px;width:100%;font-weight:850}.df-review-all>summary,.df-question-review>summary{cursor:pointer;min-height:44px;display:flex;align-items:center;justify-content:space-between;gap:10px;font-weight:800}.df-review-list{display:grid;gap:8px;margin-top:10px}.df-question-review{border:1px solid #e0e4eb;border-radius:11px;padding:0 10px}.df-review-body{padding:0 0 10px}.df-review-skills{display:flex;gap:5px;flex-wrap:wrap}.df-review-skill{display:inline-flex;gap:4px;align-items:center;padding:4px 7px;border-radius:999px;font-size:.67rem}.df-review-skill.is-correct{background:#edf8f2;color:#12663e}.df-review-skill.is-review{background:#fff0ed;color:#a52b20}.df-review-errors h4{margin:10px 0 4px;font-size:.76rem}.df-review-errors ul{margin:0;padding-left:18px;font-size:.72rem;line-height:1.5}.df-review-ok{font-size:.72rem;color:#12663e}.df-notation-placeholder{display:grid;gap:3px;margin-top:10px;padding:9px;border-radius:9px;background:#f8fafc;color:#667085;font-size:.68rem;line-height:1.4}.df-notation-placeholder strong{color:#344054}.diagnostic-session-result-active>#m15Actions{display:flex}.diagnostic-session-result-active>#restartSession{display:none!important}
  @media(min-width:820px){.df-result-grid{grid-template-columns:minmax(0,1.25fr) minmax(300px,.75fr)}.df-recommendation{grid-template-columns:minmax(0,1fr) auto;align-items:center}.df-primary-cta{width:auto;min-width:160px}.df-skill-list{grid-template-columns:repeat(2,minmax(0,1fr))}}
  @media(prefers-reduced-motion:reduce){.df-progress i{transition:none}}
  `;
  document.head.appendChild(style);
}

if(typeof window.addEventListener==='function'){
  window.addEventListener('major-scale-session-start',event=>resetSession(event.detail||{}));
  window.addEventListener('major-scale-question-result',event=>captureQuestionResult(event.detail));
}
if(typeof document!=='undefined') installStyles();
if(Array.isArray(app.diagnosticQuestionResults)) app.diagnosticQuestionResults.forEach(captureQuestionResult);
if(app.lastDiagnosticSessionStart) sessionContext={...app.lastDiagnosticSessionStart};

app.diagnosticFeedback=Object.freeze({
  SKILL_ORDER,
  STATUS_META,
  statusForSkill,
  calculateSkillPerformance,
  identifyWeakSkills,
  recommendNextPractice,
  aggregateSessionResults,
  buildSessionResult,
  captureQuestionResult,
  resetSession,
  getQuestionResults,
  getQuestionCount,
  renderSessionResult,
  renderServerSession,
  renderFallbackSessionResult
});
})();
