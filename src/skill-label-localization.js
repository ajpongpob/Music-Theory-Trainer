(() => {
'use strict';

const app=window.MajorScaleApp=window.MajorScaleApp||{};
if(typeof document==='undefined') return;

const STORAGE_KEY='major-scale-trainer.language';
const SKILLS=Object.freeze({
  'Treble Pitch':'ระดับเสียงบนกุญแจซอล (Treble Pitch)',
  'Stem Direction':'ทิศก้านโน้ต (Stem Direction)',
  'Duration Value':'ค่าความยาวโน้ต (Duration Value)',
  'Primary Beam':'การเชื่อมบีมหลัก (Primary Beam)',
  'Scale Accidental':'เครื่องหมายแปลงเสียงของบันไดเสียง (Scale Accidental)'
});
const THAI_ONLY=Object.freeze({
  'ระดับเสียงบนกุญแจซอล':'Treble Pitch',
  'ทิศก้านโน้ต':'Stem Direction',
  'ค่าความยาวโน้ต':'Duration Value',
  'การเชื่อมบีมหลัก':'Primary Beam',
  'เครื่องหมายแปลงเสียงของบันไดเสียง':'Scale Accidental'
});
const REVERSE=new Map(Object.entries(SKILLS).map(([en,th])=>[th,en]));
let applying=false,queued=false;

function language(){
  const live=app.i18n?.getLanguage?.();
  if(live==='th'||live==='en') return live;
  try{
    const stored=localStorage.getItem(STORAGE_KEY);
    return stored==='en'?'en':'th';
  }catch(_error){
    return 'th';
  }
}

function targetText(raw){
  const text=String(raw||'').trim();
  if(!text) return null;
  const lang=language();
  if(lang==='th'){
    if(SKILLS[text]) return SKILLS[text];
    const english=THAI_ONLY[text];
    if(english) return SKILLS[english];
    return null;
  }
  if(REVERSE.has(text)) return REVERSE.get(text);
  if(THAI_ONLY[text]) return THAI_ONLY[text];
  return null;
}

function apply(root=document){
  if(applying||!root) return;
  applying=true;
  try{
    const scopes=[];
    if(root.nodeType===Node.ELEMENT_NODE && root.matches?.('#dashboardContent,#sd2ProgressPage')) scopes.push(root);
    root.querySelectorAll?.('#dashboardContent,#sd2ProgressPage').forEach(node=>scopes.push(node));
    for(const scope of scopes){
      const walker=document.createTreeWalker(scope,NodeFilter.SHOW_TEXT);
      let node=walker.nextNode();
      while(node){
        const replacement=targetText(node.nodeValue);
        if(replacement){
          const leading=node.nodeValue.match(/^\s*/)?.[0]||'';
          const trailing=node.nodeValue.match(/\s*$/)?.[0]||'';
          node.nodeValue=`${leading}${replacement}${trailing}`;
        }
        node=walker.nextNode();
      }
      scope.querySelectorAll('[aria-label],[title]').forEach(element=>{
        for(const attr of ['aria-label','title']){
          if(!element.hasAttribute(attr)) continue;
          const replacement=targetText(element.getAttribute(attr));
          if(replacement) element.setAttribute(attr,replacement);
        }
      });
    }
  }finally{
    applying=false;
  }
}

function queue(){
  if(queued) return;
  queued=true;
  requestAnimationFrame(()=>{
    queued=false;
    apply(document);
  });
}

window.addEventListener('major-scale:languagechange',queue);
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',queue,{once:true});
else queue();

const observer=new MutationObserver(mutations=>{
  if(applying) return;
  if(mutations.some(mutation=>{
    const target=mutation.target?.nodeType===Node.ELEMENT_NODE?mutation.target:mutation.target?.parentElement;
    return !!target?.closest?.('#dashboardContent,#sd2ProgressPage');
  })) queue();
});
observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});

app.skillLabelLocalization=Object.freeze({apply,labels:SKILLS});
})();
