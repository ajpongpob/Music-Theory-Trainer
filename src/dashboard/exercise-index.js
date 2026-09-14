(() => {
'use strict';

const app=window.MajorScaleApp=window.MajorScaleApp || {};
const PAGE_ID='sd2ExerciseIndexPage';
const HASH=`#${PAGE_ID}`;
const STYLE_VERSION='20260914-exercise-index-1';

/* These are intentionally presentation-only future slots. If a real exercise
   with the same code is later registered, the registry definition wins and the
   placeholder disappears automatically. */
const FUTURE_SLOTS=Object.freeze([
  Object.freeze({
    code:'MINOR_SCALE_NOTATION',
    title:'การเขียนบันไดเสียงไมเนอร์',
    description:'พื้นที่เตรียมรองรับแบบฝึกบันไดเสียงไมเนอร์ในอนาคต',
    availability:'coming-soon'
  }),
  Object.freeze({
    code:'KEY_SIGNATURE_TRAINER',
    title:'เครื่องหมายกำหนดบันไดเสียง',
    description:'พื้นที่เตรียมรองรับการฝึก Key Signature และความสัมพันธ์ของบันไดเสียง',
    availability:'coming-soon'
  }),
  Object.freeze({
    code:'RHYTHM_METER_TRAINER',
    title:'จังหวะและอัตราจังหวะ',
    description:'พื้นที่เตรียมรองรับแบบฝึก Duration, Beat และ Meter ในอนาคต',
    availability:'coming-soon'
  })
]);

const $=id=>document.getElementById(id);
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const first=data=>Array.isArray(data)?(data[0]||null):(data||null);
const clamp=value=>Number.isFinite(Number(value))?Math.max(0,Math.min(100,Number(value))):0;

let renderTimer=0;
let lastModel=null;
const progressCache=new Map();

function ensureStyles(){
  if(document.querySelector('link[data-exercise-index-style]')) return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href=`./styles/exercise-index.css?v=${STYLE_VERSION}`;
  link.setAttribute('data-exercise-index-style','true');
  document.head.appendChild(link);
}

function ensureNav(){
  const nav=$('sd2TopNav');
  if(!nav) return null;
  let link=nav.querySelector('[data-exercise-index-nav]');
  if(link) return link;
  link=document.createElement('a');
  link.className='sd2-nav-button';
  link.href=HASH;
  link.textContent='แบบฝึกทั้งหมด';
  link.setAttribute('data-exercise-index-nav','true');
  link.setAttribute('aria-label','เปิดคลังแบบฝึกหัดทั้งหมด');
  const progress=nav.querySelector('[data-sd2-nav="progress"]');
  if(progress) progress.insertAdjacentElement('beforebegin',link);
  else nav.appendChild(link);
  app.navigationDrawer?.sync?.();
  return link;
}

function ensurePage(){
  let page=$(PAGE_ID);
  if(page) return page;
  const practice=$('sd2PracticePage');
  const progress=$('sd2ProgressPage');
  const content=$('dashboardContent');
  if(!practice && !progress && !content) return null;
  page=document.createElement('main');
  page.id=PAGE_ID;
  page.className='sd2-exercise-index-page sd2-page';
  page.hidden=true;
  page.tabIndex=-1;
  page.setAttribute('aria-labelledby','exiHeading');
  page.innerHTML=`
    <section class="exi-hero">
      <div class="exi-kicker">Exercise Index</div>
      <h1 id="exiHeading">คลังแบบฝึกหัด</h1>
      <p>รวมแบบฝึกทั้งหมดในระบบไว้ในที่เดียว เปิดแต่ละหัวข้อเพื่อดู Stage ย่อย สถานะการเรียน และเข้าสู่แบบฝึกที่พร้อมใช้งาน</p>
      <div id="exiSummary" class="exi-summary" aria-label="สรุปคลังแบบฝึกหัด"></div>
    </section>
    <section class="sd2-card" aria-labelledby="exiListHeading">
      <div class="sd2-section-head"><div><div class="sd2-eyebrow">All Exercises</div><h2 id="exiListHeading">แบบฝึกในระบบ</h2></div></div>
      <div id="exiList" class="exi-list"></div>
    </section>`;
  if(progress) progress.insertAdjacentElement('beforebegin',page);
  else if(practice) practice.insertAdjacentElement('afterend',page);
  else content.insertAdjacentElement('afterend',page);
  return page;
}

function isIndexRoute(){return window.location.hash===HASH;}

function applyNavigation(){
  const page=ensurePage();
  const link=ensureNav();
  if(!page) return;
  const active=isIndexRoute();
  if(page.hidden===active) page.hidden=!active;

  if(active){
    ['dashboardContent','sd2PracticePage','sd2ProgressPage','sd2ProfilePanel'].forEach(id=>{
      const node=$(id);
      if(node && !node.hidden) node.hidden=true;
    });
    document.querySelectorAll('#sd2TopNav a[aria-current="page"]').forEach(node=>{
      if(node!==link) node.removeAttribute('aria-current');
    });
    if(link?.getAttribute('aria-current')!=='page') link?.setAttribute('aria-current','page');
  }else{
    link?.removeAttribute('aria-current');
  }
  app.navigationDrawer?.sync?.();
}

function stageKey(stage){return `${stage?.exercise_code||''}:${stage?.stage_code||''}`;}
function model(){return window.__studentDashboardV2Model || null;}

function modelStagesByExercise(){
  const vm=model();
  const result=new Map();
  const stages=Array.isArray(vm?.path?.stages)?vm.path.stages:[];
  stages.forEach(stage=>{
    const code=String(stage?.exercise_code||'').trim().toUpperCase();
    if(!code) return;
    if(!result.has(code)) result.set(code,[]);
    result.get(code).push(stage);
  });
  return result;
}

function definitionTitle(definition){
  return definition?.name?.th || definition?.name?.en || definition?.title || definition?.code || 'แบบฝึกหัด';
}

function catalog(){
  const groups=modelStagesByExercise();
  const definitions=app.exerciseRegistry?.list?.() || [];
  const items=[];
  const seen=new Set();

  definitions.forEach(def=>{
    const code=String(def?.code||'').trim().toUpperCase();
    if(!code || seen.has(code)) return;
    seen.add(code);
    items.push({
      code,
      title:definitionTitle(def),
      description:def?.description || 'แบบฝึกที่ลงทะเบียนใน Exercise Registry',
      availability:'available',
      definition:def,
      stages:groups.get(code)||[]
    });
  });

  groups.forEach((stages,code)=>{
    if(seen.has(code)) return;
    seen.add(code);
    const row=stages[0]||{};
    items.push({
      code,
      title:row.exercise_name || code,
      description:'แบบฝึกที่มีข้อมูลอยู่ใน Learning Path ของผู้เรียน',
      availability:'available',
      definition:null,
      stages
    });
  });

  FUTURE_SLOTS.forEach(slot=>{
    if(seen.has(slot.code)) return;
    items.push({...slot,definition:null,stages:[]});
  });

  return items;
}

function currentStageMatches(stage){
  const vm=model();
  const current=vm?.currentStage || vm?.path?.current || null;
  if(!current) return false;
  const a=stage?.stage_id || `${stage?.exercise_code||''}:${stage?.stage_code||''}`;
  const b=current?.stage_id || `${current?.exercise_code||''}:${current?.stage_code||''}`;
  return a===b;
}

function exerciseState(item){
  if(item.availability==='coming-soon') return {cls:'is-coming',label:'กำลังเตรียม'};
  const stages=item.stages||[];
  if(stages.length && stages.every(stage=>stage?.stage_status==='mastered')) return {cls:'is-complete',label:'สำเร็จแล้ว'};
  if(stages.some(stage=>currentStageMatches(stage))) return {cls:'is-current',label:'กำลังเรียน'};
  return {cls:'is-available',label:'ใช้งานได้'};
}

function badgeForStage(stage,index){
  if(stage?.stage_status!=='mastered') return '';
  const code=String(stage?.exercise_code||'').toUpperCase();
  if(code!=='MAJOR_SCALE_NOTATION') return '';
  const match=String(stage?.stage_code||'').match(/STAGE_(\d+)/i);
  const level=match?Number(match[1]):index+1;
  if(level<1||level>4) return '';
  const badge=app.badgeSystem?.BADGES?.[level];
  const src=badge?.src || `./assets/badges/major-scale-stage-${level}.svg`;
  return `<img class="exi-stage-badge" src="${escapeHtml(src)}" alt="Badge Stage ${level}" title="ได้รับ Badge Stage ${level} แล้ว">`;
}

function stageState(stage){
  if(stage?.stage_status==='mastered') return {cls:'is-complete',label:'ทำแล้ว',symbol:'✓'};
  if(stage?.stage_status==='locked') return {cls:'is-locked',label:'ยังไม่ปลดล็อก',symbol:'🔒'};
  if(currentStageMatches(stage) || stage?.stage_status==='in_progress') return {cls:'is-current',label:'กำลังเรียน',symbol:String(stage?.ordinal||'•')};
  return {cls:'is-upcoming',label:'รอเรียน',symbol:String(stage?.ordinal||'•')};
}

function cachedProgress(stage){
  if(stage?.stage_status==='mastered') return 100;
  if(stage?.stage_status==='locked') return null;
  const cached=progressCache.get(stageKey(stage));
  return cached && !cached.loading ? cached.value : null;
}

function requestStageProgress(stage){
  if(stage?.stage_status==='mastered' || stage?.stage_status==='locked') return;
  const key=stageKey(stage);
  if(!key || progressCache.has(key)) return;
  const repo=app.dashboardRepository;
  if(!repo?.getStageMastery) return;
  progressCache.set(key,{loading:true,value:null});
  Promise.resolve(repo.getStageMastery({exerciseCode:stage.exercise_code,stageCode:stage.stage_code}))
    .then(response=>{
      if(response?.error) throw response.error;
      const mastery=first(response?.data);
      const total=Number(mastery?.rolling_window);
      const done=Number(mastery?.attempts_found);
      const value=Number.isFinite(total)&&total>0
        ? Math.round(clamp(Math.min(Math.max(Number.isFinite(done)?done:0,0),total)/total*100))
        : 0;
      progressCache.set(key,{loading:false,value});
    })
    .catch(()=>progressCache.set(key,{loading:false,value:0}))
    .finally(()=>scheduleRender(0));
}

function stageMarkup(stage,index){
  const state=stageState(stage);
  const progress=cachedProgress(stage);
  requestStageProgress(stage);
  const progressMarkup=Number.isFinite(progress)
    ? `<span class="exi-stage-progress"><span>${Math.round(progress)}%</span><span class="exi-stage-progress-track" aria-hidden="true"><i style="width:${Math.round(progress)}%"></i></span></span>`
    : '';
  const canLaunch=state.cls==='is-current' && stage?.exercise_code && stage?.stage_code;
  const action=canLaunch
    ? `<button type="button" class="dashboard-continue exi-stage-action" data-exercise-code="${escapeHtml(stage.exercise_code)}" data-stage-code="${escapeHtml(stage.stage_code)}" data-session-mode="practice">ฝึกต่อ</button>`
    : '';
  return `<article class="exi-stage ${state.cls}">
    <div class="exi-stage-index" aria-hidden="true">${state.symbol}</div>
    <div>
      <div class="exi-stage-title">${escapeHtml(stage?.stage_name || stage?.stage_code || `Stage ${index+1}`)}</div>
      <div class="exi-stage-meta"><span>${escapeHtml(stage?.stage_code||'')}</span><span>•</span><span>${escapeHtml(state.label)}</span>${progressMarkup}${badgeForStage(stage,index)}</div>
    </div>
    ${action}
  </article>`;
}

function exerciseMarkup(item,index){
  const state=exerciseState(item);
  const stages=item.stages||[];
  const mastered=stages.filter(stage=>stage?.stage_status==='mastered').length;
  const current=stages.some(stage=>currentStageMatches(stage));
  const open=current || (index===0 && item.availability!=='coming-soon');
  const stageContent=stages.length
    ? `<div class="exi-stage-list">${stages.map(stageMarkup).join('')}</div>`
    : `<div class="exi-coming-note">${item.availability==='coming-soon'
      ? 'โครงสร้างหน้านี้เตรียมไว้แล้ว เมื่อเพิ่ม Exercise Definition และเชื่อม Learning Path/Stage รายการระดับย่อยจะปรากฏในคลังนี้อัตโนมัติ'
      : 'แบบฝึกนี้ลงทะเบียนแล้ว แต่บัญชีผู้เรียนยังไม่มีข้อมูล Stage ใน Learning Path'}</div>`;
  const countText=stages.length?`${mastered}/${stages.length} Stage ผ่านแล้ว`:'ยังไม่มี Stage';
  return `<details class="exi-exercise" data-exercise-code="${escapeHtml(item.code)}"${open?' open':''}>
    <summary>
      <div><div class="exi-title">${escapeHtml(item.title)}</div><div class="exi-code">${escapeHtml(item.code)} · ${escapeHtml(countText)}</div></div>
      <span class="exi-state ${state.cls}">${escapeHtml(state.label)}</span>
    </summary>
    <div class="exi-body"><p class="exi-description">${escapeHtml(item.description)}</p>${stageContent}</div>
  </details>`;
}

function render(){
  ensureStyles();
  ensureNav();
  const page=ensurePage();
  const list=$('exiList');
  const summary=$('exiSummary');
  if(!page || !list || !summary) return false;

  const vm=model();
  if(vm!==lastModel){
    progressCache.clear();
    lastModel=vm;
  }
  const items=catalog();
  const available=items.filter(item=>item.availability!=='coming-soon').length;
  const coming=items.length-available;
  const completed=items.filter(item=>exerciseState(item).cls==='is-complete').length;
  summary.innerHTML=`<span class="exi-summary-chip"><strong>${items.length}</strong> หัวข้อทั้งหมด</span><span class="exi-summary-chip"><strong>${available}</strong> ใช้งานได้</span><span class="exi-summary-chip"><strong>${completed}</strong> สำเร็จแล้ว</span><span class="exi-summary-chip"><strong>${coming}</strong> เตรียมรองรับ</span>`;
  list.innerHTML=items.map(exerciseMarkup).join('');
  applyNavigation();
  return true;
}

function scheduleRender(delay=30){
  clearTimeout(renderTimer);
  renderTimer=setTimeout(render,delay);
}

function installObservers(){
  const stageList=$('sd2StageList');
  if(stageList){
    new MutationObserver(()=>scheduleRender(20)).observe(stageList,{childList:true,subtree:true});
  }
  const nav=$('sd2TopNav');
  if(nav){
    new MutationObserver(()=>{if(isIndexRoute())setTimeout(applyNavigation,0);}).observe(nav,{attributes:true,subtree:true,childList:true,attributeFilter:['aria-current']});
  }
  ['dashboardContent','sd2PracticePage','sd2ProgressPage','sd2ProfilePanel'].forEach(id=>{
    const node=$(id);
    if(node){
      new MutationObserver(()=>{if(isIndexRoute())setTimeout(applyNavigation,0);}).observe(node,{attributes:true,attributeFilter:['hidden']});
    }
  });
}

function init(){
  ensureStyles();
  ensureNav();
  ensurePage();
  render();
  installObservers();
  window.addEventListener('hashchange',()=>{setTimeout(applyNavigation,0);scheduleRender(10);});
  document.addEventListener('click',event=>{
    const link=event.target.closest?.('[data-exercise-index-nav]');
    if(!link) return;
    if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey) return;
    event.preventDefault();
    window.location.hash=PAGE_ID;
    requestAnimationFrame(()=>{
      applyNavigation();
      const page=$(PAGE_ID);
      page?.focus({preventScroll:true});
      page?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
    });
  });
  setTimeout(()=>scheduleRender(0),120);
  setTimeout(()=>scheduleRender(0),500);
}

app.exerciseIndex=Object.freeze({render,catalog,FUTURE_SLOTS,applyNavigation});
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
})();
