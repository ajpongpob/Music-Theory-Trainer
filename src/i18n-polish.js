(() => {
'use strict';

const app=window.MajorScaleApp=window.MajorScaleApp || {};
if(typeof document==='undefined') return;

const STORAGE_KEY='major-scale-trainer.language';
const ATTRS=['aria-label','title','placeholder'];
let applying=false;
let queued=false;
let observer=null;
let started=false;

const EN_EXACT=new Map([
  ['การเขียนบันไดเสียงเมเจอร์','Major Scale Notation'],
  ['เขียนบันไดเสียง','Write a major scale'],
  ['โจทย์','Question'],
  ['ความก้าวหน้าของขั้น','Stage progress'],
  ['ขั้นที่','Stage'],
  ['ขั้น','Stage'],
  ['ล้างคำตอบ','Clear answer'],
  ['＋ โน้ต','＋ Note'],
  ['เลือกหลายโน้ต','Select multiple notes'],
  ['ทำข้อต่อไป','Next question'],
  ['ผลการตรวจคำตอบ','Answer check'],
  ['ตรวจคำตอบแล้ว','Answer checked'],
  ['ดูคะแนนและ feedback ของข้อนี้','Review the score and feedback for this question'],
  ['คำตอบของคุณ','Your answer'],
  ['กำลังบันทึกและประเมิน...','Saving and evaluating...'],
  ['จุดที่ควรแก้ก่อน','Fix these first'],
  ['ไม่พบข้อผิดพลาดในเกณฑ์ที่ประเมิน','No errors were found in the assessed criteria'],
  ['คะแนนรายข้อ','Scores by question'],
  ['ผลรายทักษะของข้อนี้','Skill results for this question'],
  ['เครื่องมือเขียนโน้ตบนมือถือ','Mobile notation tools'],
  ['เลื่อนไปตำแหน่งก่อนหน้า','Move to previous position'],
  ['เลื่อนระดับเสียงขึ้น','Move pitch up'],
  ['เลื่อนระดับเสียงลง','Move pitch down'],
  ['เลื่อนไปตำแหน่งถัดไป','Move to next position'],
  ['เพิ่มตัวโน้ตที่ตำแหน่งเคอร์เซอร์','Add a note at the cursor'],
  ['เพิ่มตัวโน้ต','Add note'],
  ['สลับทิศก้านโน้ตขึ้น–ลง','Toggle stem direction'],
  ['ตำแหน่งก่อนหน้า • Shortcut: Arrow Left','Previous position • Shortcut: Arrow Left'],
  ['Pitch ขึ้น • Shortcut: Arrow Up','Pitch up • Shortcut: Arrow Up'],
  ['Pitch ลง • Shortcut: Arrow Down','Pitch down • Shortcut: Arrow Down'],
  ['ตำแหน่งถัดไป • Shortcut: Arrow Right','Next position • Shortcut: Arrow Right'],
  ['เพิ่มตัวโน้ต • Shortcut: Enter/Space','Add note • Shortcut: Enter/Space'],
  ['เลือกหลายโน้ต • M • Desktop: คลิกตัวแรกแล้ว Shift+คลิกตัวสุดท้าย','Select multiple notes • M • Desktop: click the first note, then Shift+click the last note'],
  ['สลับทิศก้านโน้ตขึ้น–ลง • กดเพื่อกลับทิศ • 8','Toggle stem direction • Press to reverse • 8'],
  ['คลิก/แตะเพื่อเขียน • หลังเพิ่มโน้ต ค่า Rhythm/Accidental ที่เลือกจะใช้กับโน้ตถัดไป • คลิกโน้ตเดิมเพื่อแก้ไข • Shift+Click เพื่อเลือกช่วง','Click/tap to write • After adding a note, the selected Rhythm/Accidental applies to the next note • Click an existing note to edit • Shift+Click to select a range'],
  ['แบบประเมินก่อนเรียน','Pre-test'],
  ['ใช้คำตอบนี้เพื่อวิเคราะห์จุดเริ่มต้น โดยยังใช้เกณฑ์การเขียนเดียวกับแบบฝึก','Your answer is used to determine the starting point with the same notation criteria as the practice exercise'],
  ['ขาขึ้น–ขาลงตาม Rhythm Pattern โดยใส่ accidental, stem และ beam ให้ถูกต้อง','Write ascending and descending according to the Rhythm Pattern with correct accidentals, stems, and beams'],
  ['ระดับนี้กำหนดโดย Learning Path','This level is set by the learning path'],
  ['ทำต่อเพื่อเพิ่มความมั่นใจ','Continue practicing to build confidence'],
  ['ใกล้ถึงเกณฑ์แล้ว ทำต่ออีกนิด','Almost at the threshold; keep practicing'],
  ['โหลดความก้าวหน้าไม่สำเร็จ • ลองใหม่','Unable to load progress • Try again'],
  ['ผ่านแบบฝึกหัดครบทุกขั้นแล้ว','All stages of this exercise are complete'],
  ['ดูผลการเรียน','View learning results'],
  ['เป้าหมาย:','Target:'],
  ['โจทย์เป้าหมาย:','Target item:'],
  ['คำแนะนำถัดไป','Next recommendation'],
  ['เรียนต่อ','Continue'],
  ['ฝึกทักษะที่ควรพัฒนา','Practice the skill that needs improvement'],
  ['ฝึกบันไดเสียงที่ยังขาด','Practice a missing major scale'],
  ['ไปขั้นถัดไป','Go to the next stage'],
  ['สถานะการเรียน','Learning status'],
  ['ไม่มีขั้นที่กำลังเรียน','No stage is currently in progress'],
  ['ความก้าวหน้าของแบบฝึกหัด','Exercise progress'],
  ['เส้นทางการเรียนรู้','Learning path'],
  ['ยังไม่มีขั้นการเรียน','No learning stages yet'],
  ['ยังไม่เปิด','Locked'],
  ['เรียนจบเส้นทางนี้แล้ว','This learning path is complete'],
  ['แบบฝึกหัดสำเร็จแล้ว','Exercise completed'],
  ['ครบทุกขั้น','All stages completed'],
  ['ผ่านแบบฝึกหัดที่กำหนดในเส้นทางนี้แล้ว','All required exercises in this learning path are complete'],
  ['วันที่สำเร็จเส้นทางการเรียนรู้','Learning path completion date'],
  ['แบบฝึกหัดนี้ผ่านครบทุกขั้นแล้ว','All stages of this exercise are complete'],
  ['ยังไม่มีขั้นที่ต้องแสดงผลการเรียน','There is no current stage to display'],
  ['กำลังสะสมผลการฝึก','Collecting practice evidence'],
  ['ยังทำโจทย์ที่กำหนดไม่ครบ','Required items are not yet complete'],
  ['ยังมีทักษะที่ต้องพัฒนา','Some skills still need improvement'],
  ['ผ่านเกณฑ์ของขั้นนี้','This stage meets the threshold'],
  ['ทำโจทย์ที่กำหนดครบ ✓','Required items completed ✓'],
  ['ทำโจทย์ที่กำหนดยังไม่ครบ','Required items are not yet complete'],
  ['ผลการฝึกล่าสุดที่ใช้ประเมิน','Recent practice evidence used for evaluation'],
  ['ยังไม่มีผลรายทักษะ','No skill results yet'],
  ['โหลดผลการเรียนไม่สำเร็จ กรุณาลองใหม่','Unable to load learning results. Please try again'],
  ['เปิดแบบฝึกหัดไม่สำเร็จ:','Unable to open the exercise:'],
  ['กรุณาลองใหม่','Please try again'],
  ['เลือกอย่างน้อย 2 โน้ต: คลิกตัวแรก แล้ว Shift+Click ตัวสุดท้าย หรือใช้ปุ่ม เลือกหลายโน้ต','Select at least 2 notes: click the first note, then Shift+click the last note, or use Select multiple notes'],
  ['กรุณาเลือกโน้ตที่อยู่ติดกัน','Please select adjacent notes'],
  ['Beam ได้เฉพาะ eighth/sixteenth notes','Only eighth and sixteenth notes can be beamed'],
  ['เลือกโน้ตในห้องเดียวกันเพื่อ Beam','Select notes within the same measure to beam them'],
  ['เปลี่ยนระดับจะเริ่มชุดใหม่และล้างคำตอบ/ผลของชุดปัจจุบัน ต้องการดำเนินการต่อหรือไม่?','Changing level will start a new set and clear the current answers/results. Continue?']
]);

const TH_EXACT=new Map([
  ['Student Dashboard','แดชบอร์ดผู้เรียน'],
  ['Dashboard','แดชบอร์ด'],
  ['Progress','ความก้าวหน้า'],
  ['Practice','ทำแบบฝึกหัด'],
  ['Profile','ข้อมูลผู้ใช้'],
  ['Current Stage','ขั้นปัจจุบัน'],
  ['Mastered Skills','ทักษะที่ผ่านเกณฑ์'],
  ['Practice Sessions','จำนวนครั้งที่ฝึก'],
  ['Overall Progress','ความก้าวหน้ารวม'],
  ['Skill Snapshot','ภาพรวมทักษะ'],
  ['Learning Path','เส้นทางการเรียน'],
  ['Recent Activity','กิจกรรมล่าสุด'],
  ['Overall Learning Progress','ความก้าวหน้าการเรียนโดยรวม'],
  ['Skill Mastery Detail','รายละเอียดผลรายทักษะ'],
  ['Learning Trend','แนวโน้มการเรียน'],
  ['Stage Progress / History','ความก้าวหน้า / ประวัติขั้น'],
  ['Session History','ประวัติการฝึก'],
  ['Mastery threshold','เกณฑ์ผ่าน'],
  ['Stage Progress','ความก้าวหน้าของขั้น'],
  ['Skill Focus','ทักษะที่ควรเน้น'],
  ['Skill Focus:','ทักษะที่ควรเน้น:'],
  ['Attempt / Detailed Review','รายละเอียดการตอบ'],
  ['Continue Learning','เรียนต่อ'],
  ['Continue Learning · Next Recommended Activity','เรียนต่อ · กิจกรรมที่แนะนำถัดไป'],
  ['View Progress','ดูความก้าวหน้า'],
  ['Status','สถานะ'],
  ['Trend','แนวโน้ม'],
  ['Recent performance','ผลงานล่าสุด'],
  ['All Skills','ทุกทักษะ'],
  ['Not enough data','ข้อมูลยังไม่เพียงพอ'],
  ['Improving','ดีขึ้น'],
  ['Declining','ลดลง'],
  ['Stable','คงที่'],
  ['สถานะและหลักฐานของแต่ละ Stage','สถานะและหลักฐานของแต่ละขั้น'],
  ['ประวัติ Practice Session','ประวัติการฝึก'],
  ['เรียนต่อจาก Stage ปัจจุบันตามหลักฐาน Mastery ของคุณ','เรียนต่อจากขั้นปัจจุบันตามหลักฐานการผ่านเกณฑ์ของคุณ'],
  ['สะสมหลักฐานให้ครบเกณฑ์ของ Stage','สะสมหลักฐานให้ครบเกณฑ์ของขั้น'],
  ['ตามเกณฑ์ Mastery ของ Stage ปัจจุบัน','ตามเกณฑ์การผ่านของขั้นปัจจุบัน'],
  ['จำนวน session ที่บันทึกในระบบ','จำนวนครั้งการฝึกที่บันทึกในระบบ'],
  ['ยังไม่มี Stage ใน Learning Path นี้','ยังไม่มีขั้นในเส้นทางการเรียนนี้'],
  ['ยังไม่มี Practice Session ที่บันทึกไว้','ยังไม่มีประวัติการฝึกที่บันทึกไว้'],
  ['ต้องมีผลการฝึกอย่างน้อย 2 session จึงจะแสดงแนวโน้มตามเวลาได้','ต้องมีผลการฝึกอย่างน้อย 2 ครั้ง จึงจะแสดงแนวโน้มตามเวลาได้'],
  ['รายละเอียด Mastery รายทักษะ','รายละเอียดผลรายทักษะ'],
  ['ความก้าวหน้า / ประวัติ Stage','ความก้าวหน้า / ประวัติขั้น'],
  ['ประวัติ Session','ประวัติการฝึก'],
  ['เกณฑ์ Mastery','เกณฑ์ผ่าน'],
  ['ความก้าวหน้า Stage','ความก้าวหน้าของขั้น'],
  ['ข้อมูลจริงจาก Practice Sessions / Attempts','ข้อมูลจริงจากการฝึก / การตอบ'],
  ['Session นี้ยังไม่มี attempt detail ที่ระบบส่งกลับมา','การฝึกครั้งนี้ยังไม่มีรายละเอียดคำตอบที่บันทึกไว้'],
  ['ไม่มี skill result รายข้อที่บันทึกไว้','ไม่มีผลรายทักษะของข้อนี้ที่บันทึกไว้']
]);

function currentLanguage(){
  const fromBase=app.i18n?.getLanguage?.();
  if(fromBase==='th' || fromBase==='en') return fromBase;
  try{
    const stored=localStorage.getItem(STORAGE_KEY);
    if(stored==='th' || stored==='en') return stored;
  }catch(_error){}
  return document.documentElement.lang==='en' ? 'en' : 'th';
}

function preserveWhitespace(raw,next){
  const leading=raw.match(/^\s*/u)?.[0] || '';
  const trailing=raw.match(/\s*$/u)?.[0] || '';
  return `${leading}${next}${trailing}`;
}

function englishPatterns(text){
  let next=text;
  next=next.replace(/การเขียนบันไดเสียงเมเจอร์/gu,'Major Scale Notation');
  next=next.replace(/^ทำแบบฝึกเพิ่มอีก\s*(\d+)\s*ข้อ\s*เพื่อให้ระบบมีผลการฝึกเพียงพอสำหรับประเมินขั้นนี้$/u,(_m,count)=>`Complete ${count} more practice item${count==='1'?'':'s'} so the system has enough evidence to evaluate this stage.`);
  next=next.replace(/^เขียนบันไดเสียง\s+(.+?\s+major)$/iu,(_m,key)=>`Write the ${key} scale`);
  next=next.replace(/^แบบประเมินก่อนเรียน\s*•\s*(.+)$/u,(_m,key)=>`Pre-test • ${key}`);
  next=next.replace(/ขั้นที่\s*(\d+|—)\s*จาก\s*(\d+|—)/gu,'Stage $1 of $2');
  next=next.replace(/ขั้นที่\s*(\d+)/gu,'Stage $1');
  next=next.replace(/ผ่าน\s*(\d+)\s*จาก\s*(\d+)\s*ขั้น/gu,'Completed $1 of $2 stages');
  next=next.replace(/(\d+)\s*\/\s*(\d+)\s*ข้อ/gu,'$1 / $2 items');
  next=next.replace(/ข้อ\s*(\d+)/gu,'Question $1');
  next=next.replace(/^อีก\s*(\d+)\s*ข้อเพื่อประเมินความพร้อม$/u,(_m,count)=>`${count} more item${count==='1'?'':'s'} needed to assess readiness`);
  next=next.replace(/^ฝึกอีก\s*(\d+)\s*คีย์:\s*/u,'Practice $1 more keys: ');
  next=next.replace(/^ฝึกให้ครบอีก\s*(\d+)\s*คีย์$/u,'Practice $1 more keys');
  next=next.replace(/^ฝึกบันไดเสียง\s+(.+)$/u,'Practice the $1 major scale');
  next=next.replace(/^เกณฑ์\s*(\d+(?:\.\d+)?%)$/u,'Threshold $1');
  next=next.replace(/^สำเร็จเมื่อ\s+(.+)$/u,'Completed on $1');
  next=next.replace(/โน้ตตำแหน่ง\s*(\d+)/gu,'Note position $1');
  next=next.replace(/หน่วย\s*(\d+)/gu,'Unit $1');
  next=next.replace(/และอีก\s*(\d+)\s*จุด/gu,'and $1 more issue$1');
  next=next.replace(/โจทย์เป้าหมาย:/gu,'Target item:');
  next=next.replace(/เป้าหมาย:/gu,'Target:');
  return next;
}

function thaiCommonPatterns(text){
  let next=text;
  next=next.replace(/Stage\s+(\d+|—)\s+of\s+(\d+|—)/giu,'ขั้นที่ $1 จาก $2');
  next=next.replace(/Stage\s+(\d+)/giu,'ขั้นที่ $1');
  next=next.replace(/Question\s+(\d+)/giu,'ข้อ $1');
  next=next.replace(/(\d+)\s*\/\s*(\d+)\s*items?/giu,'$1 / $2 ข้อ');
  next=next.replace(/Completed\s+(\d+)\s+of\s+(\d+)\s+stages/giu,'ผ่าน $1 จาก $2 ขั้น');
  return next;
}

function thaiStudentPatterns(text){
  let next=thaiCommonPatterns(text);
  next=next.replace(/\bPractice Sessions\b/gu,'จำนวนครั้งที่ฝึก');
  next=next.replace(/\bPractice Session\b/gu,'การฝึก');
  next=next.replace(/\bSession History\b/gu,'ประวัติการฝึก');
  next=next.replace(/\bSession\b/gu,'การฝึก');
  next=next.replace(/\bsession\b/gu,'ครั้งการฝึก');
  next=next.replace(/\bMastery\b/gu,'การผ่านเกณฑ์');
  next=next.replace(/\bLearning Path\b/gu,'เส้นทางการเรียน');
  next=next.replace(/\bExercise\b/gu,'แบบฝึกหัด');
  next=next.replace(/\bStage\b/gu,'ขั้น');
  return next;
}

function translateText(raw,target=currentLanguage(),scope='global'){
  const source=String(raw??'');
  const trimmed=source.trim();
  if(!trimmed) return source;
  const exact=(target==='en'?EN_EXACT:TH_EXACT).get(trimmed);
  let next=exact ?? trimmed;
  next=target==='en' ? englishPatterns(next) : (scope==='student' ? thaiStudentPatterns(next) : thaiCommonPatterns(next));
  return next===trimmed ? source : preserveWhitespace(source,next);
}

function skipElement(element,{drawer=false}={}){
  if(!element) return true;
  if(element.closest('#appLanguageControl')) return true;
  if(!drawer && element.closest('#appNavigationDrawer')) return true;
  if(element.closest('script,style,noscript')) return true;
  if(element.closest('svg')) return true;
  return false;
}

function applyRoot(root,scope='global'){
  if(!root || applying) return;
  applying=true;
  try{
    const translateElement=element=>{
      if(skipElement(element)) return;
      for(const attr of ATTRS){
        if(!element.hasAttribute?.(attr)) continue;
        const current=element.getAttribute(attr);
        const next=translateText(current,currentLanguage(),scope);
        if(next!==current) element.setAttribute(attr,next);
      }
    };
    const translateNode=node=>{
      const parent=node.parentElement;
      if(skipElement(parent)) return;
      const next=translateText(node.nodeValue,currentLanguage(),scope);
      if(next!==node.nodeValue) node.nodeValue=next;
    };
    if(root.nodeType===Node.ELEMENT_NODE) translateElement(root);
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
    let node=walker.currentNode;
    while(node){
      if(node.nodeType===Node.TEXT_NODE) translateNode(node);
      else translateElement(node);
      node=walker.nextNode();
    }
  }finally{
    applying=false;
  }
}

function applyTrainer(){
  [
    '#trainerApp .session-header',
    '#trainerApp .task-status-card',
    '#trainerApp .editor-control-row',
    '#trainerApp .compact-hint',
    '#trainerApp .session-actions',
    '#trainerApp #feedback',
    '#questionResultOverlay',
    '#levelMasteryOverlay',
    '#sessionSummary'
  ].forEach(selector=>{
    const root=document.querySelector(selector);
    if(root) applyRoot(root,'trainer');
  });
}

const HEADER_COPY={
  th:{
    dashboard:{kicker:'แดชบอร์ดผู้เรียน',title:'ความก้าวหน้าการเรียนของคุณ',description:'เรียนต่อจากจุดที่เหมาะสม และตรวจหลักฐานพัฒนาการเมื่อคุณต้องการ'},
    progress:{kicker:'ความก้าวหน้า',title:'รายละเอียดความก้าวหน้าการเรียน',description:'ติดตามผลการเรียนรายทักษะ ขั้น และประวัติการฝึก'},
    profile:{kicker:'ข้อมูลผู้ใช้',title:'โปรไฟล์ผู้เรียน',description:'ตรวจสอบและแก้ไขข้อมูลผู้เรียนของคุณ'}
  },
  en:{
    dashboard:{kicker:'Student Dashboard',title:'Your Learning Progress',description:'Continue from the right point and review your learning evidence when needed.'},
    progress:{kicker:'Progress',title:'Learning Progress',description:'Review progress by skill, stage, and practice history.'},
    profile:{kicker:'Profile',title:'Learner Profile',description:'Review and update your learner information.'}
  }
};

function studentSection(){
  const progress=document.getElementById('sd2ProgressPage');
  const profile=document.getElementById('sd2ProfilePanel');
  if(progress && !progress.hidden && !progress.closest('[hidden]')) return 'progress';
  if(profile && !profile.hidden && !profile.closest('[hidden]')) return 'profile';
  if(window.location.hash==='#sd2ProgressPage') return 'progress';
  if(window.location.hash==='#sd2ProfilePanel') return 'profile';
  return 'dashboard';
}

function syncStudentHeader(){
  const shell=document.getElementById('studentDashboard');
  if(!shell) return;
  const brand=shell.querySelector('.student-dashboard-brand');
  if(!brand) return;
  const copy=HEADER_COPY[currentLanguage()][studentSection()];
  const kicker=brand.querySelector('.student-dashboard-kicker');
  const title=brand.querySelector('h1');
  const description=brand.querySelector('p');
  if(kicker) kicker.textContent=copy.kicker;
  if(title) title.textContent=copy.title;
  if(description) description.textContent=copy.description;
}

const DRAWER_COPY={
  th:{
    dashboard:['แดชบอร์ด','ภาพรวมการเรียน'],
    practice:['ทำแบบฝึกหัด','ฝึกเขียนบันไดเสียง'],
    progress:['ความก้าวหน้า','ติดตามผลการเรียน'],
    profile:['ข้อมูลผู้ใช้','โปรไฟล์ผู้เรียน'],
    refresh:['รีเฟรช','โหลดข้อมูลอีกครั้ง'],
    login:['เข้าสู่ระบบ','เข้าสู่ระบบด้วยบัญชีของคุณ'],
    register:['สมัครสมาชิก','สร้างบัญชีใหม่'],
    forgot:['ลืมรหัสผ่าน','ขอลิงก์ตั้งรหัสผ่านใหม่'],
    logout:['ออกจากระบบ','ออกจากบัญชีนี้']
  },
  en:{
    dashboard:['Dashboard','Learning overview'],
    practice:['Practice','Major scale exercises'],
    progress:['Progress','Track learning progress'],
    profile:['Profile','Learner profile'],
    refresh:['Refresh','Reload data'],
    login:['Sign in','Sign in to your account'],
    register:['Register','Create a new account'],
    forgot:['Forgot password','Request a password reset link'],
    logout:['Sign out','Sign out of this account']
  }
};

function visible(element){return !!element && !element.hidden && !element.closest('[hidden]');}

function drawerSurface(){
  if(visible(document.getElementById('profileOnboardingPanel'))) return 'profile';
  if(visible(document.getElementById('trainerApp'))) return 'practice';
  if(visible(document.getElementById('teacherDashboard'))) return 'teacher';
  if(visible(document.getElementById('studentDashboard'))) return studentSection();
  return 'account';
}

function syncDrawer(){
  const language=currentLanguage();
  const drawer=document.getElementById('appNavigationDrawer');
  const menu=document.getElementById('appNavigationMenuButton');
  if(menu) menu.setAttribute('aria-label',language==='en'?(menu.getAttribute('aria-expanded')==='true'?'Close main navigation':'Open main navigation'):(menu.getAttribute('aria-expanded')==='true'?'ปิดเมนูหลัก':'เปิดเมนูหลัก'));
  if(!drawer) return;
  drawer.setAttribute('data-i18n-ignore','true');
  drawer.setAttribute('aria-label',language==='en'?'Main navigation':'เมนูหลัก');
  const close=document.getElementById('appNavigationCloseButton');
  if(close) close.setAttribute('aria-label',language==='en'?'Close menu':'ปิดเมนู');
  const footer=drawer.querySelector('.app-nav-drawer-foot');
  if(footer) footer.textContent=language==='en'?'This menu is shared across all pages of the web app.':'เมนูนี้ใช้ร่วมกันทุกหน้าของเว็บแอป';
  const surface=document.getElementById('appNavigationSurfaceLabel');
  if(surface){
    const section=drawerSurface();
    const labels=language==='en'
      ? {dashboard:'Student Dashboard',progress:'Progress',profile:'Profile',practice:'Practice',teacher:'Teacher Dashboard',account:'Account'}
      : {dashboard:'แดชบอร์ดผู้เรียน',progress:'ความก้าวหน้า',profile:'ข้อมูลผู้ใช้',practice:'ทำแบบฝึกหัด',teacher:'แดชบอร์ดผู้สอน',account:'บัญชีผู้ใช้'};
    surface.textContent=labels[section] || labels.account;
  }
  drawer.querySelectorAll('[data-app-nav-action]').forEach(button=>{
    const pair=DRAWER_COPY[language][button.dataset.appNavAction];
    if(!pair) return;
    const strong=button.querySelector('.app-nav-item-copy strong');
    const small=button.querySelector('.app-nav-item-copy small');
    if(strong) strong.textContent=pair[0];
    if(small) small.textContent=pair[1];
  });
  const userName=document.getElementById('appNavigationUserName');
  if(userName && ['ผู้ใช้งาน','User'].includes(userName.textContent.trim())) userName.textContent=language==='en'?'User':'ผู้ใช้งาน';
  const userMeta=document.getElementById('appNavigationUserMeta');
  if(userMeta){
    const raw=userMeta.textContent.trim();
    if(['ผู้เรียน','Learner'].includes(raw)) userMeta.textContent=language==='en'?'Learner':'ผู้เรียน';
    if(['ผู้สอน','Teacher'].includes(raw)) userMeta.textContent=language==='en'?'Teacher':'ผู้สอน';
  }
}

function applyStudent(){
  const root=document.getElementById('studentDashboard');
  if(root) applyRoot(root,'student');
  syncStudentHeader();
}

function syncAll(){
  if(applying) return;
  applyStudent();
  applyTrainer();
  syncDrawer();
}

function queueSync(){
  if(queued) return;
  queued=true;
  requestAnimationFrame(()=>{
    queued=false;
    syncAll();
  });
}

function wrapDialogs(){
  if(!window.__majorScaleI18nAlertWrapped && typeof window.alert==='function'){
    const original=window.alert.bind(window);
    window.alert=message=>original(translateText(message,currentLanguage(),'trainer').trim());
    window.__majorScaleI18nAlertWrapped=true;
  }
  if(!window.__majorScaleI18nConfirmWrapped && typeof window.confirm==='function'){
    const original=window.confirm.bind(window);
    window.confirm=message=>original(translateText(message,currentLanguage(),'trainer').trim());
    window.__majorScaleI18nConfirmWrapped=true;
  }
}

function start(){
  if(started || !document.documentElement) return;
  started=true;
  wrapDialogs();
  syncAll();
  window.addEventListener('major-scale:languagechange',queueSync);
  window.addEventListener('hashchange',queueSync);
  window.addEventListener('major-scale-trainer-visible',queueSync);
  window.addEventListener('major-scale-question-result',queueSync);
  observer=new MutationObserver(mutations=>{
    if(applying) return;
    const relevant=mutations.some(mutation=>{
      const target=mutation.target?.nodeType===Node.ELEMENT_NODE?mutation.target:mutation.target?.parentElement;
      if(!target) return false;
      return !!target.closest?.('#studentDashboard,#trainerApp,#appNavigationDrawer,#appNavigationMenuButton,#authScreen,#teacherDashboard');
    });
    if(relevant) queueSync();
  });
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','aria-expanded','aria-label','title','placeholder']});
}

function bootstrap(tries=80){
  if(app.i18n || tries<=0){
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
    else start();
    return;
  }
  setTimeout(()=>bootstrap(tries-1),25);
}

app.i18nPolish=Object.freeze({translateText,sync:syncAll});
bootstrap();
})();
