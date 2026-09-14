(() => {
'use strict';

const app=window.MajorScaleApp=window.MajorScaleApp || {};
const BADGES=Object.freeze({
  1:Object.freeze({level:1,name:'Major Scale Stage 1',tier:'Stage 1',src:'./assets/badges/major-scale-stage-1.svg'}),
  2:Object.freeze({level:2,name:'Major Scale Stage 2',tier:'Bronze',src:'./assets/badges/major-scale-stage-2.svg'}),
  3:Object.freeze({level:3,name:'Major Scale Stage 3',tier:'Silver',src:'./assets/badges/major-scale-stage-3.svg'}),
  4:Object.freeze({level:4,name:'Major Scale Mastery',tier:'Gold',src:'./assets/badges/major-scale-stage-4.svg'})
});

function ensureStyles(){
  if(document.querySelector('style[data-major-scale-badges]')) return;
  const style=document.createElement('style');
  style.setAttribute('data-major-scale-badges','true');
  style.textContent=`
    .badge-collection-card{overflow:hidden}
    .badge-collection-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .badge-collection-item{position:relative;min-width:0;padding:10px 8px 11px;border:1px solid var(--sd2-line,var(--line,#ddd));border-radius:14px;background:var(--sd2-surface,#fff);text-align:center}
    .badge-collection-image-wrap{position:relative;width:min(132px,100%);aspect-ratio:1;margin:0 auto 6px;display:grid;place-items:center}
    .badge-collection-image{display:block;width:100%;height:100%;object-fit:contain;filter:none;opacity:1;transition:filter .2s ease,opacity .2s ease,transform .2s ease}
    .badge-collection-item.is-locked .badge-collection-image{filter:grayscale(1);opacity:.22}
    .badge-collection-lock{display:none;position:absolute;inset:0;place-items:center;font-size:1.3rem;color:#667085;text-shadow:0 1px 0 #fff}
    .badge-collection-item.is-locked .badge-collection-lock{display:grid}
    .badge-collection-level{font-size:.82rem;font-weight:900;color:var(--sd2-ink,var(--text,#172033))}
    .badge-collection-tier{margin-top:2px;font-size:.69rem;color:var(--sd2-muted,var(--muted,#667085))}
    .badge-collection-state{display:inline-flex;align-items:center;justify-content:center;margin-top:6px;padding:3px 7px;border-radius:999px;font-size:.64rem;font-weight:850}
    .badge-collection-item.is-earned .badge-collection-state{background:#ecfdf3;color:#15803d}
    .badge-collection-item.is-locked .badge-collection-state{background:#f2f4f7;color:#667085}
    .badge-collection-item.is-earned:hover .badge-collection-image{transform:translateY(-2px) scale(1.025)}

    .sd2-stage-achievement{display:flex;align-items:center;gap:7px;margin-top:7px;width:max-content;max-width:100%;padding:4px 8px 4px 4px;border:1px solid #dbe9df;border-radius:999px;background:#f5fbf7;color:#15803d;font-size:.66rem;font-weight:850}
    .sd2-stage-achievement img{display:block;width:32px;height:32px;object-fit:contain;flex:0 0 auto}

    .badge-celebration{display:grid;justify-items:center;text-align:center;margin:10px 0 12px;padding:12px;border:1px solid #ead48a;border-radius:16px;background:linear-gradient(180deg,#fffdf5,#fff9df)}
    .badge-celebration-kicker{font-size:.7rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#8a6200}
    .badge-celebration-image{display:block;width:min(190px,52vw);height:auto;margin:4px auto 0;filter:drop-shadow(0 10px 15px rgba(28,28,26,.14))}
    .badge-celebration-title{margin-top:-2px;font-size:1.02rem;font-weight:950;color:#1c1c1a}
    .badge-celebration-subtitle{margin-top:3px;font-size:.77rem;line-height:1.45;color:#6f6f68}
    .badge-celebration.is-final{border-color:#e6b422;background:linear-gradient(180deg,#fffaf0,#fff1b8)}
    .badge-celebration.is-final .badge-celebration-title{font-size:1.08rem;color:#6a4b00}

    @media(max-width:720px){
      .badge-collection-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
      .badge-collection-image-wrap{width:min(118px,100%)}
      .badge-celebration-image{width:min(160px,48vw)}
    }
    @media(prefers-reduced-motion:no-preference){
      @keyframes badgeAwardPop{0%{opacity:0;transform:scale(.82)}70%{opacity:1;transform:scale(1.045)}100%{opacity:1;transform:scale(1)}}
      .summary-overlay:not([hidden]) .badge-celebration-image{animation:badgeAwardPop .65s cubic-bezier(.2,.8,.2,1) both}
    }
    @media(prefers-reduced-motion:reduce){.badge-collection-image{transition:none}}
  `;
  document.head.appendChild(style);
}

function escapeHtml(value){
  return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

function stageLevel(stage,index=0){
  const match=String(stage?.stage_code || stage?.code || '').match(/STAGE_(\d+)/i);
  if(match) return Number(match[1]);
  const ordinal=Number(stage?.ordinal ?? stage?.sequence_order ?? stage?.sequence);
  if(Number.isInteger(ordinal) && ordinal>=1 && ordinal<=4) return ordinal;
  return index+1;
}

function modelStages(){
  const model=window.__studentDashboardV2Model;
  return Array.isArray(model?.path?.stages) ? model.path.stages : [];
}

function earnedLevels(){
  const result=new Set();
  const stages=modelStages();
  if(stages.length){
    stages.forEach((stage,index)=>{
      if(stage?.stage_status==='mastered' || stage?.status==='mastered'){
        const level=stageLevel(stage,index);
        if(BADGES[level]) result.add(level);
      }
    });
    return result;
  }
  document.querySelectorAll('#sd2StageList > .sd2-stage').forEach((item,index)=>{
    if(item.classList.contains('is-mastered')) result.add(index+1);
  });
  return result;
}

function ensureCollectionSection(){
  const dashboard=document.getElementById('dashboardContent');
  if(!dashboard || !dashboard.classList.contains('sd2-dashboard')) return null;
  let section=document.getElementById('sd2BadgeCollection');
  if(section) return section;
  section=document.createElement('section');
  section.id='sd2BadgeCollection';
  section.className='sd2-card badge-collection-card';
  section.setAttribute('aria-labelledby','sd2BadgeHeading');
  section.innerHTML=`<div class="sd2-section-head"><div><div class="sd2-eyebrow">My Badges</div><h2 id="sd2BadgeHeading">รางวัลความสำเร็จ</h2></div></div><div id="sd2BadgeGrid" class="badge-collection-grid" role="list"></div>`;
  const path=document.getElementById('sd2LearningPath');
  if(path?.parentNode===dashboard) path.insertAdjacentElement('beforebegin',section);
  else dashboard.appendChild(section);
  return section;
}

function renderCollection(){
  const section=ensureCollectionSection();
  const grid=section?.querySelector('#sd2BadgeGrid');
  if(!grid) return false;
  const earned=earnedLevels();
  const signature=[1,2,3,4].map(level=>earned.has(level)?'1':'0').join('');
  if(grid.dataset.badgeSignature===signature) return true;
  grid.dataset.badgeSignature=signature;
  grid.innerHTML=[1,2,3,4].map(level=>{
    const badge=BADGES[level];
    const isEarned=earned.has(level);
    const state=isEarned?'ได้รับแล้ว':'ยังไม่ได้รับ';
    return `<article class="badge-collection-item ${isEarned?'is-earned':'is-locked'}" role="listitem" aria-label="${escapeHtml(badge.name)} ${state}"><div class="badge-collection-image-wrap"><img class="badge-collection-image" src="${badge.src}" alt="${escapeHtml(badge.name)}"><span class="badge-collection-lock" aria-hidden="true">🔒</span></div><div class="badge-collection-level">Stage ${level}</div><div class="badge-collection-tier">${escapeHtml(badge.tier)}</div><div class="badge-collection-state">${isEarned?'✓ ได้รับแล้ว':'ล็อกอยู่'}</div></article>`;
  }).join('');
  return true;
}

function renderPathBadgeThumbnails(){
  const list=document.getElementById('sd2StageList');
  if(!list) return false;
  const stages=modelStages();
  const items=[...list.querySelectorAll(':scope > .sd2-stage')];
  items.forEach((item,index)=>{
    const stage=stages[index] || null;
    const mastered=stage
      ? (stage.stage_status==='mastered' || stage.status==='mastered')
      : item.classList.contains('is-mastered');
    const existing=item.querySelector('.sd2-stage-achievement');
    if(!mastered){
      existing?.remove();
      return;
    }
    const level=stage ? stageLevel(stage,index) : index+1;
    const badge=BADGES[level];
    if(!badge) return;
    if(existing?.dataset.badgeLevel===String(level)) return;
    existing?.remove();
    const content=item.children[1] || item;
    const wrap=document.createElement('div');
    wrap.className='sd2-stage-achievement';
    wrap.dataset.badgeLevel=String(level);
    wrap.setAttribute('aria-label',`ได้รับ ${badge.name} แล้ว`);
    wrap.innerHTML=`<img src="${badge.src}" alt="" aria-hidden="true"><span>Badge Stage ${level}</span>`;
    content.appendChild(wrap);
  });
  return true;
}

function levelFromMasteryOverlay(){
  const title=document.getElementById('levelMasteryTitle')?.textContent || '';
  const match=title.match(/(?:Level|ขั้น(?:ที่)?)\s*(\d+)/i);
  const level=match ? Number(match[1]) : null;
  return BADGES[level] ? level : null;
}

function renderCelebration(){
  const overlay=document.getElementById('levelMasteryOverlay');
  if(!overlay || overlay.hidden) return false;
  const panel=overlay.querySelector('.summary-panel');
  const head=overlay.querySelector('.summary-head');
  if(!panel || !head) return false;
  const level=levelFromMasteryOverlay();
  if(!level) return false;
  const badge=BADGES[level];
  let block=document.getElementById('levelMasteryBadgeCelebration');
  if(!block){
    block=document.createElement('div');
    block.id='levelMasteryBadgeCelebration';
    head.insertAdjacentElement('afterend',block);
  }
  if(block.dataset.badgeLevel===String(level)) return true;
  block.dataset.badgeLevel=String(level);
  block.className=`badge-celebration${level===4?' is-final':''}`;
  const title=level===4?'Major Scale Mastery Completed':'ได้รับ Badge ใหม่!';
  const subtitle=level===4
    ? 'คุณผ่าน Major Scale Notation Trainer ครบทั้ง 4 Stage แล้ว'
    : `ผ่านเกณฑ์ Mastery ของ Stage ${level} แล้ว`;
  block.innerHTML=`<div class="badge-celebration-kicker">Achievement Unlocked</div><img class="badge-celebration-image" src="${badge.src}" alt="${escapeHtml(badge.name)}"><div class="badge-celebration-title">${escapeHtml(title)}</div><div class="badge-celebration-subtitle">${escapeHtml(subtitle)}</div>`;
  return true;
}

let syncTimer=0;
function syncAll(){
  ensureStyles();
  renderCollection();
  renderPathBadgeThumbnails();
  renderCelebration();
}
function scheduleSync(delay=25){
  clearTimeout(syncTimer);
  syncTimer=setTimeout(syncAll,delay);
}

function installObservers(){
  const dashboard=document.getElementById('studentDashboard');
  if(dashboard){
    new MutationObserver(()=>scheduleSync()).observe(dashboard,{childList:true,subtree:true});
  }
  const mastery=document.getElementById('levelMasteryOverlay');
  if(mastery){
    new MutationObserver(()=>scheduleSync(0)).observe(mastery,{attributes:true,attributeFilter:['hidden'],childList:true,subtree:true,characterData:true});
  }
}

function init(){
  ensureStyles();
  syncAll();
  installObservers();
  window.addEventListener('hashchange',()=>scheduleSync(0));
  window.addEventListener('major-scale-trainer-visible',()=>scheduleSync(0));
  setTimeout(syncAll,100);
  setTimeout(syncAll,350);
  setTimeout(syncAll,900);
}

app.badgeSystem=Object.freeze({BADGES,earnedLevels,renderCollection,renderPathBadgeThumbnails,renderCelebration,syncAll});
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
})();
