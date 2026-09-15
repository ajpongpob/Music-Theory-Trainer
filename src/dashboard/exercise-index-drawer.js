(() => {
'use strict';

const app=window.MajorScaleApp=window.MajorScaleApp || {};
const PAGE_ID='sd2ExerciseIndexPage';
const HASH=`#${PAGE_ID}`;
let observer=null;
let syncTimer=0;
let terminologyObserver=null;

function isStudentSurface(){
  const dashboard=document.getElementById('studentDashboard');
  return !!dashboard && !dashboard.hidden && !dashboard.closest('[hidden]');
}

function isIndexActive(){return window.location.hash===HASH;}

function itemMarkup(){
  return `<button type="button" class="app-nav-item" data-exercise-index-drawer="true">
    <span class="app-nav-item-icon" aria-hidden="true">☷</span>
    <span class="app-nav-item-copy"><strong>แบบฝึกทั้งหมด</strong><small>คลังแบบฝึกหัดและ Level</small></span>
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

function canonicalizeVisibleText(value){
  let text=String(value??'');
  if(!/(Stage|STAGE_|ขั้นที่|แต่ละขั้น|ทุกขั้น|ขั้นปัจจุบัน|ขั้นนี้|ขั้นถัดไป|ครบทั้ง\s*\d+\s*ขั้น)/i.test(text)) return text;
  text=text
    .replace(/\bSTAGE_(\d+)\b/g,'LEVEL_$1')
    .replace(/\bStages\b/g,'Levels')
    .replace(/\bStage\b/g,'Level')
    .replace(/ขั้นที่\s*/g,'ระดับที่ ')
    .replace(/แต่ละขั้น/g,'แต่ละระดับ')
    .replace(/ทุกขั้น/g,'ทุกระดับ')
    .replace(/ขั้นปัจจุบัน/g,'ระดับปัจจุบัน')
    .replace(/ขั้นนี้/g,'ระดับนี้')
    .replace(/ขั้นถัดไป/g,'ระดับถัดไป')
    .replace(/ครบทั้ง(\s*\d+\s*)ขั้น/g,'ครบทั้ง$1ระดับ');
  return text;
}

function shouldSkipNode(node){
  const parent=node?.parentElement;
  return !!parent?.closest?.('script,style,noscript');
}

function normalizeTextNode(node){
  if(!node || node.nodeType!==Node.TEXT_NODE || shouldSkipNode(node)) return;
  const next=canonicalizeVisibleText(node.nodeValue);
  if(next!==node.nodeValue) node.nodeValue=next;
}

function normalizeAttributes(root){
  if(!root || root.nodeType!==Node.ELEMENT_NODE) return;
  const elements=[root,...root.querySelectorAll?.('[aria-label],[title],[alt]')||[]];
  elements.forEach(element=>{
    ['aria-label','title','alt'].forEach(attribute=>{
      if(!element.hasAttribute?.(attribute)) return;
      const before=element.getAttribute(attribute);
      const after=canonicalizeVisibleText(before);
      if(after!==before) element.setAttribute(attribute,after);
    });
  });
}

function normalizeSubtree(root){
  if(!root) return;
  if(root.nodeType===Node.TEXT_NODE){normalizeTextNode(root);return;}
  if(root.nodeType!==Node.ELEMENT_NODE && root!==document) return;
  normalizeAttributes(root);
  const scope=root===document?document.body:root;
  if(!scope) return;
  if(!/(Stage|STAGE_|ขั้นที่|แต่ละขั้น|ทุกขั้น|ขั้นปัจจุบัน|ขั้นนี้|ขั้นถัดไป)/i.test(scope.textContent||'')) return;
  const walker=document.createTreeWalker(scope,NodeFilter.SHOW_TEXT);
  let node=walker.nextNode();
  while(node){normalizeTextNode(node);node=walker.nextNode();}
}

function formatKey(value){
  return String(value||'')
    .replace(/##/g,'𝄪')
    .replace(/bb/g,'𝄫')
    .replace(/#/g,'♯')
    .replace(/b/g,'♭');
}

function ensureKeyStyles(){
  if(document.querySelector('style[data-level-key-index-style]')) return;
  const style=document.createElement('style');
  style.setAttribute('data-level-key-index-style','true');
  style.textContent=`
    .exi-level-keys{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:7px}
    .exi-level-keys-label{font-size:.67rem;font-weight:850;color:var(--sd2-muted,var(--muted,#667085))}
    .exi-key-chip{display:inline-flex;align-items:center;justify-content:center;min-width:31px;min-height:25px;padding:3px 8px;border:1px solid color-mix(in srgb,var(--sd2-primary,var(--accent,#f6bd16)) 32%,var(--sd2-line,var(--line,#ddd)));border-radius:999px;background:color-mix(in srgb,var(--sd2-primary,var(--accent,#f6bd16)) 10%,#fff);color:var(--sd2-ink,var(--text,#1c1c1a));font-size:.7rem;font-weight:850;line-height:1}
    @media(max-width:699px){.exi-level-keys{grid-column:1/-1}.exi-key-chip{min-width:29px;padding-inline:7px}}
  `;
  document.head.appendChild(style);
}

function enhanceExerciseIndexKeys(){
  ensureKeyStyles();
  const config=app.majorScaleConfig;
  const levelKeys=config?.LEVEL_KEYS;
  if(!levelKeys) return false;
  const exercise=document.querySelector('#exiList .exi-exercise[data-exercise-code="MAJOR_SCALE_NOTATION"]');
  if(!exercise) return false;
  const rows=[...exercise.querySelectorAll('.exi-stage-list > .exi-stage')];
  rows.forEach((row,index)=>{
    const level=index+1;
    const keys=Array.isArray(levelKeys[level])?levelKeys[level]:[];
    if(!keys.length) return;
    const content=row.children?.[1] || row;
    let wrap=content.querySelector?.('.exi-level-keys');
    const signature=keys.join('|');
    if(wrap?.dataset.keySignature===signature) return;
    if(!wrap){
      wrap=document.createElement('div');
      wrap.className='exi-level-keys';
      content.appendChild(wrap);
    }
    wrap.dataset.keySignature=signature;
    wrap.setAttribute('aria-label',`คีย์ในระดับที่ ${level}: ${keys.map(formatKey).join(', ')}`);
    wrap.innerHTML=`<span class="exi-level-keys-label">คีย์ในระดับนี้:</span>${keys.map(key=>`<span class="exi-key-chip">${formatKey(key)}</span>`).join('')}`;
  });
  return rows.length>0;
}

function resetTrainerMasteryDisclosure(){
  const trainer=document.getElementById('trainerApp');
  const disclosure=document.getElementById('masteryProgress');
  if(!trainer || trainer.hidden || !disclosure) return false;
  if(disclosure.open) disclosure.open=false;
  return true;
}

function installLevelTerminology(){
  normalizeSubtree(document);
  enhanceExerciseIndexKeys();
  if(terminologyObserver || !document.body) return;
  terminologyObserver=new MutationObserver(mutations=>{
    let indexChanged=false;
    mutations.forEach(mutation=>{
      if(mutation.type==='characterData') normalizeTextNode(mutation.target);
      if(mutation.type==='attributes') normalizeAttributes(mutation.target);
      mutation.addedNodes?.forEach(node=>normalizeSubtree(node));
      const target=mutation.target?.nodeType===1?mutation.target:mutation.target?.parentElement;
      if(target?.closest?.('#exiList') || [...mutation.addedNodes||[]].some(node=>node.nodeType===1 && (node.id==='exiList' || node.querySelector?.('#exiList')))) indexChanged=true;
    });
    if(indexChanged) requestAnimationFrame(enhanceExerciseIndexKeys);
  });
  terminologyObserver.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','title','alt']});
}

function scheduleSync(delay=0){
  clearTimeout(syncTimer);
  syncTimer=setTimeout(()=>{
    ensureItem();
    installLevelTerminology();
    enhanceExerciseIndexKeys();
  },delay);
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
  installLevelTerminology();
  document.addEventListener('click',event=>{
    const item=event.target.closest?.('[data-exercise-index-drawer]');
    if(!item) return;
    event.preventDefault();
    navigate();
  });
  window.addEventListener('hashchange',()=>scheduleSync(0));
  window.addEventListener('major-scale-trainer-visible',()=>{
    resetTrainerMasteryDisclosure();
    scheduleSync(0);
  });

  const wait=()=>{
    ensureItem();
    installObserver();
    enhanceExerciseIndexKeys();
    if(!document.getElementById('appNavigationItems')) setTimeout(wait,80);
  };
  wait();

  const dashboard=document.getElementById('studentDashboard');
  if(dashboard){
    new MutationObserver(()=>scheduleSync(0)).observe(dashboard,{attributes:true,attributeFilter:['hidden']});
  }
  const trainer=document.getElementById('trainerApp');
  if(trainer){
    new MutationObserver(()=>{
      if(!trainer.hidden) resetTrainerMasteryDisclosure();
    }).observe(trainer,{attributes:true,attributeFilter:['hidden']});
  }
  setTimeout(()=>scheduleSync(0),150);
  setTimeout(()=>scheduleSync(0),500);
}

app.exerciseIndexDrawer=Object.freeze({ensureItem,navigate,enhanceExerciseIndexKeys,canonicalizeVisibleText,resetTrainerMasteryDisclosure});
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
})();
