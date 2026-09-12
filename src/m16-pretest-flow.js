(() => {
'use strict';

const app=window.MajorScaleApp=window.MajorScaleApp||{};
const originalPractice=app.practiceRepository;
const originalMastery=app.masteryRepository;
const learning=app.learningRepository;
const dashboardRepo=app.dashboardRepository;
const auth=app.authRepository;
const client=app.supabaseClient;
const EXERCISE_CODE='MAJOR_SCALE_NOTATION';

if(!originalPractice||!originalMastery||!learning||!dashboardRepo||!client) return;

let activePretest=null;
let latestOutcome=null;
let journey=null;
let journeyLoading=false;
let lastEvaluatedKey='';
let refreshTimer=null;

const first=data=>Array.isArray(data)?(data[0]||null):(data||null);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[char]));
const stageNumber=code=>{
  const match=/^STAGE_(\d+)$/.exec(String(code||''));
  return match?Number(match[1]):null;
};
const stageLabel=code=>{
  const n=stageNumber(code);
  return n?`ขั้นที่ ${n}`:(code||'ขั้นปัจจุบัน');
};

function injectStyles(){
  if(document.getElementById('m16PretestStyle')) return;
  const style=document.createElement('style');
  style.id='m16PretestStyle';
  style.textContent=`
.m16-pretest-step{border-style:dashed!important;position:relative}.m16-pretest-step::before{content:'PRE-TEST';font-size:.58rem;letter-spacing:.08em;font-weight:800;color:#6b675d}.m16-pretest-step.m16-active{outline:2px solid rgba(64,92,164,.18);background:#f7f9ff}.m16-pretest-step.m16-done{background:#f5faf6}.m16-pretest-step.m16-wait{background:#faf9f5}.m16-pretest-mini{margin-top:8px;font-size:.75rem;line-height:1.45;color:#66645c}.m16-pretest-path{margin:8px 0 2px;padding:9px 11px;border:1px solid #ddd9cc;border-radius:11px;background:#fffdf8}.m16-pretest-path-head{display:flex;justify-content:space-between;gap:10px;align-items:center;font-size:.72rem}.m16-pretest-path-head strong{font-size:.82rem}.m16-pretest-rail{display:flex;align-items:center;gap:4px;margin:7px 0 6px;min-width:0}.m16-pretest-node{display:flex;align-items:center;gap:4px;min-width:0;white-space:nowrap;font-size:.66rem;color:#77746b}.m16-pretest-node:not(:last-child)::after{content:'';display:block;width:20px;height:2px;background:#d8d5ca;margin-left:2px}.m16-pretest-node.is-pass{color:#286443;font-weight:700}.m16-pretest-node.is-active{color:#31519a;font-weight:800}.m16-pretest-node.is-stop{color:#8d572e;font-weight:700}.m16-pretest-dot{width:16px;height:16px;border-radius:50%;display:inline-grid;place-items:center;border:1px solid currentColor;font-size:.58rem;flex:0 0 auto}.m16-pretest-progress-row{display:flex;justify-content:space-between;gap:10px;font-size:.69rem;color:#66645c}.m16-pretest-track{height:5px;border-radius:999px;background:#e7e4da;overflow:hidden;margin-top:5px}.m16-pretest-fill{height:100%;background:currentColor;color:#405ca4}.m16-pretest-message{margin-top:5px;font-size:.68rem;color:#5d5a52}.m16-pretest-message.is-stop{color:#8d572e;font-weight:700}.m16-pretest-message.is-pass{color:#286443;font-weight:700}@media(max-width:700px){.m16-pretest-path{padding:7px 8px}.m16-pretest-rail{overflow-x:auto;padding-bottom:2px}.m16-pretest-node:not(:last-child)::after{width:12px}.m16-pretest-path-head,.m16-pretest-progress-row{font-size:.64rem}}
`;
  document.head.appendChild(style);
}

async function currentUserId(){
  try{
    const result=await auth?.getUser?.();
    if(result?.error) return null;
    return result?.data?.user?.id||null;
  }catch(_error){
    return null;
  }
}

async function findOpenPretest(stageId){
  try{
    const userId=await currentUserId();
    if(!userId||!stageId) return null;
    const result=await client.from('practice_sessions')
      .select('id,exercise_id,stage_id,planned_questions,completed_questions,started_at,last_activity_at')
      .eq('user_id',userId)
      .eq('stage_id',stageId)
      .eq('mode','pretest')
      .is('completed_at',null)
      .order('started_at',{ascending:false})
      .limit(1)
      .maybeSingle();
    if(result?.error) return null;
    return result?.data||null;
  }catch(error){
    console.warn('M1.6 open pretest lookup unavailable',error);
    return null;
  }
}

