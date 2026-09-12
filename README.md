# Major Scale Notation Trainer v0.8.0-a

Baseline: deployed-and-user-verified v0.7.5.

## Scope

v0.8.0-a introduces the first Generic Exercise Platform boundary without changing runtime behavior.

### Added

- `src/exercises/exercise-contract.js`
  - Defines Exercise Definition Contract v1.0.
  - Validates exercise identity, localized names, capabilities, and metadata.
  - Has no DOM, Supabase, notation, or scoring dependencies.
- `src/exercises/exercise-registry.js`
  - Registers and resolves exercise definitions by `exercise_code`.
  - Rejects duplicate or invalid definitions.
- `src/exercises/major-scale/exercise.definition.js`
  - Registers `MAJOR_SCALE_NOTATION` as the first platform exercise definition.
  - Metadata only at this checkpoint; it does not replace the existing trainer runtime.

### Intentionally unchanged

- Student Dashboard still opens the legacy Major Scale runtime directly.
- `trainer.js` retains all Major Scale generation, notation, scoring, session, and progression behavior.
- Notation algorithms, beaming, note input, answer checking, mastery rules, database schema, RPCs, and repositories are unchanged.
- No second exercise is added.
- No Exercise Host lifecycle is active yet.

## Why this checkpoint exists

The registry becomes a stable source of exercise identity before routing/runtime behavior changes. v0.8.0-b can therefore connect Dashboard → Exercise Host → Registry as a separate, testable change.

## Tests

```bash
for t in tests/*.test.js; do node "$t" || exit 1; done
```
