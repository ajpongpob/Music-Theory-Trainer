'use strict';

const fs=require('fs');
const path=require('path');
const assert=require('assert');
const ROOT=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');

const polish=read('src/i18n-ui-polish.js');
const auth=read('src/data/auth.repository.js');

assert(auth.includes("script.src = './src/i18n-ui-polish.js?v=20260913-2'"),'auth bootstrap must load the UI localization polish layer');
assert(polish.includes("['การเขียนบันไดเสียงเมเจอร์','Major Scale Notation']"),'exercise name must translate in English mode');
assert(polish.includes("['ล้างคำตอบ','Clear answer']"),'clear-answer control must translate');
assert(polish.includes("['＋ โน้ต','＋ Note']"),'mobile add-note control must translate');
assert(polish.includes("['เลือกหลายโน้ต','Select multiple notes']"),'mobile multi-select control must translate');
assert(polish.includes('Complete ${n} more practice item'),'dynamic insufficient-evidence recommendation must translate');
assert(polish.includes("progress:['ความก้าวหน้า','รายละเอียดความก้าวหน้าการเรียน'"),'Thai Progress header must be section-specific');
assert(polish.includes("progress:['Progress','Learning Progress'"),'English Progress header must be section-specific');
assert(polish.includes("next=next.replace(/\\bMastery\\b/gu,'การผ่านเกณฑ์')"),'Thai learner views must replace Mastery with Thai wording');
assert(polish.includes("next=next.replace(/\\bStage\\b/gu,'ขั้น')"),'Thai learner views must replace Stage with Thai wording');
assert(polish.includes("next=next.replace(/\\bsession\\b/gu,'ครั้งการฝึก')"),'Thai learner views must replace session with Thai wording');
assert(polish.includes("dashboard:['แดชบอร์ด','ภาพรวมการเรียน']"),'Thai drawer labels must stay Thai');
assert(polish.includes("dashboard:['Dashboard','Learning overview']"),'English drawer labels must stay English');
assert(polish.includes("drawer.setAttribute")===false,'drawer localization should use guarded attribute updates rather than unconditional rewrites');
assert(!/service_role/i.test(polish),'localization layer must not contain backend secrets');

console.log('PASS i18n UI polish: Progress header, exercise controls, dynamic stage/item copy, Thai terminology and drawer language consistency');
