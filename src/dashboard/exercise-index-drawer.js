(() => {
'use strict';

const app=window.MajorScaleApp=window.MajorScaleApp || {};
const PAGE_ID='sd2ExerciseIndexPage';
const HASH=`#${PAGE_ID}`;
let observer=null;
let syncTimer=0;

function isStudentSurface(){
  const dashboard=document.getElementById('studentDashboard');
  return !!dashboard && !dashboard.hidden && !dashboard.closest('[hidden]');
}

function isIndexActive(){return window.location.hash===HASH;}

function itemMarkup(){
  return `<button type="button" class="app-nav-item" data-exercise-index-drawer="true">
    <span class="app-nav-item-icon" aria-hidden="true">☷</span>
    <span class="app-nav-item-copy"><strong>แบบฝึกทั้งหมด</strong><small>คลังแบบฝึกหัดและ Stage</small></span>
    <span class="app-nav-item-chevron" aria-hidden="true">›</span>
  </button>`;
}

function ensureItem(){
  const target=document.getElementById('appNavigationItems');
  if(!target || !isStudentSurface()) return false;
  let item=target.querySelector('[data-exercise-index-drawer]');
  if(!item){
    const profile=target.querySelector('[data-app-nav-action="profile"]');
    if(profile) profile.insertAdjacentHTML('beforebegin',itemMarkup());
    else target.insertAdjacentHTML('beforeend',itemMarkup());
    item=target.querySelector('[data-exercise-index-drawer]');
  }
  if(!item) return false;

  const active=isIndexActive();
  if(active){
    target.querySelectorAll('[aria-current="page"]').forEach(node=>{
      if(node!==item) node.removeAttribute('aria-current');
    });
    if(item.getAttribute('aria-current')!=='page') item.setAttribute('aria-current','page');
  }else if(item.hasAttribute('aria-current')){
    item.removeAttribute('aria-current');
  }
  return true;
}

function scheduleSync(delay=0){
  clearTimeout(syncTimer);
  syncTimer=setTimeout(()=>ensureItem(),delay);
}

function navigate(){
  app.navigationDrawer?.close?.();
  window.location.hash=PAGE_ID;
  requestAnimationFrame(()=>{
    app.exerciseIndex?.applyNavigation?.();
    const page=document.getElementById(PAGE_ID);
    page?.focus?.({preventScroll:true});
    page?.scrollIntoView?.({
      behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches?'auto':'smooth',
      block:'start'
    });
    scheduleSync(0);
  });
}

function installObserver(){
  const target=document.getElementById('appNavigationItems');
  if(!target || observer) return;
  observer=new MutationObserver(()=>scheduleSync(0));
  observer.observe(target,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-current']});
}

function init(){
  document.addEventListener('click',event=>{
    const item=event.target.closest?.('[data-exercise-index-drawer]');
    if(!item) return;
    event.preventDefault();
    navigate();
  });
  window.addEventListener('hashchange',()=>scheduleSync(0));

  const wait=()=>{
    ensureItem();
    installObserver();
    if(!document.getElementById('appNavigationItems')) setTimeout(wait,80);
  };
  wait();

  const dashboard=document.getElementById('studentDashboard');
  if(dashboard){
    new MutationObserver(()=>scheduleSync(0)).observe(dashboard,{attributes:true,attributeFilter:['hidden']});
  }
  setTimeout(()=>scheduleSync(0),150);
  setTimeout(()=>scheduleSync(0),500);
}

app.exerciseIndexDrawer=Object.freeze({ensureItem,navigate});
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
})();
