(() => {
'use strict';

const app=window.MajorScaleApp=window.MajorScaleApp || {};
const STORAGE_KEY='major-scale-trainer.language';
const SUPPORTED=new Set(['th','en']);
const DEFAULT_LANGUAGE='th';

/*
 * UI language pairs only. Domain/user data (student names, program names,
 * exercise/stage names returned from the database) are intentionally left as
 * stored. Keeping those values separate prevents the language layer from
 * inventing translated learning evidence.
 */
const PAIRS=[
  ['เข้าสู่ระบบก่อนเริ่มทำแบบฝึกหัด','Sign in before starting the exercises'],
  ['เข้าสู่ระบบ','Sign in'],
  ['อีเมล','Email'],
  ['รหัสผ่าน','Password'],
  ['ลืมรหัสผ่าน?','Forgot password?'],
  ['ยังไม่มีบัญชี? สมัครสมาชิก','No account yet? Register'],
  ['สร้างบัญชีเพื่อเข้าใช้แบบฝึกหัด','Create an account to use the exercises'],
  ['สมัครสมาชิก','Register'],
  ['ชื่อ-นามสกุล','Full name'],
  ['มีบัญชีอยู่แล้ว? เข้าสู่ระบบ','Already have an account? Sign in'],
  ['รับลิงก์สำหรับตั้งรหัสผ่านใหม่ทางอีเมล','Receive a password reset link by email'],
  ['ลืมรหัสผ่าน','Forgot password'],
  ['กรอกอีเมลที่ใช้สมัคร ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้คุณ','Enter the email used to register and we will send you a password reset link.'],
  ['ส่งลิงก์ตั้งรหัสผ่านใหม่','Send password reset link'],
  ['กลับไปเข้าสู่ระบบ','Back to sign in'],
  ['กำหนดรหัสผ่านใหม่สำหรับบัญชีของคุณ','Set a new password for your account'],
  ['ตั้งรหัสผ่านใหม่','Set new password'],
  ['กรอกรหัสผ่านใหม่สองครั้งให้ตรงกัน จากนั้นกดบันทึก','Enter the same new password twice, then save.'],
  ['รหัสผ่านใหม่','New password'],
  ['ยืนยันรหัสผ่านใหม่','Confirm new password'],
  ['กรอกรหัสผ่านใหม่อีกครั้ง','Enter the new password again'],
  ['บันทึกรหัสผ่านใหม่','Save new password'],
  ['ยกเลิกและกลับไปเข้าสู่ระบบ','Cancel and return to sign in'],
  ['เข้าสู่ระบบด้วย Google','Sign in with Google'],
  ['สมัครหรือเข้าสู่ระบบด้วย Google','Register or sign in with Google'],
  ['หรือ','or'],
  ['ตั้งค่าโปรไฟล์ผู้เรียนก่อนเริ่มใช้งาน','Set up your learner profile before continuing'],
  ['ข้อมูลโปรไฟล์','Profile information'],
  ['กรอกข้อมูลพื้นฐานเพื่อให้ระบบระบุตัวผู้เรียนและใช้แสดงผลใน Dashboard ของผู้เรียนและผู้สอนได้ถูกต้อง','Enter basic information so the system can identify the learner and display the correct information on learner and teacher dashboards.'],
  ['บัญชี:','Account:'],
  ['เข้าสู่ระบบด้วย:','Signed in with:'],
  ['ชื่อ *','First name *'],
  ['นามสกุล *','Last name *'],
  ['ชื่อเล่น','Nickname'],
  ['ชื่อที่ต้องการให้แสดง','Display name'],
  ['รหัสนักศึกษา *','Student ID *'],
  ['รหัสนักศึกษา','Student ID'],
  ['หลักสูตร / สาขาวิชา *','Program / Major *'],
  ['หลักสูตร / สาขาวิชา','Program / Major'],
  ['ชั้นปี *','Year level *'],
  ['เลือกชั้นปี','Select year level'],
  ['บัณฑิตศึกษา','Graduate'],
  ['อื่น ๆ','Other'],
  ['หมู่เรียน / Section','Class group / Section'],
  ['ถ้ามี','If applicable'],
  ['* จำเป็นต้องกรอกให้ครบก่อนเข้าสู่ระบบครั้งแรก ข้อมูลนี้แก้ไขภายหลังได้จากเมนู Profile','* Required before first use. You can edit this information later from Profile.'],
  ['บันทึกและเริ่มใช้งาน','Save and continue'],
  ['บันทึกข้อมูล','Save profile'],
  ['กำลังบันทึก…','Saving…'],
  ['ยกเลิก','Cancel'],
  ['ออกจากระบบ','Sign out'],
  ['รีเฟรช','Refresh'],

  ['แดชบอร์ดผู้เรียน','Student Dashboard'],
  ['ความก้าวหน้าการเรียนของคุณ','Your Learning Progress'],
  ['เรียนต่อจากจุดล่าสุดและติดตามความก้าวหน้าในแต่ละขั้น','Continue from your latest point and track progress at each stage.'],
  ['ผู้เรียน','Learner'],
  ['กำลังโหลดความก้าวหน้า...','Loading progress...'],
  ['ขั้นที่กำลังเรียน','Current stage'],
  ['กำลังเรียน','In progress'],
  ['กำลังโหลดผลการเรียน...','Loading learning results...'],
  ['ภาพรวมการเรียน','Learning overview'],
  ['ทำแบบฝึกหัด','Practice'],
  ['ติดตามความก้าวหน้า','Track progress'],
  ['ข้อมูลผู้ใช้','User profile'],
  ['โหลดข้อมูลอีกครั้ง','Reload data'],
  ['สร้างบัญชีใหม่','Create a new account'],
  ['ขอลิงก์ตั้งรหัสผ่านใหม่','Request a password reset link'],
  ['เมนูหลัก','Main navigation'],
  ['เปิดเมนูหลัก','Open main navigation'],
  ['ปิดเมนูหลัก','Close main navigation'],
  ['เมนูนี้ใช้ร่วมกันทุกหน้าของเว็บแอป','This menu is shared across all pages of the web app.'],
  ['ผู้ใช้งาน','User'],

  ['ภาพรวม 5 ทักษะปัจจุบัน','Current 5-skill snapshot'],
  ['ตำแหน่งปัจจุบันในเส้นทางการเรียน','Current position in the learning path'],
  ['กิจกรรมล่าสุด','Recent activity'],
  ['ภาพรวมความก้าวหน้าทั้งระบบ','Overall learning progress'],
  ['หลักฐานรายทักษะ','Skill mastery evidence'],
  ['แนวโน้มตามเวลา','Learning trend over time'],
  ['เลือกทักษะสำหรับกราฟ','Select a skill for the chart'],
  ['สถานะและหลักฐานของแต่ละ Stage','Stage status and evidence'],
  ['ประวัติ Practice Session','Practice session history'],
  ['เรียนต่อจาก Stage ปัจจุบันตามหลักฐาน Mastery ของคุณ','Continue from your current stage based on your mastery evidence.'],
  ['สะสมหลักฐานให้ครบเกณฑ์ของ Stage','Build enough evidence to meet the stage criteria'],
  ['เริ่มประเมินก่อนเรียน','Start pre-test'],
  ['ทบทวนผลการเรียน','Review learning results'],
  ['ทบทวน','Review'],
  ['ฝึกต่อ','Continue practice'],
  ['ยังไม่พบ Stage ที่พร้อมสำหรับการฝึก','No stage is currently ready for practice'],
  ['คุณสำเร็จ Learning Path ที่กำหนดแล้ว','You have completed the assigned learning path'],
  ['ยังไม่เริ่ม','Not started'],
  ['ตามเกณฑ์ Mastery ของ Stage ปัจจุบัน','Based on the mastery criteria for the current stage'],
  ['จำนวน session ที่บันทึกในระบบ','Number of sessions recorded in the system'],
  ['ยังไม่มีคะแนนเพียงพอ','Not enough score evidence yet'],
  ['ยังไม่มี Stage ใน Learning Path นี้','There are no stages in this learning path yet'],
  ['ยังไม่มี Practice Session ที่บันทึกไว้','No practice sessions have been recorded yet'],
  ['ต้องมีผลการฝึกอย่างน้อย 2 session จึงจะแสดงแนวโน้มตามเวลาได้','At least 2 practice sessions are required to show a learning trend.'],
  ['ยังไม่มี Learning Path ที่ลงทะเบียนไว้','No learning path is enrolled yet'],
  ['ยังไม่มีข้อมูล','No data'],
  ['ข้อมูลยังไม่เพียงพอ','Not enough data'],
  ['เกณฑ์','Threshold'],
  ['ผ่าน','Completed'],
  ['จาก','of'],
  ['โจทย์','Item'],

  ['Current Stage','ขั้นปัจจุบัน'],
  ['Mastered Skills','ทักษะที่ผ่านเกณฑ์'],
  ['Practice Sessions','จำนวนครั้งที่ฝึก'],
  ['Overall Progress','ความก้าวหน้ารวม'],
  ['Skill Snapshot','ภาพรวมทักษะ'],
  ['Learning Path','เส้นทางการเรียน'],
  ['Recent Activity','กิจกรรมล่าสุด'],
  ['Overall Learning Progress','ความก้าวหน้าการเรียนโดยรวม'],
  ['Skill Mastery Detail','รายละเอียด Mastery รายทักษะ'],
  ['Learning Trend','แนวโน้มการเรียน'],
  ['Stage Progress / History','ความก้าวหน้า / ประวัติ Stage'],
  ['Session History','ประวัติ Session'],
  ['View Progress','ดูความก้าวหน้า'],
  ['Mastered','ผ่านเกณฑ์'],
  ['Needs Practice','ควรฝึกเพิ่ม'],
  ['No Data','ยังไม่มีข้อมูล'],
  ['Developing','กำลังพัฒนา'],
  ['Completed','เสร็จแล้ว'],
  ['Current','ปัจจุบัน'],
  ['Locked','ล็อก'],
  ['Upcoming','ถัดไป'],
  ['In progress','กำลังเรียน'],
  ['Status','สถานะ'],
  ['Trend','แนวโน้ม'],
  ['Recent performance','ผลงานล่าสุด'],
  ['Mastery threshold','เกณฑ์ Mastery'],
  ['All Skills','ทุกทักษะ'],
  ['Not enough data','ข้อมูลยังไม่เพียงพอ'],
  ['Improving','ดีขึ้น'],
  ['Declining','ลดลง'],
  ['Stable','คงที่'],
  ['Stage Progress','ความก้าวหน้า Stage'],
  ['Skill Focus','ทักษะที่ควรเน้น'],
  ['Profile','โปรไฟล์'],
  ['Avatar URL','Avatar URL'],

  ['แดชบอร์ดผู้สอน','Teacher Dashboard'],
  ['ภาพรวมชั้นเรียนและความก้าวหน้าของผู้เรียน','Class and Learner Progress Overview'],
  ['เลือกชั้นเรียนเพื่อติดตาม Learning Path, Exercise และ Stage ของผู้เรียนแต่ละคน','Select a class to track each learner’s learning path, exercise, and stage.'],
  ['ผู้สอน','Teacher'],
  ['เลือกชั้นเรียน','Select class'],
  ['ชั้นเรียน','Class'],
  ['กำลังโหลดข้อมูลชั้นเรียน...','Loading class data...'],
  ['นักศึกษา','Students'],
  ['สมาชิกที่ active ในชั้นเรียน','Active members in the class'],
  ['เส้นทางที่มอบหมายและ active','Assigned and active paths'],
  ['สำเร็จแล้ว','Completed'],
  ['ผู้เรียนที่สำเร็จทุก Path ที่มอบหมาย','Learners who completed every assigned path'],
  ['เส้นทางการเรียนรู้ที่มอบหมาย','Assigned learning paths'],
  ['ความก้าวหน้ารายบุคคล','Individual learner progress'],
  ['มุมมองสำหรับติดตามการเรียน','Learning monitoring view'],
  ['สถานะ Path','Path status'],
  ['ยังไม่เริ่ม · กำลังเรียน · สำเร็จแล้ว','Not started · In progress · Completed'],
  ['คำนวณจากจำนวน Stage จริงของ Exercise','Calculated from the actual number of stages in the exercise'],
  ['คะแนนล่าสุด','Latest score'],
  ['แสดง last mastery score ล่าสุดของ Exercise','Shows the latest mastery score for the exercise'],
  ['Read-only','อ่านอย่างเดียว'],

  ['ระดับ','Level'],
  ['ระดับการเรียนรู้ปัจจุบัน','Current learning level'],
  ['แดชบอร์ด','Dashboard'],
  ['เขียนบันไดเสียง Ab major','Write the Ab major scale'],
  ['ขาขึ้น–ขาลงตาม Rhythm Pattern โดยใส่ accidental, stem และ beam ให้ถูกต้อง','Write ascending and descending according to the rhythm pattern with correct accidentals, stems, and beams.'],
  ['พลังพิชิต Level','Level mastery progress'],
  ['ความก้าวหน้า Level','Level progress'],
  ['ทำแล้ว','Completed'],
  ['คีย์','Keys'],
  ['คะแนน','Score'],
  ['กำลังอัปเดตความก้าวหน้า...','Updating progress...'],
  ['ความก้าวหน้ารายทักษะ','Progress by skill'],
  ['แตะอีกครั้งเพื่อปิด','Tap again to close'],
  ['สรุปผลการฝึก','Practice summary'],
  ['สรุปผล Mastery Session','Mastery Session Summary'],
  ['จุดแข็ง','Strengths'],
  ['จุดที่ควรพัฒนา','Areas to improve'],
  ['เริ่มการฝึกใหม่','Start a new practice session'],
  ['ผ่านเกณฑ์ Rolling Mastery','Rolling Mastery criteria met'],
  ['เริ่ม Level ถัดไป','Start next level'],
  ['ตรวจคำตอบ','Check answer'],
  ['ล้างทั้งหมด','Clear all'],
  ['ลบ','Delete'],
  ['เลือกหลายตัว','Multi-select'],
  ['เลื่อนซ้าย','Move left'],
  ['เลื่อนขวา','Move right'],
  ['เพิ่มโน้ต','Add note'],
  ['กลับ Dashboard','Back to Dashboard'],

  ['ชื่อเล่น:','Nickname:'],
  ['กำลังโหลด...','Loading...'],
  ['ไม่สามารถโหลดข้อมูลได้','Unable to load data'],
  ['ลองใหม่','Try again'],
  ['บันทึกสำเร็จ','Saved successfully']
];

const thToEn=new Map(PAIRS.map(([th,en])=>[th,en]));
const enToTh=new Map(PAIRS.map(([th,en])=>[en,th]));
const ATTRS=['aria-label','placeholder','title'];
let language=DEFAULT_LANGUAGE;
let applying=false;
let queued=false;
let observer=null;

function storedLanguage(){
  try{
    const value=localStorage.getItem(STORAGE_KEY);
    return SUPPORTED.has(value)?value:DEFAULT_LANGUAGE;
  }catch(_error){
    return DEFAULT_LANGUAGE;
  }
}

function preserveWhitespace(raw,next){
  const leading=raw.match(/^\s*/)?.[0]||'';
  const trailing=raw.match(/\s*$/)?.[0]||'';
  return `${leading}${next}${trailing}`;
}

function translatePattern(text,targetLanguage){
  let match;
  if(targetLanguage==='en'){
    match=text.match(/^(\d+) คน$/u);
    if(match) return `${match[1]} learner${match[1]==='1'?'':'s'}`;
    match=text.match(/^ปี\s*(\d+)$/u);
    if(match) return `Year ${match[1]}`;
    match=text.match(/^ผ่าน\s*(\d+)\s*จาก\s*(\d+)\s*Stage$/u);
    if(match) return `Completed ${match[1]} of ${match[2]} stages`;
    match=text.match(/^เกณฑ์\s*(\d+(?:\.\d+)?%)$/u);
    if(match) return `Threshold ${match[1]}`;
    match=text.match(/^ชื่อเล่น:\s*(.+)$/u);
    if(match) return `Nickname: ${match[1]}`;
    match=text.match(/^เปิด Progress ของ\s+(.+)$/u);
    if(match) return `Open ${match[1]} progress`;
    match=text.match(/^Stage\s+(\d+|—)\s+of\s+(\d+|—)$/u);
    if(match) return `Stage ${match[1]} of ${match[2]}`;
  }else{
    match=text.match(/^(\d+) learners?$/u);
    if(match) return `${match[1]} คน`;
    match=text.match(/^Year\s*(\d+)$/u);
    if(match) return `ปี ${match[1]}`;
    match=text.match(/^Completed\s*(\d+)\s*of\s*(\d+)\s*stages$/u);
    if(match) return `ผ่าน ${match[1]} จาก ${match[2]} Stage`;
    match=text.match(/^Threshold\s*(\d+(?:\.\d+)?%)$/u);
    if(match) return `เกณฑ์ ${match[1]}`;
    match=text.match(/^Nickname:\s*(.+)$/u);
    if(match) return `ชื่อเล่น: ${match[1]}`;
    match=text.match(/^Open\s+(.+)\s+progress$/u);
    if(match) return `เปิด Progress ของ ${match[1]}`;
  }
  return text;
}

function translateText(text,targetLanguage=language){
  const trimmed=String(text??'').trim();
  if(!trimmed) return String(text??'');
  const map=targetLanguage==='en'?thToEn:enToTh;
  const direct=map.get(trimmed);
  const next=direct ?? translatePattern(trimmed,targetLanguage);
  return next===trimmed?String(text??''):preserveWhitespace(String(text??''),next);
}

function translateNode(node){
  if(!node || node.nodeType!==Node.TEXT_NODE) return;
  const parent=node.parentElement;
  if(!parent || parent.closest('#appLanguageControl,[data-i18n-ignore="true"]')) return;
  if(['SCRIPT','STYLE','NOSCRIPT'].includes(parent.tagName)) return;
  const next=translateText(node.nodeValue,language);
  if(next!==node.nodeValue) node.nodeValue=next;
}

function translateElementAttributes(element){
  if(!element || element.nodeType!==Node.ELEMENT_NODE) return;
  if(element.closest('#appLanguageControl,[data-i18n-ignore="true"]')) return;
  for(const attr of ATTRS){
    if(!element.hasAttribute(attr)) continue;
    const current=element.getAttribute(attr);
    const next=translateText(current,language);
    if(next!==current) element.setAttribute(attr,next);
  }
}

function apply(root=document){
  if(applying || !root) return;
  applying=true;
  try{
    document.documentElement.lang=language;
    if(root.nodeType===Node.TEXT_NODE){
      translateNode(root);
      return;
    }
    if(root.nodeType===Node.ELEMENT_NODE) translateElementAttributes(root);
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
    let node=walker.currentNode;
    while(node){
      if(node.nodeType===Node.TEXT_NODE) translateNode(node);
      else translateElementAttributes(node);
      node=walker.nextNode();
    }
    syncLanguageControl();
  }finally{
    applying=false;
  }
}

function queueApply(){
  if(queued) return;
  queued=true;
  requestAnimationFrame(()=>{
    queued=false;
    placeLanguageControl();
    apply(document.body||document.documentElement);
  });
}

function currentVisible(selectors){
  for(const selector of selectors){
    for(const element of document.querySelectorAll(selector)){
      if(element.hidden || element.closest('[hidden]')) continue;
      return element;
    }
  }
  return null;
}

function languageControl(){
  let control=document.getElementById('appLanguageControl');
  if(control) return control;
  control=document.createElement('div');
  control.id='appLanguageControl';
  control.className='app-language-control';
  control.setAttribute('data-i18n-ignore','true');
  control.innerHTML='<label for="appLanguageSelect"><span id="appLanguageLabel">ภาษา</span><select id="appLanguageSelect" aria-label="ภาษา / Language"><option value="th">ไทย</option><option value="en">English</option></select></label>';
  control.querySelector('select')?.addEventListener('change',event=>setLanguage(event.target.value));
  document.body.appendChild(control);
  return control;
}

function ensureStyles(){
  if(document.querySelector('style[data-app-language-style]')) return;
  const style=document.createElement('style');
  style.setAttribute('data-app-language-style','true');
  style.textContent=`
    .app-language-control{display:flex;align-items:center;min-width:0;color:inherit;font:inherit}
    .app-language-control label{display:flex;align-items:center;gap:7px;margin:0;font-size:.76rem;font-weight:800;color:inherit;white-space:nowrap}
    .app-language-control select{min-height:38px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#1f2937;padding:6px 28px 6px 9px;font:inherit;font-size:.78rem;font-weight:750;cursor:pointer}
    .app-language-control select:focus-visible{outline:3px solid rgba(37,99,235,.28);outline-offset:2px}
    #appNavigationDrawer .app-language-control{margin:0 14px 10px;padding:10px 12px;border:1px solid rgba(148,163,184,.35);border-radius:12px;background:rgba(248,250,252,.9)}
    #appNavigationDrawer .app-language-control label{width:100%;justify-content:space-between;color:#334155}
    .student-dashboard-actions>.app-language-control,.session-header>.app-language-control,.auth-brand>.app-language-control{margin-left:auto}
    .app-language-control.is-floating{position:fixed;top:10px;right:10px;z-index:1200;padding:6px 8px;border:1px solid #dbe2ea;border-radius:12px;background:rgba(255,255,255,.96);box-shadow:0 6px 18px rgba(15,23,42,.12);color:#334155}
    @media(max-width:640px){.app-language-control label>span{display:none}.app-language-control select{min-height:36px;padding-left:7px;padding-right:24px}.student-dashboard-actions>.app-language-control,.session-header>.app-language-control,.auth-brand>.app-language-control{margin-left:0}}
  `;
  document.head.appendChild(style);
}

function placeLanguageControl(){
  if(!document.body) return;
  ensureStyles();
  const control=languageControl();
  const drawer=document.getElementById('appNavigationDrawer');
  if(drawer){
    const items=document.getElementById('appNavigationItems');
    if(items && control.nextElementSibling!==items) items.insertAdjacentElement('beforebegin',control);
    control.classList.remove('is-floating');
    return;
  }
  const host=currentVisible([
    '#studentDashboard .student-dashboard-actions',
    '#teacherDashboard .student-dashboard-actions',
    '#trainerApp .session-header',
    '#authScreen .auth-card .auth-brand'
  ]);
  if(host){
    if(control.parentElement!==host) host.appendChild(control);
    control.classList.remove('is-floating');
  }else{
    if(control.parentElement!==document.body) document.body.appendChild(control);
    control.classList.add('is-floating');
  }
}

function syncLanguageControl(){
  const select=document.getElementById('appLanguageSelect');
  if(select && select.value!==language) select.value=language;
  const label=document.getElementById('appLanguageLabel');
  if(label) label.textContent=language==='en'?'Language':'ภาษา';
  if(select) select.setAttribute('aria-label',language==='en'?'Language':'ภาษา / Language');
}

function getLanguage(){return language;}

function setLanguage(next,{persist=true}={}){
  if(!SUPPORTED.has(next)) return false;
  const changed=language!==next;
  language=next;
  if(persist){
    try{localStorage.setItem(STORAGE_KEY,language);}catch(_error){}
  }
  placeLanguageControl();
  apply(document.body||document.documentElement);
  if(changed){
    window.dispatchEvent(new CustomEvent('major-scale:languagechange',{detail:{language}}));
  }
  return true;
}

function start(){
  language=storedLanguage();
  ensureStyles();
  placeLanguageControl();
  apply(document.body||document.documentElement);
  observer=new MutationObserver(mutations=>{
    if(applying) return;
    if(mutations.some(mutation=>{
      const target=mutation.target?.nodeType===Node.ELEMENT_NODE?mutation.target:mutation.target?.parentElement;
      return !target?.closest?.('#appLanguageControl');
    })) queueApply();
  });
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:ATTRS.concat(['hidden'])});
}

app.i18n=Object.freeze({
  getLanguage,
  setLanguage,
  t:(text)=>translateText(text,language).trim(),
  translateText,
  apply,
  supportedLanguages:Object.freeze(['th','en'])
});

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
})();
