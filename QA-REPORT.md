# v0.8.0-a QA Report

Baseline: user-verified deployed v0.7.5.

## Result

**PASS — Exercise Contract + Exercise Registry infrastructure added with no intended runtime routing change.**

## Automated tests

All 10 Node tests pass:

1. `answer-feedback-transition.test.js`
2. `architecture-boundary.test.js`
3. `dashboard-repository-contract.test.js`
4. `dashboard-runtime-smoke.test.js`
5. `exercise-registry-boundary.test.js`
6. `exercise-registry-contract.test.js`
7. `package-static-integrity.test.js`
8. `practice-mastery-repository-contract.test.js`
9. `trainer-data-error-paths.test.js`
10. `trainer-data-flow-smoke.test.js`

All 14 JavaScript source files and all test files pass `node --check`.

## Registry-specific verification

PASS:
- Exercise Contract v1.0 validates identity, localized names, capabilities, metadata, and contract version.
- Invalid exercise codes are rejected.
- Unsupported contract versions are rejected.
- Duplicate registrations are rejected.
- Registry lookup normalizes exercise code casing.
- Registered definitions are immutable at the exposed contract level.
- Exactly one exercise definition is registered: `MAJOR_SCALE_NOTATION`.
- Exercise infrastructure has no DOM or Supabase dependency.
- Dashboard does not consume the registry yet; legacy launch behavior remains intentional until v0.8.0-b.

## Regression/runtime verification

PASS:
- Student Dashboard mock runtime.
- Teacher Dashboard mock runtime.
- Login → Teacher routing.
- Forgot Password.
- Password Recovery.
- Dashboard repository contract.
- Practice/Mastery repository contract (17 operations).
- Trainer Practice/Mastery success path.
- Trainer data error-path safeguards.
- Checked-answer feedback transition.
- Natural `.` shortcut behavior.

## Diff boundary against v0.7.5

Byte-for-byte unchanged:
- `src/auth-dashboard.js`
- `src/dashboard/dashboard-utils.js`
- `src/dashboard/student-dashboard.js`
- `src/dashboard/teacher-dashboard.js`
- all five existing `src/data/*.js` files
- `src/keyboard.js`
- `styles/app.css`

`src/trainer.js` differs only by `app_version: "0.8.0-a"`.

`index.html` differs only by:
- visible/document version metadata;
- three new script tags for Exercise Contract, Registry, and Major Scale definition.

## Static/package verification

PASS:
- 104 unique DOM IDs; no duplicates.
- All literal DOM references found in source resolve to existing elements.
- 15 local runtime assets referenced by `index.html` exist.
- Static HTTP smoke returned 200 for index, CSS, registry scripts, Dashboard, Trainer, and Keyboard assets.
- No `service_role` string exists in frontend runtime files.

## Limitation

The exercise registry is deliberately not used for launching exercises in this checkpoint. Final deployed GitHub Pages smoke testing remains required before accepting v0.8.0-a as a new user-verified baseline.
