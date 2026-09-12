(() => {
'use strict';

const app = window.MajorScaleApp = window.MajorScaleApp || {};
const contract = app.exerciseContract;

if (!contract || typeof contract.normalize !== 'function') {
  throw new Error('Exercise contract must load before Exercise Registry');
}

const definitions = new Map();

function normalizeCode(code) {
  if (typeof code !== 'string') return '';
  return code.trim().toUpperCase();
}

const registry = {
  register(definition) {
    const normalized = contract.normalize(definition);
    if (definitions.has(normalized.code)) {
      throw new Error(`Exercise already registered: ${normalized.code}`);
    }
    definitions.set(normalized.code, normalized);
    return normalized;
  },

  has(code) {
    return definitions.has(normalizeCode(code));
  },

  get(code) {
    return definitions.get(normalizeCode(code)) || null;
  },

  list() {
    return Array.from(definitions.values());
  }
};

app.exerciseRegistry = Object.freeze(registry);
})();
