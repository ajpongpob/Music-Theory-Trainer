'use strict';

const fs=require('fs');
const path=require('path');
const assert=require('assert');
const ROOT=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');
const i18n=read('src/i18n.js');
const authRepository=read('src/data/auth.repository.js');

assert(i18n.includes("const STORAGE_KEY='major-scale-trainer.language'"),'language preference must use a stable localStorage key');
assert(i18n.includes("const DEFAULT_LANGUAGE='th'"),'Thai must remain the default language');
assert(i18n.includes("SUPPORTED=new Set(['th','en'])"),'Thai and English must be the supported language modes');
assert(i18n.includes("document.documentElement.lang=language"),'document lang must follow the selected language');
assert(i18n.includes("localStorage.setItem(STORAGE_KEY,language)"),'selected language must persist across reloads');
assert(i18n.includes("id='appLanguageControl'") || i18n.includes("control.id='appLanguageControl'"),'language selector must be created at runtime');
assert(i18n.includes("new MutationObserver"),'dynamic Dashboard/Progress/Profile content must be translated after rendering');
assert(i18n.includes("major-scale:languagechange"),'language changes must publish an application event');
assert(i18n.includes("['ภาพรวมความก้าวหน้าทั้งระบบ','Overall learning progress']"),'Progress heading must have a bilingual pair');
assert(i18n.includes("['ชื่อเล่น','Nickname']"),'Profile fields must have bilingual pairs');
assert(i18n.includes("['ตรวจคำตอบ','Check answer']"),'Practice controls must have bilingual pairs');
assert(authRepository.includes("script.src = './src/i18n.js?v=20260913-1'"),'production runtime must load the shared i18n layer from an existing bootstrap surface');
assert(!/service_role/i.test(i18n),'language layer must not contain backend secrets');

console.log('PASS i18n contract: Thai/English selector, persistence, dynamic UI translation, semantic coverage and secret boundary');