async function getSessionAttempts(sessionId){
  try{
    if(!sessionId) return [];
    const result=await client.from('attempts')
      .select('question_number,item_code,score,checked_at')
      .eq('practice_session_id',sessionId)
      .order('question_number',{ascending:true});
    if(result?.error) return [];
    return result?.data||[];
  }catch(error){
    console.warn('M1.6 attempt resume lookup unavailable',error);
    return [];
  }
}

async function prepareResume(stageId,requiredRows=[]){
  const open=await findOpenPretest(stageId);
  if(!open) return {open:null,remaining:requiredRows};
  const attempts=await getSessionAttempts(open.id);
  const answered=new Set(attempts.map(row=>String(row.item_code||'').trim()).filter(Boolean));
  const offset=attempts.reduce((max,row)=>Math.max(max,Number(row.question_number)||0),0);
  activePretest={
    sessionId:open.id,
    stageId,
    offset,
    planned:Number(open.planned_questions||requiredRows.length||0),
    terminal:false,
    resumed:attempts.length>0
  };
  const remaining=(requiredRows||[]).filter(row=>!answered.has(String(row?.item_code||'').trim()));
  if(!remaining.length&&attempts.length){
    try{
      const evaluated=await learning.evaluatePretestProgress(open.id);
      if(!evaluated?.error){
        latestOutcome=first(evaluated.data);
        if(latestOutcome&&latestOutcome.decision!=='continue') activePretest.terminal=true;
      }
    }catch(error){
      console.warn('M1.6 completion recovery unavailable',error);
    }
  }
  return {open,remaining};
}

const masteryWrapper=Object.freeze({
  ...originalMastery,
  async getRequiredStageItems(stageId){
    const base=await originalMastery.getRequiredStageItems(stageId);
    if(base?.error||!Array.isArray(base?.data)) return base;
    try{
      const resume=await prepareResume(stageId,base.data);
      if(resume.open&&resume.remaining.length){
        return {data:resume.remaining,error:null};
      }
      if(resume.open&&base.data.length&&!resume.remaining.length){
        return {data:[],error:new Error('แบบประเมินขั้นนี้มีคำตอบครบแล้ว ระบบกำลังสรุปผล')};
      }
    }catch(error){
      console.warn('M1.6 resume item filter unavailable',error);
    }
    activePretest=null;
    return base;
  }
});
app.masteryRepository=masteryWrapper;

