'use strict';

const fs=require('fs');
const path=require('path');
const assert=require('assert');
const ROOT=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');

const auth=read('src/data/auth.repository.js');
const labels=read('src/skill-label-localization.js');
const theme=read('styles/unified-theme.css');

assert(auth.includes("./src/skill-label-localization.js?v=20260913-1"),'auth bootstrap must load skill-label localization');
assert(auth.includes("./styles/unified-theme.css?v=20260913-2"),'auth bootstrap must load current unified visual theme');

const expected=[
  ['Treble Pitch','ระดับเสียงบนกุญแจซอล (Treble Pitch)'],
  ['Stem Direction','ทิศก้านโน้ต (Stem Direction)'],
  ['Duration Value','ค่าความยาวโน้ต (Duration Value)'],
  ['Primary Beam','การเชื่อมบีมหลัก (Primary Beam)'],
  ['Scale Accidental','เครื่องหมายแปลงเสียงของบันไดเสียง (Scale Accidental)']
];
for(const [en,th] of expected){
  assert(labels.includes(`'${en}':'${th}'`),`${en} must have Thai + English learner label`);
}
assert(labels.includes("#dashboardContent,#sd2ProgressPage"),'skill localization must be limited to learner Dashboard and Progress');
assert(labels.includes("live==='th'||live==='en'"),'skill labels must follow the active language');
assert(labels.includes("if(lang==='th')"),'Thai mode must use Thai labels with English in parentheses');
assert(labels.includes("if(REVERSE.has(text)) return REVERSE.get(text)"),'English mode must restore English-only labels');

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
assert(!/service_role/i.test(labels+theme),'UI localization/theme files must not contain backend secrets');

console.log('PASS learner skill labels + yellow/charcoal visual identity across auth, dashboards, progress, profile, teacher and navigation');
