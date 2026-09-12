'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const context = {
  window: {},
  console,
  Object,
  Array,
  String,
  Boolean,
  Map,
  Error,
  TypeError
};
context.globalThis = context.window;
vm.createContext(context);

for (const rel of [
  'src/domain/notation/notation-core.js',
  'src/exercises/exercise-contract.js',
  'src/exercises/exercise-registry.js',
  'src/exercises/major-scale/major-scale.config.js',
  'src/exercises/major-scale/major-scale.domain.js',
  'src/exercises/major-scale/exercise.definition.js'
]) {
  vm.runInContext(read(rel), context, {filename: rel});
}

const app = context.window.MajorScaleApp;
assert(app.exerciseContract, 'exerciseContract must be exposed');
assert.strictEqual(app.exerciseContract.version, '1.0');
assert(app.exerciseRegistry, 'exerciseRegistry must be exposed');

assert.strictEqual(app.exerciseRegistry.has('MAJOR_SCALE_NOTATION'), true);
assert.strictEqual(app.exerciseRegistry.has('major_scale_notation'), true, 'registry lookup should normalize code');
assert.strictEqual(app.exerciseRegistry.list().length, 1, 'checkpoint must register exactly one exercise');

const major = app.exerciseRegistry.get('MAJOR_SCALE_NOTATION');
assert(major, 'Major Scale definition must be registered');
assert.strictEqual(major.code, 'MAJOR_SCALE_NOTATION');
assert.strictEqual(major.name.th, 'การเขียนบันไดเสียงเมเจอร์');
assert.strictEqual(major.capabilities.staged, true);
assert.strictEqual(major.capabilities.mastery, true);
assert.strictEqual(major.capabilities.notation, true);
assert.strictEqual(major.metadata.runtimeStatus, 'legacy-trainer');
assert.strictEqual(major.metadata.migrationCheckpoint, 'v0.8.1-a');
assert(Object.isFrozen(major), 'registered definition should be frozen');
assert(Object.isFrozen(major.name), 'exercise name should be frozen');
assert(Object.isFrozen(major.capabilities), 'exercise capabilities should be frozen');
assert(Object.isFrozen(major.metadata), 'exercise metadata should be frozen');

assert.throws(
  () => app.exerciseRegistry.register({code:'bad-code',name:{th:'Bad'}}),
  /Invalid exercise code/
);
assert.throws(
  () => app.exerciseRegistry.register({code:'VALID_CODE',name:{th:''}}),
  /name\.th/
);
assert.throws(
  () => app.exerciseRegistry.register({code:'MAJOR_SCALE_NOTATION',name:{th:'Duplicate'}}),
  /already registered/
);
assert.throws(
  () => app.exerciseContract.normalize({code:'OTHER',contractVersion:'2.0',name:{th:'Other'}}),
  /Unsupported exercise contract version/
);

console.log('PASS exercise registry contract');
