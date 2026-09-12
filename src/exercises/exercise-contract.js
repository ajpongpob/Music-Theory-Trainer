(() => {
'use strict';

const app = window.MajorScaleApp = window.MajorScaleApp || {};

const CONTRACT_VERSION = '1.0';
const CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/;

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') return false;

  const prototype = Object.getPrototypeOf(value);
  if (prototype === null) return true;

  const constructor = Object.prototype.hasOwnProperty.call(prototype, 'constructor')
    ? prototype.constructor
    : null;

  return typeof constructor === 'function'
    && Function.prototype.toString.call(constructor)
      === Function.prototype.toString.call(Object);
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
    throw new TypeError('Exercise definition capabilities must be a plain object');
  }

  const normalized = {};
  const normalizedKeys = new Set();
  for (const [key, enabled] of Object.entries(value)) {
    const normalizedKey = requireNonEmptyString(key, 'capability name');
    if (normalizedKeys.has(normalizedKey)) {
      throw new TypeError(
        `Duplicate exercise capability after normalization: ${normalizedKey}`
      );
    }
    if (typeof enabled !== 'boolean') {
      throw new TypeError(`Exercise capability ${normalizedKey} must be boolean`);
    }
    normalizedKeys.add(normalizedKey);
    Object.defineProperty(normalized, normalizedKey, {
      value: enabled,
      enumerable: true,
      writable: true,
      configurable: true
    });
  }
  return Object.freeze(normalized);
}

function cloneMetadataValue(value, path, ancestors) {
  if (Array.isArray(value)) {
    if (ancestors.has(value)) {
      throw new TypeError(`Exercise definition ${path} must not contain circular references`);
    }
    ancestors.add(value);
    const clone = value.map((item, index) =>
      cloneMetadataValue(item, `${path}[${index}]`, ancestors)
    );
    ancestors.delete(value);
    return clone;
  }

  if (isPlainObject(value)) {
    if (ancestors.has(value)) {
      throw new TypeError(`Exercise definition ${path} must not contain circular references`);
    }
    ancestors.add(value);
    const clone = {};
    for (const [key, item] of Object.entries(value)) {
      Object.defineProperty(clone, key, {
        value: cloneMetadataValue(item, `${path}.${key}`, ancestors),
        enumerable: true,
        writable: true,
        configurable: true
      });
    }
    ancestors.delete(value);
    return clone;
  }

  if (value !== null && (typeof value === 'object' || typeof value === 'function')) {
    throw new TypeError(
      `Exercise definition ${path} must contain only plain objects, arrays, and primitive values`
    );
  }

  return value;
}

function deepFreeze(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function normalizeMetadata(value) {
  if (value == null) return Object.freeze({});
  if (!isPlainObject(value)) {
    throw new TypeError('Exercise definition metadata must be a plain object');
  }

  return deepFreeze(
    cloneMetadataValue(value, 'metadata', new WeakSet())
  );
}

function normalizeExerciseDefinition(definition) {
  if (!isPlainObject(definition)) {
    throw new TypeError('Exercise definition must be an object');
  }

  const code = requireNonEmptyString(definition.code, 'code').toUpperCase();
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

  let runtime;
  if (definition.runtime != null) {
    if (!isPlainObject(definition.runtime)
      || typeof definition.runtime.launch !== 'function'
      || typeof definition.runtime.close !== 'function') {
      throw new TypeError('Exercise runtime requires launch and close functions');
    }
    runtime = Object.freeze({launch:definition.runtime.launch, close:definition.runtime.close});
  }
  const normalized = {
    contractVersion,
    code,
    name: Object.freeze({th: nameTh, en: nameEn}),
    description,
    capabilities: normalizeCapabilities(definition.capabilities),
    metadata: normalizeMetadata(definition.metadata)
  };

  if (runtime) normalized.runtime = runtime;

  return Object.freeze(normalized);
}

app.exerciseContract = Object.freeze({
  version: CONTRACT_VERSION,
  codePattern: CODE_PATTERN,
  normalize: normalizeExerciseDefinition
});
})();
