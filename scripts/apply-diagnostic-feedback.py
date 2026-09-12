from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]

def replace_once(text,old,new,label):
    count=text.count(old)
    if count!=1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    return text.replace(old,new,1)

trainer_path=ROOT/'src/trainer.js'
trainer=trainer_path.read_text(encoding='utf-8')

question_block=r'''function questionFeedback(result){
  const questionResult=buildQuestionResult(result);
  return renderQuestionFeedback(questionResult);
}'''

question_helpers=r'''const QUESTION_RESULT_SKILL_ORDER=[
  "BN01_TREBLE_PITCH",
  "BN06_STEM_DIRECTION",
  "RH01_DURATION_VALUE",
  "GR02_PRIMARY_BEAM",
  "MS03_SCALE_ACCIDENTAL"
];
const QUESTION_ERROR_PRIORITY=[
  "BN01_TREBLE_PITCH",
  "MS03_SCALE_ACCIDENTAL",
  "RH01_DURATION_VALUE",
  "GR02_PRIMARY_BEAM",
  "BN06_STEM_DIRECTION"
];

function feedbackEscapeHtml(value){
  return String(value??"").replace(/[&<>"']/g,char=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[char]));
}
function feedbackSkillName(code){
  return LO_META[code]?.short || code;
}
function feedbackKeyLabel(name){
  return String(name||state.key?.tonic||"Major Scale")
    .replace(/##/g,"𝄪").replace(/bb/g,"𝄫").replace(/#/g,"♯").replace(/b/g,"♭")
    .replace(/major/ig,"Major");
}
function feedbackAccidental(value){
  return ({"#":"♯","b":"♭","##":"𝄪","bb":"𝄫","":""})[value||""] ?? String(value||"");
}
function feedbackRhythm(value){
  return ({whole:"whole note",half:"half note",quarter:"quarter note",eighth:"eighth note",sixteenth:"sixteenth note"})[value] || String(value||"ไม่พบค่า");
}
function buildQuestionDiagnosticErrors(result){
  const labels=feedbackUnitLabels();
  const expected=Array.isArray(result?.expected)?result.expected:[];
  const actual=state.notes;
  const errors=[];
  const add=(skillCode,index,message,positions=[])=>errors.push({
    skillCode,
    unitIndex:index,
    unitLabel:labels[skillCode]?.[index]||`หน่วย ${index+1}`,
    message,
    positions
  });

  const pitch=result?.lo?.BN01_TREBLE_PITCH;
  pitch?.flags?.forEach((flag,index)=>{
    if(flag!==false)return;
    const want=expected[index]?.letter||"—",got=actual[index]?.letter||"ไม่พบโน้ต";
    add("BN01_TREBLE_PITCH",index,`โน้ตตำแหน่ง ${index+1}: ควรเป็น ${want} แต่เขียน ${got}`,[index+1]);
  });

  const stem=result?.lo?.BN06_STEM_DIRECTION;
  stem?.flags?.forEach((flag,index)=>{
    if(flag!==false)return;
    const unit=labels.BN06_STEM_DIRECTION[index]||`หน่วย ${index+1}`;
    add("BN06_STEM_DIRECTION",index,`${unit}: ทิศทางก้านไม่ตรงตามเกณฑ์ของตำแหน่งโน้ตที่เขียน`,[]);
  });

  const rhythm=result?.lo?.RH01_DURATION_VALUE;
  rhythm?.flags?.forEach((flag,index)=>{
    if(flag!==false)return;
    const want=feedbackRhythm(expected[index]?.rhythm),got=feedbackRhythm(actual[index]?.rhythm);
    add("RH01_DURATION_VALUE",index,`โน้ตตำแหน่ง ${index+1}: ควรเป็น ${want} แต่เป็น ${got}`,[index+1]);
  });

  const beam=result?.lo?.GR02_PRIMARY_BEAM;
  beam?.flags?.forEach((flag,index)=>{
    if(flag!==false)return;
    const unit=labels.GR02_PRIMARY_BEAM[index]||`Beam หน่วย ${index+1}`;
    const message=index<4
      ? `${unit}: ควรรวบ Beam เป็นกลุ่มเดียวกันตาม rhythmic pattern`
      : `${unit}: มี Beam เกินหรือจัดกลุ่มไม่ตรงกับ rhythmic pattern ที่กำหนด`;
    add("GR02_PRIMARY_BEAM",index,message,[]);
  });

  const accidental=result?.lo?.MS03_SCALE_ACCIDENTAL;
  accidental?.flags?.forEach((flag,index)=>{
    if(flag!==false)return;
    const note=expected[index],written=actual[index];
    const expectedAcc=note?.accidental||"",actualAcc=written?.accidental||"";
    const expectedText=expectedAcc
      ? `${note?.letter||""}${feedbackAccidental(expectedAcc)}`
      : `${note?.letter||""} โดยไม่มีเครื่องหมายแปลงเสียง`;
    const actualText=actualAcc?`${written?.letter||note?.letter||""}${feedbackAccidental(actualAcc)}`:"ไม่มีเครื่องหมายแปลงเสียง";
    add("MS03_SCALE_ACCIDENTAL",index,`โน้ตตำแหน่ง ${index+1}: ควรเป็น ${expectedText}; พบ ${actualText}`,[index+1]);
  });

  return errors.sort((a,b)=>
    QUESTION_ERROR_PRIORITY.indexOf(a.skillCode)-QUESTION_ERROR_PRIORITY.indexOf(b.skillCode) ||
    a.unitIndex-b.unitIndex
  );
}

function buildQuestionResult(result){
  const skills=QUESTION_RESULT_SKILL_ORDER.map(skillCode=>{
    const evidence=result?.lo?.[skillCode]||{};
    const total=Number(evidence.total||0),correct=Number(evidence.correct||0);
    const score=evidence.score===null||evidence.score===undefined?null:Number(evidence.score);
    return{
      skillCode,
      label:feedbackSkillName(skillCode),
      score,
      correct,
      total,
      threshold:MASTERY_CRITERIA.perLO[skillCode]??null,
      status:score===null?"not-assessed":(total>0&&correct===total?"correct":"incorrect")
    };
  });
  return{
    questionNumber:state.questionIndex+1,
    itemCode:state.key?.tonic||"",
    keyLabel:feedbackKeyLabel(state.key?.name||state.key?.tonic),
    score:Number(result?.score),
    skills,
    errors:buildQuestionDiagnosticErrors(result),
    checkedAt:new Date().toISOString()
  };
}

function renderQuestionFeedback(questionResult){
  const skillRows=questionResult.skills.map(skill=>{
    const correct=skill.status==="correct";
    const notAssessed=skill.status==="not-assessed";
    const icon=notAssessed?"—":correct?"✓":"✕";
    const text=notAssessed?"Not assessed":correct?"Correct":"Needs review";
    return `<div class="df-question-skill ${correct?'is-correct':'is-review'}" role="listitem"><span class="df-icon" aria-hidden="true">${icon}</span><div><strong>${feedbackEscapeHtml(skill.label)}</strong><small>${feedbackEscapeHtml(skill.skillCode)}${skill.score===null?'':` · ${skill.score}%`}</small></div><span class="df-result-text">${text}</span></div>`;
  }).join("");

  const bySkill=new Map();
  questionResult.errors.forEach(error=>{
    if(!bySkill.has(error.skillCode))bySkill.set(error.skillCode,[]);
    bySkill.get(error.skillCode).push(error);
  });
  const important=[...bySkill.entries()]
    .sort((a,b)=>QUESTION_ERROR_PRIORITY.indexOf(a[0])-QUESTION_ERROR_PRIORITY.indexOf(b[0]))
    .slice(0,3);
  const diagnostic=important.length
    ? `<div class="df-question-diagnostic"><h3>จุดที่ควรแก้ก่อน</h3>${important.map(([skillCode,errors])=>`<div class="df-diagnostic-item"><strong>${feedbackEscapeHtml(feedbackSkillName(skillCode))}</strong><span>${feedbackEscapeHtml(errors[0].message)}${errors.length>1?` · และอีก ${errors.length-1} จุด`:''}</span></div>`).join("")}</div>`
    : `<div class="df-question-good"><span aria-hidden="true">✓</span> ไม่พบข้อผิดพลาดในเกณฑ์ที่ประเมิน</div>`;

  const questionScores=state.sessionResults.map((item,i)=>
    `<span class="feedback-qscore ${i===state.questionIndex?'current':''}"><small>ข้อ ${i+1}</small><b>${item.score}%</b></span>`
  ).join("");

  return `<div class="df-question-skills" role="list" aria-label="ผลรายทักษะของข้อนี้">${skillRows}</div>${diagnostic}<div class="feedback-history"><b>คะแนนรายข้อ</b><div class="feedback-question-strip">${questionScores}</div></div>`;
}

function questionFeedback(result){
  return renderQuestionFeedback(buildQuestionResult(result));
}

function publishQuestionResult(questionResult){
  const app=window.MajorScaleApp=window.MajorScaleApp||{};
  app.lastQuestionResult=questionResult;
  app.diagnosticQuestionResults=state.sessionResults.map(item=>item.diagnostic).filter(Boolean);
  if(typeof window.dispatchEvent==="function"&&typeof window.CustomEvent==="function"){
    window.dispatchEvent(new CustomEvent("major-scale-question-result",{detail:questionResult}));
  }
}

function publishDiagnosticSessionStart(detail){
  const app=window.MajorScaleApp=window.MajorScaleApp||{};
  app.lastDiagnosticSessionStart={...(detail||{})};
  app.diagnosticQuestionResults=[];
  if(typeof window.dispatchEvent==="function"&&typeof window.CustomEvent==="function"){
    window.dispatchEvent(new CustomEvent("major-scale-session-start",{detail:app.lastDiagnosticSessionStart}));
  }
}'''

