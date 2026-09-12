'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const trainer = read('src/trainer.js');
const student = read('src/dashboard/student-dashboard.js');
const teacher = read('src/dashboard/teacher-dashboard.js');
const practiceRepo = read('src/data/practice.repository.js');
const masteryRepo = read('src/data/mastery.repository.js');
const html = read('index.html');

for (const [label, pattern] of [
  ['legacy Supabase bridge', /window\.majorScaleSupabase/],
  ['direct client.from()', /\bclient\s*\.\s*from\s*\(/],
  ['direct client.rpc()', /\bclient\s*\.\s*rpc\s*\(/],
  ['direct auth.getUser()', /\bclient\s*\.\s*auth\s*\.\s*getUser\s*\(/],
  ['direct supabaseClient access', /MajorScaleApp[^\n;]*supabaseClient/]
]) {
  assert(!pattern.test(trainer), `trainer.js must not use ${label}`);
}
for (const [name, source] of [['student-dashboard.js',student],['teacher-dashboard.js',teacher]]) {
  assert(!source.includes('.from('), `${name} must not call .from() directly`);
  assert(!source.includes('.rpc('), `${name} must not call .rpc() directly`);
}
for (const [name, source] of [['practice.repository.js',practiceRepo],['mastery.repository.js',masteryRepo]]) {
  assert(!source.includes('document.'), `${name} must not access DOM`);
  assert(!source.includes('getElementById'), `${name} must not access UI elements`);
}

const expectedTables = {
  practice: ['exercises','exercise_stages','practice_sessions','attempts','attempt_skill_results'],
  mastery: ['exercises','exercise_stages','student_stage_progress','stage_required_items','practice_sessions','attempts']
};
for (const table of expectedTables.practice) assert(practiceRepo.includes(`'${table}'`), `practice repository missing ${table}`);
for (const table of expectedTables.mastery) assert(masteryRepo.includes(`'${table}'`), `mastery repository missing ${table}`);
assert(masteryRepo.includes("'get_my_stage_mastery'"), 'mastery repository missing get_my_stage_mastery RPC');
assert(masteryRepo.includes("'advance_my_stage_if_mastered'"), 'mastery repository missing progression RPC');

const scripts = [...html.matchAll(/<script\s+src="\.\/(src\/[^\"]+\.js)"/g)].map(m => m[1]);
const indexOf = file => {
  const index = scripts.indexOf(file);
  assert(index >= 0, `${file} missing from index.html`);
  return index;
};
assert(indexOf('src/data/supabase-client.js') < indexOf('src/data/practice.repository.js'));
assert(indexOf('src/data/supabase-client.js') < indexOf('src/data/mastery.repository.js'));
assert(indexOf('src/data/auth.repository.js') < indexOf('src/trainer.js'));
assert(indexOf('src/data/practice.repository.js') < indexOf('src/trainer.js'));
assert(indexOf('src/data/mastery.repository.js') < indexOf('src/trainer.js'));
assert(indexOf('src/trainer.js') < indexOf('src/keyboard.js'));

const allJs = [];
(function walk(dir){
  for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.js')) allJs.push(full);
  }
})(path.join(ROOT, 'src'));

let publishableOccurrences = 0;
for (const file of allJs) {
  const source = fs.readFileSync(file, 'utf8');
  assert(!/service[_-]?role/i.test(source), `service_role-like secret marker found in ${path.relative(ROOT,file)}`);
  publishableOccurrences += (source.match(/sb_publishable_/g) || []).length;
}
assert.strictEqual(publishableOccurrences, 1, 'publishable key should exist exactly once in src');

console.log('PASS architecture boundaries and script load order');
