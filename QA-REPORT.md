# QA Report — v0.7.4

## Result
**PASS for source/package QA. Live deployed regression testing is still required before adopting v0.7.4 as the new golden baseline.**

## Why this checkpoint is intentionally narrow
v0.7.3 was confirmed working by the user. v0.7.4 therefore moves only the Trainer's persistence/read boundary. It does not introduce the Generic Exercise Host yet and does not restructure notation, scoring, or the Major Scale domain.

## New data boundaries

### `practice.repository.js`
Owns Supabase details for:
1. Resolve required active Exercise.
2. Resolve required active Stage.
3. Create practice session.
4. Read open practice sessions.
5. Close practice session.
6. Create Attempt.
7. Create Attempt Skill Results.
8. Update/complete practice session.

### `mastery.repository.js`
Owns Supabase details for:
1. Resolve active Exercise for progress lookup.
2. Read active Stages.
3. Read in-progress Stage progress.
4. Read required Stage items.
5. Read practice sessions scoped to Exercise/Stage.
6. Read recent Attempt item coverage.
7. Call `get_my_stage_mastery`.
8. Call `advance_my_stage_if_mastered`.

`trainer.js` still owns orchestration. This is intentional: data access was extracted without simultaneously rewriting business logic.

## Automated test result
All passed:
- `architecture-boundary.test.js`
- `dashboard-repository-contract.test.js`
- `dashboard-runtime-smoke.test.js`
- `practice-mastery-repository-contract.test.js`
- `trainer-data-flow-smoke.test.js`
- `trainer-data-error-paths.test.js`

## Protected logic comparison
18 high-risk notation/scoring/session functions were compared directly against v0.7.3 and are unchanged. In particular, secondary-beam algorithms, stem direction, answer checking, and score aggregation were not edited.

## Live GitHub Pages checks still required
- Student login and Student Dashboard.
- Teacher login and Teacher Dashboard.
- Continue/Review -> Trainer.
- Complete a 5-question session and verify no duplicate/error in Attempt saving.
- Confirm Mastery Progress updates.
- Confirm Stage progression after mastery.
- Recheck note input, accidentals, stem direction, primary beam, and secondary beam/hook behavior.
- Browser Console: no unexpected error.
- Network: no local asset 404.
