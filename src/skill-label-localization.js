(() => {
'use strict';

const app=window.MajorScaleApp=window.MajorScaleApp||{};
if(typeof document==='undefined') return;

const STORAGE_KEY='major-scale-trainer.language';
const SKILLS=Object.freeze({
  'Treble Pitch':'ระดับเสียงบนกุญแจซอล',
  'Stem Direction':'ทิศก้านโน้ต',
  'Duration Value':'ค่าความยาวตัวโน้ต',
  'Primary Beam':'การเชื่อมเขบ็ตหลัก',
  'Scale Accidental':'เครื่องหมายแปลงเสียงของบันไดเสียง'
});
const LEGACY_THAI=Object.freeze({
  'ระดับเสียงบนกุญแจซอล (Treble Pitch)':'Treble Pitch',
  'ทิศก้านโน้ต (Stem Direction)':'Stem Direction',
  'ค่าความยาวโน้ต (Duration Value)':'Duration Value',
  'ค่าความยาวตัวโน้ต (Duration Value)':'Duration Value',
  'การเชื่อมบีมหลัก (Primary Beam)':'Primary Beam',
  'การเชื่อมเขบ็ตหลัก (Primary Beam)':'Primary Beam',
  'เครื่องหมายแปลงเสียงของบันไดเสียง (Scale Accidental)':'Scale Accidental'
});
const THAI_ONLY=Object.freeze({
  'ระดับเสียงบนกุญแจซอล':'Treble Pitch',
  'ทิศก้านโน้ต':'Stem Direction',
  'ค่าความยาวโน้ต':'Duration Value',
  'ค่าความยาวตัวโน้ต':'Duration Value',
  'การเชื่อมบีมหลัก':'Primary Beam',
  'การเชื่อมเขบ็ตหลัก':'Primary Beam',
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

function englishSkill(text){
  if(SKILLS[text]) return text;
  if(LEGACY_THAI[text]) return LEGACY_THAI[text];
  if(THAI_ONLY[text]) return THAI_ONLY[text];
  if(REVERSE.has(text)) return REVERSE.get(text);
  return null;
}

function targetText(raw){
  const text=String(raw||'').trim();
  if(!text) return null;
  const english=englishSkill(text);
  if(!english) return null;
  return language()==='th' ? SKILLS[english] : english;
}

function apply(root=document){
  if(applying||!root) return;
  applying=true;
  try{
    const scopes=[];
    if(root.nodeType===Node.ELEMENT_NODE && root.matches?.('#dashboardContent,#sd2ProgressPage,#levelMasteryOverlay,#sessionSummary')) scopes.push(root);
    root.querySelectorAll?.('#dashboardContent,#sd2ProgressPage,#levelMasteryOverlay,#sessionSummary').forEach(node=>scopes.push(node));
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
    return !!target?.closest?.('#dashboardContent,#sd2ProgressPage,#levelMasteryOverlay,#sessionSummary');
  })) queue();
});
observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});

app.skillLabelLocalization=Object.freeze({apply,labels:SKILLS});
})();