pattern=r'function questionFeedback\(result\)\{.*?\n\}\n\nfunction resetQuestionWorkspace\(\)\{'
replacement=question_helpers+'\n\nfunction resetQuestionWorkspace(){'
trainer,new_count=re.subn(pattern,replacement,trainer,count=1,flags=re.S)
if new_count!=1:
    raise SystemExit(f'trainer questionFeedback block: expected 1 replacement, got {new_count}')

trainer=replace_once(
    trainer,
    'function showQuestionResultTransition(result){',
    'function showQuestionResultTransition(result,questionResult=buildQuestionResult(result)){',
    'showQuestionResultTransition signature'
)
old_title='''  title.textContent=passed ? "ผ่านข้อนี้แล้ว ✓" : "ตรวจคำตอบแล้ว";
  subtitle.textContent=passed
    ? "เยี่ยมมาก ตรวจสอบรายละเอียดคะแนนและ feedback ก่อนทำข้อต่อไป"
    : "ตรวจสอบ feedback เพื่อดูจุดที่ควรพัฒนาก่อนทำข้อต่อไป";
  score.textContent=`${result.score}%`;
  feedback.innerHTML=questionFeedback(result);'''
new_title='''  title.textContent=`ข้อ ${questionResult.questionNumber} — ${questionResult.keyLabel}`;
  subtitle.textContent=passed
    ? "✓ ทำได้ดี ตรวจผลรายทักษะก่อนทำข้อต่อไป"
    : "Diagnostic Feedback แสดงทักษะที่ถูกต้องและจุดที่ควรแก้ก่อน";
  score.textContent=`${result.score}%`;
  feedback.innerHTML=renderQuestionFeedback(questionResult);'''
