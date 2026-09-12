(() => {
'use strict';

const app = window.MajorScaleApp = window.MajorScaleApp || {};
const dashboardRepository = app.dashboardRepository;
const practiceRepository = app.practiceRepository;
const authRepository = app.authRepository;
const SET_SIZE = 5;
const EXERCISE_CODE = 'MAJOR_SCALE_NOTATION';
const skillFallback = new Map([
  ['BN01_TREBLE_PITCH','ระดับเสียงบนบรรทัดห้าเส้น'],
  ['BN06_STEM_DIRECTION','ทิศทางก้านโน้ต'],
  ['RH01_DURATION_VALUE','ค่าความยาวของตัวโน้ต'],
  ['GR02_PRIMARY_BEAM','การรวมเขบ็ต'],
  ['MS03_SCALE_ACCIDENTAL','เครื่องหมายแปลงเสียง']
]);

let skillNames = new Map(skillFallback);
let currentPracticeSessionId = null;
let sessionLookupPromise = null;
let finalizingPracticeSet = false;
let dashboardEnhanceToken = 0;
let teacherEnhanceToken = 0;

function escapeHtml(value){
  return String(value ?? '').replace(/[&<>'"]/g,ch=>({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  })[ch]);
}
function firstResult(data){ return Array.isArray(data) ? (data[0] || null) : (data || null); }
function pct(value){ const n=Number(value); return Number.isFinite(n) ? `${n.toFixed(2).replace(/\.00$/,'')}%` : '—'; }
function keyName(code){
  if(!code) return '—';
  return `${String(code).replace(/##/g,'𝄪').replace(/bb/g,'𝄫').replace(/#/g,'♯').replace(/b/g,'♭')} Major`;
}
function skillName(code){ return skillNames.get(code) || skillFallback.get(code) || code || 'ทักษะ'; }
function formatDate(value){
  if(!value) return 'ยังไม่มีข้อมูล';
  const date=new Date(value);
  if(Number.isNaN(date.getTime())) return 'ยังไม่มีข้อมูล';
  return new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'short'}).format(date);
}

function injectStyles(){
  if(document.getElementById('m15LearningFeedbackStyles')) return;
  const style=document.createElement('style');
  style.id='m15LearningFeedbackStyles';
  style.textContent=`
    .m15-learning-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0}
    .m15-learning-stat{border:1px solid #e1dfd7;border-radius:10px;padding:10px;background:#fff}
    .m15-learning-stat strong{display:block;font-size:1.15rem}.m15-learning-stat span{font-size:.72rem;color:#6d6d64}
    .m15-reason{margin:10px 0;padding:10px 12px;border-radius:10px;background:#f7f6f1;line-height:1.55}
    .m15-missing{margin-top:6px;font-size:.78rem;color:#6a4b16}.m15-skill-list{display:grid;gap:6px;margin-top:10px}
    .m15-skill{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:7px 9px;border-radius:8px;background:#f8f8f5}
    .m15-skill small{display:block;color:#77776e}.m15-skill b.pass{color:#2a6a45}.m15-skill b.fail{color:#9a4f28}
    .m15-diagnostic-card{margin-top:12px;padding:11px 12px;border:1px solid #ddd9cc;border-radius:10px;background:#fffdf7}
    .m15-diagnostic-card strong{display:block;margin-bottom:4px}.m15-summary-rolling{margin:12px 0;border-top:1px solid #e0ded6;padding-top:12px}
    .m15-summary-rolling h3{font-size:.95rem;margin:0 0 8px}.m15-summary-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
    .m15-teacher-feedback{margin-top:10px;padding:9px 10px;border-radius:9px;background:#f7f7f3;border:1px solid #e4e2da;font-size:.78rem;line-height:1.5}
    .m15-teacher-feedback-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:6px}.m15-teacher-feedback-grid span{display:block}
    .m15-watch{color:#9a4f28;font-weight:700}.m15-ok{color:#2a6a45;font-weight:700}
    @media(max-width:700px){.m15-learning-grid,.m15-teacher-feedback-grid{grid-template-columns:1fr}.m15-learning-stat{padding:8px}}
  `;
  document.head.appendChild(style);
}

async function loadSkillNames(){
  try{
    const {data,error}=await dashboardRepository.getActiveSkills();
    if(error) throw error;
    const map=new Map(skillFallback);
    (data||[]).forEach(row=>map.set(row.code,row.name_th||row.short_name||row.code));
    skillNames=map;
  }catch(error){ console.warn('M1.5 SKILL NAMES:',error); }
}

function reasonForEvidence(ev){
  if(!ev) return 'ยังไม่มีข้อมูลเพียงพอสำหรับสรุปความก้าวหน้า';
  if(ev.mastery_passed===true) return 'ผ่านเกณฑ์ของขั้นนี้แล้ว';
  const attempts=Number(ev.attempts_found||0),windowSize=Number(ev.rolling_window||0);
  if(ev.enough_attempts!==true) return `ยังต้องสะสมผลการฝึกอีก ${Math.max(0,windowSize-attempts)} ข้อ เพื่อให้ครบ ${windowSize} ข้อที่ใช้ประเมิน`;
  const missing=Array.isArray(ev.missing_item_codes)?ev.missing_item_codes:[];
  if(ev.coverage_passed!==true) return `คะแนนอาจดีแล้ว แต่ยังทำบันไดเสียงที่กำหนดไม่ครบ${missing.length?` โดยยังขาด ${missing.map(keyName).join(', ')}`:''}`;
  const failed=(ev.skill_results||[]).filter(item=>item.passed!==true);
  if(ev.skills_passed!==true && failed.length) return `ยังมีทักษะต่ำกว่าเกณฑ์: ${failed.map(item=>skillName(item.skill_code)).join(', ')}`;
  if(Number(ev.overall_score)<Number(ev.overall_threshold)) return `คะแนนรวม ${pct(ev.overall_score)} ยังไม่ถึงเกณฑ์ ${pct(ev.overall_threshold)}`;
  return 'ทำแบบฝึกขั้นนี้ต่อเพื่อเพิ่มหลักฐานและความสม่ำเสมอ';
}

function skillsHtml(skills){
  return (skills||[]).map(item=>{
    const pass=item.passed===true;
    return `<div class="m15-skill"><div><strong>${escapeHtml(skillName(item.skill_code))}</strong><small>เกณฑ์ ${pct(item.threshold)}</small></div><b class="${pass?'pass':'fail'}">${pct(item.score)} ${pass?'✓':''}</b></div>`;
  }).join('') || '<div class="dashboard-message">ยังไม่มีผลรายทักษะ</div>';
}

async function enhanceStudentDashboard(){
  const dashboard=document.getElementById('studentDashboard');
  const content=document.getElementById('dashboardContent');
  if(!dashboard || dashboard.hidden || !content || content.hidden || !dashboardRepository) return;
  const token=++dashboardEnhanceToken;
  try{
    const [dash,diag]=await Promise.all([
      dashboardRepository.getStudentDashboard(),
      dashboardRepository.getLatestDiagnosticFeedback(EXERCISE_CODE)
    ]);
    if(token!==dashboardEnhanceToken || dash.error) return;
    const rows=Array.isArray(dash.data)?dash.data:[];
    const current=rows.find(row=>row.stage_status==='in_progress');
    if(current){
      const evidenceResult=await dashboardRepository.getStageEvidence({exerciseCode:current.exercise_code,stageCode:current.stage_code});
      if(token!==dashboardEnhanceToken || evidenceResult.error) return;
      const ev=firstResult(evidenceResult.data);
      const body=document.getElementById('dashboardMasteryBody');
      if(body && ev){
        const missing=Array.isArray(ev.missing_item_codes)?ev.missing_item_codes:[];
        body.className='';
        body.innerHTML=`
          <div class="m15-learning-grid">
            <div class="m15-learning-stat"><strong>${pct(ev.overall_score)}</strong><span>Mastery สะสม · เกณฑ์ ${pct(ev.overall_threshold)}</span></div>
            <div class="m15-learning-stat"><strong>${Number(ev.attempts_found||0)} / ${Number(ev.rolling_window||0)}</strong><span>ผลการฝึกที่ใช้ประเมิน</span></div>
            <div class="m15-learning-stat"><strong>${Number(ev.covered_items||0)} / ${Number(ev.required_items||0)}</strong><span>บันไดเสียงที่ต้องครอบคลุม</span></div>
          </div>
          <div class="m15-reason"><strong>ทำไมจึง${ev.mastery_passed===true?'ผ่าน':'ยังไม่ผ่าน'}ขั้นนี้</strong><div>${escapeHtml(reasonForEvidence(ev))}</div>${missing.length?`<div class="m15-missing">ยังขาด: ${missing.map(keyName).map(escapeHtml).join(' · ')}</div>`:''}</div>
          <div class="m15-skill-list">${skillsHtml(ev.skill_results)}</div>`;
      }
    }
    const d=firstResult(diag.data);
    if(d){
      const body=document.getElementById('dashboardMasteryBody');
      if(body && !body.querySelector('.m15-diagnostic-card')){
        const placement=d.placement_stage_name||d.placement_stage_code||'เส้นทางที่ระบบกำหนด';
        body.insertAdjacentHTML('beforeend',`<div class="m15-diagnostic-card"><strong>ผลประเมินก่อนเรียนล่าสุด</strong><div>${escapeHtml(d.evaluated_stage_name||d.evaluated_stage_code||'')} · ${pct(d.session_overall_score)} · ${d.diagnostic_passed===true?'ผ่านเกณฑ์':'ควรฝึกขั้นนี้ก่อน'}</div><small>จุดเริ่มต้นหลังประเมิน: ${escapeHtml(placement)}</small></div>`);
      }
    }
    const target=document.querySelector('#dashboardRecommendation .dashboard-recommendation-target');
    if(target && /^เป้าหมาย:/.test(target.textContent||'')) target.textContent=(target.textContent||'').replace(/^เป้าหมาย:/,'จุดที่ควรระวังในการฝึก:');
  }catch(error){ console.warn('M1.5 STUDENT DASHBOARD:',error); }
}

async function resolvePracticeSessionId(){
  if(currentPracticeSessionId) return currentPracticeSessionId;
  if(sessionLookupPromise) return sessionLookupPromise;
  sessionLookupPromise=(async()=>{
    try{
      const {data:{user},error}=await authRepository.getUser();
      if(error||!user) return null;
      const result=await practiceRepository.getOpenLearningSessions(user.id);
      if(result.error) return null;
      const sessions=(result.data||[]).filter(row=>row.mode==='practice').sort((a,b)=>new Date(b.started_at)-new Date(a.started_at));
      currentPracticeSessionId=sessions[0]?.id||null;
      return currentPracticeSessionId;
    }finally{ sessionLookupPromise=null; }
  })();
  return sessionLookupPromise;
}

function releaseQuestionOverlay(){
  const overlay=document.getElementById('questionResultOverlay');
  if(overlay){ overlay.classList.remove('is-visible'); overlay.hidden=true; overlay.setAttribute('aria-hidden','true'); }
  document.querySelectorAll('.session-app > .session-header, .session-app > .session-main').forEach(node=>{node.inert=false;node.removeAttribute('aria-hidden');});
}

function ensureSummaryExtras(){
  const panel=document.querySelector('#sessionSummary .summary-panel');
  if(!panel) return null;
  let rolling=document.getElementById('m15SummaryRolling');
  if(!rolling){
    rolling=document.createElement('div'); rolling.id='m15SummaryRolling'; rolling.className='m15-summary-rolling';
    const list=document.getElementById('loSummaryList'); list?.before(rolling);
  }
  let actions=document.getElementById('m15SummaryActions');
  if(!actions){
    actions=document.createElement('div'); actions.id='m15SummaryActions'; actions.className='m15-summary-actions';
    const restart=document.getElementById('restartSession'); restart?.after(actions);
    const dashboardButton=document.createElement('button'); dashboardButton.type='button'; dashboardButton.className='btn'; dashboardButton.id='m15SummaryDashboard'; dashboardButton.textContent='กลับแดชบอร์ด';
    dashboardButton.addEventListener('click',()=>{document.getElementById('sessionSummary').hidden=true; resetSetState(); document.getElementById('dashboardButton')?.click();});
    actions.appendChild(dashboardButton);
  }
  return {rolling,actions};
}
function resetSetState(){ currentPracticeSessionId=null; sessionLookupPromise=null; finalizingPracticeSet=false; }

function fillSummaryCommon({title,overall,statusHtml,skills,questions,strongText,weakText}){
  document.getElementById('summaryTitle').textContent=title;
  document.getElementById('summaryOverall').textContent=pct(overall);
  const status=document.getElementById('summaryMasteryStatus'); status.className='summary-mastery-status'; status.innerHTML=statusHtml;
  document.getElementById('summaryStrengths').textContent=strongText||'—';
  document.getElementById('summaryWeaknesses').textContent=weakText||'—';
  document.getElementById('loSummaryList').innerHTML=(skills||[]).map(item=>`<div class="lo-summary-row ${item.passed===true?'strong':'weak'}"><div class="lo-summary-name"><b>${escapeHtml(item.skill_code||'')}</b><span>${escapeHtml(skillName(item.skill_code))} · เกณฑ์ ${pct(item.threshold)}</span></div><div class="lo-summary-bar"><i style="width:${Math.max(0,Math.min(100,Number(item.score)||0))}%"></i></div><strong>${pct(item.score)}</strong></div>`).join('');
  document.getElementById('questionScoreStrip').innerHTML=(questions||[]).map(q=>`<span><small>${Number(q.question_number||0)}</small><b>${pct(q.score)}</b></span>`).join('');
}
function strengthsWeaknesses(skills){
  const sorted=[...(skills||[])].filter(s=>Number.isFinite(Number(s.score))).sort((a,b)=>Number(b.score)-Number(a.score));
  const strong=sorted.filter(s=>s.passed===true).slice(0,3).map(s=>skillName(s.skill_code));
  const weak=sorted.filter(s=>s.passed!==true).sort((a,b)=>Number(a.score)-Number(b.score)).slice(0,3).map(s=>skillName(s.skill_code));
  return {strong:strong.join(' • ')||'ยังไม่มีด้านที่ผ่านเกณฑ์ในชุดนี้',weak:weak.join(' • ')||'ผ่านเกณฑ์รายด้านทุกด้านในชุดนี้'};
}

function showPracticeSetSummary(data){
  releaseQuestionOverlay(); ensureSummaryExtras();
  const skills=Array.isArray(data.session_skill_results)?data.session_skill_results:[];
  const sw=strengthsWeaknesses(skills);
  fillSummaryCommon({title:`สรุปชุดฝึก ${SET_SIZE} ข้อ`,overall:data.session_overall_score,statusHtml:'<b>ผลชุดฝึกนี้</b><span>คะแนนส่วนนี้เป็นผลของ 5 ข้อล่าสุด ส่วนการผ่านขั้นใช้ Mastery สะสมด้านล่าง</span>',skills,questions:data.question_scores,strongText:sw.strong,weakText:sw.weak});
  const rolling=document.getElementById('m15SummaryRolling');
  const missing=Array.isArray(data.missing_item_codes)?data.missing_item_codes:[];
  rolling.innerHTML=`<h3>ความก้าวหน้าสะสมของขั้น</h3><div class="m15-learning-grid"><div class="m15-learning-stat"><strong>${pct(data.overall_score)}</strong><span>Mastery สะสม · เกณฑ์ ${pct(data.overall_threshold)}</span></div><div class="m15-learning-stat"><strong>${data.attempts_found||0} / ${data.rolling_window||0}</strong><span>หลักฐานที่ใช้ประเมิน</span></div><div class="m15-learning-stat"><strong>${data.covered_items||0} / ${data.required_items||0}</strong><span>Coverage บันไดเสียง</span></div></div><div class="m15-reason"><strong>สถานะปัจจุบัน</strong><div>${escapeHtml(reasonForEvidence(data))}</div>${missing.length?`<div class="m15-missing">ยังขาด: ${missing.map(keyName).map(escapeHtml).join(' · ')}</div>`:''}</div><div class="m15-skill-list">${skillsHtml(data.rolling_skill_results)}</div>`;
  const restart=document.getElementById('restartSession');
  const stageFinished=data.stage_status==='mastered'||data.mastery_passed===true;
  restart.hidden=stageFinished; restart.textContent='ฝึกต่ออีก 5 ข้อ';
  document.getElementById('m15SummaryDashboard').textContent=stageFinished?'ไปที่แดชบอร์ดเพื่อเรียนขั้นถัดไป':'กลับแดชบอร์ด';
  document.getElementById('sessionSummary').hidden=false;
  document.getElementById('m15SummaryDashboard').focus();
}

async function finalizePracticeSet(){
  if(finalizingPracticeSet) return;
  finalizingPracticeSet=true;
  try{
    const sessionId=await resolvePracticeSessionId();
    if(!sessionId) throw new Error('ไม่พบชุดฝึกที่กำลังใช้งาน');
    const {data,error}=await dashboardRepository.finalizePracticeSet({sessionId,expectedQuestions:SET_SIZE});
    if(error) throw error;
    const result=firstResult(data); if(!result) throw new Error('ไม่พบผลสรุปชุดฝึก');
    showPracticeSetSummary(result);
  }catch(error){
    console.error('M1.5 FINALIZE PRACTICE SET:',error);
    finalizingPracticeSet=false;
    alert('สรุปชุดฝึกไม่สำเร็จ: '+(error.message||'กรุณาลองใหม่'));
  }
}

async function showDiagnosticSummary(){
  try{
    const {data,error}=await dashboardRepository.getLatestDiagnosticFeedback(EXERCISE_CODE);
    if(error) throw error;
    const result=firstResult(data); if(!result) throw new Error('ไม่พบผลประเมินก่อนเรียน');
    releaseQuestionOverlay(); ensureSummaryExtras();
    const skills=Array.isArray(result.skill_results)?result.skill_results:[];
    const sw=strengthsWeaknesses(skills);
    const placement=result.placement_stage_name||result.placement_stage_code||'เส้นทางที่ระบบกำหนด';
    const statusHtml=result.diagnostic_passed===true
      ? `<b>ผ่านเกณฑ์ของขั้นที่ประเมิน</b><span>ระบบใช้ผลนี้กำหนดจุดเริ่มต้นที่เหมาะสม ไม่ใช่การสอบผ่าน/ตก</span>`
      : `<b>แนะนำให้เริ่มฝึกจากขั้นนี้</b><span>ผลประเมินใช้เพื่อกำหนดจุดเริ่มต้น ไม่ใช่การสอบผ่าน/ตก</span>`;
    fillSummaryCommon({title:'ผลประเมินก่อนเรียน',overall:result.session_overall_score,statusHtml,skills,questions:result.question_scores,strongText:sw.strong,weakText:sw.weak});
    document.getElementById('m15SummaryRolling').innerHTML=`<h3>การจัดวางหลังประเมิน</h3><div class="m15-reason"><strong>จุดเริ่มต้นที่แนะนำ: ${escapeHtml(placement)}</strong><div>${escapeHtml(result.recommendation_reason_th||'ระบบได้จัดจุดเริ่มต้นจากผลประเมินและความก้าวหน้าปัจจุบัน')}</div></div>`;
    document.getElementById('restartSession').hidden=true;
    document.getElementById('m15SummaryDashboard').textContent='ดูแผนการเรียนที่แดชบอร์ด';
    document.getElementById('sessionSummary').hidden=false;
    document.getElementById('m15SummaryDashboard').focus();
  }catch(error){ console.error('M1.5 DIAGNOSTIC SUMMARY:',error); document.getElementById('dashboardButton')?.click(); }
}

function reviewQuestionResult(){
  const overlay=document.getElementById('questionResultOverlay');
  const button=document.getElementById('questionResultContinue');
  if(!overlay||overlay.hidden||!button) return;
  const diagnostic=(document.getElementById('taskText')?.textContent||'').includes('แบบประเมินก่อนเรียน');
  if(diagnostic){
    if(!button.disabled && (button.textContent||'').includes('ดูแผนการเรียน')){ button.dataset.m15Action='diagnostic'; button.textContent='ดูผลประเมินก่อนเรียน'; }
    return;
  }
  resolvePracticeSessionId();
  const count=document.querySelectorAll('#questionResultFeedback .feedback-qscore').length;
  if(count>=SET_SIZE && !button.disabled){ button.dataset.m15Action='practice-summary'; button.textContent=`ดูสรุปชุดฝึก ${SET_SIZE} ข้อ`; }
}

async function enhanceTeacherDashboard(){
  const dashboard=document.getElementById('teacherDashboard'),content=document.getElementById('teacherDashboardContent');
  const select=document.getElementById('teacherClassSelect');
  if(!dashboard||dashboard.hidden||!content||content.hidden||!select?.value||!dashboardRepository) return;
  const token=++teacherEnhanceToken;
  try{
    const {data,error}=await dashboardRepository.getTeacherClassLearningFeedback(select.value);
    if(error||token!==teacherEnhanceToken) return;
    const rows=Array.isArray(data)?data:[];
    document.querySelectorAll('.teacher-student-card').forEach(card=>{
      const studentId=card.querySelector('.teacher-student-head .dashboard-code')?.textContent?.trim();
      card.querySelectorAll('.teacher-exercise-row').forEach(row=>{
        const code=(row.querySelector('.dashboard-code')?.textContent||'').split('·')[0].trim();
        const item=rows.find(x=>String(x.student_id)===studentId && x.exercise_code===code);
        row.querySelector('.m15-teacher-feedback')?.remove();
        if(!item) return;
        const failed=(item.skill_results||[]).filter(s=>s.passed!==true).map(s=>skillName(s.skill_code));
        const missing=Array.isArray(item.missing_item_codes)?item.missing_item_codes:[];
        row.querySelector('.teacher-exercise-main')?.insertAdjacentHTML('beforeend',`<div class="m15-teacher-feedback"><strong>ข้อมูลการเรียนล่าสุด</strong><div class="m15-teacher-feedback-grid"><span>กิจกรรมล่าสุด<br><b>${escapeHtml(formatDate(item.latest_activity_at))}</b></span><span>Session / Attempt<br><b>${item.practice_session_count||0} / ${item.attempt_count||0}</b></span><span>Evidence / Coverage<br><b>${item.attempts_found||0}/${item.rolling_window||0} · ${item.covered_items||0}/${item.required_items||0}</b></span></div><div class="${failed.length||missing.length?'m15-watch':'m15-ok'}">${failed.length?`ควรติดตาม: ${escapeHtml(failed.join(', '))}`:'ทักษะที่มีข้อมูลอยู่ในเกณฑ์'}${missing.length?` · ยังขาด ${missing.map(keyName).map(escapeHtml).join(', ')}`:''}</div></div>`);
      });
    });
  }catch(error){ console.warn('M1.5 TEACHER FEEDBACK:',error); }
}

function normalizeTerminology(){
  const select=document.getElementById('levelSelect');
  if(select){ [...select.options].forEach((opt,i)=>{const text=`ขั้นที่ ${i+1}`; if(opt.textContent!==text) opt.textContent=text;}); const label=select.closest('label'); if(label?.firstChild?.nodeType===Node.TEXT_NODE && !label.firstChild.nodeValue.includes('ขั้น')) label.firstChild.nodeValue='ขั้น '; }
  const levelStatus=document.getElementById('levelStatus'); if(levelStatus && /Level \d+/.test(levelStatus.textContent||'')) levelStatus.textContent=(levelStatus.textContent||'').replace(/Level (\d+)/g,'ขั้นที่ $1');
  const power=document.querySelector('.mastery-power-label span'); if(power && power.textContent!=='ความก้าวหน้าของขั้น') power.textContent='ความก้าวหน้าของขั้น';
  const detail=document.getElementById('masteryDetailsTitle'); if(detail && /Level \d+/.test(detail.textContent||'')) detail.textContent=(detail.textContent||'').replace(/Level (\d+)/g,'ขั้นที่ $1');
  document.querySelectorAll('.teacher-guide-list strong').forEach(node=>{ if(node.textContent==='Stage Progress') node.textContent='ความก้าวหน้าของขั้น'; });
}

function scheduleEnhancements(){
  normalizeTerminology();
  setTimeout(()=>{enhanceStudentDashboard();enhanceTeacherDashboard();reviewQuestionResult();},80);
}

document.addEventListener('click',event=>{
  const target=event.target.closest?.('button'); if(!target) return;
  if(target.id==='questionResultContinue' && target.dataset.m15Action){
    event.preventDefault(); event.stopImmediatePropagation();
    const action=target.dataset.m15Action; delete target.dataset.m15Action;
    if(action==='practice-summary') finalizePracticeSet(); else showDiagnosticSummary();
    return;
  }
  if(target.id==='restartSession'){
    document.querySelectorAll('.session-app > .session-header, .session-app > .session-main').forEach(node=>{node.inert=false;node.removeAttribute('aria-hidden');});
    resetSetState();
  }
  if(target.id==='dashboardButton'||target.classList.contains('dashboard-continue')) setTimeout(scheduleEnhancements,120);
},true);

document.getElementById('teacherClassSelect')?.addEventListener('change',()=>setTimeout(enhanceTeacherDashboard,160));

const observer=new MutationObserver(scheduleEnhancements);
observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','class','disabled']});

injectStyles();
loadSkillNames().finally(scheduleEnhancements);
})();
