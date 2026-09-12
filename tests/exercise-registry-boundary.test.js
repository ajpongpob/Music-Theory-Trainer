'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const html = read('index.html');
const student = read('src/dashboard/student-dashboard.js');
const trainer = read('src/trainer.js');
const contract = read('src/exercises/exercise-contract.js');
const registry = read('src/exercises/exercise-registry.js');
const definition = read('src/exercises/major-scale/exercise.definition.js');

const order = [
  './src/exercises/exercise-contract.js',
  './src/exercises/exercise-registry.js',
  './src/exercises/major-scale/exercise.definition.js',
  './src/dashboard/dashboard-utils.js',
  './src/dashboard/student-dashboard.js',
  './src/trainer.js'
].map(src => html.indexOf(`src="${src}"`));
assert(order.every(i => i >= 0), 'all registry/runtime scripts must be loaded');
for (let i=1;i<order.length;i++) {
  assert(order[i] > order[i-1], 'exercise scripts must load in dependency order before consumers');
}

assert(!contract.includes('document.'), 'exercise contract must not access DOM');
assert(!registry.includes('document.'), 'exercise registry must not access DOM');
assert(!definition.includes('document.'), 'exercise definition must not access DOM');
assert(!contract.includes('supabase'), 'exercise contract must not know Supabase');
assert(!registry.includes('supabase'), 'exercise registry must not know Supabase');
assert(!definition.includes('supabase'), 'exercise definition must not know Supabase');

// v0.8.0-a is intentionally non-invasive: runtime remains legacy until v0.8.0-b.
assert(student.includes("exerciseCode!=='MAJOR_SCALE_NOTATION'"), 'student runtime routing must remain legacy in v0.8.0-a');
assert(trainer.includes('window.majorScaleTrainerStartForAuthenticatedUser'), 'legacy Major Scale runtime must remain intact');
assert(!student.includes('exerciseRegistry.get('), 'Dashboard must not consume registry until v0.8.0-b');

console.log('PASS exercise registry boundary');