const practiceWrapper=Object.freeze({
  ...originalPractice,
  async getOpenLearningSessions(userId){
    const result=await originalPractice.getOpenLearningSessions(userId);
    if(result?.error) return result;
    return {
      data:(result?.data||[]).filter(row=>row.mode!=='pretest'),
      error:null
    };
  },
  async createPracticeSession(payload){
    if(payload?.mode!=='pretest'){
      activePretest=null;
      latestOutcome=null;
      return originalPractice.createPracticeSession(payload);
    }
    try{
      if(activePretest?.sessionId&&activePretest.stageId===payload.stage_id&&!activePretest.terminal){
        await originalPractice.updatePracticeSession(activePretest.sessionId,{last_activity_at:new Date().toISOString()});
        return {data:{id:activePretest.sessionId},error:null};
      }
      const open=await findOpenPretest(payload.stage_id);
      if(open){
        const attempts=await getSessionAttempts(open.id);
        activePretest={
          sessionId:open.id,
          stageId:payload.stage_id,
          offset:attempts.reduce((max,row)=>Math.max(max,Number(row.question_number)||0),0),
          planned:Number(open.planned_questions||payload.planned_questions||0),
          terminal:false,
          resumed:attempts.length>0
        };
        return {data:{id:open.id},error:null};
      }
    }catch(error){
      console.warn('M1.6 pretest session resume unavailable',error);
    }
    const created=await originalPractice.createPracticeSession(payload);
    if(!created?.error&&created?.data?.id){
      activePretest={
        sessionId:created.data.id,
        stageId:payload.stage_id,
        offset:0,
        planned:Number(payload.planned_questions||0),
        terminal:false,
        resumed:false
      };
      latestOutcome=null;
      lastEvaluatedKey='';
      scheduleRefresh();
    }
    return created;
  },
  async createAttempt(payload){
    const adjusted={...payload};
    if(activePretest?.sessionId===payload?.practice_session_id&&activePretest.offset>0){
      adjusted.question_number=Number(payload.question_number||0)+activePretest.offset;
    }
    return originalPractice.createAttempt(adjusted);
  },
  async updatePracticeSession(sessionId,updates){
    const adjusted={...(updates||{})};
    const isPretest=activePretest?.sessionId===sessionId;
    if(isPretest&&Object.prototype.hasOwnProperty.call(adjusted,'completed_questions')){
      adjusted.completed_questions=activePretest.offset+Number(adjusted.completed_questions||0);
    }
    if(isPretest&&activePretest.terminal&&adjusted.overall_score!=null&&latestOutcome?.overall_score!=null){
      adjusted.overall_score=latestOutcome.overall_score;
    }
    const result=await originalPractice.updatePracticeSession(sessionId,adjusted);
    if(!result?.error&&isPretest&&Object.prototype.hasOwnProperty.call(adjusted,'completed_questions')){
      try{
        const evaluated=await learning.evaluatePretestProgress(sessionId);
        if(!evaluated?.error){
          latestOutcome=first(evaluated.data);
          if(latestOutcome){
            lastEvaluatedKey=`${sessionId}:${latestOutcome.completed_questions}`;
            if(latestOutcome.decision!=='continue') activePretest.terminal=true;
          }
        }
      }catch(error){
        console.warn('M1.6 authoritative early-stop evaluation unavailable',error);
      }
      scheduleRefresh();
      setTimeout(scheduleRefresh,120);
      setTimeout(scheduleRefresh,450);
    }
    return result;
  },
  async closePracticeSession(args){
    const sessionId=args?.sessionId;
    if(activePretest?.sessionId===sessionId&&!activePretest.terminal){
      return originalPractice.updatePracticeSession(sessionId,{last_activity_at:new Date().toISOString()});
    }
    return originalPractice.closePracticeSession(args);
  }
});
app.practiceRepository=practiceWrapper;

function journeyStages(){
  return Array.isArray(journey?.stages)?journey.stages:[];
}

function currentJourneyStage(){
  const stages=journeyStages();
  const code=journey?.current_stage_code||latestOutcome?.stage_code||null;
  return stages.find(stage=>stage.stage_code===code)||stages.find(stage=>stage.diagnostic_status==='active')||null;
}

function renderDashboardPretest(){
  const dashboard=document.getElementById('studentDashboard');
  if(!dashboard||dashboard.hidden||!journey) return;
  const sections=[...dashboard.querySelectorAll('.dashboard-exercise')];
  const section=sections.find(node=>{
    const code=node.querySelector('.dashboard-code')?.textContent?.trim();
    return code===EXERCISE_CODE;
  });
  if(!section) return;
  const rail=section.querySelector('.dashboard-stage-rail');
  if(!rail) return;
  rail.querySelector('.m16-pretest-step')?.remove();

  const status=journey.pretest_status||'not_started';
  const current=currentJourneyStage();
  const passed=journeyStages().filter(stage=>stage.diagnostic_status==='passed').length;
  const total=journeyStages().length;
  const completed=Number(current?.completed_questions??journey.completed_questions??0);
  const planned=Number(current?.planned_questions??journey.planned_questions??0);
  const remaining=Math.max(0,planned-completed);
  const placement=journey.placement_stage_code?stageLabel(journey.placement_stage_code):'';
  const icon=status==='completed'?'✓':status==='in_progress'?'●':'○';
  const css=status==='completed'?'m16-done':status==='in_progress'?'m16-active':'m16-wait';
  const detail=status==='completed'
    ? `ประเมินเสร็จแล้ว${placement?` · จุดเริ่มต้น ${placement}`:''}`
    : status==='in_progress'
      ? `${current?.stage_name||stageLabel(journey.current_stage_code)} · ${completed}/${planned||current?.required_items||'—'} ข้อ${remaining?` · เหลือ ${remaining}`:''}`
      : 'เริ่มจากส่วนนี้เพื่อค้นหาจุดเริ่มต้นที่เหมาะสม';
  const step=document.createElement('div');
  step.className=`dashboard-stage m16-pretest-step ${css}`;
  step.innerHTML=`<div class="dashboard-stage-title">${icon} ประเมินก่อนเรียน</div><div class="dashboard-stage-meta">${esc(detail)}</div><div class="m16-pretest-mini">ผ่านจากการประเมินแล้ว ${passed} จาก ${total||4} ขั้น</div>`;
  rail.prepend(step);

  const recommendation=document.querySelector('#dashboardRecommendation .dashboard-recommendation-action[data-session-mode="pretest"]');
  if(recommendation){
    recommendation.textContent=status==='in_progress'?'ทำแบบประเมินต่อ →':'เริ่มประเมินก่อนเรียน →';
  }
}

