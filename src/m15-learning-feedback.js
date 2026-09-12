(() => {
'use strict';
const app=window.MajorScaleApp=window.MajorScaleApp||{};
const repo=app.dashboardRepository, practice=app.practiceRepository, auth=app.authRepository;
const SET_SIZE=5, EXERCISE_CODE='MAJOR_SCALE_NOTATION';
const fallback=new Map([
 ['BN01_TREBLE_PITCH','ระดับเสียงบนบรรทัดห้าเส้น'],['BN06_STEM_DIRECTION','ทิศทางก้านโน้ต'],
 ['RH01_DURATION_VALUE','ค่าความยาวของตัวโน้ต'],['GR02_PRIMARY_BEAM','การรวมเขบ็ต'],
 ['MS03_SCALE_ACCIDENTAL','เครื่องหมายแปลงเสียง']
]);
let names=new Map(fallback),sessionId=null,sessionLookup=null,finalizing=false,studentToken=0,teacherToken=0;
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const first=d=>Array.isArray(d)?(d[0]||null):(d||null);
const pct=v=>Number.isFinite(Number(v))?`${Number(v).toFixed(2).replace(/\.00$/,'')}%`:'—';
const skillName=c=>names.get(c)||fallback.get(c)||c||'ทักษะ';
const keyName=c=>c?`${String(c).replace(/##/g,'𝄪').replace(/bb/g,'𝄫').replace(/#/g,'♯').replace(/b/g,'♭')} Major`:'—';
function ensureDiagnosticFeedback(){
  if(app.diagnosticFeedback || document.querySelector('script[data-diagnostic-feedback]')) return;
  const script=document.createElement('script');
  script.src='./src/diagnostic-feedback.js?v=20260913-diagnostic-feedback-v1';
  script.setAttribute('data-diagnostic-feedback','true');
  script.addEventListener('error',()=>console.warn('DIAGNOSTIC FEEDBACK MODULE FAILED TO LOAD'),{once:true});
  document.body.appendChild(script);
}
function dateText(v){if(!v)return'ยังไม่มีข้อมูล';const d=new Date(v);return Number.isNaN(d.getTime())?'ยังไม่มีข้อมูล':new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'short'}).format(d)}
function styles(){if(document.getElementById('m15Style'))return;const s=document.createElement('style');s.id='m15Style';s.textContent=`
.m15-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0}.m15-stat{border:1px solid #e1dfd7;border-radius:10px;padding:10px;background:#fff}.m15-stat strong{display:block;font-size:1.12rem}.m15-stat span{font-size:.72rem;color:#6d6d64}.m15-reason{margin:10px 0;padding:10px 12px;border-radius:10px;background:#f7f6f1;line-height:1.55}.m15-missing{margin-top:6px;font-size:.78rem;color:#6a4b16}.m15-skills{display:grid;gap:6px;margin-top:10px}.m15-skill{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:7px 9px;border-radius:8px;background:#f8f8f5}.m15-skill small{display:block;color:#77776e}.m15-pass{color:#2a6a45}.m15-fail,.m15-watch{color:#9a4f28}.m15-diag{margin-top:12px;padding:11px 12px;border:1px solid #ddd9cc;border-radius:10px;background:#fffdf7}.m15-roll{margin:12px 0;border-top:1px solid #e0ded6;padding-top:12px}.m15-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.m15-teacher{margin-top:10px;padding:9px 10px;border-radius:9px;background:#f7f7f3;border:1px solid #e4e2da;font-size:.78rem;line-height:1.5}.m15-teacher-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:6px 0}@media(max-width:700px){.m15-grid,.m15-teacher-grid{grid-template-columns:1fr}}
`;document.head.appendChild(s)}
async function loadNames(){try{const r=await repo.getActiveSkills();if(r.error)return;(r.data||[]).forEach(x=>names.set(x.code,x.name_th||x.short_name||x.code))}catch(e){console.warn('M1.5 skill names',e)}}
function reason(ev){if(!ev)return'ยังไม่มีข้อมูลเพียงพอ';if(ev.mastery_passed===true)return'ผ่านเกณฑ์ของขั้นนี้แล้ว';const a=Number(ev.attempts_found||0),w=Number(ev.rolling_window||0);if(ev.enough_attempts!==true)return`ยังต้องสะสมผลการฝึกอีก ${Math.max(0,w-a)} ข้อ เพื่อให้ครบ ${w} ข้อที่ใช้ประเมิน`;const m=Array.isArray(ev.missing_item_codes)?ev.missing_item_codes:[];if(ev.coverage_passed!==true)return`ยังทำบันไดเสียงที่กำหนดไม่ครบ${m.length?` โดยยังขาด ${m.map(keyName).join(', ')}`:''}`;const f=(ev.skill_results||[]).filter(x=>x.passed!==true);if(ev.skills_passed!==true&&f.length)return`ยังมีทักษะต่ำกว่าเกณฑ์: ${f.map(x=>skillName(x.skill_code)).join(', ')}`;if(Number(ev.overall_score)<Number(ev.overall_threshold))return`คะแนนรวม ${pct(ev.overall_score)} ยังไม่ถึงเกณฑ์ ${pct(ev.overall_threshold)}`;return'ทำแบบฝึกขั้นนี้ต่อเพื่อเพิ่มหลักฐานและความสม่ำเสมอ'}
function skillRows(list){return(list||[]).map(x=>`<div class="m15-skill"><div><strong>${esc(skillName(x.skill_code))}</strong><small>เกณฑ์ ${pct(x.threshold)}</small></div><b class="${x.passed===true?'m15-pass':'m15-fail'}">${pct(x.score)} ${x.passed===true?'✓':''}</b></div>`).join('')||'<div class="dashboard-message">ยังไม่มีผลรายทักษะ</div>'}
function normalize(){const sel=document.getElementById('levelSelect');if(sel){[...sel.options].forEach((o,i)=>{const t=`ขั้นที่ ${i+1}`;if(o.textContent!==t)o.textContent=t});const l=sel.closest('label');if(l?.firstChild?.nodeType===Node.TEXT_NODE&&!l.firstChild.nodeValue.includes('ขั้น'))l.firstChild.nodeValue='ขั้น '}const st=document.getElementById('levelStatus');if(st&&/Level \d+/.test(st.textContent||''))st.textContent=st.textContent.replace(/Level (\d+)/g,'ขั้นที่ $1');const p=document.querySelector('.mastery-power-label span');if(p&&p.textContent!=='ความก้าวหน้าของขั้น')p.textContent='ความก้าวหน้าของขั้น';const d=document.getElementById('masteryDetailsTitle');if(d&&/Level \d+/.test(d.textContent||''))d.textContent=d.textContent.replace(/Level (\d+)/g,'ขั้นที่ $1');document.querySelectorAll('.teacher-guide-list strong').forEach(n=>{if(n.textContent==='Stage Progress')n.textContent='ความก้าวหน้าของขั้น'});const target=document.querySelector('#dashboardRecommendation .dashboard-recommendation-target');if(target&&/^เป้าหมาย:/.test(target.textContent||''))target.textContent=target.textContent.replace(/^เป้าหมาย:/,'จุดที่ควรระวังในการฝึก:')}
async function student(){const dash=document.getElementById('studentDashboard'),content=document.getElementById('dashboardContent');if(!dash||dash.hidden||!content||content.hidden||!repo)return;const t=++studentToken;try{const [dr,dg]=await Promise.all([repo.getStudentDashboard(),repo.getLatestDiagnosticFeedback(EXERCISE_CODE)]);if(t!==studentToken||dr.error)return;const cur=(Array.isArray(dr.data)?dr.data:[]).find(x=>x.stage_status==='in_progress');const body=document.getElementById('dashboardMasteryBody');if(cur&&body){const er=await repo.getStageEvidence({exerciseCode:cur.exercise_code,stageCode:cur.stage_code});if(t!==studentToken||er.error)return;const ev=first(er.data);if(ev){const m=Array.isArray(ev.missing_item_codes)?ev.missing_item_codes:[];body.className='';body.innerHTML=`<div class="m15-grid"><div class="m15-stat"><strong>${pct(ev.overall_score)}</strong><span>Mastery สะสม · เกณฑ์ ${pct(ev.overall_threshold)}</span></div><div class="m15-stat"><strong>${ev.attempts_found||0} / ${ev.rolling_window||0}</strong><span>ผลการฝึกที่ใช้ประเมิน</span></div><div class="m15-stat"><strong>${ev.covered_items||0} / ${ev.required_items||0}</strong><span>บันไดเสียงที่ต้องครอบคลุม</span></div></div><div class="m15-reason"><strong>ทำไมจึง${ev.mastery_passed===true?'ผ่าน':'ยังไม่ผ่าน'}ขั้นนี้</strong><div>${esc(reason(ev))}</div>${m.length?`<div class="m15-missing">ยังขาด: ${m.map(keyName).map(esc).join(' · ')}</div>`:''}</div><div class="m15-skills">${skillRows(ev.skill_results)}</div>`}}
const dgx=first(dg.data);if(dgx&&body&&!body.querySelector('.m15-diag')){const place=dgx.placement_stage_name||dgx.placement_stage_code||'เส้นทางที่ระบบกำหนด';body.insertAdjacentHTML('beforeend',`<div class="m15-diag"><strong>ผลประเมินก่อนเรียนล่าสุด</strong><div>${esc(dgx.evaluated_stage_name||dgx.evaluated_stage_code||'')} · ${pct(dgx.session_overall_score)} · ${dgx.diagnostic_passed===true?'ผ่านเกณฑ์':'ควรฝึกขั้นนี้ก่อน'}</div><small>จุดเริ่มต้นหลังประเมิน: ${esc(place)}</small></div>`)}normalize()}catch(e){console.warn('M1.5 student',e)}}
async function findSession(){if(sessionId)return sessionId;if(sessionLookup)return sessionLookup;sessionLookup=(async()=>{try{const u=await auth.getUser();if(u.error||!u.data?.user)return null;const r=await practice.getOpenLearningSessions(u.data.user.id);if(r.error)return null;const rows=(r.data||[]).filter(x=>x.mode==='practice').sort((a,b)=>new Date(b.started_at)-new Date(a.started_at));sessionId=rows[0]?.id||null;return sessionId}finally{sessionLookup=null}})();return sessionLookup}
function releaseQuestion(){const o=document.getElementById('questionResultOverlay');if(o){o.classList.remove('is-visible');o.hidden=true;o.setAttribute('aria-hidden','true')}document.querySelectorAll('.session-app > .session-header,.session-app > .session-main').forEach(n=>{n.inert=false;n.removeAttribute('aria-hidden')})}
function reset(){sessionId=null;sessionLookup=null;finalizing=false;app.diagnosticFeedback?.resetSession?.({})}
function extras(){let roll=document.getElementById('m15Roll');if(!roll){roll=document.createElement('div');roll.id='m15Roll';roll.className='m15-roll';document.getElementById('loSummaryList')?.before(roll)}let actions=document.getElementById('m15Actions');if(!actions){actions=document.createElement('div');actions.id='m15Actions';actions.className='m15-actions';document.getElementById('restartSession')?.after(actions);const b=document.createElement('button');b.type='button';b.className='btn';b.id='m15Dashboard';b.textContent='กลับแดชบอร์ด';b.onclick=()=>{document.getElementById('sessionSummary').hidden=true;reset();document.getElementById('dashboardButton')?.click()};actions.appendChild(b)}return roll}
function strengths(list){const a=[...(list||[])].filter(x=>Number.isFinite(Number(x.score))).sort((x,y)=>Number(y.score)-Number(x.score));return{good:a.filter(x=>x.passed===true).slice(0,3).map(x=>skillName(x.skill_code)).join(' • ')||'ยังไม่มีด้านที่ผ่านเกณฑ์ในชุดนี้',bad:a.filter(x=>x.passed!==true).sort((x,y)=>Number(x.score)-Number(y.score)).slice(0,3).map(x=>skillName(x.skill_code)).join(' • ')||'ผ่านเกณฑ์รายด้านทุกด้านในชุดนี้'}}
function fill({title,overall,status,skills,questions}){document.getElementById('summaryTitle').textContent=title;document.getElementById('summaryOverall').textContent=pct(overall);document.getElementById('summaryMasteryStatus').innerHTML=status;const sw=strengths(skills);document.getElementById('summaryStrengths').textContent=sw.good;document.getElementById('summaryWeaknesses').textContent=sw.bad;document.getElementById('loSummaryList').innerHTML=(skills||[]).map(x=>`<div class="lo-summary-row ${x.passed===true?'strong':'weak'}"><div class="lo-summary-name"><b>${esc(x.skill_code)}</b><span>${esc(skillName(x.skill_code))} · เกณฑ์ ${pct(x.threshold)}</span></div><div class="lo-summary-bar"><i style="width:${Math.max(0,Math.min(100,Number(x.score)||0))}%"></i></div><strong>${pct(x.score)}</strong></div>`).join('');document.getElementById('questionScoreStrip').innerHTML=(questions||[]).map(q=>`<span><small>${q.question_number||''}</small><b>${pct(q.score)}</b></span>`).join('')}
function showSet(x){
  releaseQuestion();
  const roll=extras();
  if(app.diagnosticFeedback?.renderServerSession?.(x)){
    roll.innerHTML='';roll.hidden=true;
    const done=x.stage_status==='mastered'||x.mastery_passed===true;
    const restart=document.getElementById('restartSession');
    if(restart){restart.hidden=true;restart.textContent='ฝึกต่ออีก 5 ข้อ';}
    const dashboard=document.getElementById('m15Dashboard');
    if(dashboard)dashboard.textContent=done?'ไปที่แดชบอร์ดเพื่อเรียนขั้นถัดไป':'กลับแดชบอร์ด';
    document.getElementById('sessionSummary').hidden=false;
    return;
  }
  fill({title:`สรุปชุดฝึก ${SET_SIZE} ข้อ`,overall:x.session_overall_score,status:'<b>ผลชุดฝึกนี้</b><span>คะแนนส่วนนี้เป็นผลของ 5 ข้อล่าสุด ส่วนการผ่านขั้นใช้ Mastery สะสมด้านล่าง</span>',skills:x.session_skill_results,questions:x.question_scores});
  const m=Array.isArray(x.missing_item_codes)?x.missing_item_codes:[];
  roll.hidden=false;
  roll.innerHTML=`<h3>ความก้าวหน้าสะสมของขั้น</h3><div class="m15-grid"><div class="m15-stat"><strong>${pct(x.overall_score)}</strong><span>Mastery สะสม · เกณฑ์ ${pct(x.overall_threshold)}</span></div><div class="m15-stat"><strong>${x.attempts_found||0} / ${x.rolling_window||0}</strong><span>หลักฐานที่ใช้ประเมิน</span></div><div class="m15-stat"><strong>${x.covered_items||0} / ${x.required_items||0}</strong><span>Coverage บันไดเสียง</span></div></div><div class="m15-reason"><strong>สถานะปัจจุบัน</strong><div>${esc(reason(x))}</div>${m.length?`<div class="m15-missing">ยังขาด: ${m.map(keyName).map(esc).join(' · ')}</div>`:''}</div><div class="m15-skills">${skillRows(x.rolling_skill_results)}</div>`;
  const done=x.stage_status==='mastered'||x.mastery_passed===true;
  const r=document.getElementById('restartSession');r.hidden=done;r.textContent='ฝึกต่ออีก 5 ข้อ';
  document.getElementById('m15Dashboard').textContent=done?'ไปที่แดชบอร์ดเพื่อเรียนขั้นถัดไป':'กลับแดชบอร์ด';
  document.getElementById('sessionSummary').hidden=false;
  document.getElementById('m15Dashboard').focus();
}
async function finalize(){
  if(finalizing)return;
  finalizing=true;
  try{
    const id=await findSession();
    if(!id)throw new Error('ไม่พบชุดฝึกที่กำลังใช้งาน');
    const r=await repo.finalizePracticeSet({sessionId:id,expectedQuestions:SET_SIZE});
    if(r.error)throw r.error;
    const x=first(r.data);
    if(!x)throw new Error('ไม่พบผลสรุปชุดฝึก');
    showSet(x);
  }catch(e){
    console.error('M1.5 finalize',e);
    releaseQuestion();
    extras();
    const shown=app.diagnosticFeedback?.renderFallbackSessionResult?.({error:e})===true;
    if(!shown){
      const title=document.getElementById('summaryTitle');
      const overall=document.getElementById('summaryOverall');
      const status=document.getElementById('summaryMasteryStatus');
      if(title)title.textContent='Session Complete';
      if(overall)overall.textContent='—';
      if(status){status.className='summary-mastery-status';status.innerHTML='<b>แสดงผลสรุปจากฐานข้อมูลไม่ได้</b><span>คุณยังสามารถฝึกต่อหรือกลับแดชบอร์ดได้ ข้อมูลการตรวจแต่ละข้อไม่ถูกลบ</span>';}
      document.getElementById('sessionSummary').hidden=false;
    }
    finalizing=false;
  }
}
async function diagnostic(){try{const r=await repo.getLatestDiagnosticFeedback(EXERCISE_CODE);if(r.error)throw r.error;const x=first(r.data);if(!x)throw new Error('ไม่พบผลประเมิน');releaseQuestion();const roll=extras();fill({title:'ผลประเมินก่อนเรียน',overall:x.session_overall_score,status:x.diagnostic_passed===true?'<b>ผ่านเกณฑ์ของขั้นที่ประเมิน</b><span>ผลนี้ใช้กำหนดจุดเริ่มต้น ไม่ใช่การสอบผ่าน/ตก</span>':'<b>แนะนำให้เริ่มฝึกจากขั้นนี้</b><span>ผลนี้ใช้กำหนดจุดเริ่มต้น ไม่ใช่การสอบผ่าน/ตก</span>',skills:x.skill_results,questions:x.question_scores});const place=x.placement_stage_name||x.placement_stage_code||'เส้นทางที่ระบบกำหนด';roll.innerHTML=`<h3>การจัดวางหลังประเมิน</h3><div class="m15-reason"><strong>จุดเริ่มต้นที่แนะนำ: ${esc(place)}</strong><div>${esc(x.recommendation_reason_th||'ระบบได้จัดจุดเริ่มต้นจากผลประเมินและความก้าวหน้าปัจจุบัน')}</div></div>`;document.getElementById('restartSession').hidden=true;document.getElementById('m15Dashboard').textContent='ดูแผนการเรียนที่แดชบอร์ด';document.getElementById('sessionSummary').hidden=false;document.getElementById('m15Dashboard').focus()}catch(e){console.error('M1.5 diagnostic',e);document.getElementById('dashboardButton')?.click()}}
function review(){const o=document.getElementById('questionResultOverlay'),b=document.getElementById('questionResultContinue');if(!o||o.hidden||!b)return;const diag=(document.getElementById('taskText')?.textContent||'').includes('แบบประเมินก่อนเรียน');if(diag){if(!b.disabled&&(b.textContent||'').includes('ดูแผนการเรียน')){b.dataset.m15='diagnostic';b.textContent='ดูผลประเมินก่อนเรียน'}return}findSession();const count=app.diagnosticFeedback?.getQuestionCount?.() ?? (Array.isArray(app.diagnosticQuestionResults)?app.diagnosticQuestionResults.length:0);if(count>=SET_SIZE&&!b.disabled){b.dataset.m15='set';b.textContent=`ดูสรุปชุดฝึก ${SET_SIZE} ข้อ`}}
async function teacher(){const d=document.getElementById('teacherDashboard'),c=document.getElementById('teacherDashboardContent'),s=document.getElementById('teacherClassSelect');if(!d||d.hidden||!c||c.hidden||!s?.value||!repo)return;const t=++teacherToken;try{const r=await repo.getTeacherClassLearningFeedback(s.value);if(r.error||t!==teacherToken)return;const rows=Array.isArray(r.data)?r.data:[];document.querySelectorAll('.teacher-student-card').forEach(card=>{const uid=card.querySelector('.teacher-student-head .dashboard-code')?.textContent?.trim();card.querySelectorAll('.teacher-exercise-row').forEach(row=>{const code=(row.querySelector('.dashboard-code')?.textContent||'').split('·')[0].trim(),x=rows.find(z=>String(z.student_id)===uid&&z.exercise_code===code);row.querySelector('.m15-teacher')?.remove();if(!x)return;const failed=(x.skill_results||[]).filter(z=>z.passed!==true).map(z=>skillName(z.skill_code)),missing=Array.isArray(x.missing_item_codes)?x.missing_item_codes:[];row.querySelector('.teacher-exercise-main')?.insertAdjacentHTML('beforeend',`<div class="m15-teacher"><strong>ข้อมูลการเรียนล่าสุด</strong><div class="m15-teacher-grid"><span>กิจกรรมล่าสุด<br><b>${esc(dateText(x.latest_activity_at))}</b></span><span>Session / Attempt<br><b>${x.practice_session_count||0} / ${x.attempt_count||0}</b></span><span>Evidence / Coverage<br><b>${x.attempts_found||0}/${x.rolling_window||0} · ${x.covered_items||0}/${x.required_items||0}</b></span></div><div class="${failed.length||missing.length?'m15-watch':'m15-pass'}">${failed.length?`ควรติดตาม: ${esc(failed.join(', '))}`:'ทักษะที่มีข้อมูลอยู่ในเกณฑ์'}${missing.length?` · ยังขาด ${missing.map(keyName).map(esc).join(', ')}`:''}</div></div>`)})})}catch(e){console.warn('M1.5 teacher',e)}}
function schedule(){normalize();review();setTimeout(student,300);setTimeout(teacher,300)}
document.addEventListener('click',e=>{const b=e.target.closest?.('button');if(!b)return;if(b.id==='questionResultContinue'&&b.dataset.m15){e.preventDefault();e.stopImmediatePropagation();const a=b.dataset.m15;delete b.dataset.m15;a==='set'?finalize():diagnostic();return}if(b.id==='restartSession'){document.querySelectorAll('.session-app > .session-header,.session-app > .session-main').forEach(n=>{n.inert=false;n.removeAttribute('aria-hidden')});reset()}if(b.id==='dashboardButton'||b.classList.contains('dashboard-continue'))setTimeout(schedule,120)},true);
document.getElementById('teacherClassSelect')?.addEventListener('change',()=>setTimeout(teacher,400));
const observer=new MutationObserver(schedule);observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['hidden','class','disabled']});
ensureDiagnosticFeedback();styles();loadNames().finally(()=>{schedule();setTimeout(schedule,600)});
})();
