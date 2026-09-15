(() => {
'use strict';

const app=window.MajorScaleApp=window.MajorScaleApp || {};
if(typeof document==='undefined') return;

const STORAGE_KEY='major-scale-trainer.language';
const ATTRS=['aria-label','title','placeholder'];
let applying=false;
let queued=false;
let observer=null;

/*
 * Final presentation guard.
 *
 * Older UI modules were created at different times and some still emit mixed
 * Thai/English copy or the retired Stage terminology. The shared i18n layer
 * remains the primary translator; this guard is the final, idempotent pass that
 * makes the selected language authoritative for visible application chrome.
 * User-entered identity data is intentionally not translated.
 */
const PAIRS=Object.freeze([
  ['ระดับที่กำลังเรียน','Current level'],
  ['ระดับปัจจุบัน','Current Level'],
  ['ความก้าวหน้าของระดับ','Level Progress'],
  ['ความก้าวหน้า / ประวัติระดับ','Level Progress / History'],
  ['สถานะและหลักฐานของแต่ละระดับ','Level status and evidence'],
  ['ยังไม่มีระดับในเส้นทางการเรียนนี้','There are no levels in this learning path yet'],
  ['ยังไม่พบระดับที่พร้อมสำหรับการฝึก','No level is currently ready for practice'],
  ['เรียนต่อจากระดับปัจจุบันตามหลักฐานการผ่านเกณฑ์ของคุณ','Continue from your current level based on your mastery evidence'],
  ['สะสมหลักฐานให้ครบเกณฑ์ของระดับ','Build enough evidence to meet the level criteria'],
  ['ตามเกณฑ์การผ่านของระดับปัจจุบัน','Based on the mastery criteria for the current level'],
  ['ไประดับถัดไป','Go to the next level'],
  ['ไม่มีระดับที่กำลังเรียน','No level is currently in progress'],
  ['ยังไม่มีระดับการเรียน','No learning levels yet'],
  ['ครบทุกระดับ','All levels completed'],
  ['ผ่านแบบฝึกหัดครบทุกระดับแล้ว','All levels of this exercise are complete'],
  ['แบบฝึกหัดนี้ผ่านครบทุกระดับแล้ว','All levels of this exercise are complete'],
  ['ยังไม่มีระดับที่ต้องแสดงผลการเรียน','There is no current level to display'],
  ['ผ่านเกณฑ์ของระดับนี้','This level meets the threshold'],
  ['ติดตามผลการเรียนรายทักษะ ระดับ และประวัติการฝึก','Review progress by skill, level, and practice history'],

  ['แบบฝึกทั้งหมด','All exercises'],
  ['คลังแบบฝึกหัด','Exercise Library'],
  ['คลังแบบฝึกหัดและระดับ','Exercise library and levels'],
  ['รวมแบบฝึกทั้งหมดในระบบไว้ในที่เดียว เปิดแต่ละหัวข้อเพื่อดูระดับย่อย สถานะการเรียน และเข้าสู่แบบฝึกที่พร้อมใช้งาน','All exercises are collected here. Open a topic to view its levels, learning status, and available practice.'],
  ['แบบฝึกในระบบ','Exercises'],
  ['หัวข้อทั้งหมด','total topics'],
  ['ใช้งานได้','available'],
  ['ยังล็อก','locked'],
  ['เตรียมรองรับ','coming soon'],
  ['กำลังเตรียม','Coming soon'],
  ['รอเรียน','Upcoming'],
  ['ยังไม่ปลดล็อก','Locked'],
  ['คีย์ในระดับนี้:','Keys in this level:'],
  ['ยังไม่มีระดับ','No levels yet'],
  ['ผ่านแล้ว','completed'],

  ['รางวัลความสำเร็จ','Achievements'],
  ['ตราความสำเร็จของฉัน','My Badges'],
  ['ได้รับแล้ว','Earned'],
  ['ยังไม่ได้รับ','Not earned yet'],
  ['ล็อกอยู่','Locked'],
  ['ได้รับตราความสำเร็จใหม่!','New badge earned!'],
  ['ปลดล็อกรางวัลแล้ว','Achievement Unlocked'],
  ['ผ่านการเขียนบันไดเสียงเมเจอร์ครบทั้ง 4 ระดับแล้ว','Major Scale Mastery Completed'],

  ['เส้นทางการเรียนรู้พื้นฐานทฤษฎีดนตรี','Music Theory Foundations'],
  ['การเขียนบันไดเสียงเมเจอร์','Major Scale Notation Trainer'],
  ['เส้นทางการเรียนรู้','Learning Path'],
  ['เส้นทางการเรียน','Learning Path'],
  ['แบบฝึกหัด','Exercise'],
  ['ความก้าวหน้า','Progress'],
  ['ข้อมูลผู้ใช้','Profile'],
  ['แดชบอร์ด','Dashboard'],
  ['แดชบอร์ดผู้เรียน','Student Dashboard'],
  ['แดชบอร์ดผู้สอน','Teacher Dashboard'],
  ['การฝึก','Practice'],
  ['ประวัติการฝึก','Session History'],
  ['การผ่านเกณฑ์','Mastery'],
  ['เกณฑ์ผ่าน','Mastery threshold'],
  ['ทักษะที่ควรเน้น','Skill Focus'],
  ['ทักษะ','Skills'],
  ['สถานะ','Status'],
  ['แนวโน้ม','Trend'],
  ['รายละเอียดการตอบ','Attempt / Detailed Review'],
  ['ดูความก้าวหน้า','View Progress'],
  ['เรียนต่อ','Continue Learning'],
  ['กิจกรรมล่าสุด','Recent Activity'],
  ['ภาพรวมทักษะ','Skill Snapshot'],
  ['รายละเอียดผลรายทักษะ','Skill Mastery Detail'],
  ['แนวโน้มการเรียน','Learning Trend'],
  ['ความก้าวหน้าการเรียนโดยรวม','Overall Learning Progress'],
  ['ทุกทักษะ','All Skills'],
  ['ควรฝึกเพิ่ม','Needs Practice'],
  ['กำลังพัฒนา','Developing'],
  ['ผ่านเกณฑ์','Mastered'],
  ['ยังไม่เริ่ม','Not started'],
  ['ปัจจุบัน','Current'],
  ['ถัดไป','Upcoming'],
  ['ดีขึ้น','Improving'],
  ['ลดลง','Declining'],
  ['คงที่','Stable'],

  ['ผลการตรวจคำตอบ','Answer Check'],
  ['ตรวจคำตอบแล้ว','Answer checked'],
  ['ดูคะแนนและข้อเสนอแนะของข้อนี้','Review the score and feedback for this question'],
  ['คำตอบของคุณ','Your answer'],
  ['กำลังบันทึกและประเมิน...','Saving and evaluating...'],
  ['สรุปผลการฝึก','Practice Summary'],
  ['สรุปผลการผ่านเกณฑ์','Mastery Summary'],
  ['ผ่านเกณฑ์แล้ว','Mastery Achieved'],
  ['เริ่มระดับถัดไป','Start next level'],
  ['เริ่มการฝึกใหม่','Start a new practice session'],
  ['จุดแข็ง','Strengths'],
  ['จุดที่ควรพัฒนา','Areas to improve'],
  ['คะแนนรายทักษะ','Skill scores'],
  ['กำลังโหลดคะแนนรายทักษะ...','Loading skill scores...'],
  ['ไม่สามารถโหลดคะแนนรายทักษะได้ในขณะนี้','Unable to load skill scores right now'],
  ['ระดับเสียงบนกุญแจซอล','Treble Pitch'],
  ['เครื่องหมายแปลงเสียง','Accidental'],
  ['เครื่องหมายแปลงเสียงของบันไดเสียง','Scale Accidental'],
  ['ค่าความยาวตัวโน้ต','Duration Value'],
  ['การเชื่อมเขบ็ตหลัก','Primary Beam'],
  ['การรวมเขบ็ต','Primary Beam'],
  ['ทิศก้านโน้ต','Stem Direction'],
  ['ชื่อระดับเสียง','Pitch Name'],

  ['ขาขึ้น–ขาลงตามรูปแบบจังหวะ โดยใส่เครื่องหมายแปลงเสียง ทิศก้านโน้ต และการเชื่อมเขบ็ตให้ถูกต้อง','Write ascending and descending according to the rhythm pattern with correct accidentals, stems, and beams'],
  ['รูปแบบจังหวะ','Rhythm Pattern'],
  ['เครื่องมือเขียนโน้ตบนมือถือ','Mobile notation tools'],
  ['เลือกหลายโน้ต','Select multiple notes'],
  ['เพิ่มตัวโน้ต','Add note'],
  ['ล้างคำตอบ','Clear answer'],
  ['ตรวจคำตอบ','Check answer'],
  ['ทำข้อต่อไป','Next question'],

  ['เครื่องมือการสอน','Teaching Tools'],
  ['เปิดแบบฝึกหัดเพื่อใช้สอน','Open an exercise for teaching'],
  ['ภาพรวมผลการเรียนของชั้นเรียน','Class Learning Overview'],
  ['ผลการเรียนรู้ภาพรวม','Overall learning results'],
  ['เส้นทางการเรียนรู้ที่มอบหมาย','Assigned Learning Paths'],
  ['ความก้าวหน้ารายบุคคล','Individual learner progress'],
  ['ภาพรวมทุกห้องเรียน','All classes overview'],
  ['เพิ่มห้องเรียน','Add class'],
  ['เพิ่มผู้เรียน','Add learner'],
  ['ค้นหาชื่อหรือห้องเรียน','Search by learner or class'],
  ['เลือกชั้นเรียน','Select class'],
  ['ชั้นเรียน','Class'],
  ['นักศึกษา','Students'],
  ['ผู้เรียน','Learner'],
  ['ผู้สอน','Teacher'],
  ['อ่านอย่างเดียว','Read-only'],

  ['โปรไฟล์ผู้เรียน','Learner Profile'],
  ['ชื่อ','First name'],
  ['นามสกุล','Last name'],
  ['ชื่อเล่น','Nickname'],
  ['รหัสนักศึกษา','Student ID'],
  ['หลักสูตร / สาขาวิชา','Program / Major'],
  ['บันทึกข้อมูล','Save profile'],
  ['ออกจากระบบ','Sign out'],
  ['รีเฟรช','Refresh'],

  ['กรุณากรอกข้อมูลให้ครบ','Please complete all required fields'],
  ['กรุณากรอกอีเมลให้ถูกต้อง','Please enter a valid email address'],
  ['กำลังสมัครสมาชิก...','Registering...'],
  ['กำลังเข้าสู่ระบบ...','Signing in...'],
  ['กำลังตรวจสอบการเข้าสู่ระบบ...','Checking sign-in status...'],
  ['กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่','Please check your connection and try again'],
  ['กรุณาลองใหม่','Please try again']
]);

const TH_TO_EN=new Map(PAIRS);
const EN_TO_TH=new Map(PAIRS.map(([th,en])=>[en,th]));

const PURE_THAI_OVERRIDES=new Map([
  ['พลังพิชิต Level','ความก้าวหน้าสู่การผ่านระดับ'],
  ['ความก้าวหน้า Level','ความก้าวหน้าของระดับ'],
  ['สรุปผล Mastery Session','สรุปผลการผ่านเกณฑ์'],
  ['ผ่านเกณฑ์ Rolling Mastery','ผ่านเกณฑ์การประเมินสะสม'],
  ['กลับ Dashboard','กลับแดชบอร์ด'],
  ['ดูคะแนนและ feedback ของข้อนี้','ดูคะแนนและข้อเสนอแนะของข้อนี้'],
  ['ขาขึ้น–ขาลงตาม Rhythm Pattern โดยใส่ accidental, stem และ beam ให้ถูกต้อง','ขาขึ้น–ขาลงตามรูปแบบจังหวะ โดยใส่เครื่องหมายแปลงเสียง ทิศก้านโน้ต และการเชื่อมเขบ็ตให้ถูกต้อง'],
  ['ข้อมูลจริงจาก Practice Sessions / Attempts','ข้อมูลจริงจากการฝึก / การตอบ'],
  ['Session นี้ยังไม่มี attempt detail ที่ระบบส่งกลับมา','การฝึกครั้งนี้ยังไม่มีรายละเอียดการตอบที่ระบบส่งกลับมา'],
  ['ไม่มี skill result รายข้อที่บันทึกไว้','ไม่มีผลรายทักษะของข้อนี้ที่บันทึกไว้'],
  ['Teacher Demo','โหมดสาธิตสำหรับผู้สอน'],
  ['Skill Mastery','ผลการผ่านเกณฑ์รายทักษะ'],
  ['My Badges','ตราความสำเร็จของฉัน'],
  ['Achievement Unlocked','ปลดล็อกรางวัลแล้ว'],
  ['New badge earned!','ได้รับตราความสำเร็จใหม่!'],
  ['Major Scale Mastery Completed','ผ่านการเขียนบันไดเสียงเมเจอร์ครบทั้ง 4 ระดับแล้ว']
]);

function language(){
  const live=app.i18n?.getLanguage?.();
  if(live==='th'||live==='en') return live;
  try{
    const saved=localStorage.getItem(STORAGE_KEY);
    if(saved==='th'||saved==='en') return saved;
  }catch(_error){}
  return document.documentElement.lang==='en'?'en':'th';
}

function preserve(raw,next){
  const source=String(raw??'');
  const lead=source.match(/^\s*/u)?.[0]||'';
  const trail=source.match(/\s*$/u)?.[0]||'';
  return `${lead}${next}${trail}`;
}

function baseTranslate(text,target){
  const translated=app.i18n?.translateText?.(text,target);
  return typeof translated==='string' ? translated.trim() : text;
}

function englishText(raw){
  const original=String(raw??'').trim();
  if(!original) return original;
  let text=baseTranslate(original,'en');
  text=TH_TO_EN.get(text) ?? TH_TO_EN.get(original) ?? text;

  text=text
    .replace(/\b(?:STAGE|LEVEL)_(\d+)\b/giu,'Level $1')
    .replace(/(?:ขั้นที่|ระดับที่)\s*(\d+|—)/gu,'Level $1')
    .replace(/\bStages\b/giu,'Levels')
    .replace(/\bStage\b/giu,'Level')
    .replace(/\bstages\b/gu,'levels')
    .replace(/\bstage\b/gu,'level')
    .replace(/ผ่าน\s*(\d+)\s*จาก\s*(\d+)\s*(?:ขั้น|ระดับ)/gu,'Completed $1 of $2 levels')
    .replace(/คีย์ในระดับนี้:/gu,'Keys in this level:')
    .replace(/ระดับนี้/gu,'this level')
    .replace(/ระดับถัดไป/gu,'next level');

  const thaiSkill={
    'ระดับเสียงบนกุญแจซอล':'Treble Pitch',
    'ชื่อระดับเสียง':'Pitch Name',
    'เครื่องหมายแปลงเสียงของบันไดเสียง':'Scale Accidental',
    'เครื่องหมายแปลงเสียง':'Accidental',
    'ค่าความยาวตัวโน้ต':'Duration Value',
    'การเชื่อมเขบ็ตหลัก':'Primary Beam',
    'การรวมเขบ็ต':'Primary Beam',
    'ทิศก้านโน้ต':'Stem Direction'
  };
  for(const [th,en] of Object.entries(thaiSkill)) text=text.replaceAll(th,en);
  return text;
}

function thaiText(raw){
  const original=String(raw??'').trim();
  if(!original) return original;
  let text=baseTranslate(original,'th');
  text=PURE_THAI_OVERRIDES.get(text) ?? PURE_THAI_OVERRIDES.get(original) ?? EN_TO_TH.get(text) ?? text;

  text=text
    .replace(/\b(?:STAGE|LEVEL)_(\d+)\b/giu,'ระดับที่ $1')
    .replace(/(?:Stage|Level)\s+(\d+|—)\s+of\s+(\d+|—)/giu,'ระดับที่ $1 จาก $2')
    .replace(/(?:Stage|Level)\s+(\d+|—)/giu,'ระดับที่ $1')
    .replace(/ขั้นที่\s*(\d+|—)/gu,'ระดับที่ $1')
    .replace(/ผ่าน\s*(\d+)\s*จาก\s*(\d+)\s*ขั้น/gu,'ผ่าน $1 จาก $2 ระดับ')
    .replace(/Completed\s*(\d+)\s+of\s*(\d+)\s+(?:stages|levels)/giu,'ผ่าน $1 จาก $2 ระดับ')
    .replace(/\bStage Progress \/ History\b/gu,'ความก้าวหน้า / ประวัติระดับ')
    .replace(/\bLevel Progress \/ History\b/gu,'ความก้าวหน้า / ประวัติระดับ')
    .replace(/\bStage Progress\b/gu,'ความก้าวหน้าของระดับ')
    .replace(/\bLevel Progress\b/gu,'ความก้าวหน้าของระดับ')
    .replace(/\bCurrent Stage\b/gu,'ระดับปัจจุบัน')
    .replace(/\bCurrent Level\b/gu,'ระดับปัจจุบัน')
    .replace(/\bStages\b/gu,'ระดับ')
    .replace(/\bLevels\b/gu,'ระดับ')
    .replace(/\bStage\b/gu,'ระดับ')
    .replace(/\bLevel\b/gu,'ระดับ')
    .replace(/\bstages\b/gu,'ระดับ')
    .replace(/\blevels\b/gu,'ระดับ')
    .replace(/\bstage\b/gu,'ระดับ')
    .replace(/\blevel\b/gu,'ระดับ')
    .replace(/ขั้น/g,'ระดับ');

  const tokenPairs=[
    [/\bLearning Path\b/gu,'เส้นทางการเรียน'],
    [/\bDashboard\b/gu,'แดชบอร์ด'],
    [/\bProfile\b/gu,'ข้อมูลผู้ใช้'],
    [/\bPractice Sessions?\b/gu,'การฝึก'],
    [/\bSession History\b/gu,'ประวัติการฝึก'],
    [/\bSessions?\b/gu,'การฝึก'],
    [/\bMastery\b/gu,'การผ่านเกณฑ์'],
    [/\bExercise(?:s)?\b/gu,'แบบฝึกหัด'],
    [/\bProgress\b/gu,'ความก้าวหน้า'],
    [/\bSkill Focus\b/gu,'ทักษะที่ควรเน้น'],
    [/\bSkills?\b/gu,'ทักษะ'],
    [/\bStatus\b/gu,'สถานะ'],
    [/\bTrend\b/gu,'แนวโน้ม'],
    [/\bAttempts?\b/gu,'การตอบ'],
    [/\bFeedback\b/giu,'ข้อเสนอแนะ'],
    [/\bBadge\b/gu,'ตราความสำเร็จ']
  ];
  for(const [pattern,replacement] of tokenPairs) text=text.replace(pattern,replacement);
  return text;
}

function translate(raw,target=language()){
  const source=String(raw??'');
  const trimmed=source.trim();
  if(!trimmed) return source;
  const next=target==='en'?englishText(trimmed):thaiText(trimmed);
  return next===trimmed?source:preserve(source,next);
}

function skip(element){
  if(!element) return true;
  if(element.closest('script,style,noscript,svg,#appLanguageControl')) return true;
  if(element.closest('#dashboardUserName,#teacherDashboardUserName,#appNavigationUserName')) return true;
  return false;
}

function applyNode(node){
  if(!node) return;
  if(node.nodeType===Node.TEXT_NODE){
    const parent=node.parentElement;
    if(skip(parent)) return;
    const next=translate(node.nodeValue);
    if(next!==node.nodeValue) node.nodeValue=next;
    return;
  }
  if(node.nodeType!==Node.ELEMENT_NODE) return;
  if(skip(node)) return;
  for(const attr of ATTRS){
    if(!node.hasAttribute(attr)) continue;
    const before=node.getAttribute(attr);
    const after=translate(before);
    if(after!==before) node.setAttribute(attr,after);
  }
}

function apply(root=document.body||document.documentElement){
  if(applying||!root) return;
  applying=true;
  try{
    document.documentElement.lang=language();
    if(root.nodeType===Node.TEXT_NODE){applyNode(root);return;}
    applyNode(root);
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
    let node=walker.nextNode();
    while(node){applyNode(node);node=walker.nextNode();}
  }finally{
    applying=false;
  }
}

function queue(){
  if(queued) return;
  queued=true;
  requestAnimationFrame(()=>{
    queued=false;
    apply();
  });
}

function audit(root=document.body){
  const lang=language();
  const leaks=[];
  if(!root) return leaks;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  let node=walker.nextNode();
  while(node){
    const parent=node.parentElement;
    const value=node.nodeValue?.trim()||'';
    if(value && !skip(parent)){
      if(lang==='en' && /(?:ระดับที่|ขั้นที่|ความก้าวหน้า|แบบฝึกหัด|เข้าสู่ระบบ|ออกจากระบบ)/u.test(value)) leaks.push(value);
      if(lang==='th' && /\b(?:Stage|Stages|Level\s*\d|Dashboard|Profile|Practice Session|Session History)\b/u.test(value)) leaks.push(value);
    }
    node=walker.nextNode();
  }
  return [...new Set(leaks)];
}

function start(){
  apply();
  ['major-scale:languagechange','major-scale-trainer-visible','major-scale-question-result','hashchange','pageshow'].forEach(event=>window.addEventListener(event,queue));
  observer=new MutationObserver(mutations=>{
    if(applying) return;
    if(mutations.some(mutation=>{
      const target=mutation.target?.nodeType===Node.ELEMENT_NODE?mutation.target:mutation.target?.parentElement;
      return !target?.closest?.('#appLanguageControl');
    })) queue();
  });
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','aria-label','title','placeholder']});
}

app.i18nModeConsistency=Object.freeze({translateText:translate,apply,audit});
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
})();