function renderTrainerPath(){
  const trainer=document.getElementById('trainerApp');
  if(!trainer||trainer.hidden) return;
  const header=trainer.querySelector('.session-header');
  if(!header) return;
  let box=document.getElementById('m16PretestPath');
  const shouldShow=!!activePretest||journey?.pretest_status==='in_progress'||latestOutcome?.decision==='early_stop'||latestOutcome?.decision==='stage_passed';
  if(!shouldShow){
    box?.remove();
    return;
  }
  if(!box){
    box=document.createElement('div');
    box.id='m16PretestPath';
    box.className='m16-pretest-path';
    header.appendChild(box);
  }
  const stages=journeyStages();
  const current=currentJourneyStage();
  const currentCode=journey?.current_stage_code||current?.stage_code||latestOutcome?.stage_code||null;
  const completed=Number(current?.completed_questions??journey?.completed_questions??latestOutcome?.completed_questions??0);
  const planned=Number(current?.planned_questions??journey?.planned_questions??latestOutcome?.planned_questions??0);
  const remaining=Math.max(0,planned-completed);
  const progress=planned>0?Math.max(0,Math.min(100,completed/planned*100)):0;

  const nodes=(stages.length?stages:[1,2,3,4].map(n=>({stage_code:`STAGE_${n}`,stage_name:`ขั้นที่ ${n}`,diagnostic_status:'pending'}))).map(stage=>{
    let status=stage.diagnostic_status||'pending';
    if(stage.stage_code===currentCode&&journey?.pretest_status==='in_progress'&&status==='pending') status='active';
    const cls=status==='passed'?'is-pass':status==='active'?'is-active':status==='stopped'?'is-stop':'';
    const icon=status==='passed'?'✓':status==='active'?'●':status==='stopped'?'!':'○';
    return `<div class="m16-pretest-node ${cls}"><span class="m16-pretest-dot">${icon}</span><span>${esc(stage.stage_name||stageLabel(stage.stage_code))}</span></div>`;
  }).join('');

  let message='ทำข้อประเมินต่อเพื่อค้นหาจุดเริ่มต้นที่เหมาะสม';
  let messageClass='';
  if(latestOutcome?.decision==='early_stop'){
    message='ผลที่มีอยู่เพียงพอสำหรับจัดจุดเริ่มต้นแล้ว ไม่จำเป็นต้องทำข้อที่เหลือ';
    messageClass='is-stop';
  }else if(latestOutcome?.decision==='stage_passed'){
    message=latestOutcome.exercise_mastered===true?'ผ่านการประเมินครบทุกขั้นแล้ว':'ผ่านขั้นนี้แล้ว สามารถประเมินขั้นถัดไปต่อได้';
    messageClass='is-pass';
  }else if(latestOutcome?.can_still_pass===true){
    message='ยังสามารถผ่านขั้นนี้ได้';
    messageClass='is-pass';
  }

  box.innerHTML=`<div class="m16-pretest-path-head"><strong>ประเมินก่อนเรียน</strong><span>${esc(current?.stage_name||stageLabel(currentCode))}</span></div><div class="m16-pretest-rail">${nodes}</div><div class="m16-pretest-progress-row"><span>${completed} / ${planned||'—'} ข้อ</span><span>${remaining>0?`เหลือ ${remaining} ข้อเพื่อสรุปขั้นนี้`:'กำลังสรุปขั้นนี้'}</span></div><div class="m16-pretest-track"><div class="m16-pretest-fill" style="width:${progress}%"></div></div><div class="m16-pretest-message ${messageClass}">${esc(message)}</div>`;
}

