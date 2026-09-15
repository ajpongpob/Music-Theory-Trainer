'use strict';

const fs=require('fs');
const path=require('path');
const assert=require('assert');
const ROOT=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');

const auth=read('src/data/auth.repository.js');
const labels=read('src/skill-label-localization.js');
const consistency=read('src/i18n-mode-consistency.js');
const theme=read('styles/unified-theme.css');

assert(auth.includes("./src/skill-label-localization.js?v=20260915-language-1"),'auth bootstrap must load current skill-label localization');
assert(auth.includes("./src/i18n-mode-consistency.js?v=20260915-language-1"),'auth bootstrap must load final language-consistency guard');
assert(auth.includes("./styles/unified-theme.css?v=20260913-2"),'auth bootstrap must load current unified visual theme');

const expected=[
  ['Treble Pitch','ระดับเสียงบนกุญแจซอล'],
  ['Stem Direction','ทิศก้านโน้ต'],
  ['Duration Value','ค่าความยาวตัวโน้ต'],
  ['Primary Beam','การเชื่อมเขบ็ตหลัก'],
  ['Scale Accidental','เครื่องหมายแปลงเสียงของบันไดเสียง']
];
for(const [en,th] of expected){
  assert(labels.includes(`'${en}':'${th}'`),`${en} must have a Thai-only label for Thai mode`);
}
assert(!labels.includes("'Treble Pitch':'ระดับเสียงบนกุญแจซอล (Treble Pitch)'"),'Thai skill labels must no longer duplicate English in parentheses');
assert(labels.includes("return language()==='th' ? SKILLS[english] : english"),'skill labels must render exactly one language at a time');
assert(labels.includes("#dashboardContent,#sd2ProgressPage,#levelMasteryOverlay,#sessionSummary"),'skill localization must cover learner progress and mastery result surfaces');
assert(labels.includes("live==='th'||live==='en'"),'skill labels must follow the active language');
assert(consistency.includes(".replace(/(?:Stage|Level)\\s+(\\d+|—)/giu,'ระดับที่ $1')"),'Thai mode must render numbered levels as ระดับที่ N');
assert(consistency.includes(".replace(/(?:ขั้นที่|ระดับที่)\\s*(\\d+|—)/gu,'Level $1')"),'English mode must render numbered levels as Level N');
assert(consistency.includes("const PAIRS=Object.freeze"),'final consistency layer must provide explicit bilingual UI vocabulary');
assert(consistency.includes("function audit(root=document.body)"),'language consistency layer must expose a leakage audit');

for(const token of ['--unity-bg:#f4f4f1','--unity-surface:#ffffff','--unity-text:#1c1c1a','--unity-line:#dddcd4','--unity-accent:#f5b916','--unity-dark:#20201e','--unity-good:#15803d','--unity-bad:#b42318']){
  assert(theme.includes(token),`unified theme must include yellow/charcoal token ${token}`);
}
for(const selector of ['.auth-screen','.sd2-card','#teacherDashboard .dashboard-card','.app-nav-drawer','.app-nav-item[aria-current="page"]','.sd2-continue','.sd2-card>.sd2-section-head']){
  assert(theme.includes(selector),`unified theme must cover ${selector}`);
}
assert(theme.includes('background:var(--unity-accent)!important'),'important UI states must use the shared yellow accent');
assert(theme.includes('background:var(--unity-dark)!important'),'major hierarchy surfaces must use charcoal contrast');
assert(theme.includes('.sd2-status.mastered{color:var(--unity-good)'),'success status must retain semantic green');
assert(theme.includes('.sd2-status.needs-practice{color:var(--unity-bad)'),'error/needs-practice status must retain semantic red');
assert(!theme.includes('#trainerApp .card'),'unified theme must not directly restyle trainer cards');
assert(!/service_role/i.test(labels+consistency+theme),'UI localization/theme files must not contain backend secrets');

console.log('PASS single-language skill labels + Level terminology + yellow/charcoal visual identity');
