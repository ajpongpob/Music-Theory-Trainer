(() => {
'use strict';

const app = window.MajorScaleApp = window.MajorScaleApp || {};

const CONTRACT_VERSION = '1.0';
const CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/;

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function requireNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`Exercise definition requires non-empty ${fieldName}`);
  }
  return value.trim();
}

function normalizeCapabilities(value) {
  if (value == null) return Object.freeze({});
  if (!isPlainObject(value)) {
    throw new TypeError('Exercise definition capabilities must be an object');
  }

  const normalized = {};
  for (const [key, enabled] of Object.entries(value)) {
    requireNonEmptyString(key, 'capability name');
    if (typeof enabled !== 'boolean') {
      throw new TypeError(`Exercise capability ${key} must be boolean`);
    }
    normalized[key] = enabled;
  }
  return Object.freeze(normalized);
}

function normalizeExerciseDefinition(definition) {
  if (!isPlainObject(definition)) {
    throw new TypeError('Exercise definition must be an object');
  }

  const code = requireNonEmptyString(definition.code, 'code');
  if (!CODE_PATTERN.test(code)) {
    throw new TypeError(`Invalid exercise code: ${code}`);
  }

  const contractVersion = requireNonEmptyString(
    definition.contractVersion || CONTRACT_VERSION,
    'contractVersion'
  );
  if (contractVersion !== CONTRACT_VERSION) {
    throw new TypeError(
      `Unsupported exercise contract version ${contractVersion}; expected ${CONTRACT_VERSION}`
    );
  }

  if (!isPlainObject(definition.name)) {
    throw new TypeError('Exercise definition requires name object');
  }
  const nameTh = requireNonEmptyString(definition.name.th, 'name.th');
  const nameEn = definition.name.en == null
    ? null
    : requireNonEmptyString(definition.name.en, 'name.en');

  const description = definition.description == null
    ? null
    : requireNonEmptyString(definition.description, 'description');

  const normalized = {
    contractVersion,
    code,
    name: Object.freeze({th: nameTh, en: nameEn}),
    description,
    capabilities: normalizeCapabilities(definition.capabilities),
    metadata: Object.freeze(
      isPlainObject(definition.metadata) ? {...definition.metadata} : {}
    )
  };

  return Object.freeze(normalized);
}

app.exerciseContract = Object.freeze({
  version: CONTRACT_VERSION,
  codePattern: CODE_PATTERN,
  normalize: normalizeExerciseDefinition
});
})();
