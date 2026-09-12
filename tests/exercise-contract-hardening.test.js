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
  Function,
  Date,
  Map,
  Set,
  WeakSet,
  Error,
  TypeError
};
context.globalThis = context.window;
vm.createContext(context);

for (const rel of [
  'src/exercises/exercise-contract.js',
  'src/exercises/exercise-registry.js',
  'src/exercises/major-scale/major-scale.config.js',
  'src/exercises/major-scale/exercise.definition.js'
]) {
  vm.runInContext(read(rel), context, {filename: rel});
}

const registry = context.window.MajorScaleApp.exerciseRegistry;
let serial = 0;

function register(overrides = {}) {
  serial += 1;
  return registry.register({
    code: `HARDENING_${serial}`,
    name: {th: `ทดสอบ ${serial}`},
    ...overrides
  });
}

function assertMutationRejected(mutator, message) {
  let rejected = false;
  try {
    mutator();
  } catch (_error) {
    rejected = true;
  }
  assert.strictEqual(rejected, true, message);
}

// Metadata accepts only nullish values or a plain object at the root.
for (const metadata of [undefined, null, {}]) {
  const definition = register({metadata});
  assert.deepStrictEqual({...definition.metadata}, {});
  assert(Object.isFrozen(definition.metadata));
}

const callerMetadata = {
  ui: {mode: 'notation'},
  groups: [{name: 'rhythm', items: ['quarter', 'eighth']}]
};
const callerCapabilities = {notation: true};
const immutable = register({
  metadata: callerMetadata,
  capabilities: callerCapabilities
});

assert.notStrictEqual(immutable.metadata, callerMetadata, 'metadata must be cloned');
assert.notStrictEqual(immutable.metadata.ui, callerMetadata.ui, 'nested metadata must be cloned');
assert.notStrictEqual(immutable.metadata.groups, callerMetadata.groups, 'nested arrays must be cloned');
assert.notStrictEqual(immutable.capabilities, callerCapabilities, 'capabilities must be normalized into a new object');
assert(Object.isFrozen(immutable), 'definition must be frozen');
assert(Object.isFrozen(immutable.metadata), 'metadata must be frozen');
assert(Object.isFrozen(immutable.metadata.ui), 'nested metadata object must be frozen');
assert(Object.isFrozen(immutable.metadata.groups), 'nested metadata array must be frozen');
assert(Object.isFrozen(immutable.metadata.groups[0]), 'object inside metadata array must be frozen');
assert(Object.isFrozen(immutable.metadata.groups[0].items), 'nested metadata array must be deeply frozen');
assert(Object.isFrozen(immutable.capabilities), 'capabilities must be frozen');

assertMutationRejected(() => { immutable.description = 'changed'; }, 'top-level mutation must fail');
assertMutationRejected(() => { immutable.metadata.extra = true; }, 'metadata mutation must fail');
assertMutationRejected(() => { immutable.metadata.ui.mode = 'changed'; }, 'nested metadata mutation must fail');
assertMutationRejected(() => { immutable.metadata.groups.push({}); }, 'nested array mutation must fail');
assertMutationRejected(() => { immutable.capabilities.notation = false; }, 'capabilities mutation must fail');

callerMetadata.ui.mode = 'caller-changed';
callerMetadata.groups[0].items.push('whole');
callerCapabilities.notation = false;
assert.strictEqual(immutable.metadata.ui.mode, 'notation', 'caller mutation must not reach Registry metadata');
assert.deepStrictEqual([...immutable.metadata.groups[0].items], ['quarter', 'eighth']);
assert.strictEqual(immutable.capabilities.notation, true, 'caller mutation must not reach Registry capabilities');

for (const invalidMetadata of ['abc', [], 123, true, () => {}, new Date()]) {
  assert.throws(
    () => register({metadata: invalidMetadata}),
    /metadata must be a plain object/,
    `metadata ${Object.prototype.toString.call(invalidMetadata)} must be rejected`
  );
}

// Capabilities normalize names, require booleans, and reject collisions.
const normalCapability = register({capabilities: {notation: true}});
assert.deepStrictEqual({...normalCapability.capabilities}, {notation: true});

const paddedCapability = register({capabilities: {' notation ': true}});
assert.deepStrictEqual({...paddedCapability.capabilities}, {notation: true});
assert.strictEqual(Object.prototype.hasOwnProperty.call(paddedCapability.capabilities, ' notation '), false);

assert.throws(
  () => register({capabilities: {'   ': true}}),
  /non-empty capability name/
);
assert.throws(
  () => register({capabilities: {notation: 'true'}}),
  /must be boolean/
);
assert.throws(
  () => register({capabilities: {notation: true, ' notation ': false}}),
  /Duplicate exercise capability after normalization: notation/
);

// Exercise codes normalize for registration and lookup without changing API results.
const lowercase = register({code: 'lowercase_code'});
assert.strictEqual(lowercase.code, 'LOWERCASE_CODE');
assert.strictEqual(registry.get('lowercase_code'), lowercase);

const paddedCode = register({code: '  padded_code  '});
assert.strictEqual(paddedCode.code, 'PADDED_CODE');
assert.strictEqual(registry.get('  padded_code  '), paddedCode);

assert.throws(
  () => register({code: '   '}),
  /non-empty code/
);

const duplicate = register({code: 'duplicate_code'});
assert.throws(
  () => register({code: '  DUPLICATE_CODE  '}),
  /Exercise already registered: DUPLICATE_CODE/
);
assert.strictEqual(registry.get('duplicate_code'), duplicate);

assert.strictEqual(registry.get('UNKNOWN_EXERCISE'), null);
assert.strictEqual(registry.has('UNKNOWN_EXERCISE'), false);
assert.strictEqual(registry.get('  major_scale_notation  ').code, 'MAJOR_SCALE_NOTATION');

const listed = registry.list();
assert(Array.isArray(listed));
assert(listed.includes(context.window.MajorScaleApp.exerciseRegistry.get('MAJOR_SCALE_NOTATION')));
listed.length = 0;
assert.strictEqual(registry.has('MAJOR_SCALE_NOTATION'), true, 'mutating list result must not mutate Registry');

console.log('PASS exercise contract hardening adversarial cases');
