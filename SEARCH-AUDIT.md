# Shared core boundary search — v0.8.1-a

Production inventory for exercise code, stage assumptions/config and the inherited key table:

| Location | Term | Classification |
|---|---|---|
| `src/exercises/major-scale/major-scale.config.js:16` | LEVEL_KEYS | EXPECTED: exercise-specific config/domain |
| `src/exercises/major-scale/major-scale.config.js:63` | LEVEL_KEYS, MAJOR_SCALE_NOTATION | EXPECTED: exercise-specific config/domain |
| `src/exercises/major-scale/major-scale.domain.js:4` | LEVEL_KEYS | EXPECTED: exercise-specific config/domain |
| `src/exercises/major-scale/major-scale.domain.js:71` | LEVEL_KEYS | EXPECTED: exercise-specific config/domain |
| `src/exercises/major-scale/major-scale.domain.js:103` | LEVEL_KEYS | EXPECTED: exercise-specific config/domain |
| `src/trainer.js:8` | LEVEL_KEYS | EXPECTED LEGACY BRIDGE: external stage-config alias, no copy into core |
| `src/trainer.js:1399` | keyAcc | INHERITED COUPLING: staffStepToPitch key-signature table/use; remains unchanged in legacy Trainer |
| `src/trainer.js:1420` | keyAcc | INHERITED COUPLING: staffStepToPitch key-signature table/use; remains unchanged in legacy Trainer |
| `src/trainer.js:2327` | LEVEL_KEYS | EXPECTED LEGACY BRIDGE: external stage-config alias, no copy into core |
| `src/trainer.js:2868` | LEVEL_KEYS | EXPECTED LEGACY BRIDGE: external stage-config alias, no copy into core |
| `src/trainer.js:3712` | LEVEL_KEYS | EXPECTED LEGACY BRIDGE: external stage-config alias, no copy into core |

No requested exercise/stage token occurs under src/domain/notation/. The only `MajorScale` text in the core is the pre-existing `MajorScaleApp` namespace name; it does not carry musical rules. No key pools, major intervals or spelling logic moved into the core. The shared private LETTERS alphabet is generic diatonic data.

Major Scale KEYS/LEVEL_KEYS arrays remain in major-scale.config.js, and spelling remains in major-scale.domain.js. Trainer's existing staffStepToPitch function still has the keyAcc table and state.key access, used by insertNoteAtCursor. This is inherited legacy coupling, deliberately not changed during pure-core extraction. Accidentals for a scale are not chosen by the core; only an already supplied symbol is mapped to its original offset.

Tests/fixtures/docs retain historical exercise codes/stage strings as reference data, not runtime routing. Host/Dashboard contain no Major Scale literal routing. Source reconstruction verifies these boundaries without blind search-and-replace.
