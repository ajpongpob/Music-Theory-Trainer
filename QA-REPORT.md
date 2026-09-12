# QA Report — v0.8.1-a Shared Notation Core Extraction

Date: 2026-09-12. Baseline: v0.8.0-c. Target: v0.8.1-a.

## Baseline gate and test-first work

Before source changes, c passed all 15 existing suites, 34 JS/CJS syntax checks, DOM/local assets/static HTTP, and the actual Chrome Dashboard → Host → Registry → Major Scale → Trainer browser flow. Baseline c folder and ZIP are preserved intact; development took place in a separate target folder.

NOTATION-AUDIT.md was written before extraction. Characterization tests ran against the actual original bodies/lookups before moving them. Golden fixtures captured 63 pitch conversions, 50 step conversions, 11 clamps, 12 accidental offset cases, 21 rhythm/accidental shortcut cases, 20 spacing cases and 80 pitch-movement cases. No baseline production issue was found.

## Production files added / modified

Added: `src/domain/notation/notation-core.js`.

Modified:

- `src/trainer.js`: one core namespace binding, wrappers for five existing pure functions, delegation of two literal lookup expressions, app_version only.
- `src/exercises/major-scale/major-scale.domain.js`: existing accidentalOffset function now delegates to the shared implementation; every other byte is unchanged.
- `src/exercises/major-scale/exercise.definition.js`: checkpoint version metadata only.
- `index.html`: one static core script before consumers, title/pill version only.

New QA files: tests/notation-core.test.js, tests/notation-boundary.test.js, tests/helpers/restore-notation-baseline.cjs, tests/fixtures/notation-v080c-golden.json and tests/fixtures/notation-extraction-boundary.json. Existing tests only adjust dependency loading, version expectations and the cumulative source-boundary check. No inherited test was removed or disabled. All changed/added paths are listed in MIGRATION-MANIFEST.json.

## Functions moved and wrapped

Exact original bodies moved: pitchToStep, stepToPitch, musicEm, sp, accidentalOffset. clampStaffStep retains its exact arithmetic body; its original bounds become explicit parameters supplied by its legacy wrapper. Legacy named wrappers preserve all existing call sites, including callbacks supplied to Major Scale.

The two new functions rhythmFromShortcut and accidentalFromShortcut wrap the exact original lookup expressions from the Trainer keyboard API bridge. Keyboard event listeners, API methods, guards and setTool/editing behavior are not moved. No note-duration calculation or new normalization policy was introduced.

Not moved: state, autoStem, effectiveStem, beamStemDirectionFromNotes, getBeamDirection, getBeamLevel, buildBeamSegments, drawBeams, beamGroupSignatures, normalizeBeamGroups, drawSignature, drawScore, drawExample, drawNote, drawLedger, drawAccidentalForNote, render, layout routines, pointer handlers/capture/hit tests, moveSelectedPitch, selection gestures, cursor editing, keyboard listeners and all session/persistence/mastery logic. See NOTATION-AUDIT.md for dependency categories and reasons.

## Automated results

| Test | Result |
|---|---|
| `tests/answer-feedback-transition.test.js` | PASS |
| `tests/architecture-boundary.test.js` | PASS |
| `tests/dashboard-repository-contract.test.js` | PASS |
| `tests/dashboard-runtime-smoke.test.js` | PASS |
| `tests/exercise-contract-hardening.test.js` | PASS |
| `tests/exercise-host.test.js` | PASS |
| `tests/exercise-registry-boundary.test.js` | PASS |
| `tests/exercise-registry-contract.test.js` | PASS |
| `tests/major-scale-domain.test.js` | PASS |
| `tests/notation-boundary.test.js` | PASS |
| `tests/notation-core.test.js` | PASS |
| `tests/package-static-integrity.test.js` | PASS |
| `tests/practice-mastery-repository-contract.test.js` | PASS |
| `tests/secondary-beam-regression.test.js` | PASS |
| `tests/static-http.test.js` | PASS |
| `tests/trainer-data-error-paths.test.js` | PASS |
| `tests/trainer-data-flow-smoke.test.js` | PASS |
| tests/exercise-routing.browser.cjs | PASS — actual Chrome, fixture backend |
| All 38 JS/CJS syntax checks | PASS |
| ZIP integrity and extracted reruns | See DELIVERY-CHECKS.txt |