trainer=replace_once(trainer,old_title,new_title,'question result heading')
old_tail='''  requestAnimationFrame(()=>{
    overlay.classList.add("is-visible");
    panel.focus({preventScroll:true});
  });
}'''
new_tail='''  requestAnimationFrame(()=>{
    overlay.classList.add("is-visible");
    panel.focus({preventScroll:true});
  });
  return questionResult;
}'''
trainer=replace_once(trainer,old_tail,new_tail,'question result return')
trainer=replace_once(
    trainer,
    '    const attemptResponseJson=snapshotAttemptResponse();\n\n    state.sessionResults.push({',
    '    const attemptResponseJson=snapshotAttemptResponse();\n    const questionResult=buildQuestionResult(result);\n\n    state.sessionResults.push({',
    'question result build before session push'
)
trainer=replace_once(
    trainer,
    '      score:result.score,\n      lo:result.lo\n    });',
    '      score:result.score,\n      lo:result.lo,\n      diagnostic:questionResult\n    });',
    'session result diagnostic payload'
)
trainer=replace_once(
    trainer,
    '    showQuestionResultTransition(result);',
    '    showQuestionResultTransition(result,questionResult);\n    publishQuestionResult(questionResult);',
    'publish question result event'
)
trainer=replace_once(
    trainer,
    '  state.isTransitioning=false;\n\n  const overlay=document.getElementById("sessionSummary");',
    '  state.isTransitioning=false;\n\n  publishDiagnosticSessionStart({\n    generation,\n    sessionMode:state.sessionMode,\n    level:state.level,\n    stageCode:state.authoritativeStageCode || `STAGE_${state.level}`,\n    exerciseCode:majorScaleConfig.exerciseCode,\n    plannedQuestions:state.sessionMode==="pretest" ? state.sessionLength : 5\n  });\n\n  const overlay=document.getElementById("sessionSummary");',
    'session diagnostic reset event'
)
trainer_path.write_text(trainer,encoding='utf-8')