function decorateResultButton(){
  const overlay=document.getElementById('questionResultOverlay');
  const button=document.getElementById('questionResultContinue');
  if(!overlay||overlay.hidden||!button||button.disabled||!latestOutcome) return;
  if(latestOutcome.decision==='early_stop'){
    delete button.dataset.m16NextStage;
    button.dataset.m15='diagnostic';
    button.textContent='ข้อมูลเพียงพอแล้ว · ดูจุดเริ่มต้นที่แนะนำ';
    return;
  }
  if(latestOutcome.decision==='stage_failed'){
    delete button.dataset.m16NextStage;
    button.dataset.m15='diagnostic';
    button.textContent='ดูผลประเมินและเริ่มฝึกขั้นนี้';
    return;
  }
  if(latestOutcome.decision==='stage_passed'&&latestOutcome.exercise_mastered!==true&&latestOutcome.placement_stage_code&&latestOutcome.placement_stage_code!==latestOutcome.stage_code){
    button.dataset.m16NextStage=latestOutcome.placement_stage_code;
    button.textContent=`ผ่าน${stageLabel(latestOutcome.stage_code)} ✓ · ประเมิน${stageLabel(latestOutcome.placement_stage_code)}ต่อ`;
  }
}

async function refreshJourney(){
  if(journeyLoading) return;
  journeyLoading=true;
  try{
    const result=await dashboardRepo.getPretestJourney(EXERCISE_CODE);
    if(result?.error) return;
    let next=first(result?.data);
    if(!next) return;
    const activeId=next.active_session_id;
    const completed=Number(next.completed_questions||0);
    if(activeId&&completed>0){
      const key=`${activeId}:${completed}`;
      if(key!==lastEvaluatedKey){
        lastEvaluatedKey=key;
        try{
          const evaluated=await learning.evaluatePretestProgress(activeId);
          if(!evaluated?.error){
            latestOutcome=first(evaluated.data)||latestOutcome;
            if(latestOutcome?.decision&&latestOutcome.decision!=='continue'){
              if(activePretest?.sessionId===activeId) activePretest.terminal=true;
              const reloaded=await dashboardRepo.getPretestJourney(EXERCISE_CODE);
              if(!reloaded?.error) next=first(reloaded.data)||next;
            }
          }
        }catch(error){
          console.warn('M1.6 dashboard evaluation unavailable',error);
        }
      }
    }
    journey=next;
    renderDashboardPretest();
    renderTrainerPath();
    decorateResultButton();
  }catch(error){
    console.warn('M1.6 journey unavailable',error);
  }finally{
    journeyLoading=false;
  }
}

function scheduleRefresh(){
  clearTimeout(refreshTimer);
  refreshTimer=setTimeout(()=>{
    refreshJourney();
    renderTrainerPath();
    decorateResultButton();
  },80);
}

window.addEventListener('click',event=>{
  const button=event.target.closest?.('button');
  if(!button) return;
  if(button.id==='questionResultContinue'&&button.dataset.m16NextStage){
    event.preventDefault();
    event.stopImmediatePropagation();
    const nextStage=button.dataset.m16NextStage;
    const nextLevel=stageNumber(nextStage);
    delete button.dataset.m16NextStage;
    latestOutcome=null;
    activePretest=null;
    app.m15FeedbackHardening?.clearQuestionResultOverlay?.();
    Promise.resolve(window.majorScaleTrainerStartForAuthenticatedUser?.(nextLevel,'pretest',nextStage))
      .then(()=>{
        lastEvaluatedKey='';
        setTimeout(scheduleRefresh,100);
        setTimeout(scheduleRefresh,500);
      })
      .catch(error=>{
        console.error('M1.6 next diagnostic stage failed',error);
        document.getElementById('dashboardButton')?.click();
      });
  }
},true);

document.addEventListener('click',event=>{
  const button=event.target.closest?.('button');
  if(!button) return;
  if(button.id==='dashboardButton'||button.id==='m15Dashboard'||button.classList.contains('dashboard-continue')){
    setTimeout(scheduleRefresh,180);
  }
},true);

window.addEventListener('major-scale-trainer-visible',()=>{
  setTimeout(scheduleRefresh,120);
  setTimeout(scheduleRefresh,550);
});

const observer=new MutationObserver(()=>{
  renderDashboardPretest();
  renderTrainerPath();
  decorateResultButton();
});
observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['hidden','class','disabled']});

injectStyles();
app.m16PretestFlow=Object.freeze({
  refreshJourney,
  getJourney:()=>journey,
  getLatestOutcome:()=>latestOutcome,
  getActivePretest:()=>activePretest
});
setTimeout(scheduleRefresh,120);
setTimeout(scheduleRefresh,700);
})();