The inherited suites cover Contract adversarial cases, Registry, Host normalization/unsupported/double launch/context/return, Major Scale generation/spelling/expected notes/scoring, Dashboard repositories and runtime, Auth/recovery, Practice/Mastery success/error paths, Feedback and natural hotkey. Existing golden coverage remains 29 keys, 261 exact evaluation results and 24 deterministic generator sequences. Scoring octave acceptance/rejection behavior and payload structures remain unchanged.

Actual browser checks passed: single launch on double-click, A-G input, click, drag, Shift range, mobile-width range selection, sharp/flat/natural/double accidentals, durations, stems, primary beam/remove, 100% answer, attempt fixture recording, Feedback → Mastery → Continue → Dashboard → reopen. No page errors or failed local assets occurred. This is real browser execution with mocked backend, not live Supabase end-to-end validation.

Historical secondary hook: penultimate eighth / last sixteenth points left/inward for both stem directions in the existing geometry test. Beam implementation remains byte-identical. Natural `.` works and `N` does not; keyboard.js is byte-identical.

## Diff and source evidence

Expected production changes are the five paths above. Unexpected production changes: none. New boundary fixtures reconstruct exact c source from the targeted edits and verify SHA-256 for Trainer, Major Scale domain, definition and index. The inherited c→corrected-b source reconstruction still runs after reversing a→c. Moved helper bodies are also checked as exact source copies.

Consequently every renderer, beam, pointer/gesture, stem and controller body outside the enumerated pure wrappers/lookups is byte-identical to c. Keyboard, Auth, Student/Teacher Dashboards, Host, Registry, Contract, repositories, Supabase client, config, adapter and CSS are protected by exact file hashes. There is no global state rewrite or duplicated notation/session state.

Unresolved new findings: Critical 0 / High 0 / Medium 0 / Low 0 within this review. Existing architectural residue: staffStepToPitch in Trainer contains a keyAcc table and accesses state.key.name; it is called by insertNoteAtCursor. It is not a pure generic pitch converter and was deliberately not moved or corrected. This is documented inherited coupling, not a newly introduced core leak.

## Security, leakage and load order

Production scan: no service_role marker, eval, new Function, dynamic import or user-controlled script loading. The publishable key architecture/client source is unchanged; one existing publishable marker remains in source. No new secret or remote dependency was introduced.

Core scan: no DOM/SVG mutation, Supabase/repository/network access, exercise code, key pool, scale spelling or stage assumption. MajorScaleApp is the inherited namespace name only. SEARCH-AUDIT.md records source occurrences and the inherited Trainer keyAcc coupling. Registry still resolves explicit registered definitions; exercise codes do not become paths or source code.

Actual dependency order: existing Supabase/data infrastructure → notation core → Contract → Registry → Host → Major Scale config/domain → adapter/definition → Dashboards/Auth → Trainer → Keyboard. This preserves the real existing dependencies; core is ready before its consumers. No ES module or async-loader migration.

Static validation: 104 unique DOM IDs, no missing literal DOM references, 20 local HTML assets. All 21 production files serve HTTP 200 under /checkpoint/ and returned bytes match disk. Static GitHub Pages deployment needs no build, npm installation or Node backend.

## Limitations / manual requirements

- Backend persistence/Auth/RLS/email are fixture tested; live Supabase was not exercised or changed.
- Mobile selection uses a mobile-width Chrome viewport. Physical touch devices, Safari/Firefox and assistive technology remain manual checks.
- Legacy rendering and interaction remain in Trainer by design. The core exposes existing note-value lookup data, not a new duration model or full notation engine.
- Baseline continues mastery-driven practice with lazy session creation; no five-question cutoff, scoring rule or progression change was introduced.

No deployment, commit or database change. Stop at v0.8.1-a.
