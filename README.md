# Major Scale Notation Trainer v0.7.4

## Purpose of this checkpoint

v0.7.4 introduces the **Practice / Mastery Data Repository Layer** while preserving the behavior of the deployed-and-tested v0.7.3 baseline.

### Changed
- Added `src/data/practice.repository.js`.
- Added `src/data/mastery.repository.js`.
- `trainer.js` no longer calls Supabase `.from()`, `.rpc()`, or `auth.getUser()` directly.
- Practice-session, attempt, skill-evidence, Stage-progress, and Mastery data access now passes through repositories.
- Existing Trainer control flow still decides when to create/close sessions, save evidence, refresh mastery, and advance stages.
- Added repository contract tests, Trainer success-path smoke tests, error-path safeguard tests, and architecture-boundary tests.
- Updated application/session version to `0.7.4`.

### Intentionally NOT changed
- Major Scale question generation
- Notation engine / rendering
- Note input / dragging / range selection
- Accidentals
- Stem-direction logic
- Primary or secondary beaming
- Scoring / answer checking
- LO evidence computation
- `STAGE_n` <-> Level mapping
- Mastery decision rules on the backend
- Database schema / RPC definitions / RLS
- Student / Teacher Dashboard rendering logic

## Runtime architecture after v0.7.4

```text
Auth UI ----------------> auth.repository.js ---------> Supabase Auth / profiles
Student/Teacher UI -----> dashboard.repository.js ----> Dashboard RPCs / read models

Major Scale Trainer
      |
      +--> practice.repository.js --------------------> sessions / attempts / skill evidence
      |
      +--> mastery.repository.js ---------------------> stage progress / mastery / progression RPC
      |
      +--> Trainer/domain logic remains responsible for control flow and notation behavior
```

The Trainer is still Major-Scale-specific at this checkpoint. The next architectural milestone can therefore focus on a **Generic Exercise Host / Exercise Registry** without first having to untangle Supabase persistence from the exercise logic.

## Local QA commands

No npm install is required:

```bash
node tests/architecture-boundary.test.js
node tests/dashboard-repository-contract.test.js
node tests/dashboard-runtime-smoke.test.js
node tests/practice-mastery-repository-contract.test.js
node tests/trainer-data-flow-smoke.test.js
node tests/trainer-data-error-paths.test.js
```

## Deployment

This remains a static GitHub Pages application. Upload the contents of this folder to the repository root, preserving `src/`, `styles/`, and `tests/`.