m15_path=ROOT/'src/m15-learning-feedback.js'
m15=m15_path.read_text(encoding='utf-8')
insert_after="const keyName=c=>c?`${String(c).replace(/##/g,'𝄪').replace(/bb/g,'𝄫').replace(/#/g,'♯').replace(/b/g,'♭')} Major`:'—';\n"
loader=r'''function ensureDiagnosticFeedback(){
  if(app.diagnosticFeedback || document.querySelector('script[data-diagnostic-feedback]')) return;
  const script=document.createElement('script');
  script.src='./src/diagnostic-feedback.js?v=20260913-diagnostic-feedback-v1';
  script.setAttribute('data-diagnostic-feedback','true');
  script.addEventListener('error',()=>console.warn('DIAGNOSTIC FEEDBACK MODULE FAILED TO LOAD'),{once:true});
  document.body.appendChild(script);
}
'''
m15=replace_once(m15,insert_after,insert_after+loader,'m15 diagnostic loader')
m15=replace_once(m15,'function reset(){sessionId=null;sessionLookup=null;finalizing=false}','function reset(){sessionId=null;sessionLookup=null;finalizing=false;app.diagnosticFeedback?.resetSession?.({})}','m15 reset')

show_pattern=r'function showSet\(x\)\{.*?\nasync function finalize\(\)\{'
show_replacement=r'''function showSet(x){
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
async function finalize(){'''
m15,new_count=re.subn(show_pattern,show_replacement,m15,count=1,flags=re.S)
if new_count!=1:raise SystemExit(f'm15 showSet replacement {new_count}')

finalize_pattern=r'async function finalize\(\)\{.*?\nasync function diagnostic\(\)\{'
finalize_replacement=r'''async function finalize(){
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
async function diagnostic(){'''
m15,new_count=re.subn(finalize_pattern,finalize_replacement,m15,count=1,flags=re.S)
if new_count!=1:raise SystemExit(f'm15 finalize replacement {new_count}')

old_review="const count=document.querySelectorAll('#questionResultFeedback .feedback-qscore').length;if(count>=SET_SIZE&&!b.disabled){"
new_review="const count=app.diagnosticFeedback?.getQuestionCount?.() ?? (Array.isArray(app.diagnosticQuestionResults)?app.diagnosticQuestionResults.length:0);if(count>=SET_SIZE&&!b.disabled){"
m15=replace_once(m15,old_review,new_review,'m15 structured question count')
m15=replace_once(m15,'styles();loadNames().finally(()=>{schedule();setTimeout(schedule,600)});','ensureDiagnosticFeedback();styles();loadNames().finally(()=>{schedule();setTimeout(schedule,600)});','m15 load diagnostic module')
m15_path.write_text(m15,encoding='utf-8')

# Fix an undeclared-document guard in the new presentation module.
df_path=ROOT/'src/diagnostic-feedback.js'
df=df_path.read_text(encoding='utf-8')
df=replace_once(df,"  document?.getElementById?.('diagnosticSessionResult')?.remove?.();","  if(typeof document!=='undefined') document.getElementById('diagnosticSessionResult')?.remove();",'diagnostic reset document guard')
df_path.write_text(df,encoding='utf-8')

print('Diagnostic feedback patches applied successfully')
